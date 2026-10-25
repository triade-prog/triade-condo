// Contrato pelo gov.br (0308): o PDF montado no servidor, sempre igual para o mesmo retrato e com a
// impressão digital em cada folha; a conferência automática do PDF assinado com três PDFs de teste
// (assinado por atualização incremental, sem assinatura e regravado); e as rotas da equipe e do link
// do síndico, que levam a pessoa da sessão, validam a entrada (só PDF, até 10 MB) e apagam o que vem
// sem assinatura.
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { PDFDocument } from "pdf-lib";
import { criarApiConsole } from "./app.ts";
import { conferirAssinatura, contarAssinaturas, gerarPdfContrato, type RetratoContrato, sha256Bytes } from "./contrato.ts";
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
/** O que o assinador do gov.br acrescenta no fim: o dicionário /Sig com o /ByteRange (atualização incremental). */
const assinatura = (n: number) =>
  texto.encode(`\n${9000 + n} 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [0 1000 3000 500] ` +
    `/Contents <3082> /M (D:20261025100000-03'00') >>\nendobj\nxref\n0 0\ntrailer\n<< >>\nstartxref\n0\n%%EOF\n`);

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
  assertEquals((await conferirAssinatura(pdf, pdf.length)).valido, true);
});

Deno.test("0308: a conferência automática com os três PDFs de teste", async () => {
  const base = await gerarPdfContrato(RETRATO, HASH);
  const baseSha = await sha256Bytes(base);

  // 1. Assinado pelo condomínio por atualização incremental: uma assinatura, o começo é a base.
  const condominio = juntar(base, assinatura(1));
  const c1 = await conferirAssinatura(condominio, base.length);
  assertEquals([c1.valido, c1.assinaturas, c1.prefixoSha256, c1.tamanho], [true, 1, baseSha, condominio.length]);
  assertEquals(c1.sha256, await sha256Bytes(condominio));
  // A TRÍADE assina sobre o arquivo do condomínio: duas assinaturas, o começo é o do condomínio.
  const c2 = await conferirAssinatura(juntar(condominio, assinatura(2)), condominio.length);
  assertEquals([c2.assinaturas, c2.prefixoSha256], [2, c1.sha256]);

  // 2. Sem assinatura: zero (o banco recusa na hora). Um /ByteRange solto não é assinatura.
  assertEquals((await conferirAssinatura(base, base.length)).assinaturas, 0);
  const solto = juntar(base, texto.encode("\n% /ByteRange [0 1 2 3]\n%%EOF\n"));
  assertEquals(contarAssinaturas(solto), 0);

  // 3. Regravado pelo assinador (load e save) e assinado: tem assinatura, mas o começo não é a base.
  const regravado = juntar(await (await PDFDocument.load(base)).save({ useObjectStreams: true }), assinatura(1));
  const c3 = await conferirAssinatura(regravado, base.length);
  assertEquals(c3.assinaturas, 1);
  assertNotEquals(c3.prefixoSha256, baseSha);

  // Arquivo que não é PDF, PDF com script e arquivo que não chegou: inválidos.
  assertEquals((await conferirAssinatura(texto.encode("não é PDF"), 10)).valido, false);
  assertEquals((await conferirAssinatura(juntar(base, texto.encode("\n<< /JavaScript (x) >>\n%%EOF\n")), base.length)).valido, false);
  assertEquals((await conferirAssinatura(null, base.length)).motivo, "O arquivo não chegou. Envie de novo.");
});

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
    comercial_envio_a_verificar: () => ({ caminho: CAMINHO_ENVIO, tipo: "application/pdf", baseTamanho: 100 }),
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
    publico_envio_a_verificar: () => ({ caminho: CAMINHO_ENVIO, tipo: "application/pdf", baseTamanho: 100 }),
    publico_verificar_envio: (a) => {
      const r = a.p_resultado as { valido: boolean; assinaturas?: number };
      const naHora = !r.valido || (r.assinaturas ?? 0) === 0;
      return { situacao: naHora ? "RECUSADO_NA_HORA" : "A_CONFERIR", apagarArquivo: naHora };
    },
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    armazenamentoContrato: arm.armazenamento,
  });
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
  const base = new Uint8Array(100).fill(37);
  const assinado = juntar(base, assinatura(1), assinatura(2));
  m.arm.objetos.set(CAMINHO_ENVIO, juntar(texto.encode("%PDF-1.7\n"), assinado));
  await m.pedir(`/v1/comercial/envios/${ENVIO}/verificar`, { cookie, corpo: {} });
  const res = chamada(m, "comercial_verificar_envio")!.p_resultado as Record<string, unknown>;
  assertEquals([res.valido, res.assinaturas, res.prefixoSha256], [true, 2, await sha256Bytes(juntar(texto.encode("%PDF-1.7\n"), assinado).subarray(0, 100))]);

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
  const base = await gerarPdfContrato(RETRATO, HASH);
  assertEquals((await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado`, { corpo: { nome: "a.pdf", tamanho: base.length } })).status, 201);
  m.arm.objetos.set(CAMINHO_ENVIO, base);
  const sem = await (await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado/${ENVIO}/verificar`, { corpo: {} })).json();
  assertEquals(sem.situacao, "RECUSADO_NA_HORA");
  assertEquals(m.arm.apagados, [CAMINHO_ENVIO]);
  m.arm.objetos.set(CAMINHO_ENVIO, juntar(base, assinatura(1)));
  const com = await (await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado/${ENVIO}/verificar`, { corpo: {} })).json();
  assertEquals(com.situacao, "A_CONFERIR");
  assertEquals(m.arm.apagados.length, 1, "o assinado fica guardado");
  // Quatro envios e conferências por aparelho na janela (no teste): o quinto é recusado.
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado`, { corpo: { nome: "a.pdf", tamanho: 10 } }))).codigo, "RATE_LIMITED");
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/contrato/assinado`, { corpo: { nome: "a.pdf", tamanho: 10, formato: "image/png" } })))
    .codigo, "RATE_LIMITED");
});
