"use client";
// Moldura das páginas sem conta (CD-12 a CD-14): o mural, o comunicado do link pessoal, a
// confirmação do e-mail, o parar de receber e o documento. Nada de login nem de painel. O mural
// do morador (D4.40, conceito Janela acesa) usa a faixa com a foto dos prédios ao entardecer
// no lugar da faixa violeta lisa, e o miolo largo com duas colunas no computador.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ASSUNTOS_COMUNICADO, blocoDeData, type AssuntoComunicado, type EventoComunicado } from "@triade/domain";
import { Aviso, chamarApi, classeBotao, Icone, Marca, Selo, type ErroApi, type NomeIcone, type Tom } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { ComunicadoPublico } from "../tipos.ts";
import { encerramentoDe, subtituloEncerrado, textoForaDoAr, type Encerramento } from "./encerrado.ts";

export function TelaPublica({ titulo, subtitulo, icone = "megafone", rodape, faixa, largo = false, children }: {
  titulo: string; subtitulo?: string; icone?: NomeIcone; rodape?: string;
  /** No lugar da faixa violeta: a faixa com a foto (o mural, D4.40). */
  faixa?: ReactNode;
  /** Miolo de 1180 px, para o mural em duas colunas no computador. */
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-fundo">
      <main className={`mx-auto grid gap-4 pb-10 ${largo ? "max-w-[1180px] lg:px-6" : "max-w-2xl"}`}>
        {faixa ?? <CabecaPublica titulo={titulo} subtitulo={subtitulo} icone={icone} className="sm:mt-6 sm:rounded-2xl" />}
        <div className={`grid gap-3 px-4 ${largo ? "lg:px-0" : "sm:px-0"}`}>{children}</div>
        <footer className={`grid gap-3 px-5 t-apoio text-tinta-suave ${largo ? "lg:px-1" : "sm:px-1"}`}>
          <p className="flex items-start gap-2">
            <Icone nome="cadeado" className="mt-0.5 h-4 w-4 shrink-0 text-violeta-600" />
            <span>{rodape ?? "Não precisa de conta nem senha."} O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem.</span>
          </p>
          <span className="flex flex-wrap items-end justify-between gap-3">
            <Marca sistema="Condomínio" />
            {largo ? <span className="text-right t-apoio">Esta página não entra em buscadores.<br />Os arquivos abrem por links que expiram.</span> : null}
          </span>
        </footer>
      </main>
    </div>
  );
}

/** A faixa violeta do alto das páginas sem conta (enquete, assembleia, e-mail, documento). */
export function CabecaPublica({ titulo, subtitulo, icone = "megafone", className = "", nivel = 1 }: {
  titulo: string; subtitulo?: string; icone?: NomeIcone; className?: string; nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <header className={`flex items-center gap-3 bg-violeta-700 px-5 py-4 text-white ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-laranja-200"><Icone nome={icone} /></span>
      <span className="grid min-w-0">
        <Titulo className="t-titulo-secao leading-snug font-medium">{titulo}</Titulo>
        {subtitulo ? <span className="t-apoio text-violeta-100">{subtitulo}</span> : null}
      </span>
    </header>
  );
}

/** A frase em Playfair da faixa do mural: a única palavra em destaque da página. */
export const FRASE_DO_MURAL = "o que o prédio precisa saber";

/**
 * A faixa do mural (D4.40): a foto dos prédios ao entardecer, o nome do condomínio em Manrope
 * leve, a frase em Playfair itálico, a linha de atualização e o botão claro do WhatsApp. É a única
 * arte da marca da tela; o texto fica sobre o degradê sólido, nunca sobre a foto. No painel, a
 * prévia usa a mesma faixa, mais baixa e sem ser o título da tela (nivel 2).
 */
export function FaixaMural({ condominio, linha, whatsapp, nivel = 1, className = "" }: {
  condominio?: string; linha?: string; whatsapp?: string; nivel?: 1 | 2; className?: string;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  const alto = nivel === 1;
  return (
    <header className={`relative isolate overflow-hidden bg-violeta-900 text-white ${alto ? "min-h-[328px] lg:min-h-[224px] lg:mt-6 lg:rounded-3xl" : "min-h-[200px] rounded-2xl"} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arte da marca, servida pelo próprio app */}
      <img aria-hidden="true" alt="" src={alto ? "/marca/entrada-predios.webp" : "/marca/faixa-predios.webp"}
        className={`pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover ${alto ? "object-[center_28%] lg:hidden" : "object-right"}`} />
      {alto ? (
        // eslint-disable-next-line @next/next/no-img-element -- arte da marca, servida pelo próprio app
        <img aria-hidden="true" alt="" src="/marca/faixa-predios.webp" className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full object-cover object-right lg:block" />
      ) : null}
      <span aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 ${alto
        ? "bg-[linear-gradient(180deg,rgb(24_5_103/.08)_0%,rgb(24_5_103/.55)_40%,rgb(24_5_103/.94)_68%,#180567_100%)] lg:bg-[linear-gradient(90deg,#180567_0%,#180567_40%,rgb(24_5_103/.6)_62%,transparent_100%)]"
        : "bg-[linear-gradient(90deg,#180567_0%,#180567_38%,rgb(24_5_103/.6)_60%,transparent_100%)] max-md:bg-[linear-gradient(180deg,rgb(24_5_103/.3)_0%,rgb(24_5_103/.9)_55%,#180567_100%)]"}`} />
      <div className={`relative flex h-full min-h-[inherit] flex-col justify-end gap-1 p-5 ${alto ? "lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-10 lg:py-8" : "md:flex-row md:items-center md:justify-between md:gap-6 md:px-7"}`}>
        <div className="grid gap-1">
          <span aria-hidden="true" className="t-rotulo font-semibold text-violeta-200">Mural do condomínio</span>
          <Titulo className={`t-titulo-tela font-light leading-[1.1] ${alto ? "max-md:text-[34px] lg:text-[40px]" : ""}`}>{condominio ? <><span className="sr-only">Mural do </span>{condominio}</> : "Mural do condomínio"}</Titulo>
          <span className={`t-titulo-secao t-destaque text-laranja-200 ${alto ? "lg:text-[22px]" : ""}`}>{FRASE_DO_MURAL}</span>
          {linha ? <span className="mt-2 flex items-center gap-2 t-apoio text-violeta-100"><Icone nome="relogio" className="h-4 w-4" />{linha}</span> : null}
        </div>
        {whatsapp ? (
          <a href={`https://wa.me/${whatsapp}?text=COMUNICADOS`} target="_blank" rel="noopener noreferrer"
            className={classeBotao("claro", `mt-3 ${alto ? "w-full lg:mt-0 lg:w-auto lg:shrink-0" : "md:mt-0 md:shrink-0"}`)}>
            <Icone nome="whats" />Receber os avisos no WhatsApp
          </a>
        ) : null}
      </div>
    </header>
  );
}

/** Uma opção para escolher (enquete, voto, quem vota): o cartão inteiro marca, e a escolha atual fica realçada. */
export function Opcao({ nome, valor, marcada, aoMarcar, selo, children }: {
  nome: string; valor: string | number; marcada: boolean; aoMarcar: () => void; selo?: ReactNode; children: ReactNode;
}) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 t-texto ${marcada ? "border-violeta-600 bg-violeta-50 font-semibold ring-1 ring-violeta-600" : "border-linha bg-superficie hover:border-violeta-300"}`}>
      <input type="radio" name={nome} value={valor} checked={marcada} onChange={aoMarcar} className="h-5 w-5 shrink-0 accent-violeta-600" />
      <span className="flex-1">{children}</span>
      {selo}
    </label>
  );
}

export const Cartao = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 ${className}`}>{children}</section>
);

/** Cor e ícone de cada assunto (D4.40): sempre ícone + palavra, para não depender só da cor. */
export const TOM_ASSUNTO: Record<AssuntoComunicado, Tom> = { AVISO: "andamento", OBRAS: "atencao", SEGURANCA: "info", ASSEMBLEIA: "andamento", LEMBRETE: "ok" };
export const ICONE_ASSUNTO_MURAL: Record<AssuntoComunicado, NomeIcone> = { AVISO: "megafone", OBRAS: "ferramenta", SEGURANCA: "escudo", ASSEMBLEIA: "decisao", LEMBRETE: "relogio" };

export function SeloAssunto({ assunto }: { assunto: string }) {
  const a = (assunto in ASSUNTOS_COMUNICADO ? assunto : "AVISO") as AssuntoComunicado;
  return <Selo tom={TOM_ASSUNTO[a]}><Icone nome={ICONE_ASSUNTO_MURAL[a]} className="h-3.5 w-3.5" />{ASSUNTOS_COMUNICADO[a]}</Selo>;
}

/** O bloco pequeno de data do aviso com evento: "28 OUT | qua · 8h às 14h · Salão". */
export function BlocoDeData({ evento, assembleia = false }: { evento: EventoComunicado; assembleia?: boolean }) {
  const b = blocoDeData(evento);
  const detalhe = assembleia && evento.inicio && evento.fim
    ? [b.semana, `${evento.inicio} primeira chamada · ${evento.fim} segunda`, evento.local].filter(Boolean).join(" · ")
    : b.detalhe;
  return (
    <span className="inline-flex items-center gap-2 rounded-[10px] border border-linha bg-fundo py-1.5 pr-2.5 pl-2 t-apoio">
      <span className="flex items-baseline gap-1 border-r border-contorno/50 pr-2 text-violeta-700">
        <b className="t-titulo-secao leading-none">{b.dia}</b>
        <span className="t-rotulo font-semibold">{b.mes}</span>
      </span>
      <span>{detalhe}</span>
    </span>
  );
}

/**
 * "Pôr na agenda" (CD-18): o endereço de verdade do arquivo de calendário, que a API monta com o
 * fuso do condomínio. O celular abre direto na agenda, inclusive pelo navegador de dentro do
 * WhatsApp; no computador, o arquivo baixa. Sem conta e sem o sistema saber quem baixou.
 */
export function PorNaAgenda({ c, href, tamanho = "m" }: { c: { titulo: string; evento?: EventoComunicado | null }; href?: string; tamanho?: "m" | "p" }) {
  if (!c.evento || !href) return null;
  return (
    <a href={href} className={classeBotao("discreto", "", tamanho)} aria-label={`Pôr na agenda: ${c.titulo}`}>
      <Icone nome="calendario" />Pôr na agenda
    </a>
  );
}

/** O edital de uma assembleia cancelada continua no mural, mas avisa (AC-02). */
export function SeloCancelada({ c }: { c: { assembleiaCancelada?: boolean } }) {
  return c.assembleiaCancelada ? <Selo tom="atencao"><Icone nome="info" className="h-3.5 w-3.5" />Assembleia cancelada</Selo> : null;
}

/**
 * Este condomínio não usa mais a TRÍADE (quadro 489; R17.7c, decisão F1): a mesma página para todo
 * link público depois do último dia, com o nome do condomínio e o dia em que saiu do ar.
 */
export function ContratoEncerrado({ e, rotulo, ligacao }: { e: Encerramento; rotulo: string; ligacao?: string }) {
  return (
    <TelaPublica titulo="Este condomínio não usa mais a TRÍADE" subtitulo={subtituloEncerrado(rotulo, e, ligacao)} icone="cadeado"
      rodape="Esta página não guarda nada no seu celular.">
      <Cartao>
        <p className="t-texto">{textoForaDoAr(e)}</p>
        <p className="t-texto">Para falar com o condomínio, procure o síndico ou a portaria.</p>
      </Cartao>
      <Cartao>
        <h2 className="t-titulo-secao font-medium">Recebeu um link?</h2>
        <p className="t-texto text-tinta-suave">Comunicados, enquetes, cadastro, orçamentos e o link do prestador mostram esta mesma página.</p>
      </Cartao>
      <Cartao>
        <h2 className="t-titulo-secao font-medium">Recebe e-mails do condomínio?</h2>
        <p className="t-texto text-tinta-suave">Nada mais será enviado. O link para parar de receber, no rodapé dos e-mails antigos, continua funcionando.</p>
      </Cartao>
    </TelaPublica>
  );
}

const AoEncerrar = createContext<(x: ErroApi | Record<string, unknown>) => boolean>(() => false);

/**
 * Diz se a recusa é do contrato encerrado; se for, a página inteira vira a do quadro 489. Fora de
 * uma página pública (a prévia do mural no painel), não faz nada.
 */
export const useEncerrou = () => useContext(AoEncerrar);

/** Envolve uma página pública: a primeira recusa CONTRATO_ENCERRADO troca tudo pela página do quadro 489. */
export function ComEncerramento({ rotulo, ligacao, children }: { rotulo: string; ligacao?: string; children: ReactNode }) {
  const [e, setE] = useState<Encerramento | null>(null);
  const encerrou = useCallback((x: ErroApi | Record<string, unknown>) => {
    const y = encerramentoDe(x);
    if (y) setE(y);
    return !!y;
  }, []);
  if (e) return <ContratoEncerrado e={e} rotulo={rotulo} ligacao={ligacao} />;
  return <AoEncerrar.Provider value={encerrou}>{children}</AoEncerrar.Provider>;
}

/** Abre o PDF do aviso numa aba, pelo link curto que a API devolve. */
export function useAbrirArquivo(linkArquivo: (arquivo: string) => string) {
  const [falha, setFalha] = useState<string | null>(null);
  const encerrou = useEncerrou();
  async function abrir(id: string) {
    setFalha(null);
    const aba = window.open("about:blank", "_blank");
    const r = await chamarApi<{ url: string }>(linkArquivo(id));
    if (!r.ok) { aba?.close(); if (encerrou(r.erro)) return; return setFalha("Não deu para abrir o arquivo agora. Tente de novo."); }
    if (aba) aba.location.href = r.dados.url;
  }
  return { falha, abrir };
}

/** O comunicado como o morador lê: assunto, título, evento, texto, assinatura, fotos e PDF. */
export function ComunicadoLido({ c, linkArquivo, agenda }: { c: ComunicadoPublico; linkArquivo: (arquivo: string) => string; agenda?: string }) {
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const { falha, abrir } = useAbrirArquivo(linkArquivo);
  useEffect(() => {
    let vivo = true;
    void Promise.all(c.arquivos.filter((a) => a.tipo.startsWith("image/")).map(async (a) => {
      const r = await chamarApi<{ url: string }>(linkArquivo(a.id));
      return r.ok ? ([a.id, r.dados.url] as const) : null;
    })).then((xs) => { if (vivo) setFotos(Object.fromEntries(xs.filter((x) => x !== null))); });
    return () => { vivo = false; };
  }, [c, linkArquivo]);

  return (
    <Cartao>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2"><SeloAssunto assunto={c.assunto} /><SeloCancelada c={c} /></span>
        <span className="font-mono t-codigo text-tinta-suave">{diaHora(c.publicadoEm)}</span>
      </span>
      <h2 className="t-titulo-secao font-medium">{c.titulo}</h2>
      {c.numero > 1 && c.mudanca ? (
        <span className="inline-flex items-center gap-1.5 justify-self-start rounded-[10px] border border-violeta-200 bg-violeta-50 px-2.5 py-1.5 t-apoio text-violeta-700">
          <Icone nome="info" className="h-3.5 w-3.5" /><span><b className="font-semibold">Corrigido</b> · versão {c.numero}: {c.mudanca}</span>
        </span>
      ) : null}
      {c.evento ? (
        <span className="flex flex-wrap items-center gap-2">
          <BlocoDeData evento={c.evento} assembleia={c.assunto === "ASSEMBLEIA"} />
          <PorNaAgenda c={c} href={agenda} tamanho="p" />
        </span>
      ) : null}
      <div className="t-texto leading-relaxed whitespace-pre-line">{c.texto}</div>
      {c.assinatura ? <p className="t-texto text-tinta-suave">{c.assinatura}</p> : null}
      {c.arquivos.map((a) => a.tipo.startsWith("image/") ? (
        fotos[a.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={fotos[a.id]} alt={a.nome} className="max-h-[70vh] w-full rounded-xl object-contain" />
        ) : <span key={a.id} className="t-apoio text-tinta-suave">Carregando a foto…</span>
      ) : (
        <button key={a.id} type="button" onClick={() => void abrir(a.id)}
          className="flex items-center gap-2 justify-self-start rounded-xl border border-linha px-3 py-2 t-texto font-medium text-violeta-600 hover:underline">
          <Icone nome="documento" />{a.nome}
        </button>
      ))}
      {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
    </Cartao>
  );
}

/** Enquanto o WhatsApp do condomínio está fora do ar (W-17): por onde falar. */
export function FaixaQueda({ canal }: { canal?: string }) {
  if (!canal) return null;
  return (
    <Aviso tom="atencao" titulo="O WhatsApp do condomínio está fora do ar">
      <span className="whitespace-pre-line">Enquanto isso: {canal}</span>
    </Aviso>
  );
}

/**
 * Receber os comunicados pelo WhatsApp (F6.6; W-20, CD-12): abre a conversa com o condomínio já
 * com a palavra COMUNICADOS. Quem aceita é quem envia, do próprio celular, e está no cadastro.
 * No mural o botão fica na faixa; este cartão segue no comunicado do link pessoal.
 */
export function ReceberPeloWhatsapp({ numero }: { numero?: string }) {
  if (!numero) return null;
  return (
    <Cartao className="border-violeta-200">
      <h2 className="t-texto font-medium">Receba os comunicados no WhatsApp</h2>
      <p className="t-texto">Toque no botão: abre o WhatsApp do condomínio com a palavra COMUNICADOS. É só enviar. Vale para quem está no cadastro do condomínio.</p>
      <a href={`https://wa.me/${numero}?text=COMUNICADOS`} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "justify-self-start", "m")}>
        <Icone nome="whats" />Receber pelo WhatsApp
      </a>
    </Cartao>
  );
}

