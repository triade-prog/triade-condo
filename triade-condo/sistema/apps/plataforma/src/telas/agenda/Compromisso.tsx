"use client";
// Compromisso aberto (design "Telas da Agenda", tela 4; AG-02, AG-04, AG-05): ações com um só
// botão principal; reagendar e cancelar pedem o motivo e a data anterior fica no histórico.
// Num compromisso que se repete, a mudança vale só para esta data ou para esta e as próximas.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { descreverEventoCompromisso, descreverRepeticao, diaDaSemana, ESCOPOS, mostrarDataCurta, mostrarHorario, TIPOS_COMPROMISSO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, ErroCarregar, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { Janela } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { CompromissoAgenda, CompromissoDetalhe, ConflitoCompromisso, OpcoesAgenda, Recado } from "../tipos.ts";
import { ListaConflitos, quemParticipa, SeloSituacao, Tipo } from "./comum.tsx";
import { FormCompromisso } from "./FormCompromisso.tsx";

type Acao = "editar" | "reagendar" | "cancelar" | null;
const opcoesEscopo = Object.entries(ESCOPOS).map(([valor, texto]) => ({ valor, texto }));

export function Compromisso() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const carga = useCarregar<CompromissoDetalhe>(id ? `/v1/condominio/agenda/${id}` : null);
  const opcoes = useCarregar<OpcoesAgenda>("/v1/condominio/agenda/opcoes");
  const [acao, setAcao] = useState<Acao>(null);
  const [recado, setRecado] = useState<Recado>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const voltar = <Link href="/agenda" className="t-texto font-medium text-violeta-600 hover:underline">Voltar à agenda</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela font-normal tracking-tight">Compromisso</h1><Vazio titulo="Compromisso não encontrado" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o compromisso…" />;
  if (carga.estado === "erro") {
    return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela font-normal tracking-tight">Compromisso</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  }

  const d = carga.dados;
  const c = d.compromisso;
  const aberto = c.estado !== "REALIZADO" && c.estado !== "CANCELADO";
  const pode = d.pode.editar && aberto;
  const salvo = (texto: string) => { setAcao(null); setRecado({ tom: "ok", texto }); setFalha(null); carga.recarregar(); };

  async function situacao(estado: "CONFIRMADO" | "A_CONFIRMAR" | "REALIZADO", texto: string) {
    const r = await chamarApi(`/v1/condominio/agenda/${c.id}/situacao`, { corpo: { versao: c.versao, estado } });
    if (!r.ok) return setFalha(r.erro);
    salvo(texto);
  }

  const quando = [`${diaDaSemana(c.data).replace(/^./, (x) => x.toUpperCase())}, ${mostrarDataCurta(c.data)}`, mostrarHorario(c), c.lugar].filter(Boolean).join(" · ");
  const quem = quemParticipa(c);

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="grid gap-2">
        <Tipo tipo={c.tipo} />
        <h1 className="t-titulo-tela font-normal tracking-tight">{c.titulo}</h1>
        <p className="flex flex-wrap items-center gap-2 t-texto">
          <SeloSituacao estado={c.estado} />
          {c.serie ? <span className="text-tinta-suave">{descreverRepeticao(c.serie)}</span> : null}
        </p>
        <p className="t-texto">{quando}</p>
        {quem ? <p className="t-apoio text-tinta-suave">Quem participa: {quem}</p> : null}
        <p className="t-apoio text-tinta-suave">Registrado por {c.registradoPor ?? "alguém sem acesso agora"} em {diaHora(c.registradoEm)}</p>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); carga.recarregar(); }} /> : null}
      {c.cancelamento ? <Aviso tom="info" titulo="Compromisso cancelado">{c.cancelamento.por ?? "Alguém"} em {diaHora(c.cancelamento.em)}. Motivo: {c.cancelamento.motivo}</Aviso> : null}
      {c.estado === "REALIZADO" ? <Aviso tom="ok">Realizado{c.realizadoEm ? ` (marcado em ${diaHora(c.realizadoEm)})` : ""}. Para outro encontro, marque um compromisso novo.</Aviso> : null}
      {d.conflitos.length ? (
        <Aviso tom="atencao" titulo="Conflita com outro compromisso" papel="status"><ListaConflitos conflitos={d.conflitos} /></Aviso>
      ) : null}

      {c.pedido ? (
        <p className="t-texto">Pedido ligado: <Link href={`/pedidos/pedido?id=${c.pedido.id}`} className="font-medium text-violeta-600 hover:underline">{c.pedido.protocolo} · {c.pedido.assunto}</Link></p>
      ) : c.pedidoOculto ? <p className="t-apoio text-tinta-suave">Ligado a um pedido que você não vê.</p> : null}
      {c.manutencao ? (
        <p className="t-texto">Manutenção ligada: <Link href={`/manutencao/manutencao?id=${c.manutencao.id}`} className="font-medium text-violeta-600 hover:underline">{c.manutencao.titulo}</Link>
          <span className="text-tinta-suave"> · cancelar a visita não apaga a manutenção</span></p>
      ) : null}
      {c.observacao ? <p className="whitespace-pre-line rounded-2xl border border-linha bg-superficie p-4 t-texto">{c.observacao}</p> : null}

      {pode ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {c.estado !== "CONFIRMADO" ? <Botao onClick={() => void situacao("CONFIRMADO", "Compromisso confirmado.")}>Confirmar</Botao> : null}
          <Botao variante={c.estado === "CONFIRMADO" ? "primario" : "secundario"} onClick={() => setAcao("reagendar")}>Reagendar</Botao>
          <Botao variante="contorno" onClick={() => setAcao("editar")}>Editar</Botao>
          {c.estado === "PLANEJADO" ? <Botao variante="contorno" onClick={() => void situacao("A_CONFIRMAR", "Marcado como a confirmar.")}>A confirmar</Botao> : null}
          {c.data <= d.hoje ? <Botao variante="contorno" onClick={() => void situacao("REALIZADO", "Compromisso marcado como realizado.")}>Marcar realizado</Botao> : null}
          <Botao variante="discreto" className="text-erro" onClick={() => setAcao("cancelar")}>Cancelar compromisso</Botao>
        </div>
      ) : null}
      {pode && c.serie ? (
        <Aviso tom="info" titulo="Este compromisso se repete">Ao mudar, você escolhe: só esta data, ou esta e as próximas. As datas que já passaram não mudam.</Aviso>
      ) : null}

      <section aria-labelledby="t-hist" className="grid gap-2">
        <h2 id="t-hist" className="t-titulo-secao font-medium">Histórico</h2>
        <ol className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
          {d.historico.map((h, i) => (
            <li key={i} className="grid gap-0.5 px-4 py-2.5 t-texto">
              <span>{descreverEventoCompromisso(h.acao, h.dados)}</span>
              <span className="t-apoio text-tinta-suave">
                {h.autor ?? "Sistema"} · {diaHora(h.em)}{typeof h.dados.motivo === "string" ? ` · "${h.dados.motivo}"` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {opcoes.estado === "pronto" ? (
        <FormCompromisso aberto={acao === "editar"} compromisso={c} opcoes={opcoes.dados} aoFechar={() => setAcao(null)}
          salvo={(_, texto) => salvo(texto)} recarregar={carga.recarregar} />
      ) : null}
      <Reagendar aberto={acao === "reagendar"} c={c} aoFechar={() => setAcao(null)} salvo={salvo} recarregar={carga.recarregar} />
      <Janela aberto={acao === "cancelar"} titulo="Cancelar compromisso" textoBotao="Cancelar compromisso" aoFechar={() => setAcao(null)} recarregar={carga.recarregar}
        explicacao="Cancelado não volta atrás. O motivo fica no histórico."
        campos={[
          { id: "motivo", rotulo: "Por que cancelar", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." },
          ...(c.serie ? [{ id: "escopo", rotulo: "Vale para", tipo: "selecao" as const, opcoes: opcoesEscopo }] : []),
        ]}
        iniciais={{ motivo: "", escopo: "ESTA" }}
        aoSalvar={async (v) => {
          const r = await chamarApi<{ cancelados: number }>(`/v1/condominio/agenda/${c.id}/cancelar`, { corpo: { versao: c.versao, motivo: v.motivo, escopo: v.escopo } });
          if (r.ok) salvo(r.dados.cancelados > 1 ? `${r.dados.cancelados} datas canceladas.` : "Compromisso cancelado.");
          return r;
        }} />
    </div>
  );
}

function Reagendar({ aberto, c, aoFechar, salvo, recarregar }: {
  aberto: boolean; c: CompromissoAgenda; aoFechar: () => void; salvo: (texto: string) => void; recarregar: () => void;
}) {
  return (
    <Dialogo aberto={aberto} titulo="Reagendar" aoFechar={aoFechar}>
      {aberto ? <FormReagendar c={c} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

function FormReagendar({ c, aoFechar, salvo, recarregar }: { c: CompromissoAgenda; aoFechar: () => void; salvo: (texto: string) => void; recarregar: () => void }) {
  const [v, setV] = useState({ data: c.data, diaTodo: c.diaTodo, horaInicio: c.horaInicio ?? "", horaFim: c.horaFim ?? "", motivo: "", escopo: "ESTA" });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [conflitos, setConflitos] = useState<ConflitoCompromisso[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudar = (m: Partial<typeof v>) => { setV((x) => ({ ...x, ...m })); setConflitos(null); };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ alterados: number }>(`/v1/condominio/agenda/${c.id}/reagendar`, { corpo: {
      versao: c.versao, data: v.data, horaInicio: v.diaTodo ? null : v.horaInicio || null, horaFim: v.diaTodo ? null : v.horaFim || null,
      motivo: v.motivo, escopo: c.serie ? v.escopo : "ESTA", aceitarConflito: conflitos !== null,
    } });
    setEnviando(false);
    if (!r.ok) {
      const lista = r.erro.detalhes?.conflitos;
      if (r.erro.detalhes?.motivo === "CONFLITO_HORARIO" && Array.isArray(lista)) return setConflitos(lista as ConflitoCompromisso[]);
      return setErro(r.erro);
    }
    salvo(r.dados.alterados > 1 ? `${r.dados.alterados} datas reagendadas.` : `Reagendado para ${mostrarDataCurta(v.data)}.`);
  }

  const comErro = camposComErro(erro);
  const msg = (campo: string, texto: string) => (comErro.includes(campo) ? texto : null);
  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <p className="t-apoio text-tinta-suave">Hoje: {TIPOS_COMPROMISSO[c.tipo].toLowerCase()} em {mostrarDataCurta(c.data)}, {mostrarHorario(c).toLowerCase()}.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto id="re-data" rotulo="Nova data" type="date" required value={v.data} erro={msg("data", "Escolha uma data válida.")} onChange={(e) => mudar({ data: e.target.value })} />
        <CampoTexto id="re-inicio" rotulo="Começa" type="time" value={v.horaInicio} disabled={v.diaTodo} onChange={(e) => mudar({ horaInicio: e.target.value })} />
        <CampoTexto id="re-fim" rotulo="Termina" type="time" opcional value={v.horaFim} disabled={v.diaTodo} erro={msg("horaFim", "O fim vem depois do início.")}
          onChange={(e) => mudar({ horaFim: e.target.value })} />
      </div>
      <Caixa id="re-dia-todo" rotulo="Dia todo" marcada={v.diaTodo} aoMudar={(x) => mudar({ diaTodo: x })} />
      <CampoAreaTexto id="re-motivo" rotulo="Por que mudou" required maxLength={500} value={v.motivo} erro={msg("motivo", "Diga o motivo, de 3 a 500 caracteres.")}
        onChange={(e) => mudar({ motivo: e.target.value })} />
      {c.serie ? <Escolha rotulo="Vale para" atual={v.escopo} aoMudar={(x) => mudar({ escopo: x })} opcoes={opcoesEscopo} /> : null}
      <p className="t-apoio text-tinta-suave">A data anterior fica no histórico.{c.serie ? " Nas próximas, a mesma diferença de dias vale para cada data." : ""}</p>
      {conflitos ? (
        <Aviso tom="atencao" titulo="Conflita com outro compromisso">
          <ListaConflitos conflitos={conflitos} />
          <span className="mt-1 block">Dá para reagendar mesmo assim.</span>
        </Aviso>
      ) : null}
      <div className="flex justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : conflitos ? "Reagendar mesmo assim" : "Reagendar"}</Botao>
      </div>
    </form>
  );
}
