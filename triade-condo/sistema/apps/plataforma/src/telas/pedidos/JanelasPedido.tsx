"use client";
// Janelas das ações sobre um pedido (design "Telas do passo 4", telas 5 a 9): retorno ao
// morador e nota interna, próximo retorno, previsão, pendência, concluir, revisar, reabrir,
// cancelar, repassar, mudar etapa e editar. Toda ação leva a versão lida (AT-24); no
// conflito, a janela avisa e o que a pessoa escreveu fica.

import { useState, type FormEvent } from "react";
import { REVISOES_CONCLUSAO } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, camposComErro, chamarApi, Dialogo, textoDoErro, type ErroApi, type Resposta } from "@triade/ui";
import { Janela, type Campo, type Valores } from "../Janela.tsx";
import type { ConclusaoPedido, OpcoesPedidos, PedidoDetalhe, PendenciaPedido } from "../tipos.ts";
import { Escolha } from "../moradores/comum.tsx";
import { deDataHoraLocal, diaHora, nomeDe, opcoesMeio, opcoesPendencia, paraDataHoraLocal } from "./comum.tsx";

export type AcaoPedido =
  | "retorno" | "proximo" | "previsao" | "pendencia" | "concluir" | "revisar" | "reabrir" | "cancelar" | "repassar" | "etapa" | "editar";

interface PropsJanelas {
  acao: AcaoPedido | null;
  resolver: PendenciaPedido | null;
  d: PedidoDetalhe;
  opcoes: OpcoesPedidos;
  aoFechar: () => void;
  salvo: (texto: string) => void;
  recarregar: () => void;
}

export function JanelasPedido({ acao, resolver, d, opcoes, aoFechar, salvo, recarregar }: PropsJanelas) {
  const p = d.pedido;
  const base = `/v1/condominio/pedidos/${p.id}`;
  const enviar = async (caminho: string, corpo: Record<string, unknown>, texto: string, metodo: "POST" | "PUT" = "POST"): Promise<Resposta<unknown>> => {
    const r = await chamarApi(`${base}${caminho}`, { metodo, corpo: { versao: p.versao, ...corpo } });
    if (r.ok) salvo(texto);
    return r;
  };
  const daCategoria = (e: { categoriaId: string | null }) => !e.categoriaId || e.categoriaId === p.categoria.id;
  const etapasAndamento = opcoes.etapas.filter((e) => e.ativa && e.situacao !== "ENCERRADO" && daCategoria(e));
  const etapasFim = opcoes.etapas.filter((e) => e.ativa && e.situacao === "ENCERRADO" && daCategoria(e));
  const disponiveis = opcoes.responsaveis.filter((r) => r.disponivel);
  const nomeResp = (r: { nome: string; eu: boolean }) => (r.eu ? "Eu" : r.nome);
  const texto = (v: Valores, k: string) => String(v[k] ?? "").trim();

  const janela = (aberto: boolean, titulo: string, campos: Campo[], iniciais: Valores, textoBotao: string, aoSalvar: (v: Valores) => Promise<Resposta<unknown>>, explicacao?: string) => (
    <Janela aberto={aberto} titulo={titulo} campos={campos} iniciais={iniciais} textoBotao={textoBotao} aoFechar={aoFechar} recarregar={recarregar}
      aoSalvar={aoSalvar} explicacao={explicacao} />
  );

  return (
    <>
      <Dialogo aberto={acao === "retorno"} titulo={`${d.pode.responder && (p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO") ? "Dar retorno ao morador" : "Nota interna"} · ${p.protocolo}`} aoFechar={aoFechar}>
        {acao === "retorno" ? <DarRetorno d={d} opcoes={opcoes} aoFechar={aoFechar} enviar={enviar} recarregar={recarregar} /> : null}
      </Dialogo>
      <Dialogo aberto={acao === "revisar"} titulo={`Revisar conclusão · ${p.protocolo}`} aoFechar={aoFechar}>
        {acao === "revisar" ? <Revisar conclusao={d.conclusoes.find((c) => c.revisao === "AGUARDANDO") ?? null} aoFechar={aoFechar} enviar={enviar} recarregar={recarregar} /> : null}
      </Dialogo>

      {janela(acao === "proximo", "Próximo retorno ao morador", [
        { id: "quando", rotulo: "Quando", tipo: "datahora", obrigatorio: true, erro: "Escolha um horário entre agora e 180 dias.", ajuda: "Horário de Brasília." },
        { id: "motivo", rotulo: "Por que mudou", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." },
      ], { quando: p.proximoRetorno ? paraDataHoraLocal(p.proximoRetorno) : "", motivo: "" }, "Salvar próximo retorno",
      (v) => enviar("/proximo-retorno", { quando: deDataHoraLocal(texto(v, "quando")) ?? "", motivo: texto(v, "motivo") }, "Próximo retorno alterado.", "PUT"),
      "A mudança fica no histórico do pedido, com quem fez e quando.")}

      {janela(acao === "previsao", "Previsão de solução", [
        { id: "data", rotulo: "Nova previsão", tipo: "data", erro: "A previsão fica entre hoje e dois anos.", ajuda: "Deixe em branco para ficar sem previsão." },
        { id: "motivo", rotulo: p.previsao ? "Por que mudou" : "Observação", tipo: "area", obrigatorio: !!p.previsao, max: 500,
          erro: "Explique o motivo (3 a 500 caracteres).", ajuda: p.previsao ? undefined : "Opcional na primeira previsão." },
      ], { data: p.previsao ?? "", motivo: "" }, "Salvar previsão",
      (v) => enviar("/previsao", { data: texto(v, "data") || null, motivo: texto(v, "motivo") || null }, "Previsão de solução salva.", "PUT"),
      "Só quando for conhecida. Sem previsão é melhor que prazo inventado.")}

      {janela(acao === "pendencia", `Nova pendência · ${p.protocolo}`, [
        { id: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: opcoesPendencia },
        { id: "motivo", rotulo: "Motivo", tipo: "area", obrigatorio: true, max: 300, erro: "Motivo de 3 a 300 caracteres." },
        { id: "responsavelId", rotulo: "Quem cuida", tipo: "selecao", opcoes: opcoes.pessoas.map((x) => ({ valor: x.vinculoId, texto: nomeResp(x) })),
          erro: "Escolha o síndico ou uma pessoa autorizada." },
      ], { tipo: "FORNECEDOR", motivo: "", responsavelId: opcoes.meuVinculo ?? opcoes.pessoas[0]?.vinculoId ?? "" }, "Abrir pendência",
      (v) => enviar("/pendencias", { tipo: v.tipo, motivo: texto(v, "motivo"), responsavelId: v.responsavelId }, "Pendência aberta."),
      "Enquanto houver pendência aberta, o pedido não pode ser concluído.")}

      {janela(resolver !== null, resolver ? `Resolver: ${nomeDe(Object.fromEntries(opcoesPendencia.map((o) => [o.valor, o.texto])), resolver.tipo)}` : "Resolver pendência", [
        { id: "resolucao", rotulo: "Como foi resolvida", tipo: "area", obrigatorio: true, max: 300, erro: "De 2 a 300 caracteres." },
      ], { resolucao: "" }, "Resolver pendência",
      (v) => enviar(`/pendencias/${resolver?.id}/resolver`, { resolucao: texto(v, "resolucao") }, "Pendência resolvida."), resolver?.motivo)}

      {janela(acao === "concluir", `Concluir · ${p.protocolo}`, [
        { id: "etapaId", rotulo: "Como termina", tipo: "selecao", opcoes: etapasFim.map((e) => ({ valor: e.id, texto: e.nome })) },
        { id: "explicacao", rotulo: "Explicação ao morador", tipo: "area", obrigatorio: true, max: 2000, erro: "Explique o que foi feito (10 a 2000 caracteres)." },
        { id: "evidencia", rotulo: "Evidência (opcional)", tipo: "texto", max: 300, ajuda: "Referência da nota, do laudo ou onde está a foto. Foto não substitui laudo." },
      ], { etapaId: etapasFim[0]?.id ?? "", explicacao: "", evidencia: "" },
      d.regras.revisao && !d.pode.revisar ? "Enviar para revisão" : "Concluir pedido",
      (v) => enviar("/concluir", { etapaId: v.etapaId, explicacao: texto(v, "explicacao"), evidencia: texto(v, "evidencia") || null },
        d.regras.revisao && !d.pode.revisar ? "Conclusão enviada para a revisão do síndico." : "Pedido concluído."),
      d.regras.revisao && !d.pode.revisar ? "Neste condomínio a conclusão passa pela revisão do síndico antes de encerrar." : undefined)}

      {janela(acao === "reabrir", `Reabrir · ${p.protocolo}`, [
        { id: "motivo", rotulo: "Por que reabrir", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." },
        { id: "responsavelId", rotulo: "Quem assume", tipo: "selecao",
          opcoes: [{ valor: "", texto: "O responsável de antes (ou o padrão da fila)" }, ...disponiveis.map((r) => ({ valor: r.vinculoId, texto: nomeResp(r) }))] },
      ], { motivo: "", responsavelId: "" }, "Reabrir pedido",
      (v) => enviar("/reabrir", { motivo: texto(v, "motivo"), responsavelId: v.responsavelId || null }, "Pedido reaberto."),
      "A conclusão anterior fica guardada. O pedido ganha responsável e próximo retorno.")}

      {janela(acao === "cancelar", `Cancelar · ${p.protocolo}`, [
        { id: "motivo", rotulo: "Por que cancelar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." },
      ], { motivo: "" }, "Cancelar pedido",
      (v) => enviar("/cancelar", { motivo: texto(v, "motivo") }, "Pedido cancelado."),
      "As pendências abertas fecham junto. O pedido continua na fila, em Cancelados, e no histórico.")}

      {janela(acao === "repassar", `Repassar · ${p.protocolo}`, [
        { id: "responsavelId", rotulo: "Para quem", tipo: "selecao",
          opcoes: disponiveis.filter((r) => r.vinculoId !== p.responsavel?.vinculoId).map((r) => ({ valor: r.vinculoId, texto: nomeResp(r) })),
          erro: "Escolha alguém disponível da lista de quem atende." },
        { id: "motivo", rotulo: "Motivo (opcional)", tipo: "texto", max: 300, ajuda: "Ex.: fim do meu turno." },
      ], { responsavelId: disponiveis.find((r) => r.vinculoId !== p.responsavel?.vinculoId)?.vinculoId ?? "", motivo: "" }, "Repassar",
      (v) => enviar("/responsavel", { responsavelId: v.responsavelId, motivo: texto(v, "motivo") || null }, "Pedido repassado. Quem recebe confirma o aceite."),
      "Quem recebe precisa confirmar que aceitou.")}

      {janela(acao === "etapa", `Mudar etapa · ${p.protocolo}`, [
        { id: "etapaId", rotulo: "Etapa", tipo: "selecao", opcoes: etapasAndamento.map((e) => ({ valor: e.id, texto: `${e.nome}${e.pausaPrazo ? " (pausa o prazo)" : ""}` })) },
      ], { etapaId: p.etapa.id }, "Mudar etapa",
      (v) => enviar("/etapa", { etapaId: v.etapaId }, "Etapa alterada."), "Para encerrar, use Concluir.")}

      {janela(acao === "editar", `Editar · ${p.protocolo}`, [
        { id: "categoriaId", rotulo: "Categoria", tipo: "selecao", opcoes: opcoes.categorias.filter((c) => c.ativa || c.id === p.categoria.id).map((c) => ({ valor: c.id, texto: c.nome })) },
        { id: "prioridadeId", rotulo: "Prioridade", tipo: "selecao", opcoes: opcoes.prioridades.filter((x) => x.ativa || x.id === p.prioridade.id).map((x) => ({ valor: x.id, texto: x.nome })) },
        { id: "local", rotulo: p.unidade ? "Onde, na unidade (opcional)" : "Local", tipo: "texto", max: 120, erro: "Informe a unidade ou o local (2 a 120 caracteres)." },
        { id: "privado", rotulo: "Pedido privado", tipo: "caixa", ajuda: "Só o síndico, quem registrou e o responsável veem." },
      ], { categoriaId: p.categoria.id, prioridadeId: p.prioridade.id, local: p.local ?? "", privado: p.privado }, "Salvar",
      (v) => enviar("", { categoriaId: v.categoriaId, prioridadeId: v.prioridadeId, local: texto(v, "local") || null, privado: v.privado === true }, "Pedido alterado.", "PUT"),
      "O relato e quem pediu não mudam: o que vier a mais vira nota.")}
    </>
  );
}

type Enviar = (caminho: string, corpo: Record<string, unknown>, texto: string, metodo?: "POST" | "PUT") => Promise<Resposta<unknown>>;

/** Retorno ao morador (AT-06) ou nota interna, com os modelos de resposta (AT-25). */
function DarRetorno({ d, opcoes, aoFechar, enviar, recarregar }: { d: PedidoDetalhe; opcoes: OpcoesPedidos; aoFechar: () => void; enviar: Enviar; recarregar: () => void }) {
  const podeRetorno = d.pode.responder && (d.pedido.estado === "ABERTO" || d.pedido.estado === "EM_ANDAMENTO");
  const [tipo, setTipo] = useState<"RETORNO" | "NOTA">(podeRetorno ? "RETORNO" : "NOTA");
  const [meio, setMeio] = useState("TELEFONE");
  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const modelos = opcoes.modelos.filter((m) => !m.categoriaId || m.categoriaId === d.pedido.categoria.id);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = tipo === "RETORNO"
      ? await enviar("/retornos", { meio, texto: texto.trim() }, "Retorno registrado. O próximo retorno foi recalculado; a previsão não mudou.")
      : await enviar("/notas", { texto: texto.trim() }, "Nota interna registrada.");
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  }

  const comErro = camposComErro(erro);
  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      {podeRetorno ? (
        <Escolha rotulo="O que registrar" atual={tipo} aoMudar={setTipo}
          opcoes={[{ valor: "RETORNO", texto: "Retorno ao morador" }, { valor: "NOTA", texto: "Nota interna" }]} />
      ) : null}
      {tipo === "RETORNO" ? (
        <>
          <CampoSelecao id="r-meio" rotulo="Como foi dado" value={meio} onChange={(e) => setMeio(e.target.value)} opcoes={opcoesMeio} />
          {modelos.length ? (
            <CampoSelecao id="r-modelo" rotulo="Usar um modelo" opcional value={modelo}
              onChange={(e) => { setModelo(e.target.value); const m = modelos.find((x) => x.id === e.target.value); if (m) setTexto(m.texto); }}
              opcoes={[{ valor: "", texto: "Sem modelo" }, ...modelos.map((m) => ({ valor: m.id, texto: m.titulo }))]} />
          ) : null}
        </>
      ) : null}
      <CampoAreaTexto id="r-texto" rotulo={tipo === "RETORNO" ? "O que foi dito" : "Nota"} required maxLength={2000} rows={4} value={texto}
        onChange={(e) => setTexto(e.target.value)} erro={comErro.includes("texto") ? "De 3 a 2000 caracteres." : null}
        ajuda={tipo === "NOTA" ? "Só a gestão lê. Não conta como retorno ao morador (cobrar o fornecedor, por exemplo)." : undefined} />
      {tipo === "RETORNO" ? <p className="text-sm text-tinta-suave">Ao salvar, o próximo retorno é recalculado pelo prazo. A previsão de solução não muda.</p> : null}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : tipo === "RETORNO" ? "Registrar retorno" : "Salvar nota"}</Botao>
      </div>
    </form>
  );
}

/** Revisão da conclusão pelo síndico (AT-14): aprovar encerra; devolver pede o que falta. */
function Revisar({ conclusao, aoFechar, enviar, recarregar }: { conclusao: ConclusaoPedido | null; aoFechar: () => void; enviar: Enviar; recarregar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function decidir(aprovar: boolean) {
    setErro(null);
    setEnviando(true);
    const r = await enviar("/revisar", { aprovar, motivo: motivo.trim() || null },
      aprovar ? "Conclusão aprovada. Pedido encerrado." : "Pedido devolvido para a etapa em que estava.");
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  }

  const comErro = camposComErro(erro);
  return (
    <div className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      {conclusao ? (
        <div className="grid gap-1 rounded-lg border border-linha bg-superficie-2 p-3 text-sm">
          <span className="text-xs text-tinta-suave">Concluído por {conclusao.concluidaPor} em {diaHora(conclusao.concluidaEm)} · {conclusao.etapa} · {REVISOES_CONCLUSAO[conclusao.revisao]}</span>
          <span>{conclusao.explicacao}</span>
          {conclusao.evidencia ? <span className="text-xs text-tinta-suave">Evidência: {conclusao.evidencia}</span> : null}
        </div>
      ) : null}
      <CampoAreaTexto id="v-motivo" rotulo="Se for devolver, o que falta" maxLength={500} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
        erro={comErro.includes("motivo") ? "Explique o que falta (3 a 500 caracteres)." : null} />
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
        <Botao variante="secundario" disabled={enviando} onClick={() => void decidir(false)}>Devolver</Botao>
        <Botao disabled={enviando} onClick={() => void decidir(true)}>Aprovar e encerrar</Botao>
      </div>
    </div>
  );
}
