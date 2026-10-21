"use client";
// Peças comuns de Comunicados e documentos (peça R1, design "Telas dos Comunicados"): a
// situação em selo, as partes de documentos e memória, o comunicado como linha da lista
// e o envio de um arquivo direto ao armazenamento privado, conferido antes de liberar.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASSUNTOS_COMUNICADO, mostrarTamanho, SITUACOES_COMUNICADO, TIPOS_ARQUIVO, TIPOS_DOCUMENTO } from "@triade/domain";
import { chamarApi, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { subir } from "../pedidos/Arquivos.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import type { ComunicadoResumo, SituacaoComunicado, TipoDocumento } from "../tipos.ts";

const TOM_SITUACAO: Record<SituacaoComunicado, Tom> = {
  RASCUNHO: "neutro", PROGRAMADO: "info", PUBLICADO: "ok", SUBSTITUIDO: "neutro", ARQUIVADO: "neutro",
};

export function SeloComunicado({ estado }: { estado: SituacaoComunicado }) {
  return <Selo tom={TOM_SITUACAO[estado]}>{SITUACOES_COMUNICADO[estado]}</Selo>;
}

export const nomeAssunto = (a: string) => ASSUNTOS_COMUNICADO[a as keyof typeof ASSUNTOS_COMUNICADO] ?? a;
export const nomeTipoDocumento = (t: TipoDocumento) => TIPOS_DOCUMENTO[t];

/** Documentos e memória do prédio, juntos no topo de cada um (DC15: o item "Documentos e memória"
 * do menu). Quem vê os documentos vê os dois. */
export function PartesDocumentos() {
  const caminho = usePathname();
  const partes = [
    { href: "/comunicados/documentos", texto: "Documentos", atual: caminho.startsWith("/comunicados/documento") },
    { href: "/memoria", texto: "Memória do prédio", atual: caminho.startsWith("/memoria") },
  ];
  return (
    <nav aria-label="Partes de documentos e memória" className="trilho justify-self-start">
      {partes.map((p) => (
        <Link key={p.href} href={p.href} className="chip" aria-current={p.atual ? "page" : undefined} data-escolhido={p.atual ? "" : undefined}>
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}

/** Quando: publicado, programado ou a última mudança do rascunho. */
export function quando(c: ComunicadoResumo): string {
  if (c.estado === "PROGRAMADO" && c.programadoPara) return `sai ${diaHora(c.programadoPara)}`;
  if (c.publicadoEm) return diaHora(c.publicadoEm);
  return `editado ${diaHora(c.atualizadoEm)}`;
}

/** Um comunicado na lista: tabela no computador, cartão no celular. */
export function LinhaComunicado({ c }: { c: ComunicadoResumo }) {
  return (
    <li className="grid gap-1.5 border-b border-linha px-4 py-3 last:border-b-0 md:grid-cols-[8.5rem_minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] md:items-center md:gap-4">
      <span><SeloComunicado estado={c.estado} /></span>
      <span className="grid min-w-0 gap-0.5">
        <Link href={`/comunicados/comunicado?id=${c.id}`} className="font-medium hover:text-violeta-600 hover:underline">{c.titulo}</Link>
        <span className="text-[13px] text-tinta-suave">{nomeAssunto(c.assunto)}{c.numero > 1 ? ` · versão ${c.numero}` : ""}</span>
        {c.pedido ? <span className="text-[12.5px] font-medium text-violeta-600">Pedido {c.pedido.protocolo}</span> : null}
        {c.manutencao ? <span className="text-[12.5px] font-medium text-violeta-600">Manutenção: {c.manutencao.titulo}</span> : null}
      </span>
      <span className="text-sm"><span className="text-tinta-suave md:hidden">Para quem: </span>{c.publicoResumo}
        {c.destinatarios !== undefined ? <span className="text-tinta-suave"> · {c.destinatarios === 1 ? "1 contato" : `${c.destinatarios} contatos`}</span> : null}
      </span>
      <span className="text-sm">{c.autor ?? "Alguém"}<span className="block text-xs text-tinta-suave">{quando(c)}</span></span>
    </li>
  );
}

/** O erro da API vem junto quando o pedido do link foi recusado (campos a conferir). */
export type ResultadoUm = { nome: string; liberado: boolean; motivo?: string; erro?: ErroApi };

/** Confere no navegador o tipo e o tamanho antes de enviar (o servidor confere de novo). */
export function conferirArquivo(f: File, limite: number): string | null {
  if (!(f.type in TIPOS_ARQUIVO)) return "Só fotos (JPG, PNG, WEBP) e PDF.";
  if (f.size < 1) return "O arquivo está vazio.";
  if (f.size > limite) return `Passa de ${Math.round(limite / (1024 * 1024))} MB (${mostrarTamanho(f.size)}).`;
  return null;
}

/**
 * Envia um arquivo: pede o link (a rota do comunicado ou da versão do documento), sobe direto ao
 * armazenamento e pede a verificação, que libera ou recusa com o motivo.
 */
export async function enviarUm(rota: string, corpo: Record<string, unknown>, arquivo: File,
  idDe: (d: Record<string, string>) => string, aoProgresso: (p: number) => void = () => {}): Promise<ResultadoUm> {
  const nome = arquivo.name;
  const inicio = await chamarApi<Record<string, string> & { envio: { url: string; tipo: string } }>(rota, {
    corpo: { ...corpo, nome, tipo: arquivo.type, tamanho: arquivo.size },
  });
  if (!inicio.ok) return { nome, liberado: false, motivo: textoDoErro(inicio.erro), erro: inicio.erro };
  const subiu = await subir(inicio.dados.envio.url, arquivo, inicio.dados.envio.tipo, aoProgresso);
  const fim = await chamarApi<{ situacao: string; motivo?: string }>(`${rota}/${idDe(inicio.dados)}/verificar`, { corpo: {} });
  if (!fim.ok) return { nome, liberado: false, motivo: textoDoErro(fim.erro) };
  return fim.dados.situacao === "LIBERADO" ? { nome, liberado: true }
    : { nome, liberado: false, motivo: fim.dados.motivo ?? (subiu ? "O arquivo não foi liberado." : "O envio não terminou. Envie de novo.") };
}

/** Abre um link de 5 minutos numa aba nova (a aba nasce antes, para o navegador não bloquear). */
export async function abrirLink(caminho: string): Promise<string | null> {
  const aba = window.open("about:blank", "_blank");
  const r = await chamarApi<{ url: string }>(caminho);
  if (!r.ok) { aba?.close(); return textoDoErro(r.erro); }
  if (aba) aba.location.href = r.dados.url;
  return null;
}
