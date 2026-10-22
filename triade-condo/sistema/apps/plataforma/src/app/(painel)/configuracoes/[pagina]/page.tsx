import type { Metadata } from "next";
import { PAGINAS_CONFIGURACAO, paginaDe } from "@triade/configuracoes";
import { PaginaDaConfiguracao } from "@/telas/config/Configuracoes";

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const p = paginaDe((await params).pagina);
  return { title: p ? `${PAGINAS_CONFIGURACAO[p].nome} · Configurações` : "Configurações" };
}

export default async function Pagina({ params }: { params: Promise<{ pagina: string }> }) {
  return <PaginaDaConfiguracao pagina={(await params).pagina} />;
}
