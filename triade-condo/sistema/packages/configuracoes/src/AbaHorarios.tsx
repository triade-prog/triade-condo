"use client";
// Horários e fuso (CF-06, CF-10): funcionamento e atendimento, cada um com vários intervalos
// por dia. Madrugada vira dois intervalos; 24:00 vale. Fora do atendimento, o prazo para. Na
// página por tarefa (decisões A.1, B.1 e D.1): o trilho troca entre os dois sem perder o que foi
// digitado, um dia por cartão no celular, um começo rápido quando ainda não há horário, o Salvar
// na barra do rodapé e o fuso no bloco "Feito pela TRÍADE".

import { useState } from "react";
import { DIAS_SEMANA, FUSOS, intervalosSobrepostos, TIPOS_HORARIO, type Intervalo, type TipoHorario } from "@triade/domain";
import { AvisoErro, Botao, CampoTexto, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { PropsAba } from "./Configuracoes.tsx";
import { AjusteTecnico, BlocoTriade } from "./tecnica.tsx";
import { naBase } from "./contexto.tsx";
import { Escolha } from "./comum.tsx";
import { useParte } from "./salvar.tsx";

/** Segunda primeiro, domingo no fim. */
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const HORA = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

type Linha = { chave: number; dia: number; inicio: string; fim: string };

function problemas(linhas: Linha[]): string | null {
  if (linhas.some((l) => !HORA.test(l.inicio) || !HORA.test(l.fim) || l.inicio === "24:00")) return "Escreva as horas como 08:00. O fim pode ser 24:00.";
  if (linhas.some((l) => l.inicio >= l.fim)) return "Em cada intervalo, o início vem antes do fim. Madrugada vira dois intervalos (22:00 a 24:00 e 00:00 a 06:00).";
  if (intervalosSobrepostos(linhas)) return "Dois intervalos do mesmo dia se sobrepõem.";
  return null;
}

/** Cada dia como texto ("08:00-12:00 13:00-18:00"), para contar os dias que mudaram. */
function porDia(linhas: { dia: number; inicio: string; fim: string }[]): string[] {
  return ORDEM_DIAS.map((d) => linhas.filter((l) => l.dia === d).map((l) => `${l.inicio}-${l.fim}`).sort().join(" "));
}

/** Minutos de um "HH:MM" (24:00 vale 1440). */
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** "Seg a sex · 44 h por semana": o resumo do horário, também na entrada das Configurações. */
export function resumoHorario(intervalos: Intervalo[]): string | null {
  if (!intervalos.length) return null;
  const total = intervalos.reduce((s, i) => s + minutos(i.fim) - minutos(i.inicio), 0);
  const dias = ORDEM_DIAS.filter((d) => intervalos.some((i) => i.dia === d));
  const curto = (d: number) => DIAS_SEMANA[d]!.slice(0, 3).toLowerCase();
  const seguidos = dias.length > 2 && dias.every((d, k) => k === 0 || ORDEM_DIAS.indexOf(d) === ORDEM_DIAS.indexOf(dias[k - 1]!) + 1);
  const quais = seguidos ? `${curto(dias[0]!)} a ${curto(dias.at(-1)!)}` : dias.map(curto).join(", ");
  const h = Math.floor(total / 60), m = total % 60;
  return `${quais.charAt(0).toUpperCase()}${quais.slice(1)} · ${h} h${m ? ` ${m} min` : ""} por semana`;
}

const COMECOS = [
  { texto: "Seg a sex, das 8h às 18h", dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00" },
  { texto: "Seg a sáb, das 8h às 12h", dias: [1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "12:00" },
];

function Semana({ tipo, config, pode, recarregar, oculta }: PropsAba & { tipo: TipoHorario; oculta: boolean }) {
  const h = config.horarios[tipo];
  let seq = 0;
  const [linhas, setLinhas] = useState<Linha[]>(() => h.intervalos.map((i) => ({ chave: seq++, ...i })));
  const [diaADia, setDiaADia] = useState(false);
  const [proxima, setProxima] = useState(h.intervalos.length);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const nome = TIPOS_HORARIO[tipo].toLowerCase();

  function incluir(dia: number) {
    const doDia = linhas.filter((l) => l.dia === dia).sort((a, b) => a.fim.localeCompare(b.fim));
    const ultima = doDia.at(-1);
    const nova = ultima ? { inicio: ultima.fim === "24:00" ? "00:00" : ultima.fim, fim: "24:00" } : { inicio: "08:00", fim: "12:00" };
    setLinhas((l) => [...l, { chave: proxima, dia, ...nova }]);
    setProxima((n) => n + 1);
  }

  function mudar(chave: number, campo: "inicio" | "fim", valor: string) {
    setLinhas((l) => l.map((x) => (x.chave === chave ? { ...x, [campo]: valor } : x)));
  }

  function copiarSegunda() {
    const seg = linhas.filter((l) => l.dia === 1);
    let n = proxima;
    const copias = [2, 3, 4, 5].flatMap((dia) => seg.map((s) => ({ chave: n++, dia, inicio: s.inicio, fim: s.fim })));
    setLinhas((l) => [...l.filter((x) => x.dia < 2 || x.dia > 5), ...copias]);
    setProxima(n);
  }

  function comecar(c: (typeof COMECOS)[number]) {
    let n = proxima;
    setLinhas(c.dias.map((dia) => ({ chave: n++, dia, inicio: c.inicio, fim: c.fim })));
    setProxima(n);
  }

  async function salvar(): Promise<string | null> {
    setErro(null);
    const p = problemas(linhas);
    setAviso(p);
    if (p) return null;
    const intervalos: Intervalo[] = linhas.map(({ dia, inicio, fim }) => ({ dia, inicio, fim }));
    const r = await chamarApi(naBase(`/horarios/${tipo.toLowerCase()}`), { metodo: "PUT", corpo: { versao: h.versao, intervalos } });
    if (!r.ok) { setErro(r.erro); return null; }
    return `Horário de ${nome} salvo.`;
  }

  const antes = porDia(h.intervalos);
  const mudancas = porDia(linhas).filter((d, k) => d !== antes[k]).length;
  useParte(`horario-${tipo}`, { nome: `Horário de ${nome}`, mudancas, salvar });
  const temSegunda = linhas.some((l) => l.dia === 1);
  const resumo = resumoHorario(linhas);

  if (pode && linhas.length === 0 && !diaADia && h.intervalos.length === 0) {
    return (
      <section aria-labelledby={`t-vazio-${tipo}`} hidden={oculta} className="grid justify-items-start gap-3 rounded-[18px] border border-linha bg-superficie p-6 shadow-s1">
        <h2 id={`t-vazio-${tipo}`} className="text-lg font-medium">Ainda sem horário de {nome}</h2>
        <p className="max-w-2xl text-sm">
          {tipo === "ATENDIMENTO" ? "Sem ele, os prazos contam em horas corridas, de dia e de noite. " : ""}Comece por um horário comum e ajuste os dias depois.
        </p>
        <div className="flex flex-wrap gap-2">
          {COMECOS.map((c) => <Botao key={c.texto} variante="contorno" onClick={() => comecar(c)}>{c.texto}</Botao>)}
          <Botao variante="discreto" onClick={() => setDiaADia(true)}>Montar dia a dia</Botao>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={`Horário de ${nome}`} hidden={oculta} className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      {aviso ? <p role="alert" className="text-sm text-erro">{aviso}</p> : null}
      <div className="overflow-hidden rounded-[18px] border border-linha bg-superficie shadow-s1">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha px-4 py-3 sm:px-5">
          <h2 className="font-medium">Horário de {nome}</h2>
          {pode && temSegunda ? <Botao variante="discreto" tamanho="m" onClick={copiarSegunda}>Copiar segunda para terça a sexta</Botao> : null}
        </div>
        <ul className="divide-y divide-linha">
          {ORDEM_DIAS.map((dia) => {
            const doDia = linhas.filter((l) => l.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
            return (
              <li key={dia} aria-label={DIAS_SEMANA[dia]} className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center sm:px-5">
                <span className="font-medium">{DIAS_SEMANA[dia]}</span>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  {doDia.length === 0 ? <span className="text-sm text-tinta-suave">Sem {nome}</span> : null}
                  {doDia.map((l) => pode ? (
                    <div key={l.chave} className="flex items-end gap-2">
                      <CampoTexto id={`h-${l.chave}-i`} rotulo={`${DIAS_SEMANA[dia]}, início`} className="w-24 [&_label]:sr-only" inputMode="numeric" maxLength={5}
                        value={l.inicio} onChange={(e) => mudar(l.chave, "inicio", e.target.value)} />
                      <span className="pb-3 text-sm text-tinta-suave">às</span>
                      <CampoTexto id={`h-${l.chave}-f`} rotulo={`${DIAS_SEMANA[dia]}, fim`} className="w-24 [&_label]:sr-only" inputMode="numeric" maxLength={5}
                        value={l.fim} onChange={(e) => mudar(l.chave, "fim", e.target.value)} />
                      <Botao variante="discreto" tamanho="m" onClick={() => setLinhas((x) => x.filter((y) => y.chave !== l.chave))}
                        aria-label={`Tirar o intervalo de ${DIAS_SEMANA[dia]} das ${l.inicio} às ${l.fim}`}>Tirar</Botao>
                    </div>
                  ) : (
                    <span key={l.chave} className="w-max rounded border border-info-borda bg-info-fundo px-2 py-0.5 text-sm text-info">{l.inicio} às {l.fim}</span>
                  ))}
                  {pode ? (
                    <Botao variante="discreto" tamanho="m" onClick={() => incluir(dia)}
                      aria-label={`${doDia.length ? "Mais um intervalo" : "Atender neste dia"}, ${DIAS_SEMANA[dia]}`}>
                      {doDia.length ? "Mais um intervalo" : "Atender neste dia"}
                    </Botao>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {resumo ? <p className="border-t border-linha px-4 py-3 text-[13px] text-tinta-suave sm:px-5">{resumo}{tipo === "ATENDIMENTO" ? " · os prazos contam só neste horário" : ""}</p> : null}
      </div>
      {tipo === "ATENDIMENTO" ? <p className="text-sm text-tinta-suave">Fora destes horários e nos feriados, o prazo de retorno para.</p> : null}
    </section>
  );
}

function Fuso({ config, tecnica, recarregar, salvo }: PropsAba) {
  return (
    <AjusteTecnico id="fuso" titulo="Fuso do condomínio" parte="Fuso" mudanca="FUSO" atual={config.fuso} tecnica={tecnica} recarregar={recarregar}
      opcoes={Object.entries(FUSOS).map(([valor, texto]) => ({ valor, texto }))}
      ajuda="Os horários e os prazos seguem este fuso."
      salvar={(fuso, motivo) => chamarApi(naBase("/fuso"), { metodo: "PUT", corpo: { versao: config.versao, fuso, motivo } })}
      aoSalvar={() => salvo("Fuso salvo.")} />
  );
}

export function AbaHorarios(props: PropsAba) {
  const [tipo, setTipo] = useState<TipoHorario>("ATENDIMENTO");
  return (
    <div className="grid gap-5">
      <Escolha rotulo="Qual horário" atual={tipo} aoMudar={setTipo}
        opcoes={(["ATENDIMENTO", "FUNCIONAMENTO"] as const).map((t) => ({ valor: t, texto: TIPOS_HORARIO[t] }))} />
      <p className="text-sm text-tinta-suave">
        {tipo === "ATENDIMENTO" ? "Quando os pedidos dos moradores são tratados. Fora destas horas e nos feriados, o prazo de retorno para." : "Quando o condomínio funciona (administração, áreas comuns). Serve de informação aos moradores."}
      </p>
      {/* Os dois ficam montados: trocar no trilho não perde o que foi digitado. */}
      <Semana tipo="ATENDIMENTO" oculta={tipo !== "ATENDIMENTO"} {...props} />
      <Semana tipo="FUNCIONAMENTO" oculta={tipo !== "FUNCIONAMENTO"} {...props} />
      <BlocoTriade><Fuso {...props} /></BlocoTriade>
    </div>
  );
}
