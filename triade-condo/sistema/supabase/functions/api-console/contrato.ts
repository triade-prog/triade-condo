// Contrato pelo gov.br (0308, R17.4; CM-13, quadros 440 a 444): o PDF do contrato montado no
// servidor a partir do retrato que o banco guardou, e a conferência automática do PDF assinado.
//
// O PDF sai sempre igual para o mesmo retrato: as datas do arquivo são a da geração (do retrato),
// sem objeto comprimido em fluxo, e a impressão digital (o sha256 do retrato) vai em cada folha.
//
// A assinatura do gov.br (assinador.iti.br) é uma atualização incremental: o assinador acrescenta
// no fim do arquivo o dicionário /Sig com o /ByteRange, sem mexer no que já estava. Então o PDF
// assinado começa com os mesmos bytes da base (o PDF gerado, para o condomínio; o arquivo
// conferido do condomínio, para a TRÍADE), e o sha256 desses primeiros bytes é o da base. Se o
// assinador regravar o arquivo, o começo muda e o envio fica guardado sem contar (quadro 444). A
// validade da assinatura (certificado, CPF, data) a equipe confere no validar.iti.gov.br.

import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { TAMANHO_MAXIMO_PDF_CONTRATO } from "@triade/domain";
import { verificarArquivo } from "../_shared/arquivos.ts";

/** O retrato do contrato que o banco guarda (contratos_comercial.dados). */
export interface RetratoContrato {
  numero: number;
  titulo: string;
  texto: string;
  termo: string;
  campos: Record<string, string>;
  modelo: { numero: number; advogado: string; oab: string; revisadoEm: string };
  proposta: { numero: number; hash: string; aceitaEm: string };
  geradoEm: string;
  dataInicio: string;
}

/** O que a conferência automática manda ao banco (comercial_envio_verificado). */
export interface ConferenciaAssinatura {
  valido: boolean;
  motivo?: string;
  sha256?: string;
  tamanho?: number;
  assinaturas?: number;
  prefixoSha256?: string | null;
}

export async function sha256Bytes(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

/**
 * Quantas assinaturas digitais o PDF tem: cada assinatura é um dicionário /Sig com /ByteRange.
 * Sem /Sig no arquivo, zero (um /ByteRange solto não é assinatura).
 */
export function contarAssinaturas(b: Uint8Array): number {
  const t = latin1(b);
  if (!/\/Type\s*\/Sig\b/.test(t) && !/\/FT\s*\/Sig\b/.test(t)) return 0;
  return [...t.matchAll(/\/ByteRange\s*\[/g)].length;
}

/**
 * Confere o PDF assinado contra a base (o tamanho da base; o banco compara o resumo dos primeiros
 * bytes com o resumo dela). Só PDF, até 10 MB, sem conteúdo ativo.
 */
export async function conferirAssinatura(bytes: Uint8Array | null, baseTamanho: number): Promise<ConferenciaAssinatura> {
  if (!bytes) return { valido: false, motivo: "O arquivo não chegou. Envie de novo." };
  const r = verificarArquivo(bytes, "application/pdf", TAMANHO_MAXIMO_PDF_CONTRATO);
  if (!r.ok) return { valido: false, motivo: r.motivo };
  return {
    valido: true,
    sha256: await sha256Bytes(bytes),
    tamanho: bytes.length,
    assinaturas: contarAssinaturas(bytes),
    prefixoSha256: bytes.length > baseTamanho ? await sha256Bytes(bytes.subarray(0, baseTamanho)) : null,
  };
}

// ---------------------------------------------------------------------------------------
// O PDF do contrato.

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;
const RODAPE = 34;
const CINZA = rgb(0.35, 0.35, 0.35);

/** Data de Brasília, como o contrato escreve: 24/10/2026. */
function dataBr(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

/** Tira o que a fonte padrão do PDF (WinAnsi) não escreve, para o PDF nunca falhar. */
function limpar(texto: string, aceitos: Set<number>): string {
  return [...texto.normalize("NFC").replace(/\t/g, "    ").replace(/\r/g, "")]
    .map((ch) => (ch === "\n" || aceitos.has(ch.codePointAt(0)!) ? ch : ch === "→" ? "->" : "?"))
    .join("");
}

/** Quebra o parágrafo em linhas que cabem na largura. */
function quebrar(paragrafo: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of paragrafo.split(/ +/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  linhas.push(atual);
  return linhas;
}

class Escritor {
  pagina!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private aceitos: Set<number>) {
    this.novaPagina();
  }
  novaPagina() {
    this.pagina = this.doc.addPage([A4.largura, A4.altura]);
    this.y = A4.altura - MARGEM;
  }
  texto(texto: string, fonte: PDFFont, tamanho: number, opcoes: { entre?: number; depois?: number; cor?: ReturnType<typeof rgb> } = {}) {
    const altura = tamanho * 1.35;
    for (const paragrafo of limpar(texto, this.aceitos).split("\n")) {
      if (paragrafo.trim() === "") {
        this.y -= altura * 0.6;
        continue;
      }
      for (const linha of quebrar(paragrafo, fonte, tamanho, A4.largura - 2 * MARGEM)) {
        if (this.y - altura < MARGEM + RODAPE) this.novaPagina();
        this.y -= altura;
        this.pagina.drawText(linha, { x: MARGEM, y: this.y, size: tamanho, font: fonte, color: opcoes.cor ?? rgb(0, 0, 0) });
      }
      this.y -= opcoes.entre ?? tamanho * 0.5;
    }
    this.y -= opcoes.depois ?? 0;
  }
}

/** Monta o PDF do contrato e do termo de tratamento de dados, com a impressão digital em cada folha. */
export async function gerarPdfContrato(d: RetratoContrato, hash: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const aceitos = new Set(fonte.getCharacterSet());
  const quando = new Date(d.geradoEm);
  doc.setTitle(`Contrato TRÍADE nº ${d.numero} · ${d.campos.condominio ?? ""}`.trim());
  doc.setAuthor("TRÍADE Condo");
  doc.setSubject(`Impressão digital (sha256): ${hash}`);
  doc.setCreator("TRÍADE Condo");
  doc.setProducer("TRÍADE Condo");
  doc.setCreationDate(quando);
  doc.setModificationDate(quando);

  const e = new Escritor(doc, aceitos);
  e.texto(d.titulo, negrito, 14, { depois: 4 });
  e.texto(`Contrato nº ${d.numero} · proposta v${d.proposta.numero} aceita em ${dataBr(d.proposta.aceitaEm)} · gerado em ${dataBr(d.geradoEm)}`, fonte, 8.5,
          { cor: CINZA });
  e.texto(`Modelo v${d.modelo.numero}, revisado por ${d.modelo.advogado} (OAB ${d.modelo.oab}) em ${dataBr(d.modelo.revisadoEm)}`, fonte, 8.5,
          { cor: CINZA, depois: 10 });
  e.texto(d.texto, fonte, 10.5);
  e.novaPagina();
  e.texto("Termo de tratamento de dados", negrito, 13, { depois: 6 });
  e.texto(d.termo, fonte, 10.5, { depois: 18 });
  e.texto("Assinaturas digitais pelo gov.br (assinador.iti.br), sem mudar nada no arquivo: primeiro quem representa o condomínio; "
          + "depois a TRÍADE, sobre o arquivo já assinado pelo condomínio.", fonte, 9, { cor: CINZA });

  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    const linha = limpar(`Contrato TRÍADE nº ${d.numero} · Impressão digital (sha256): ${hash} · Página ${i + 1} de ${paginas.length}`, aceitos);
    p.drawText(linha, { x: MARGEM, y: 24, size: 6.5, font: fonte, color: CINZA });
  });
  return await doc.save({ useObjectStreams: false });
}
