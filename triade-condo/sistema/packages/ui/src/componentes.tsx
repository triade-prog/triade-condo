// Componentes base das telas (docs/identidade/sistema.html, DC13). Situação nunca só
// pela cor: todo selo tem palavra e faixa. Toda lista tem vazio, erro e carregando (PT-10).

import { Icone, type NomeIcone } from "./Icone.tsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export type VarianteBotao = "primario" | "secundario" | "contorno" | "discreto" | "perigo" | "claro";
export type TamanhoBotao = "g" | "m" | "p";

/** Classe do botão (versão C do sistema de design), para usar também em links que parecem botão.
 * Um único primário por tela; o claro só vai sobre o degradê violeta. */
export function classeBotao(variante: VarianteBotao = "primario", extra = "", tamanho: TamanhoBotao = "g", soIcone = false): string {
  const t = tamanho === "g" ? "" : ` bt-${tamanho}`;
  return `bt bt-${variante}${t}${soIcone ? " bt-so" : ""} ${extra}`.trim();
}

export function Botao({ variante = "primario", tamanho = "g", soIcone = false, className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; tamanho?: TamanhoBotao; soIcone?: boolean }) {
  return <button type={type} className={classeBotao(variante, className, tamanho, soIcone)} {...props} />;
}

const CONTROLE = "campo";

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
      <textarea className={`${CONTROLE} min-h-28`} {...descrito({ id, rotulo, ajuda, erro })} {...props} />
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

export type Tom = "info" | "ok" | "atencao" | "erro" | "neutro" | "andamento";

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

/** Selo de situação: faixa lateral com brilho e palavra, nunca só a cor (versão D do sistema de design). */
export function Selo({ tom = "info", children }: { tom?: Tom; children: ReactNode }) {
  return <span className="selo" data-tom={tom}>{children}</span>;
}

const ICONE_DO_TOM: Record<Tom, NomeIcone> = {
  info: "info", ok: "check", atencao: "relogio", erro: "alerta", neutro: "info", andamento: "relogio",
};

/** Aviso na tela: cartão branco com faixa e ícone. Erro é anunciado na hora (role=alert); o resto, com calma (role=status). */
export function Aviso({ tom = "info", titulo, children, className = "" }: { tom?: Tom; titulo?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tom === "erro" ? "alert" : "status"} data-tom={tom} className={`aviso ${className}`}>
      <span className="quadro"><Icone nome={ICONE_DO_TOM[tom]} /></span>
      <div className="texto">
        {titulo ? <strong className="block font-semibold">{titulo}</strong> : null}
        {children}
      </div>
    </div>
  );
}

/** Chip: filtro que liga e desliga (aria-pressed), escolha que se tira ou pessoa. */
export function Chip({ icone, ativo, aoTirar, rotuloTirar, acento, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icone?: NomeIcone; ativo?: boolean; aoTirar?: () => void; rotuloTirar?: string; acento?: boolean;
}) {
  const conteudo = <>{icone ? <Icone nome={icone} /> : null}{children}</>;
  if (aoTirar) {
    return (
      <span className={`chip ${className}`} data-escolhido={acento ? undefined : ""} data-acento={acento ? "" : undefined}>
        {conteudo}
        <button type="button" className="tirar" aria-label={rotuloTirar ?? "Tirar"} onClick={aoTirar}><Icone nome="fechar" className="h-4 w-4" /></button>
      </span>
    );
  }
  return <button type="button" className={`chip ${className}`} aria-pressed={ativo} {...props}>{conteudo}</button>;
}

/** Trilho: os filtros principais de uma lista, juntos; o escolhido ganha o degradê. */
export function Trilho({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div role="group" aria-label={rotulo} className="trilho">{children}</div>;
}

export function Vazio({ titulo, children, acao }: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <p className="text-lg font-light">{titulo}</p>
      {children ? <p className="max-w-sm text-sm text-tinta-suave">{children}</p> : null}
      {acao}
    </div>
  );
}

export function ErroCarregar({ texto, tentarDeNovo }: { texto: string; tentarDeNovo?: () => void }) {
  return (
    <div role="alert" data-tom="erro" className="aviso">
      <span className="quadro"><Icone nome="alerta" /></span>
      <div className="texto grid justify-items-start gap-2">
        <p className="font-semibold">Não foi possível carregar</p>
        <p>{texto} Os dados não se perderam.</p>
        {tentarDeNovo ? <Botao variante="secundario" tamanho="m" onClick={tentarDeNovo}>Tentar de novo</Botao> : null}
      </div>
    </div>
  );
}

/** Carregando: mostra o formato do conteúdo. */
export function Carregando({ linhas = 3, rotulo = "Carregando…" }: { linhas?: number; rotulo?: string }) {
  return (
    <div aria-busy="true" className="grid gap-2">
      <span className="sr-only" role="status">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-11 animate-pulse rounded-xl bg-superficie-2" />
      ))}
    </div>
  );
}

/** Faixa que marca área interna: o cliente não vê (PI-06). */
export function FaixaInterna({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-violeta-300 bg-violeta-50 px-3 py-2 text-xs font-medium text-violeta-700">
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
