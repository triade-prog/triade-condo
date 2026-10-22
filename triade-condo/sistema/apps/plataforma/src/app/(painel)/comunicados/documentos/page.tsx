import { redirect } from "next/navigation";

// Endereço antigo: Documentos agora é a primeira parte de Documentos e memória (DC15, decisão A.1 de 22/10/2026).
export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : (v ?? []).map((x) => [k, x]))));
  redirect(q.size ? `/documentos?${q}` : "/documentos");
}
