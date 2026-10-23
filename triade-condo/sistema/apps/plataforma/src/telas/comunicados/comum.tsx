"use client";
// Peças comuns de Comunicados e documentos (peça R1, design "Telas dos Comunicados"): a
// situação em selo, as partes de documentos e memória, o comunicado como linha da lista
// e o envio de um arquivo direto ao armazenamento privado, conferido antes de liberar.

import Link from "next/link";
import { ASSUNTOS_COMUNICADO, mostrarTamanho, SITUACOES_COMUNICADO, TIPOS_ARQUIVO, TIPOS_DOCUMENTO } from "@triade/domain";
import { chamarApi, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone, type Tom } from "@triade/ui";
import { subir } from "../pedidos/Arquivos.tsx";
import { dia, diaDe, diaHora } from "../pedidos/comum.tsx";
import type { ComunicadoResumo, SituacaoComunicado, TipoDocumento } from "../tipos.ts";

const TOM_SITUACAO: Record<SituacaoComunicado, Tom> = {
  RASCUNHO: "neutro", PROGRAMADO: "info", PUBLICADO: "ok", SUBSTITUIDO: "neutro", ARQUIVADO: "neutro",
};

export function SeloComunicado({ estado }: { estado: SituacaoComunicado }) {
  return <Selo tom={TOM_SITUACAO[estado]}>{SITUACOES_COMUNICADO[estado]}</Selo>;
}

export const nomeAssunto = (a: string) => ASSUNTOS_COMUNICADO[a as keyof typeof ASSUNTOS_COMUNICADO] ?? a;
export const nomeTipoDocumento = (t: TipoDocumento) => TIPOS_DOCUMENTO[t];

/** Quem vê o documento num selo: vai ao morador (jade), só quem cuida (âmbar) ou só a gestão. */
export function SeloQuemVe({ d, sempre }: { d: { restrito: boolean; aoMorador: boolean }; sempre?: boolean }) {
  if (d.restrito) return <Selo tom="atencao">Só quem cuida</Selo>;
  if (d.aoMorador) return <Selo tom="ok">Vai ao morador</Selo>;
  return sempre ? <Selo tom="neutro">Só a gestão</Selo> : null;
}

/** Quando: publicado, programado ou a última mudança do rascunho. */
export function quando(c: ComunicadoResumo): string {
  if (c.estado === "PROGRAMADO" && c.programadoPara) return `sai ${diaHora(c.programadoPara)}`;
  if (c.publicadoEm) return diaHora(c.publicadoEm);
  return `editado ${diaHora(c.atualizadoEm)}`;
}

export const ICONE_ASSUNTO: Record<string, NomeIcone> = { AVISO: "megafone", OBRAS: "ferramenta", SEGURANCA: "escudo", ASSEMBLEIA: "pessoas", LEMBRETE: "relogio" };

/** Dias inteiros desde um instante, no horário de Brasília. */
function diasDesde(iso: string, agora = new Date()): number {
  return Math.round((Date.parse(diaDe(agora.toISOString())) - Date.parse(diaDe(iso))) / 86400_000);
}

/** A situação e a data num selo só (DC15): "Publicado · 20/10", "Programado · para 25/10",
 * "Rascunho · editado há 4 dias" (em âmbar depois de 3 dias parado). */
export function seloDaLista(c: ComunicadoResumo): { texto: string; tom: Tom } {
  if (c.estado === "PUBLICADO" && c.publicadoEm) return { texto: `Publicado · ${dia(c.publicadoEm)}`, tom: "ok" };
  if (c.estado === "PROGRAMADO" && c.programadoPara) return { texto: `Programado · para ${dia(c.programadoPara)}`, tom: "info" };
  if (c.estado === "RASCUNHO") {
    const d = diasDesde(c.atualizadoEm);
    return { texto: `Rascunho · editado ${d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`}`, tom: d > 3 ? "atencao" : "neutro" };
  }
  if (c.estado === "ARQUIVADO" && c.arquivadoEm) return { texto: `Arquivado · ${dia(c.arquivadoEm)}`, tom: "neutro" };
  if (c.estado === "SUBSTITUIDO" && c.substituidoEm) return { texto: `Substituído · ${dia(c.substituidoEm)}`, tom: "neutro" };
  return { texto: SITUACOES_COMUNICADO[c.estado], tom: TOM_SITUACAO[c.estado] };
}

const COLUNAS = "md:grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_20px]";

/** O cabeçalho da lista, só no computador. */
export function CabecaComunicados() {
  return (
    <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
      <span /><span className="t-rotulo">Comunicado</span><span className="t-rotulo">Para quem</span><span className="t-rotulo">Situação</span><span />
    </div>
  );
}

/** Um comunicado na lista (DC15): a linha inteira abre; no celular vira cartão. */
export function LinhaComunicado({ c }: { c: ComunicadoResumo }) {
  const selo = seloDaLista(c);
  const quantos = c.destinatarios !== undefined ? ` · ${c.destinatarios === 1 ? "1 contato" : `${c.destinatarios} contatos`}` : "";
  return (
    <li className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
      <span className="ladrilho h-11 w-11 self-start rounded-xl md:self-center" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_ASSUNTO[c.assunto] ?? "megafone"} /></span>
      <div className="grid min-w-0 gap-0.5">
        <Link href={`/comunicados/comunicado?id=${c.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{c.titulo}</Link>
        <span className="t-apoio">
          {nomeAssunto(c.assunto)}{c.numero > 1 ? ` · versão ${c.numero}` : ""}
          {c.pedido ? <> · <span className="font-medium text-violeta-600">Pedido {c.pedido.protocolo}</span></> : null}
          {c.manutencao ? <> · <span className="font-medium text-violeta-600">Manutenção: {c.manutencao.titulo}</span></> : null}
        </span>
        <span className="t-apoio md:hidden">{c.publicoResumo}{quantos} · {c.autor ?? "Alguém"}</span>
        <span className="pt-1 md:hidden"><Selo tom={selo.tom}>{selo.texto}</Selo></span>
      </div>
      <span className="grid t-texto max-md:hidden"><span>{c.publicoResumo}{quantos}</span><span className="t-apoio">por {c.autor ?? "alguém"}</span></span>
      <span className="justify-self-start max-md:hidden"><Selo tom={selo.tom}>{selo.texto}</Selo></span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
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
