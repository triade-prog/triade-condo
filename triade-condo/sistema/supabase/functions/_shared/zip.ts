// ZIP sem biblioteca (exportação, CT-04): texto vai comprimido (deflate), foto e PDF vão como
// estão. Nomes em UTF-8. Cada pacote fica bem abaixo de 4 GB, então não precisa de ZIP64.

export interface ItemZip {
  nome: string;
  bytes: Uint8Array;
  /** Comprimir vale para texto; foto e PDF já vêm comprimidos. */
  comprimir?: boolean;
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflate(b: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([b as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

function horaDos(d: Date): { hora: number; data: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Nome seguro dentro do ZIP: sem caminho absoluto, sem "..", sem caracteres que o Windows recusa. */
export function nomeNoZip(nome: string): string {
  const partes = nome
    .replace(/\\/g, "/")
    .split("/")
    .map((p) => [...p].map((ch) => (ch.charCodeAt(0) < 32 || '<>:"|?*'.includes(ch) ? "-" : ch)).join("").replace(/\s+/g, " ").trim().slice(0, 120))
    .filter((p) => p && p !== "." && p !== "..");
  return partes.join("/") || "arquivo";
}

export async function montarZip(itens: ItemZip[], quando = new Date()): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const { hora, data } = horaDos(quando);
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  const usados = new Set<string>();
  let deslocamento = 0;
  for (const item of itens) {
    let nome = nomeNoZip(item.nome);
    for (let i = 2; usados.has(nome.toLowerCase()); i++) nome = nomeNoZip(item.nome).replace(/(\.[^./]+)?$/, ` (${i})$1`);
    usados.add(nome.toLowerCase());
    const n = enc.encode(nome);
    const crc = crc32(item.bytes);
    const dados = item.comprimir ? await deflate(item.bytes) : item.bytes;
    const metodo = item.comprimir ? 8 : 0;

    const local = new Uint8Array(30 + n.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);
    l.setUint16(8, metodo, true);
    l.setUint16(10, hora, true);
    l.setUint16(12, data, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, dados.length, true);
    l.setUint32(22, item.bytes.length, true);
    l.setUint16(26, n.length, true);
    local.set(n, 30);
    locais.push(local, dados);

    const central = new Uint8Array(46 + n.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, metodo, true);
    cv.setUint16(12, hora, true);
    cv.setUint16(14, data, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dados.length, true);
    cv.setUint32(24, item.bytes.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, deslocamento, true);
    central.set(n, 46);
    centrais.push(central);
    deslocamento += local.length + dados.length;
  }
  const tamanhoCentral = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, itens.length, true);
  f.setUint16(10, itens.length, true);
  f.setUint32(12, tamanhoCentral, true);
  f.setUint32(16, deslocamento, true);
  const partes = [...locais, ...centrais, fim];
  const saida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

/** Planilha CSV (separada por ponto e vírgula, com BOM, como o Excel em português abre). */
export function planilhaCsv(linhas: Record<string, unknown>[]): string {
  const colunas: string[] = [];
  for (const l of linhas) for (const k of Object.keys(l)) if (!colunas.includes(k)) colunas.push(k);
  const celula = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const t = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(";"))].join("\r\n") + "\r\n";
}
