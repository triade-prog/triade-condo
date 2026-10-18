// Fotos e documentos (passo 4b; PT-07). Armazenamento privado do Supabase, acessado só com a
// chave de serviço, e a verificação do conteúdo antes de liberar: o tipo de verdade (pelos
// primeiros bytes, não pelo nome), o tamanho, a localização tirada das fotos e o PDF sem
// conteúdo ativo.

import { TAMANHO_MAXIMO_ARQUIVO, type TipoArquivo } from "@triade/domain";

export interface Armazenamento {
  /** Link para o navegador enviar o arquivo uma vez, direto para o armazenamento (PUT). */
  linkEnvio(caminho: string): Promise<string>;
  ler(caminho: string): Promise<Uint8Array | null>;
  gravar(caminho: string, bytes: Uint8Array, tipo: string): Promise<void>;
  apagar(caminho: string): Promise<void>;
  /** Link que vale pelos segundos dados; com baixarComo, o navegador baixa com esse nome. */
  linkLeitura(caminho: string, segundos: number, baixarComo?: string): Promise<string>;
}

/**
 * Um bucket privado por parte do sistema: "pedidos" (passo 4b), "manutencoes" (peça R6),
 * "comunicados" e "documentos" (peça R1) e "exportacoes" (peça R10). O caminho é sempre
 * condomínio/registro/arquivo; a foto mandada pelo prestador no link (peça R13) fica em
 * condomínio/manutenção/prestador/arquivo.
 */
export function armazenamentoSupabase(url: string, chaveServico: string, buscar: typeof fetch = fetch,
  bucket: "pedidos" | "manutencoes" | "comunicados" | "documentos" | "exportacoes" = "pedidos"): Armazenamento {
  const base = `${url.replace(/\/$/, "")}/storage/v1`;
  const auth = { apikey: chaveServico, authorization: `Bearer ${chaveServico}` };
  const objeto = (caminho: string) => {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:prestador\/)?[0-9a-f-]{36}$/.test(caminho)) throw new Error("Caminho de arquivo inválido");
    return `${bucket}/${caminho}`;
  };
  function exigirOk(r: Response, oQue: string): Response {
    if (!r.ok) throw new Error(`Armazenamento: falha ao ${oQue} (${r.status})`);
    return r;
  }
  return {
    async linkEnvio(caminho) {
      const r = await exigirOk(await buscar(`${base}/object/upload/sign/${objeto(caminho)}`, { method: "POST", headers: auth }), "gerar o link de envio");
      const { url: relativo } = await r.json() as { url: string };
      return `${base}${relativo}`;
    },
    async ler(caminho) {
      const r = await buscar(`${base}/object/${objeto(caminho)}`, { headers: auth });
      if (r.status === 400 || r.status === 404) return null;
      await exigirOk(r, "ler");
      return new Uint8Array(await r.arrayBuffer());
    },
    async gravar(caminho, bytes, tipo) {
      await exigirOk(await buscar(`${base}/object/${objeto(caminho)}`, {
        method: "POST",
        headers: { ...auth, "content-type": tipo, "x-upsert": "true" },
        body: bytes as Uint8Array<ArrayBuffer>,
      }), "gravar");
    },
    async apagar(caminho) {
      await buscar(`${base}/object/${objeto(caminho)}`, { method: "DELETE", headers: auth });
    },
    async linkLeitura(caminho, segundos, baixarComo) {
      const r = await exigirOk(await buscar(`${base}/object/sign/${objeto(caminho)}`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ expiresIn: segundos }),
      }), "gerar o link");
      const { signedURL } = await r.json() as { signedURL: string };
      const link = `${base}${signedURL}`;
      return baixarComo ? `${link}&download=${encodeURIComponent(baixarComo)}` : link;
    },
  };
}

export type ResultadoVerificacao = { ok: true; bytes: Uint8Array } | { ok: false; motivo: string };

const recusar = (motivo: string): ResultadoVerificacao => ({ ok: false, motivo });
const comeca = (b: Uint8Array, assinatura: number[], desde = 0) => assinatura.every((x, i) => b[desde + i] === x);
const ascii = (b: Uint8Array, desde: number, n: number) => String.fromCharCode(...b.subarray(desde, desde + n));

/**
 * Confere o arquivo e devolve os bytes que podem ser guardados (sem localização nas fotos). Os
 * documentos do prédio aceitam até 20 MB; o resto, 10 MB.
 */
export function verificarArquivo(bytes: Uint8Array, tipo: TipoArquivo, limite = TAMANHO_MAXIMO_ARQUIVO): ResultadoVerificacao {
  if (bytes.length === 0) return recusar("O arquivo chegou vazio.");
  if (bytes.length > limite) return recusar(`O arquivo passa de ${Math.round(limite / (1024 * 1024))} MB.`);
  try {
    switch (tipo) {
      case "image/jpeg":
        return comeca(bytes, [0xff, 0xd8, 0xff]) ? limparJpeg(bytes) : recusar("O conteúdo não é uma foto JPG de verdade.");
      case "image/png":
        return comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? limparPng(bytes) : recusar("O conteúdo não é uma foto PNG de verdade.");
      case "image/webp":
        return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP" ? limparWebp(bytes) : recusar("O conteúdo não é uma foto WEBP de verdade.");
      case "application/pdf":
        return conferirPdf(bytes);
      default:
        return recusar("Só fotos (JPG, PNG, WEBP) e PDF.");
    }
  } catch {
    return recusar("O arquivo está corrompido ou num formato que não dá para conferir.");
  }
}

function juntar(partes: Uint8Array[]): Uint8Array {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

/**
 * JPG: tira os blocos XMP e IPTC (podem ter localização) e apaga a parte de GPS do EXIF,
 * mantendo o resto do EXIF (a orientação da foto continua certa).
 */
function limparJpeg(b: Uint8Array): ResultadoVerificacao {
  const partes: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return recusar("O conteúdo não é uma foto JPG de verdade.");
    const marcador = b[i + 1]!;
    if (marcador === 0xff) { i++; continue; }
    if (marcador === 0xda || marcador === 0xd9) { partes.push(b.subarray(i)); return { ok: true, bytes: juntar(partes) }; }
    if (marcador >= 0xd0 && marcador <= 0xd7) { partes.push(b.subarray(i, i + 2)); i += 2; continue; }
    const tamanho = (b[i + 2]! << 8) | b[i + 3]!;
    if (tamanho < 2 || i + 2 + tamanho > b.length) return recusar("O arquivo está corrompido ou num formato que não dá para conferir.");
    const bloco = b.slice(i, i + 2 + tamanho);
    const dados = 4;
    if (marcador === 0xe1 && ascii(bloco, dados, 6) === "Exif\0\0") {
      apagarGpsDoExif(bloco, dados + 6);
      partes.push(bloco);
    } else if (marcador === 0xe1 || marcador === 0xed) {
      // XMP e IPTC: fora.
    } else {
      partes.push(bloco);
    }
    i += 2 + tamanho;
  }
  return recusar("O conteúdo não é uma foto JPG de verdade.");
}

/** Zera a parte de GPS de um EXIF (TIFF começando em `t`) e deixa o diretório dela vazio. */
export function apagarGpsDoExif(b: Uint8Array, t: number): void {
  const le = ascii(b, t, 2) === "II";
  if (!le && ascii(b, t, 2) !== "MM") return;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o: number) => v.getUint16(t + o, le);
  const u32 = (o: number) => v.getUint32(t + o, le);
  const dentro = (o: number, n: number) => o >= 0 && t + o + n <= b.length;
  if (!dentro(4, 4)) return;
  const ifd0 = u32(4);
  if (!dentro(ifd0, 2)) return;
  const n0 = u16(ifd0);
  for (let k = 0; k < n0; k++) {
    const e = ifd0 + 2 + k * 12;
    if (!dentro(e, 12) || u16(e) !== 0x8825) continue;
    const gps = u32(e + 8);
    if (!dentro(gps, 2)) return;
    const n = u16(gps);
    const BYTES_TIPO: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    for (let j = 0; j < n; j++) {
      const g = gps + 2 + j * 12;
      if (!dentro(g, 12)) break;
      const total = (BYTES_TIPO[u16(g + 2)] ?? 1) * u32(g + 4);
      if (total > 4) {
        const fora = u32(g + 8);
        if (dentro(fora, total)) b.fill(0, t + fora, t + fora + total);
      }
      b.fill(0, t + g, t + g + 12);
    }
    v.setUint16(t + gps, 0, le);
    return;
  }
}

/** PNG: tira EXIF e textos (podem ter localização e dados de quem tirou a foto). */
function limparPng(b: Uint8Array): ResultadoVerificacao {
  const partes: Uint8Array[] = [b.subarray(0, 8)];
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 8;
  while (i + 12 <= b.length) {
    const tamanho = v.getUint32(i);
    const tipo = ascii(b, i + 4, 4);
    const fim = i + 12 + tamanho;
    if (fim > b.length) return recusar("O arquivo está corrompido ou num formato que não dá para conferir.");
    if (!["eXIf", "tEXt", "iTXt", "zTXt"].includes(tipo)) partes.push(b.subarray(i, fim));
    i = fim;
    if (tipo === "IEND") return { ok: true, bytes: juntar(partes) };
  }
  return recusar("O conteúdo não é uma foto PNG de verdade.");
}

/** WEBP: tira EXIF e XMP e acerta o cabeçalho. */
function limparWebp(b: Uint8Array): ResultadoVerificacao {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const fimRiff = Math.min(b.length, 8 + v.getUint32(4, true));
  const partes: Uint8Array[] = [];
  let temImagem = false;
  let i = 12;
  while (i + 8 <= fimRiff) {
    const tipo = ascii(b, i, 4);
    const tamanho = v.getUint32(i + 4, true);
    const fim = i + 8 + tamanho + (tamanho % 2);
    if (i + 8 + tamanho > fimRiff) return recusar("O arquivo está corrompido ou num formato que não dá para conferir.");
    if (tipo === "VP8 " || tipo === "VP8L" || tipo === "ANIM") temImagem = true;
    if (tipo !== "EXIF" && tipo !== "XMP ") {
      const pedaco = b.slice(i, Math.min(fim, fimRiff));
      if (tipo === "VP8X" && pedaco.length > 8) pedaco[8] = pedaco[8]! & ~0x0c;
      partes.push(pedaco);
    }
    i = fim;
  }
  if (!temImagem) return recusar("O conteúdo não é uma foto WEBP de verdade.");
  const corpo = juntar(partes);
  const cabecalho = new Uint8Array(12);
  cabecalho.set(b.subarray(0, 12));
  new DataView(cabecalho.buffer).setUint32(4, corpo.length + 4, true);
  return { ok: true, bytes: juntar([cabecalho, corpo]) };
}

/** PDF: precisa ser PDF de verdade e sem conteúdo ativo (script, ação de abrir programa, arquivo embutido). */
function conferirPdf(b: Uint8Array): ResultadoVerificacao {
  if (ascii(b, 0, 5) !== "%PDF-") return recusar("O conteúdo não é um PDF de verdade.");
  const texto = new TextDecoder("latin1").decode(b);
  if (!texto.slice(-2048).includes("%%EOF")) return recusar("O PDF está incompleto ou corrompido.");
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)[\s/<>[(]/.test(texto)) {
    return recusar("O PDF tem conteúdo ativo (script ou arquivo embutido) e não foi liberado.");
  }
  return { ok: true, bytes: b };
}
