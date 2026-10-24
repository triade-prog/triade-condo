"use client";
// Ficha do interessado (quadros 323 e 324, aprovados em 24/10/2026): a barra das etapas, as
// mensagens prontas da etapa, as conversas, o próximo passo, a cadência, o prédio, as objeções e os
// concorrentes e o contato com a base legal. ?etapa=X chega do quadro quando falta algo para a
// etapa; ?juntado=1 chega do Novo interessado quando o contato já existia.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ETAPAS_ABERTAS, formatarWhatsapp, linkWhatsappComercial, mostrarDataSemHora, MOTIVOS_PERDA, PAPEIS_CONTATO, preencherMensagem, type EtapaComercial } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Cartao, Dado, diaHora, LinhaDoTempo, MenuAcoes, plural, Voltar, type ItemMenu, type PassoTempo } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { iconeCanal, nomeCanal, nomeEtapa, nomeFaixa, nomeOrigem, quandoCurto, ROTAS_COMERCIAL, SeloEtapa, SelosAtencao, textoTarefa, TOM_SITUACAO } from "./comum.tsx";
import { JanelaConfirmar, JanelaConversa, JanelaFicha, JanelaPerdido, JanelaProximoPasso } from "./janelas.tsx";
import type { FichaInteressado as Ficha } from "./tipos.ts";

type Janela =
  | { tipo: "ficha"; marcar?: string[] }
  | { tipo: "perdido" }
  | { tipo: "conversa"; canal?: string; resumo?: string; mensagemId?: string }
  | { tipo: "passo" }
  | { tipo: "naoContatar" }
  | { tipo: "excluir" };

const CANAL_OPTIN: Record<string, string> = { SITE: "pelo site", WHATSAPP: "pelo WhatsApp", LIGACAO: "por ligação", EMAIL: "por e-mail", PRESENCIAL: "em pessoa" };
const data = (d?: string) => (d ? mostrarDataSemHora(d) : undefined);

/** A barra das etapas abertas; a atual em destaque. Ganho e Perdido ficam ao lado. */
function BarraFunil({ f, mudar }: { f: Ficha; mudar: (e: EtapaComercial) => void }) {
  const atual = ETAPAS_ABERTAS.indexOf(f.etapa);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Etapas do funil">
      {ETAPAS_ABERTAS.map((e, n) => {
        const ja = atual >= 0 && n <= atual;
        const texto = `${nomeEtapa(e)}${f.falta?.[e]?.length && n > atual ? " ·" : ""}`;
        return (
          <li key={e}>
            <button type="button" disabled={!f.podeEditar || e === f.etapa || f.anonimizado} onClick={() => mudar(e)} aria-current={e === f.etapa ? "step" : undefined}
              className={`min-h-11 rounded-full border px-3 t-apoio ${e === f.etapa ? "border-violeta-600 bg-violeta-600 font-semibold text-white" : ja ? "border-violeta-300 bg-violeta-50 text-violeta-700" : "border-linha"} enabled:hover:border-violeta-600 disabled:cursor-default`}>
              {texto}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Conversas({ f }: { f: Ficha }) {
  const itens: PassoTempo[] = [
    ...f.conversas.map((c) => ({
      chave: c.id, icone: iconeCanal(c.canal), tom: c.respondeu ? ("ok" as const) : ("violeta" as const), quando: diaHora(c.em),
      quem: c.autor?.nome ?? "Sistema", texto: c.resumo, nota: true,
      selo: c.passo ? { texto: `Cadência · passo ${c.passo}`, tom: "info" as const } : { texto: nomeCanal(c.canal), tom: "neutro" as const },
    })),
    ...f.etapas.filter((e) => e.de).map((e, n) => ({
      chave: `etapa-${n}`, icone: "camadas" as const, tom: "neutro" as const, quando: diaHora(e.em), quem: e.autor?.nome ?? "Sistema",
      texto: `${nomeEtapa(e.de!)} → ${nomeEtapa(e.para)}${e.motivoPerda ? ` (${MOTIVOS_PERDA[e.motivoPerda]})` : ""}`,
    })),
  ];
  // O mais novo em cima, pela data original (o texto curto não ordena entre meses).
  const ordem = new Map<string | number, string>([...f.conversas.map((c) => [c.id, c.em] as const), ...f.etapas.filter((e) => e.de).map((e, n) => [`etapa-${n}`, e.em] as const)]);
  itens.sort((a, b) => (ordem.get(a.chave)! < ordem.get(b.chave)! ? 1 : -1));
  if (!itens.length) return <Vazio titulo="Nenhuma conversa ainda" icone="balao">Registre a primeira conversa depois de falar com a pessoa.</Vazio>;
  return <LinhaDoTempo itens={itens} rotulo="Conversas e mudanças de etapa" />;
}

function Cadencia({ f, agir }: { f: Ficha; agir: (acao: "FEITO" | "PARAR") => void }) {
  const c = f.cadencia;
  if (!c) return <p className="t-apoio">Sem cadência. Ela começa sozinha em Novo pelo site, depois da demonstração e depois da proposta.</p>;
  const ativa = !c.fimEm;
  const FIM: Record<string, string> = { RESPONDEU: "a pessoa respondeu", CONCLUIDA: "todos os passos feitos", PARADA: "parada à mão", ETAPA: "mudou de etapa", NAO_CONTATAR: "não contatar" };
  return (
    <div className="grid gap-3">
      <p className="t-texto font-medium">{c.nome}</p>
      <ol className="grid gap-1.5">
        {c.passos.map((p, n) => (
          <li key={n} className={`flex gap-2 t-apoio ${n < c.feitos ? "text-tinta-suave line-through" : n === c.feitos && ativa ? "font-semibold text-tinta" : ""}`}>
            <span className="t-codigo">{`dia ${p.dia}`}</span><span>{`${nomeCanal(p.canal)}: ${p.texto}`}</span>
          </li>
        ))}
      </ol>
      {ativa ? (
        f.podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => agir("FEITO")}><Icone nome="check" />{`Passo ${c.feitos + 1} feito`}</Botao>
            <Botao variante="discreto" onClick={() => agir("PARAR")}><Icone nome="fechar" />Parar a cadência</Botao>
          </div>
        ) : null
      ) : <p className="t-apoio">{`Terminou ${diaHora(c.fimEm!)}: ${FIM[c.fimMotivo ?? ""] ?? c.fimMotivo}.`}</p>}
    </div>
  );
}

export function FichaInteressado() {
  const { id } = useParams<{ id: string }>();
  const busca = useSearchParams();
  const router = useRouter();
  const carga = useCarregar<Ficha>(ROTAS_COMERCIAL.interessado(id));
  const pedida = busca.get("etapa") as EtapaComercial | null;
  const [janela, setJanela] = useState<Janela | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro" | "atencao"; texto: string } | null>(busca.get("juntado") ? { tom: "atencao", texto: "Este contato já existia: os dados novos foram juntados neste interessado." } : null);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a ficha…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-4">
        <Voltar href="/comercial" texto="Voltar aos interessados" />
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }
  const f = carga.dados;
  const pronto = (texto?: string) => { setJanela(null); if (texto) setAviso({ tom: "ok", texto }); carga.recarregar(); };
  const faltaPedida = pedida && f.etapa !== pedida ? f.falta?.[pedida] : undefined;

  async function mudar(etapa: EtapaComercial) {
    if (etapa === "PERDIDO") return setJanela({ tipo: "perdido" });
    const r = await chamarApi(ROTAS_COMERCIAL.etapa(f.id), { corpo: { versao: f.versao, etapa } });
    if (r.ok) return pronto(`Etapa mudada para ${nomeEtapa(etapa)}.`);
    if (r.erro.detalhes?.motivo === "FALTA_PARA_ETAPA") {
      router.replace(`/comercial/${f.id}?etapa=${etapa}`);
      return setJanela({ tipo: "ficha", marcar: (r.erro.detalhes.campos as string[] | undefined) ?? [] });
    }
    setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
    if (r.erro.codigo === "VERSION_CONFLICT") carga.recarregar();
  }

  async function cadencia(acao: "FEITO" | "PARAR") {
    const r = await chamarApi(ROTAS_COMERCIAL.cadencia(f.id), { corpo: { acao, resumo: null } });
    if (!r.ok) return setAviso({ tom: "erro", texto: textoDoErro(r.erro) });
    pronto(acao === "FEITO" ? "Passo da cadência registrado nas conversas." : "Cadência parada.");
  }

  function mensagem(m: { id: string; texto: string }) {
    const texto = preencherMensagem(m.texto, { nome: f.pessoa, condominio: f.condominio });
    window.open(linkWhatsappComercial(f.whatsapp!, texto), "_blank", "noopener");
    setJanela({ tipo: "conversa", canal: "WHATSAPP", resumo: texto, mensagemId: m.id });
  }

  const mais: ItemMenu[] = f.anonimizado ? [] : [
    ...(f.podeEditar ? [
      { texto: "Editar a ficha", icone: "editar" as const, acao: () => setJanela({ tipo: "ficha" }) },
      ...(ETAPAS_ABERTAS.includes(f.etapa) ? [
        { texto: "Marcar como ganho", icone: "check" as const, acao: () => void mudar("GANHO") },
        { texto: "Marcar como perdido", icone: "fechar" as const, acao: () => setJanela({ tipo: "perdido" }) },
      ] : [{ texto: "Reabrir em Em contato", icone: "dir" as const, acao: () => void mudar("EM_CONTATO") }]),
      ...(!f.naoContatar ? [{ texto: "Não contatar mais", icone: "alerta" as const, acao: () => setJanela({ tipo: "naoContatar" }) }] : []),
    ] : []),
    ...(f.podeExcluir ? [{ texto: "Pedido de exclusão (LGPD)", icone: "alerta" as const, acao: () => setJanela({ tipo: "excluir" }) }] : []),
  ];
  const fechado = !ETAPAS_ABERTAS.includes(f.etapa);

  return (
    <div className="grid gap-5">
      <Voltar href="/comercial" texto="Voltar aos interessados" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <h1 className="t-titulo-tela [overflow-wrap:anywhere]">{f.condominio}</h1>
          <p className="flex flex-wrap items-center gap-2 t-apoio">
            <SeloEtapa etapa={f.etapa} />
            {f.probabilidade !== undefined && !fechado ? <span>{`Chance de fechar: ${f.probabilidade}%`}</span> : null}
            <span>{`Origem: ${nomeOrigem(f)}`}</span>
            <span>{`Responsável: ${f.responsavel?.nome ?? "ninguém"}`}</span>
            <SelosAtencao i={f} />
            {f.naoContatar ? <Selo tom="erro">Não contatar</Selo> : null}
          </p>
        </div>
        {mais.length ? <MenuAcoes rotulo={`Mais ações de ${f.condominio}`} texto="Mais ações" itens={mais} /> : null}
      </header>
      {f.anonimizado ? <Aviso tom="atencao" titulo="Dados apagados">Nome, contato e conversas foram apagados (LGPD). Ficam só os números do funil.</Aviso> : null}
      {aviso ? <Aviso tom={aviso.tom} papel={aviso.tom === "erro" ? "alert" : "status"}>{aviso.texto}</Aviso> : null}
      {faltaPedida?.length ? (
        <Aviso tom="atencao" titulo={`Para ir a ${nomeEtapa(pedida!)}`}>
          {`Falta preencher: ${faltaPedida.map((k) => ({ demonstracaoEm: "a data da demonstração", faixa: "a faixa de unidades", decisor: "quem decide", decisaoEm: "a data da decisão" }[k] ?? k)).join(", ")}. `}
          {f.podeEditar ? <Botao variante="contorno" className="mt-2" onClick={() => setJanela({ tipo: "ficha", marcar: faltaPedida })}><Icone nome="editar" />Preencher agora</Botao> : null}
        </Aviso>
      ) : null}
      {!f.anonimizado ? <BarraFunil f={f} mudar={(e) => void mudar(e)} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {!fechado && !f.anonimizado ? (
            <Cartao id="ficha-1" titulo={`Mensagens prontas · ${nomeEtapa(f.etapa)}`} icone="whats">
              {!f.temWhatsapp ? (
                <p className="t-apoio">{f.naoContatar ? "Este contato pediu para não ser procurado." : !f.whatsapp ? "Sem WhatsApp na ficha." : "Sem o aceite de mensagens pelo WhatsApp os botões ficam desligados. Registre o aceite em Editar a ficha."}</p>
              ) : null}
              {f.mensagens.length ? (
                <ul className="grid gap-2">
                  {f.mensagens.map((m) => (
                    <li key={m.id} className="grid gap-2 rounded-[14px] border border-linha p-3">
                      <span className="font-medium">{m.titulo}</span>
                      <span className="t-apoio whitespace-pre-wrap">{preencherMensagem(m.texto, { nome: f.pessoa, condominio: f.condominio })}</span>
                      {f.podeEditar ? (
                        <Botao variante="contorno" className="justify-self-start" disabled={!f.temWhatsapp} onClick={() => mensagem(m)}><Icone nome="whats" />Abrir no WhatsApp</Botao>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="t-apoio">Nenhuma mensagem pronta para esta etapa. Elas ficam em Modelos.</p>}
              <p className="t-apoio">Abre o WhatsApp com o texto pronto; você aperta enviar. A conversa fica registrada aqui.</p>
            </Cartao>
          ) : null}
          <Cartao id="ficha-2" titulo="Conversas" icone="balao"
            acao={f.podeEditar && !f.anonimizado ? <Botao variante="contorno" onClick={() => setJanela({ tipo: "conversa" })}><Icone nome="mais" />Registrar conversa</Botao> : undefined}>
            <Conversas f={f} />
          </Cartao>
        </div>

        <div className="grid content-start gap-5">
          {!fechado ? (
            <Cartao id="ficha-3" titulo="Próximo passo" icone="calendario"
              acao={f.podeEditar && !f.anonimizado ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "passo" })}><Icone nome="editar" />Mudar</Botao> : undefined}>
              <p className="t-texto" data-tom={TOM_SITUACAO[f.tarefa.situacao]}>{textoTarefa(f)}</p>
              {f.proximoPasso && f.tarefa.tarefa !== "PROXIMO_PASSO" ? <p className="t-apoio">{`Depois: ${f.proximoPasso.texto} · ${quandoCurto(f.proximoPasso.data, f.proximoPasso.hora)}`}</p> : null}
              {f.primeiraRespostaEm ? <p className="t-apoio">{`Primeiro retorno feito em ${diaHora(f.primeiraRespostaEm)}.`}</p> : null}
            </Cartao>
          ) : null}
          {f.perda ? (
            <Cartao id="ficha-4" titulo="Por que não fechou" icone="fechar">
              <Dado icone="alerta" nome="Motivo">{MOTIVOS_PERDA[f.perda.motivo]}</Dado>
              {f.perda.vencedor ? <Dado icone="predio" nome="Quem ganhou">{f.perda.vencedor}</Dado> : null}
              {f.perda.detalhe ? <Dado icone="balao" nome="O que aconteceu">{f.perda.detalhe}</Dado> : null}
              {f.perda.retomarEm ? <Dado icone="calendario" nome="Voltar a falar em">{data(f.perda.retomarEm)}</Dado> : null}
            </Cartao>
          ) : null}
          <Cartao id="ficha-5" titulo="Cadência" icone="relogio"><Cadencia f={f} agir={(a) => void cadencia(a)} /></Cartao>
          <Cartao id="ficha-6" titulo="Prédio" icone="predio"
            acao={f.podeEditar && !f.anonimizado ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "ficha" })}><Icone nome="editar" />Editar</Botao> : undefined}>
            <Dado icone="pessoas" nome="Unidades">{[nomeFaixa(f.faixa), f.unidades ? plural(f.unidades, "unidade", "unidades") : null].filter(Boolean).join(" · ") || "Não informado"}</Dado>
            <Dado icone="pin" nome="Onde">{[f.endereco, f.cidade, f.uf].filter(Boolean).join(" · ") || "Não informado"}</Dado>
            {f.cnpj ? <Dado icone="documento" nome="CNPJ">{f.cnpj}</Dado> : null}
            <Dado icone="predio" nome="Administradora">{f.predio.administradora ? `${f.predio.administradora}${f.predio.appAdministradora ? " (tem app próprio)" : ""}` : "Não informado"}</Dado>
            <Dado icone="lista" nome="Sistema atual">{f.predio.sistemaAtual ?? "Não informado"}{f.predio.fidelidadeAte ? ` · fidelidade até ${data(f.predio.fidelidadeAte)}` : ""}</Dado>
            <Dado icone="pessoa" nome="Quem decide">{f.predio.decisor ?? "Não informado"}</Dado>
            {f.predio.decisaoEm ? <Dado icone="calendario" nome="Conselho ou assembleia">{data(f.predio.decisaoEm)}</Dado> : null}
            {f.predio.assembleiaOrdinaria ? <Dado icone="calendario" nome="Assembleia ordinária">{data(f.predio.assembleiaOrdinaria)}</Dado> : null}
            {f.predio.mandatoAte ? <Dado icone="calendario" nome="Mandato do síndico até">{data(f.predio.mandatoAte)}</Dado> : null}
            {f.predio.demonstracaoEm ? <Dado icone="calendario" nome="Demonstração">{diaHora(f.predio.demonstracaoEm)}</Dado> : null}
            {f.predio.visitaEm ? <Dado icone="predio" nome="Visita">{`${data(f.predio.visitaEm)}${f.predio.visitaNota ? ` · ${f.predio.visitaNota}` : ""}`}</Dado> : null}
            {f.observacao ? <Dado icone="balao" nome="Observação">{f.observacao}</Dado> : null}
          </Cartao>
          <Cartao id="ficha-7" titulo="Objeções e concorrentes" icone="alerta">
            {f.objecoes.length ? (
              <ul className="grid gap-2">
                {f.objecoes.map((o) => {
                  const ob = f.objecoesLista.find((x) => x.codigo === o);
                  return (
                    <li key={o} className="grid gap-1">
                      <span className="font-medium">{ob?.texto ?? o}</span>
                      {ob?.resposta ? <span className="t-apoio">{`Como responder: ${ob.resposta}`}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="t-apoio">Nenhuma objeção registrada.</p>}
            {f.concorrentes.length ? (
              <ul className="grid gap-1 border-t border-linha pt-3">
                {f.concorrentes.map((c) => (
                  <li key={c.nome} className="flex justify-between gap-2 t-texto">
                    <span>{c.nome}</span>
                    <span className="t-codigo">{c.preco ? (c.preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "preço não informado"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nenhum concorrente na disputa.</p>}
          </Cartao>
          {!f.anonimizado ? (
            <Cartao id="ficha-8" titulo="Contato" icone="pessoa">
              <Dado icone="pessoa" nome="Pessoa">{[f.pessoa, f.papel ? PAPEIS_CONTATO[f.papel] : null].filter(Boolean).join(" · ") || "Não informado"}</Dado>
              {f.whatsapp ? (
                <Dado icone="whats" nome="WhatsApp"><a className="font-medium underline" href={`tel:+${f.whatsapp}`}>{formatarWhatsapp(f.whatsapp)}</a></Dado>
              ) : null}
              {f.email ? <Dado icone="email" nome="E-mail"><a className="font-medium underline" href={`mailto:${f.email}`}>{f.email}</a></Dado> : null}
              <Dado icone="escudo" nome="Base legal">
                {`${f.baseLegal.tipo === "CONSENTIMENTO" ? "Consentimento" : "Legítimo interesse"} · ${diaHora(f.baseLegal.em)}`}
                <span className="block t-apoio">{f.baseLegal.texto}</span>
              </Dado>
              <Dado icone="check" nome="Aceite do WhatsApp">
                {f.optin ? `${diaHora(f.optin.em)} · ${CANAL_OPTIN[f.optin.canal] ?? f.optin.canal}` : "Sem aceite"}
                {f.optin ? <span className="block t-apoio">{f.optin.texto}</span> : null}
              </Dado>
              {f.lote ? <Dado icone="documento" nome="Planilha">{`${f.lote.arquivo} · ${f.lote.origem}`}</Dado> : null}
              {f.utm && Object.keys(f.utm).length ? <Dado icone="link" nome="Campanha">{Object.entries(f.utm).map(([k, v]) => `${k}: ${v}`).join(" · ")}</Dado> : null}
              <p className="t-apoio">Sem conversa por 12 meses depois de fechado, nome e contato são apagados sozinhos.</p>
            </Cartao>
          ) : null}
          <p className="t-apoio"><Link href="/comercial/modelos" className="underline">Mensagens, cadências e etapas ficam em Modelos.</Link></p>
        </div>
      </div>

      {janela?.tipo === "ficha" ? <JanelaFicha i={f} marcar={janela.marcar} aoFechar={() => setJanela(null)} feito={() => pronto("Ficha salva.")} /> : null}
      {janela?.tipo === "perdido" ? <JanelaPerdido i={f} aoFechar={() => setJanela(null)} feito={() => pronto("Marcado como perdido.")} /> : null}
      {janela?.tipo === "conversa" ? (
        <JanelaConversa i={f} inicial={janela} aoFechar={() => setJanela(null)} feito={() => pronto("Conversa registrada.")} />
      ) : null}
      {janela?.tipo === "passo" ? <JanelaProximoPasso i={f} equipe={f.equipe} aoFechar={() => setJanela(null)} feito={() => pronto("Próximo passo salvo.")} /> : null}
      {janela?.tipo === "naoContatar" ? (
        <JanelaConfirmar titulo="Não contatar mais" botao="Pôr na lista de não contatar" aoFechar={() => setJanela(null)}
          texto={<>O WhatsApp, o e-mail e o CNPJ deste interessado entram na lista de não contatar. A cadência para e ninguém consegue registrar este contato de novo. Não dá para desfazer.</>}
          aoConfirmar={async (): Promise<ErroApi | null> => {
            const r = await chamarApi(ROTAS_COMERCIAL.naoContatar, { corpo: { whatsapp: f.whatsapp ?? null, email: f.email ?? null, cnpj: f.cnpj ?? null, observacao: `Pedido na ficha de ${f.condominio}` } });
            if (!r.ok) return r.erro;
            pronto("Contato na lista de não contatar.");
            return null;
          }} />
      ) : null}
      {janela?.tipo === "excluir" ? (
        <JanelaConfirmar titulo="Pedido de exclusão (LGPD)" botao="Apagar os dados pessoais" aoFechar={() => setJanela(null)}
          texto={<>Nome, WhatsApp, e-mail e o texto das conversas são apagados agora, e o contato entra na lista de não contatar. Ficam só a etapa, a origem e as datas, para os números do funil. Não dá para desfazer.</>}
          aoConfirmar={async (): Promise<ErroApi | null> => {
            const r = await chamarApi(ROTAS_COMERCIAL.excluir(f.id), { corpo: {} });
            if (!r.ok) return r.erro;
            pronto("Dados pessoais apagados. O pedido fica no histórico.");
            return null;
          }} />
      ) : null}
    </div>
  );
}
