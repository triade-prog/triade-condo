import { assertEquals } from "@std/assert";
import { crc32, montarZip, nomeNoZip, planilhaCsv } from "./zip.ts";

Deno.test("CT-04: o CRC confere com o valor conhecido", () => {
  assertEquals(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

Deno.test("CT-04: o ZIP tem os arquivos com nome em UTF-8 e abre de volta", async () => {
  const zip = await montarZip([
    { nome: "LEIA-ME.txt", bytes: new TextEncoder().encode("Olá, condomínio"), comprimir: true },
    { nome: "documentos/Convenção/v1-convenção.pdf", bytes: new Uint8Array([1, 2, 3]) },
    { nome: "documentos/Convenção/v1-convenção.pdf", bytes: new Uint8Array([4]) },
  ]);
  const v = new DataView(zip.buffer);
  assertEquals(v.getUint32(0, true), 0x04034b50);
  const fim = zip.length - 22;
  assertEquals(v.getUint32(fim, true), 0x06054b50);
  assertEquals(v.getUint16(fim + 10, true), 3);
  const texto = new TextDecoder().decode(zip);
  assertEquals(texto.includes("documentos/Convenção/v1-convenção (2).pdf"), true);
  // O texto comprimido volta igual.
  const nome = v.getUint16(26, true);
  const tam = v.getUint32(18, true);
  const dados = zip.subarray(30 + nome, 30 + nome + tam);
  const volta = new Uint8Array(await new Response(new Blob([dados as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  assertEquals(new TextDecoder().decode(volta), "Olá, condomínio");
});

Deno.test("CT-04: nome dentro do ZIP não sai da pasta", () => {
  assertEquals(nomeNoZip("../../etc/senha"), "etc/senha");
  assertEquals(nomeNoZip("/pedidos/2026-0034/foto: sala?.jpg"), "pedidos/2026-0034/foto- sala-.jpg");
});

Deno.test("CT-04: a planilha usa ponto e vírgula e protege aspas", () => {
  assertEquals(planilhaCsv([{ a: 1, b: 'diz "oi"' }, { a: null, c: { x: 1 } }]),
    '﻿a;b;c\r\n1;"diz ""oi""";\r\n;;"{""x"":1}"\r\n');
});
