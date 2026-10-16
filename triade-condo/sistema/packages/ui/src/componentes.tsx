// Componentes base das telas (design-frontend.html, "Componentes base"). Status nunca só
// pela cor: todo selo tem palavra e símbolo. Toda lista tem vazio, erro e carregando (PT-10).

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export type VarianteBotao = "primario" | "secundario" | "perigo" | "texto";

const BOTAO: Record<VarianteBotao, string> = {
  primario: "bg-acao text-papel hover:bg-acao-press",
  secundario: "border border-contorno bg-superficie text-tinta hover:bg-superficie-2",
  perigo: "border border-erro-borda bg-erro-fundo text-erro hover:brightness-95",
  texto: "text-acao underline-offset-2 hover:underline px-1",
};

/** Classe do botão, para usar também em links que parecem botão. */
export function classeBotao(variante: VarianteBotao = "primario", extra = ""): string {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60";
  return `${base} ${BOTAO[variante]} ${extra}`.trim();
}

export function Botao({ variante = "primario", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return <button type={type} className={classeBotao(variante, className)} {...props} />;
}

const CONTROLE =
  "w-full min-h-10 rounded-md border border-contorno bg-superficie px-3 py-2 text-sm text-tinta aria-[invalid=true]:border-erro aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-erro";

interface PropsCampo {
  id: string;
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string | null;
  opcional?: boolean;
}

function Rotulo({ id, rotulo, opcional }: Pick<PropsCampo, "id" | "rotulo" | "opcional">) {
  return (
    <label htmlFor={id} className="text-[13px] font-medium">
      {rotulo}
      {opcional ? <span className="font-normal text-tinta-suave"> (opcional)</span> : null}
    </label>
  );
}

function Rodape({ id, ajuda, erro }: Pick<PropsCampo, "id" | "ajuda" | "erro">) {
  if (erro) return <span id={`${id}-ajuda`} className="text-xs text-erro">{erro}</span>;
  return ajuda ? <span id={`${id}-ajuda`} className="text-xs text-tinta-suave">{ajuda}</span> : null;
}

function descrito(p: PropsCampo) {
  return { id: p.id, "aria-invalid": p.erro ? true : undefined, "aria-describedby": p.erro || p.ajuda ? `${p.id}-ajuda` : undefined };
}

export function CampoTexto({ id, rotulo, ajuda, erro, opcional, className = "", ...props }: PropsCampo & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`grid content-start gap-1 ${className}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <input className={CONTROLE} {...descrito({ id, rotulo, ajuda, erro })} {...props} />
      <Rodape id={id} ajuda={ajuda} erro={erro} />
    </div>
  );
}

export function CampoAreaTexto({ id, rotulo, ajuda, erro, opcional, className = "", ...props }: PropsCampo & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={`grid content-start gap-1 ${className}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <textarea className={`${CONTROLE} min-h-24`} {...descrito({ id, rotulo, ajuda, erro })} {...props} />
      <Rodape id={id} ajuda={ajuda} erro={erro} />
    </div>
  );
}

export function CampoSelecao({
  id, rotulo, ajuda, erro, opcional, opcoes, className = "", ...props
}: PropsCampo & SelectHTMLAttributes<HTMLSelectElement> & { opcoes: { valor: string; texto: string }[] }) {
  return (
    <div className={`grid content-start gap-1 ${className}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <select className={CONTROLE} {...descrito({ id, rotulo, ajuda, erro })} {...props}>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
      <Rodape id={id} ajuda={ajuda} erro={erro} />
    </div>
  );
}

export type Tom = "info" | "ok" | "atencao" | "erro" | "neutro";

const TOM: Record<Tom, string> = {
  info: "border-info-borda bg-info-fundo text-info",
  ok: "border-ok-borda bg-ok-fundo text-ok",
  atencao: "border-atencao-borda bg-atencao-fundo text-atencao",
  erro: "border-erro-borda bg-erro-fundo text-erro",
  neutro: "border-linha bg-superficie-2 text-tinta-suave",
};

/** Formas desenhadas (SVG) que acompanham a palavra do selo. Nunca emoji nem caractere. */
export type FormaSelo = "ok" | "andamento" | "atencao" | "inativo" | "interno" | "pausa";

const MARCAS: Record<FormaSelo, ReactNode> = {
  ok: <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  andamento: <><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 2.5A5.5 5.5 0 0 1 13.5 8H8Z" fill="currentColor" /></>,
  atencao: <><path d="M8 2.5 14 13H2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.3" r=".9" fill="currentColor" /></>,
  inativo: <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  interno: <path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  pausa: <path d="M5.5 4v8M10.5 4v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};

export function IconeMarca({ marca, className = "h-3 w-3" }: { marca: FormaSelo; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" className={`shrink-0 ${className}`}>{MARCAS[marca]}</svg>;
}

/** Selo de status: palavra e forma, além da cor. */
export function Selo({ tom = "info", marca, children }: { tom?: Tom; marca?: FormaSelo; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TOM[tom]}`}>
      {marca ? <IconeMarca marca={marca} /> : null}
      {children}
    </span>
  );
}

/** Aviso na tela. Erro é anunciado na hora (role=alert); o resto, com calma (role=status). */
export function Aviso({ tom = "info", titulo, children, className = "" }: { tom?: Tom; titulo?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${TOM[tom]} ${className}`}>
      {titulo ? <strong className="block font-semibold">{titulo}</strong> : null}
      {children}
    </div>
  );
}

export function Vazio({ titulo, children, acao }: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-2 rounded-lg border border-dashed border-linha px-4 py-6">
      <p className="font-semibold">{titulo}</p>
      {children ? <p className="text-tinta-suave">{children}</p> : null}
      {acao}
    </div>
  );
}

export function ErroCarregar({ texto, tentarDeNovo }: { texto: string; tentarDeNovo?: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-2 rounded-lg border border-erro-borda bg-erro-fundo px-4 py-4 text-erro">
      <p className="font-semibold">Não foi possível carregar</p>
      <p>{texto} Os dados não se perderam.</p>
      {tentarDeNovo ? <Botao variante="secundario" onClick={tentarDeNovo}>Tentar de novo</Botao> : null}
    </div>
  );
}

/** Carregando: mostra o formato do conteúdo. */
export function Carregando({ linhas = 3, rotulo = "Carregando…" }: { linhas?: number; rotulo?: string }) {
  return (
    <div aria-busy="true" className="grid gap-2">
      <span className="sr-only" role="status">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-10 animate-pulse rounded-md bg-superficie-2" />
      ))}
    </div>
  );
}

/** Faixa que marca área interna: o cliente não vê (PI-06). */
export function FaixaInterna({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-lilas bg-lilas-bruma px-3 py-2 text-xs font-medium text-selecao-tinta">
      <IconeMarca marca="interno" />
      {children}
    </p>
  );
}

/** Erro de uma ação. No conflito de versão (AT-24), o que a pessoa escreveu fica; ela decide quando carregar a nova. */
export function AvisoErro({ erro, texto, recarregar }: { erro: { codigo: string }; texto: string; recarregar?: () => void }) {
  return (
    <Aviso tom="erro">
      {texto}
      {erro.codigo === "VERSION_CONFLICT" && recarregar ? (
        <span className="mt-2 block">
          <Botao variante="secundario" onClick={recarregar}>Carregar a versão nova</Botao>
        </span>
      ) : null}
    </Aviso>
  );
}
