"use client";
// Horários e fuso (CF-06, CF-10): funcionamento e atendimento, cada um com vários intervalos
// por dia. Madrugada vira dois intervalos; 24:00 vale. Fora do atendimento, o prazo para.

import { useState, type FormEvent } from "react";
import { DIAS_SEMANA, FUSOS, intervalosSobrepostos, TIPOS_HORARIO, type Intervalo, type TipoHorario } from "@triade/domain";
import { AvisoErro, Botao, CampoTexto, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { PropsAba } from "./Configuracoes.tsx";
import { AjusteTecnico } from "./tecnica.tsx";
import { naBase } from "./contexto.tsx";

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

function Semana({ tipo, config, pode, recarregar, salvo }: PropsAba & { tipo: TipoHorario }) {
  const h = config.horarios[tipo];
  let seq = 0;
  const [linhas, setLinhas] = useState<Linha[]>(() => h.intervalos.map((i) => ({ chave: seq++, ...i })));
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

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const p = problemas(linhas);
    setAviso(p);
    if (p) return;
    const intervalos: Intervalo[] = linhas.map(({ dia, inicio, fim }) => ({ dia, inicio, fim }));
    const r = await chamarApi(naBase(`/horarios/${tipo.toLowerCase()}`), { metodo: "PUT", corpo: { versao: h.versao, intervalos } });
    if (!r.ok) return setErro(r.erro);
    salvo(`Horário de ${nome} salvo.`);
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      {aviso ? <p role="alert" className="text-sm text-erro">{aviso}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-linha bg-superficie">
        <table className="w-full text-sm">
          <caption className="sr-only">Horário de {nome} por dia da semana</caption>
          <thead className="bg-superficie-2 text-left text-tinta-suave">
            <tr><th scope="col" className="px-4 py-2.5 font-semibold">Dia</th><th scope="col" className="px-4 py-2.5 font-semibold">Intervalos</th></tr>
          </thead>
          <tbody>
            {ORDEM_DIAS.map((dia) => {
              const doDia = linhas.filter((l) => l.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
              return (
                <tr key={dia} className="border-t border-linha align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{DIAS_SEMANA[dia]}</th>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      {doDia.length === 0 ? <span className="text-tinta-suave">Sem {nome}</span> : null}
                      {doDia.map((l) => pode ? (
                        <div key={l.chave} className="flex flex-wrap items-end gap-2">
                          <CampoTexto id={`h-${l.chave}-i`} rotulo={`${DIAS_SEMANA[dia]}, início`} className="w-28" inputMode="numeric" maxLength={5}
                            value={l.inicio} onChange={(e) => mudar(l.chave, "inicio", e.target.value)} />
                          <CampoTexto id={`h-${l.chave}-f`} rotulo={`${DIAS_SEMANA[dia]}, fim`} className="w-28" inputMode="numeric" maxLength={5}
                            value={l.fim} onChange={(e) => mudar(l.chave, "fim", e.target.value)} />
                          <Botao variante="discreto" onClick={() => setLinhas((x) => x.filter((y) => y.chave !== l.chave))}
                            aria-label={`Tirar o intervalo de ${DIAS_SEMANA[dia]} das ${l.inicio} às ${l.fim}`}>Tirar</Botao>
                        </div>
                      ) : (
                        <span key={l.chave} className="w-max rounded border border-info-borda bg-info-fundo px-2 py-0.5 text-info">{l.inicio} às {l.fim}</span>
                      ))}
                      {pode ? (
                        <Botao variante="discreto" className="justify-self-start" onClick={() => incluir(dia)} aria-label={`Acrescentar intervalo na ${DIAS_SEMANA[dia]}`}>
                          + Intervalo
                        </Botao>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tipo === "ATENDIMENTO" ? <p className="text-sm text-tinta-suave">Fora destes horários e nos feriados, o prazo de retorno para.</p> : null}
      {pode ? (
        <div className="flex flex-wrap gap-2">
          <Botao type="submit">Salvar horário de {nome}</Botao>
          <Botao variante="contorno" onClick={copiarSegunda}>Copiar segunda para terça a sexta</Botao>
        </div>
      ) : null}
    </form>
  );
}

function Fuso({ config, tecnica, recarregar, salvo }: PropsAba) {
  return (
    <div className="border-t border-linha pt-5">
      <AjusteTecnico id="fuso" titulo="Fuso do condomínio" parte="Fuso" atual={config.fuso} tecnica={tecnica} recarregar={recarregar}
        opcoes={Object.entries(FUSOS).map(([valor, texto]) => ({ valor, texto }))}
        ajuda="Os horários e os prazos seguem este fuso."
        salvar={(fuso, motivo) => chamarApi(naBase("/fuso"), { metodo: "PUT", corpo: { versao: config.versao, fuso, motivo } })}
        aoSalvar={() => salvo("Fuso salvo.")} />
    </div>
  );
}

export function AbaHorarios(props: PropsAba) {
  const [tipo, setTipo] = useState<TipoHorario>("ATENDIMENTO");
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Qual horário">
        {(["ATENDIMENTO", "FUNCIONAMENTO"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}
            className="min-h-10 rounded-full border border-linha px-4 text-sm aria-pressed:border-violeta-600 aria-pressed:bg-violeta-50 aria-pressed:font-semibold">
            {TIPOS_HORARIO[t]}
          </button>
        ))}
      </div>
      <p className="text-sm text-tinta-suave">
        {tipo === "ATENDIMENTO" ? "Quando os pedidos dos moradores são tratados. Os prazos contam só nestas horas." : "Quando o condomínio funciona (administração, áreas comuns). Serve de informação aos moradores."}
      </p>
      <Semana key={tipo} tipo={tipo} {...props} />
      <Fuso {...props} />
    </div>
  );
}
