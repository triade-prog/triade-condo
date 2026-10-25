// Contrato pelo gov.br (0308, R17.4; CM-13, quadros 440 a 444): o PDF do contrato montado no
// servidor a partir do retrato que o banco guardou, e a conferência automática do PDF assinado.
//
// O PDF sai sempre igual para o mesmo retrato: as datas do arquivo são a da geração (do retrato),
// sem objeto comprimido em fluxo, e a impressão digital (o sha256 do retrato) vai em cada folha.
//
// A assinatura do gov.br (assinador.iti.br) é uma atualização incremental: o assinador acrescenta
// no fim do arquivo o dicionário /Sig com o /ByteRange, o campo de assinatura e o desenho dela, sem
// mexer no que já estava. Então o PDF assinado começa com os mesmos bytes da base (o PDF gerado,
// para o condomínio; o arquivo conferido do condomínio, para a TRÍADE), e o sha256 desses primeiros
// bytes é o da base. A conferência automática (revisão do 3f3902a) lê de fato a parte acrescentada:
//   - a assinatura nova é um objeto /Sig de verdade, com o /ByteRange cobrindo o arquivo inteiro e
//     o /Contents no buraco; um "/Sig" num comentário ou num texto não conta;
//   - a parte acrescentada só traz o que um assinador acrescenta: a assinatura, o campo e o widget,
//     o AcroForm, o Catalog e a página mudando só as /Annots (e o /Info); nenhum outro objeto da
//     base muda, nenhum é apagado, e o índice (xref) aponta só para os objetos acrescentados;
//   - com o pdf-lib, o conteúdo (/Contents), os recursos (/Resources) e as medidas de cada página do
//     arquivo enviado são os mesmos da base, e todo objeto da base continua igual.
// Se o assinador regravar o arquivo ou a parte acrescentada mudar outra coisa, o envio fica
// guardado sem contar (quadro 444). A validade da assinatura (certificado, CPF, data) a equipe
// confere no validar.iti.gov.br.

import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  type PDFFont,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  type PDFObject,
  type PDFPage,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  rgb,
  StandardFonts,
} from "pdf-lib";
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

/**
 * O que a conferência automática manda ao banco (comercial_envio_verificado):
 * - valido: é um PDF que dá para ler (só PDF, até 10 MB, sem conteúdo ativo);
 * - assinaturas: quantos dicionários de assinatura o arquivo tem;
 * - assinaturaNova: há uma assinatura que cobre mais que a base (um /Sig num comentário não conta);
 * - soAssinatura: a parte acrescentada só traz a assinatura e as páginas são as da base;
 * - prefixoSha256: o sha256 dos primeiros bytes, do tamanho da base (o banco compara com a base).
 */
export interface ConferenciaAssinatura {
  valido: boolean;
  motivo?: string;
  sha256?: string;
  tamanho?: number;
  assinaturas?: number;
  assinaturaNova?: boolean;
  soAssinatura?: boolean;
  /** Por que não é só a assinatura (para a equipe e os testes; o banco não guarda). */
  detalhe?: string;
  prefixoSha256?: string | null;
}

export async function sha256Bytes(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const latin1 = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

// ---------------------------------------------------------------------------------------
// Leitura da parte acrescentada, byte a byte, do jeito que um leitor de PDF segue o índice.

/** Um valor de PDF lido da parte acrescentada. As cadeias guardam onde estão no arquivo. */
type Valor =
  | { t: "dict"; v: Map<string, Valor> }
  | { t: "arr"; v: Valor[] }
  | { t: "nome"; v: string }
  | { t: "num"; v: number; inteiro: boolean }
  | { t: "str"; v: Uint8Array; ini: number; fim: number; hex: boolean }
  | { t: "ref"; n: number; g: number }
  | { t: "bool"; v: boolean }
  | { t: "null" };

interface ObjetoLido {
  n: number;
  g: number;
  ini: number;
  valor: Valor;
  fluxo?: Uint8Array;
  tamanhoRef?: { n: number; g: number };
}

interface SecaoLida {
  ini: number;
  /** tipo 0: livre; 1: em uso (pos = onde começa o objeto); 2: dentro de um fluxo de objetos. */
  entradas: { n: number; g: number; tipo: number; pos: number }[];
  trailer: Map<string, Valor>;
  /** O índice em fluxo (/Type /XRef), decodificado depois. */
  fluxo?: ObjetoLido;
}

interface ParteLida {
  objetos: ObjetoLido[];
  secoes: SecaoLida[];
  startxrefs: { pos: number; valor: number }[];
}

class FalhaEstrutura extends Error {}
const falha = (m: string): never => {
  throw new FalhaEstrutura(m);
};

const ESPACO = new Uint8Array(256);
for (const c of [0, 9, 10, 12, 13, 32]) ESPACO[c] = 1;
const DELIMITADOR = new Uint8Array(256);
for (const c of "()<>[]{}/%") DELIMITADOR[c.charCodeAt(0)] = 1;
const DIGITO = (c: number | undefined) => c !== undefined && c >= 48 && c <= 57;
const HEX = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);

class Leitor {
  constructor(readonly b: Uint8Array, public p: number) {}

  get fim() {
    return this.p >= this.b.length;
  }

  espacos() {
    const b = this.b;
    while (this.p < b.length) {
      const c = b[this.p]!;
      if (ESPACO[c]) this.p++;
      else if (c === 37) {
        while (this.p < b.length && b[this.p] !== 10 && b[this.p] !== 13) this.p++;
      } else break;
    }
  }

  olha(palavra: string): boolean {
    for (let i = 0; i < palavra.length; i++) if (this.b[this.p + i] !== palavra.charCodeAt(i)) return false;
    const depois = this.b[this.p + palavra.length];
    return depois === undefined || ESPACO[depois] === 1 || DELIMITADOR[depois] === 1;
  }

  casa(palavra: string): boolean {
    if (!this.olha(palavra)) return false;
    this.p += palavra.length;
    return true;
  }

  inteiro(): number | null {
    const s = this.p;
    while (DIGITO(this.b[this.p])) this.p++;
    if (this.p === s || this.p - s > 10) {
      this.p = s;
      return null;
    }
    return Number(latin1(this.b.subarray(s, this.p)));
  }

  nome(): string {
    this.p++;
    const s = this.p;
    while (this.p < this.b.length && !ESPACO[this.b[this.p]!] && !DELIMITADOR[this.b[this.p]!]) this.p++;
    // Como o pdf-lib: "#hh" vira o byte.
    return latin1(this.b.subarray(s, this.p)).replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  }

  valor(prof = 0): Valor {
    if (prof > 40) falha("valores aninhados demais");
    this.espacos();
    const b = this.b;
    const c = b[this.p];
    if (c === undefined) return falha("o arquivo acaba no meio de um valor");
    if (c === 60 && b[this.p + 1] === 60) {
      this.p += 2;
      const v = new Map<string, Valor>();
      for (;;) {
        this.espacos();
        if (this.fim) falha("dicionário sem fim");
        if (b[this.p] === 62 && b[this.p + 1] === 62) {
          this.p += 2;
          return { t: "dict", v };
        }
        if (b[this.p] !== 47) falha("chave de dicionário que não é nome");
        const k = this.nome();
        v.set(k, this.valor(prof + 1));
      }
    }
    if (c === 60) {
      const ini = this.p++;
      const s = this.p;
      while (this.p < b.length && b[this.p] !== 62) {
        if (!HEX(b[this.p]!)) falha("cadeia hexadecimal com outro caractere");
        this.p++;
      }
      if (this.fim) falha("cadeia hexadecimal sem fim");
      let hex = latin1(b.subarray(s, this.p));
      this.p++;
      if (hex.length % 2) hex += "0";
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
      return { t: "str", v: bytes, ini, fim: this.p, hex: true };
    }
    if (c === 40) return this.literal();
    if (c === 91) {
      this.p++;
      const v: Valor[] = [];
      for (;;) {
        this.espacos();
        if (this.fim) falha("lista sem fim");
        if (b[this.p] === 93) {
          this.p++;
          return { t: "arr", v };
        }
        v.push(this.valor(prof + 1));
      }
    }
    if (c === 47) return { t: "nome", v: this.nome() };
    if (c === 43 || c === 45 || c === 46 || DIGITO(c)) {
      const s = this.p;
      while (this.p < b.length && (b[this.p] === 43 || b[this.p] === 45 || DIGITO(b[this.p]))) this.p++;
      if (b[this.p] === 46) {
        this.p++;
        while (DIGITO(b[this.p])) this.p++;
      }
      const texto = latin1(b.subarray(s, this.p));
      const n = Number(texto);
      if (!texto || !Number.isFinite(n)) falha("número inválido");
      if (/^\d{1,10}$/.test(texto)) {
        const volta = this.p;
        this.espacos();
        const g = this.inteiro();
        if (g !== null) {
          this.espacos();
          if (this.casa("R")) return { t: "ref", n, g };
        }
        this.p = volta;
      }
      return { t: "num", v: n, inteiro: !texto.includes(".") };
    }
    if (this.casa("true")) return { t: "bool", v: true };
    if (this.casa("false")) return { t: "bool", v: false };
    if (this.casa("null")) return { t: "null" };
    return falha("valor desconhecido");
  }

  /** Cadeia entre parênteses, com os escapes como o pdf-lib lê. */
  literal(): Valor {
    const b = this.b;
    const ini = this.p++;
    const bytes: number[] = [];
    let nivel = 1;
    for (;;) {
      if (this.fim) falha("cadeia sem fim");
      const c = b[this.p++]!;
      if (c === 92) {
        const e = b[this.p++];
        if (e === undefined) falha("cadeia sem fim");
        else if (e === 10 || e === 13) continue;
        else if (e === 110) bytes.push(10);
        else if (e === 114) bytes.push(13);
        else if (e === 116) bytes.push(9);
        else if (e === 98) bytes.push(8);
        else if (e === 102) bytes.push(12);
        else if (e >= 48 && e <= 55) {
          let octal = String.fromCharCode(e);
          while (octal.length < 3 && b[this.p]! >= 48 && b[this.p]! <= 55) octal += String.fromCharCode(b[this.p++]!);
          bytes.push(parseInt(octal, 8) & 255);
        } else bytes.push(e);
        continue;
      }
      if (c === 40) nivel++;
      if (c === 41 && --nivel === 0) return { t: "str", v: new Uint8Array(bytes), ini, fim: this.p, hex: false };
      bytes.push(c);
    }
  }

  /** "n g obj ... endobj", com o fluxo se houver. */
  objeto(): ObjetoLido {
    const ini = this.p;
    const n = this.inteiro();
    this.espacos();
    const g = this.inteiro();
    this.espacos();
    if (n === null || g === null || !this.casa("obj")) falha("objeto sem cabeçalho");
    const valor = this.valor();
    this.espacos();
    const o: ObjetoLido = { n: n!, g: g!, ini, valor };
    if (valor.t === "dict" && this.casa("stream")) {
      const b = this.b;
      if (b[this.p] === 32 && b[this.p + 1] === 13 && b[this.p + 2] === 10) this.p += 3;
      else if (b[this.p] === 13 && b[this.p + 1] === 10) this.p += 2;
      else if (b[this.p] === 13 || b[this.p] === 10) this.p += 1;
      const inicio = this.p;
      const tamanho = valor.v.get("Length");
      let fimDados: number;
      if (tamanho?.t === "num" && tamanho.inteiro && tamanho.v >= 0) {
        fimDados = inicio + tamanho.v;
        if (fimDados > b.length) falha("fluxo maior que o arquivo");
        this.p = fimDados;
        this.espacos();
        if (!this.casa("endstream")) falha("fluxo com tamanho errado");
      } else if (tamanho?.t === "ref") {
        // O tamanho em outro objeto: vai até o primeiro "endstream" e confere o tamanho depois.
        const marca = new TextEncoder().encode("endstream");
        let q = inicio;
        procura: for (; q <= b.length - marca.length; q++) {
          for (let i = 0; i < marca.length; i++) if (b[q + i] !== marca[i]) continue procura;
          break;
        }
        if (q > b.length - marca.length) falha("fluxo sem fim");
        fimDados = q;
        if (b[q - 2] === 13 && b[q - 1] === 10) fimDados = q - 2;
        else if (b[q - 1] === 13 || b[q - 1] === 10) fimDados = q - 1;
        if (fimDados < inicio) fimDados = inicio;
        o.tamanhoRef = { n: tamanho.n, g: tamanho.g };
        this.p = q + marca.length;
      } else return falha("fluxo sem tamanho");
      o.fluxo = b.subarray(inicio, fimDados);
      this.espacos();
    }
    if (!this.casa("endobj")) falha("objeto sem endobj");
    return o;
  }

  /** "xref" com as subseções e o "trailer" depois. */
  xref(): SecaoLida {
    const ini = this.p;
    this.casa("xref");
    const entradas: SecaoLida["entradas"] = [];
    for (;;) {
      this.espacos();
      if (!DIGITO(this.b[this.p])) break;
      const primeiro = this.inteiro();
      this.espacos();
      const quantos = this.inteiro();
      if (primeiro === null || quantos === null || quantos > 100000) falha("subseção do índice inválida");
      for (let i = 0; i < quantos!; i++) {
        this.espacos();
        const pos = this.inteiro();
        this.espacos();
        const g = this.inteiro();
        this.espacos();
        const tipo = this.b[this.p];
        if (pos === null || g === null || (tipo !== 110 && tipo !== 102)) falha("entrada do índice inválida");
        this.p++;
        entradas.push({ n: primeiro! + i, g: g!, tipo: tipo === 110 ? 1 : 0, pos: pos! });
      }
    }
    this.espacos();
    if (!this.casa("trailer")) falha("índice sem trailer");
    const trailer = this.valor();
    if (trailer.t !== "dict") return falha("trailer que não é dicionário");
    return { ini, entradas, trailer: trailer.v };
  }
}

/** Lê tudo o que vem depois da base: objetos, índices e startxref. Qualquer outra coisa é falha. */
function lerParteAcrescentada(b: Uint8Array, inicio: number): ParteLida {
  const l = new Leitor(b, inicio);
  const parte: ParteLida = { objetos: [], secoes: [], startxrefs: [] };
  for (;;) {
    l.espacos();
    if (l.fim) return parte;
    if (DIGITO(b[l.p])) {
      const o = l.objeto();
      if (o.valor.t === "dict" && nomeDe(o.valor.v.get("Type")) === "XRef") {
        if (!o.fluxo) falha("índice em fluxo sem fluxo");
        parte.secoes.push({ ini: o.ini, entradas: [], trailer: o.valor.v, fluxo: o });
      } else parte.objetos.push(o);
    } else if (l.olha("xref")) parte.secoes.push(l.xref());
    else if (l.olha("startxref")) {
      const pos = l.p;
      l.casa("startxref");
      l.espacos();
      const valor = l.inteiro();
      if (valor === null) falha("startxref sem número");
      parte.startxrefs.push({ pos, valor: valor! });
    } else falha("conteúdo fora de objeto");
  }
}

const nomeDe = (v: Valor | undefined) => (v?.t === "nome" ? v.v : undefined);
const inteiroDe = (v: Valor | undefined) => (v?.t === "num" && v.inteiro ? v.v : undefined);

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([dados as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** As entradas de um índice em fluxo (/Type /XRef): Flate e o preditor PNG, como os assinadores gravam. */
async function decodificarIndice(s: SecaoLida): Promise<void> {
  const o = s.fluxo!;
  const d = s.trailer;
  const filtro = d.get("Filter");
  const nomeFiltro = filtro?.t === "arr" ? (filtro.v.length === 1 ? nomeDe(filtro.v[0]) : "varios") : nomeDe(filtro);
  if (filtro !== undefined && nomeFiltro !== "FlateDecode") falha("índice em fluxo com filtro desconhecido");
  let dados = filtro ? await inflar(o.fluxo!).catch(() => falha("índice em fluxo ilegível")) : o.fluxo!;
  const parm = d.get("DecodeParms");
  const parametros = parm?.t === "dict" ? parm.v : parm?.t === "arr" && parm.v[0]?.t === "dict" ? parm.v[0].v : undefined;
  const preditor = inteiroDe(parametros?.get("Predictor")) ?? 1;
  const w = d.get("W");
  if (w?.t !== "arr" || w.v.length !== 3) return falha("índice em fluxo sem /W");
  const larguras = w.v.map((x) => inteiroDe(x) ?? -1);
  if (larguras.some((x) => x < 0 || x > 8)) falha("índice em fluxo com /W inválido");
  const linha = larguras[0]! + larguras[1]! + larguras[2]!;
  if (preditor >= 10) {
    const colunas = inteiroDe(parametros?.get("Columns")) ?? 1;
    if (colunas !== linha) falha("índice em fluxo com colunas erradas");
    const saida = new Uint8Array((dados.length / (colunas + 1) | 0) * colunas);
    const anterior = new Uint8Array(colunas);
    for (let r = 0, q = 0; r + colunas + 1 <= dados.length; r += colunas + 1, q += colunas) {
      const tipo = dados[r]!;
      for (let i = 0; i < colunas; i++) {
        const x = dados[r + 1 + i]!;
        const a = i > 0 ? saida[q + i - 1]! : 0;
        const bb = anterior[i]!;
        const c = i > 0 ? anterior[i - 1]! : 0;
        let v: number;
        if (tipo === 0) v = x;
        else if (tipo === 1) v = x + a;
        else if (tipo === 2) v = x + bb;
        else if (tipo === 3) v = x + ((a + bb) >> 1);
        else if (tipo === 4) {
          const pp = a + bb - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c);
        } else return falha("índice em fluxo com preditor inválido");
        saida[q + i] = v & 255;
      }
      anterior.set(saida.subarray(q, q + colunas));
    }
    dados = saida;
  } else if (preditor !== 1) falha("índice em fluxo com preditor desconhecido");
  const tamanho = inteiroDe(d.get("Size"));
  const indice = d.get("Index");
  const faixas: number[] = indice?.t === "arr" ? indice.v.map((x) => inteiroDe(x) ?? -1) : [0, tamanho ?? -1];
  if (faixas.length % 2 || faixas.some((x) => x < 0)) falha("índice em fluxo com /Index inválido");
  const campo = (q: number, largura: number) => {
    let v = 0;
    for (let i = 0; i < largura; i++) v = v * 256 + dados[q + i]!;
    return v;
  };
  let q = 0;
  for (let f = 0; f < faixas.length; f += 2) {
    for (let i = 0; i < faixas[f + 1]!; i++, q += linha) {
      if (q + linha > dados.length) falha("índice em fluxo curto");
      const tipo = larguras[0] ? campo(q, larguras[0]) : 1;
      s.entradas.push({ n: faixas[f]! + i, g: campo(q + larguras[0]! + larguras[1]!, larguras[2]!), tipo, pos: campo(q + larguras[0]!, larguras[1]!) });
    }
  }
}

// ---------------------------------------------------------------------------------------
// Formas canônicas, para comparar o que o pdf-lib leu com o que a leitura acima leu, e a base
// com o arquivo enviado.

const hexDe = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

function canonValor(v: Valor): string {
  switch (v.t) {
    case "dict":
      return "<<" + [...v.v.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => `/${k}=${canonValor(x)}`).join(",") + ">>";
    case "arr":
      return "[" + v.v.map(canonValor).join(",") + "]";
    case "nome":
      return "/" + v.v;
    case "num":
      return "n:" + v.v;
    case "str":
      return "s:" + hexDe(v.v);
    case "ref":
      return `R:${v.n},${v.g}`;
    case "bool":
      return v.v ? "true" : "false";
    case "null":
      return "null";
  }
}

const canonObjetoLido = (o: ObjetoLido) => canonValor(o.valor) + (o.fluxo ? ":fluxo:" + latin1(o.fluxo) : "");

type Resolver = (r: PDFRef) => PDFObject | undefined;

/** Forma canônica de um objeto do pdf-lib; com o resolvedor, segue as referências. */
function canonLib(o: PDFObject | undefined, resolver?: Resolver, pilha = new Set<string>(), sem: string[] = []): string {
  if (o === undefined) return "undef";
  if (o instanceof PDFRef) {
    const k = `${o.objectNumber},${o.generationNumber}`;
    if (!resolver) return `R:${k}`;
    if (pilha.has(k)) return `ciclo:${k}`;
    pilha.add(k);
    const s = canonLib(resolver(o), resolver, pilha);
    pilha.delete(k);
    return s;
  }
  if (o === PDFNull) return "null";
  if (o instanceof PDFBool) return o.asBoolean() ? "true" : "false";
  if (o instanceof PDFNumber) return "n:" + o.asNumber();
  if (o instanceof PDFName) return "/" + latin1(o.asBytes());
  if (o instanceof PDFString || o instanceof PDFHexString) return "s:" + hexDe(o.asBytes());
  if (o instanceof PDFArray) return "[" + o.asArray().map((x) => canonLib(x, resolver, pilha)).join(",") + "]";
  if (o instanceof PDFStream) {
    const dados = o instanceof PDFRawStream ? o.contents : o.getContents();
    return canonLib(o.dict, resolver, pilha) + ":fluxo:" + latin1(dados);
  }
  if (o instanceof PDFDict) {
    return "<<" + o.entries()
      .map(([k, x]) => [latin1(k.asBytes()), x] as const)
      .filter(([k]) => !sem.includes(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `/${k}=${canonLib(x, resolver, pilha)}`).join(",") + ">>";
  }
  return "?" + o.toString();
}

const chave = (n: number, g: number) => `${n},${g}`;
const chaveRef = (r: PDFRef) => chave(r.objectNumber, r.generationNumber);

/** Os dicionários de assinatura (com /ByteRange e /Contents) que o pdf-lib achou. */
function assinaturasDoPdf(doc: PDFDocument): { ref: PDFRef; faixa: number[] }[] {
  const lista: { ref: PDFRef; faixa: number[] }[] = [];
  for (const [ref, o] of doc.context.enumerateIndirectObjects()) {
    if (!(o instanceof PDFDict) || o instanceof PDFStream) continue;
    const faixa = o.lookup(PDFName.of("ByteRange"));
    const conteudo = o.get(PDFName.of("Contents"));
    if (!(faixa instanceof PDFArray) || !(conteudo instanceof PDFString || conteudo instanceof PDFHexString)) continue;
    lista.push({ ref, faixa: faixa.asArray().map((x) => (x instanceof PDFNumber ? x.asNumber() : NaN)) });
  }
  return lista;
}

const AREA_MAXIMA_DO_DESENHO = 0.25;

/**
 * Confere que a parte acrescentada (de base.length ao fim) é só uma assinatura sobre a base. Devolve
 * o motivo quando não é. Base e arquivo já carregados pelo pdf-lib.
 */
async function soAssinaturaSobreBase(b: Uint8Array, base: Uint8Array, bd: PDFDocument, sd: PDFDocument): Promise<string | null> {
  // O pdf-lib termina a base em "%%EOF" sem quebra de linha, e o assinador pode emendar o primeiro
  // objeto ali; o índice aponta para ele, como a leitura daqui.
  const fimBase = base.length;
  const parte = lerParteAcrescentada(b, fimBase);
  for (const s of parte.secoes) if (s.fluxo) await decodificarIndice(s);
  if (parte.secoes.length === 0) return "a parte acrescentada não tem índice";

  // A corrente de índices: cada um aponta para o anterior; o primeiro, para o da base.
  const marcas = [...latin1(base.subarray(Math.max(0, fimBase - 2048))).matchAll(/startxref\s+(\d+)/g)];
  const indiceBase = marcas.length ? Number(marcas[marcas.length - 1]![1]) : NaN;
  const raiz = bd.context.trailerInfo.Root;
  if (!(raiz instanceof PDFRef)) return "a base não tem catálogo";
  if (parte.startxrefs.length !== parte.secoes.length) return "índices e startxref não batem";
  for (let k = 0; k < parte.secoes.length; k++) {
    const s = parte.secoes[k]!;
    const anterior = k === 0 ? indiceBase : parte.secoes[k - 1]!.ini;
    if (inteiroDe(s.trailer.get("Prev")) !== anterior) return "o índice acrescentado não segue o da base";
    if (s.trailer.has("Encrypt") || s.trailer.has("XRefStm")) return "o índice acrescentado traz criptografia ou índice escondido";
    const r = s.trailer.get("Root");
    if (r?.t !== "ref" || r.n !== raiz.objectNumber || r.g !== raiz.generationNumber) return "o índice acrescentado troca o catálogo";
    const sx = parte.startxrefs[k]!;
    if (sx.valor !== s.ini || sx.pos < s.ini || (k + 1 < parte.secoes.length && sx.pos > parte.secoes[k + 1]!.ini)) {
      return "o startxref não aponta para o índice acrescentado";
    }
  }
  const ultimo = parte.startxrefs[parte.startxrefs.length - 1]!;
  if (parte.objetos.some((o) => o.ini > ultimo.pos)) return "há objeto depois do último índice";

  // Cada objeto acrescentado está no índice da sua atualização, no lugar exato; o índice não aponta
  // para mais nada, não apaga objeto e não usa fluxo de objetos.
  const porPosicao = new Map<number, ObjetoLido>();
  for (const o of parte.objetos) porPosicao.set(o.ini, o);
  for (const s of parte.secoes) if (s.fluxo) porPosicao.set(s.fluxo.ini, s.fluxo);
  for (let k = 0; k < parte.secoes.length; k++) {
    const s = parte.secoes[k]!;
    const de = k === 0 ? fimBase : parte.secoes[k - 1]!.ini + 1;
    const listados = new Set<number>();
    for (const e of s.entradas) {
      if (e.tipo === 2) return "o índice acrescentado usa fluxo de objetos";
      if (e.tipo === 0) {
        if (e.n !== 0) return "o índice acrescentado apaga um objeto";
        continue;
      }
      if (e.tipo !== 1) return "entrada desconhecida no índice acrescentado";
      let pos = e.pos;
      while (pos < s.ini && ESPACO[b[pos]!]) pos++;
      const o = porPosicao.get(pos);
      if (!o || o.n !== e.n || o.g !== e.g || pos < de || pos > s.ini) return "o índice acrescentado aponta para fora dos objetos acrescentados";
      listados.add(pos);
    }
    for (const o of parte.objetos) {
      if (o.ini >= de && o.ini < s.ini && !listados.has(o.ini)) return "objeto acrescentado fora do índice";
    }
  }

  // O que vale de cada objeto acrescentado é a última versão (o pdf-lib e os leitores leem igual).
  const ultimos = new Map<string, ObjetoLido>();
  for (const o of parte.objetos) ultimos.set(chave(o.n, o.g), o);

  // Objetos da base: só o catálogo, as páginas, o AcroForm e o /Info podem mudar; nenhum muda de geração.
  const daBase = new Map<string, PDFObject>();
  const numerosBase = new Set<number>();
  for (const [ref, o] of bd.context.enumerateIndirectObjects()) {
    daBase.set(chaveRef(ref), o);
    numerosBase.add(ref.objectNumber);
  }
  const paginasBase = bd.getPages();
  const podemMudar = new Set<string>([chaveRef(raiz), ...paginasBase.map((p) => chaveRef(p.ref))]);
  const formBase = bd.catalog.get(PDFName.of("AcroForm"));
  if (formBase instanceof PDFRef) podemMudar.add(chaveRef(formBase));
  const infoBase = bd.context.trailerInfo.Info;
  if (infoBase instanceof PDFRef) podemMudar.add(chaveRef(infoBase));
  for (const [k, o] of ultimos) {
    if (numerosBase.has(o.n) && !daBase.has(k)) return "o PDF troca a geração de um objeto do contrato";
    if (daBase.has(k) && !podemMudar.has(k)) return "o PDF muda um objeto do contrato";
    if (o.valor.t === "dict" && nomeDe(o.valor.v.get("Type")) === "ObjStm") return "o PDF acrescenta fluxo de objetos";
    if (o.tamanhoRef) {
      const t = ultimos.get(chave(o.tamanhoRef.n, o.tamanhoRef.g));
      if (inteiroDe(t?.valor) !== o.fluxo!.length) return "fluxo com tamanho errado";
    }
  }

  // O pdf-lib leu o mesmo: os acrescentados iguais à leitura acima; os outros, iguais aos da base.
  const vistos = new Set<string>();
  for (const [ref, o] of sd.context.enumerateIndirectObjects()) {
    const k = chaveRef(ref);
    vistos.add(k);
    const lido = ultimos.get(k);
    if (lido) {
      if (canonLib(o) !== canonObjetoLido(lido)) return "o arquivo tem um objeto que não se lê do mesmo jeito";
    } else if (daBase.has(k)) {
      if (canonLib(o) !== canonLib(daBase.get(k))) return "o PDF muda um objeto do contrato";
    } else return "o arquivo tem um objeto escondido";
  }
  for (const k of ultimos.keys()) if (!vistos.has(k)) return "o arquivo tem um objeto que não se lê do mesmo jeito";
  const raizNova = sd.context.trailerInfo.Root;
  if (!(raizNova instanceof PDFRef) || chaveRef(raizNova) !== chaveRef(raiz) || sd.context.trailerInfo.Encrypt) return "o PDF troca o catálogo";

  const resolverB: Resolver = (r) => bd.context.lookup(r);
  const resolverS: Resolver = (r) => sd.context.lookup(r);
  const novo = (r: PDFObject | undefined): r is PDFRef => r instanceof PDFRef && !daBase.has(chaveRef(r)) && ultimos.has(chaveRef(r));
  const campoDeAssinatura = (d: PDFDict | undefined): boolean => {
    for (let i = 0, x = d; x && i < 8; i++, x = x.lookupMaybe(PDFName.of("Parent"), PDFDict)) {
      const ft = x.get(PDFName.of("FT"));
      if (ft) return ft === PDFName.of("Sig");
    }
    return false;
  };

  // O catálogo: igual ao da base, menos o que a assinatura acrescenta.
  const extrasCatalogo = ["AcroForm", "Perms", "DSS", "Extensions", "Metadata"];
  if (canonLib(sd.catalog, undefined, new Set(), extrasCatalogo) !== canonLib(bd.catalog, undefined, new Set(), extrasCatalogo)) {
    return "o PDF muda o catálogo";
  }

  // As páginas: as mesmas, na mesma ordem, com o mesmo conteúdo e os mesmos recursos; só as /Annots
  // ganham o widget da assinatura, pequeno.
  const paginas = sd.getPages();
  if (paginas.length !== paginasBase.length) return "o PDF tem outro número de páginas";
  const widgetsNovos: PDFRef[] = [];
  for (let i = 0; i < paginas.length; i++) {
    const p = paginas[i]!.node;
    const q = paginasBase[i]!.node;
    if (chaveRef(paginas[i]!.ref) !== chaveRef(paginasBase[i]!.ref)) return `a página ${i + 1} não é a do contrato`;
    if (canonLib(p, undefined, new Set(), ["Annots"]) !== canonLib(q, undefined, new Set(), ["Annots"])) return `a página ${i + 1} mudou`;
    for (const [nome, a, bq] of [["conteúdo", p.Contents(), q.Contents()], ["recursos", p.Resources(), q.Resources()],
                                  ["tamanho", p.MediaBox(), q.MediaBox()], ["corte", p.CropBox(), q.CropBox()],
                                  ["giro", p.Rotate(), q.Rotate()]] as const) {
      if (canonLib(a, resolverS) !== canonLib(bq, resolverB)) return `o ${nome} da página ${i + 1} mudou`;
    }
    const anotacoes = (pg: typeof p) => {
      const a = pg.lookupMaybe(PDFName.of("Annots"), PDFArray);
      return a ? a.asArray() : [];
    };
    const antes = anotacoes(q);
    const depois = anotacoes(p);
    if (antes.some((x) => !(x instanceof PDFRef))) return `a página ${i + 1} da base tem anotação direta`;
    const antesK = new Set(antes.map((x) => chaveRef(x as PDFRef)));
    const depoisK = new Set(depois.filter((x): x is PDFRef => x instanceof PDFRef).map(chaveRef));
    for (const k of antesK) if (!depoisK.has(k)) return `a página ${i + 1} perdeu uma anotação`;
    const caixa = p.MediaBox().asArray().map((x) => (x instanceof PDFNumber ? x.asNumber() : 0));
    const areaPagina = Math.abs((caixa[2]! - caixa[0]!) * (caixa[3]! - caixa[1]!));
    for (const x of depois) {
      if (x instanceof PDFRef && antesK.has(chaveRef(x))) continue;
      if (!novo(x)) return `a página ${i + 1} ganhou uma anotação que não é a assinatura`;
      const w = sd.context.lookupMaybe(x, PDFDict);
      if (!w || w.get(PDFName.of("Subtype")) !== PDFName.of("Widget") || !campoDeAssinatura(w)) {
        return `a página ${i + 1} ganhou uma anotação que não é a assinatura`;
      }
      const r = w.lookupMaybe(PDFName.of("Rect"), PDFArray)?.asArray().map((y) => (y instanceof PDFNumber ? y.asNumber() : NaN)) ?? [0, 0, 0, 0];
      if (r.length !== 4 || r.some((y) => !Number.isFinite(y))) return "o desenho da assinatura não tem medida";
      if (Math.abs((r[2]! - r[0]!) * (r[3]! - r[1]!)) > AREA_MAXIMA_DO_DESENHO * areaPagina) return "o desenho da assinatura cobre a página";
      widgetsNovos.push(x);
    }
  }

  // O AcroForm: os campos da base continuam; os novos são de assinatura.
  const form = sd.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const formAntes = bd.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const campos = (f: PDFDict | undefined) => f?.lookupMaybe(PDFName.of("Fields"), PDFArray)?.asArray() ?? [];
  const camposAntes = new Set(campos(formAntes).filter((x): x is PDFRef => x instanceof PDFRef).map(chaveRef));
  const camposDepois = campos(form);
  for (const k of camposAntes) if (!camposDepois.some((x) => x instanceof PDFRef && chaveRef(x) === k)) return "o PDF perdeu um campo";
  for (const x of camposDepois) {
    if (x instanceof PDFRef && camposAntes.has(chaveRef(x))) continue;
    if (!novo(x) || !campoDeAssinatura(sd.context.lookupMaybe(x, PDFDict))) return "o PDF ganhou um campo que não é de assinatura";
  }

  // A assinatura nova: uma só, com o /ByteRange cobrindo o arquivo inteiro e o /Contents no buraco.
  const novas = [...ultimos.values()].filter((o) => o.valor.t === "dict" && o.valor.v.has("ByteRange") && o.valor.v.has("Contents"));
  if (novas.length !== 1) return novas.length ? "o PDF ganhou mais de uma assinatura" : "a parte acrescentada não tem assinatura";
  const sig = novas[0]!.valor as Extract<Valor, { t: "dict" }>;
  const faixa = sig.v.get("ByteRange");
  const conteudo = sig.v.get("Contents");
  const f = faixa?.t === "arr" ? faixa.v.map((x) => inteiroDe(x) ?? -1) : [];
  if (f.length !== 4 || f[0] !== 0 || conteudo?.t !== "str" || !conteudo.hex) return "a assinatura não tem /ByteRange e /Contents";
  if (f[1] !== conteudo.ini || f[2] !== conteudo.fim || f[2]! + f[3]! !== b.length) return "a assinatura não cobre o arquivo inteiro";
  if (conteudo.v.length === 0 || conteudo.v[0] !== 0x30 || conteudo.v.every((x) => x === 0)) return "a assinatura está vazia";
  const usada = widgetsNovos.length + camposDepois.length === 0 ||
    [...widgetsNovos, ...camposDepois.filter((x): x is PDFRef => x instanceof PDFRef && !camposAntes.has(chaveRef(x)))]
      .some((r) => {
        const v = sd.context.lookupMaybe(r, PDFDict)?.get(PDFName.of("V"));
        return v instanceof PDFRef && chave(v.objectNumber, v.generationNumber) === chave(novas[0]!.n, novas[0]!.g);
      });
  if (!usada) return "a assinatura nova não é a do campo acrescentado";
  return null;
}

/**
 * Confere o PDF assinado contra a base (o PDF gerado, ou o arquivo conferido do condomínio). Só PDF,
 * até 10 MB, sem conteúdo ativo; o banco compara o resumo dos primeiros bytes com o resumo da base.
 */
export async function conferirAssinatura(bytes: Uint8Array | null, base: Uint8Array): Promise<ConferenciaAssinatura> {
  if (!bytes) return { valido: false, motivo: "O arquivo não chegou. Envie de novo." };
  const r = verificarArquivo(bytes, "application/pdf", TAMANHO_MAXIMO_PDF_CONTRATO);
  if (!r.ok) return { valido: false, motivo: r.motivo };
  let sd: PDFDocument;
  try {
    sd = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    return { valido: false, motivo: "Não deu para ler este PDF. Baixe o contrato de novo, assine pelo gov.br e envie o arquivo que ele devolver." };
  }
  const bd = await PDFDocument.load(base, { updateMetadata: false });
  const assinaturas = assinaturasDoPdf(sd);
  // Nova é a que cobre mais que a base: as da base param no tamanho dela.
  const assinaturaNova = assinaturas.some(({ faixa: f }) =>
    f.length === 4 && f.every(Number.isInteger) && f[0] === 0 && f[2]! + f[3]! > base.length && f[2]! + f[3]! <= bytes.length);
  const prefixoIgual = bytes.length > base.length && bytes.subarray(0, base.length).every((x, i) => x === base[i]);
  let detalhe: string | null = prefixoIgual ? null : "o começo do arquivo não é a base";
  if (prefixoIgual) {
    try {
      detalhe = await soAssinaturaSobreBase(bytes, base, bd, sd);
    } catch (e) {
      detalhe = e instanceof FalhaEstrutura ? e.message : "a parte acrescentada não pôde ser lida";
    }
  }
  return {
    valido: true,
    sha256: await sha256Bytes(bytes),
    tamanho: bytes.length,
    assinaturas: assinaturas.length,
    assinaturaNova,
    soAssinatura: detalhe === null,
    ...(detalhe ? { detalhe } : {}),
    prefixoSha256: bytes.length > base.length ? await sha256Bytes(bytes.subarray(0, base.length)) : null,
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
