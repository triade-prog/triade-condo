"use client";
// Agenda de demonstrações (quadro 341, CM-23): as próximas, as que passaram sem registro, os
// horários livres de cada pessoa, os bloqueios e os links de agendamento. Quem agenda pelo link
// entra no funil como Demonstração marcada, com responsável e próximo passo; a demonstração feita
// pede o registro da conversa e o próximo passo. A grade e a trava do mesmo horário são do banco.

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DIAS_SEMANA_AGENDA, ETAPAS_ABERTAS } from "@triade/domain";
import {
  Aviso, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Interruptor, Selo, Vazio, type ErroApi,
} from "@triade/ui";
import { CabecaPagina, Cartao, diaHora, plural } from "../comum.tsx";
import { EscolhaBotoes, ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import { hojeLocal, ROTAS_COMERCIAL, somarDias } from "./comum.tsx";
import {
  apoioDisponibilidade, campoBrasilia, faixasParaCampo, instanteBrasilia, lerFaixasDoDia, linhasHorarios, MOTIVOS_AGENDA, quandoCurtoDemo, ROTAS_AGENDA, seloDemonstracao,
  textoEmails, urlAgenda, type Demonstracao, type DisponibilidadePessoa, type FaixaHorario, type LinkAgenda, type PessoaAgenda, type TelaAgenda,
} from "./agenda.ts";
import type { ListaComercial } from "./tipos.ts";

const DURACOES = [15, 30, 45, 60, 90].map((m) => ({ valor: String(m), texto: `${m} minutos` }));
const motivoDe = (e: ErroApi | null) => (e?.detalhes?.motivo ? MOTIVOS_AGENDA[String(e.detalhes.motivo)] : undefined);

function ErroAgenda({ erro }: { erro: ErroApi }) {
  const m = motivoDe(erro);
  return m ? <Aviso tom="atencao" papel="alert">{m}</Aviso> : <ErroJanela erro={erro} />;
}

/** Data e hora em dois campos (horário de Brasília). */
function CamposHorario({ id, data, hora, aoMudar, erro }: { id: string; data: string; hora: string; aoMudar: (d: string, h: string) => void; erro?: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CampoTexto id={`${id}-data`} rotulo="Dia" type="date" min={hojeLocal()} value={data} onChange={(e) => aoMudar(e.target.value, hora)} erro={erro} />
      <CampoTexto id={`${id}-hora`} rotulo="Hora (Brasília)" type="time" step={300} value={hora} onChange={(e) => aoMudar(data, e.target.value)} />
    </div>
  );
}

/** "Marcar à mão" (quadro 341): para um interessado aberto; pode ficar fora da grade, nunca em cima de outra. */
function JanelaMarcar({ a, aoFechar, feito }: { a: TelaAgenda; aoFechar: () => void; feito: (d: Demonstracao) => void }) {
  const [busca, setBusca] = useState("");
  const [q, setQ] = useState("");
  const lista = useCarregar<ListaComercial>(q.length >= 2 ? `${ROTAS_COMERCIAL.lista}?q=${encodeURIComponent(q)}` : null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [com, setCom] = useState(a.equipe.some((p) => p.id === a.eu) ? a.eu : a.equipe[0]?.id ?? "");
  const [data, setData] = useState(somarDias(hojeLocal(), 1));
  const [hora, setHora] = useState("10:00");
  const [duracao, setDuracao] = useState("30");
  const [avisar, setAvisar] = useState(true);
  const [falha, setFalha] = useState<string | undefined>();
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setQ(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const abertos = q.length >= 2 && lista.estado === "pronto" ? lista.dados.interessados.filter((i) => ETAPAS_ABERTAS.includes(i.etapa)).slice(0, 8) : [];

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const inicio = instanteBrasilia(data, hora);
    if (!escolhido) return setFalha("Escolha o interessado.");
    if (!inicio) return setFalha("Escolha o dia e a hora.");
    setFalha(undefined);
    setEnviando(true);
    const r = await chamarApi<Demonstracao>(ROTAS_AGENDA.marcar(escolhido), { corpo: { inicio, pessoaId: com || null, duracaoMinutos: Number(duracao), avisar } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(r.dados);
  }

  return (
    <Dialogo aberto titulo="Marcar demonstração à mão" aoFechar={aoFechar} media
      apoio="Para um interessado aberto. Pode ser fora dos horários livres, mas nunca em cima de outra demonstração da mesma pessoa.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoTexto id="marcar-busca" rotulo="Interessado" type="search" icone="busca" maxLength={60} placeholder="Condomínio, pessoa ou WhatsApp" value={busca}
          onChange={(e) => { setBusca(e.target.value); setEscolhido(null); }} ajuda="Digite ao menos duas letras." />
        {q.length >= 2 && lista.estado === "carregando" ? <Carregando linhas={1} rotulo="Buscando…" /> : null}
        {q.length >= 2 && lista.estado === "pronto" && !abertos.length ? <p className="t-apoio">Nenhum interessado aberto com esse nome.</p> : null}
        {abertos.length ? (
          <EscolhaBotoes nome="marcar-interessado" legenda="Escolha o interessado" valor={escolhido} aoMudar={setEscolhido}
            opcoes={abertos.map((i) => ({ valor: i.id, texto: i.pessoa ? `${i.condominio} · ${i.pessoa}` : i.condominio }))} />
        ) : null}
        <CamposHorario id="marcar" data={data} hora={hora} aoMudar={(d, h) => { setData(d); setHora(h); }} erro={camposComErro(erro).includes("inicio") ? "Escolha um horário no futuro." : undefined} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoSelecao id="marcar-com" rotulo="Quem faz" value={com} onChange={(e) => setCom(e.target.value)} opcoes={a.equipe.map((p) => ({ valor: p.id, texto: p.nome }))} />
          <CampoSelecao id="marcar-duracao" rotulo="Duração" value={duracao} onChange={(e) => setDuracao(e.target.value)} opcoes={DURACOES} />
        </div>
        <Interruptor id="marcar-avisar" rotulo="Mandar a confirmação por e-mail" marcado={avisar} aoMudar={setAvisar}
          ajuda="Sai pelo e-mail da ficha, com o lembrete no dia. Sem e-mail na ficha, nada sai." />
        {falha ? <Aviso tom="atencao" papel="alert">{falha}</Aviso> : null}
        {erro && !camposComErro(erro).length ? <ErroAgenda erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Marcar a demonstração" icone="calendario" />
      </form>
    </Dialogo>
  );
}

function JanelaRemarcar({ d, equipe, aoFechar, feito }: { d: Demonstracao; equipe: PessoaAgenda[]; aoFechar: () => void; feito: () => void }) {
  const atual = campoBrasilia(d.inicio);
  const [data, setData] = useState(atual.data);
  const [hora, setHora] = useState(atual.hora);
  const [com, setCom] = useState(d.com.id);
  const [avisar, setAvisar] = useState(true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_AGENDA.remarcar(d.id), { corpo: { versao: d.versao, inicio: instanteBrasilia(data, hora) ?? "", pessoaId: com, avisar } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Remarcar ${d.interessado.condominio}`} aoFechar={aoFechar} media apoio={`Hoje está em ${d.quando}, com ${d.com.nome}.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CamposHorario id="remarcar" data={data} hora={hora} aoMudar={(a, b) => { setData(a); setHora(b); }}
          erro={camposComErro(erro).includes("inicio") ? "Escolha um horário no futuro." : undefined} />
        <CampoSelecao id="remarcar-com" rotulo="Quem faz" value={com} onChange={(e) => setCom(e.target.value)} opcoes={equipe.map((p) => ({ valor: p.id, texto: p.nome }))} />
        <Interruptor id="remarcar-avisar" rotulo="Avisar por e-mail" marcado={avisar} aoMudar={setAvisar} ajuda="Manda a nova confirmação e troca o lembrete." />
        {erro && !camposComErro(erro).length ? <ErroAgenda erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Remarcar" icone="calendario" />
      </form>
    </Dialogo>
  );
}

/** "Registrar como foi": o resumo da conversa e o próximo passo são obrigatórios (CM-23). */
function JanelaFeita({ d, aoFechar, feito }: { d: Demonstracao; aoFechar: () => void; feito: () => void }) {
  const [resumo, setResumo] = useState("");
  const [passo, setPasso] = useState("Mandar a proposta");
  const [data, setData] = useState(somarDias(hojeLocal(), 1));
  const [hora, setHora] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_AGENDA.feita(d.id), { corpo: { versao: d.versao, resumo: resumo.trim(), proximoPasso: passo.trim(), proximoPassoData: data, proximoPassoHora: hora || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Como foi a demonstração de ${d.interessado.condominio}`} aoFechar={aoFechar} media
      apoio="Vira uma conversa na ficha e o interessado passa para Demonstração feita, com o próximo passo.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoAreaTexto id="feita-resumo" rotulo="O que conversaram" maxLength={2000} rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)}
          erro={campos.includes("resumo") ? "Conte como foi a demonstração." : undefined} />
        <CampoTexto id="feita-passo" rotulo="Próximo passo" maxLength={200} value={passo} onChange={(e) => setPasso(e.target.value)}
          erro={campos.includes("proximoPasso") ? "Diga o próximo passo e a data." : undefined} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="feita-data" rotulo="Quando" type="date" min={hojeLocal()} value={data} onChange={(e) => setData(e.target.value)}
            erro={campos.includes("proximoPassoData") ? "Confira a data do próximo passo." : undefined} />
          <CampoTexto id="feita-hora" rotulo="Hora" opcional type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        {erro && !campos.length ? <ErroAgenda erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Registrar" />
      </form>
    </Dialogo>
  );
}

function JanelaEncerrar({ d, aoFechar, feito }: { d: Demonstracao; aoFechar: () => void; feito: (texto: string) => void }) {
  // Já começou: a lista "A registrar" só traz as que passaram (o fim já foi).
  const [passou] = useState(() => new Date(d.inicio).getTime() <= Date.now());
  const [situacao, setSituacao] = useState<"NAO_COMPARECEU" | "CANCELADA">(passou ? "NAO_COMPARECEU" : "CANCELADA");
  const [motivo, setMotivo] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await chamarApi(ROTAS_AGENDA.encerrar(d.id), { corpo: { versao: d.versao, situacao, motivo: motivo.trim() || null, avisar: situacao === "CANCELADA" && avisar } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(situacao === "CANCELADA" ? "Demonstração cancelada." : "Registrado: não compareceu.");
  }

  return (
    <Dialogo aberto titulo={`Encerrar a demonstração de ${d.interessado.condominio}`} aoFechar={aoFechar} media apoio={`${d.quando}, com ${d.com.nome}.`}>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <EscolhaBotoes nome="encerrar-situacao" legenda="O que aconteceu" valor={situacao} aoMudar={setSituacao}
          opcoes={[...(passou ? [{ valor: "NAO_COMPARECEU" as const, texto: "Não compareceu" }] : []), { valor: "CANCELADA" as const, texto: "Cancelada" }]} />
        <CampoAreaTexto id="encerrar-motivo" rotulo="Motivo" opcional={situacao !== "CANCELADA"} maxLength={300} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={campos.includes("motivo") ? "Diga por que cancelou." : undefined} />
        {situacao === "CANCELADA" ? (
          <Interruptor id="encerrar-avisar" rotulo="Avisar por e-mail" marcado={avisar} aoMudar={setAvisar} ajuda="Manda o aviso de cancelamento e tira o lembrete da fila." />
        ) : null}
        {erro && !campos.length ? <ErroAgenda erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto={situacao === "CANCELADA" ? "Cancelar a demonstração" : "Registrar"} perigo={situacao === "CANCELADA"} />
      </form>
    </Dialogo>
  );
}

/** Os horários livres de uma pessoa, por dia da semana, com duração, intervalo e aviso. */
function JanelaDisponibilidade({ d, aoFechar, feito }: { d: DisponibilidadePessoa; aoFechar: () => void; feito: () => void }) {
  const [dias, setDias] = useState<Record<number, string>>(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, faixasParaCampo(d.faixas, n)])));
  const [num, setNum] = useState({ duracao: String(d.duracaoMinutos), intervalo: String(d.intervaloMinutos), aviso: String(d.avisoDiasUteis), horizonte: String(d.horizonteDias) });
  const [sala, setSala] = useState(d.salaUrl ?? "");
  const [ativa, setAtiva] = useState(d.configurada ? d.ativa : true);
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const f: Record<string, string> = {};
    const faixas: FaixaHorario[] = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const r = lerFaixasDoDia(n, dias[n] ?? "");
      if ("erro" in r) f[`dia${n}`] = r.erro;
      else faixas.push(...r.faixas);
    }
    const inteiro = (t: string, min: number, max: number, k: string, texto: string) => {
      const v = Number(t);
      if (!Number.isInteger(v) || v < min || v > max) f[k] = texto;
      return v;
    };
    const duracaoMinutos = inteiro(num.duracao, 15, 120, "duracao", "De 15 a 120 minutos.");
    const intervaloMinutos = inteiro(num.intervalo, 0, 60, "intervalo", "De 0 a 60 minutos.");
    const avisoDiasUteis = inteiro(num.aviso, 0, 10, "aviso", "De 0 a 10 dias úteis.");
    const horizonteDias = inteiro(num.horizonte, 1, 60, "horizonte", "De 1 a 60 dias.");
    if (sala.trim() && !/^https:\/\/[^\s<>"]{3,}$/.test(sala.trim())) f.sala = "O link da sala começa com https://";
    setFalhas(f);
    if (Object.keys(f).length) return;
    setEnviando(true);
    const r = await chamarApi(ROTAS_AGENDA.disponibilidade(d.pessoa.id), {
      metodo: "PUT",
      corpo: { versao: d.configurada ? d.versao : null, faixas, duracaoMinutos, intervaloMinutos, avisoDiasUteis, horizonteDias, salaUrl: sala.trim() || null, ativa },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo={`Horários livres de ${d.pessoa.nome}`} aoFechar={aoFechar} larga
      apoio="Escreva os horários de cada dia como 10:00-12:00, 14:00-17:00. Dia vazio fica sem demonstração. Horário de Brasília.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <div className="grid gap-3 md:grid-cols-2">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
            <CampoTexto key={n} id={`disp-dia-${n}`} rotulo={DIAS_SEMANA_AGENDA[n]} opcional maxLength={120} placeholder={n <= 5 ? "10:00-12:00, 14:00-17:00" : ""}
              value={dias[n] ?? ""} onChange={(e) => setDias((x) => ({ ...x, [n]: e.target.value }))} erro={falhas[`dia${n}`]} />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <CampoTexto id="disp-duracao" rotulo="Duração (min)" inputMode="numeric" maxLength={3} value={num.duracao} onChange={(e) => setNum((x) => ({ ...x, duracao: e.target.value }))} erro={falhas.duracao} />
          <CampoTexto id="disp-intervalo" rotulo="Intervalo (min)" inputMode="numeric" maxLength={2} value={num.intervalo} onChange={(e) => setNum((x) => ({ ...x, intervalo: e.target.value }))} erro={falhas.intervalo} />
          <CampoTexto id="disp-aviso" rotulo="Aviso (dias úteis)" inputMode="numeric" maxLength={2} value={num.aviso} onChange={(e) => setNum((x) => ({ ...x, aviso: e.target.value }))} erro={falhas.aviso} />
          <CampoTexto id="disp-horizonte" rotulo="Até quantos dias à frente" inputMode="numeric" maxLength={2} value={num.horizonte} onChange={(e) => setNum((x) => ({ ...x, horizonte: e.target.value }))} erro={falhas.horizonte} />
        </div>
        <CampoTexto id="disp-sala" rotulo="Link da sala de vídeo" opcional type="url" maxLength={300} placeholder="https://meet.google.com/..." value={sala} onChange={(e) => setSala(e.target.value)}
          ajuda="Vai na confirmação por e-mail." erro={falhas.sala} />
        <Interruptor id="disp-ativa" rotulo="Aparece no link de agendamento" marcado={ativa} aoMudar={setAtiva} ajuda="Desligado, ninguém agenda com esta pessoa pelo link; a equipe ainda marca à mão." />
        {erro && !camposComErro(erro).length ? <ErroJanela erro={erro} /> : null}
        {erro && camposComErro(erro).length ? <Aviso tom="erro" papel="alert">Confira os horários, a duração, o intervalo, o aviso e o link da sala.</Aviso> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar os horários" />
      </form>
    </Dialogo>
  );
}

function JanelaBloqueio({ a, pessoa, aoFechar, feito }: { a: TelaAgenda; pessoa: string; aoFechar: () => void; feito: () => void }) {
  const amanha = somarDias(hojeLocal(), 1);
  const [de, setDe] = useState(pessoa);
  const [f, setF] = useState({ dataDe: amanha, horaDe: "09:00", dataAte: amanha, horaAte: "18:00", motivo: "" });
  const [falha, setFalha] = useState<string | undefined>();
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const inicio = instanteBrasilia(f.dataDe, f.horaDe);
    const fim = instanteBrasilia(f.dataAte, f.horaAte);
    if (!inicio || !fim || Date.parse(fim) <= Date.parse(inicio)) return setFalha("O bloqueio vai de um horário a outro, até 60 dias.");
    setFalha(undefined);
    setEnviando(true);
    const r = await chamarApi(ROTAS_AGENDA.bloqueios, { corpo: { pessoaId: de, de: inicio, ate: fim, motivo: f.motivo.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo="Bloquear horário" aoFechar={aoFechar} media apoio="Folga, reunião, viagem: o link não oferece esses horários. As demonstrações já marcadas continuam.">
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <CampoSelecao id="bloqueio-pessoa" rotulo="De quem" value={de} onChange={(e) => setDe(e.target.value)} opcoes={a.equipe.map((p) => ({ valor: p.id, texto: p.nome }))} />
        <div className="grid gap-4 md:grid-cols-2">
          <CampoTexto id="bloqueio-data-de" rotulo="De (dia)" type="date" min={hojeLocal()} value={f.dataDe} onChange={muda("dataDe")} />
          <CampoTexto id="bloqueio-hora-de" rotulo="De (hora)" type="time" value={f.horaDe} onChange={muda("horaDe")} />
          <CampoTexto id="bloqueio-data-ate" rotulo="Até (dia)" type="date" min={f.dataDe} value={f.dataAte} onChange={muda("dataAte")} />
          <CampoTexto id="bloqueio-hora-ate" rotulo="Até (hora)" type="time" value={f.horaAte} onChange={muda("horaAte")} />
        </div>
        <CampoTexto id="bloqueio-motivo" rotulo="Motivo" opcional maxLength={120} value={f.motivo} onChange={muda("motivo")} placeholder="Folga" />
        {falha ? <Aviso tom="atencao" papel="alert">{falha}</Aviso> : null}
        {erro ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Bloquear" />
      </form>
    </Dialogo>
  );
}

function ListaDemos({ demos, rotulo, vazio, acoes }: { demos: Demonstracao[]; rotulo: string; vazio: string; acoes?: (d: Demonstracao) => ReactNode }) {
  if (!demos.length) return <p className="t-apoio">{vazio}</p>;
  return (
    <ul className="divide-y divide-linha" aria-label={rotulo}>
      {demos.map((d) => {
        const s = seloDemonstracao(d);
        return (
          <li key={d.id} className="grid gap-1.5 py-3 md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-start md:gap-3">
            <span className="font-medium tabular-nums">{quandoCurtoDemo(d.inicio)}</span>
            <span className="grid gap-0.5">
              <Link href={`/comercial/${d.interessado.id}`} className="font-medium hover:text-violeta-600 hover:underline [overflow-wrap:anywhere]">{d.interessado.condominio}</Link>
              <span className="t-apoio">{`com ${d.com.nome}${d.interessado.pessoa ? ` · ${d.interessado.pessoa}` : ""}`}</span>
              {d.situacao === "MARCADA" ? <span className="t-apoio">{textoEmails(d)}</span> : d.motivo ? <span className="t-apoio">{d.motivo}</span> : null}
            </span>
            <span className="flex flex-wrap items-center gap-2 md:justify-end">
              <Selo tom={s.tom}>{s.texto}</Selo>
              {acoes?.(d)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function Agenda() {
  const carga = useCarregar<TelaAgenda>(ROTAS_AGENDA.agenda);
  const [pessoa, setPessoa] = useState<string | null>(null);
  const [janela, setJanela] = useState<
    | { tipo: "marcar" | "disponibilidade" | "bloqueio" }
    | { tipo: "remarcar" | "feita" | "encerrar"; d: Demonstracao }
    | null
  >(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "atencao"; texto: string } | null>(null);
  const [erroLink, setErroLink] = useState<ErroApi | null>(null);
  const a = carga.estado === "pronto" ? carga.dados : null;
  const fechar = (texto?: string) => { setJanela(null); if (texto) { setAviso({ tom: "ok", texto }); carga.recarregar(); } };

  async function link(pessoaId: string | null, trocar = false) {
    setErroLink(null);
    const r = await chamarApi<LinkAgenda>(ROTAS_AGENDA.links, { corpo: { pessoaId, trocar } });
    if (!r.ok) return setErroLink(r.erro);
    const url = urlAgenda(window.location.origin, r.dados.codigo);
    const ok = await copiar(url);
    setAviso({ tom: ok ? "ok" : "atencao", texto: ok ? `${trocar ? "Link trocado e copiado" : "Link copiado"}: ${url}` : `Copie o link: ${url}` });
    carga.recarregar();
  }

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a agenda…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const x = a!;
  const escolhida = pessoa ?? (x.disponibilidades.some((d) => d.pessoa.id === x.eu) ? x.eu : x.disponibilidades[0]?.pessoa.id ?? null);
  const disp = x.disponibilidades.find((d) => d.pessoa.id === escolhida) ?? null;
  const nome = (id?: string) => (id ? x.equipe.find((p) => p.id === id)?.nome ?? "Alguém que saiu da equipe" : "Toda a equipe");
  const linkEquipe = x.links.find((l) => !l.pessoaId);
  const acoesProximas = (d: Demonstracao) => x.podeEditar ? (
    <>
      <Botao variante="discreto" tamanho="p" onClick={() => setJanela({ tipo: "remarcar", d })}>Remarcar</Botao>
      <Botao variante="discreto" tamanho="p" onClick={() => setJanela({ tipo: "encerrar", d })}>Cancelar</Botao>
    </>
  ) : null;
  const acoesRegistrar = (d: Demonstracao) => x.podeEditar ? (
    <>
      <Botao variante="secundario" tamanho="p" onClick={() => setJanela({ tipo: "feita", d })}>Registrar como foi</Botao>
      <Botao variante="discreto" tamanho="p" onClick={() => setJanela({ tipo: "encerrar", d })}>Não compareceu</Botao>
    </>
  ) : null;

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Agenda de demonstrações"
        apoio="Quem agenda pelo link entra no funil como Demonstração marcada, com responsável e próximo passo."
        acao={x.podeEditar ? (
          <div className="flex flex-wrap gap-2 max-md:grid max-md:w-full">
            <Botao variante="contorno" onClick={() => void link(null)}><Icone nome="link" />Copiar o link de agendamento</Botao>
            <Botao onClick={() => setJanela({ tipo: "marcar" })}><Icone nome="mais" />Marcar à mão</Botao>
          </div>
        ) : undefined} />
      {aviso ? <Aviso tom={aviso.tom} papel="status"><span className="[overflow-wrap:anywhere]">{aviso.texto}</span></Aviso> : null}
      {erroLink ? <ErroJanela erro={erroLink} /> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {x.aRegistrar.length ? (
            <Cartao id="agenda-registrar" titulo={`A registrar · ${x.aRegistrar.length}`} icone="alerta">
              <p className="t-apoio">Já passaram e ainda não têm o registro da conversa e o próximo passo.</p>
              <ListaDemos demos={x.aRegistrar} rotulo="Demonstrações a registrar" vazio="" acoes={acoesRegistrar} />
            </Cartao>
          ) : null}
          <Cartao id="agenda-proximas" titulo="Próximas" icone="calendario">
            {x.proximas.length ? <ListaDemos demos={x.proximas} rotulo="Próximas demonstrações" vazio="" acoes={acoesProximas} /> : (
              <Vazio titulo="Nenhuma demonstração marcada" icone="calendario">Mande o link de agendamento na mensagem pronta ou marque à mão.</Vazio>
            )}
          </Cartao>
          <Cartao id="agenda-recentes" titulo="Últimos 14 dias" icone="relogio">
            <ListaDemos demos={x.recentes} rotulo="Demonstrações encerradas nos últimos 14 dias" vazio="Nenhuma demonstração encerrada nos últimos 14 dias." />
          </Cartao>
        </div>

        <div className="grid content-start gap-5">
          <Cartao id="agenda-livres" titulo={disp ? `Horários livres de ${disp.pessoa.nome}` : "Horários livres"} icone="relogio"
            acao={disp && x.podeEditar ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "disponibilidade" })}><Icone nome="editar" />Editar</Botao> : undefined}>
            {x.disponibilidades.length > 1 ? (
              <CampoSelecao id="agenda-pessoa" rotulo="De quem" value={escolhida ?? ""} onChange={(e) => setPessoa(e.target.value)}
                opcoes={x.disponibilidades.map((d) => ({ valor: d.pessoa.id, texto: `${d.pessoa.nome}${d.configurada ? "" : " (sem horários)"}` }))} />
            ) : null}
            {disp ? (
              <>
                {!disp.configurada ? <Aviso tom="atencao">Ainda sem horários: o link não oferece demonstração com esta pessoa.</Aviso> : null}
                {disp.configurada && !disp.ativa ? <Aviso tom="atencao">Fora do link de agendamento por enquanto.</Aviso> : null}
                <dl className="divide-y divide-linha">
                  {linhasHorarios(disp.faixas).map((l) => (
                    <div key={l.dia} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 py-2 t-texto">
                      <dt className="text-tinta-suave">{l.nome}</dt><dd>{l.texto}</dd>
                    </div>
                  ))}
                </dl>
                <p className="t-apoio">{apoioDisponibilidade(disp)}</p>
              </>
            ) : <p className="t-apoio">Ninguém do Comercial ativo na equipe.</p>}
          </Cartao>

          <Cartao id="agenda-bloqueios" titulo="Bloqueios" icone="pausa"
            acao={x.podeEditar && x.equipe.length ? <Botao variante="discreto" onClick={() => setJanela({ tipo: "bloqueio" })}><Icone nome="mais" />Bloquear</Botao> : undefined}>
            {x.bloqueios.length ? (
              <ul className="divide-y divide-linha">
                {x.bloqueios.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="grid">
                      <span className="t-texto">{`${b.pessoa.nome} · ${b.motivo ?? "Bloqueado"}`}</span>
                      <span className="t-apoio">{`${diaHora(b.de)} até ${diaHora(b.ate)}`}</span>
                    </span>
                    {x.podeEditar ? (
                      <Botao variante="discreto" tamanho="p" onClick={async () => {
                        const r = await chamarApi(ROTAS_AGENDA.cancelarBloqueio(b.id), { corpo: {} });
                        if (r.ok) { setAviso({ tom: "ok", texto: "Bloqueio tirado." }); carga.recarregar(); } else setErroLink(r.erro);
                      }}>Tirar</Botao>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nenhum bloqueio à frente.</p>}
          </Cartao>

          <Cartao id="agenda-links" titulo="Links de agendamento" icone="link">
            <p className="t-apoio">Vão no site, na mensagem pronta e na assinatura do e-mail. O link da equipe dá o horário a quem está livre e tem menos demonstrações.</p>
            <ul className="divide-y divide-linha">
              {[...(linkEquipe ? [linkEquipe] : []), ...x.links.filter((l) => l.pessoaId)].map((l) => (
                <li key={l.codigo} className="grid gap-1.5 py-2.5">
                  <span className="t-texto font-medium">{nome(l.pessoaId)}</span>
                  <span className="t-apoio [overflow-wrap:anywhere]">{`/a/${l.codigo} · desde ${diaHora(l.criadoEm)}`}</span>
                  {x.podeEditar ? (
                    <span className="flex flex-wrap gap-2">
                      <Botao variante="discreto" tamanho="p" onClick={() => void link(l.pessoaId ?? null)}><Icone nome="copiar" />Copiar</Botao>
                      <Botao variante="discreto" tamanho="p" onClick={() => void link(l.pessoaId ?? null, true)}><Icone nome="trocar" />Trocar o link</Botao>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {!x.links.length ? <p className="t-apoio">Nenhum link ainda. “Copiar o link de agendamento” cria o da equipe.</p> : null}
            {x.podeEditar && escolhida && !x.links.some((l) => l.pessoaId === escolhida) ? (
              <Botao variante="contorno" className="justify-self-start max-md:w-full" onClick={() => void link(escolhida)}>
                <Icone nome="link" />{`Link só de ${nome(escolhida)}`}
              </Botao>
            ) : null}
            <p className="t-apoio">Trocar o link desliga o anterior: quem tinha o antigo vê que não está mais disponível.</p>
          </Cartao>
        </div>
      </div>
      <p className="t-apoio">{`${plural(x.proximas.length, "demonstração marcada", "demonstrações marcadas")} à frente. Confirmação e lembrete saem pelo e-mail; pelo WhatsApp, só com opt-in e quando houver a API oficial.`}</p>

      {janela?.tipo === "marcar" ? <JanelaMarcar a={x} aoFechar={() => fechar()} feito={(d) => fechar(`Demonstração marcada: ${d.quando}, ${d.interessado.condominio}.`)} /> : null}
      {janela?.tipo === "remarcar" ? <JanelaRemarcar d={janela.d} equipe={x.equipe} aoFechar={() => fechar()} feito={() => fechar("Demonstração remarcada.")} /> : null}
      {janela?.tipo === "feita" ? <JanelaFeita d={janela.d} aoFechar={() => fechar()} feito={() => fechar("Demonstração registrada, com o próximo passo.")} /> : null}
      {janela?.tipo === "encerrar" ? <JanelaEncerrar d={janela.d} aoFechar={() => fechar()} feito={(t) => fechar(t)} /> : null}
      {janela?.tipo === "disponibilidade" && disp ? <JanelaDisponibilidade d={disp} aoFechar={() => fechar()} feito={() => fechar(`Horários de ${disp.pessoa.nome} salvos.`)} /> : null}
      {janela?.tipo === "bloqueio" ? <JanelaBloqueio a={x} pessoa={escolhida ?? x.equipe[0]!.id} aoFechar={() => fechar()} feito={() => fechar("Horário bloqueado.")} /> : null}
    </div>
  );
}
