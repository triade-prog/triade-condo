"use client";
// Vida em condomínio › Reservas (design "Vida em condomínio", tela 2; DC15, telas-modelo
// vida-reservas-*; AC-01, AC-06): abas por situação, A aprovar primeiro. Os pedidos da mesma área
// no mesmo dia ficam num cartão só, com um único Decidir (decisão B.1 de 22/10/2026): aprovar um
// recusa os outros, com o motivo. O limite da unidade só fica em âmbar quando o pedido passa dele.
// Ao lado, a semana da área do pedido que está em cima. A linha inteira abre a ficha da reserva,
// com o andamento e Cancelar em Mais ações. Recusar e cancelar pedem motivo, que chega ao morador
// pelo WhatsApp com o nome de quem decidiu.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { descreverEventoReserva, ESTADOS_ENVIO_WHATSAPP, FILTROS_RESERVA, formatarDataHora, somarDias, textoLimite, type FiltroReserva } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio,
  type ErroApi,
} from "@triade/ui";
import { LadrilhoUnidade, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ListaReservas, ReservaDetalhe, ReservaTela, SemanaArea } from "../tipos.ts";
import { DiaQuadro, diaCurto, horario, LinhaDoTempo, segundaDaSemana, SeloReserva, type PassoTempo } from "./comum.tsx";

type Acao = { tipo: "decidir"; grupo: ReservaTela[] } | { tipo: "ver"; id: string } | { tipo: "cancelar"; reserva: ReservaTela };

/** Os pedidos a aprovar juntos por área e dia, na ordem da lista. */
function agrupar(rs: ReservaTela[]): ReservaTela[][] {
  const grupos = new Map<string, ReservaTela[]>();
  for (const r of rs) grupos.set(`${r.area.id}|${r.data}`, [...(grupos.get(`${r.area.id}|${r.data}`) ?? []), r]);
  return [...grupos.values()];
}

/** A unidade sem a torre, para o ladrilho: "Torre A · 302" vira "302". */
const numeroDa = (nome: string) => nome.split(" · ").at(-1) ?? nome;

export function AbaReservas({ aoMudar }: { aoMudar: (texto: string) => void }) {
  const [filtro, setFiltro] = useState<FiltroReserva>("A_APROVAR");
  const [areaId, setAreaId] = useState("");
  const [filtrando, setFiltrando] = useState(false);
  const [acao, setAcao] = useState<Acao | null>(null);
  const carga = useCarregar<ListaReservas>(`/v1/condominio/reservas?filtro=${filtro}${areaId ? `&areaId=${areaId}` : ""}`);

  const l = carga.estado === "pronto" ? carga.dados : null;
  const fechar = (texto?: string) => { setAcao(null); if (texto) aoMudar(texto); };
  const primeira = l?.reservas[0];
  const areaDaSemana = areaId || primeira?.area.id || l?.areas[0]?.id || "";
  const semanaDe = l ? segundaDaSemana(primeira && primeira.data >= l.hoje ? primeira.data : l.hoje) : "";
  const nomeArea = l?.areas.find((a) => a.id === areaId)?.nome;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="t-reservas" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-reservas" className="sr-only">Reservas</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {(Object.keys(FILTROS_RESERVA) as FiltroReserva[]).map((f) => {
            const atual = filtro === f;
            const n = f === "A_APROVAR" ? l?.aAprovar : atual ? l?.reservas.length : undefined;
            return (
              <button key={f} type="button" aria-pressed={atual} onClick={() => setFiltro(f)}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {FILTROS_RESERVA[f]}
                {n ? <><span className="sr-only"> ({n})</span><span aria-hidden="true" className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span></> : null}
              </button>
            );
          })}
        </nav>

        {carga.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando as reservas…" /></div> : null}
        {carga.estado === "erro" ? <div className="p-5"><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="as reservas" /></div> : null}
        {l ? (
          l.reservas.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={filtro === "A_APROVAR" ? "Nada esperando aprovação" : "Nenhuma reserva aqui"} icone="calendario">
                {l.areas.length
                  ? "Os moradores reservam pelo WhatsApp do condomínio, mandando RESERVAR. A reserva pedida por telefone entra pelo botão Nova reserva."
                  : <>Nenhuma área aceita reserva ainda. Ative as áreas do prédio em <Link href="/configuracoes?aba=areas" className="font-medium text-violeta-600 hover:underline">Configurações › Áreas comuns</Link>.</>}
              </Vazio>
            </div>
          ) : filtro === "A_APROVAR" ? (
            <ul aria-label="Pedidos a aprovar" className="grid gap-3 py-3 md:bg-fundo md:p-5">
              {agrupar(l.reservas).map((g) => (
                <CartaoPedidos key={g[0]!.id} grupo={g} podeEditar={l.pode.editar} aoDecidir={() => setAcao({ tipo: "decidir", grupo: g })}
                  aoAbrir={(id) => setAcao({ tipo: "ver", id })} />
              ))}
            </ul>
          ) : (
            <ul aria-label="Reservas" className="grid max-md:gap-3 max-md:py-3">
              {l.reservas.map((r) => <LinhaReserva key={r.id} r={r} aoAbrir={() => setAcao({ tipo: "ver", id: r.id })} />)}
            </ul>
          )
        ) : null}
        {l ? (
          <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
            <span className="t-apoio">
              {filtro === "A_APROVAR"
                ? (l.aAprovar === 1 ? "1 pedido a aprovar" : `${l.aAprovar} pedidos a aprovar`)
                : (l.reservas.length === 1 ? "1 reserva" : `${l.reservas.length} reservas`)}
              {nomeArea ? ` · ${nomeArea}` : ""}
            </span>
            {l.areas.length > 1 ? (
              <Botao variante="contorno" tamanho="m" aria-label={areaId ? "Filtros, 1 em uso" : "Filtros"} onClick={() => setFiltrando(true)}>
                <Icone nome="filtro" />Filtros{areaId ? " · 1" : ""}
              </Botao>
            ) : null}
          </div>
        ) : null}
      </section>

      {l && areaDaSemana ? (
        <SemanaDaArea key={`${areaDaSemana}-${semanaDe}`} areaId={areaDaSemana} de={semanaDe} hoje={l.hoje} aoAbrir={(id) => setAcao({ tipo: "ver", id })} />
      ) : null}

      {l ? (
        <Dialogo aberto={filtrando} titulo="Filtrar reservas" aoFechar={() => setFiltrando(false)}>
          <FormFiltros key={`${filtrando}`} areas={l.areas} areaId={areaId} aplicar={(id) => { setFiltrando(false); setAreaId(id); }} />
        </Dialogo>
      ) : null}
      {acao?.tipo === "decidir" ? <Decidir grupo={acao.grupo} aoFechar={fechar} /> : null}
      {acao?.tipo === "cancelar" ? <Cancelar r={acao.reserva} aoFechar={fechar} /> : null}
      {acao?.tipo === "ver" ? (
        <FichaReserva id={acao.id} aoFechar={() => setAcao(null)}
          aoDecidir={(r) => setAcao({ tipo: "decidir", grupo: l?.reservas.filter((x) => x.estado === "A_APROVAR" && x.area.id === r.area.id && x.data === r.data) ?? [r] })}
          aoCancelar={(r) => setAcao({ tipo: "cancelar", reserva: r })} />
      ) : null}
    </div>
  );
}

function FormFiltros({ areas, areaId, aplicar }: { areas: ListaReservas["areas"]; areaId: string; aplicar: (id: string) => void }) {
  const [area, setArea] = useState(areaId);
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); aplicar(area); }}>
      <CampoSelecao id="rs-area" rotulo="Área" icone="calendario" value={area} onChange={(e) => setArea(e.target.value)}
        opcoes={[{ valor: "", texto: "Todas as áreas" }, ...areas.map((a) => ({ valor: a.id, texto: a.nome }))]} />
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={() => aplicar("")}>Tirar filtros</Botao>
        <Botao type="submit">Mostrar reservas</Botao>
      </div>
    </form>
  );
}

/** Quem e por onde: "pediu pelo WhatsApp em 21/10 às 22:30 · aniversário, 60 pessoas". */
function origem(r: ReservaTela): string {
  const como = r.origem === "WHATSAPP" ? `pediu pelo WhatsApp em ${formatarDataHora(r.criadoEm).replace(" ", " às ")}` : `registrada no painel${r.registradoPor ? ` por ${r.registradoPor}` : ""}`;
  return [como, r.estado === "CONFIRMADA" && !r.decisao ? "confirmada na hora" : null, r.observacao].filter(Boolean).join(" · ");
}

/** O que pesa no pedido. O limite fica em cinza enquanto o pedido está dentro dele. */
function pesos(r: ReservaTela): { texto: string; atencao: boolean }[] {
  const x: { texto: string; atencao: boolean }[] = [];
  if (r.ocupacao) x.push({ texto: `A área já está ocupada: ${r.ocupacao.titulo}. Aprovar não dá enquanto isso estiver marcado.`, atencao: true });
  if (r.limite) x.push({ texto: textoLimite(r.limite, r.data, r.tolerancia), atencao: r.tolerancia || r.limite.n > r.limite.quantidade });
  const decisao = textoDecisao(r);
  if (decisao) x.push({ texto: decisao, atencao: false });
  return x;
}

/** "Recusada: A data ficou com outro pedido de reserva". */
function textoDecisao(r: ReservaTela): string | null {
  if (!r.decisao?.motivo) return null;
  return `${r.estado === "CANCELADA" ? (r.decisao.peloMorador ? "Cancelada pelo morador" : "Cancelada") : "Recusada"}: ${r.decisao.motivo}`;
}

function Pesos({ r }: { r: ReservaTela }) {
  return pesos(r).map((p) => (
    <span key={p.texto} className={`flex items-start gap-1.5 text-[13px] ${p.atencao ? "text-atencao" : "text-tinta-suave"}`}>
      {p.atencao ? <Icone nome="alerta" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}{p.texto}
    </span>
  ));
}

/** Os pedidos de uma área num dia (B.1): um cartão só, com um Decidir. */
function CartaoPedidos({ grupo, podeEditar, aoDecidir, aoAbrir }: { grupo: ReservaTela[]; podeEditar: boolean; aoDecidir: () => void; aoAbrir: (id: string) => void }) {
  const r0 = grupo[0]!;
  const varios = grupo.length > 1;
  return (
    <li className="grid gap-3.5 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <div className="flex items-start gap-3.5">
        <DiaQuadro d={r0.data} />
        <div className="grid min-w-0 gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h3 className="t-titulo-secao">{varios ? `${grupo.length} pedidos para o ${r0.area.nome}` : r0.area.nome}</h3>
            <SeloReserva estado="A_APROVAR" />
          </span>
          <span className="t-apoio">{diaCurto(r0.data)} · {horario(r0)}{varios ? " · ao aprovar um, os outros recebem a recusa com o motivo" : ""}</span>
        </div>
      </div>
      <ul className="grid gap-2">
        {grupo.map((r) => (
          <li key={r.id} className="relative flex items-start gap-3 rounded-[14px] border border-linha bg-fundo px-3.5 py-3 hover:border-violeta-300">
            <LadrilhoUnidade texto={numeroDa(r.unidade.nome)} />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <button type="button" className="text-left text-[15px] font-medium after:absolute after:inset-0 after:content-[''] hover:text-violeta-600"
                onClick={() => aoAbrir(r.id)} aria-label={`Abrir a reserva ${r.protocolo}: ${r.unidade.nome}${r.contato ? ` · ${r.contato.nome}` : ""}`}>
                {r.unidade.nome}{r.contato ? ` · ${r.contato.nome}` : ""}
              </button>
              <span className="t-apoio">{origem(r)}</span>
              <Pesos r={r} />
            </span>
            <span className="t-codigo text-tinta-suave max-md:hidden">{r.protocolo}</span>
          </li>
        ))}
      </ul>
      {podeEditar ? (
        <div><Botao className="max-md:w-full" onClick={aoDecidir} aria-label={`Decidir: ${r0.area.nome}, ${diaCurto(r0.data)}`}><Icone nome="check" />Decidir</Botao></div>
      ) : null}
    </li>
  );
}

const COLUNAS = "md:grid-cols-[52px_minmax(0,1.4fr)_minmax(0,1fr)_140px_20px]";

/** Uma reserva em Próximas e Todas: a linha inteira abre a ficha; no celular vira cartão. */
function LinhaReserva({ r, aoAbrir }: { r: ReservaTela; aoAbrir: () => void }) {
  return (
    <li className={`relative grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
      <DiaQuadro d={r.data} tom="neutro" />
      <span className="grid min-w-0 gap-0.5">
        <button type="button" className="text-left text-[15px] font-medium after:absolute after:inset-0 after:content-[''] hover:text-violeta-600" onClick={aoAbrir}>
          {r.area.nome} · {diaCurto(r.data)} · {horario(r)}
        </button>
        {textoDecisao(r) ? <span className="text-[13px] text-tinta-suave">{textoDecisao(r)}</span> : null}
        <span className="t-apoio md:hidden">{r.unidade.nome}{r.contato ? ` · ${r.contato.nome}` : ""}</span>
        <span className="pt-1 md:hidden"><SeloReserva estado={r.estado} tolerancia={r.tolerancia} /></span>
      </span>
      <span className="grid text-sm max-md:hidden"><span>{r.unidade.nome}{r.contato ? ` · ${r.contato.nome}` : ""}</span><span className="t-apoio">{origem(r)}</span></span>
      <span className="justify-self-start max-md:hidden"><SeloReserva estado={r.estado} tolerancia={r.tolerancia} /></span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
    </li>
  );
}

/** A semana da área (decisão 1, AG-09): reservas e o que a Agenda bloqueia. Abre na semana do
 * pedido de cima da lista. */
function SemanaDaArea({ areaId, de: inicio, hoje, aoAbrir }: { areaId: string; de: string; hoje: string; aoAbrir: (id: string) => void }) {
  const [de, setDe] = useState(inicio);
  const carga = useCarregar<SemanaArea>(`/v1/condominio/areas-comuns/${areaId}/semana?de=${de}`);
  const ate = somarDias(de, 6);
  return (
    <section aria-labelledby="rs-semana" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="calendario" className="h-4 w-4" /></span>
          <h2 id="rs-semana" className="t-titulo-cartao">{carga.estado === "pronto" ? carga.dados.area.nome : "Área"} · semana</h2>
        </span>
        <span className="flex gap-1">
          <button type="button" className="emblema" aria-label="Semana anterior" onClick={() => setDe(somarDias(de, -7))}><Icone nome="esq" /></button>
          <button type="button" className="emblema" aria-label="Próxima semana" onClick={() => setDe(somarDias(de, 7))}><Icone nome="dir" /></button>
        </span>
      </div>
      <p className="t-apoio">De {diaCurto(de)} a {diaCurto(ate)}</p>
      {carga.estado === "carregando" ? <Carregando linhas={4} rotulo="Carregando a semana…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? (
        <>
          <ul className="grid gap-0.5">
            {carga.dados.dias.map((d) => {
              const aAprovar = d.reservas.some((r) => r.estado === "A_APROVAR");
              return (
                <li key={d.data} className={`grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2 rounded-xl px-2.5 py-2 text-sm ${aAprovar ? "border border-atencao-borda bg-atencao-fundo" : d.data === hoje ? "bg-violeta-50" : ""}`}>
                  <span className={aAprovar ? "font-semibold text-atencao" : "text-tinta-suave"}>{diaCurto(d.data).slice(0, 3)} {Number(d.data.slice(8))}</span>
                  <span className="grid gap-1">
                    {d.bloqueios.map((b) => (
                      <Link key={b.id} href={`/agenda/compromisso?id=${b.id}`} className="inline-flex min-h-6 items-center text-[13px] text-tinta-suave hover:underline">
                        {b.horaInicio ? `${b.horaInicio} ` : ""}{b.titulo} · Agenda
                      </Link>
                    ))}
                    {d.reservas.map((r) => (
                      <button key={r.id} type="button" className={`inline-flex min-h-6 items-center text-left text-[13px] hover:underline ${r.estado === "A_APROVAR" ? "text-atencao" : "text-ok"}`}
                        onClick={() => aoAbrir(r.id)}>
                        {r.horaInicio.slice(0, 5)} {r.unidade} · {r.estado === "A_APROVAR" ? "a aprovar" : "confirmada"}
                      </button>
                    ))}
                    {d.bloqueios.length + d.reservas.length === 0 ? <span className="text-[13px] text-tinta-suave">Livre</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="t-apoio">Compromisso da Agenda marcado na área bloqueia a reserva dela.</p>
        </>
      ) : null}
    </section>
  );
}

/** Decidir (B.1): qual pedido fica com o dia. Aprovar um recusa os outros, com o motivo; ou
 * recusar todos, com um motivo só. */
function Decidir({ grupo, aoFechar }: { grupo: ReservaTela[]; aoFechar: (texto?: string) => void }) {
  const r0 = grupo[0]!;
  const varios = grupo.length > 1;
  const primeiro = [...grupo].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))[0]!;
  const [escolhido, setEscolhido] = useState(grupo.find((r) => !r.ocupacao)?.id ?? r0.id);
  const [recusando, setRecusando] = useState(false);
  const [recado, setRecado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const r = grupo.find((x) => x.id === escolhido)!;
  const outros = grupo.filter((x) => x.id !== escolhido);

  async function aprovar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi<{ recusadas?: number }>(`/v1/condominio/reservas/${r.id}/aprovar`, { corpo: { versao: r.versao, recado } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    const n = res.dados.recusadas;
    aoFechar(`Reserva ${r.protocolo} aprovada. O morador recebe a confirmação pelo WhatsApp.${n ? ` ${n === 1 ? "O outro pedido da mesma data foi recusado" : `Os outros ${n} pedidos da mesma data foram recusados`}, com o motivo.` : ""}`);
  }

  async function recusar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    for (const x of grupo) {
      const res = await chamarApi(`/v1/condominio/reservas/${x.id}/recusar`, { corpo: { versao: x.versao, motivo } });
      if (!res.ok) { setEnviando(false); return setErro(res.erro); }
    }
    setEnviando(false);
    aoFechar(varios ? `Os ${grupo.length} pedidos foram recusados. O motivo vai para cada morador pelo WhatsApp.` : `Reserva ${r0.protocolo} recusada. O motivo vai para o morador pelo WhatsApp.`);
  }

  return (
    <Dialogo aberto media fechar titulo={`Decidir: ${r0.area.nome}, ${diaCurto(r0.data)}`} aoFechar={() => aoFechar()}
      apoio={`${horario(r0)} · ${varios ? `${grupo.length} pedidos para o mesmo dia` : `${r0.unidade.nome}${r0.contato ? ` · ${r0.contato.nome}` : ""}`}`}>
      {recusando ? (
        <form onSubmit={recusar} noValidate className="grid gap-4">
          <p className="t-apoio">{varios ? `Os ${grupo.length} pedidos recebem a recusa` : "O morador recebe a recusa"} com este motivo pelo WhatsApp, assinado com o seu nome.</p>
          {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <CampoAreaTexto id="rs-motivo" rotulo="Motivo" maxLength={500} required value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={comErro.includes("motivo") ? "Escreva o motivo, com pelo menos 3 letras" : null} ajuda="Obrigatório. Sugira outra data quando puder." />
          <div className="flex flex-wrap justify-end gap-2 border-t border-linha pt-4">
            <Botao variante="contorno" onClick={() => { setRecusando(false); setErro(null); }}>Voltar</Botao>
            <Botao type="submit" variante="perigo" disabled={enviando}>{varios ? `Recusar os ${grupo.length} pedidos` : "Recusar o pedido"}</Botao>
          </div>
        </form>
      ) : (
        <form onSubmit={aprovar} noValidate className="grid gap-4">
          {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          {varios ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[13px] font-medium">Qual pedido fica com o dia</legend>
              {grupo.map((x) => {
                const marcado = x.id === escolhido;
                return (
                  <label key={x.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3.5 ${marcado ? "border-2 border-violeta-600 bg-violeta-50" : "border border-linha bg-superficie"}`}>
                    <input type="radio" name="rs-escolhido" className="mt-1 h-4 w-4 accent-violeta-600" checked={marcado} onChange={() => setEscolhido(x.id)} />
                    <span className="grid gap-0.5">
                      <span className="text-[15px] font-medium">{x.unidade.nome}{x.contato ? ` · ${x.contato.nome}` : ""}</span>
                      <span className="t-apoio">{origem(x)}</span>
                      <span className="text-xs text-tinta-suave">{[x.id === primeiro.id ? "Pediu primeiro" : null, ...pesos(x).map((p) => p.texto)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div className="grid gap-1 rounded-[14px] border border-linha bg-fundo px-4 py-3">
              <span className="t-apoio">{origem(r0)}</span>
              <Pesos r={r0} />
            </div>
          )}
          <CampoAreaTexto id="rs-recado" rotulo={varios ? "Recado para quem ficou com o dia" : "Recado para o morador"} opcional maxLength={300} value={recado}
            onChange={(e) => setRecado(e.target.value)} ajuda="Vai pelo WhatsApp, assinado com o seu nome. Por exemplo: a chave fica com o zelador." />
          {outros.length ? (
            <div className="flex items-start gap-2.5 rounded-[14px] border border-atencao-borda bg-atencao-fundo px-3.5 py-3 text-[13px]">
              <Icone nome="info" className="mt-0.5 h-4 w-4 shrink-0 text-atencao" />
              <span>{outros.map((x) => x.unidade.nome).join(", ")} {outros.length === 1 ? "recebe" : "recebem"} a recusa com o motivo &quot;A data ficou com outro pedido de reserva&quot;.</span>
            </div>
          ) : null}
          {r.ocupacao ? <p className="text-[13px] text-atencao">A área já está ocupada: {r.ocupacao.titulo}. Aprovar não dá enquanto isso estiver marcado.</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-4">
            <Botao variante="discreto" onClick={() => { setRecusando(true); setErro(null); }}>{varios ? `Recusar os ${grupo.length}` : "Recusar…"}</Botao>
            <span className="flex flex-wrap gap-2">
              <Botao variante="contorno" onClick={() => aoFechar()}>Cancelar</Botao>
              <Botao type="submit" disabled={enviando || !!r.ocupacao}><Icone nome="check" />Aprovar {varios ? r.unidade.nome : ""}</Botao>
            </span>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

function Cancelar({ r, aoFechar }: { r: ReservaTela; aoFechar: (texto?: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi(`/v1/condominio/reservas/${r.id}/cancelar`, { corpo: { versao: r.versao, motivo } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar(`Reserva ${r.protocolo} cancelada. O motivo vai para o morador pelo WhatsApp.`);
  }
  return (
    <Dialogo aberto titulo={`Cancelar a reserva ${r.protocolo}`} aoFechar={() => aoFechar()}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="t-apoio">{r.area.nome} · {diaCurto(r.data)} · {r.unidade.nome}{r.contato ? ` · ${r.contato.nome}` : ""}. O motivo vai para o morador pelo WhatsApp, assinado com o seu nome.</p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="rs-motivo" rotulo="Motivo" maxLength={500} required value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={comErro.includes("motivo") ? "Escreva o motivo, com pelo menos 3 letras" : null} ajuda="Obrigatório. Sugira outra data quando puder." />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}>Cancelar a reserva</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function FichaReserva({ id, aoFechar, aoDecidir, aoCancelar }: {
  id: string; aoFechar: () => void; aoDecidir: (r: ReservaTela) => void; aoCancelar: (r: ReservaTela) => void;
}) {
  const carga = useCarregar<ReservaDetalhe>(`/v1/condominio/reservas/${id}`);
  const d = carga.estado === "pronto" ? carga.dados : null;
  return (
    <Dialogo aberto media fechar titulo={d ? `Reserva ${d.reserva.protocolo}` : "Reserva"} aoFechar={aoFechar} apoio={d ? origem(d.reserva) : undefined}>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a reserva…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {d ? <Ficha d={d} aoFechar={aoFechar} aoDecidir={aoDecidir} aoCancelar={aoCancelar} /> : null}
    </Dialogo>
  );
}

function marca(acao: string, dados: Record<string, unknown>): Pick<PassoTempo, "icone" | "tom"> {
  if (acao === "reserva.registrada") return dados.origem === "WHATSAPP" ? { icone: "whats", tom: "info" } : { icone: "editar", tom: "info" };
  if (dados.para === "CONFIRMADA") return { icone: "check", tom: "ok" };
  if (dados.para === "A_APROVAR") return { icone: "relogio", tom: "atencao" };
  return { icone: "sair", tom: "neutro" };
}

function Ficha({ d, aoFechar, aoDecidir, aoCancelar }: { d: ReservaDetalhe; aoFechar: () => void; aoDecidir: (r: ReservaTela) => void; aoCancelar: (r: ReservaTela) => void }) {
  const r = d.reserva;
  const tempo: PassoTempo[] = [...d.historico].sort((a, b) => a.em.localeCompare(b.em)).map((h) => ({
    ...marca(h.acao, h.dados), titulo: descreverEventoReserva(h.acao, h.dados),
    quando: [formatarDataHora(h.em), h.autor, typeof h.dados.motivo === "string" ? h.dados.motivo : null].filter(Boolean).join(" · "),
  }));
  if (r.estado === "CONFIRMADA") tempo.push({ icone: "calendario", tom: "andamento", titulo: `Uso: ${r.area.nome}`, quando: `${diaCurto(r.data)} · ${horario(r)}`, futuro: true });
  const mais: ItemMenu[] = d.pode.editar && r.estado === "CONFIRMADA"
    ? [{ texto: "Cancelar a reserva…", icone: "sair", perigo: true, acao: () => aoCancelar(r) }] : [];
  const dados = [
    ["Dia", `${diaCurto(r.data)} · ${horario(r)}`],
    ["Unidade", `${r.unidade.nome}${r.contato ? ` · ${r.contato.nome}` : ""}`],
    ...(r.limite ? [["Limite", textoLimite(r.limite, r.data, r.tolerancia)]] : []),
  ];
  return (
    <div className="grid gap-4 text-sm">
      <p className="flex flex-wrap gap-2"><SeloReserva estado={r.estado} tolerancia={r.tolerancia} /><Selo tom="neutro">{r.area.nome}</Selo></p>
      <dl className="grid">
        {dados.map(([n, v]) => (
          <div key={n} className="flex justify-between gap-4 border-t border-linha py-3 first:border-t-0"><dt className="t-apoio">{n}</dt><dd className="text-right">{v}</dd></div>
        ))}
      </dl>
      {r.ocupacao ? <p className="text-[13px] text-atencao">A área já está ocupada: {r.ocupacao.titulo}.</p> : null}
      <section aria-labelledby="rs-andamento" className="grid gap-3">
        <h3 id="rs-andamento" className="t-rotulo">Andamento</h3>
        <LinhaDoTempo itens={tempo} />
      </section>
      {d.mensagens.length ? (
        <section aria-labelledby="rs-mensagens" className="grid gap-2">
          <h3 id="rs-mensagens" className="t-rotulo">Mensagens ao morador</h3>
          <ul className="grid gap-1">
            {d.mensagens.map((m) => (
              <li key={m.id} className="text-[13px]">
                {formatarDataHora(m.em)} · {ESTADOS_ENVIO_WHATSAPP[m.estado as keyof typeof ESTADOS_ENVIO_WHATSAPP] ?? m.estado}{m.motivo ? ` · ${m.motivo}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-4">
        <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
        <span className="ml-auto flex gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Fechar</Botao>
          {d.pode.editar && r.estado === "A_APROVAR" ? <Botao onClick={() => aoDecidir(r)}><Icone nome="check" />Decidir</Botao> : null}
        </span>
      </div>
    </div>
  );
}
