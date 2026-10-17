"use client";
// Novo compromisso e editar (design "Telas da Agenda", tela 3; AG-01, AG-02, AG-04, AG-05,
// MP-04): tipo no trilho, título, data, horário ou dia todo, onde, quem participa, pedido
// ligado e repetição. Conflito de horário avisa, mas não impede: a pessoa confirma e salva.

import { useState, type FormEvent } from "react";
import { ESCOPOS, LUGARES_COMPROMISSO, REPETICOES, SITUACOES_COMPROMISSO, TIPOS_COMPROMISSO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import type { CompromissoAgenda, ConflitoCompromisso, LugarCompromisso, OpcoesAgenda, TipoCompromisso } from "../tipos.ts";
import { ListaConflitos } from "./comum.tsx";

export interface InicioCompromisso {
  tipo?: TipoCompromisso;
  titulo?: string;
  data?: string;
  unidadeId?: string | null;
  pedidoId?: string | null;
  participantes?: string[];
  /** Visita marcada a partir da manutenção (peça R6, MP-04): nasce ligada a ela, sem repetição. */
  manutencaoId?: string;
  onde?: LugarCompromisso;
  local?: string;
  deFora?: string;
}

type Props = {
  aberto: boolean;
  opcoes: OpcoesAgenda;
  aoFechar: () => void;
  /** Depois de gravar: o id do compromisso (o primeiro, se repete) e se houve conflito aceito. */
  salvo: (id: string, texto: string) => void;
  recarregar?: () => void;
} & ({ compromisso?: undefined; inicio?: InicioCompromisso } | { compromisso: CompromissoAgenda; inicio?: undefined });

export function FormCompromisso(props: Props) {
  return (
    <Dialogo aberto={props.aberto} titulo={props.compromisso ? "Editar compromisso" : "Novo compromisso"} aoFechar={props.aoFechar}>
      {props.aberto ? <Formulario {...props} /> : null}
    </Dialogo>
  );
}

const opcoesDe = (o: Record<string, string>) => Object.entries(o).map(([valor, texto]) => ({ valor, texto }));

function Formulario({ opcoes, aoFechar, salvo, recarregar, compromisso, inicio }: Props) {
  const c = compromisso;
  const [v, setV] = useState({
    tipo: (c?.tipo ?? inicio?.tipo ?? "REUNIAO") as TipoCompromisso,
    titulo: c?.titulo ?? inicio?.titulo ?? "",
    data: c?.data ?? inicio?.data ?? opcoes.hoje,
    diaTodo: c ? c.diaTodo : false,
    horaInicio: c?.horaInicio ?? "",
    horaFim: c?.horaFim ?? "",
    onde: (c?.onde ?? inicio?.onde ?? (inicio?.unidadeId ? "UNIDADE" : "NENHUM")) as LugarCompromisso,
    unidadeId: c?.unidadeId ?? inicio?.unidadeId ?? "",
    local: c?.local ?? inicio?.local ?? "",
    participantes: c ? c.participantes.map((p) => p.vinculoId) : inicio?.participantes ?? [],
    deFora: c?.deFora ?? inicio?.deFora ?? "",
    pedidoId: c?.pedido?.id ?? inicio?.pedidoId ?? "",
    observacao: c?.observacao ?? "",
    estado: "PLANEJADO",
    repetir: "",
    intervalo: "1",
    fim: "VEZES" as "VEZES" | "ATE",
    vezes: "4",
    ate: "",
    escopo: "ESTA",
  });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [conflitos, setConflitos] = useState<ConflitoCompromisso[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (m: Partial<typeof v>) => { setV((x) => ({ ...x, ...m })); setConflitos(null); };
  const repete = Boolean(c?.serie);
  const daManutencao = !c && inicio?.manutencaoId ? inicio.manutencaoId : null;

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const comuns = {
      tipo: v.tipo, titulo: v.titulo,
      horaInicio: v.diaTodo ? null : v.horaInicio || null, horaFim: v.diaTodo ? null : v.horaFim || null,
      onde: v.onde, unidadeId: v.onde === "UNIDADE" ? v.unidadeId || null : null,
      local: v.onde === "AREA_COMUM" || v.onde === "OUTRO" ? v.local : null,
      participantes: v.participantes, deFora: v.deFora || null, pedidoId: v.pedidoId || null, observacao: v.observacao || null,
      aceitarConflito: conflitos !== null,
    };
    const r = c
      ? await chamarApi<{ alterados: number }>(`/v1/condominio/agenda/${c.id}`, { metodo: "PUT", corpo: { ...comuns, versao: c.versao, escopo: repete ? v.escopo : "ESTA" } })
      : await chamarApi<{ id: string; datas: number; conflitos: ConflitoCompromisso[] }>(
        daManutencao ? `/v1/condominio/manutencao/${daManutencao}/visita` : "/v1/condominio/agenda", { corpo: {
        ...comuns, data: v.data, estado: v.estado,
        repetir: v.repetir || null,
        intervalo: v.repetir === "MENSAL" ? Number(v.intervalo) || null : null,
        vezes: v.repetir && v.fim === "VEZES" ? Number(v.vezes) || null : null,
        ate: v.repetir && v.fim === "ATE" ? v.ate || null : null,
      } });
    setEnviando(false);
    if (!r.ok) {
      const lista = r.erro.detalhes?.conflitos;
      if (r.erro.detalhes?.motivo === "CONFLITO_HORARIO" && Array.isArray(lista)) return setConflitos(lista as ConflitoCompromisso[]);
      return setErro(r.erro);
    }
    if (c) {
      const n = (r.dados as { alterados: number }).alterados;
      return salvo(c.id, n > 1 ? `Compromisso alterado em ${n} datas.` : "Compromisso alterado.");
    }
    const d = r.dados as { id: string; datas: number };
    salvo(d.id, d.datas > 1 ? `Compromisso marcado em ${d.datas} datas.` : "Compromisso marcado.");
  }

  const comErro = camposComErro(erro);
  const msg = (campo: string, texto: string) => (comErro.includes(campo) ? texto : null);
  const lugares = opcoesDe(LUGARES_COMPROMISSO) as { valor: LugarCompromisso; texto: string }[];

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar ? () => { aoFechar(); recarregar(); } : undefined} /> : null}
      <Escolha rotulo="Tipo do compromisso" atual={v.tipo} aoMudar={(x) => mudar({ tipo: x })}
        opcoes={opcoesDe(TIPOS_COMPROMISSO) as { valor: TipoCompromisso; texto: string }[]} />
      <CampoTexto id="ag-titulo" rotulo="Título" required maxLength={120} value={v.titulo} erro={msg("titulo", "Título de 3 a 120 caracteres.")}
        onChange={(e) => mudar({ titulo: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-3">
        {c ? null : (
          <CampoTexto id="ag-data" rotulo="Data" type="date" required value={v.data} erro={msg("data", "Uma data entre um ano atrás e dois anos à frente.")}
            onChange={(e) => mudar({ data: e.target.value })} />
        )}
        <CampoTexto id="ag-inicio" rotulo="Começa" type="time" value={v.horaInicio} disabled={v.diaTodo} onChange={(e) => mudar({ horaInicio: e.target.value })} />
        <CampoTexto id="ag-fim" rotulo="Termina" type="time" opcional value={v.horaFim} disabled={v.diaTodo} erro={msg("horaFim", "O fim vem depois do início.")}
          onChange={(e) => mudar({ horaFim: e.target.value })} />
      </div>
      <Caixa id="ag-dia-todo" rotulo="Dia todo" ajuda="Sem horário: a data aparece como foi escrita." marcada={v.diaTodo} aoMudar={(x) => mudar({ diaTodo: x })} />
      {c ? <p className="text-xs text-tinta-suave">Para mudar a data, use Reagendar: o motivo fica no histórico.</p> : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium">Onde</legend>
        <Escolha rotulo="Onde acontece" atual={v.onde} aoMudar={(x) => mudar({ onde: x })} opcoes={lugares} />
        {v.onde === "UNIDADE" ? (
          <CampoSelecao id="ag-unidade" rotulo="Unidade" value={v.unidadeId} erro={msg("unidadeId", "Escolha a unidade.")}
            onChange={(e) => mudar({ unidadeId: e.target.value })}
            opcoes={[{ valor: "", texto: "Escolha a unidade" }, ...opcoes.unidades.map((u) => ({ valor: u.id, texto: u.nome }))]} />
        ) : null}
        {v.onde === "AREA_COMUM" || v.onde === "OUTRO" ? (
          <CampoTexto id="ag-local" rotulo={v.onde === "AREA_COMUM" ? "Qual área" : "Qual lugar"} maxLength={120} value={v.local}
            ajuda={v.onde === "AREA_COMUM" ? "Ex.: salão de festas, cobertura, garagem." : undefined}
            erro={msg("local", "Diga onde, de 2 a 120 caracteres.")} onChange={(e) => mudar({ local: e.target.value })} />
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-medium">Quem participa <span className="font-normal text-tinta-suave">(opcional)</span></legend>
        {opcoes.pessoas.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {opcoes.pessoas.map((p) => (
              <Caixa key={p.vinculoId} id={`ag-p-${p.vinculoId}`} rotulo={p.eu ? `${p.nome} (você)` : p.nome} marcada={v.participantes.includes(p.vinculoId)}
                aoMudar={(x) => mudar({ participantes: x ? [...v.participantes, p.vinculoId] : v.participantes.filter((y) => y !== p.vinculoId) })} />
            ))}
          </div>
        ) : null}
        {comErro.includes("participantes") ? <span className="text-xs text-erro">Só pessoas com acesso ao condomínio, até 30.</span> : null}
        <CampoTexto id="ag-de-fora" rotulo="Quem é de fora" opcional maxLength={200} value={v.deFora}
          ajuda="Prestador, empresa ou convidado, por escrito. Não entra na conta de conflito." erro={msg("deFora", "De 2 a 200 caracteres.")}
          onChange={(e) => mudar({ deFora: e.target.value })} />
      </fieldset>

      {daManutencao ? <p className="text-xs text-tinta-suave">A visita fica ligada à manutenção (e ao pedido dela). Cancelar a visita não apaga a manutenção.</p> : null}
      {!daManutencao && (opcoes.pedidos.length || v.pedidoId) ? (
        <CampoSelecao id="ag-pedido" rotulo="Pedido ligado" opcional value={v.pedidoId} erro={msg("pedidoId", "Pedido não encontrado.")}
          ajuda="Ligar não muda o próximo retorno nem a previsão do pedido."
          onChange={(e) => mudar({ pedidoId: e.target.value })}
          opcoes={[{ valor: "", texto: "Nenhum" },
            ...(c?.pedido && !opcoes.pedidos.some((p) => p.id === c.pedido!.id) ? [{ valor: c.pedido.id, texto: `${c.pedido.protocolo} · ${c.pedido.assunto}` }] : []),
            ...opcoes.pedidos.map((p) => ({ valor: p.id, texto: `${p.protocolo} · ${p.assunto}` }))]} />
      ) : null}

      {c ? null : (
        <>
          {daManutencao ? null : <CampoSelecao id="ag-repetir" rotulo="Repetir" value={v.repetir} erro={msg("repetir", "Escolha a repetição.")}
            onChange={(e) => mudar({ repetir: e.target.value })}
            opcoes={[{ valor: "", texto: "Não repete" }, ...opcoesDe(REPETICOES)]} />}
          {v.repetir ? (
            <div className="grid gap-3 rounded-2xl border border-linha p-3">
              {v.repetir === "MENSAL" ? (
                <CampoTexto id="ag-intervalo" rotulo="A cada quantos meses" type="number" min={1} max={12} value={v.intervalo}
                  erro={msg("intervalo", "De 1 a 12 meses.")} onChange={(e) => mudar({ intervalo: e.target.value })} />
              ) : null}
              <Escolha rotulo="Até quando repete" atual={v.fim} aoMudar={(x) => mudar({ fim: x })}
                opcoes={[{ valor: "VEZES", texto: "Por um número de vezes" }, { valor: "ATE", texto: "Até uma data" }]} />
              {v.fim === "VEZES" ? (
                <CampoTexto id="ag-vezes" rotulo="Quantas vezes, contando a primeira" type="number" min={2} max={104} value={v.vezes}
                  erro={msg("vezes", "De 2 a 104 vezes.")} onChange={(e) => mudar({ vezes: e.target.value })} />
              ) : (
                <CampoTexto id="ag-ate" rotulo="Repete até" type="date" value={v.ate}
                  erro={msg("ate", "Depois da primeira data e em até 2 anos.")} onChange={(e) => mudar({ ate: e.target.value })} />
              )}
              <p className="text-xs text-tinta-suave">No máximo 2 anos. No mês sem o dia (31), fica o último dia do mês.</p>
            </div>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-medium">Situação</legend>
            <Escolha rotulo="Situação inicial" atual={v.estado} aoMudar={(x) => mudar({ estado: x })}
              opcoes={(["PLANEJADO", "A_CONFIRMAR", "CONFIRMADO"] as const).map((x) => ({ valor: x, texto: SITUACOES_COMPROMISSO[x] }))} />
          </fieldset>
        </>
      )}

      <CampoAreaTexto id="ag-observacao" rotulo="Observação" opcional maxLength={1000} value={v.observacao}
        erro={msg("observacao", "Até 1000 caracteres.")} onChange={(e) => mudar({ observacao: e.target.value })} />

      {repete ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-medium">Este compromisso se repete</legend>
          <Escolha rotulo="Vale para" atual={v.escopo} aoMudar={(x) => mudar({ escopo: x })} opcoes={opcoesDe(ESCOPOS)} />
          <p className="text-xs text-tinta-suave">As datas que já passaram não mudam.</p>
        </fieldset>
      ) : null}

      {conflitos ? (
        <Aviso tom="atencao" titulo="Conflita com outro compromisso">
          <ListaConflitos conflitos={conflitos} />
          <span className="mt-1 block">Dá para salvar mesmo assim.</span>
        </Aviso>
      ) : null}

      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : conflitos ? "Salvar mesmo assim" : c ? "Salvar alterações" : "Salvar compromisso"}</Botao>
      </div>
    </form>
  );
}
