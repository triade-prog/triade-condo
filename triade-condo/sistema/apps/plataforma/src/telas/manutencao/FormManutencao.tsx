"use client";
// Nova manutenção e editar (DC15, telas-modelo manutencao-nova-*; MP-01, MP-02, MP-04, MP-07):
// corretiva ou vistoria (a preventiva nasce em Preventivas). Obrigatórios: o que é, onde, a
// prioridade e o responsável. Quem executa pode ficar em branco. Ligar a um pedido é opcional.
// No computador é uma tela só, em três partes numeradas, na ordem em que se pensa (o que é, quem
// cuida, quando); no celular são três passos com barra de progresso (decisão D.1 de 22/10/2026),
// e nada do que foi preenchido se perde ao voltar.

import { useState, type FormEvent, type ReactNode } from "react";
import { TIPOS_MANUTENCAO } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { useCelular } from "../celular.ts";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import { deDataHoraLocal } from "../pedidos/comum.tsx";
import type { ManutencaoDetalhe, OpcoesManutencao } from "../tipos.ts";
import { executorParaApi, opcoesExecutor, valorExecutor } from "./comum.tsx";
import { ListaLocais } from "../Locais.tsx";

export interface InicioManutencao {
  titulo?: string;
  local?: string;
  pedidoId?: string;
  /** O prestador que executa, já escolhido (a ordem de serviço que nasce de um orçamento, R8). */
  prestadorId?: string;
}

type Props = {
  aberto: boolean;
  opcoes: OpcoesManutencao;
  aoFechar: () => void;
  /** Depois de gravar: o id e se a pessoa pediu para marcar a visita. */
  salvo: (id: string, texto: string, marcarVisita: boolean) => void;
  recarregar?: () => void;
} & ({ manutencao?: undefined; inicio?: InicioManutencao } | { manutencao: ManutencaoDetalhe["manutencao"]; inicio?: undefined });

const PARTES = ["O que e onde", "Quem cuida e quem executa", "Quando e detalhes"] as const;
type Passo = 1 | 2 | 3;
/** Em que passo cada campo fica, para voltar a ele quando faltar ou o banco recusar. */
const PASSO_DO_CAMPO: Record<string, Passo> = { titulo: 1, local: 1, prioridadeId: 1, itens: 1, responsavelId: 2, executor: 2, pedidoId: 2 };

/** Uma parte do formulário: com número no computador; no celular, só aparece no seu passo. */
function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <section aria-labelledby={`mn-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h3 id={`mn-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h3>
      </div>
      {children}
    </section>
  );
}

export function FormManutencao(props: Props) {
  return (
    <Dialogo aberto={props.aberto} media titulo={props.manutencao ? "Editar manutenção" : "Nova manutenção"} aoFechar={props.aoFechar}>
      {props.aberto ? <Formulario {...props} /> : null}
    </Dialogo>
  );
}

function Formulario({ opcoes, aoFechar, salvo, recarregar, manutencao, inicio }: Props) {
  const m = manutencao;
  const celular = useCelular();
  const exec = valorExecutor(m?.executor);
  const eu = opcoes.pessoas.find((p) => p.eu && p.veManutencao);
  const [v, setV] = useState({
    tipo: (m?.tipo === "VISTORIA" ? "VISTORIA" : "CORRETIVA") as "CORRETIVA" | "VISTORIA",
    titulo: m?.titulo ?? inicio?.titulo ?? "",
    local: m?.local ?? inicio?.local ?? "",
    prioridadeId: m?.prioridade?.id ?? "",
    responsavelId: m?.responsavel.vinculoId ?? eu?.vinculoId ?? "",
    executor: exec.escolha || (inicio?.prestadorId && opcoes.prestadores.some((p) => p.id === inicio.prestadorId) ? `P:${inicio.prestadorId}` : ""),
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
  const [passo, setPasso] = useState<Passo>(1);
  const [faltaNoPasso, setFaltaNoPasso] = useState<string[]>([]);
  const mudar = (x: Partial<typeof v>) => { setV((y) => ({ ...y, ...x })); setFaltaNoPasso((f) => f.filter((c) => !(c in x))); };
  const preventiva = m?.tipo === "PREVENTIVA";

  /** O que falta para sair do passo (as mesmas regras do banco). */
  function faltasDoPasso(n: Passo): string[] {
    if (n === 1) {
      return [v.titulo.trim().length < 3 ? "titulo" : null, v.local.trim().length < 2 ? "local" : null,
        !v.prioridadeId && !preventiva ? "prioridadeId" : null].filter((x): x is string => x !== null);
    }
    if (n === 2) return v.responsavelId ? [] : ["responsavelId"];
    return [];
  }

  function irPara(n: Passo) {
    for (let p = passo; p < n; p++) {
      const f = faltasDoPasso(p as Passo);
      if (f.length) { setPasso(p as Passo); setFaltaNoPasso(f); return; }
    }
    setFaltaNoPasso([]);
    setPasso(n);
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    // No celular, o Enter e o Continuar seguem para o próximo passo.
    if (celular && passo < 3) return irPara((passo + 1) as Passo);
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
    if (!r.ok) {
      setErro(r.erro);
      const primeiro = camposComErro(r.erro).find((c) => PASSO_DO_CAMPO[c]);
      if (primeiro) setPasso(PASSO_DO_CAMPO[primeiro]!);
      return;
    }
    if (m) return salvo(m.id, "Manutenção alterada.", false);
    salvo((r.dados as { id: string }).id, "Manutenção registrada.", v.marcarVisita);
  }

  const comErro = [...camposComErro(erro), ...faltaNoPasso];
  const msg = (campo: string, texto: string) => (comErro.includes(campo) ? texto : null);
  const responsaveis = opcoes.pessoas.filter((p) => p.veManutencao || p.vinculoId === m?.responsavel.vinculoId);
  const opcoesExec = opcoesExecutor(opcoes, m?.executor);
  const resumo1 = [m ? null : TIPOS_MANUTENCAO[v.tipo], v.titulo.trim(), opcoes.prioridades.find((p) => p.id === v.prioridadeId)?.nome].filter(Boolean).join(" · ");
  const resumo2 = [responsaveis.find((p) => p.vinculoId === v.responsavelId)?.nome,
    v.executor === "T" ? v.executorTexto.trim() : v.executor ? opcoesExec.find((x) => x.valor === v.executor)?.texto.split(" · ")[0] : null].filter(Boolean).join(" · ");
  const textoSalvar = enviando ? "Salvando…" : m ? "Salvar alterações" : "Registrar manutenção";

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      <div className="grid gap-3 md:hidden">
        <p className="grid">
          <span className="t-apoio">Passo {passo} de 3</span>
          <span className="t-titulo-cartao">{PARTES[passo - 1]}</span>
        </p>
        <div className="passos" role="progressbar" aria-label="Passos da manutenção" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo}
          aria-valuetext={`Passo ${passo} de 3: ${PARTES[passo - 1]}`}>
          {[1, 2, 3].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
        </div>
        {passo > 1 ? (
          <div className="grid gap-2">
            {([[1, resumo1], [2, resumo2]] as const).filter(([n]) => n < passo).map(([n, texto]) => (
              <button key={n} type="button" className="resumo-passo" onClick={() => setPasso(n)}>
                <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
                <span className="grid min-w-0 flex-1">
                  <span className="t-apoio">{PARTES[n - 1]}</span>
                  <span className="truncate">{texto || "Nada escolhido"}</span>
                </span>
                <span className="alterar">Alterar</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar ? () => { aoFechar(); recarregar(); } : undefined} /> : null}

      <div className="grid">
        <Parte n={1} passo={passo}>
          {m ? null : (
            <div className="grid gap-1.5">
              <Escolha rotulo="Tipo da manutenção" atual={v.tipo} aoMudar={(x) => mudar({ tipo: x })}
                opcoes={[{ valor: "CORRETIVA" as const, texto: <><Icone nome="ferramenta" className="h-4 w-4" />{TIPOS_MANUTENCAO.CORRETIVA}</> },
                  { valor: "VISTORIA" as const, texto: <><Icone nome="olho" className="h-4 w-4" />{TIPOS_MANUTENCAO.VISTORIA}</> }]} />
              <p className="t-apoio">A preventiva nasce sozinha, perto da data, em Manutenção › Preventivas.</p>
            </div>
          )}
          <CampoTexto id="mn-titulo" rotulo="O que precisa ser feito" required maxLength={120} value={v.titulo}
            erro={msg("titulo", "Diga o que precisa ser feito, de 3 a 120 caracteres.")} onChange={(e) => mudar({ titulo: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto id="mn-local" rotulo="Local ou equipamento" required maxLength={120} value={v.local} list="mn-locais"
              ajuda="Ex.: casa de bombas, bomba 2, fachada leste." erro={msg("local", "Diga o local ou o equipamento.")}
              onChange={(e) => mudar({ local: e.target.value })} />
            <ListaLocais id="mn-locais" extras={opcoes.locais} />
            <CampoSelecao id="mn-prioridade" rotulo="Prioridade" icone="alerta" value={v.prioridadeId} erro={msg("prioridadeId", "Escolha a prioridade.")}
              ajuda="As prioridades vêm das Configurações." onChange={(e) => mudar({ prioridadeId: e.target.value })}
              opcoes={[{ valor: "", texto: preventiva ? "Sem prioridade" : "Escolha a prioridade" },
                ...opcoes.prioridades.map((p) => ({ valor: p.id, texto: `${p.nome}: ${p.significado}` }))]} />
          </div>
          {!m && v.tipo === "VISTORIA" ? (
            <CampoAreaTexto id="mn-itens" rotulo="O que olhar" opcional value={v.itens}
              ajuda="Um item por linha. A lista é desta vistoria; dá para mudar depois." erro={msg("itens", "Cada item de 2 a 200 caracteres, até 60.")}
              onChange={(e) => mudar({ itens: e.target.value })} />
          ) : null}
        </Parte>

        <Parte n={2} passo={passo}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelecao id="mn-responsavel" rotulo="Responsável" icone="pessoa" value={v.responsavelId}
              ajuda="Quem acompanha e dá notícia. Precisa ver a manutenção." erro={msg("responsavelId", "Escolha alguém que vê a manutenção.")}
              onChange={(e) => mudar({ responsavelId: e.target.value })}
              opcoes={[{ valor: "", texto: "Escolha o responsável" }, ...responsaveis.map((p) => ({ valor: p.vinculoId, texto: p.cargo ? `${p.nome} · ${p.cargo}` : p.nome }))]} />
            <CampoSelecao id="mn-executor" rotulo="Quem executa" icone="ferramenta" opcional value={v.executor}
              ajuda="Do cadastro de prestadores, alguém da equipe ou escrito à mão. Pode ficar em branco." erro={msg("executor", "Escolha um só.")}
              onChange={(e) => mudar({ executor: e.target.value })} opcoes={opcoesExec} />
          </div>
          {v.executor === "T" ? (
            <CampoTexto id="mn-executor-texto" rotulo="Nome de quem executa" maxLength={120} value={v.executorTexto}
              erro={msg("executor", "De 2 a 120 caracteres.")} onChange={(e) => mudar({ executorTexto: e.target.value })} />
          ) : null}
          {opcoes.pedidos.length || v.pedidoId ? (
            <CampoSelecao id="mn-pedido" rotulo="Pedido ligado" icone="pedido" opcional value={v.pedidoId} erro={msg("pedidoId", "Pedido não encontrado.")}
              ajuda="Concluir a manutenção não encerra o pedido: ele continua com o retorno ao morador."
              onChange={(e) => mudar({ pedidoId: e.target.value })}
              opcoes={[{ valor: "", texto: "Nenhum" },
                ...(m?.pedido && !opcoes.pedidos.some((p) => p.id === m.pedido!.id) ? [{ valor: m.pedido.id, texto: `${m.pedido.protocolo} · ${m.pedido.assunto}` }] : []),
                ...opcoes.pedidos.map((p) => ({ valor: p.id, texto: `${p.protocolo} · ${p.assunto}` }))]} />
          ) : null}
        </Parte>

        <Parte n={3} passo={passo}>
          {m ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto id="mn-retorno" rotulo="Próximo retorno" opcional type="datetime-local" value={v.proximoRetorno}
                ajuda="Quando dar notícia. Vencido, o responsável é avisado." erro={msg("proximoRetorno", "Entre agora e dois anos à frente.")}
                onChange={(e) => mudar({ proximoRetorno: e.target.value })} />
              <CampoTexto id="mn-previsao" rotulo="Previsão de conclusão" opcional type="date" value={v.previsao}
                ajuda="Só quando souber. Não muda o próximo retorno." erro={msg("previsao", "Entre hoje e dois anos à frente.")} onChange={(e) => mudar({ previsao: e.target.value })} />
            </div>
          )}
          <CampoAreaTexto id="mn-detalhes" rotulo="Detalhes" opcional maxLength={2000} value={v.detalhes}
            erro={msg("detalhes", "Até 2000 caracteres.")} onChange={(e) => mudar({ detalhes: e.target.value })} />
          {m ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto id="mn-acesso" rotulo="Acesso" opcional maxLength={300} value={v.acesso} ajuda="Como se chega ao local, quem tem a chave."
                erro={msg("acesso", "De 2 a 300 caracteres.")} onChange={(e) => mudar({ acesso: e.target.value })} />
              <CampoTexto id="mn-impedimento" rotulo="Impedimento" opcional maxLength={300} value={v.impedimento} ajuda="O que impede de fazer ou de ver."
                erro={msg("impedimento", "De 2 a 300 caracteres.")} onChange={(e) => mudar({ impedimento: e.target.value })} />
            </div>
          ) : null}
          {!m && opcoes.pode.agenda ? (
            <Caixa id="mn-visita" rotulo="Marcar visita na agenda depois de registrar" ajuda="Abre o compromisso já com quem executa, o local e esta manutenção."
              marcada={v.marcarVisita} aoMudar={(x) => mudar({ marcarVisita: x })} />
          ) : null}
        </Parte>
      </div>

      <div className="sticky -bottom-6 -mx-6 -mb-6 grid gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:rounded-none md:flex md:items-center md:justify-end">
        <div className="flex gap-2 max-md:hidden">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{textoSalvar}</Botao>
        </div>
        <div className="grid gap-2 md:hidden">
          {passo === 1 ? (
            <>
              <Botao type="submit" className="w-full">Continuar<Icone nome="dir" /></Botao>
              <Botao variante="discreto" className="w-full" onClick={aoFechar}>Cancelar</Botao>
            </>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Botao variante="contorno" onClick={() => setPasso((passo - 1) as Passo)}><Icone nome="esq" />Voltar</Botao>
              {passo === 2
                ? <Botao type="submit">Continuar<Icone nome="dir" /></Botao>
                : <Botao type="submit" disabled={enviando}><Icone nome="check" />{textoSalvar}</Botao>}
            </div>
          )}
          {passo > 1 ? <p className="t-apoio text-center">O que você já preencheu fica guardado se voltar.</p> : null}
        </div>
      </div>
    </form>
  );
}
