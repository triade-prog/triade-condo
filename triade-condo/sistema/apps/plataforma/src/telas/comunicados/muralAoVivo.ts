"use client";
// O mural ao vivo no painel (CD-15): confere de novo a cada 30 segundos enquanto a tela está à
// vista, e na hora em que alguém pede. Se uma conferida falha, fica o que já estava, com a hora.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MURAL_CONFERIR_S } from "@triade/domain";
import { chamarApi, pedeLogin, textoDoErro, type ErroApi } from "@triade/ui";
import type { MuralNoPainel } from "../tipos.ts";

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; erro: ErroApi; texto: string }
  | { estado: "pronto"; dados: MuralNoPainel; conferidoEm: number; falhou: boolean };
export type MuralAoVivo = Carga & { conferir: () => void };

export function useMuralAoVivo(): MuralAoVivo {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const pedindo = useRef(false);
  const deNovo = useRef(false);

  // Pedido no meio de outra conferida (por exemplo, logo depois de tirar um aviso): confere de novo ao terminar.
  const conferir = useCallback(function conferirAgora() {
    if (pedindo.current) { deNovo.current = true; return; }
    pedindo.current = true;
    void chamarApi<MuralNoPainel>("/v1/condominio/mural").then((r) => {
      pedindo.current = false;
      if (deNovo.current) { deNovo.current = false; conferirAgora(); }
      if (r.ok) return setCarga({ estado: "pronto", dados: r.dados, conferidoEm: Date.now(), falhou: false });
      if (pedeLogin(r.erro)) return router.replace("/entrar");
      setCarga((c) => (c.estado === "pronto" ? { ...c, falhou: true } : { estado: "erro", erro: r.erro, texto: textoDoErro(r.erro) }));
    });
  }, [router]);

  useEffect(() => {
    conferir();
    const vez = window.setInterval(() => { if (document.visibilityState === "visible") conferir(); }, MURAL_CONFERIR_S * 1000);
    const voltou = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { window.clearInterval(vez); document.removeEventListener("visibilitychange", voltou); };
  }, [conferir]);

  return { ...carga, conferir };
}

/** Um relógio que anda de 5 em 5 segundos, para o "Conferido há 12 s". */
export function useAgora(passoMs = 5000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const vez = window.setInterval(() => setAgora(Date.now()), passoMs);
    return () => window.clearInterval(vez);
  }, [passoMs]);
  return agora;
}
