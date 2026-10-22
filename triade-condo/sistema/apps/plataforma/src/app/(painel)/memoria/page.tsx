import { redirect } from "next/navigation";
import { enderecoParteDocumentos, parteDaAbaAntiga } from "@triade/domain";

// Endereço antigo da Memória do prédio: cada aba virou uma parte de Documentos e memória (DC15, decisões A.1 e C.1 de 22/10/2026).
export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const aba = (await searchParams).aba;
  redirect(enderecoParteDocumentos(parteDaAbaAntiga(typeof aba === "string" ? aba : null)));
}
