"use client";
// O que o cadastro pela janela da Meta (quadros 466 a 468) e a janela do código dividem.

import { MOTIVOS_CADASTRO_META } from "@triade/domain";
import { textoDoErro, type ErroApi } from "@triade/ui";
import type { Conexao } from "./conexao.tsx";

/** A resposta do cadastro e do código quando o número ligou. */
export interface RespostaLigado {
  etapa: "LIGADO";
  conexao: Conexao & { numero?: string; aparelho?: string };
  numero?: string;
  modelosEnviados: number;
  faltaCartao: boolean;
}
export type MetodoCodigo = "SMS" | "VOICE";
export type RespostaCadastro = RespostaLigado | { etapa: "CODIGO"; numero: string; metodos: MetodoCodigo[] };

export function motivoDoErro(e: ErroApi): string | null {
  const m = e.detalhes?.motivo;
  return typeof m === "string" ? m : null;
}
export function textoCadastro(e: ErroApi): string {
  const m = motivoDoErro(e);
  return (m && m in MOTIVOS_CADASTRO_META ? MOTIVOS_CADASTRO_META[m as keyof typeof MOTIVOS_CADASTRO_META] : null) ?? textoDoErro(e);
}

export function Girando({ className = "h-5 w-5" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 animate-spin rounded-full border-2 border-violeta-200 border-t-violeta-600 motion-reduce:animate-none ${className}`} />;
}
