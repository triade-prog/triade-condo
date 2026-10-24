"use client";
// Agenda do condomínio (peça R7; AG-01 a AG-05, AG-09; DC15, telas-modelo agenda-computador e
// agenda-celular): em lista, por semana ou no mês, com as datas de outras telas (feriados,
// preventivas, reservas confirmadas, vencimentos de contratos e documentos, assembleias
// convocadas e enquetes abertas, no dia em que fecham), cada origem com a sua cor. Na Lista, a
// faixa "Enquetes abertas agora" fica no alto (R7.2). "Mostrar" liga e desliga cada origem; o tipo do
// compromisso fica em Filtros. No celular, uma faixa com os dias da semana fica no alto, o
// "Mostrar" vai para Filtros e o "Novo compromisso" flutua sobre a barra de baixo. A vista e a
// data ficam no endereço; o filtro fica guardado para a pessoa neste aparelho.

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  diaDaSemana, FONTES_AGENDA, type FonteAgenda, gradeDoMes, inicioDaSemana, inicioDoMes, mesVizinho, mostrarDataCurta, nomeDoMesAno, somarDias, TIPOS_COMPROMISSO,
} from "@triade/domain";
import { Aviso, Botao, Carregando, CampoSelecao, Chip, Dialogo, ErroCarregar, Icone, type NomeIcone, Vazio } from "@triade/ui";
import { useCelular } from "../celular.ts";
import { useCarregar } from "../sessao.tsx";
import type { Agenda as DadosAgenda, CompromissoAgenda, DataDeOutraTela, OpcoesAgenda, Recado } from "../tipos.ts";
import { EnquetesAbertas, LinhaCompromisso, LinhaDataDeFora, tituloCurto } from "./comum.tsx";
import { FormCompromisso } from "./FormCompromisso.tsx";

type Vista = "LISTA" | "SEMANA" | "MES";
const VISTAS: { valor: Vista; texto: string; icone?: NomeIcone }[] = [
  { valor: "LISTA", texto: "Lista", icone: "lista" }, { valor: "SEMANA", texto: "Semana" }, { valor: "MES", texto: "Mês", icone: "calendario" },
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

const FONTES = Object.keys(FONTES_AGENDA) as FonteAgenda[];
/** A ordem do "Mostrar": o que a gestão marca primeiro, os feriados por último. */
const ORDEM_MOSTRAR: FonteAgenda[] = ["PREVENTIVA", "RESERVA", "CONTRATO", "DOCUMENTO", "ASSEMBLEIA", "ENQUETE", "FERIADO"];

const PADRAO_OCULTAS: FonteAgenda[] = ["FERIADO"];
/** Quantas origens a pessoa desligou além do que já vem desligado. */
const desligadas = (ocultas: FonteAgenda[]) => ocultas.filter((f) => !PADRAO_OCULTAS.includes(f)).length;

/** O que aparece: o tipo de compromisso, os compromissos e as fontes desligadas (decisão 4). */
type Filtro = { tipo: string; compromissos: boolean; ocultas: FonteAgenda[] };

function interpretar(texto: string): Filtro {
  try {
    const v = JSON.parse(texto || "null") as { tipo?: string; feriados?: boolean; compromissos?: boolean; ocultas?: unknown } | null;
    // O filtro antigo desligava todas as datas de outras telas de uma vez.
    // Sem nada guardado, os feriados começam desligados (desenho aprovado da agenda, DC15).
    const ocultas = Array.isArray(v?.ocultas) ? FONTES.filter((f) => (v.ocultas as unknown[]).includes(f)) : v?.feriados === false ? FONTES : v ? [] : [...PADRAO_OCULTAS];
    return { tipo: v?.tipo && v.tipo in TIPOS_COMPROMISSO ? v.tipo : "", compromissos: v?.compromissos !== false, ocultas };
  } catch {
    return { tipo: "", compromissos: true, ocultas: [...PADRAO_OCULTAS] };
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

const MES = (d: string) => nomeDoMesAno(d).split(" de ")[0]!;
const DIA_MES = (d: string) => `${Number(d.slice(8))} de ${MES(d)}`;
const DD_MM = (d: string) => mostrarDataCurta(d).slice(0, 5);

/** "21/10 a 20/11/2026"; o ano só no fim quando os dois dias são do mesmo ano. */
function textoPeriodo(de: string, ate: string): string {
  return `${de.slice(0, 4) === ate.slice(0, 4) ? DD_MM(de) : mostrarDataCurta(de)} a ${mostrarDataCurta(ate)}`;
}

function ChipFonte({ tipo, ativo, aoMudar, children }: { tipo: string; ativo: boolean; aoMudar: () => void; children: string }) {
  return (
    <button type="button" className="chip ag-fonte" data-tipo={tipo} aria-pressed={ativo} onClick={aoMudar}>
      <span className="ponto" aria-hidden="true" />{children}
    </button>
  );
}

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
  const filtroGuardado = escolhido ?? interpretar(guardado);
  // Enquetes só para quem vê as enquetes (R7.2): sem isso, nem o filtro aparece nem conta como desligado.
  const veEnquetes = carga.estado === "pronto" && (carga.dados.pode.enquetes ?? false);
  const filtro = veEnquetes ? filtroGuardado : { ...filtroGuardado, ocultas: filtroGuardado.ocultas.filter((f) => f !== "ENQUETE") };
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
  const visiveis = useMemo(() => (dados && filtro.compromissos ? dados.compromissos.filter((c) => !filtro.tipo || c.tipo === filtro.tipo) : []),
    [dados, filtro.tipo, filtro.compromissos]);
  const datas = dados ? dados.datas.filter((d) => !filtro.ocultas.includes(d.fonte)) : [];
  const alternar = (f: FonteAgenda) =>
    mudarFiltro({ ocultas: filtro.ocultas.includes(f) ? filtro.ocultas.filter((x) => x !== f) : [...filtro.ocultas, f] });
  const dias = porDia(visiveis, datas);
  const abertas = dados && vista === "LISTA" && veEnquetes && !filtro.ocultas.includes("ENQUETE") && de <= hoje && hoje <= ate
    ? dados.enquetesAbertas ?? [] : [];
  const podeEditar = (dados?.pode.editar ?? false) && opcoes.estado === "pronto" && opcoes.dados.pode.editar;

  const celular = useCelular();
  const [filtrando, setFiltrando] = useState(false);
  const passo = vista === "MES" ? null : vista === "SEMANA" ? 7 : DIAS_LISTA;
  const anterior = passo ? somarDias(vista === "SEMANA" ? inicioDaSemana(data) : data, -passo) : mesVizinho(data, -1);
  const seguinte = passo ? somarDias(vista === "SEMANA" ? inicioDaSemana(data) : data, passo) : mesVizinho(data, 1);
  const titulo = vista === "MES" ? nomeDoMesAno(inicioDoMes(data)) : textoPeriodo(de, ate);
  // No computador o "Mostrar" fica à vista; no celular entra em Filtros e conta como filtro em uso.
  const emUso = (filtro.tipo ? 1 : 0) + (celular ? (filtro.compromissos ? 0 : 1) + desligadas(filtro.ocultas) : 0);

  const mostrar = (
    <div role="group" aria-label="O que mostrar na agenda" className="flex flex-wrap items-center gap-2">
      <span className="t-apoio mr-1" aria-hidden="true">Mostrar</span>
      <ChipFonte tipo="COMPROMISSO" ativo={filtro.compromissos} aoMudar={() => mudarFiltro({ compromissos: !filtro.compromissos })}>Compromissos</ChipFonte>
      {ORDEM_MOSTRAR.filter((f) => f !== "ENQUETE" || veEnquetes).map((f) => <ChipFonte key={f} tipo={f} ativo={!filtro.ocultas.includes(f)} aoMudar={() => alternar(f)}>{FONTES_AGENDA[f]}</ChipFonte>)}
    </div>
  );
  const botaoFiltros = (
    <Botao variante="contorno" tamanho="m" className={celular ? "w-11 px-0" : ""} onClick={() => setFiltrando(true)}>
      <Icone nome="filtro" /><span className={celular ? "sr-only" : ""}>Filtros{emUso ? ` · ${emUso}` : ""}</span>
    </Botao>
  );
  const novoCompromisso = <Botao onClick={() => setNovo(true)}><Icone nome="mais" />Novo compromisso</Botao>;

  return (
    <div className="grid gap-5 max-md:gap-4 max-md:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Agenda</h1>
          <p className="t-apoio mt-1 max-md:hidden">Reuniões, visitas, preventivas, reservas, vencimentos e votações do condomínio num lugar só.</p>
        </div>
        {podeEditar ? <div className="max-md:hidden">{novoCompromisso}</div> : null}
        {celular ? botaoFiltros : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {celular && vista === "LISTA" ? <FaixaDaSemana data={data} hoje={hoje} dias={dias} ir={(d) => ir({ data: d === hoje ? null : d })} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 max-md:w-full">
          <div role="group" aria-label="Como ver a agenda" className="trilho max-md:flex max-md:w-full">
            {VISTAS.map((x) => (
              <Chip key={x.valor} icone={x.icone} ativo={vista === x.valor} className="max-md:flex-1 max-md:justify-center" onClick={() => ir({ vista: x.valor })}>{x.texto}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Botao variante="contorno" tamanho="m" soIcone aria-label="Período anterior" onClick={() => ir({ data: anterior })}><Icone nome="esq" /></Botao>
            <Botao variante="contorno" tamanho="m" onClick={() => ir({ data: null })}>Hoje</Botao>
            <Botao variante="contorno" tamanho="m" soIcone aria-label="Período seguinte" onClick={() => ir({ data: seguinte })}><Icone nome="dir" /></Botao>
          </div>
          <h2 className="t-titulo-secao font-semibold first-letter:uppercase">{titulo}</h2>
        </div>
        {celular ? null : botaoFiltros}
      </div>
      {celular ? null : mostrar}

      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a agenda…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {dados && abertas.length ? <EnquetesAbertas enquetes={abertas} hoje={hoje} /> : null}
      {dados && vista === "LISTA" ? <VistaLista dias={dias} hoje={hoje} temFiltro={Boolean(filtro.tipo) || !filtro.compromissos || desligadas(filtro.ocultas) > 0} /> : null}
      {dados && vista === "SEMANA" ? <VistaSemana de={de} dias={dias} hoje={hoje} abrirDia={(d) => ir({ vista: "LISTA", data: d })} /> : null}
      {dados && vista === "MES" ? <VistaMes data={data} dias={dias} hoje={hoje} abrirDia={(d) => ir({ vista: "LISTA", data: d })} /> : null}

      {podeEditar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{novoCompromisso}</div> : null}

      <Dialogo aberto={filtrando} titulo="Filtrar a agenda" aoFechar={() => setFiltrando(false)}>
        <div className="grid gap-4">
          {celular ? mostrar : null}
          <CampoSelecao id="ag-filtro-tipo" rotulo="Tipo do compromisso" value={filtro.tipo} onChange={(e) => mudarFiltro({ tipo: e.target.value })}
            opcoes={[{ valor: "", texto: "Todos" }, ...Object.entries(TIPOS_COMPROMISSO).map(([valor, texto]) => ({ valor, texto }))]} />
          <div className="flex justify-end gap-2">
            {emUso ? (
              <Botao variante="discreto" onClick={() => mudarFiltro(celular ? { tipo: "", compromissos: true, ocultas: [...PADRAO_OCULTAS] } : { tipo: "" })}>Tirar filtros</Botao>
            ) : null}
            <Botao onClick={() => setFiltrando(false)}>Pronto</Botao>
          </div>
        </div>
      </Dialogo>

      {opcoes.estado === "pronto" ? (
        <FormCompromisso aberto={novo} opcoes={opcoes.dados} aoFechar={() => setNovo(false)}
          salvo={(_, texto) => { setNovo(false); setRecado({ tom: "ok", texto }); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}

/** Celular: os sete dias da semana; o toque leva a lista para aquele dia. */
function FaixaDaSemana({ data, hoje, dias, ir }: { data: string; hoje: string; dias: Dias; ir: (d: string) => void }) {
  const de = inicioDaSemana(data);
  return (
    <div role="group" aria-label="Dias da semana" className="ag-faixa rounded-[18px] border border-linha bg-superficie p-1.5 shadow-s1">
      {Array.from({ length: 7 }, (_, i) => somarDias(de, i)).map((d, i) => {
        const tem = (dias.get(d)?.compromissos.length ?? 0) + (dias.get(d)?.datas.length ?? 0) > 0;
        return (
          <button key={d} type="button" aria-pressed={d === data} aria-current={d === hoje ? "date" : undefined} onClick={() => ir(d)}>
            <span aria-hidden="true">{SEMANA[i]!.charAt(0).toUpperCase()}</span>
            <b>{Number(d.slice(8))}</b>
            <span className="sr-only">{` de ${MES(d)}, ${diaDaSemana(d)}${d === hoje ? ", hoje" : ""}${tem ? ", com o que ver" : ""}`}</span>
            {tem ? <i aria-hidden="true" /> : null}
          </button>
        );
      })}
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
    <div className="ag-lista">
      {ordem.map((d) => {
        const dia = dias.get(d)!;
        const eHoje = d === hoje;
        return (
          <section key={d} className="ag-dia" aria-label={`${diaDaSemana(d)}, ${DIA_MES(d)}${eHoje ? ", hoje" : ""}`}>
            <div className="data">
              <span className="dia" data-hoje={eHoje ? "" : undefined} aria-hidden="true"><b>{Number(d.slice(8))}</b><span>{MES(d).slice(0, 3)}</span></span>
              <span className="nome" data-hoje={eHoje ? "" : undefined}>
                <span>{diaDaSemana(d).replace(/^./, (x) => x.toUpperCase())}</span>
                {eHoje ? <span><span className="md:hidden"> · </span>hoje</span> : null}
                <span className="md:hidden"> · {DD_MM(d)}</span>
              </span>
            </div>
            <ul className="grid gap-2">
              {/* O dia todo primeiro e o resto pela hora, venha de onde vier (a enquete das 23:59 depois da reunião das 19:00). */}
              {[...dia.datas.map((x) => ({ hora: x.horaInicio ?? "", item: <LinhaDataDeFora key={`f-${x.fonte}-${x.id ?? x.titulo}`} d={x} hoje={hoje} /> })),
                ...dia.compromissos.map((c) => ({ hora: c.horaInicio ?? "", item: <LinhaCompromisso key={c.id} c={c} /> }))]
                .sort((a, b) => a.hora.localeCompare(b.hora)).map((x) => x.item)}
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
        const itens = [...(dia?.datas ?? []).map((x) => ({ chave: `f-${x.fonte}-${x.id ?? x.titulo}`, hora: x.horaInicio ?? "", titulo: tituloCurto(x), tipo: x.fonte, fonte: true })),
          ...(dia?.compromissos ?? []).map((c) => ({ chave: c.id, hora: c.horaInicio ?? "", titulo: c.titulo, tipo: c.tipo as string, fonte: false }))];
        return (
          <li key={d} className="grid content-start gap-1.5 rounded-2xl border border-linha bg-superficie p-2.5">
            <button type="button" onClick={() => abrirDia(d)} aria-current={d === hoje ? "date" : undefined}
              className="flex items-baseline gap-1.5 rounded-lg text-left t-texto hover:text-violeta-600">
              <span className={`grid h-7 w-7 place-items-center rounded-full font-medium ${d === hoje ? "bg-violeta-600 text-white" : ""}`}>{Number(d.slice(8))}</span>
              <span className="text-tinta-suave" aria-hidden="true">{SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
              <span className="sr-only">{restoDoDia(d, itens.length, hoje)}</span>
            </button>
            {itens.length === 0 ? <span className="t-apoio text-tinta-suave">Nada marcado</span> : null}
            <ul className="grid gap-1">
              {itens.map((x) => (
                <li key={x.chave} data-tipo={x.tipo} className="tp block truncate t-apoio font-normal text-tinta">
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
          const itens = [...(dia?.datas ?? []).map((x) => ({ chave: `f-${x.fonte}-${x.id ?? x.titulo}`, texto: `${x.horaInicio ? `${Number(x.horaInicio.slice(0, 2))}h ` : ""}${tituloCurto(x)}`, tipo: x.fonte as string, fonte: true })),
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
      <p className="border-t border-linha px-3 py-2 t-apoio text-tinta-suave">Clique no dia para ver a lista daquele dia.</p>
    </div>
  );
}
