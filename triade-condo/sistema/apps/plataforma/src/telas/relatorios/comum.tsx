// O que as telas do relatório do mês (TR-02, TR-05, TR-08, TR-10) dividem: o que a lista devolve,
// a data de geração no fuso do condomínio e o download de um arquivo feito no navegador.

import Link from "next/link";
import type { ParteRelatorio } from "@triade/domain";
import { Icone } from "@triade/ui";

export interface RelatorioDaLista {
  id: string;
  mes: string;
  numero: number;
  partes: ParteRelatorio[];
  anexos: number;
  geradoEm: string;
  autor: string | null;
  ultimo: boolean;
}

export interface ListaRelatorios {
  mesFechado: string;
  mesFechadoGerado: boolean;
  meses: string[];
  modelo: { partes: ParteRelatorio[]; guardadoEm?: string; guardadoPor?: string | null };
  gerados: RelatorioDaLista[];
  pode: { decisoes: boolean; documentos: boolean };
}

/** "24/10/2026 às 09:12", no fuso do condomínio. */
export function quandoGerado(iso: string, fuso = "America/Sao_Paulo"): string {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${dia} às ${hora}`;
}

/** Entrega ao navegador um arquivo montado aqui (PDF ou planilha). */
export function baixarArquivo(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Voltar({ href, texto }: { href: string; texto: string }) {
  return (
    <Link href={href} className="flex items-center gap-1 justify-self-start t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />{texto}
    </Link>
  );
}
