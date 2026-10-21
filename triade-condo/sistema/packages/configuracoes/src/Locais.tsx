"use client";
// Os locais das etiquetas (AT-30) como sugestão no campo Local de pedidos, manutenção e agenda.
// O campo continua aceitando texto livre; a lista só ajuda a escrever o mesmo nome.

import { useEffect, useState } from "react";
import { chamarApi } from "@triade/ui";

let guardados: Promise<string[]> | null = null;

export function ListaLocais({ id, extras = [] }: { id: string; extras?: string[] }) {
  const [locais, setLocais] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    guardados ??= chamarApi<string[]>("/v1/condominio/locais").then((r) => (r.ok ? r.dados : []));
    void guardados.then((l) => { if (vivo) setLocais(l); });
    return () => { vivo = false; };
  }, []);
  const todos = [...new Set([...locais, ...extras])];
  return <datalist id={id}>{todos.map((l) => <option key={l} value={l} />)}</datalist>;
}

/** Depois de criar ou mudar etiqueta, a lista volta a ser lida. */
export function esquecerLocais() {
  guardados = null;
}
