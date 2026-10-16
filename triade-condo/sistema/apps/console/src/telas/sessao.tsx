"use client";
// Sessão do Console: quem está, as funções e o que pode fazer fora de um cliente. Sessão
// ausente ou sem o autenticador leva para o login.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chamarApi, pedeLogin, textoDoErro, type ErroApi } from "@triade/ui";

export interface SessaoConsole {
  pessoaId: string;
  nome: string;
  funcoes: string[];
  acoes: string[];
}

export const ContextoSessao = createContext<SessaoConsole | null>(null);

export function useSessao(): SessaoConsole {
  const s = useContext(ContextoSessao);
  if (!s) throw new Error("useSessao fora do painel");
  return s;
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
