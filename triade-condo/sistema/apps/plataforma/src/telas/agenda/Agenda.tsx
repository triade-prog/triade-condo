"use client";
// Agenda do condomínio (peça R7, design "Telas da Agenda", telas 1 e 2; AG-01 a AG-05, AG-09):
// em lista, por semana ou no mês, com filtro por tipo e as datas de outras telas (feriados).
// A vista e a data ficam no endereço; o filtro de tipo e os feriados ficam guardados para a
// pessoa neste aparelho.

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  diaDaSemana, gradeDoMes, inicioDaSemana, inicioDoMes, mesVizinho, mostrarDataCurta, nomeDoMesAno, somarDias, TIPOS_COMPROMISSO,
} from "@triade/domain";
import { Aviso, Botao, Carregando, CampoSelecao, Chip, ErroCarregar, Icone, Vazio } from "@triade/ui";
import { Escolha } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Agenda as DadosAgenda, CompromissoAgenda, DataDeOutraTela, OpcoesAgenda, Recado } from "../tipos.ts";
import { LinhaCompromisso, LinhaDataDeFora } from "./comum.tsx";
import { FormCompromisso } from "./FormCompromisso.tsx";

type Vista = "LISTA" | "SEMANA" | "MES";
const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: "LISTA", texto: "Lista" }, { valor: "SEMANA", texto: "Semana" }, { valor: "MES", texto: "Mês" },
];
const DIAS_LISTA = 31;
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const GUARDA = "triade.agenda.filtro";

/** Hoje no fuso de Brasília, até a API dizer o dia do condomínio. */
function hojeAqui(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function periodo(vista: Vista, data: string): { de: string; ate: string } {
  if (vista === "SEMANA") { const de = inicioDaSemana(data); return { de, ate: somarDias(de, 6) }; }
  if (vista === "MES") { const g = gradeDoMes(data); return { de: g[0]!.data, ate: g[g.length - 1]!.data }; }
  return { de: data, ate: somarDias(data, DIAS_LISTA - 1) };
}

type Filtro = { tipo: string; feriados: boolean };

function interpretar(texto: string): Filtro {
  try {
    const v = JSON.parse(texto || "null") as { tipo?: string; feriados?: boolean } | null;
    return { tipo: v?.tipo && v.tipo in TIPOS_COMPROMISSO ? v.tipo : "", feriados: v?.feriados !== false };
  } catch {
    return { tipo: "", feriados: true };
  }
}

function lerGuardado(): string {
  try { return localStorage.getItem(GUARDA) ?? ""; } catch { return ""; }
}

function assinar(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  return () => window.removeEventListener("storage", avisar);
}

function guardar(v: Filtro) {
  try { localStorage.setItem(GUARDA, JSON.stringify(v)); } catch { /* sem guardar: o filtro vale só agora */ }
}

/** Os dias do período com o que há neles, em ordem. */
function porDia(compromissos: CompromissoAgenda[], datas: DataDeOutraTela[]) {
  const dias = new Map<string, { compromissos: CompromissoAgenda[]; datas: DataDeOutraTela[] }>();
  const dia = (d: string) => dias.get(d) ?? (dias.set(d, { compromissos: [], datas: [] }), dias.get(d)!);
  for (const d of datas) dia(d.data).datas.push(d);
  for (const c of compromissos) dia(c.data).compromissos.push(c);
  return dias;
}

const DIA_MES = (d: string) => `${Number(d.slice(8))} de ${nomeDoMesAno(d).split(" de ")[0]}`;

export function Agenda() {
  const router = useRouter();
  const busca = useSearchParams();
  const vista: Vista = (["LISTA", "SEMANA", "MES"] as const).find((x) => x === busca.get("vista")) ?? "LISTA";
  const dataUrl = busca.get("data");
  const data = dataUrl && /^\d{4}-\d{2}-\d{2}$/.test(dataUrl) ? dataUrl : hojeAqui();
  const { de, ate } = periodo(vista, data);
  const carga = useCarregar<DadosAgenda>(`/v1/condominio/agenda?de=${de}&ate=${ate}`);
  const opcoes = useCarregar<OpcoesAgenda>("/v1/condominio/agenda/opcoes");
  const guardado = useSyncExternalStore(assinar, lerGuardado, () => "");
  const [escolhido, setEscolhido] = useState<Filtro | null>(null);
  const filtro = escolhido ?? interpretar(guardado);
  const [novo, setNovo] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);

  const ir = (m: { vista?: Vista; data?: string | null }) => {
    const q = new URLSearchParams();
    const v = m.vista ?? vista;
    if (v !== "LISTA") q.set("vista", v);
    const d = m.data === undefined ? dataUrl : m.data;
    if (d) q.set("data", d);
    router.replace(`/agenda${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };
  const mudarFiltro = (m: Partial<Filtro>) => { const f = { ...filtro, ...m }; setEscolhido(f); guardar(f); };

  const dados = carga.estado === "pronto" ? carga.dados : null;
  const hoje = dados?.hoje ?? hojeAqui();
  const visiveis = useMemo(() => (dados ? dados.compromissos.filter((c) => !filtro.tipo || c.tipo === filtro.tipo) : []), [dados, filtro.tipo]);
  const datas = dados && filtro.feriados ? dados.datas : [];
  const dias = porDia(visiveis, datas);
  const podeEditar = (dados?.pode.editar ?? false) && opcoes.estado === "pronto" && opcoes.dados.pode.editar;

  const passo = vista === "MES" ? null : vista === "SEMANA" ? 7 : DIAS_LISTA;
  const anterior = passo ? somarDias(vista === "SEMANA" ? inicioDaSemana(data) : data, -passo) : mesVizinho(data, -1);
  const seguinte = passo ? somarDias(vista === "SEMANA" ? inicioDaSemana(data) : data, passo) : mesVizinho(data, 1);
  const titulo = vista === "MES" ? nomeDoMesAno(inicioDoMes(data)) : `${mostrarDataCurta(de)} a ${mostrarDataCurta(ate)}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Agenda</h1>
          <p className="text-sm text-tinta-suave">Reuniões, visitas técnicas, atividades e lembretes do condomínio.</p>
        </div>
        {podeEditar ? <Botao onClick={() => setNovo(true)}>+ Novo compromisso</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Escolha rotulo="Como ver a agenda" atual={vista} aoMudar={(x) => ir({ vista: x })} opcoes={VISTAS} />
        <CampoSelecao id="ag-filtro-tipo" rotulo="Tipo" className="min-w-48" value={filtro.tipo} onChange={(e) => mudarFiltro({ tipo: e.target.value })}
          opcoes={[{ valor: "", texto: "Todos" }, ...Object.entries(TIPOS_COMPROMISSO).map(([valor, texto]) => ({ valor, texto }))]} />
        <Chip icone="calendario" ativo={filtro.feriados} onClick={() => mudarFiltro({ feriados: !filtro.feriados })}>Feriados e datas de outras telas</Chip>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium first-letter:uppercase">{titulo}</h2>
        <div className="flex items-center gap-1.5">
          <Botao variante="contorno" tamanho="m" soIcone aria-label="Período anterior" onClick={() => ir({ data: anterior })}><Icone nome="esq" /></Botao>
          <Botao variante="secundario" tamanho="m" onClick={() => ir({ data: null })}>Hoje</Botao>
          <Botao variante="contorno" tamanho="m" soIcone aria-label="Período seguinte" onClick={() => ir({ data: seguinte })}><Icone nome="dir" /></Botao>
        </div>
      </div>

      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a agenda…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {dados && vista === "LISTA" ? <VistaLista dias={dias} hoje={hoje} temFiltro={Boolean(filtro.tipo)} /> : null}
      {dados && vista === "SEMANA" ? <VistaSemana de={de} dias={dias} hoje={hoje} abrirDia={(d) => ir({ vista: "LISTA", data: d })} /> : null}
      {dados && vista === "MES" ? <VistaMes data={data} dias={dias} hoje={hoje} abrirDia={(d) => ir({ vista: "LISTA", data: d })} /> : null}

      {opcoes.estado === "pronto" ? (
        <FormCompromisso aberto={novo} opcoes={opcoes.dados} aoFechar={() => setNovo(false)}
          salvo={(_, texto) => { setNovo(false); setRecado({ tom: "ok", texto }); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}

type Dias = ReturnType<typeof porDia>;

function VistaLista({ dias, hoje, temFiltro }: { dias: Dias; hoje: string; temFiltro: boolean }) {
  const ordem = [...dias.keys()].sort();
  if (ordem.length === 0) {
    return <Vazio titulo="Nada marcado neste período">{temFiltro ? "Nada deste tipo. Tire o filtro para ver tudo." : "Os compromissos marcados aparecem aqui, por dia."}</Vazio>;
  }
  return (
    <div className="rounded-[18px] border border-linha bg-superficie px-4 shadow-s1">
      {ordem.map((d, i) => {
        const dia = dias.get(d)!;
        const novoMes = i === 0 || d.slice(0, 7) !== ordem[i - 1]!.slice(0, 7);
        return (
          <section key={d} className="ag-dia" aria-label={`${diaDaSemana(d)}, ${DIA_MES(d)}${d === hoje ? ", hoje" : ""}`}>
            <div className="data">
              <b>{Number(d.slice(8))}</b>
              <span>{diaDaSemana(d)}{novoMes ? `, ${nomeDoMesAno(d).split(" de ")[0]}` : ""}</span>
              {d === hoje ? <span className="ag-hoje block w-fit">Hoje</span> : null}
            </div>
            <ul className="grid gap-2">
              {dia.datas.map((x) => <LinhaDataDeFora key={`f-${x.titulo}`} d={x} />)}
              {dia.compromissos.map((c) => <LinhaCompromisso key={c.id} c={c} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** O resto do nome do dia, depois do número que aparece: " de outubro, sábado, hoje: 2 itens. Abrir a lista do dia". */
function restoDoDia(d: string, qtd: number, hoje: string): string {
  const quanto = qtd === 0 ? "nada marcado" : qtd === 1 ? "1 item" : `${qtd} itens`;
  return ` de ${nomeDoMesAno(d).split(" de ")[0]}, ${diaDaSemana(d)}${d === hoje ? ", hoje" : ""}: ${quanto}. Abrir a lista do dia`;
}

function VistaSemana({ de, dias, hoje, abrirDia }: { de: string; dias: Dias; hoje: string; abrirDia: (d: string) => void }) {
  return (
    <ol className="grid gap-2 md:grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => somarDias(de, i)).map((d) => {
        const dia = dias.get(d);
        const itens = [...(dia?.datas ?? []).map((x) => ({ chave: `f-${x.titulo}`, hora: "", titulo: x.titulo, tipo: "FERIADO", fonte: true })),
          ...(dia?.compromissos ?? []).map((c) => ({ chave: c.id, hora: c.horaInicio ?? "", titulo: c.titulo, tipo: c.tipo as string, fonte: false }))];
        return (
          <li key={d} className="grid content-start gap-1.5 rounded-2xl border border-linha bg-superficie p-2.5">
            <button type="button" onClick={() => abrirDia(d)} aria-current={d === hoje ? "date" : undefined}
              className="flex items-baseline gap-1.5 rounded-lg text-left text-sm hover:text-violeta-600">
              <span className={`grid h-7 w-7 place-items-center rounded-full font-medium ${d === hoje ? "bg-violeta-600 text-white" : ""}`}>{Number(d.slice(8))}</span>
              <span className="text-tinta-suave" aria-hidden="true">{SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
              <span className="sr-only">{restoDoDia(d, itens.length, hoje)}</span>
            </button>
            {itens.length === 0 ? <span className="text-xs text-tinta-suave">Nada marcado</span> : null}
            <ul className="grid gap-1">
              {itens.map((x) => (
                <li key={x.chave} data-tipo={x.tipo} className="tp block truncate text-[12.5px] font-normal text-tinta">
                  {x.hora ? `${x.hora} ` : ""}{x.titulo}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function VistaMes({ data, dias, hoje, abrirDia }: { data: string; dias: Dias; hoje: string; abrirDia: (d: string) => void }) {
  return (
    <div className="ag-cal">
      <div className="sem" aria-hidden="true">{SEMANA.map((s) => <span key={s}>{s}</span>)}</div>
      <div className="grade">
        {gradeDoMes(data).map(({ data: d, doMes }) => {
          const dia = dias.get(d);
          const itens = [...(dia?.datas ?? []).map((x) => ({ chave: `f-${x.titulo}`, texto: x.titulo, tipo: "FERIADO", fonte: true })),
            ...(dia?.compromissos ?? []).map((c) => ({ chave: c.id, texto: `${c.horaInicio ? `${Number(c.horaInicio.slice(0, 2))}h ` : ""}${c.titulo}`, tipo: c.tipo as string, fonte: false }))];
          return (
            <button key={d} type="button" className="c" data-fora={doMes ? undefined : ""} aria-current={d === hoje ? "date" : undefined}
              onClick={() => abrirDia(d)}>
              <span className="n">{Number(d.slice(8))}<span className="sr-only">{restoDoDia(d, itens.length, hoje)}</span></span>
              {itens.slice(0, 2).map((x) => (
                <span key={x.chave} className="p" data-tipo={x.tipo} data-fonte={x.fonte ? "" : undefined} aria-hidden="true">{x.texto}</span>
              ))}
              {itens.length > 2 ? <span className="mais" aria-hidden="true">+{itens.length - 2}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="border-t border-linha px-3 py-2 text-xs text-tinta-suave">Clique no dia para ver a lista daquele dia.</p>
    </div>
  );
}
