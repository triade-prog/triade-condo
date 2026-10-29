"use client";
// Sessão da Plataforma: o condomínio escolhido, o que a pessoa pode fazer nele e o que falta
// configurar. Sessão ausente leva para o login.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chamarApi, pedeLogin, textoDoErro, type ErroApi } from "@triade/ui";
import type { MesFechado, ResumoComunicados, ResumoManutencao, ResumoPedidos, ResumoProntuario, ResumoVida } from "./tipos.ts";
import type { PedidoAcessoExcepcional } from "./suporte/comum.tsx";

export interface Painel {
  condominio: { id: string; nome: string; cidade: string | null; uf: string | null; cenario: string | null };
  pessoa: { id: string; nome: string };
  funcoes: string[];
  acoes: string[];
  pendencias: string[];
  /** Resumo de moradores, só para quem pode ver (passo 3). */
  moradores?: { unidades: number; semContato: number; aConfirmar: number; semProprietario: number };
  /** Resumo dos pedidos que a pessoa enxerga, para quem pode ver (passo 4). */
  pedidos?: ResumoPedidos;
  /** O mês anterior, fixo (passo 7, F7.1). */
  mesFechado?: MesFechado;
  /** Avisos sem ver (passo 6, F6.1). */
  avisosNaoVistos?: number;
  /** Resumo da manutenção, para quem vê (peça R6). */
  manutencao?: ResumoManutencao;
  /** Programados, rascunhos parados e documentos perto de vencer (peça R1). */
  comunicados?: ResumoComunicados;
  /** O prontuário do prédio, para quem vê os documentos (peça R10). */
  memoria?: { prontuario: ResumoProntuario };
  /** Pedidos de acesso excepcional da TRÍADE esperando o síndico e os que valem (peça R4, PI-11). */
  acessosExcepcionais?: { pedidos: PedidoAcessoExcepcional[]; valendo: number };
  /** WhatsApp do condomínio, para quem cuida dos pedidos (passo 5): conexão, a identificar e falhas. */
  whatsapp?: { situacao: string; aIdentificar: number; falhas: number };
  /** Vida em condomínio, para quem vê as reservas (peça R12): o que espera aprovação. */
  vida?: ResumoVida;
  /** Decisões esperando a resposta da pessoa, para quem pode aprovar (F7.4, AT-23). */
  decisoes?: { aguardando: number; vencidas: number; maisAntigaDias: number | null; votos?: number; despesas?: number; votando?: number };
  /** R8: os orçamentos que pedem atenção (prazo fechou, proposta vencida, aceite atrasado), os pedindo propostas e os prontos para comparar. */
  orcamentos?: { pedeAtencao: number; pedindo: number; comparar: number };
  /** Encomendas guardadas, para quem vê a portaria (Portaria 1, PA-01). */
  portaria?: { guardadas: number; semAviso: number; avisoFalhou: number; antigas: number; dias: number };
}

export interface CondominioDaPessoa {
  id: string;
  nome: string;
  funcoes: string[];
}

export interface ContextoPlataforma {
  painel: Painel;
  condominios: CondominioDaPessoa[];
  pode: (acao: string) => boolean;
  /** Recarrega o painel (as pendências mudam depois de configurar). */
  atualizar: () => void;
}

export const Contexto = createContext<ContextoPlataforma | null>(null);

export function usePlataforma(): ContextoPlataforma {
  const c = useContext(Contexto);
  if (!c) throw new Error("usePlataforma fora do painel");
  return c;
}

export type Carga<T> =
  | { estado: "carregando" }
  | { estado: "erro"; erro: ErroApi; texto: string }
  | { estado: "pronto"; dados: T };

/** Busca na API com vazio, erro e carregando; sessão vencida volta para o login. */
export function useCarregar<T>(caminho: string | null): Carga<T> & { recarregar: () => void } {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga<T>>({ estado: "carregando" });
  const [vez, setVez] = useState(0);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);

  useEffect(() => {
    if (!caminho) return;
    const controle = new AbortController();
    chamarApi<T>(caminho, { sinal: controle.signal }).then((r) => {
      if (controle.signal.aborted) return;
      if (r.ok) return setCarga({ estado: "pronto", dados: r.dados });
      if (pedeLogin(r.erro)) return router.replace("/entrar");
      setCarga({ estado: "erro", erro: r.erro, texto: textoDoErro(r.erro) });
    });
    return () => controle.abort();
  }, [caminho, vez, router]);

  return { ...carga, recarregar };
}

/** O número de cada aba de uma lista (D4.2): os mesmos filtros da tela, sem a aba e a página.
 * Com q null, não pede (quem não vê a lista). */
export function useContagens(lista: string, q: string | null) {
  const p = new URLSearchParams(q ?? "");
  for (const k of ["situacao", "filtro", "pagina"]) p.delete(k);
  const s = p.toString();
  const c = useCarregar<Partial<Record<string, number>>>(q === null ? null : `/v1/condominio/contagens/${lista}${s ? `?${s}` : ""}`);
  return { n: c.estado === "pronto" ? c.dados : {}, recarregar: c.recarregar };
}

/** Assinatura curta dos dados: muda quando qualquer coisa muda (remonta os formulários). */
export function assinatura(dados: unknown): string {
  const texto = JSON.stringify(dados);
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
