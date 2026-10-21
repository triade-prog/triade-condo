// Se a tela está no tamanho de celular (até 767 px, o mesmo corte do max-md). Serve para o que muda
// de comportamento, e não só de aparência, no celular: o Enter do formulário em passos e os
// cartões do Início que ficam fechados.
import { useSyncExternalStore } from "react";

const CELULAR = "(max-width: 767px)";

export function useCelular(): boolean {
  return useSyncExternalStore(
    (avisar) => { const m = window.matchMedia(CELULAR); m.addEventListener("change", avisar); return () => m.removeEventListener("change", avisar); },
    () => window.matchMedia(CELULAR).matches,
    () => false,
  );
}
