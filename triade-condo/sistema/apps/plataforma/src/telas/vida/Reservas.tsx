"use client";
// Vida em condomínio › Reservas (design "Vida em condomínio", tela 2; AC-01, AC-06): o que espera
// aprovação vem primeiro, com a regra que pesa em cada pedido (limite, tolerância, outro pedido na
// mesma data ou a Agenda ocupando a área). Ao lado, a semana da área. Recusar e cancelar pedem
// motivo, que chega ao morador pelo WhatsApp com o nome de quem decidiu.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { descreverEventoReserva, ESTADOS_ENVIO_WHATSAPP, FILTROS_RESERVA, formatarDataHora, somarDias, textoLimite, type FiltroReserva } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, Carregando, camposComErro, chamarApi, Chip, Dialogo, ErroCarregar, Icone, textoDoErro, Vazio,
  type ErroApi,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ListaReservas, ReservaDetalhe, ReservaTela, SemanaArea } from "../tipos.ts";
import { diaCurto, horario, segundaDaSemana, SeloReserva } from "./comum.tsx";

type Acao = { tipo: "aprovar" | "recusar" | "cancelar" | "ver"; reserva: ReservaTela };

export function AbaReservas({ aoMudar }: { aoMudar: (texto: string) => void }) {
  const [filtro, setFiltro] = useState<FiltroReserva>("A_APROVAR");
  const [areaId, setAreaId] = useState("");
  const [acao, setAcao] = useState<Acao | null>(null);
  const carga = useCarregar<ListaReservas>(`/v1/condominio/reservas?filtro=${filtro}${areaId ? `&areaId=${areaId}` : ""}`);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as reservas…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const l = carga.dados;
  const areaDaSemana = areaId || l.areas[0]?.id || "";
  const fechar = (texto?: string) => { setAcao(null); if (texto) aoMudar(texto); };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quais reservas">
          {(Object.keys(FILTROS_RESERVA) as FiltroReserva[]).map((f) => (
            <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>
              {FILTROS_RESERVA[f]}{f === "A_APROVAR" && l.aAprovar ? ` · ${l.aAprovar}` : ""}
            </Chip>
          ))}
          {l.areas.length > 1 ? (
            <CampoSelecao id="rs-area" rotulo="Área" className="ml-auto min-w-48 [&>label]:sr-only" value={areaId} onChange={(e) => setAreaId(e.target.value)}
              opcoes={[{ valor: "", texto: "Área: todas" }, ...l.areas.map((a) => ({ valor: a.id, texto: a.nome }))]} />
          ) : null}
        </div>
        {l.reservas.length === 0 ? (
          <Vazio titulo={filtro === "A_APROVAR" ? "Nada esperando aprovação" : "Nenhuma reserva aqui"}>
            {l.areas.length
              ? "Os moradores reservam pelo WhatsApp do condomínio, mandando RESERVAR. A reserva pedida por telefone entra pelo botão Nova reserva."
              : <>Nenhuma área aceita reserva ainda. Ative as áreas do prédio em <Link href="/configuracoes?aba=areas" className="font-medium text-violeta-600 hover:underline">Configurações › Áreas comuns</Link>.</>}
          </Vazio>
        ) : (
          <ul className="grid gap-3">
            {l.reservas.map((r) => (
              <CartaoReserva key={r.id} r={r} hoje={l.hoje} podeEditar={l.pode.editar} aoAgir={(tipo) => setAcao({ tipo, reserva: r })} />
            ))}
          </ul>
        )}
      </div>
      {areaDaSemana ? <SemanaDaArea key={areaDaSemana} areaId={areaDaSemana} hoje={l.hoje} aoAbrir={(r) => setAcao({ tipo: "ver", reserva: r })} /> : null}

      {acao?.tipo === "aprovar" ? <Aprovar r={acao.reserva} aoFechar={fechar} /> : null}
      {acao?.tipo === "recusar" || acao?.tipo === "cancelar" ? <ComMotivo tipo={acao.tipo} r={acao.reserva} aoFechar={fechar} /> : null}
      {acao?.tipo === "ver" ? <DetalheReserva id={acao.reserva.id} aoFechar={() => setAcao(null)} aoAgir={(tipo, r) => setAcao({ tipo, reserva: r })} /> : null}
    </div>
  );
}

/** As linhas que explicam o pedido: quem, por onde, e o que pesa nele. */
function detalhes(r: ReservaTela): { linha: string; alertas: string[] } {
  const origem = r.origem === "WHATSAPP" ? `pediu pelo WhatsApp ${formatarDataHora(r.criadoEm)}` : `registrada no painel${r.registradoPor ? ` por ${r.registradoPor}` : ""}`;
  const confirmadaNaHora = r.estado === "CONFIRMADA" && !r.decisao ? "confirmada na hora" : null;
  const linha = [r.unidade.nome, r.contato?.nome, origem, confirmadaNaHora, r.observacao].filter(Boolean).join(" · ");
  const alertas: string[] = [];
  if (r.ocupacao) alertas.push(`A área já está ocupada: ${r.ocupacao.titulo}. Aprovar não dá enquanto isso estiver marcado.`);
  if (r.outrosPedidos) alertas.push(r.outrosPedidos === 1 ? "Mesma data de outro pedido: aprovar um recusa o outro, com o motivo." : `Mesma data de outros ${r.outrosPedidos} pedidos: aprovar um recusa os outros, com o motivo.`);
  if (r.limite) alertas.push(textoLimite(r.limite, r.data, r.tolerancia));
  if (r.decisao?.motivo) alertas.push(`${r.estado === "CANCELADA" ? (r.decisao.peloMorador ? "Cancelada pelo morador" : "Cancelada") : "Recusada"}: ${r.decisao.motivo}`);
  return { linha, alertas };
}

function CartaoReserva({ r, hoje, podeEditar, aoAgir }: { r: ReservaTela; hoje: string; podeEditar: boolean; aoAgir: (t: Acao["tipo"]) => void }) {
  const { linha, alertas } = detalhes(r);
  const titulo = `${r.area.nome} · ${diaCurto(r.data)} · ${horario(r)}`;
  return (
    <li className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <span className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-6 text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => aoAgir("ver")}>{titulo}</button>
        <SeloReserva estado={r.estado} tolerancia={r.tolerancia} />
        <span className="text-xs text-tinta-suave">{r.protocolo}</span>
      </span>
      <span className="text-sm text-tinta-suave">{linha}</span>
      {alertas.map((a) => (
        <span key={a} className="flex items-start gap-1.5 text-[13px] text-atencao"><Icone nome="alerta" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{a}</span>
      ))}
      {podeEditar && r.estado === "A_APROVAR" ? (
        <span className="flex flex-wrap gap-2">
          <Botao tamanho="m" onClick={() => aoAgir("aprovar")} aria-label={`Aprovar a reserva ${r.protocolo}`}>Aprovar</Botao>
          <Botao tamanho="m" variante="contorno" onClick={() => aoAgir("recusar")} aria-label={`Recusar a reserva ${r.protocolo}`}>Recusar</Botao>
        </span>
      ) : null}
      {podeEditar && r.estado === "CONFIRMADA" && r.data >= hoje ? (
        <span><Botao tamanho="m" variante="contorno" onClick={() => aoAgir("cancelar")} aria-label={`Cancelar a reserva ${r.protocolo}`}>Cancelar</Botao></span>
      ) : null}
    </li>
  );
}

/** A semana da área (decisão 1, AG-09): reservas e o que a Agenda bloqueia. */
function SemanaDaArea({ areaId, hoje, aoAbrir }: { areaId: string; hoje: string; aoAbrir: (r: ReservaTela) => void }) {
  const [de, setDe] = useState(segundaDaSemana(hoje));
  const carga = useCarregar<SemanaArea>(`/v1/condominio/areas-comuns/${areaId}/semana?de=${de}`);
  return (
    <section aria-labelledby="rs-semana" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <div className="flex items-center justify-between gap-2">
        <h2 id="rs-semana" className="font-medium">{carga.estado === "pronto" ? carga.dados.area.nome : "Área"} · semana</h2>
        <span className="flex gap-1">
          <Botao variante="discreto" tamanho="p" soIcone aria-label="Semana anterior" onClick={() => setDe(somarDias(de, -7))}><Icone nome="esq" /></Botao>
          <Botao variante="discreto" tamanho="p" soIcone aria-label="Próxima semana" onClick={() => setDe(somarDias(de, 7))}><Icone nome="dir" /></Botao>
        </span>
      </div>
      {carga.estado === "carregando" ? <Carregando linhas={4} rotulo="Carregando a semana…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? (
        <>
          <ul className="grid gap-1.5">
            {carga.dados.dias.map((d) => (
              <li key={d.data} className={`grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2 rounded-xl px-2 py-1.5 text-sm ${d.data === hoje ? "bg-violeta-50" : ""}`}>
                <span className="text-tinta-suave">{diaCurto(d.data).slice(0, 3)} {Number(d.data.slice(8))}</span>
                <span className="grid gap-1">
                  {d.bloqueios.map((b) => (
                    <Link key={b.id} href={`/agenda/compromisso?id=${b.id}`} className="inline-flex min-h-6 items-center text-[13px] text-atencao hover:underline">
                      {b.horaInicio ? `${b.horaInicio} ` : ""}{b.titulo} · Agenda
                    </Link>
                  ))}
                  {d.reservas.map((r) => (
                    <button key={r.id} type="button" className="inline-flex min-h-6 items-center text-left text-[13px] hover:text-violeta-600 hover:underline"
                      onClick={() => aoAbrir({ id: r.id } as ReservaTela)}>
                      {r.horaInicio.slice(0, 5)} {r.unidade} · {r.estado === "A_APROVAR" ? "a aprovar" : "confirmada"}
                    </button>
                  ))}
                  {d.bloqueios.length + d.reservas.length === 0 ? <span className="text-[13px] text-tinta-suave">Livre</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-tinta-suave">Compromisso da Agenda marcado na área bloqueia a reserva dela.</p>
        </>
      ) : null}
    </section>
  );
}

function Aprovar({ r, aoFechar }: { r: ReservaTela; aoFechar: (texto?: string) => void }) {
  const [recado, setRecado] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi<{ recusadas?: number }>(`/v1/condominio/reservas/${r.id}/aprovar`, { corpo: { versao: r.versao, recado } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    const outras = res.dados.recusadas ? ` ${res.dados.recusadas === 1 ? "O outro pedido da mesma data foi recusado" : `Os outros ${res.dados.recusadas} pedidos da mesma data foram recusados`}, com o motivo.` : "";
    aoFechar(`Reserva ${r.protocolo} aprovada. O morador recebe a confirmação pelo WhatsApp.${outras}`);
  }
  return (
    <Dialogo aberto titulo={`Aprovar a reserva ${r.protocolo}`} aoFechar={() => aoFechar()}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="text-sm text-tinta-suave">{r.area.nome} · {diaCurto(r.data)} · {horario(r)} · {r.unidade.nome}. A confirmação vai para o morador pelo WhatsApp, assinada com o seu nome.</p>
        {r.outrosPedidos ? <p className="text-sm text-atencao">Os outros pedidos da mesma data serão recusados, com o motivo &quot;A data ficou com outro pedido de reserva&quot;.</p> : null}
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="rs-recado" rotulo="Recado para o morador" opcional maxLength={300} value={recado} onChange={(e) => setRecado(e.target.value)}
          ajuda="Por exemplo: a chave fica com o zelador." />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>Aprovar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function ComMotivo({ tipo, r, aoFechar }: { tipo: "recusar" | "cancelar"; r: ReservaTela; aoFechar: (texto?: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const verbo = tipo === "recusar" ? "Recusar" : "Cancelar";
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi(`/v1/condominio/reservas/${r.id}/${tipo}`, { corpo: { versao: r.versao, motivo } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar(`Reserva ${r.protocolo} ${tipo === "recusar" ? "recusada" : "cancelada"}. O motivo vai para o morador pelo WhatsApp.`);
  }
  return (
    <Dialogo aberto titulo={`${verbo} a reserva ${r.protocolo}`} aoFechar={() => aoFechar()}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="text-sm text-tinta-suave">
          {r.area.nome} · {diaCurto(r.data)} · {r.unidade.nome}{r.contato ? ` · ${r.contato.nome}` : ""}. O motivo vai para o morador pelo WhatsApp, assinado com o seu nome.
        </p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="rs-motivo" rotulo="Motivo" maxLength={500} required value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={comErro.includes("motivo") ? "Escreva o motivo, com pelo menos 3 letras" : null} ajuda="Obrigatório. Sugira outra data quando puder." />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}>{verbo}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function DetalheReserva({ id, aoFechar, aoAgir }: { id: string; aoFechar: () => void; aoAgir: (t: "aprovar" | "recusar" | "cancelar", r: ReservaTela) => void }) {
  const carga = useCarregar<ReservaDetalhe>(`/v1/condominio/reservas/${id}`);
  const titulo = carga.estado === "pronto" ? `Reserva ${carga.dados.reserva.protocolo}` : "Reserva";
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar}>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a reserva…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <Detalhe d={carga.dados} aoFechar={aoFechar} aoAgir={aoAgir} /> : null}
    </Dialogo>
  );
}

function Detalhe({ d, aoFechar, aoAgir }: { d: ReservaDetalhe; aoFechar: () => void; aoAgir: (t: "aprovar" | "recusar" | "cancelar", r: ReservaTela) => void }) {
  const r = d.reserva;
  const { linha, alertas } = detalhes(r);
  return (
    <div className="grid gap-3 text-sm">
      <span className="flex flex-wrap items-center gap-2 font-medium">{r.area.nome} · {diaCurto(r.data)} · {horario(r)}<SeloReserva estado={r.estado} tolerancia={r.tolerancia} /></span>
      <span className="text-tinta-suave">{linha}</span>
      {alertas.map((a) => <span key={a} className="text-[13px] text-atencao">{a}</span>)}
      <h3 className="font-medium">Histórico</h3>
      <ul className="grid gap-1">
        {d.historico.map((h, i) => (
          <li key={i} className="text-[13px]">
            {descreverEventoReserva(h.acao, h.dados)}
            <span className="text-tinta-suave"> · {formatarDataHora(h.em)}{h.autor ? ` · ${h.autor}` : ""}{typeof h.dados.motivo === "string" ? ` · ${h.dados.motivo}` : ""}</span>
          </li>
        ))}
      </ul>
      {d.mensagens.length ? (
        <>
          <h3 className="font-medium">Mensagens ao morador</h3>
          <ul className="grid gap-1">
            {d.mensagens.map((m) => (
              <li key={m.id} className="text-[13px]">
                {formatarDataHora(m.em)} · {ESTADOS_ENVIO_WHATSAPP[m.estado as keyof typeof ESTADOS_ENVIO_WHATSAPP] ?? m.estado}{m.motivo ? ` · ${m.motivo}` : ""}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {d.pode.editar && r.estado === "A_APROVAR" ? (
          <>
            <Botao variante="contorno" onClick={() => aoAgir("recusar", r)}>Recusar</Botao>
            <Botao onClick={() => aoAgir("aprovar", r)}>Aprovar</Botao>
          </>
        ) : null}
        {d.pode.editar && r.estado === "CONFIRMADA" ? <Botao variante="contorno" onClick={() => aoAgir("cancelar", r)}>Cancelar a reserva</Botao> : null}
        <Botao variante="discreto" onClick={aoFechar}>Fechar</Botao>
      </div>
    </div>
  );
}
