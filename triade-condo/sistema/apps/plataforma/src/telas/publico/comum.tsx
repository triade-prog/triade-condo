"use client";
// Moldura das páginas sem conta (CD-12 a CD-14): o mural, o comunicado do link pessoal, a
// confirmação do e-mail, o parar de receber e o documento. Nada de login nem de painel.

import { useEffect, useState, type ReactNode } from "react";
import { ASSUNTOS_COMUNICADO, type AssuntoComunicado } from "@triade/domain";
import { Aviso, chamarApi, classeBotao, Icone, Marca, Selo, type NomeIcone } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { ComunicadoPublico } from "../tipos.ts";

export function TelaPublica({ titulo, subtitulo, icone = "megafone", rodape, children }: {
  titulo: string; subtitulo?: string; icone?: NomeIcone; rodape?: string; children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-fundo">
      <main className="mx-auto grid max-w-2xl gap-4 pb-10">
        <CabecaPublica titulo={titulo} subtitulo={subtitulo} icone={icone} className="sm:mt-6 sm:rounded-2xl" />
        <div className="grid gap-3 px-4 sm:px-0">{children}</div>
        <footer className="grid gap-2 px-5 text-[13px] text-tinta-suave sm:px-1">
          <p>{rodape ?? "Não precisa de conta nem senha."} O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem.</p>
          <Marca sistema="Condomínio" />
        </footer>
      </main>
    </div>
  );
}

/** A faixa violeta do alto das páginas sem conta. No painel, a prévia do mural usa a mesma (CD-15), sem ser o título da tela. */
export function CabecaPublica({ titulo, subtitulo, icone = "megafone", className = "", nivel = 1 }: {
  titulo: string; subtitulo?: string; icone?: NomeIcone; className?: string; nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <header className={`flex items-center gap-3 bg-violeta-700 px-5 py-4 text-white ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-laranja-200"><Icone nome={icone} /></span>
      <span className="grid min-w-0">
        <Titulo className="text-lg leading-snug font-medium">{titulo}</Titulo>
        {subtitulo ? <span className="text-[13px] text-violeta-100">{subtitulo}</span> : null}
      </span>
    </header>
  );
}

export const Cartao = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 ${className}`}>{children}</section>
);

/** O comunicado como o morador lê: assunto, título, texto, assinatura, fotos e PDF. */
export function ComunicadoLido({ c, linkArquivo }: { c: ComunicadoPublico; linkArquivo: (arquivo: string) => string }) {
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [falha, setFalha] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void Promise.all(c.arquivos.filter((a) => a.tipo.startsWith("image/")).map(async (a) => {
      const r = await chamarApi<{ url: string }>(linkArquivo(a.id));
      return r.ok ? ([a.id, r.dados.url] as const) : null;
    })).then((xs) => { if (vivo) setFotos(Object.fromEntries(xs.filter((x) => x !== null))); });
    return () => { vivo = false; };
  }, [c, linkArquivo]);

  async function abrirPdf(id: string) {
    setFalha(null);
    const aba = window.open("about:blank", "_blank");
    const r = await chamarApi<{ url: string }>(linkArquivo(id));
    if (!r.ok) { aba?.close(); return setFalha("Não deu para abrir o arquivo agora. Tente de novo."); }
    if (aba) aba.location.href = r.dados.url;
  }

  return (
    <Cartao>
      <span className="justify-self-start"><Selo tom="neutro">{ASSUNTOS_COMUNICADO[c.assunto as AssuntoComunicado] ?? "Comunicado"}</Selo></span>
      <h2 className="text-xl font-medium">{c.titulo}</h2>
      <p className="text-[13px] text-tinta-suave">{diaHora(c.publicadoEm)}{c.numero > 1 && c.mudanca ? ` · versão ${c.numero}: ${c.mudanca}` : ""}</p>
      <div className="text-[15px] leading-relaxed whitespace-pre-line">{c.texto}</div>
      {c.assinatura ? <p className="text-[15px]">{c.assinatura}</p> : null}
      {c.arquivos.map((a) => a.tipo.startsWith("image/") ? (
        fotos[a.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={fotos[a.id]} alt={a.nome} className="max-h-[70vh] w-full rounded-xl object-contain" />
        ) : <span key={a.id} className="text-[13px] text-tinta-suave">Carregando a foto…</span>
      ) : (
        <button key={a.id} type="button" onClick={() => void abrirPdf(a.id)}
          className="flex items-center gap-2 justify-self-start rounded-xl border border-linha px-3 py-2 text-sm font-medium text-violeta-600 hover:underline">
          <Icone nome="documento" />{a.nome}
        </button>
      ))}
      {falha ? <p className="text-sm text-erro" role="alert">{falha}</p> : null}
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
 */
export function ReceberPeloWhatsapp({ numero }: { numero?: string }) {
  if (!numero) return null;
  return (
    <Cartao className="border-violeta-200">
      <h2 className="text-base font-medium">Receba os comunicados no WhatsApp</h2>
      <p className="text-sm">Toque no botão: abre o WhatsApp do condomínio com a palavra COMUNICADOS. É só enviar. Vale para quem está no cadastro do condomínio.</p>
      <a href={`https://wa.me/${numero}?text=COMUNICADOS`} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "justify-self-start", "m")}>
        <Icone nome="whats" />Receber pelo WhatsApp
      </a>
    </Cartao>
  );
}
