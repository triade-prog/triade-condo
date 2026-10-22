import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PARTES_DOCUMENTOS, type ParteDocumentos } from "@triade/domain";
import { Carregando } from "@triade/ui";
import { DocumentosEMemoria } from "@/telas/documentos/DocumentosEMemoria";

// Prontuário, Linha do tempo, Manual do prédio e Passagem e exportação; Documentos fica em /documentos.
const parteDe = (p: string): ParteDocumentos | null => (p !== "documentos" && p in PARTES_DOCUMENTOS ? (p as ParteDocumentos) : null);

export async function generateMetadata({ params }: { params: Promise<{ parte: string }> }): Promise<Metadata> {
  const p = parteDe((await params).parte);
  return { title: p ? `${PARTES_DOCUMENTOS[p]} · Documentos e memória` : "Documentos e memória" };
}

export default async function Pagina({ params }: { params: Promise<{ parte: string }> }) {
  const p = parteDe((await params).parte);
  if (!p) notFound();
  return (
    <Suspense fallback={<Carregando />}>
      <DocumentosEMemoria parte={p} />
    </Suspense>
  );
}
