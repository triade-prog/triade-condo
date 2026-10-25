"use client";
// Painel comercial (quadro 334, pag332 do gerador; CM-10, K.1): os números do mês para a equipe,
// sem nome de interessado. Duas fileiras de números, o funil "até onde cada um chegou" em barras
// de HTML, por origem, por que não fechou, contra cada concorrente, por pessoa e as propostas
// vencendo. Só lê; a meta do mês, total e por pessoa, só a Administração muda. ?mes=AAAA-MM
// escolhe o mês; previsão, parados, propostas vencendo e vagas de fundador são sempre de agora.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ETAPAS_COMERCIAL, mesComercialSchema, percentual } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, CampoTexto, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Vazio, type ErroApi } from "@triade/ui";
import { CabecaPagina, Cartao, diaHora, plural } from "../comum.tsx";
import { campoDosCentavos, centavosDoCampo, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeLocal } from "./comum.tsx";
import {
  apoioPrimeiroRetorno, barrasFunil, mesesDoSeletor, nomeMotivo, nomeOrigemPainel, reais, ROTAS_PAINEL, textoMes, textoMeta, textoPrimeiroRetorno, textoPromessas, textoVence,
  type PainelComercial,
} from "./painel.ts";
import { TELAS_PROPOSTAS } from "./propostas.ts";

function Numero({ rotulo, valor, apoio, tom }: { rotulo: string; valor: string; apoio: string; tom?: "atencao" | "ok" }) {
  const cor = tom === "atencao" ? "text-atencao" : tom === "ok" ? "text-ok" : "text-tinta";
  return (
    <div className="grid content-start gap-1 rounded-[18px] border border-linha bg-superficie px-5 py-4 shadow-s1 max-md:px-4 max-md:py-3">
      <dt className="t-apoio text-tinta-suave">{rotulo}</dt>
      <dd className={`t-titulo-tela font-semibold tabular-nums ${cor}`}>{valor}</dd>
      <dd className="t-apoio text-tinta-suave">{apoio}</dd>
    </div>
  );
}

function Tabela({ legenda, colunas, linhas, vazio }: { legenda: string; colunas: string[]; linhas: ReactNode[][]; vazio: string }) {
  if (!linhas.length) return <p className="t-apoio">{vazio}</p>;
  return (
    <table className="w-full t-texto">
      <caption className="sr-only">{legenda}</caption>
      <thead>
        <tr className="t-rotulo text-left text-tinta-suave">
          {colunas.map((c, i) => <th key={c} scope="col" className={`pb-2 font-medium ${i ? "text-right" : ""}`}>{c}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-linha">
        {linhas.map((l, n) => (
          <tr key={n}>
            {l.map((c, i) => (i ? <td key={i} className="py-2.5 pl-3 text-right tabular-nums">{c}</td>
              : <th key={i} scope="row" className="py-2.5 pr-3 text-left font-normal [overflow-wrap:anywhere]">{c}</th>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** O funil em barras de HTML: o texto fica visível; a barra é só desenho. */
function Funil({ p }: { p: PainelComercial }) {
  if (!p.novos) return <Vazio titulo="Nenhum interessado novo neste mês" icone="grafico">Quem pedir demonstração no site ou for registrado à mão aparece aqui.</Vazio>;
  return (
    <ol className="grid gap-2" aria-label={`Até onde chegaram os ${p.novos} novos do mês`}>
      {barrasFunil(p).map((b) => (
        <li key={b.etapa} className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_88px] items-center gap-3 max-md:grid-cols-[minmax(0,1fr)_76px] max-md:gap-x-2 max-md:gap-y-1">
          <span className="t-texto">{b.texto}</span>
          <span className="h-[22px] overflow-hidden rounded-[8px] bg-superficie-2 max-md:order-last max-md:col-span-2 max-md:h-3" aria-hidden="true">
            <span className="block h-full rounded-[8px] bg-[image:var(--grad-acao)]" style={{ width: `${b.pct}%` }} />
          </span>
          <span className="text-right t-texto tabular-nums">{`${b.n} · ${b.pct}%`}</span>
        </li>
      ))}
    </ol>
  );
}

function JanelaMeta({ p, aoFechar, feito }: { p: PainelComercial; aoFechar: () => void; feito: () => void }) {
  const doMes = p.meta && !p.meta.herdada ? p.meta : null;
  const [total, setTotal] = useState(campoDosCentavos(p.meta?.total));
  const [pessoas, setPessoas] = useState<Record<string, string>>(
    Object.fromEntries(p.equipe.map((e) => [e.id, campoDosCentavos(p.meta?.porPessoa.find((x) => x.pessoa.id === e.id)?.centavos)])));
  const [erroCampo, setErroCampo] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const erros: Record<string, string> = {};
    const t = centavosDoCampo(total);
    if ("erro" in t) erros.total = t.erro;
    else if (t.centavos === null) erros.total = "Informe a meta do mês.";
    const porPessoa: { pessoaId: string; centavos: number }[] = [];
    for (const e of p.equipe) {
      const v = centavosDoCampo(pessoas[e.id] ?? "");
      if ("erro" in v) erros[e.id] = v.erro;
      else if (v.centavos !== null) porPessoa.push({ pessoaId: e.id, centavos: v.centavos });
    }
    setErroCampo(erros);
    if (Object.keys(erros).length || !("centavos" in t) || t.centavos === null) return;
    setEnviando(true);
    const r = await chamarApi(ROTAS_PAINEL.meta, { metodo: "PUT", corpo: { mes: p.mes, versao: doMes?.versao ?? null, total: t.centavos, porPessoa } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Meta de ${textoMes(p.mes)}`} aoFechar={aoFechar} media apoio="Novo MRR do mês: a soma das mensalidades dos que viraram Ganho. A meta vale também para os meses seguintes até alguém pôr outra.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoTexto id="meta-total" rotulo="Meta do mês (R$)" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} erro={erroCampo.total} placeholder="1.000,00" />
        <fieldset className="grid gap-3">
          <legend className="t-titulo-cartao">Por pessoa</legend>
          <p className="t-apoio">Opcional. Deixe em branco quem não tem meta própria.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {p.equipe.map((e) => (
              <CampoTexto key={e.id} id={`meta-${e.id}`} rotulo={e.nome} opcional inputMode="decimal" value={pessoas[e.id] ?? ""}
                onChange={(ev) => setPessoas((s) => ({ ...s, [e.id]: ev.target.value }))} erro={erroCampo[e.id]} />
            ))}
          </div>
        </fieldset>
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar a meta" icone="check" />
      </form>
    </Dialogo>
  );
}

export function Painel() {
  const busca = useSearchParams();
  const router = useRouter();
  const hoje = hojeLocal();
  const atual = hoje.slice(0, 7);
  const pedido = busca.get("mes");
  const mes = pedido && mesComercialSchema.safeParse(pedido).success ? pedido : null;
  const carga = useCarregar<PainelComercial>(ROTAS_PAINEL.painel(mes));
  const [metaAberta, setMetaAberta] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const p = carga.estado === "pronto" ? carga.dados : null;
  const meses = mesesDoSeletor(atual);
  const mostrado = p?.mes ?? mes ?? atual;
  if (!meses.some((m) => m.valor === mostrado)) meses.push({ valor: mostrado, texto: textoMes(mostrado, true) });

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Painel comercial"
        apoio={`${textoMes(mostrado, true)}. Números do funil para a equipe; nenhum nome de interessado aparece aqui.`}
        acao={(
          <div className="flex flex-wrap items-end gap-2 max-md:w-full">
            <CampoSelecao id="painel-mes" rotulo="Mês" icone="calendario" className="min-w-[220px] max-md:w-full" value={mostrado} opcoes={meses}
              onChange={(e) => { setAviso(null); router.replace(e.target.value === atual ? "/comercial/painel" : `/comercial/painel?mes=${e.target.value}`, { scroll: false }); }} />
            {p?.podeMudarMeta ? <Botao variante="contorno" className="max-md:w-full" onClick={() => setMetaAberta(true)}><Icone nome="editar" />{p.meta && !p.meta.herdada ? "Mudar a meta" : "Pôr a meta"}</Botao> : null}
          </div>
        )} />
      {aviso ? <Aviso tom="ok" papel="status">{aviso}</Aviso> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Contando o mês…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {p ? <Conteudo p={p} hoje={hoje} /> : null}
      {p && metaAberta ? (
        <JanelaMeta p={p} aoFechar={() => setMetaAberta(false)} feito={() => { setMetaAberta(false); setAviso(`Meta de ${textoMes(p.mes)} salva.`); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}

function Conteudo({ p, hoje }: { p: PainelComercial; hoje: string }) {
  const a = p.agora;
  const r = p.primeiroRetorno;
  const chegaramGanho = percentual(p.funil.at(-1)?.chegaram ?? 0, p.novos);
  const fundador = a.vagasFundador;
  return (
    <>
      <section aria-label="Números do mês" className="grid gap-4">
        <dl className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
          <Numero rotulo="Novo MRR no mês" valor={reais(p.ganhos.novoMrr)}
            apoio={`${textoMeta(p)}${p.ganhos.semValor ? ` · ${plural(p.ganhos.semValor, "ganho sem valor", "ganhos sem valor")}` : ""}`}
            tom={p.meta && p.ganhos.novoMrr >= p.meta.total ? "ok" : undefined} />
          <Numero rotulo="Previsão" valor={reais(a.previsao.centavos)}
            apoio={`valor × chance da etapa${a.previsao.semValor ? ` · ${plural(a.previsao.semValor, "aberto sem proposta", "abertos sem proposta")}` : ""}`} />
          <Numero rotulo="Primeiro retorno em 1 hora útil" valor={textoPrimeiroRetorno(r)} apoio={apoioPrimeiroRetorno(r)}
            tom={r.foraDoPrazo ? "atencao" : r.total ? "ok" : undefined} />
          <Numero rotulo="Ciclo médio" valor={p.ganhos.cicloMedioDias !== undefined ? plural(p.ganhos.cicloMedioDias, "dia", "dias") : "—"} apoio="do primeiro contato ao ganho" />
        </dl>
        <dl className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-3">
          <Numero rotulo="Viraram ganho" valor={String(p.ganhos.quantos)} apoio={chegaramGanho === null ? "nenhum novo no mês" : `${chegaramGanho}% dos novos do mês chegaram ao ganho`} />
          <Numero rotulo="Parados" valor={String(a.parados)} apoio="passou do limite da etapa, agora" tom={a.parados ? "atencao" : undefined} />
          <Numero rotulo="Sem resposta" valor={String(p.semResposta)} apoio="foram para sem resposta no mês" />
          <Numero rotulo="Vagas de fundador" valor={`${fundador.livres} de ${fundador.total}`} apoio="restantes" tom={fundador.livres ? undefined : "atencao"} />
        </dl>
        <p className="t-apoio">
          {`${textoPromessas(r)} `}
          {`Agora: ${plural(a.abertos, "interessado aberto", "interessados abertos")}, ${plural(a.atrasados, "atrasado", "atrasados")}.`}
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Cartao id="painel-funil" titulo="Até onde cada um chegou" icone="grafico">
            <p className="t-apoio">{`Dos ${plural(p.novos, "novo", "novos")} de ${textoMes(p.mes)}, a etapa mais alta a que chegaram, mesmo que depois tenham sido perdidos.`}</p>
            <Funil p={p} />
          </Cartao>
          <Cartao id="painel-etapas" titulo="Abertos agora, por etapa" icone="camadas">
            <Tabela legenda="Interessados abertos agora em cada etapa e a chance de fechar" colunas={["Etapa", "Abertos", "Chance"]} vazio="Nenhum interessado aberto agora."
              linhas={a.abertos ? a.porEtapa.map((e) => [ETAPAS_COMERCIAL[e.etapa], e.quantos, `${e.probabilidade}%`]) : []} />
          </Cartao>
          <Cartao id="painel-vencendo" titulo={`Propostas vencendo em ${plural(a.vencendoDias, "dia", "dias")}`} icone="documento">
            {a.propostasVencendo.length ? (
              <ul className="divide-y divide-linha">
                {a.propostasVencendo.map((v) => (
                  <li key={v.propostaId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`${TELAS_PROPOSTAS.lista(v.propostaId)}#proposta`} className="font-medium hover:text-violeta-600 hover:underline">{`${v.condominio} · v${v.numero}`}</Link>
                    <span className="t-apoio">{textoVence(v.validoAte, hoje)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nenhuma proposta enviada vence nos próximos dias.</p>}
          </Cartao>
        </div>
        <div className="grid content-start gap-5">
          <Cartao id="painel-origem" titulo="Por origem" icone="pin">
            <Tabela legenda={`Novos e ganhos de ${textoMes(p.mes)} por origem`} colunas={["Origem", "Novos", "Ganhos"]} vazio="Nenhum novo no mês."
              linhas={p.porOrigem.map((o) => [nomeOrigemPainel(o.origem), o.novos, o.ganhos])} />
          </Cartao>
          <Cartao id="painel-perdas" titulo="Por que não fechou" icone="fechar">
            <Tabela legenda={`Perdidos de ${textoMes(p.mes)} por motivo`} colunas={["Motivo", "Perdidos"]} vazio="Nenhum perdido no mês."
              linhas={p.perdas.motivos.map((m) => [nomeMotivo(m.motivo), m.quantos])} />
          </Cartao>
          <Cartao id="painel-concorrentes" titulo="Contra cada concorrente" icone="trocar">
            <Tabela legenda="Disputas fechadas contra cada concorrente até o fim do mês" colunas={["Concorrente", "Disputas", "Ganhamos"]}
              vazio="Nenhuma disputa fechada ainda. Os concorrentes vêm da ficha e do Perdido."
              linhas={p.concorrentes.map((c) => [c.nome, c.disputas, `${c.ganhamos} · ${percentual(c.ganhamos, c.disputas)}%`])} />
          </Cartao>
          <Cartao id="painel-pessoas" titulo="Por pessoa" icone="pessoas">
            <Tabela legenda={`Atividades e novo MRR de ${textoMes(p.mes)} por pessoa`} colunas={["Pessoa", "Atividades", "Novo MRR"]} vazio="Nenhuma atividade no mês."
              linhas={p.porPessoa.map((x) => [x.pessoa.nome, x.atividades,
                x.meta ? <span key="m" className="grid">{reais(x.novoMrr)}<span className="t-apoio text-tinta-suave">{`meta ${reais(x.meta)}`}</span></span> : reais(x.novoMrr)])} />
          </Cartao>
          {p.meta ? (
            <p className="t-apoio">
              {p.meta.herdada ? `A meta é a de ${textoMes(p.meta.mes)}, que vale até alguém pôr outra.` : "Meta do mês"}
              {p.meta.alteradoPor ? ` · posta por ${p.meta.alteradoPor.nome} em ${diaHora(p.meta.alteradoEm)}` : ""}
            </p>
          ) : null}
        </div>
      </div>
      <p className="t-apoio">Só leitura. A conversão conta os interessados que entraram no mês; a previsão soma cada proposta aberta vezes a chance da etapa.</p>
    </>
  );
}
