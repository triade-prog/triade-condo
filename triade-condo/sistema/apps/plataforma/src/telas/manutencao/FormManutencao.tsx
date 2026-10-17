"use client";
// Nova manutenção e editar (design "Telas da Manutenção", tela 2; MP-01, MP-02, MP-04, MP-07):
// corretiva ou vistoria (a preventiva nasce em Preventivas). Obrigatórios: o que é, onde, a
// prioridade e o responsável. Quem executa pode ficar em branco. Ligar a um pedido é opcional.

import { useState, type FormEvent } from "react";
import { TIPOS_MANUTENCAO } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import { deDataHoraLocal } from "../pedidos/comum.tsx";
import type { ManutencaoDetalhe, OpcoesManutencao } from "../tipos.ts";
import { executorParaApi, opcoesExecutor, valorExecutor } from "./comum.tsx";

export interface InicioManutencao {
  titulo?: string;
  local?: string;
  pedidoId?: string;
}

type Props = {
  aberto: boolean;
  opcoes: OpcoesManutencao;
  aoFechar: () => void;
  /** Depois de gravar: o id e se a pessoa pediu para marcar a visita. */
  salvo: (id: string, texto: string, marcarVisita: boolean) => void;
  recarregar?: () => void;
} & ({ manutencao?: undefined; inicio?: InicioManutencao } | { manutencao: ManutencaoDetalhe["manutencao"]; inicio?: undefined });

export function FormManutencao(props: Props) {
  return (
    <Dialogo aberto={props.aberto} titulo={props.manutencao ? "Editar manutenção" : "Nova manutenção"} aoFechar={props.aoFechar}>
      {props.aberto ? <Formulario {...props} /> : null}
    </Dialogo>
  );
}

function Formulario({ opcoes, aoFechar, salvo, recarregar, manutencao, inicio }: Props) {
  const m = manutencao;
  const exec = valorExecutor(m?.executor);
  const eu = opcoes.pessoas.find((p) => p.eu && p.veManutencao);
  const [v, setV] = useState({
    tipo: (m?.tipo === "VISTORIA" ? "VISTORIA" : "CORRETIVA") as "CORRETIVA" | "VISTORIA",
    titulo: m?.titulo ?? inicio?.titulo ?? "",
    local: m?.local ?? inicio?.local ?? "",
    prioridadeId: m?.prioridade?.id ?? "",
    responsavelId: m?.responsavel.vinculoId ?? eu?.vinculoId ?? "",
    executor: exec.escolha,
    executorTexto: exec.texto,
    proximoRetorno: "",
    previsao: "",
    detalhes: m?.detalhes ?? "",
    pedidoId: m?.pedido?.id ?? inicio?.pedidoId ?? "",
    acesso: m?.acesso ?? "",
    impedimento: m?.impedimento ?? "",
    itens: "",
    marcarVisita: false,
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (x: Partial<typeof v>) => setV((y) => ({ ...y, ...x }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const comuns = {
      titulo: v.titulo, local: v.local, detalhes: v.detalhes || null, prioridadeId: v.prioridadeId || null,
      responsavelId: v.responsavelId, pedidoId: v.pedidoId || null, ...executorParaApi(v.executor, v.executorTexto),
    };
    const r = m
      ? await chamarApi<{ versao: number }>(`/v1/condominio/manutencao/${m.id}`, { metodo: "PUT", corpo: {
        ...comuns, versao: m.versao, acesso: v.acesso || null, impedimento: v.impedimento || null } })
      : await chamarApi<{ id: string }>("/v1/condominio/manutencao", { corpo: {
        ...comuns, tipo: v.tipo, proximoRetorno: v.proximoRetorno ? deDataHoraLocal(v.proximoRetorno) : null, previsao: v.previsao || null,
        itens: v.tipo === "VISTORIA" ? v.itens.split("\n").map((x) => x.trim()).filter(Boolean) : [],
      } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    if (m) return salvo(m.id, "Manutenção alterada.", false);
    salvo((r.dados as { id: string }).id, "Manutenção registrada.", v.marcarVisita);
  }

  const comErro = camposComErro(erro);
  const msg = (campo: string, texto: string) => (comErro.includes(campo) ? texto : null);
  const responsaveis = opcoes.pessoas.filter((p) => p.veManutencao || p.vinculoId === m?.responsavel.vinculoId);

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar ? () => { aoFechar(); recarregar(); } : undefined} /> : null}
      {m ? null : (
        <Escolha rotulo="Tipo da manutenção" atual={v.tipo} aoMudar={(x) => mudar({ tipo: x })}
          opcoes={[{ valor: "CORRETIVA" as const, texto: TIPOS_MANUTENCAO.CORRETIVA }, { valor: "VISTORIA" as const, texto: TIPOS_MANUTENCAO.VISTORIA }]} />
      )}
      {m ? null : <p className="text-xs text-tinta-suave">A preventiva nasce sozinha, perto da data, em Manutenção › Preventivas.</p>}
      <CampoTexto id="mn-titulo" rotulo="O que precisa ser feito" required maxLength={120} value={v.titulo}
        erro={msg("titulo", "Diga o que precisa ser feito, de 3 a 120 caracteres.")} onChange={(e) => mudar({ titulo: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto id="mn-local" rotulo="Local ou equipamento" required maxLength={120} value={v.local} list="mn-locais"
          ajuda="Ex.: casa de bombas, bomba 2, fachada leste." erro={msg("local", "Diga o local ou o equipamento.")}
          onChange={(e) => mudar({ local: e.target.value })} />
        <datalist id="mn-locais">{opcoes.locais.map((l) => <option key={l} value={l} />)}</datalist>
        <CampoSelecao id="mn-prioridade" rotulo="Prioridade" value={v.prioridadeId} erro={msg("prioridadeId", "Escolha a prioridade.")}
          onChange={(e) => mudar({ prioridadeId: e.target.value })}
          opcoes={[{ valor: "", texto: m?.tipo === "PREVENTIVA" ? "Sem prioridade" : "Escolha a prioridade" },
            ...opcoes.prioridades.map((p) => ({ valor: p.id, texto: `${p.nome}: ${p.significado}` }))]} />
        <CampoSelecao id="mn-responsavel" rotulo="Responsável" value={v.responsavelId}
          ajuda="Quem acompanha e dá notícia. Precisa ver a manutenção." erro={msg("responsavelId", "Escolha alguém que vê a manutenção.")}
          onChange={(e) => mudar({ responsavelId: e.target.value })}
          opcoes={[{ valor: "", texto: "Escolha o responsável" }, ...responsaveis.map((p) => ({ valor: p.vinculoId, texto: p.cargo ? `${p.nome} · ${p.cargo}` : p.nome }))]} />
        <CampoSelecao id="mn-executor" rotulo="Quem executa" opcional value={v.executor}
          ajuda="Do cadastro de prestadores, alguém da equipe ou escrito à mão. Pode ficar em branco." erro={msg("executor", "Escolha um só.")}
          onChange={(e) => mudar({ executor: e.target.value })} opcoes={opcoesExecutor(opcoes, m?.executor)} />
      </div>
      {v.executor === "T" ? (
        <CampoTexto id="mn-executor-texto" rotulo="Nome de quem executa" maxLength={120} value={v.executorTexto}
          erro={msg("executor", "De 2 a 120 caracteres.")} onChange={(e) => mudar({ executorTexto: e.target.value })} />
      ) : null}
      {m ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto id="mn-retorno" rotulo="Próximo retorno" opcional type="datetime-local" value={v.proximoRetorno}
            ajuda="Quando dar notícia. Vencido, o responsável é avisado." erro={msg("proximoRetorno", "Entre agora e dois anos à frente.")}
            onChange={(e) => mudar({ proximoRetorno: e.target.value })} />
          <CampoTexto id="mn-previsao" rotulo="Previsão de conclusão" opcional type="date" value={v.previsao}
            ajuda="Só quando souber." erro={msg("previsao", "Entre hoje e dois anos à frente.")} onChange={(e) => mudar({ previsao: e.target.value })} />
        </div>
      )}
      <CampoAreaTexto id="mn-detalhes" rotulo="Detalhes" opcional maxLength={2000} value={v.detalhes}
        erro={msg("detalhes", "Até 2000 caracteres.")} onChange={(e) => mudar({ detalhes: e.target.value })} />
      {!m && v.tipo === "VISTORIA" ? (
        <CampoAreaTexto id="mn-itens" rotulo="O que olhar" opcional value={v.itens}
          ajuda="Um item por linha. A lista é desta vistoria; dá para mudar depois." erro={msg("itens", "Cada item de 2 a 200 caracteres, até 60.")}
          onChange={(e) => mudar({ itens: e.target.value })} />
      ) : null}
      {m ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto id="mn-acesso" rotulo="Acesso" opcional maxLength={300} value={v.acesso} ajuda="Como se chega ao local, quem tem a chave."
            erro={msg("acesso", "De 2 a 300 caracteres.")} onChange={(e) => mudar({ acesso: e.target.value })} />
          <CampoTexto id="mn-impedimento" rotulo="Impedimento" opcional maxLength={300} value={v.impedimento} ajuda="O que impede de fazer ou de ver."
            erro={msg("impedimento", "De 2 a 300 caracteres.")} onChange={(e) => mudar({ impedimento: e.target.value })} />
        </div>
      ) : null}
      {opcoes.pedidos.length || v.pedidoId ? (
        <CampoSelecao id="mn-pedido" rotulo="Pedido ligado" opcional value={v.pedidoId} erro={msg("pedidoId", "Pedido não encontrado.")}
          ajuda="Concluir a manutenção não encerra o pedido: ele continua com o retorno ao morador."
          onChange={(e) => mudar({ pedidoId: e.target.value })}
          opcoes={[{ valor: "", texto: "Nenhum" },
            ...(m?.pedido && !opcoes.pedidos.some((p) => p.id === m.pedido!.id) ? [{ valor: m.pedido.id, texto: `${m.pedido.protocolo} · ${m.pedido.assunto}` }] : []),
            ...opcoes.pedidos.map((p) => ({ valor: p.id, texto: `${p.protocolo} · ${p.assunto}` }))]} />
      ) : null}
      {!m && opcoes.pode.agenda ? (
        <Caixa id="mn-visita" rotulo="Marcar visita na agenda depois de registrar" ajuda="Abre o compromisso já com quem executa, o local e esta manutenção."
          marcada={v.marcarVisita} aoMudar={(x) => mudar({ marcarVisita: x })} />
      ) : null}
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : m ? "Salvar alterações" : "Registrar manutenção"}</Botao>
      </div>
    </form>
  );
}
