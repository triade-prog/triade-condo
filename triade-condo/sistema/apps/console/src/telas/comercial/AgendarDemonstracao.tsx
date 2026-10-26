"use client";
// Agendar a demonstração pelo link (quadro 340, CM-23): sem conta e sem a moldura do Console, no
// celular e no computador. Os dias e os horários livres da equipe, com os ocupados riscados; o
// nome, o WhatsApp, o e-mail (para a confirmação), o condomínio, as unidades e a autorização.
// Nada de quem está do outro lado nem de quem já marcou. O código fica só no endereço, a página
// não tem referrer (cabecalhos.ts) e nada vai para o armazenamento do navegador. O ?c= da mensagem
// pronta (0310, A) vai junto no agendamento, para a demonstração entrar na ficha certa.

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FORMATO_CONVITE_AGENDA, normalizarWhatsappBr, quandoDemonstracao, TEXTO_AUTORIZA_AGENDA, type RespostaAgendar } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, CampoTexto, Carregando, chamarApi, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { chipDia, MOTIVOS_AGENDA, primeiroDiaLivre, ROTAS_AGENDA, textoConfirmar, type AgendaPublica } from "./agenda.ts";
import { Bloco, Duvida, Pagina } from "./LinkProposta.tsx";

type Carga =
  | { estado: "carregando" }
  | { estado: "indisponivel" }
  | { estado: "limite" }
  | { estado: "falha"; texto: string }
  | { estado: "pronto"; a: AgendaPublica };

const ROTULO = "Demonstração";

export function AgendarDemonstracao() {
  const { codigo } = useParams<{ codigo: string }>();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [vez, setVez] = useState(0);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);

  useEffect(() => {
    void chamarApi<AgendaPublica>(ROTAS_AGENDA.publico(codigo)).then((r) => {
      if (r.ok) return setCarga({ estado: "pronto", a: r.dados });
      if (r.status === 404) return setCarga({ estado: "indisponivel" });
      if (r.status === 429) return setCarga({ estado: "limite" });
      setCarga({ estado: "falha", texto: textoDoErro(r.erro) });
    });
  }, [codigo, vez]);

  if (carga.estado === "carregando") return <Pagina rotulo={ROTULO}><h1 className="sr-only">Agendar demonstração</h1><Carregando rotulo="Abrindo os horários…" /></Pagina>;
  if (carga.estado !== "pronto") {
    const t = carga.estado === "limite" ? { titulo: "Muitas tentativas agora", texto: "Tente de novo mais tarde. Se precisar, fale com a TRÍADE pelo WhatsApp comercial." }
      : carga.estado === "falha" ? { titulo: "Não deu para abrir agora", texto: carga.texto }
      : { titulo: "Este link de agendamento não está mais disponível", texto: "Fale com a TRÍADE pelo WhatsApp comercial para marcar a demonstração." };
    return (
      <Pagina rotulo={ROTULO}>
        <h1 className="t-titulo-tela">{t.titulo}</h1>
        <Aviso tom={carga.estado === "falha" ? "erro" : "atencao"}>{t.texto}</Aviso>
        <Duvida texto="Falar com a TRÍADE" mensagem="Olá! Quero marcar uma demonstração da TRÍADE Condo." />
      </Pagina>
    );
  }
  return <Escolher codigo={codigo} a={carga.a} recarregar={recarregar} />;
}

function Escolher({ codigo, a, recarregar }: { codigo: string; a: AgendaPublica; recarregar: () => void }) {
  const [dia, setDia] = useState<string | null>(() => primeiroDiaLivre(a.dias));
  const [inicio, setInicio] = useState<string | null>(null);
  const [f, setF] = useState({ nome: "", whatsapp: "", email: "", condominio: "", faixa: "" });
  const [autorizo, setAutorizo] = useState(false);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<RespostaAgendar | null>(null);
  const doDia = a.dias.find((d) => d.data === dia);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const erroDe = (campo: string, texto: string) => (falhas.includes(campo) ? texto : undefined);

  async function agendar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const lista = [
      ...(!inicio ? ["inicio"] : []), ...(f.nome.trim().length < 2 ? ["nome"] : []), ...(!normalizarWhatsappBr(f.whatsapp) ? ["whatsapp"] : []),
      ...(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) ? ["email"] : []), ...(f.condominio.trim().length < 2 ? ["condominio"] : []), ...(!autorizo ? ["consentimento"] : []),
    ];
    setFalhas(lista);
    if (lista.length) return;
    setEnviando(true);
    const convite = new URLSearchParams(window.location.search).get("c")?.toLowerCase() ?? "";
    const r = await chamarApi<RespostaAgendar>(ROTAS_AGENDA.publico(codigo), {
      corpo: { inicio, nome: f.nome.trim(), whatsapp: f.whatsapp, email: f.email.trim(), condominio: f.condominio.trim(), faixa: f.faixa || null, consentimento: true,
               ...(FORMATO_CONVITE_AGENDA.test(convite) ? { convite } : {}) },
    });
    setEnviando(false);
    if (!r.ok) {
      const campos = r.erro.detalhes?.campos;
      if (Array.isArray(campos) && campos.length) return setFalhas(campos.map(String));
      if (r.erro.detalhes?.motivo === "HORARIO_OCUPADO") { setInicio(null); recarregar(); }
      return setErro(r.erro);
    }
    setFeito(r.dados);
    window.scrollTo({ top: 0 });
  }

  if (feito?.jaMarcada) {
    return (
      <Pagina rotulo={ROTULO}>
        <h1 className="t-titulo-tela">Você já tem uma demonstração marcada</h1>
        <Aviso tom="atencao" papel="status">
          {`Ela está marcada para ${feito.quando}, horário de Brasília. Nenhum horário novo foi marcado. Para mudar, responda o e-mail de confirmação.`}
        </Aviso>
        <Duvida texto="Falar pelo WhatsApp comercial" mensagem="Olá! Já tenho uma demonstração marcada da TRÍADE Condo e quero mudar o horário." />
      </Pagina>
    );
  }
  if (feito) {
    return (
      <Pagina rotulo={ROTULO}>
        <div role="status" className="flex gap-2.5 rounded-[14px] border border-ok/30 bg-ok-fundo p-3.5 text-ok">
          <Icone nome="check" className="h-5.5 w-5.5 shrink-0" />
          <p className="t-texto"><b>{`Demonstração marcada: ${feito.quando}.`}</b>{` ${feito.duracaoMinutos} minutos por vídeo, horário de Brasília.`}</p>
        </div>
        <Bloco rotulo="O que acontece agora">
          <h1 className="t-titulo-cartao">O que acontece agora</h1>
          <p className="t-texto">Você recebe a confirmação por e-mail, com o link da sala, e um lembrete no dia. Para mudar o horário, responda o e-mail da confirmação.</p>
        </Bloco>
        <Duvida texto="Falar pelo WhatsApp comercial" mensagem="Olá! Marquei uma demonstração da TRÍADE Condo e tenho uma dúvida." />
      </Pagina>
    );
  }

  const motivo = erro?.detalhes?.motivo ? MOTIVOS_AGENDA[String(erro.detalhes.motivo)] : undefined;
  const textoMotivo = erro?.detalhes?.motivo === "DEMONSTRACAO_MARCADA"
    ? "Você já tem uma demonstração marcada. Para mudar o horário, responda o e-mail da confirmação." : motivo;

  return (
    <Pagina rotulo={ROTULO}>
      <h1 className="t-titulo-tela">Escolha um horário para conhecer a TRÍADE</h1>
      <p className="t-apoio">{`${a.duracaoMinutos} minutos por vídeo, com alguém da equipe. Horário de Brasília.`}</p>

      {!a.dias.length || !primeiroDiaLivre(a.dias) ? (
        <>
          <Aviso tom="atencao">Não há horário livre nos próximos dias. Fale com a TRÍADE pelo WhatsApp comercial para combinar.</Aviso>
          <Duvida texto="Falar com a TRÍADE" mensagem="Olá! Quero marcar uma demonstração da TRÍADE Condo." />
        </>
      ) : (
        <form onSubmit={agendar} className="grid gap-3" noValidate>
          <fieldset className="grid gap-2">
            <legend className="mb-1 t-apoio font-medium">Dia</legend>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {a.dias.map((d) => {
                const c = chipDia(d.data);
                const livre = d.horarios.some((h) => h.livre);
                const escolhido = d.data === dia;
                return (
                  <button key={d.data} type="button" aria-pressed={escolhido} disabled={!livre}
                    onClick={() => { setDia(d.data); setInicio(null); }}
                    className={`flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-2 py-2 ${escolhido ? "border-2 border-violeta-600 bg-violeta-50 text-violeta-700" : "border border-linha bg-superficie"} disabled:cursor-not-allowed disabled:text-tinta-suave disabled:line-through`}>
                    <span className="t-apoio">{c.semana}</span>
                    <span className="t-titulo-secao">{c.numero}</span>
                    <span className="sr-only">{` de ${c.mes}${livre ? "" : ", sem horário livre"}`}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {doDia ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 t-apoio font-medium">Horário</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {doDia.horarios.map((h) => {
                  const escolhido = h.inicio === inicio;
                  return (
                    <button key={h.inicio} type="button" aria-pressed={escolhido} disabled={!h.livre}
                      onClick={() => setInicio(h.inicio)}
                      className={`flex min-h-11 items-center justify-center rounded-[12px] t-texto ${escolhido ? "border-2 border-violeta-600 bg-violeta-50 font-semibold text-violeta-700" : "border border-linha bg-superficie text-tinta"} disabled:cursor-not-allowed disabled:text-tinta-suave disabled:line-through`}>
                      {h.hora}{h.livre ? null : <span className="sr-only">(ocupado)</span>}
                    </button>
                  );
                })}
              </div>
              {falhas.includes("inicio") ? <span className="t-apoio text-erro">Escolha um horário.</span> : null}
            </fieldset>
          ) : null}

          <Bloco rotulo="Seus dados">
            <CampoTexto id="agendar-nome" rotulo="Seu nome" maxLength={80} autoComplete="name" value={f.nome} onChange={muda("nome")} erro={erroDe("nome", "Escreva o seu nome.")} />
            <CampoTexto id="agendar-whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={f.whatsapp} onChange={muda("whatsapp")}
              erro={erroDe("whatsapp", "WhatsApp com DDD, do Brasil.")} />
            <CampoTexto id="agendar-email" rotulo="E-mail" type="email" autoComplete="email" maxLength={120} value={f.email} onChange={muda("email")}
              ajuda="Para a confirmação e o lembrete." erro={erroDe("email", "Confira o e-mail.")} />
            <CampoTexto id="agendar-condominio" rotulo="Condomínio" maxLength={120} value={f.condominio} onChange={muda("condominio")}
              erro={erroDe("condominio", "Escreva o nome do condomínio.")} />
            <CampoSelecao id="agendar-faixa" rotulo="Unidades" opcional value={f.faixa} onChange={muda("faixa")}
              opcoes={[{ valor: "", texto: "Ainda não sei" }, ...a.faixas.map((x) => ({ valor: x.codigo, texto: x.nome }))]} />
            <label className="flex min-h-11 items-start gap-2.5 t-texto">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)}
                aria-describedby={falhas.includes("consentimento") ? "agendar-autorizo-erro" : undefined} />
              <span>{`Autorizo a TRÍADE a usar estes dados para a demonstração. ${TEXTO_AUTORIZA_AGENDA}`}</span>
            </label>
            {falhas.includes("consentimento") ? <span id="agendar-autorizo-erro" className="t-apoio text-erro">Falta a autorização.</span> : null}
          </Bloco>

          {textoMotivo ? <Aviso tom="atencao" papel="alert">{textoMotivo}</Aviso> : erro ? <Aviso tom="erro" papel="alert">{textoDoErro(erro)}</Aviso> : null}
          <Botao type="submit" className="w-full" disabled={enviando}>
            <Icone nome="check" />{enviando ? "Marcando…" : inicio ? textoConfirmar(inicio) : "Escolha um horário"}
          </Botao>
          <p className="t-apoio">{`Você recebe a confirmação e um lembrete no dia. ${TEXTO_AUTORIZA_AGENDA}`}</p>
        </form>
      )}
      {inicio ? <span className="sr-only" aria-live="polite">{`Escolhido: ${quandoDemonstracao(inicio)}`}</span> : null}
    </Pagina>
  );
}
