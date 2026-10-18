// Verificação dos arquivos antes de liberar (PT-07): o tipo pelo conteúdo, a localização tirada
// das fotos sem perder a orientação, o PDF sem conteúdo ativo e o armazenamento privado.
import { assert, assertEquals, assertFalse } from "@std/assert";
import { armazenamentoSupabase, verificarArquivo } from "./arquivos.ts";

const bytes = (...partes: (number[] | string | Uint8Array)[]) => {
  const lista = partes.map((p) => typeof p === "string" ? new TextEncoder().encode(p) : p instanceof Uint8Array ? p : new Uint8Array(p));
  const saida = new Uint8Array(lista.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of lista) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
};
const contem = (b: Uint8Array, texto: string) => new TextDecoder("latin1").decode(b).includes(texto);
const segmento = (marcador: number, corpo: Uint8Array) => bytes([0xff, marcador, (corpo.length + 2) >> 8, (corpo.length + 2) & 0xff], corpo);

/** EXIF (II) com orientação 6 e latitude no GPS: 0x47 0x50 0x53 ("GPS") repetido nos 24 bytes da latitude. */
function exifComGps(): Uint8Array {
  const t = new Uint8Array(8 + 2 + 2 * 12 + 4 + 2 + 12 + 4 + 24);
  const v = new DataView(t.buffer);
  t.set([0x49, 0x49, 0x2a, 0x00]);
  v.setUint32(4, 8, true);
  v.setUint16(8, 2, true);
  v.setUint16(10, 0x0112, true); v.setUint16(12, 3, true); v.setUint32(14, 1, true); v.setUint16(18, 6, true);
  const gps = 8 + 2 + 24 + 4;
  v.setUint16(22, 0x8825, true); v.setUint16(24, 4, true); v.setUint32(26, 1, true); v.setUint32(30, gps, true);
  const lat = gps + 2 + 12 + 4;
  v.setUint16(gps, 1, true);
  v.setUint16(gps + 2, 0x0002, true); v.setUint16(gps + 4, 5, true); v.setUint32(gps + 6, 3, true); v.setUint32(gps + 10, lat, true);
  t.fill(0x47, lat, lat + 24);
  return bytes("Exif\0\0", t);
}

function jpegComLocalizacao(): Uint8Array {
  return bytes(
    [0xff, 0xd8],
    segmento(0xe0, bytes("JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0])),
    segmento(0xe1, exifComGps()),
    segmento(0xe1, bytes("http://ns.adobe.com/xap/1.0/\0", "<x:xmpmeta><exif:GPSLatitude>15,47S</exif:GPSLatitude></x:xmpmeta>")),
    segmento(0xda, bytes([0, 1, 2, 3])),
    [0x10, 0x20, 0x30, 0xff, 0xd9],
  );
}

Deno.test("PT-07: JPG perde a localização e mantém a orientação", () => {
  const r = verificarArquivo(jpegComLocalizacao(), "image/jpeg");
  assert(r.ok);
  assertFalse(contem(r.bytes, "GPSLatitude"), "o XMP com localização sai");
  assertFalse(contem(r.bytes, "GGGG"), "os bytes da latitude do EXIF são zerados");
  assert(contem(r.bytes, "Exif"), "o EXIF fica");
  const i = new TextDecoder("latin1").decode(r.bytes).indexOf("Exif") + 6;
  const v = new DataView(r.bytes.buffer, r.bytes.byteOffset);
  assertEquals(v.getUint16(i + 10, true), 0x0112);
  assertEquals(v.getUint16(i + 18, true), 6, "a orientação continua 6");
  assertEquals([...r.bytes.slice(-5)], [0x10, 0x20, 0x30, 0xff, 0xd9], "a imagem fica igual");
});

Deno.test("PT-07: o tipo é conferido pelo conteúdo, não pelo nome", () => {
  const html = bytes("<html><script>alert(1)</script></html>");
  for (const tipo of ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const) {
    const r = verificarArquivo(html, tipo);
    assertFalse(r.ok);
    assert(r.motivo.includes("não é"), r.motivo);
  }
  assertEquals(verificarArquivo(new Uint8Array(0), "image/jpeg"), { ok: false, motivo: "O arquivo chegou vazio." });
  assertFalse(verificarArquivo(new Uint8Array(10 * 1024 * 1024 + 1), "image/jpeg").ok);
  assertFalse(verificarArquivo(bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 1, 2]), "image/jpeg").ok, "JPG cortado no meio");
});

Deno.test("PT-07: PNG perde EXIF e textos", () => {
  const pedaco = (tipo: string, corpo: string) => {
    const c = new TextEncoder().encode(corpo);
    const b = new Uint8Array(12 + c.length);
    new DataView(b.buffer).setUint32(0, c.length);
    b.set(new TextEncoder().encode(tipo), 4);
    b.set(c, 8);
    return b;
  };
  const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pedaco("IHDR", "0123456789abc"), pedaco("tEXt", "Local\0Rua X"),
    pedaco("eXIf", "GPS"), pedaco("IDAT", "imagem"), pedaco("IEND", ""));
  const r = verificarArquivo(png, "image/png");
  assert(r.ok);
  assertFalse(contem(r.bytes, "Rua X"));
  assertFalse(contem(r.bytes, "eXIf"));
  assert(contem(r.bytes, "IDATimagem"));
});

Deno.test("PT-07: WEBP perde EXIF e XMP e o cabeçalho fica certo", () => {
  const pedaco = (tipo: string, corpo: Uint8Array) => {
    const b = new Uint8Array(8 + corpo.length + (corpo.length % 2));
    b.set(new TextEncoder().encode(tipo));
    new DataView(b.buffer).setUint32(4, corpo.length, true);
    b.set(corpo, 8);
    return b;
  };
  const corpo = bytes("WEBP", pedaco("VP8X", new Uint8Array([0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0])), pedaco("VP8 ", bytes("imagem")),
    pedaco("EXIF", bytes("GPS-AQUI")), pedaco("XMP ", bytes("<gps/>")));
  const webp = bytes("RIFF", new Uint8Array(new Uint32Array([corpo.length]).buffer), corpo);
  const r = verificarArquivo(webp, "image/webp");
  assert(r.ok);
  assertFalse(contem(r.bytes, "GPS-AQUI"));
  assertFalse(contem(r.bytes, "<gps/>"));
  assertEquals(new DataView(r.bytes.buffer, r.bytes.byteOffset).getUint32(4, true), r.bytes.length - 8);
  assertEquals(r.bytes[20]! & 0x0c, 0, "a marca de EXIF e XMP sai do VP8X");
});

Deno.test("PT-07: PDF com conteúdo ativo não é liberado", () => {
  const limpo = bytes("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer\n%%EOF\n");
  assert(verificarArquivo(limpo, "application/pdf").ok);
  const comScript = bytes("%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF");
  assertEquals(verificarArquivo(comScript, "application/pdf"), {
    ok: false,
    motivo: "O PDF tem conteúdo ativo (script ou arquivo embutido) e não foi liberado.",
  });
  assertFalse(verificarArquivo(bytes("%PDF-1.7\n1 0 obj << /Launch /F (cmd.exe) >> endobj\n%%EOF"), "application/pdf").ok);
  assertFalse(verificarArquivo(bytes("%PDF-1.7\n1 0 obj << >> endobj\n"), "application/pdf").ok, "PDF sem fim");
});

Deno.test("PT-07: armazenamento privado só com a chave de serviço e links assinados", async () => {
  const pedidos: { url: string; init?: RequestInit }[] = [];
  const buscar = ((url: string, init?: RequestInit) => {
    pedidos.push({ url, init });
    if (url.includes("/upload/sign/")) return Promise.resolve(Response.json({ url: "/object/upload/sign/pedidos/x?token=a" }));
    if (url.includes("/object/sign/")) return Promise.resolve(Response.json({ signedURL: "/object/sign/pedidos/x?token=b" }));
    if (init?.method === undefined) return Promise.resolve(new Response(new Uint8Array([1, 2]), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;
  const a = armazenamentoSupabase("https://projeto.supabase.co", "chave-servico", buscar);
  const caminho = "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333";
  assertEquals(await a.linkEnvio(caminho), "https://projeto.supabase.co/storage/v1/object/upload/sign/pedidos/x?token=a");
  assertEquals(await a.linkLeitura(caminho, 300, "teto banheiro.jpg"),
    "https://projeto.supabase.co/storage/v1/object/sign/pedidos/x?token=b&download=teto%20banheiro.jpg");
  assertEquals(JSON.parse(String(pedidos[1]!.init!.body)), { expiresIn: 300 });
  assertEquals([...(await a.ler(caminho))!], [1, 2]);
  const doPrestador = "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/prestador/33333333-3333-4333-8333-333333333333";
  assertEquals(await a.linkEnvio(doPrestador), "https://projeto.supabase.co/storage/v1/object/upload/sign/pedidos/x?token=a", "V-11: a foto do prestador tem caminho próprio");
  await a.gravar(caminho, new Uint8Array([3]), "image/jpeg");
  assertEquals((pedidos.at(-1)!.init!.headers as Record<string, string>)["x-upsert"], "true");
  assert(pedidos.every((p) => (p.init?.headers as Record<string, string>).authorization === "Bearer chave-servico"));
  let recusou = false;
  try {
    await a.ler("../outro-condominio/arquivo");
  } catch {
    recusou = true;
  }
  assert(recusou, "caminho fora do formato não chega ao armazenamento");
});
