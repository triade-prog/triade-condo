// Contrato pelo gov.br (0308): o PDF montado no servidor, sempre igual para o mesmo retrato e com a
// impressão digital em cada folha; a conferência automática do PDF assinado com PDFs de teste
// (assinado por atualização incremental como o assinador faz, sem assinatura, regravado e as burlas
// da revisão do 3f3902a); e as rotas da equipe e do link do síndico, que levam a pessoa da sessão,
// validam a entrada (só PDF, até 10 MB) e apagam o que vem sem assinatura.
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { PDFArray, PDFDict, PDFDocument, type PDFPage, PDFName, PDFRef } from "pdf-lib";
import { criarApiConsole } from "./app.ts";
import { conferirAssinatura, gerarPdfContrato, type RetratoContrato, sha256Bytes } from "./contrato.ts";
import {
  PDF_BURLA_REAL,
  PDF_FINAL_REAL,
  PDF_XREF_FLUXO_REAL,
  TAMANHO_BASE_REAL,
  TAMANHO_BASE_XREF_FLUXO_REAL,
  TAMANHO_CONDOMINIO_REAL,
} from "./contrato_pdfs_teste.ts";
import {
  adminFalso,
  armazenamentoFalso,
  authFalso,
  bancoFalso,
  CODIGO_CERTO,
  cookieDe,
  erro,
  erroBanco,
  limitesFalsos,
  pedido,
} from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const AROEIRA = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const CONTRATO = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const ENVIO = "9c0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f";
const DOCUMENTO = "1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b";
const IMPLANTACAO = "2f3a4b5c-6d7e-4f8a-9b0c-1d2e3f4a5b6c";
const CAMINHO_CONTRATO = `${AROEIRA}/${CONTRATO}/3a4b5c6d-7e8f-4a9b-8c0d-1e2f3a4b5c6d`;
const CAMINHO_ENVIO = `${AROEIRA}/${ENVIO}/5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f`;
const CAMINHO_DOCUMENTO = `${AROEIRA}/${DOCUMENTO}/6d7e8f9a-0b1c-4d2e-9f3a-4b5c6d7e8f9a`;
const CODIGO = "Qm9hLXByb3Bvc3RhLWRvLUNlcnJhZG8tY29tLTMyLWJ5dGVz";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const HASH = "ab".repeat(32);

const RETRATO: RetratoContrato = {
  numero: 2,
  titulo: "Contrato de prestação de serviços · TRÍADE Condo",
  texto: Array.from({ length: 40 }, (_, i) =>
    `Cláusula ${i + 1}ª. O Edifício Aroeira, CNPJ 11.222.333/0001-81, representado por Lúcia Prado, contrata a TRÍADE «para» o serviço descrito ` +
    "na proposta aceita, com mensalidade de R$ 229,00 por mês, a partir de 01/11/2026, reajustada pelo IPCA → todo ano.").join("\n\n"),
  termo: "A TRÍADE trata os dados dos moradores do Edifício Aroeira só para prestar o serviço contratado, pelo tempo do contrato.",
  campos: { condominio: "Edifício Aroeira", cnpj: "11.222.333/0001-81" },
  modelo: { numero: 2, advogado: "Rui Barros", oab: "DF 12345", revisadoEm: "2026-10-20" },
  proposta: { numero: 1, hash: "cd".repeat(32), aceitaEm: "2026-10-24T13:00:00+00:00" },
  geradoEm: "2026-10-24T10:00:00-03:00",
  dataInicio: "2026-11-01",
};

const texto = new TextEncoder();
const juntar = (...partes: Uint8Array[]) => {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
};
interface OpcoesAssinar {
  /** O retângulo do desenho da assinatura na página 1. */
  rect?: number[];
  /** O subtipo da anotação acrescentada (Widget no assinador). */
  subtipo?: string;
  /** Objetos a mais na mesma atualização (as burlas). */
  extras?: (novo: () => number, d: { doc: PDFDocument; pagina: PDFPage }) => { n: number; corpo: string }[];
  /** Mexe na página redefinida além das /Annots. */
  mudarPagina?: (pagina: PDFDict, novo: () => number) => void;
  /** Entradas "f" (apagar) no índice. */
  livres?: number[];
  /** Define o widget de novo, fora do índice (o índice aponta para o primeiro). */
  repetirWidget?: string;
  /** O que vem depois da assinatura (uma atualização a mais). */
  depois?: string;
}

/**
 * Assina como o assinador do gov.br: uma atualização incremental com a página 1 ganhando o widget nas
 * /Annots, o catálogo com o AcroForm, o campo-widget de assinatura com o desenho, e o /Sig com o
 * /ByteRange cobrindo o arquivo inteiro e o /Contents (PKCS#7 de mentira) no buraco.
 */
async function assinarIncremental(base: Uint8Array, op: OpcoesAssinar = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(base, { updateMetadata: false });
  const ctx = doc.context;
  let proximo = ctx.largestObjectNumber + 1;
  const novo = () => proximo++;
  const raiz = ctx.trailerInfo.Root as PDFRef;
  const pagina = doc.getPages()[0]!;
  const sigN = novo(), widgetN = novo(), desenhoN = novo();
  const formAntes = doc.catalog.get(PDFName.of("AcroForm"));
  const formN = formAntes instanceof PDFRef ? formAntes.objectNumber : novo();
  const camposAntes = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict)?.lookupMaybe(PDFName.of("Fields"), PDFArray)?.asArray() ?? [];
  const anotacoesAntes = pagina.node.lookupMaybe(PDFName.of("Annots"), PDFArray)?.asArray() ?? [];
  const extras = op.extras?.(novo, { doc, pagina }) ?? [];
  const pg = pagina.node.clone(ctx);
  pg.set(PDFName.of("Annots"), ctx.obj([...anotacoesAntes, PDFRef.of(widgetN)]));
  op.mudarPagina?.(pg, novo);
  const cat = doc.catalog.clone(ctx);
  cat.set(PDFName.of("AcroForm"), PDFRef.of(formN));
  const desenho = "q 0.2 g BT /F1 8 Tf 4 30 Td (Documento assinado digitalmente) Tj ET Q";
  const contents = "3082" + "a5".repeat(1500);
  const partes = [
    ...extras,
    { n: pagina.ref.objectNumber, corpo: pg.toString() },
    { n: raiz.objectNumber, corpo: cat.toString() },
    { n: formN, corpo: `<< /Fields [${[...camposAntes.map(String), `${widgetN} 0 R`].join(" ")}] /SigFlags 3 >>` },
    { n: widgetN, corpo: `<< /Type /Annot /Subtype /${op.subtipo ?? "Widget"} /FT /Sig /T (Assinatura ${widgetN}) /V ${sigN} 0 R /F 132 ` +
        `/P ${pagina.ref} /Rect [${(op.rect ?? [400, 40, 560, 90]).join(" ")}] /AP << /N ${desenhoN} 0 R >> >>` },
    { n: desenhoN, corpo: `<< /Type /XObject /Subtype /Form /BBox [0 0 160 50] /Length ${desenho.length} >>\nstream\n${desenho}\nendstream` },
    { n: sigN, corpo: `<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [0 AAAAAAAAAA BBBBBBBBBB CCCCCCCCCC] ` +
        `/Contents <${contents}> /M (D:20261025100000-03'00') /Name (Lucia Prado) >>` },
  ];
  let s = "\n";
  const posicoes: [number, number][] = [];
  for (const p of partes) {
    posicoes.push([p.n, base.length + s.length]);
    s += `${p.n} 0 obj\n${p.corpo}\nendobj\n`;
  }
  if (op.repetirWidget) s += `${widgetN} 0 obj\n${op.repetirWidget}\nendobj\n`;
  const indice = base.length + s.length;
  const marcas = [...new TextDecoder("latin1").decode(base).matchAll(/startxref\s+(\d+)/g)];
  const anterior = marcas[marcas.length - 1]![1];
  s += "xref\n0 1\n0000000000 65535 f \n" + posicoes.map(([n, o]) => `${n} 1\n${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    (op.livres ?? []).map((n) => `${n} 1\n0000000000 00001 f \n`).join("");
  const info = ctx.trailerInfo.Info;
  s += `trailer\n<< /Size ${proximo} /Root ${raiz} ${info ? `/Info ${info} ` : ""}/Prev ${anterior} >>\nstartxref\n${indice}\n%%EOF\n`;
  const a = base.length + s.indexOf(`<${contents}>`);
  const b = a + contents.length + 2;
  const c = base.length + s.length - b;
  const pad = (x: number) => String(x).padStart(10, "0");
  s = s.replace("AAAAAAAAAA", pad(a)).replace("BBBBBBBBBB", pad(b)).replace("CCCCCCCCCC", pad(c));
  return juntar(base, texto.encode(s), texto.encode(op.depois ?? ""));
}

/** A referência do primeiro fluxo de conteúdo da página. */
function conteudoDaPagina(pagina: PDFPage): PDFRef {
  const bruto = pagina.node.get(PDFName.of("Contents"));
  return (bruto instanceof PDFRef ? bruto : (bruto as PDFArray).get(0)) as PDFRef;
}

const BASE = await gerarPdfContrato(RETRATO, HASH);
const BASE_SHA = await sha256Bytes(BASE);

/** Os textos escritos nas folhas (os fluxos de conteúdo vêm comprimidos). */
async function textosDasFolhas(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const folhas: string[] = [];
  for (const pagina of doc.getPages()) {
    const ref = pagina.node.Contents()!;
    const fluxos = "asArray" in ref ? (ref as unknown as { asArray(): unknown[] }).asArray() : [ref];
    let tudo = "";
    for (const f of fluxos) {
      const fluxo = doc.context.lookup(f as never) as unknown as { getContents(): Uint8Array };
      const bruto = new Blob([fluxo.getContents() as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate"));
      tudo += new TextDecoder("latin1").decode(new Uint8Array(await new Response(bruto).arrayBuffer()));
    }
    folhas.push([...tudo.matchAll(/<([0-9A-Fa-f]*)> Tj/g)]
      .map((m) => m[1]!.match(/../g)?.map((h) => String.fromCharCode(parseInt(h, 16))).join("") ?? "").join("\n"));
  }
  return folhas;
}

Deno.test("0308: o PDF do contrato sai sempre igual, com a impressão digital em cada folha", async () => {
  const pdf = await gerarPdfContrato(RETRATO, HASH);
  assertEquals(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
  assertEquals(await sha256Bytes(await gerarPdfContrato(RETRATO, HASH)), await sha256Bytes(pdf), "o mesmo retrato dá o mesmo arquivo");
  assertNotEquals(await sha256Bytes(await gerarPdfContrato({ ...RETRATO, numero: 3 }, HASH)), await sha256Bytes(pdf));
  const doc = await PDFDocument.load(pdf);
  assertEquals(doc.getCreationDate()?.toISOString(), "2026-10-24T13:00:00.000Z", "a data do arquivo é a do retrato");
  const folhas = await textosDasFolhas(pdf);
  assert(folhas.length >= 3, "contrato em mais de uma folha e o termo na sua");
  folhas.forEach((f, i) => assert(f.includes(`Impressão digital (sha256): ${HASH} · Página ${i + 1} de ${folhas.length}`), `folha ${i + 1}`));
  assert(folhas[0]!.includes("Modelo v2, revisado por Rui Barros (OAB DF 12345) em 20/10/2026"));
  assert(folhas[0]!.includes("proposta v1 aceita em 24/10/2026"));
  assert(folhas.some((f) => f.includes("Termo de tratamento de dados")));
  assert(folhas.join("\n").includes("IPCA -> todo ano"), "o que a fonte não escreve é trocado, sem falhar");
  // Passa na conferência de PDF de sempre (sem conteúdo ativo).
  assertEquals((await conferirAssinatura(pdf, pdf)).valido, true);
});

Deno.test("0308: a conferência automática com os PDFs de teste", async () => {
  // 1. Assinado pelo condomínio por atualização incremental: uma assinatura nova, só ela, o começo é a base.
  const condominio = await assinarIncremental(BASE);
  const c1 = await conferirAssinatura(condominio, BASE);
  assertEquals([c1.valido, c1.assinaturas, c1.assinaturaNova, c1.soAssinatura, c1.prefixoSha256, c1.tamanho],
    [true, 1, true, true, BASE_SHA, condominio.length], c1.detalhe);
  assertEquals(c1.sha256, await sha256Bytes(condominio));
  // A TRÍADE assina sobre o arquivo do condomínio: duas assinaturas, o começo é o do condomínio.
  const final = await assinarIncremental(condominio);
  const c2 = await conferirAssinatura(final, condominio);
  assertEquals([c2.assinaturas, c2.assinaturaNova, c2.soAssinatura, c2.prefixoSha256], [2, true, true, c1.sha256], c2.detalhe);
  // O arquivo do condomínio não serve de assinatura da TRÍADE (nada novo sobre a base dela).
  assertEquals((await conferirAssinatura(condominio, condominio)).assinaturaNova, false);

  // 2. Sem assinatura: nada novo (o banco recusa na hora).
  const sem = await conferirAssinatura(BASE, BASE);
  assertEquals([sem.assinaturas, sem.assinaturaNova, sem.soAssinatura], [0, false, false]);

  // 3. Regravado pelo assinador (load e save) e assinado: tem assinatura nova, mas o começo não é a base.
  const regravado = await assinarIncremental(await (await PDFDocument.load(BASE)).save({ useObjectStreams: true }));
  const c3 = await conferirAssinatura(regravado, BASE);
  assertEquals([c3.assinaturas, c3.assinaturaNova, c3.soAssinatura, c3.detalhe], [1, true, false, "o começo do arquivo não é a base"]);
  assertNotEquals(c3.prefixoSha256, BASE_SHA);

  // Arquivo que não é PDF, PDF com script e arquivo que não chegou: inválidos.
  assertEquals((await conferirAssinatura(texto.encode("não é PDF"), BASE)).valido, false);
  assertEquals((await conferirAssinatura(juntar(BASE, texto.encode("\n<< /JavaScript (x) >>\n%%EOF\n")), BASE)).valido, false);
  assertEquals((await conferirAssinatura(null, BASE)).motivo, "O arquivo não chegou. Envie de novo.");
});

Deno.test("0308: as duas burlas da revisão não passam (assinatura num comentário e conteúdo trocado)", async () => {
  // 1. Sem assinatura nenhuma: só um comentário com as palavras. Não é assinatura (o banco recusa na hora).
  const comentario = juntar(BASE, texto.encode("\n% /Type /Sig /ByteRange [ 0 0 0 0 ]\n%%EOF\n"));
  const r1 = await conferirAssinatura(comentario, BASE);
  assertEquals([r1.valido, r1.assinaturas, r1.assinaturaNova, r1.soAssinatura], [true, 0, false, false]);
  // Nem um /Sig de verdade que não cobre nada além da base.
  const curto = juntar(BASE, texto.encode("\n9000 0 obj\n<< /Type /Sig /ByteRange [0 10 20 30] /Contents <3082> >>\nendobj\n%%EOF\n"));
  assertEquals((await conferirAssinatura(curto, BASE)).assinaturaNova, false);

  // 2. Atualização incremental que troca o conteúdo da página 1 (objeto novo com o mesmo número) e
  // depois assina certinho: a assinatura é nova, mas não é só a assinatura (o banco guarda sem contar).
  const trocaConteudo = await assinarIncremental(BASE, {
    extras: (_novo, { pagina }) => {
      const fluxo = "BT /F1 12 Tf 56 700 Td (Mensalidade: R$ 1,00 por mes) Tj ET";
      return [{ n: conteudoDaPagina(pagina).objectNumber, corpo: `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream` }];
    },
  });
  const r2 = await conferirAssinatura(trocaConteudo, BASE);
  assertEquals([r2.valido, r2.assinaturaNova, r2.soAssinatura, r2.detalhe], [true, true, false, "o PDF muda um objeto do contrato"]);
  // A mesma burla como a revisão montou (sem índice): também não passa.
  const daRevisao = juntar(BASE, texto.encode("\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 56 700 Td (R$ 1,00 por mes) Tj ET\nendstream\n" +
    "endobj\n<< /Type /Sig /ByteRange [0 1 2 3] /Contents <00> >>\n%%EOF\n"));
  const r3 = await conferirAssinatura(daRevisao, BASE);
  assertEquals([r3.assinaturaNova, r3.soAssinatura], [false, false]);
});

Deno.test("0308: a conferência com PDFs de um assinador de verdade (pyHanko, PAdES)", async () => {
  const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const final = bytes(PDF_FINAL_REAL);
  const base = final.subarray(0, TAMANHO_BASE_REAL);
  const condominio = final.subarray(0, TAMANHO_CONDOMINIO_REAL);
  const c1 = await conferirAssinatura(condominio, base);
  assertEquals([c1.valido, c1.assinaturas, c1.assinaturaNova, c1.soAssinatura], [true, 1, true, true], c1.detalhe);
  const c2 = await conferirAssinatura(final, condominio);
  assertEquals([c2.valido, c2.assinaturas, c2.assinaturaNova, c2.soAssinatura], [true, 2, true, true], c2.detalhe);
  assertEquals(c2.prefixoSha256, await sha256Bytes(condominio));
  // A burla assinada de verdade: a assinatura é válida, mas a página 1 não é a do contrato.
  const burla = await conferirAssinatura(bytes(PDF_BURLA_REAL), base);
  assertEquals([burla.assinaturaNova, burla.soAssinatura, burla.detalhe], [true, false, "a página 1 mudou"]);
  assertEquals(burla.prefixoSha256, await sha256Bytes(base), "o começo é a base: só a leitura da parte acrescentada pega");
  // Base com índice em fluxo (/Type /XRef): o assinador grava o índice acrescentado também em fluxo.
  const xs = bytes(PDF_XREF_FLUXO_REAL);
  const c3 = await conferirAssinatura(xs, xs.subarray(0, TAMANHO_BASE_XREF_FLUXO_REAL));
  assertEquals([c3.assinaturas, c3.assinaturaNova, c3.soAssinatura], [1, true, true], c3.detalhe);
});

Deno.test("0308: a parte acrescentada só pode trazer a assinatura", async () => {
  const motivo = async (op: OpcoesAssinar) => {
    const r = await conferirAssinatura(await assinarIncremental(BASE, op), BASE);
    assertEquals(r.assinaturaNova, true);
    assertEquals(r.soAssinatura, false);
    return r.detalhe;
  };
  // A página aponta para outro conteúdo.
  let outro = 0;
  assertEquals(await motivo({
    extras: (novo) => {
      outro = novo();
      return [{ n: outro, corpo: "<< /Length 2 >>\nstream\nq \nendstream" }];
    },
    mudarPagina: (pg) => pg.set(PDFName.of("Contents"), PDFRef.of(outro)),
  }), "a página 1 mudou");
  // A página ganha uma anotação que desenha por cima (FreeText) em vez do widget de assinatura.
  assertEquals(await motivo({ subtipo: "FreeText" }), "a página 1 ganhou uma anotação que não é a assinatura");
  // O desenho da assinatura cobre a página.
  assertEquals(await motivo({ rect: [0, 0, 595, 842] }), "o desenho da assinatura cobre a página");
  // O índice apaga um objeto do contrato.
  assertEquals(await motivo({ livres: [3] }), "o índice acrescentado apaga um objeto");
  // O widget definido duas vezes: o leitor segue o índice (o primeiro, FreeText), o pdf-lib leria o segundo.
  assertEquals(await motivo({
    subtipo: "FreeText",
    repetirWidget: "<< /Type /Annot /Subtype /Widget /FT /Sig /Rect [400 40 560 90] >>",
  }), "objeto acrescentado fora do índice");
  // Algo depois da assinatura: ela não cobre o arquivo inteiro.
  const depois = await conferirAssinatura(await assinarIncremental(BASE, { depois: "1 0 obj\n<< >>\nendobj\n%%EOF\n" }), BASE);
  assertEquals([depois.assinaturaNova, depois.soAssinatura], [true, false]);
});

/** A base que o banco aponta para a conferência: o PDF gerado, com o resumo e o tamanho. */
const baseDoEnvio = { baseCaminho: CAMINHO_CONTRATO, baseSha256: BASE_SHA, baseTamanho: BASE.length };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const arm = armazenamentoFalso();
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, proposta: 50, aceite: 2, contrato: 4 }),
    comercial_contrato: () => ({ contrato: null, faltam: ["CNPJ", "ATA_ELEICAO"], podeGerar: false, motivoSemGerar: "FALTA_DOCUMENTO" }),
    comercial_gerar_contrato: () => ({ contratoId: CONTRATO, numero: 2, hash: HASH, caminho: CAMINHO_CONTRATO, dados: RETRATO }),
    comercial_contrato_pronto: (a) => ({ id: a.p_contrato, situacao: "AGUARDA_CONDOMINIO", pdfSha256: a.p_sha256, pdfTamanho: a.p_tamanho }),
    comercial_iniciar_documento: () => ({ documentoId: DOCUMENTO, caminho: CAMINHO_DOCUMENTO, tipo: "application/pdf" }),
    comercial_documento_a_verificar: () => ({ caminho: CAMINHO_DOCUMENTO, tipo: "application/pdf" }),
    comercial_verificar_documento: (a) => ({ id: DOCUMENTO, situacao: a.p_liberado ? "RECEBIDO" : "RECUSADO" }),
    comercial_abrir_documento: () => ({ caminho: CAMINHO_DOCUMENTO, nome: "cnpj.pdf", tipo: "application/pdf" }),
    comercial_abrir_contrato: (a) => (a.p_envio ? { caminho: CAMINHO_ENVIO, nome: "assinado.pdf", tipo: "application/pdf" }
                                               : { caminho: CAMINHO_CONTRATO, nome: "contrato-2.pdf", tipo: "application/pdf" }),
    comercial_iniciar_envio: (a) => ((a.p_dados as { parte: string }).parte === "TRIADE"
      ? { envioId: ENVIO, caminho: CAMINHO_ENVIO, tipo: "application/pdf" }
      : erroBanco("TC422", { motivo: "ORDEM_DAS_ASSINATURAS" })),
    comercial_envio_a_verificar: () => ({ caminho: CAMINHO_ENVIO, tipo: "application/pdf", ...baseDoEnvio }),
    comercial_verificar_envio: (a) => ({ situacao: "A_CONFERIR", apagarArquivo: false, resultado: a.p_resultado }),
    comercial_conferir_envio: () => ({ id: ENVIO, situacao: "CONFERIDO" }),
    comercial_recusar_envio: () => ({ id: ENVIO, situacao: "RECUSADO" }),
    comercial_virar_cliente: () => ({ condominioId: AROEIRA, etapa: "GANHO" }),
    comercial_iniciar_piloto: () => ({ id: CONTRATO, situacao: "EM_ANDAMENTO" }),
    comercial_encerrar_piloto: () => ({ id: CONTRATO, situacao: "PERDIDO" }),
    comercial_salvar_troca: () => ({ id: CONTRATO, versao: 1 }),
    comercial_modelos_contrato: () => ({ versoes: [], podeEditar: true }),
    comercial_salvar_modelo_contrato: (a) => ({ id: a.p_id ?? CONTRATO, versao: 1 }),
    console_contrato_cliente: () => ({ contrato: { numero: 2 }, arquivo: { caminho: CAMINHO_ENVIO, nome: "contrato-2-assinado.pdf", tipo: "application/pdf" } }),
    publico_contrato: (a) => (a.p_codigo === CODIGO ? { condominio: "Edifício Aroeira", faltam: [] } : erroBanco("TC404")),
    publico_iniciar_documento: () => ({ documentoId: DOCUMENTO, caminho: CAMINHO_DOCUMENTO, tipo: "application/pdf" }),
    publico_documento_a_verificar: () => ({ caminho: CAMINHO_DOCUMENTO, tipo: "application/pdf" }),
    publico_verificar_documento: (a) => ({ id: DOCUMENTO, situacao: a.p_liberado ? "RECEBIDO" : "RECUSADO" }),
    publico_abrir_contrato: (a) => (a.p_final ? erroBanco("TC422", { motivo: "SEM_PDF_FINAL" })
                                             : { caminho: CAMINHO_CONTRATO, nome: "contrato-2.pdf", tipo: "application/pdf" }),
    publico_iniciar_envio: () => ({ envioId: ENVIO, caminho: CAMINHO_ENVIO, tipo: "application/pdf" }),
    publico_envio_a_verificar: () => ({ caminho: CAMINHO_ENVIO, tipo: "application/pdf", ...baseDoEnvio }),
    publico_verificar_envio: (a) => {
      const r = a.p_resultado as { valido: boolean; assinaturaNova?: boolean };
      const naHora = !r.valido || !r.assinaturaNova;
      return { situacao: naHora ? "RECUSADO_NA_HORA" : "A_CONFERIR", apagarArquivo: naHora };
    },
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    armazenamentoContrato: arm.armazenamento,
  });
  arm.objetos.set(CAMINHO_CONTRATO, BASE);
  return { pedir: pedido(app, "api-console"), arm, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("0308: as rotas do contrato pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of [`/v1/comercial/interessados/${AROEIRA}/contrato`, "/v1/comercial/modelos/contrato", `/v1/clientes/${AROEIRA}/contrato`,
                      "/v1/comercial/troca/planilha-modelo"]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  for (const rota of [`/v1/comercial/interessados/${AROEIRA}/contrato`, `/v1/comercial/envios/${ENVIO}/conferir`,
                      `/v1/comercial/interessados/${AROEIRA}/virar-cliente`]) {
    assertEquals((await erro(await m.pedir(rota, { corpo: {} }))).codigo, "UNAUTHORIZED", rota);
  }
});

Deno.test("0308: gerar contrato monta o PDF, guarda e manda o sha256 ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/contrato`, { cookie, corpo: { dataInicio: "1/11/2026" } }))).detalhes?.campos,
    ["dataInicio"]);
  const r = await m.pedir(`/v1/comercial/interessados/${AROEIRA}/contrato`, { cookie, corpo: { dataInicio: "2026-11-01", motivo: "Data mudou" } });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "comercial_gerar_contrato"), { p_pessoa: CAROLINA, p_interessado: AROEIRA, p_data_inicio: "2026-11-01", p_motivo: "Data mudou" });
  const guardado = m.arm.objetos.get(CAMINHO_CONTRATO)!;
  assertEquals(guardado, await gerarPdfContrato(RETRATO, HASH), "o PDF guardado é o do retrato");
  assertEquals(chamada(m, "comercial_contrato_pronto"), { p_pessoa: CAROLINA, p_contrato: CONTRATO, p_sha256: await sha256Bytes(guardado), p_tamanho: guardado.length });
  assertEquals((await r.json()).situacao, "AGUARDA_CONDOMINIO");
  // Baixar para conferir: link de 5 minutos, com o nome do arquivo.
  const l = await (await m.pedir(`/v1/comercial/contratos/${CONTRATO}/link?envio=${ENVIO}&baixar=1`, { cookie })).json();
  assert(l.url.includes(CAMINHO_ENVIO));
  assertEquals(chamada(m, "comercial_abrir_contrato"), { p_pessoa: CAROLINA, p_contrato: CONTRATO, p_envio: ENVIO });
  assertEquals((await erro(await m.pedir(`/v1/comercial/contratos/${CONTRATO}/link?envio=x`, { cookie }))).detalhes?.campos, ["envio"]);
});

Deno.test("0308: documentos pela equipe: só PDF até 10 MB, CNPJ válido; o arquivo ruim é apagado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/comercial/interessados/${AROEIRA}/documentos`;
  for (const [ruim, campo] of [[{ tipo: "CNPJ", nome: "c.pdf", tamanho: 100, cnpj: "11.222.333/0001-82" }, "cnpj"],
                               [{ tipo: "ATA_ELEICAO", nome: "a.pdf", tamanho: 100 }, "mandatoAte"],
                               [{ tipo: "ATA_APROVACAO", nome: "a.pdf", tamanho: 10 * 1024 * 1024 + 1 }, "tamanho"],
                               [{ tipo: "ATA_APROVACAO", nome: "a.jpg", tamanho: 100, formato: "image/jpeg" }, "formato"]] as const) {
    assertEquals((await erro(await m.pedir(url, { cookie, corpo: ruim }))).detalhes?.campos, [campo], JSON.stringify(ruim));
  }
  const r = await (await m.pedir(url, { cookie, corpo: { tipo: "CNPJ", nome: "c.pdf", tamanho: 100, cnpj: "11.222.333/0001-81" } })).json();
  assertEquals(r.envio.metodo, "PUT");
  assertEquals(chamada(m, "comercial_iniciar_documento"), {
    p_pessoa: CAROLINA, p_interessado: AROEIRA, p_dados: { tipo: "CNPJ", nome: "c.pdf", tamanho: 100, cnpj: "11222333000181", mandatoAte: null },
  });
  m.arm.objetos.set(CAMINHO_DOCUMENTO, texto.encode("não é PDF"));
  const v = await (await m.pedir(`/v1/comercial/documentos/${DOCUMENTO}/verificar`, { cookie, corpo: {} })).json();
  assertEquals([v.situacao, v.motivoTexto], ["RECUSADO", "O conteúdo não é um PDF de verdade."]);
  assertEquals(m.arm.apagados, [CAMINHO_DOCUMENTO]);
  const pdf = await gerarPdfContrato(RETRATO, HASH);
  m.arm.objetos.set(CAMINHO_DOCUMENTO, pdf);
  await m.pedir(`/v1/comercial/documentos/${DOCUMENTO}/verificar`, { cookie, corpo: {} });
  assertEquals(chamada(m, "comercial_verificar_documento"), {
    p_pessoa: CAROLINA, p_id: DOCUMENTO, p_liberado: true, p_tamanho: pdf.length, p_sha256: await sha256Bytes(pdf), p_motivo: null,
  });
});

Deno.test("0308: a TRÍADE envia, a API confere e a equipe marca as três conferências", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const e = await m.pedir(`/v1/comercial/contratos/${CONTRATO}/envios`, { cookie, corpo: { nome: "final.pdf", tamanho: 5000 } });
  assertEquals(e.status, 201);
  assertEquals(chamada(m, "comercial_iniciar_envio"), { p_pessoa: CAROLINA, p_contrato: CONTRATO, p_dados: { parte: "TRIADE", nome: "final.pdf", tamanho: 5000 } });
  assertEquals((await erro(await m.pedir(`/v1/comercial/contratos/${CONTRATO}/envios`, { cookie, corpo: { parte: "CONDOMINIO", nome: "a.pdf", tamanho: 5 } })))
    .detalhes?.motivo, "ORDEM_DAS_ASSINATURAS");
  const assinado = await assinarIncremental(BASE);
  m.arm.objetos.set(CAMINHO_ENVIO, assinado);
  await m.pedir(`/v1/comercial/envios/${ENVIO}/verificar`, { cookie, corpo: {} });
  const res = chamada(m, "comercial_verificar_envio")!.p_resultado as Record<string, unknown>;
  assertEquals([res.valido, res.assinaturas, res.assinaturaNova, res.soAssinatura, res.prefixoSha256], [true, 1, true, true, BASE_SHA]);
  // A base guardada que não bate com o resumo do banco: erro, nada é gravado.
  m.arm.objetos.set(CAMINHO_CONTRATO, juntar(BASE, texto.encode("\n")));
  const antes = m.chamadas.filter((c) => c.funcao === "comercial_verificar_envio").length;
  assertEquals((await erro(await m.pedir(`/v1/comercial/envios/${ENVIO}/verificar`, { cookie, corpo: {} }))).codigo, "INTERNAL_ERROR");
  assertEquals(m.chamadas.filter((c) => c.funcao === "comercial_verificar_envio").length, antes);
  m.arm.objetos.set(CAMINHO_CONTRATO, BASE);

  const marcas = await erro(await m.pedir(`/v1/comercial/envios/${ENVIO}/conferir`, { cookie, corpo: { versao: 2, assinaturaValida: true, cpf: "111.444.777-35" } }));
  assertEquals(marcas.detalhes?.campos, ["pessoaConfere", "dataConfere"]);
  await m.pedir(`/v1/comercial/envios/${ENVIO}/conferir`, {
    cookie, corpo: { versao: 2, assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: "111.444.777-35", observacao: "Certificado ICP" },
  });
  assertEquals(chamada(m, "comercial_conferir_envio"), {
    p_pessoa: CAROLINA, p_envio: ENVIO, p_versao: 2,
    p_dados: { assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: "11144477735", assinanteNome: null, observacao: "Certificado ICP" },
  });
  assertEquals((await erro(await m.pedir(`/v1/comercial/envios/${ENVIO}/recusar`, { cookie, corpo: { versao: 2, motivo: "x" } }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`/v1/comercial/envios/${ENVIO}/recusar`, { cookie, corpo: { versao: 2, motivo: "Certificado de outra pessoa" } });
  assertEquals(chamada(m, "comercial_recusar_envio"), { p_pessoa: CAROLINA, p_envio: ENVIO, p_versao: 2, p_motivo: "Certificado de outra pessoa" });
});

Deno.test("0308: virar cliente, piloto, troca, modelo e a ficha do cliente", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/virar-cliente`, { cookie, corpo: { versao: 3 } }))).detalhes?.campos,
    ["responsavelImplantacaoId"]);
  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/virar-cliente`, { cookie, corpo: { versao: 3, responsavelImplantacaoId: IMPLANTACAO } })).status, 201);
  assertEquals(chamada(m, "comercial_virar_cliente"), {
    p_pessoa: CAROLINA, p_interessado: AROEIRA, p_versao: 3, p_dados: { responsavelImplantacaoId: IMPLANTACAO, cidade: null, uf: null, cenario: null },
  });
  const piloto = { versao: 2, prazoDias: 45, comecaEm: "2026-10-26", meta: "RETORNOS_NO_PRAZO", metaPercentual: 80, combinadoCom: "Lúcia, síndica",
                   responsavelImplantacaoId: IMPLANTACAO };
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/piloto`, { cookie, corpo: { ...piloto, prazoDias: 20 } }))).detalhes?.campos,
    ["prazoDias"]);
  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/piloto`, { cookie, corpo: piloto })).status, 201);
  assertEquals((await erro(await m.pedir(`/v1/comercial/pilotos/${CONTRATO}/encerrar`, { cookie, corpo: { versao: 1, resultado: "PERDIDO" } }))).detalhes?.campos,
    ["motivoPerda"]);
  await m.pedir(`/v1/comercial/pilotos/${CONTRATO}/encerrar`, { cookie, corpo: { versao: 1, resultado: "PERDIDO", motivoPerda: "PRECO" } });
  assertEquals(chamada(m, "comercial_encerrar_piloto"), {
    p_pessoa: CAROLINA, p_piloto: CONTRATO, p_versao: 1, p_dados: { resultado: "PERDIDO", motivoPerda: "PRECO", detalhe: null },
  });
  await m.pedir(`/v1/comercial/interessados/${AROEIRA}/troca`, { cookie, metodo: "PUT", corpo: { empresaAnterior: "Contábil Norte", dataTroca: "2026-12-01" } });
  assertEquals(chamada(m, "comercial_salvar_troca"), {
    p_pessoa: CAROLINA, p_interessado: AROEIRA, p_versao: null, p_dados: { empresaAnterior: "Contábil Norte", dataTroca: "2026-12-01", itens: null, carta: null },
  });
  const csv = await m.pedir("/v1/comercial/troca/planilha-modelo", { cookie });
  assertEquals(csv.headers.get("content-type"), "text/csv; charset=utf-8");
  assert((await csv.text()).includes("Bloco;Unidade;Nome do morador"));
  assertEquals((await erro(await m.pedir("/v1/comercial/modelos/contrato", { cookie, corpo: { titulo: "Contrato", texto: `${"x".repeat(60)} «multa»` } })))
    .detalhes?.campos, ["texto"]);
  const ficha = await (await m.pedir(`/v1/clientes/${AROEIRA}/contrato?link=1`, { cookie })).json();
  assertEquals(ficha.contrato.numero, 2);
  assert(ficha.pdf.url.includes(CAMINHO_ENVIO));
  assertEquals((await (await m.pedir(`/v1/clientes/${AROEIRA}/contrato`, { cookie })).json()).pdf, undefined, "o link só quando pedido");
});

Deno.test("0308: o link do síndico manda os documentos e o PDF assinado, com limite por aparelho", async () => {
  const m = montar();
  assertEquals((await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato`)).status, 200);
  assertEquals((await erro(await m.pedir("/v1/publico/propostas/curto/contrato"))).codigo, "NOT_FOUND");
  const doc = await m.pedir(`/v1/publico/propostas/${CODIGO}/documentos`, { corpo: { tipo: "ATA_ELEICAO", nome: "ata.pdf", tamanho: 900, mandatoAte: "2027-12-31" } });
  assertEquals(doc.status, 201);
  assertEquals(chamada(m, "publico_iniciar_documento"), {
    p_codigo: CODIGO, p_dados: { tipo: "ATA_ELEICAO", nome: "ata.pdf", tamanho: 900, cnpj: null, mandatoAte: "2027-12-31" }, p_ip: "200.1.2.3",
  });
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/pdf?final=1`))).detalhes?.motivo, "SEM_PDF_FINAL");
  const baixar = await (await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/pdf`)).json();
  assert(baixar.url.includes("download=contrato-2.pdf"));

  // O PDF sem assinatura é recusado na hora e apagado.
  assertEquals((await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado`, { corpo: { nome: "a.pdf", tamanho: BASE.length } })).status, 201);
  m.arm.objetos.set(CAMINHO_ENVIO, BASE);
  const sem = await (await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado/${ENVIO}/verificar`, { corpo: {} })).json();
  assertEquals(sem.situacao, "RECUSADO_NA_HORA");
  assertEquals(m.arm.apagados, [CAMINHO_ENVIO]);
  m.arm.objetos.set(CAMINHO_ENVIO, await assinarIncremental(BASE));
  const com = await (await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado/${ENVIO}/verificar`, { corpo: {} })).json();
  assertEquals(com.situacao, "A_CONFERIR");
  assertEquals(m.arm.apagados.length, 1, "o assinado fica guardado");
  // Quatro envios e conferências por aparelho na janela (no teste): o quinto é recusado.
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado`, { corpo: { nome: "a.pdf", tamanho: 10 } }))).codigo, "RATE_LIMITED");
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado`, { corpo: { nome: "a.pdf", tamanho: 10, formato: "image/png" } })))
    .codigo, "RATE_LIMITED");
});
