"use client";
// Manutenção aberta (design "Telas da Manutenção", telas 3 e 4; MP-01, MP-02, MP-04, MP-05,
// MP-07, MP-09): próximo retorno separado da previsão, providências com o resultado, a lista da
// vistoria, fotos e documentos, o histórico e, do lado, o pedido e a visita ligados e quem
// executa, com a reserva indicada. Concluir não encerra o pedido ligado.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  descreverEventoManutencao, descreverFrequencia, mostrarDataCurta, mostrarHorario, RESULTADOS_ITEM, SITUACOES_MANUTENCAO, TIPOS_PENDENCIA,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi, type Resposta } from "@triade/ui";
import { Janela, type Campo, type Valores } from "../Janela.tsx";
import { deDataHoraLocal, diaHora, opcoesDe, paraDataHoraLocal } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ItemVistoria, ManutencaoDetalhe, OpcoesManutencao, Providencia, Recado } from "../tipos.ts";
import { ArquivosManutencao } from "./ArquivosManutencao.tsx";
import { executorParaApi, nomeExecutor, nomePendencia, opcoesExecutor, PartesManutencao, SeloManutencao, textoTipo } from "./comum.tsx";
import { FormManutencao } from "./FormManutencao.tsx";
import { MarcarVisita } from "./MarcarVisita.tsx";
import { LinkPrestador } from "./LinkPrestador.tsx";
import { NosComunicados } from "../comunicados/NosComunicados.tsx";

type Acao =
  | { tipo: "editar" | "pendencia" | "etapa" | "retorno" | "previsao" | "concluir" | "cancelar" | "reabrir" | "providencia" | "itens" | "visita" }
  | { tipo: "fazer"; providencia: Providencia }
  | { tipo: "responder"; item: ItemVistoria }
  | null;

const TOM_ITEM = { CERTO: "ok", PROBLEMA: "erro", NAO_DEU: "neutro" } as const;

export function Manutencao() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const { atualizar } = usePlataforma();
  const carga = useCarregar<ManutencaoDetalhe>(id ? `/v1/condominio/manutencao/${id}` : null);
  const opcoes = useCarregar<OpcoesManutencao>("/v1/condominio/manutencao/opcoes");
  const [acao, setAcao] = useState<Acao>(null);
  const [recado, setRecado] = useState<Recado>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const voltar = <Link href="/manutencao" className="text-sm font-medium text-violeta-600 hover:underline">Voltar às manutenções</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Manutenção</h1><Vazio titulo="Manutenção não encontrada" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a manutenção…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="text-[28px] font-normal tracking-tight">Manutenção</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  }

  const d = carga.dados;
  const m = d.manutencao;
  const o = opcoes.estado === "pronto" ? opcoes.dados : null;
  const fechar = () => setAcao(null);
  const salvo = (texto: string) => { setAcao(null); setRecado({ tom: "ok", texto }); setFalha(null); carga.recarregar(); atualizar(); };
  const url = `/v1/condominio/manutencao/${m.id}`;
  const abertas = d.providencias.filter((p) => !p.feitaEm);
  const etapas = (o?.etapas ?? []).filter((e) => e.situacao === m.estado);

  async function situacao(estado: "PLANEJADA" | "EM_ANDAMENTO", texto: string) {
    const r = await chamarApi(`${url}/situacao`, { corpo: { versao: m.versao, estado } });
    if (!r.ok) return setFalha(r.erro);
    salvo(texto);
  }
  const enviar = (rota: string, corpo: Record<string, unknown>, texto: string, metodo?: "PUT") => async (): Promise<Resposta<unknown>> => {
    const r = await chamarApi(`${url}${rota}`, { metodo, corpo: { versao: m.versao, ...corpo } });
    if (r.ok) salvo(texto);
    return r;
  };

  function janela(): { titulo: string; campos: Campo[]; iniciais: Valores; botao: string; explicacao?: string; salvar: (v: Valores) => Promise<Resposta<unknown>>; extra?: ReactNode } | null {
    if (!acao) return null;
    switch (acao.tipo) {
      case "pendencia":
        return { titulo: "Marcar como pendente", botao: "Marcar pendente", explicacao: "Pendente é o que espera alguma coisa de fora. Sair de pendente resolve a pendência.",
          campos: [
            { id: "pendenciaTipo", rotulo: "O que impede", tipo: "selecao", opcoes: [{ valor: "", texto: "Escolha" }, ...opcoesDe(TIPOS_PENDENCIA)], erro: "Diga o que impede." },
            { id: "pendenciaMotivo", rotulo: "Explique", tipo: "area", obrigatorio: true, max: 300, erro: "Explique a pendência (de 3 a 300 caracteres)." },
          ],
          iniciais: { pendenciaTipo: "", pendenciaMotivo: "" },
          salvar: (v) => enviar("/situacao", { estado: "PENDENTE", pendenciaTipo: v.pendenciaTipo || null, pendenciaMotivo: v.pendenciaMotivo || null },
            "Manutenção marcada como pendente.")() };
      case "etapa":
        return { titulo: "Mudar a etapa", botao: "Salvar etapa", explicacao: `As etapas de ${SITUACOES_MANUTENCAO[m.estado].toLowerCase()} vêm das Configurações.`,
          campos: [{ id: "etapa", rotulo: "Etapa", tipo: "selecao", opcoes: [{ valor: "", texto: "Sem etapa" }, ...etapas.map((e) => ({ valor: e.id, texto: e.nome }))] }],
          iniciais: { etapa: m.etapa?.id ?? "" },
          salvar: (v) => enviar("/situacao", { estado: m.estado, etapaId: v.etapa || null,
            pendenciaTipo: m.pendencia?.tipo ?? null, pendenciaMotivo: m.pendencia?.motivo ?? null }, "Etapa salva.")() };
      case "retorno":
        return { titulo: "Próximo retorno", botao: "Salvar retorno", explicacao: "Quando dar notícia. Mudar pede motivo, que fica no histórico.",
          campos: [
            { id: "quando", rotulo: "Quando", tipo: "datahora", ajuda: "Deixe em branco para tirar o retorno.", erro: "Entre agora e dois anos à frente." },
            { id: "motivo", rotulo: "Por que mudou", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." },
          ],
          iniciais: { quando: m.proximoRetorno ? paraDataHoraLocal(m.proximoRetorno) : "", motivo: "" },
          salvar: (v) => enviar("/proximo-retorno", { quando: v.quando ? deDataHoraLocal(String(v.quando)) : null, motivo: v.motivo }, "Próximo retorno salvo.", "PUT")() };
      case "previsao":
        return { titulo: "Previsão de conclusão", botao: "Salvar previsão", explicacao: "Só quando souber. Não muda o próximo retorno.",
          campos: [
            { id: "data", rotulo: "Data", tipo: "data", ajuda: "Deixe em branco para tirar a previsão.", erro: "Entre hoje e dois anos à frente." },
            { id: "motivo", rotulo: "Por que mudou", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." },
          ],
          iniciais: { data: m.previsao ?? "", motivo: "" },
          salvar: (v) => enviar("/previsao", { data: v.data || null, motivo: v.motivo }, "Previsão salva.", "PUT")() };
      case "concluir":
        return { titulo: "Concluir manutenção", botao: "Concluir",
          campos: [
            { id: "conclusao", rotulo: "O que foi feito", tipo: "area", obrigatorio: true, max: 2000, erro: "Diga o que foi feito (de 10 a 2000 caracteres)." },
            { id: "realizadaEm", rotulo: "Data em que foi feita", tipo: "data", obrigatorio: true, erro: "Entre o registro e hoje." },
            ...(abertas.length ? [{ id: "fechar", rotulo: abertas.length === 1 ? "Fechar junto a providência aberta" : `Fechar junto as ${abertas.length} providências abertas`,
              tipo: "caixa", ajuda: abertas.map((p) => p.texto).join(" · ") } as Campo] : []),
          ],
          iniciais: { conclusao: "", realizadaEm: d.hoje, fechar: false },
          extra: m.pedido ? <Aviso tom="atencao" titulo={`O pedido ${m.pedido.protocolo} continua aberto`}>Concluir a manutenção não encerra o pedido. Dê o retorno ao morador e conclua o pedido por lá.</Aviso> : undefined,
          salvar: (v) => enviar("/concluir", { conclusao: v.conclusao, realizadaEm: v.realizadaEm, fecharProvidencias: v.fechar === true },
            m.preventiva ? "Manutenção concluída. A preventiva já tem a próxima data." : "Manutenção concluída.")() };
      case "cancelar":
        return { titulo: "Cancelar manutenção", botao: "Cancelar manutenção", explicacao: "O motivo fica no histórico. Dá para reabrir depois, também com motivo.",
          campos: [{ id: "motivo", rotulo: "Por que cancelar", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }],
          iniciais: { motivo: "" },
          salvar: (v) => enviar("/cancelar", { motivo: v.motivo }, "Manutenção cancelada.")() };
      case "reabrir":
        return { titulo: "Reabrir manutenção", botao: "Reabrir", explicacao: m.estado === "CONCLUIDA" ? "Volta em andamento; a conclusão anterior fica no histórico." : "Volta planejada.",
          campos: [{ id: "motivo", rotulo: "Por que reabrir", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }],
          iniciais: { motivo: "" },
          salvar: (v) => enviar("/reabrir", { motivo: v.motivo }, "Manutenção reaberta.")() };
      case "providencia":
        return { titulo: "Nova providência", botao: "Incluir providência",
          campos: [
            { id: "texto", rotulo: "O que fazer", tipo: "texto", obrigatorio: true, max: 300, erro: "De 3 a 300 caracteres." },
            { id: "executor", rotulo: "Quem executa", tipo: "selecao", opcoes: o ? opcoesExecutor(o) : [{ valor: "", texto: "Ninguém ainda" }], erro: "Escolha um só." },
            { id: "executorTexto", rotulo: "Nome de quem executa (se escolheu Outro)", tipo: "texto", max: 120 },
          ],
          iniciais: { texto: "", executor: "", executorTexto: "" },
          salvar: (v) => enviar("/providencias", { texto: v.texto, ...executorParaApi(String(v.executor), String(v.executorTexto)) }, "Providência incluída.")() };
      case "fazer":
        return { titulo: "Providência feita", botao: "Marcar como feita", explicacao: acao.providencia.texto,
          campos: [{ id: "resultado", rotulo: "Resultado", tipo: "area", obrigatorio: true, max: 1000, erro: "Diga o resultado, de 2 a 1000 caracteres." }],
          iniciais: { resultado: "" },
          salvar: async (v) => {
            const r = await chamarApi(`${url}/providencias/${acao.providencia.id}/fazer`, { corpo: { versao: m.versao, resultado: v.resultado } });
            if (r.ok) salvo("Providência feita.");
            return r;
          } };
      case "itens":
        return { titulo: "Mudar a lista da vistoria", botao: "Salvar lista",
          explicacao: "A lista é desta vistoria. Só sai o item que ainda não tem resposta.",
          campos: [
            { id: "incluir", rotulo: "Incluir itens (um por linha)", tipo: "area", erro: "Cada item de 2 a 200 caracteres." },
            ...d.itens.filter((i) => !i.resultado).map((i) => ({ id: `tirar-${i.id}`, rotulo: `Tirar "${i.texto}"`, tipo: "caixa" } as Campo)),
          ],
          iniciais: { incluir: "" },
          salvar: (v) => enviar("/itens", {
            incluir: String(v.incluir ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
            tirar: Object.entries(v).filter(([k, x]) => k.startsWith("tirar-") && x === true).map(([k]) => k.slice(6)),
          }, "Lista da vistoria salva.", "PUT")() };
      case "responder":
        return { titulo: acao.item.texto, botao: "Salvar resposta",
          campos: [
            { id: "resultado", rotulo: "Como está", tipo: "selecao", opcoes: [{ valor: "", texto: "Sem resposta" }, ...opcoesDe(RESULTADOS_ITEM)] },
            { id: "observacao", rotulo: "Observação", tipo: "area", max: 500, ajuda: "Em \"não deu\", diga por quê.", erro: "De 2 a 500 caracteres; em \"não deu\", diga por quê." },
          ],
          iniciais: { resultado: acao.item.resultado ?? "", observacao: acao.item.observacao ?? "" },
          salvar: async (v) => {
            const r = await chamarApi(`${url}/itens/${acao.item.id}/responder`, { corpo: { versao: m.versao, resultado: v.resultado || null, observacao: v.observacao || null } });
            if (r.ok) salvo("Resposta salva.");
            return r;
          } };
      default:
        return null;
    }
  }

  async function virar(item: ItemVistoria) {
    const r = await chamarApi<{ id: string }>(`${url}/itens/${item.id}/manutencao`, { corpo: { versao: m.versao } });
    if (!r.ok) return setFalha(r.erro);
    salvo(`"${item.texto}" virou uma manutenção corretiva, ligada a esta vistoria.`);
  }

  const j = janela();

  return (
    <div className="grid gap-5">
      <PartesManutencao />
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-[28px] font-normal tracking-tight">{m.titulo}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <SeloManutencao estado={m.estado} />
            <Selo tom="info">{textoTipo(m)}</Selo>
            {m.prioridade ? <Selo tom="atencao">Prioridade {m.prioridade.nome.toLowerCase()}</Selo> : null}
            {m.atrasada ? <Selo tom="erro">Atrasada</Selo> : null}
          </p>
        </div>
        {d.pode.editar ? (
          <div className="flex flex-wrap items-center gap-2">
            {m.estado === "PENDENTE"
              ? <Botao variante="contorno" onClick={() => void situacao("EM_ANDAMENTO", "Pendência resolvida.")}>Resolver pendência</Botao>
              : <Botao variante="contorno" onClick={() => setAcao({ tipo: "pendencia" })}>Pendência</Botao>}
            <Botao onClick={() => setAcao({ tipo: "concluir" })}>Concluir</Botao>
          </div>
        ) : null}
        {d.pode.reabrir ? <Botao variante="contorno" onClick={() => setAcao({ tipo: "reabrir" })}>Reabrir</Botao> : null}
      </div>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}
      {m.pendencia ? <Aviso tom="atencao" titulo={`Pendente · ${nomePendencia(m.pendencia.tipo)}`} papel="status">{m.pendencia.motivo} Desde {diaHora(m.pendencia.desde)}.</Aviso> : null}
      {m.conclusao ? (
        <Aviso tom="ok" titulo={`Concluída · feita em ${mostrarDataCurta(m.conclusao.realizadaEm)}`}>
          {m.conclusao.texto} <span className="text-tinta-suave">({m.conclusao.por ?? "alguém"}, {diaHora(m.conclusao.em)})</span>
        </Aviso>
      ) : null}
      {m.cancelamento ? <Aviso tom="info" titulo="Manutenção cancelada">{m.cancelamento.por ?? "Alguém"} em {diaHora(m.cancelamento.em)}. Motivo: {m.cancelamento.motivo}</Aviso> : null}
      {m.estado === "CONCLUIDA" && m.pedido && m.pedido.estado !== "ENCERRADO" && m.pedido.estado !== "CANCELADO" ? (
        <Aviso tom="info">O pedido {m.pedido.protocolo} continua aberto: dê o retorno ao morador e conclua por lá.</Aviso>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid content-start gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
          <span className="text-xs font-medium tracking-[.1em] text-tinta-suave uppercase">Próximo retorno</span>
          <span className={`text-xl ${m.retornoVencido ? "text-erro" : ""}`}>{m.proximoRetorno ? `${m.retornoVencido ? "venceu " : ""}${diaHora(m.proximoRetorno)}` : "Sem retorno"}</span>
          {d.pode.editar ? <Botao variante="discreto" tamanho="p" className="justify-self-start" onClick={() => setAcao({ tipo: "retorno" })}>Mudar</Botao> : null}
        </div>
        <div className="grid content-start gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
          <span className="text-xs font-medium tracking-[.1em] text-tinta-suave uppercase">Previsão de conclusão</span>
          <span className="text-xl">{m.previsao ? mostrarDataCurta(m.previsao) : "Sem previsão"}</span>
          {d.pode.editar ? <Botao variante="discreto" tamanho="p" className="justify-self-start" onClick={() => setAcao({ tipo: "previsao" })}>Mudar</Botao> : null}
        </div>
        <div className="grid content-start gap-1 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
          <span className="text-xs font-medium tracking-[.1em] text-tinta-suave uppercase">Responsável</span>
          <span className="text-xl">{m.responsavel.nome ?? "Sem acesso agora"}</span>
        </div>
      </div>

      <dl className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1 sm:grid-cols-3">
        <div><dt className="text-xs text-tinta-suave">Local ou equipamento</dt><dd>{m.local}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Registrada</dt><dd>{diaHora(m.criadoEm)}{m.registradaPor ? ` por ${m.registradaPor}` : " pela preventiva"}</dd></div>
        <div>
          <dt className="text-xs text-tinta-suave">Etapa</dt>
          <dd className="flex flex-wrap items-center gap-2">{m.etapa?.nome ?? "Sem etapa"}
            {d.pode.editar && etapas.length ? <Botao variante="discreto" tamanho="p" onClick={() => setAcao({ tipo: "etapa" })}>Mudar</Botao> : null}
          </dd>
        </div>
        {m.preventiva ? <div><dt className="text-xs text-tinta-suave">Preventiva</dt><dd>{descreverFrequencia(m.preventiva.unidadeTempo, m.preventiva.intervalo)}, prevista para {m.dataPrevista ? mostrarDataCurta(m.dataPrevista) : ""}</dd></div> : null}
        {m.acesso ? <div><dt className="text-xs text-tinta-suave">Acesso</dt><dd>{m.acesso}</dd></div> : null}
        {m.impedimento ? <div><dt className="text-xs text-tinta-suave">Impedimento</dt><dd>{m.impedimento}</dd></div> : null}
        {m.detalhes ? <div className="sm:col-span-3"><dt className="text-xs text-tinta-suave">Detalhes</dt><dd className="whitespace-pre-line">{m.detalhes}</dd></div> : null}
      </dl>

      {d.pode.editar ? (
        <div className="flex flex-wrap items-center gap-2">
          {m.estado === "PLANEJADA" ? <Botao variante="contorno" onClick={() => void situacao("EM_ANDAMENTO", "Manutenção em andamento.")}>Iniciar</Botao> : null}
          {m.estado === "EM_ANDAMENTO" ? <Botao variante="contorno" onClick={() => void situacao("PLANEJADA", "Manutenção voltou a planejada.")}>Voltar a planejada</Botao> : null}
          <Botao variante="contorno" disabled={!o} onClick={() => setAcao({ tipo: "editar" })}>Editar</Botao>
          {d.pode.marcarVisita ? <Botao variante="contorno" onClick={() => setAcao({ tipo: "visita" })}>Marcar visita</Botao> : null}
          <Botao variante="discreto" className="text-erro" onClick={() => setAcao({ tipo: "cancelar" })}>Cancelar manutenção</Botao>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section aria-labelledby="t-providencias" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="t-providencias" className="text-lg font-medium">Providências</h2>
              {d.pode.editar ? <Botao variante="contorno" tamanho="m" onClick={() => setAcao({ tipo: "providencia" })}>+ Nova providência</Botao> : null}
            </div>
            {d.providencias.length === 0 ? <p className="text-sm text-tinta-suave">Nenhuma providência ainda. Divida o trabalho em passos, cada um com quem executa.</p> : (
              <ul className="divide-y divide-linha">
                {d.providencias.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium">{p.texto}</span>
                      <span className="text-xs text-tinta-suave">{nomeExecutor(p.executor)}{p.feitaEm ? ` · feita em ${diaHora(p.feitaEm)}${p.feitaPor ? ` por ${p.feitaPor}` : ""}` : ""}</span>
                      {p.resultado ? <span className="rounded-lg bg-ok-fundo px-2.5 py-1.5 text-[13px]">{p.resultado}</span> : null}
                    </span>
                    {p.feitaEm ? <Selo tom="ok">Feita</Selo> : d.pode.editar
                      ? <Botao variante="contorno" tamanho="p" onClick={() => setAcao({ tipo: "fazer", providencia: p })}>Marcar feita</Botao>
                      : <Selo tom="neutro">Aberta</Selo>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {m.tipo === "VISTORIA" ? (
            <section aria-labelledby="t-vistoria" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="t-vistoria" className="text-lg font-medium">O que olhar</h2>
                {d.pode.editar ? <Botao variante="discreto" tamanho="m" onClick={() => setAcao({ tipo: "itens" })}>Mudar a lista</Botao> : null}
              </div>
              {d.itens.length === 0 ? <p className="text-sm text-tinta-suave">A lista está vazia. Inclua o que olhar nesta vistoria.</p> : (
                <ul className="divide-y divide-linha">
                  {d.itens.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="grid min-w-0 gap-0.5">
                        <span>{i.texto}</span>
                        <span className="text-xs text-tinta-suave">
                          {[i.observacao, i.fotos ? (i.fotos === 1 ? "1 foto" : `${i.fotos} fotos`) : null].filter(Boolean).join(" · ")}
                        </span>
                        {i.gerada ? <Link href={`/manutencao/manutencao?id=${i.gerada.id}`} className="text-xs font-medium text-violeta-600 hover:underline">Virou manutenção: {i.gerada.titulo}</Link> : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        {i.resultado ? <Selo tom={TOM_ITEM[i.resultado]}>{RESULTADOS_ITEM[i.resultado]}</Selo> : <Selo tom="neutro">Sem resposta</Selo>}
                        {d.pode.editar ? <Botao variante="discreto" tamanho="p" onClick={() => setAcao({ tipo: "responder", item: i })} aria-label={`Responder ${i.texto}`}>Responder</Botao> : null}
                        {d.pode.editar && i.resultado === "PROBLEMA" && !i.gerada
                          ? <Botao variante="contorno" tamanho="p" onClick={() => void virar(i)}>Virar manutenção</Botao> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-tinta-suave">Item com problema pode virar uma manutenção corretiva, ligada a esta vistoria.</p>
            </section>
          ) : null}

          <ArquivosManutencao key={`arq-${m.versao}`} manutencaoId={m.id} itens={d.itens}
            avisar={(r) => { setRecado(r); if (r) carga.recarregar(); }} />

          <section aria-labelledby="t-hist" className="grid gap-2">
            <h2 id="t-hist" className="text-lg font-medium">Histórico</h2>
            <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {d.historico.map((h, i) => (
                <li key={i} className="grid gap-0.5 px-4 py-2.5 text-sm">
                  <span>{descreverEventoManutencao(h.acao, h.dados)}</span>
                  <span className="text-xs text-tinta-suave">
                    {h.autor ?? "Sistema"} · {diaHora(h.em)}{typeof h.dados.motivo === "string" ? ` · "${h.dados.motivo}"` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid gap-4">
          <section aria-labelledby="t-ligacoes" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
            <h2 id="t-ligacoes" className="text-lg font-medium">Ligações</h2>
            {m.pedido ? (
              <Link href={`/pedidos/pedido?id=${m.pedido.id}`} className="rounded-xl border border-linha px-3 py-2 text-sm hover:border-violeta-300">
                <span className="block font-medium">Pedido {m.pedido.protocolo}</span>
                <span className="text-xs text-tinta-suave">{m.pedido.assunto}</span>
              </Link>
            ) : m.pedidoOculto ? <p className="text-sm text-tinta-suave">Ligada a um pedido que você não vê.</p> : null}
            {(d.compromissos ?? []).map((c) => (
              <Link key={c.id} href={`/agenda/compromisso?id=${c.id}`} className="rounded-xl border border-linha px-3 py-2 text-sm hover:border-violeta-300">
                <span className="block font-medium">Visita {mostrarDataCurta(c.data).slice(0, 5)}, {mostrarHorario(c)}</span>
                <span className="text-xs text-tinta-suave">{c.titulo}</span>
              </Link>
            ))}
            {m.origem ? (
              <Link href={`/manutencao/manutencao?id=${m.origem.id}`} className="rounded-xl border border-linha px-3 py-2 text-sm hover:border-violeta-300">
                <span className="block font-medium">Veio da vistoria</span>
                <span className="text-xs text-tinta-suave">{m.origem.titulo} (as fotos do item ficam lá)</span>
              </Link>
            ) : null}
            {d.geradas.map((g) => (
              <Link key={g.id} href={`/manutencao/manutencao?id=${g.id}`} className="rounded-xl border border-linha px-3 py-2 text-sm hover:border-violeta-300">
                <span className="block font-medium">Abriu: {g.titulo}</span>
                <span className="text-xs text-tinta-suave">{SITUACOES_MANUTENCAO[g.estado]}</span>
              </Link>
            ))}
            {!m.pedido && !m.pedidoOculto && !(d.compromissos ?? []).length && !m.origem && !d.geradas.length
              ? <p className="text-sm text-tinta-suave">Sem pedido nem visita ligados.</p> : null}
            <p className="text-xs text-tinta-suave">Concluir a manutenção não encerra o pedido; cancelar a visita não apaga a manutenção.</p>
          </section>

          <NosComunicados manutencaoId={m.id} ativo={m.estado !== "CONCLUIDA" && m.estado !== "CANCELADA"} />

          <section aria-labelledby="t-executor" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
            <h2 id="t-executor" className="text-lg font-medium">Quem executa</h2>
            {d.prestador ? (
              <>
                <p className="text-sm"><span className="font-medium">{d.prestador.nome}</span><span className="block text-xs text-tinta-suave">{d.prestador.servico} · {d.prestador.acordo === "CONTRATO" ? "com contrato" : "por chamado"}</span></p>
                {d.prestador.contato ? <p className="text-sm">{d.prestador.contato}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {d.prestador.telefone ? <a href={`tel:${d.prestador.telefone}`} className={classeBotao("contorno", "", "m")}>Ligar</a> : null}
                  <Link href={`/manutencao/prestador?id=${d.prestador.id}`} className={classeBotao("discreto", "", "m")}>Ver ficha</Link>
                </div>
                {d.prestador.reserva ? <p className="text-xs text-tinta-suave">Reserva indicada: {d.prestador.reserva.nome}. A troca automática quando o principal não responde chega com o WhatsApp.</p> : null}
              </>
            ) : <p className="text-sm">{nomeExecutor(m.executor)}</p>}
          </section>

          <LinkPrestador manutencaoId={m.id} titulo={m.titulo} versao={m.versao} recarregarManutencao={carga.recarregar} />
        </div>
      </div>

      {j ? (
        <Janela key={acao?.tipo === "fazer" ? `f-${acao.providencia.id}` : acao?.tipo === "responder" ? `r-${acao.item.id}` : acao?.tipo} aberto titulo={j.titulo} campos={j.campos} iniciais={j.iniciais} textoBotao={j.botao} explicacao={j.explicacao}
          aoFechar={fechar} aoSalvar={j.salvar} recarregar={carga.recarregar} extra={j.extra} />
      ) : null}
      {o ? <FormManutencao aberto={acao?.tipo === "editar"} manutencao={m} opcoes={o} aoFechar={fechar} recarregar={carga.recarregar}
        salvo={(_, texto) => salvo(texto)} /> : null}
      {acao?.tipo === "visita" ? <MarcarVisita manutencaoId={m.id} aoFechar={fechar} salvo={salvo} /> : null}
    </div>
  );
}
