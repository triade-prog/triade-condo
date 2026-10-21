"use client";
// Onde as Configurações do condomínio rodam (PI-04, decisões 1 e 7): no app, para o condomínio
// da sessão, ou na aba Configuração da ficha do Console, para o cliente da ficha. As telas são
// as mesmas; muda o começo das rotas e o que cada lado pode fazer.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { chamarApi, pedeLogin, textoDoErro, type ErroApi } from "@triade/ui";

export interface Ambiente {
  /** "app": Plataforma do síndico; "console": ficha do cliente no Console. */
  onde: "app" | "console";
  /** Começo das rotas: "/v1/condominio" no app; "/v1/clientes/<id>/condominio" no Console. */
  base: string;
  /** Endereço da Plataforma, para os links do mural e das etiquetas vistos do Console. */
  origemPlataforma?: string;
  /** Depois de salvar (no app, o painel recarrega as pendências). */
  aoMudar?: () => void;
}

const PADRAO: Ambiente = { onde: "app", base: "/v1/condominio" };
let atual: Ambiente = PADRAO;
const Contexto = createContext<Ambiente>(PADRAO);

/** Uma tela de Configurações por vez: o ambiente vale também para as chamadas fora de componente. */
export function ProvedorConfiguracao({ ambiente, children }: { ambiente: Ambiente; children: ReactNode }) {
  atual = ambiente;
  return <Contexto.Provider value={ambiente}>{children}</Contexto.Provider>;
}

export function useAmbiente(): Ambiente {
  return useContext(Contexto);
}

/** O caminho na base do ambiente: naBase("/fuso") é "/v1/condominio/fuso" no app. */
export function naBase(caminho: string): string {
  return `${atual.base}${caminho}`;
}

/** Endereço público na Plataforma (mural, etiqueta): no app, o próprio endereço. */
export function enderecoPlataforma(caminho: string): string {
  const origem = atual.origemPlataforma ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${origem}${caminho}`;
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

/** Assinatura curta dos dados: muda quando qualquer coisa muda (remonta os formulários). */
export function assinatura(dados: unknown): string {
  const texto = JSON.stringify(dados);
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
