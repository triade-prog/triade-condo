"use client";
// A ficha da despesa (R5, FC-10; quadro 420): o valor, os votos ou quem aprova, os anexos e o
// histórico; responder, votar, reenviar o link e retirar enquanto espera; depois de aprovada, o
// Paga fora do sistema com a data e o comprovante, e o Publicar como comunicado. O sistema não
// paga, não recebe e não guarda dado do banco.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { descreverEventoAprovacao, mostrarCusto, textoFaltam } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { DespesaDetalhe, LinkMandado, Recado, VotoConselho } from "../tipos.ts";
import { dia, diaHora } from "../pedidos/comum.tsx";
import { diaDoPrazo } from "./comum.tsx";
import { JanelaAnexar, ListaAnexos } from "./anexos.tsx";
import { linhaDespesa, situacaoDespesa } from "./Despesas.tsx";
import { BarraQuorum, LinksMandados, ListaVotos, Placar, reenviarLink, VotarNoPainel } from "./votacao.tsx";

/** "3 aprovam · 1 recusa", da contagem do conselho. */
export function textoVotosDespesa(c: Record<string, number> | undefined): string {
  const a = c?.APROVAR ?? 0;
  const r = c?.RECUSAR ?? 0;
  if (!a && !r) return "Nenhum voto ainda";
  return [a ? `${a} ${a === 1 ? "aprova" : "aprovam"}` : null, r ? `${r} ${r === 1 ? "recusa" : "recusam"}` : null].filter(Boolean).join(" · ");
}

const LIGACAO = { PEDIDO: "ao pedido", MANUTENCAO: "à manutenção", DECISAO: "à decisão" } as const;
const linkDaLigacao = (l: NonNullable<DespesaDetalhe["ligacao"]>) =>
  l.tipo === "PEDIDO" ? `/pedidos/pedido?id=${l.id}` : l.tipo === "MANUTENCAO" ? `/manutencao/manutencao?id=${l.id}` : "/decisoes";

export function FichaDespesa() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const { atualizar, pode } = usePlataforma();
  const carga = useCarregar<DespesaDetalhe>(id ? `/v1/condominio/despesas/${id}` : null);
  const [recado, setRecado] = useState<Recado>(null);
  const [votar, setVotar] = useState(false);
  const [responder, setResponder] = useState(false);
  const [retirar, setRetirar] = useState(false);
  const [anexar, setAnexar] = useState<"DOCUMENTO" | "COMPROVANTE" | null>(null);
  const [links, setLinks] = useState<LinkMandado[] | null>(null);

  const voltar = <Link href="/decisoes?aba=despesas" className="inline-flex items-center gap-1.5 t-apoio font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Despesas</Link>;
  if (!id) return <div className="grid gap-4">{voltar}<Vazio titulo="Despesa não encontrada">Abra a despesa pela lista de Decisões › Despesas.</Vazio></div>;
  if (carga.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Carregando a despesa…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const d = carga.dados;
  const s = situacaoDespesa(d);
  const v = d.conselho;
  const depois = (t: string, tom: "ok" | "atencao" = "ok") => { setRecado({ tom, texto: t }); carga.recarregar(); atualizar(); };
  const aguardando = d.estado === "AGUARDANDO";
  const aprovada = d.estado === "APROVADA" || d.estado === "PAGA";

  async function reenviar(x: VotoConselho) {
    const r = await reenviarLink("despesas", d.id, x.membroId);
    if (!r.ok) return depois(`Não deu para reenviar o link: ${textoDoErro(r.erro)}`, "atencao");
    if (r.dados.envio === "COPIAR") setLinks([r.dados]);
    depois(r.dados.envio === "COPIAR" ? `Link novo para ${r.dados.nome}. O anterior parou de valer. Copie e mande pelo WhatsApp.`
      : `Link novo mandado pelo e-mail para ${r.dados.nome}. O anterior parou de valer.`);
  }

  const quemAprova = v ? textoVotosDespesa(v.contagem) : d.decisor ? (d.decisor.eu ? "Você" : d.decisor.nome) : "—";
  const historico = (d.historico ?? []).map((h) => ({ ...h, texto: descreverEventoAprovacao(h.acao, h.dados) })).filter((h) => h.texto);

  return (
    <div className="grid max-w-[1200px] gap-4">
      {voltar}
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="grid gap-5 rounded-[18px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-4">
          <div className="flex items-start gap-3">
            <span className="ladrilho" data-tom={s.tom === "ok" ? "ok" : "violeta"} aria-hidden="true"><Icone nome="dinheiro" /></span>
            <div className="grid min-w-0 flex-1 gap-1">
              <h1 className="t-titulo-ficha">{d.descricao}</h1>
              <p className="t-apoio">
                {linhaDespesa(d)}
                {d.ligacao ? <> · ligada {LIGACAO[d.ligacao.tipo]} <Link href={linkDaLigacao(d.ligacao)} className="font-medium text-violeta-600 hover:underline">{d.ligacao.rotulo}</Link></> : null}
              </p>
            </div>
            <span className="flex flex-wrap gap-1.5">
              <Selo tom={s.tom}>{s.texto}</Selo>
              {d.pagamento ? <Selo tom="neutro">Paga fora</Selo> : null}
            </span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[["Valor", <span key="v" className="t-codigo">{mostrarCusto(d.valor)}</span>], [v ? "Votos" : "Quem aprova", quemAprova],
              ["Pagamento", d.pagamento ? `Pago fora em ${diaDoPrazo(d.pagamento.pagaEm)}` : aprovada ? "Ainda não marcado" : "Depois de aprovada"]].map(([a, b]) => (
              <div key={String(a)} className="grid gap-0.5 rounded-[14px] border border-linha bg-fundo px-3.5 py-3">
                <dt className="t-apoio">{a}</dt>
                <dd className="t-titulo-cartao">{b}</dd>
              </div>
            ))}
          </dl>
          {d.passaAlcada && d.alcada && aguardando ? <Aviso tom="atencao">Passa da alçada do conselho ({mostrarCusto(d.alcada)}), escrita nas Regras. É só um aviso.</Aviso> : null}
          {d.substituto && aguardando ? <p className="t-apoio">Síndico ausente até {diaDoPrazo(d.substituto.ate)}: {d.substituto.nome}, o subsíndico, responde no lugar.</p> : null}
          {d.voltouAoSindicoEm && aguardando ? <Aviso tom="atencao" titulo="Voltou para o síndico">O conselho não chegou ao quórum até {diaDoPrazo(d.prazo)}. Os votos ficam abaixo.</Aviso> : null}
          {v ? (
            <section className="grid gap-2.5">
              <h2 className="t-rotulo">Quórum</h2>
              <Placar contagem={v.contagem} necessarios={v.necessarios} />
              <BarraQuorum votos={v.contagem?.APROVAR ?? 0} titulares={v.titulares} necessarios={v.necessarios} />
              {aguardando && !d.voltouAoSindicoEm && v.faltam !== undefined ? <p className="t-apoio">{[`${v.votaram} de ${v.titulares} titulares votaram.`, textoFaltam(v.faltam) ? `${textoFaltam(v.faltam)}.` : null, `O prazo para votar vai até ${diaDoPrazo(d.prazo)}.`].filter(Boolean).join(" ")}</p> : null}
              {v.votos.length ? <ListaVotos v={v} reenviar={aguardando && d.pode.reenviar ? (x) => void reenviar(x) : undefined} /> : null}
            </section>
          ) : null}
          {d.justificativa && !aguardando ? <p className="t-texto">{d.estado === "RECUSADA" ? "Recusada" : "Aprovada"}{d.respondidaPor ? ` por ${d.respondidaPor}` : ""}{d.respondidaEm ? ` em ${diaHora(d.respondidaEm)}` : ""}: “{d.justificativa}”</p> : null}
          {d.retiradaMotivo ? <p className="t-texto">Retirada: {d.retiradaMotivo}</p> : null}
          <ListaAnexos anexos={d.anexos} anexar={d.pode.anexar ? () => setAnexar("DOCUMENTO") : undefined} />
          <section className="grid">
            <h2 className="t-rotulo pb-1">Histórico</h2>
            {historico.length ? (
              <ul className="grid">
                {historico.map((h, i) => (
                  <li key={i} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-linha py-2 max-md:grid-cols-1 max-md:gap-0.5">
                    <span className="t-codigo text-tinta-suave">{diaHora(h.em)}</span>
                    <span className="t-texto">{h.quem ? `${h.quem}: ` : ""}{h.texto}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Pedida{d.pedidaPor ? ` por ${d.pedidaPor}` : ""} em {dia(d.pedidaEm)}.</p>}
          </section>
        </section>

        <aside className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
          {aguardando ? (
            <>
              <h2 className="t-titulo-cartao">{v && !d.voltouAoSindicoEm ? `Votar até ${diaDoPrazo(d.prazo)}` : `Responder até ${diaDoPrazo(d.prazo)}`}</h2>
              <p className="t-apoio">Aprovar não paga nada: depois de aprovada, quem gerencia marca Paga fora do sistema.</p>
              {d.pode.votar ? <Botao onClick={() => setVotar(true)}><Icone nome="check" />{v?.eu?.escolha ? "Trocar meu voto" : "Votar"}</Botao> : null}
              {d.pode.responder ? <Botao onClick={() => setResponder(true)}><Icone nome="check" />Aprovar ou recusar</Botao> : null}
              {d.pode.retirar ? <Botao variante="discreto" onClick={() => setRetirar(true)}><Icone nome="fechar" />Retirar o pedido</Botao> : null}
              {!d.pode.votar && !d.pode.responder ? <p className="t-texto">{v ? "Esperando os votos do conselho." : `Esperando ${d.decisor?.nome ?? "quem aprova"}.`}</p> : null}
            </>
          ) : aprovada ? (
            <DepoisDeAprovada d={d} depois={depois} anexar={() => setAnexar("COMPROVANTE")} />
          ) : (
            <>
              <h2 className="t-titulo-cartao">{d.estado === "RECUSADA" ? "Despesa recusada" : "Despesa retirada"}</h2>
              <p className="t-apoio">{d.estado === "RECUSADA" ? "Para pedir de novo, registre uma nova despesa com o que faltou." : "Nada mais acontece com ela; fica no histórico."}</p>
            </>
          )}
          {d.comunicado && pode("comunicados.escrever") ? (
            <>
              <p className="t-apoio">A despesa decidida vai para a Linha do tempo e para o relatório do mês, em Decisões do mês. Os moradores só veem se você publicar.</p>
              <Link href={`/comunicados/escrever?titulo=${encodeURIComponent(d.comunicado.titulo)}&texto=${encodeURIComponent(d.comunicado.texto)}`} className={classeBotao("secundario")}>
                <Icone nome="megafone" />Publicar como comunicado
              </Link>
            </>
          ) : null}
        </aside>
      </div>

      <VotarNoPainel alvo={votar ? { tipo: "despesas", id: d.id, titulo: d.descricao, prazo: d.prazo, meu: v?.eu?.escolha, minhaJustificativa: v?.eu?.justificativa } : null}
        aoFechar={() => setVotar(false)} votado={(t) => { setVotar(false); depois(t); }} />
      <ResponderDespesa aberto={responder} d={d} aoFechar={() => setResponder(false)} salvo={(t) => { setResponder(false); depois(t); }} />
      <Janela aberto={retirar} titulo="Retirar o pedido de aprovação" aoFechar={() => setRetirar(false)} recarregar={carga.recarregar}
        campos={[{ id: "motivo", rotulo: "Por que retirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Retirar"
        explicacao={v ? "A votação do conselho para e os links param de valer. Tudo fica no histórico." : "Quem aprova deixa de ver esta despesa. Tudo fica no histórico."}
        aoSalvar={async (x) => {
          const r = await chamarApi(`/v1/condominio/despesas/${d.id}/retirar`, { corpo: { versao: d.versao, motivo: String(x.motivo ?? "").trim() } });
          if (r.ok) { setRetirar(false); depois("Pedido de aprovação retirado."); }
          return r;
        }} />
      <JanelaAnexar item={{ tipo: "despesas", id: d.id }} parte={anexar ?? "DOCUMENTO"} aberto={anexar !== null}
        titulo={anexar === "COMPROVANTE" ? "Anexar o comprovante" : "Anexar à despesa"} aoFechar={() => setAnexar(null)}
        enviado={(t) => { setAnexar(null); depois(t || "Nenhum arquivo enviado."); }} />
      <LinksMandados links={links} aoFechar={() => setLinks(null)} />
    </div>
  );
}

/** Depois de aprovada (quadro 420): marcar ou desfazer o Paga fora do sistema. */
function DepoisDeAprovada({ d, depois, anexar }: { d: DespesaDetalhe; depois: (t: string, tom?: "ok" | "atencao") => void; anexar: () => void }) {
  const comprovantes = d.anexos.filter((a) => a.parte === "COMPROVANTE" && (!a.situacao || a.situacao === "LIBERADO"));
  const hoje = new Date().toISOString().slice(0, 10);
  const [pagaEm, setPagaEm] = useState(d.pagamento?.pagaEm ?? hoje);
  const [comprovante, setComprovante] = useState(d.pagamento?.comprovanteId ?? comprovantes.at(-1)?.id ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function marcar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/despesas/${d.id}/pagar`, { corpo: { versao: d.versao, pagaEm, comprovanteId: comprovante || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    depois(`Marcada como paga fora do sistema em ${diaDoPrazo(pagaEm)}.`);
  }
  async function desfazer() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/despesas/${d.id}/desfazer-pagamento`, { corpo: { versao: d.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    depois("Registro do pagamento desfeito. A despesa continua aprovada.");
  }

  const nomeDo = (idArq?: string) => d.anexos.find((a) => a.id === idArq)?.nome;
  return (
    <>
      <h2 className="t-titulo-cartao">Depois de aprovada</h2>
      <p className="t-apoio">Marcar o pagamento é só para o registro: o sistema não paga, não recebe e não guarda dados do banco.</p>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {d.pagamento ? (
        <>
          <p className="t-texto">Paga fora do sistema em {diaDoPrazo(d.pagamento.pagaEm)}{d.pagamento.registradaPor ? `, marcada por ${d.pagamento.registradaPor}` : ""}.</p>
          {d.pagamento.comprovanteId ? <p className="t-apoio">Comprovante: {nomeDo(d.pagamento.comprovanteId) ?? "anexado"}</p> : <p className="t-apoio">Sem comprovante anexado.</p>}
          {d.pode.desfazerPagamento ? <Botao variante="discreto" disabled={enviando} onClick={() => void desfazer()}><Icone nome="esq" />Desfazer Paga fora</Botao> : null}
        </>
      ) : d.pode.pagar ? (
        <form onSubmit={marcar} noValidate className="grid gap-3">
          <CampoTexto id="desp-paga-em" rotulo="Pago em" type="date" required max={hoje} value={pagaEm} onChange={(e) => setPagaEm(e.target.value)}
            erro={comErro.includes("pagaEm") ? "Confira a data do pagamento." : null} />
          {comprovantes.length ? (
            <CampoSelecao id="desp-comprovante" rotulo="Comprovante" opcional value={comprovante} onChange={(e) => setComprovante(e.target.value)}
              opcoes={[{ valor: "", texto: "Sem comprovante" }, ...comprovantes.map((a) => ({ valor: a.id, texto: a.nome }))]}
              erro={comErro.includes("comprovanteId") ? "Escolha um comprovante liberado desta despesa." : null} />
          ) : <p className="t-apoio">Nenhum comprovante anexado. É opcional.</p>}
          {d.pode.anexar ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={anexar}><Icone nome="clipe" />Anexar o comprovante</Botao> : null}
          <Botao type="submit" disabled={enviando}><Icone nome="check" />Marcar Paga fora do sistema</Botao>
        </form>
      ) : <p className="t-texto">Quem gerencia as despesas marca o pagamento feito fora do sistema.</p>}
    </>
  );
}

/** Aprovar ou recusar a despesa pedida a uma pessoa, ou a que voltou para o síndico. */
function ResponderDespesa({ aberto, d, aoFechar, salvo }: { aberto: boolean; d: DespesaDetalhe; aoFechar: () => void; salvo: (t: string) => void }) {
  return (
    <Dialogo aberto={aberto} titulo="Aprovar a despesa" aoFechar={aoFechar} fechar media apoio={`${d.descricao} · ${mostrarCusto(d.valor)}`}>
      {aberto ? <FormResponder d={d} aoFechar={aoFechar} salvo={salvo} /> : null}
    </Dialogo>
  );
}

function FormResponder({ d, aoFechar, salvo }: { d: DespesaDetalhe; aoFechar: () => void; salvo: (t: string) => void }) {
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function responder(aprovar: boolean, ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/despesas/${d.id}/responder`, { corpo: { versao: d.versao, aprovar, justificativa: justificativa.trim() } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(aprovar ? "Despesa aprovada. Quem pediu foi avisado no sino. O pagamento continua fora do sistema." : "Despesa recusada. Quem pediu foi avisado no sino.");
  }
  return (
    <form onSubmit={(ev) => void responder(true, ev)} noValidate className="grid gap-4">
      {erro && !comErro.includes("justificativa") ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoAreaTexto id={`desp-just-${d.id}`} rotulo="Justificativa" required maxLength={1000} rows={3} value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)} erro={comErro.includes("justificativa") ? "Explique a resposta (3 a 1000 caracteres)." : null} />
      <p className="flex items-start gap-2 t-apoio"><Icone nome="info" className="mt-px h-4 w-4 shrink-0" />A resposta fica no histórico da despesa, com seu nome. Aprovar não paga nada.</p>
      <div className="flex flex-wrap items-center justify-between gap-2 max-md:flex-col-reverse max-md:items-stretch">
        <Botao variante="discreto" disabled={enviando} onClick={() => void responder(false)}><Icone nome="fechar" />Recusar</Botao>
        <span className="flex flex-wrap gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />Aprovar</Botao>
        </span>
      </div>
    </form>
  );
}
