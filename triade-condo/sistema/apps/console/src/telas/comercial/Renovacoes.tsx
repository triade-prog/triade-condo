"use client";
// Renovações (quadro 346; CM-30, CM-31 e CM-32, Q.1): os clientes com aniversário de contrato, os
// sinais de risco, a chance de crescer e os pedidos de cancelamento, em quatro abas. Nada muda no
// valor sem o aviso enviado; o aviso gera o aditivo (CM-13). O índice vem do advogado: sem ele, a tela
// mostra "[a definir com o advogado]" e não calcula. Confirmar o cancelamento é da Administração. O
// Comercial vê o nome do cliente e o plano, não os dados do condomínio (CM-11).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { mesComercialSchema, TEXTO_INDICE_A_DEFINIR } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, Vazio } from "@triade/ui";
import { AbasLista, CabecaPagina, Cartao, plural } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import { hojeLocal } from "./comum.tsx";
import { useBaixar } from "./janelasContrato.tsx";
import {
  JanelaAviso, JanelaCancelamento, JanelaEncerrarExpansao, JanelaExpansao, JanelaMarcarRisco, JanelaRegistrarPedido, JanelaRegraReajuste, JanelaSemReajuste,
  JanelaTratarRisco,
} from "./janelasRenovacoes.tsx";
import {
  ABAS_RENOVACOES, abaDoEndereco, contagemAba, detalheCancelamento, detalheExpansao, detalheRenovacao, mesesRenovacoes, nomeExpansao, nomeSituacaoCancelamento,
  podeAvisar, podeDispensar, ROTAS_RENOVACOES, seloAviso, TELA_RENOVACOES, textoClientesRisco, textoComReajuste, textoRegra, textoSinal, textoValorHoje, TOM_CANCELAMENTO,
  type AbaRenovacoes, type Cancelamento, type Expansao, type Renovacao, type SugestaoExpansao, type TelaRenovacoes,
} from "./renovacoes.ts";

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

type Janela =
  | { tipo: "regra" }
  | { tipo: "aviso"; r: Renovacao }
  | { tipo: "semReajuste"; r: Renovacao }
  | { tipo: "risco"; interessadoId?: string }
  | { tipo: "tratar"; sinal: { id: string; versao: number; texto: string }; condominio: string }
  | { tipo: "pedido" }
  | { tipo: "cancelamento"; k: Cancelamento }
  | { tipo: "expansao"; e?: Expansao; sugestao?: SugestaoExpansao }
  | { tipo: "encerrar"; e: Expansao };

/** Os botões de uma renovação: registrar o aviso, renovar sem reajuste ou baixar o aditivo. */
function AcoesRenovacao({ r, pode, podeSemReajuste, hoje, abrir, baixar, baixando, montar }: {
  r: Renovacao; pode: boolean; podeSemReajuste: boolean; hoje: string; abrir: (j: Janela) => void; baixar: (caminho: string) => void; baixando: string | null;
  montar: (id: string) => void;
}) {
  if (r.aditivo?.situacao === "PRONTO" && r.id) {
    const caminho = ROTAS_RENOVACOES.linkAditivo(r.id);
    return (
      <Botao variante="discreto" tamanho="p" disabled={baixando === caminho} onClick={() => baixar(caminho)} aria-label={baixando === caminho ? `Baixando o aditivo nº ${r.aditivo.numero} do ${r.condominio}` : `Baixar o aditivo nº ${r.aditivo.numero} do ${r.condominio}`}>
        <Icone nome="baixar" />{baixando === caminho ? "Baixando…" : `Aditivo nº ${r.aditivo.numero}`}
      </Botao>
    );
  }
  if (r.aditivo?.situacao === "GERANDO" && r.id && pode) {
    return <Botao variante="discreto" tamanho="p" onClick={() => montar(r.id!)}><Icone nome="trocar" />Montar o aditivo</Botao>;
  }
  if (r.id || !pode) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {podeAvisar(r, hoje) ? <Botao variante="secundario" tamanho="p" onClick={() => abrir({ tipo: "aviso", r })} aria-label={`Registrar o aviso do ${r.condominio}`}><Icone nome="enviar" />Registrar o aviso</Botao> : null}
      {podeSemReajuste && podeDispensar(r, hoje) ? <Botao variante="discreto" tamanho="p" onClick={() => abrir({ tipo: "semReajuste", r })} aria-label={`Renovar o ${r.condominio} sem reajuste`}>Sem reajuste</Botao> : null}
    </span>
  );
}

function AbaReajuste({ d, abrir, montar }: { d: TelaRenovacoes; abrir: (j: Janela) => void; montar: (id: string) => void }) {
  const { baixando, problema, baixar } = useBaixar();
  const chave = (r: Renovacao) => `${r.interessadoId}-${r.aniversario}`;
  if (!d.renovacoes.length) {
    return (
      <div className="p-5 max-md:p-0">
        <Vazio titulo="Nenhum aniversário de contrato no período" icone="calendario">Os clientes com aniversário até 120 dias depois do mês escolhido aparecem aqui.</Vazio>
      </div>
    );
  }
  return (
    <>
      {problema ? <div className="px-5 max-md:px-0"><Aviso tom="erro">{problema}</Aviso></div> : null}
      <table className="w-full t-texto max-md:hidden">
        <caption className="sr-only">Aniversários de contrato: valor de hoje, com reajuste e o aviso ao síndico</caption>
        <thead>
          <tr className="t-rotulo text-left text-tinta-suave">
            <th scope="col" className="px-5 py-2.5 font-medium">Cliente</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Aniversário</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Hoje</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Com reajuste</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Aviso ao síndico</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          {d.renovacoes.map((r) => {
            const s = seloAviso(r, d.hoje);
            const det = detalheRenovacao(r);
            return (
              <tr key={chave(r)} className="align-top hover:bg-violeta-50/50">
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <Link href={`/comercial/${r.interessadoId}`} className="font-medium hover:text-violeta-600 hover:underline">{r.condominio}</Link>
                  {det ? <span className="block t-apoio">{det}</span> : null}
                </th>
                <td className="px-3 py-3 tabular-nums">{dataBr(r.aniversario)}</td>
                <td className="px-3 py-3 tabular-nums">{textoValorHoje(r)}</td>
                <td className="px-3 py-3 tabular-nums">{textoComReajuste(r)}</td>
                <td className="px-5 py-3">
                  <span className="grid justify-items-start gap-2">
                    <Selo tom={s.tom}>{s.texto}</Selo>
                    <AcoesRenovacao r={r} pode={d.pode.editar} podeSemReajuste={d.pode.confirmar} hoje={d.hoje} abrir={abrir} baixar={(c) => void baixar(c)} baixando={baixando} montar={montar} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="grid gap-3 md:hidden" aria-label="Aniversários de contrato">
        {d.renovacoes.map((r) => {
          const s = seloAviso(r, d.hoje);
          const det = detalheRenovacao(r);
          return (
            <li key={chave(r)} className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
              <span className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/comercial/${r.interessadoId}`} className="font-medium text-tinta [overflow-wrap:anywhere]">{r.condominio}</Link>
                <Selo tom={s.tom}>{s.texto}</Selo>
              </span>
              <span className="t-apoio">{`Aniversário ${dataBr(r.aniversario)}`}</span>
              <span className="t-texto tabular-nums">{`Hoje ${textoValorHoje(r)} · com reajuste ${textoComReajuste(r)}`}</span>
              {det ? <span className="t-apoio">{det}</span> : null}
              <AcoesRenovacao r={r} pode={d.pode.editar} podeSemReajuste={d.pode.confirmar} hoje={d.hoje} abrir={abrir} baixar={(c) => void baixar(c)} baixando={baixando} montar={montar} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function AbaRisco({ d, abrir }: { d: TelaRenovacoes; abrir: (j: Janela) => void }) {
  if (!d.riscos.length) {
    return (
      <div className="p-5 max-md:p-0">
        <Vazio titulo="Nenhum sinal de risco" icone="escudo">Síndico novo eleito, uso caindo e troca de sistema na pauta aparecem aqui.</Vazio>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-linha max-md:grid max-md:gap-3 max-md:divide-y-0" aria-label="Clientes com sinal de risco">
      {d.riscos.map((c) => (
        <li key={c.interessadoId} className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4">
          <span className="grid gap-0.5">
            <b className="t-texto [overflow-wrap:anywhere]">{c.condominio}</b>
            {c.plano ? <span className="t-apoio">{c.plano}</span> : null}
          </span>
          <ul className="flex flex-wrap gap-2" aria-label={`Sinais do ${c.condominio}`}>
            {c.sinais.map((s) => (
              <li key={s.id} className="flex items-center gap-1">
                <Selo tom="atencao">{textoSinal(s)}</Selo>
                {d.pode.editar ? (
                  <Botao variante="discreto" tamanho="p" aria-label={`Já vi: ${textoSinal(s)} (${c.condominio})`}
                    onClick={() => abrir({ tipo: "tratar", sinal: { id: s.id, versao: s.versao, texto: textoSinal(s) }, condominio: c.condominio })}>Já vi</Botao>
                ) : null}
              </li>
            ))}
          </ul>
          <Link href={`/comercial/${c.interessadoId}`} className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline" aria-label={`Abrir ${c.condominio}`}>
            Abrir<Icone nome="dir" className="h-4 w-4" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AbaExpansao({ d, abrir }: { d: TelaRenovacoes; abrir: (j: Janela) => void }) {
  if (!d.expansoes.length && !d.sugestoes.length) {
    return (
      <div className="p-5 max-md:p-0">
        <Vazio titulo="Nenhuma expansão aberta" icone="grafico">Mais um prédio da mesma pessoa, mudança de faixa e reconquista entram aqui, num funil próprio.</Vazio>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-linha max-md:grid max-md:gap-3 max-md:divide-y-0" aria-label="Expansão">
      {d.sugestoes.map((s) => (
        <li key={`sug-${s.tipo}-${s.interessadoId}`} className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4">
          <b className="t-texto [overflow-wrap:anywhere]">{s.condominio}</b>
          <span className="grid gap-0.5"><span className="t-texto">{s.motivo}</span><span className="t-apoio">Sugestão: ainda fora do funil</span></span>
          <span className="flex flex-wrap items-center gap-2">
            <Selo tom="andamento">{nomeExpansao(s.tipo)}</Selo>
            {d.pode.editar ? (
              <Botao variante="secundario" tamanho="p" aria-label={`Pôr no funil: ${nomeExpansao(s.tipo)} do ${s.condominio}`} onClick={() => abrir({ tipo: "expansao", sugestao: s })}>
                <Icone nome="mais" />Pôr no funil
              </Botao>
            ) : null}
          </span>
        </li>
      ))}
      {d.expansoes.map((e) => (
        <li key={e.id} className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4">
          <span className="grid gap-0.5">
            <b className="t-texto [overflow-wrap:anywhere]">{e.nome}</b>
            {e.nome !== e.condominio ? <span className="t-apoio">{`Cliente: ${e.condominio}`}</span> : null}
          </span>
          <span className="grid gap-0.5">
            <span className="t-texto">{e.motivo}</span>
            <span className="t-apoio">{detalheExpansao(e)}</span>
            {e.oportunidade ? <Link href={`/comercial/${e.oportunidade.id}`} className="t-apoio text-violeta-600 hover:underline">{`Oportunidade: ${e.oportunidade.condominio}`}</Link> : null}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Selo tom={e.encerradaEm ? (e.etapa === "GANHA" ? "ok" : "neutro") : "andamento"}>{nomeExpansao(e.tipo)}</Selo>
            {d.pode.editar && !e.encerradaEm ? (
              <>
                <Botao variante="discreto" tamanho="p" aria-label={`Mudar a expansão do ${e.nome}`} onClick={() => abrir({ tipo: "expansao", e })}><Icone nome="editar" />Mudar</Botao>
                <Botao variante="discreto" tamanho="p" aria-label={`Encerrar a expansão do ${e.nome}`} onClick={() => abrir({ tipo: "encerrar", e })}>Encerrar</Botao>
              </>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AbaCancelamentos({ d, abrir }: { d: TelaRenovacoes; abrir: (j: Janela) => void }) {
  if (!d.cancelamentos.length) {
    return (
      <div className="p-5 max-md:p-0">
        <Vazio titulo="Nenhum pedido de cancelamento" icone="check">Quando um síndico pedir para cancelar, registre aqui: o motivo, uma tentativa de retenção e a decisão.</Vazio>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-linha max-md:grid max-md:gap-3 max-md:divide-y-0" aria-label="Pedidos de cancelamento">
      {d.cancelamentos.map((k) => {
        const aberto = k.situacao === "PEDIDO" || k.situacao === "EM_RETENCAO";
        return (
          <li key={k.id} className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] md:items-center max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4">
            <b className="t-texto [overflow-wrap:anywhere]">{k.condominio}</b>
            <span className="t-apoio">{detalheCancelamento(k)}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Selo tom={TOM_CANCELAMENTO[k.situacao]}>{nomeSituacaoCancelamento(k.situacao)}</Selo>
              {aberto ? (
                <Botao variante="secundario" tamanho="p" aria-label={`Abrir o pedido de cancelamento do ${k.condominio}`} onClick={() => abrir({ tipo: "cancelamento", k })}>Abrir</Botao>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Renovacoes() {
  const busca = useSearchParams();
  const router = useRouter();
  const sessao = useSessao();
  const hoje = hojeLocal();
  const atual = hoje.slice(0, 7);
  const pedido = busca.get("mes");
  const mes = pedido && mesComercialSchema.safeParse(pedido).success && pedido >= atual ? pedido : null;
  const carga = useCarregar<TelaRenovacoes>(ROTAS_RENOVACOES.tela(mes));
  const [aba, setAba] = useState<AbaRenovacoes>(abaDoEndereco(busca.get("aba")));
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const d = carga.estado === "pronto" ? carga.dados : null;
  const mostrado = d?.mes ?? mes ?? atual;
  const pronto = (texto: string) => { setJanela(null); setAviso({ tom: "ok", texto }); carga.recarregar(); };
  const irPara = (proximo: { mes?: string | null; aba?: AbaRenovacoes }) => {
    const q = new URLSearchParams();
    const m = proximo.mes === undefined ? mes : proximo.mes;
    const a = proximo.aba ?? aba;
    if (m && m !== atual) q.set("mes", m);
    if (a !== "REAJUSTE") q.set("aba", ABAS_RENOVACOES[a].endereco);
    router.replace(q.size ? `${TELA_RENOVACOES}?${q}` : TELA_RENOVACOES, { scroll: false });
  };
  async function montar(id: string) {
    const r = await chamarApi(ROTAS_RENOVACOES.aditivo(id), { corpo: {} });
    if (!r.ok) return setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
    pronto("Aditivo montado. Já dá para baixar.");
  }
  const abas = (Object.keys(ABAS_RENOVACOES) as AbaRenovacoes[]).map((a) => ({ valor: a, texto: ABAS_RENOVACOES[a].texto, n: d ? contagemAba(d, a) : undefined }));
  const cliente = (id: string) => d?.clientes.find((c) => c.id === id);

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Renovações"
        apoio="Clientes com aniversário de contrato, sinais de risco e chance de crescer. Fica no Comercial (Q.1)."
        acao={(
          <div className="flex flex-wrap items-end gap-2 max-md:w-full">
            <CampoSelecao id="renovacoes-mes" rotulo="Mês" icone="calendario" className="min-w-[200px] max-md:w-full" value={mostrado} opcoes={mesesRenovacoes(atual)}
              onChange={(e) => irPara({ mes: e.target.value })} />
          </div>
        )} />
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando as renovações…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? (
        <>
          <section aria-label="Renovações" className="grid content-start gap-3 md:overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
            <AbasLista rotulo="Partes das renovações" abas={abas} atual={aba} aoMudar={(a) => { setAba(a); irPara({ aba: a }); }} />
            {d.pode.editar && aba !== "REAJUSTE" ? (
              <div className="flex flex-wrap gap-2 px-5 max-md:px-0">
                {aba === "RISCO" ? <Botao variante="secundario" onClick={() => setJanela({ tipo: "risco" })}><Icone nome="alerta" />Marcar sinal</Botao> : null}
                {aba === "EXPANSAO" ? <Botao variante="secundario" onClick={() => setJanela({ tipo: "expansao" })}><Icone nome="mais" />Abrir expansão</Botao> : null}
                {aba === "CANCELAMENTOS" ? <Botao variante="secundario" onClick={() => setJanela({ tipo: "pedido" })}><Icone nome="mais" />Registrar pedido</Botao> : null}
              </div>
            ) : null}
            {aba === "REAJUSTE" ? <AbaReajuste d={d} abrir={setJanela} montar={(id) => void montar(id)} /> : null}
            {aba === "RISCO" ? <AbaRisco d={d} abrir={setJanela} /> : null}
            {aba === "EXPANSAO" ? <AbaExpansao d={d} abrir={setJanela} /> : null}
            {aba === "CANCELAMENTOS" ? <AbaCancelamentos d={d} abrir={setJanela} /> : null}
            {aba === "REAJUSTE" ? (
              <p className="border-t border-linha px-5 py-3 t-apoio max-md:border-t-0 max-md:px-0">
                {`Nada muda no valor sem o aviso enviado; o aviso gera o aditivo (CM-13, CM-30).${d.regra.definida ? "" : ` O índice fica ${TEXTO_INDICE_A_DEFINIR}.`}`}
              </p>
            ) : null}
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Cartao id="renovacoes-regra" titulo="Regra do reajuste" icone="ajuste"
              acao={d.pode.regra ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "regra" })}><Icone nome="editar" />Mudar</Botao> : undefined}>
              <p className="t-texto">{textoRegra(d.regra)}</p>
              <p className="t-apoio">
                {d.modeloAditivo ? `Aditivo do modelo v${d.modeloAditivo.numero} (${d.modeloAditivo.titulo}).` : "Sem modelo de aditivo em uso: o aviso vale sem aditivo."}
                {" O fim do preço de fundador passa para a tabela cheia da faixa."}
              </p>
              {!d.pode.regra ? <p className="t-apoio">A regra é da Administração, em Modelos.</p> : null}
            </Cartao>
            <Cartao id="renovacoes-risco" titulo="Risco" icone="alerta" acao={d.riscos.length ? <Selo tom="atencao">{textoClientesRisco(d.riscos.length)}</Selo> : undefined}>
              {d.riscos.length ? (
                <ul className="grid gap-2">
                  {d.riscos.slice(0, 4).map((c) => (
                    <li key={c.interessadoId} className="flex flex-wrap items-center gap-2">
                      <b className="t-texto">{c.condominio}</b>
                      {c.sinais.map((s) => <Selo key={s.id} tom="atencao">{textoSinal(s)}</Selo>)}
                    </li>
                  ))}
                </ul>
              ) : <p className="t-apoio">Nenhum sinal sem tratar.</p>}
              {d.riscos.length ? <Botao variante="discreto" className="justify-self-start" onClick={() => { setAba("RISCO"); irPara({ aba: "RISCO" }); }}>Ver os sinais</Botao> : null}
            </Cartao>
          </div>
          <p className="t-apoio">{`${plural(d.clientes.length, "cliente com contrato", "clientes com contrato")}. O Comercial vê o nome do cliente e o plano, não os dados do condomínio (CM-11).`}</p>
        </>
      ) : null}
      {d && janela?.tipo === "regra" ? <JanelaRegraReajuste r={d.regra} aoFechar={() => setJanela(null)} feito={() => pronto("Regra do reajuste salva.")} /> : null}
      {d && janela?.tipo === "aviso" ? (
        <JanelaAviso r={janela.r} regra={d.regra} cliente={cliente(janela.r.interessadoId)} hoje={d.hoje} comAditivo={!!d.modeloAditivo}
          aoFechar={() => setJanela(null)} feito={pronto} />
      ) : null}
      {d && janela?.tipo === "semReajuste" ? <JanelaSemReajuste r={janela.r} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {d && janela?.tipo === "risco" ? <JanelaMarcarRisco clientes={d.clientes} interessadoId={janela.interessadoId} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {d && janela?.tipo === "tratar" ? <JanelaTratarRisco sinal={janela.sinal} condominio={janela.condominio} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
      {d && janela?.tipo === "pedido" ? (
        <JanelaRegistrarPedido clientes={d.clientes} avisoDias={d.avisoCancelamentoDias} hoje={d.hoje} aoFechar={() => setJanela(null)}
          feito={(k) => { setJanela(null); setAviso({ tom: "ok", texto: `Pedido registrado. Se confirmar, o último dia é ${dataBr(k.ultimoDia)}.` }); carga.recarregar(); }} />
      ) : null}
      {d && janela?.tipo === "cancelamento" ? (
        <JanelaCancelamento k={janela.k} hoje={d.hoje} podeEditar={d.pode.editar} podeConfirmar={d.pode.confirmar} aoFechar={() => setJanela(null)} feito={pronto} />
      ) : null}
      {d && janela?.tipo === "expansao" ? (
        <JanelaExpansao e={janela.e} sugestao={janela.sugestao} clientes={d.clientes} equipe={d.equipe} eu={sessao.pessoaId} hoje={d.hoje}
          aoFechar={() => setJanela(null)} feito={pronto} />
      ) : null}
      {d && janela?.tipo === "encerrar" ? <JanelaEncerrarExpansao e={janela.e} aoFechar={() => setJanela(null)} feito={pronto} /> : null}
    </div>
  );
}
