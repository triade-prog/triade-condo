// Desfazer o cancelamento e reativar pelo aditivo de retorno (0318, R17.7c; CM-31, CM-32 e CM-13;
// quadros 487 a 491): as rotas validam a entrada e levam a pessoa da sessão; quem pode, o prazo, o
// plano da tabela do dia e as assinaturas saem do banco. O aditivo de retorno é montado em PDF e
// guardado como o de reajuste; as assinaturas dos aditivos passam pela conferência do contrato.
import { assert, assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { gerarPdfAditivo, type RetratoAditivo, sha256Bytes } from "./contrato.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const PEQUI = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const CANCELAMENTO = "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b";
const ADITIVO = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const ENVIO = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
const MODELO = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const CAMINHO = `${PEQUI}/${PEQUI}/${ADITIVO}`;
const CAMINHO_ENVIO = `${PEQUI}/${PEQUI}/${ENVIO}`;
const HASH = "c".repeat(64);
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const RETRATO: RetratoAditivo = {
  numero: 1,
  tipo: "RETORNO",
  titulo: "Aditivo de retorno",
  texto: "O Residencial Pequi, por Lúcia Prado (CPF 529.982.247-25), volta ao contrato nº 3 no plano Tabela cheia, 41 a 100 unidades, por R$ 349,00 por mês.",
  campos: { condominio: "Residencial Pequi", vale_desde: "competência de 03/2027" },
  modelo: { numero: 1 },
  contrato: { numero: 3, hash: "b".repeat(64) },
  geradoEm: "2027-02-24T09:00:00-03:00",
};
const RETORNO = { representante: "Lúcia Prado", cpf: "529.982.247-25", competencia: "2027-03-01", ciclo: "MENSAL" };
const CANC = { id: CANCELAMENTO, versao: 5, situacao: "ENCERRADO" };
const BASE = new TextEncoder().encode("base");
const BASE_SHA = await sha256Bytes(BASE);

function montar(opcoes: { semArmazenamento?: boolean; baseCaminho?: string | null } = {}) {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const arm = armazenamentoFalso();
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    comercial_cancelamento: () => ({ cancelamento: CANC, pode: { desfazer: true, reativar: true, assinar: true } }),
    comercial_desfazer_cancelamento: (a) => (a.p_versao === 9
      ? erroBanco("TC422", { motivo: "ULTIMO_DIA_PASSOU" })
      : { cancelamento: { ...CANC, situacao: "DESFEITO", desfeitoNota: a.p_nota } }),
    comercial_gerar_aditivo_retorno: (a) => ((a.p_dados as { representante: string }).representante === "Sem modelo"
      ? erroBanco("TC422", { motivo: "SEM_MODELO_RETORNO" })
      : { aditivoId: ADITIVO, caminho: CAMINHO, hash: HASH, dados: RETRATO }),
    comercial_aditivo_pronto: (a) => ({ id: a.p_aditivo, numero: 1, tipo: "RETORNO", situacao: "PRONTO", hash: HASH }),
    comercial_aditivo_a_montar: () => ({ aditivoId: ADITIVO, caminho: CAMINHO, hash: HASH, dados: RETRATO }),
    comercial_reativar_cliente: (a) => (a.p_versao === 5
      ? erroBanco("TC422", { motivo: "ADITIVO_SEM_ASSINATURAS" })
      : { cancelamento: { ...CANC, situacao: "REATIVADO" } }),
    comercial_abrir_aditivo_arquivo: (a) => ({
      caminho: a.p_envio ? CAMINHO_ENVIO : CAMINHO, nome: a.p_envio ? "condominio.pdf" : a.p_gerado ? "aditivo-1.pdf" : "aditivo-1-assinado.pdf",
      tipo: "application/pdf",
    }),
    comercial_iniciar_envio_aditivo: () => ({ envioId: ENVIO, caminho: CAMINHO_ENVIO, tipo: "application/pdf" }),
    comercial_envio_aditivo_a_verificar: () => ({
      caminho: CAMINHO_ENVIO, tipo: "application/pdf", baseCaminho: opcoes.baseCaminho === undefined ? CAMINHO : opcoes.baseCaminho,
      baseSha256: BASE_SHA, baseTamanho: BASE.length,
    }),
    comercial_verificar_envio_aditivo: (a) => ({
      id: a.p_envio, situacao: (a.p_resultado as { valido: boolean }).valido ? "A_CONFERIR" : "RECUSADO_NA_HORA",
      apagarArquivo: !(a.p_resultado as { valido: boolean }).valido,
    }),
    comercial_conferir_envio_aditivo: (a) => ({ id: a.p_envio, versao: 3, situacao: "CONFERIDO", aditivo: { id: ADITIVO } }),
    comercial_recusar_envio_aditivo: (a) => ({ id: a.p_envio, versao: 3, situacao: "RECUSADO", recusa: { motivo: a.p_motivo } }),
    comercial_salvar_modelo_aditivo: (a) => ({ id: a.p_id ?? MODELO, versao: 1, situacao: "RASCUNHO", tipo: (a.p_dados as { tipo?: string }).tipo ?? "REAJUSTE" }),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    armazenamentoContrato: opcoes.semArmazenamento ? undefined : arm.armazenamento,
  });
  return { pedir: pedido(app, "api-console"), arm, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const URL_K = `/v1/comercial/cancelamentos/${CANCELAMENTO}`;

Deno.test("0318: desfazer, reativar e os aditivos pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of [URL_K, `/v1/comercial/aditivos/${ADITIVO}/link`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  for (const rota of [`${URL_K}/desfazer`, `${URL_K}/retorno/aditivo`, `${URL_K}/reativar`, `/v1/comercial/aditivos/${ADITIVO}/envios`,
    `/v1/comercial/aditivos/${ADITIVO}/montar`, `/v1/comercial/envios-aditivo/${ENVIO}/verificar`, `/v1/comercial/envios-aditivo/${ENVIO}/conferir`,
    `/v1/comercial/envios-aditivo/${ENVIO}/recusar`]) {
    assertEquals((await erro(await m.pedir(rota, { corpo: {} }))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals(m.chamadas.filter((c) => c.funcao.startsWith("comercial_")).length, 0);
});

Deno.test("0318: o cancelamento abre sozinho e desfazer pede a nota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const k = await (await m.pedir(URL_K, { cookie })).json();
  assertEquals([k.cancelamento.situacao, k.pode.assinar], ["ENCERRADO", true]);
  assertEquals(chamada(m, "comercial_cancelamento"), { p_pessoa: CAROLINA, p_id: CANCELAMENTO });
  assertEquals((await erro(await m.pedir("/v1/comercial/cancelamentos/nao-e-id", { cookie }))).codigo, "NOT_FOUND");

  assertEquals((await erro(await m.pedir(`${URL_K}/desfazer`, { cookie, corpo: { versao: 4 } }))).detalhes?.campos, ["nota"]);
  assertEquals((await erro(await m.pedir(`${URL_K}/desfazer`, { cookie, corpo: { nota: "A síndica desistiu" } }))).detalhes?.campos, ["versao"]);
  const r = await m.pedir(`${URL_K}/desfazer`, { cookie, corpo: { versao: 4, nota: " A síndica desistiu " } });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).cancelamento.situacao, "DESFEITO");
  assertEquals(chamada(m, "comercial_desfazer_cancelamento"), { p_pessoa: CAROLINA, p_id: CANCELAMENTO, p_versao: 4, p_nota: "A síndica desistiu" });
  // Depois do último dia, o banco recusa: a volta é pelo aditivo.
  assertEquals((await erro(await m.pedir(`${URL_K}/desfazer`, { cookie, corpo: { versao: 9, nota: "Tarde demais" } }))).detalhes?.motivo, "ULTIMO_DIA_PASSOU");
});

Deno.test("0318: gerar o aditivo de retorno monta o PDF do retrato, guarda e manda o sha256", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: { ...RETORNO, cpf: "529.982.247-24" } }))).detalhes?.campos, ["cpf"]);
  assertEquals((await erro(await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: { ...RETORNO, competencia: "2027-03-10" } }))).detalhes?.campos,
    ["competencia"]);
  assertEquals((await erro(await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: { ...RETORNO, ciclo: "SEMANAL" } }))).detalhes?.campos, ["ciclo"]);
  const r = await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: RETORNO });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "comercial_gerar_aditivo_retorno"), {
    p_pessoa: CAROLINA, p_cancelamento: CANCELAMENTO,
    p_dados: { representante: "Lúcia Prado", cpf: "52998224725", competencia: "2027-03-01", ciclo: "MENSAL", valorCentavos: null, motivo: null },
  });
  const guardado = m.arm.objetos.get(CAMINHO)!;
  assertEquals(guardado, await gerarPdfAditivo(RETRATO, HASH), "o PDF guardado é o do retrato");
  assert(new TextDecoder("latin1").decode(guardado).includes("%PDF-"));
  assertEquals(chamada(m, "comercial_aditivo_pronto"), { p_pessoa: CAROLINA, p_aditivo: ADITIVO, p_sha256: await sha256Bytes(guardado), p_tamanho: guardado.length });
  assertEquals((await r.json()).aditivo.situacao, "PRONTO");
  // O de retorno não é o de reajuste: o PDF muda pelo tipo.
  assert((await gerarPdfAditivo({ ...RETRATO, tipo: undefined }, HASH)).length !== guardado.length);

  // Sob consulta e gerar de novo: o valor e o motivo vão ao banco, que confere.
  await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: { ...RETORNO, ciclo: "ANUAL", valorCentavos: 159900, motivo: "Prefere o anual" } });
  assertEquals((chamada(m, "comercial_gerar_aditivo_retorno")!.p_dados as Record<string, unknown>).valorCentavos, 159900);
  assertEquals((await erro(await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: { ...RETORNO, representante: "Sem modelo" } }))).detalhes?.motivo,
    "SEM_MODELO_RETORNO");

  // Montar de novo o que ficou montando.
  m.arm.objetos.clear();
  assertEquals((await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/montar`, { cookie, corpo: {} })).status, 200);
  assert(m.arm.objetos.has(CAMINHO));
  assertEquals(chamada(m, "comercial_aditivo_a_montar"), { p_pessoa: CAROLINA, p_aditivo: ADITIVO });
});

Deno.test("0318: sem armazenamento, o aditivo de retorno não é gerado pela metade", async () => {
  const m = montar({ semArmazenamento: true });
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`${URL_K}/retorno/aditivo`, { cookie, corpo: RETORNO }))).codigo, "INTERNAL_ERROR");
  assertEquals(chamada(m, "comercial_gerar_aditivo_retorno"), undefined);
});

Deno.test("0318: o PDF do aditivo, o envio assinado, a conferência e a recusa", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const gerado = await (await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/link?baixar=1`, { cookie })).json();
  assert(gerado.url.includes(CAMINHO) && gerado.url.includes("aditivo-1.pdf"));
  assertEquals(chamada(m, "comercial_abrir_aditivo_arquivo"), { p_pessoa: CAROLINA, p_aditivo: ADITIVO, p_envio: null, p_gerado: true });
  await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/link?assinado=1`, { cookie });
  assertEquals(chamada(m, "comercial_abrir_aditivo_arquivo")!.p_gerado, false);
  const envio = await (await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/link?envio=${ENVIO}&baixar=1`, { cookie })).json();
  assert(envio.url.includes(CAMINHO_ENVIO));
  assertEquals((await erro(await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/link?envio=outro`, { cookie }))).detalhes?.campos, ["envio"]);

  assertEquals((await erro(await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/envios`, { cookie, corpo: { parte: "SINDICO", nome: "a.pdf", tamanho: 10 } })))
    .detalhes?.campos, ["parte"]);
  const e = await m.pedir(`/v1/comercial/aditivos/${ADITIVO}/envios`, { cookie, corpo: { parte: "CONDOMINIO", nome: "condominio.pdf", tamanho: 4500 } });
  assertEquals(e.status, 201);
  const corpo = await e.json();
  assertEquals([corpo.envioId, corpo.envio.metodo], [ENVIO, "PUT"]);
  assert(corpo.envio.url.includes(CAMINHO_ENVIO));
  assertEquals(chamada(m, "comercial_iniciar_envio_aditivo"), {
    p_pessoa: CAROLINA, p_aditivo: ADITIVO, p_dados: { parte: "CONDOMINIO", nome: "condominio.pdf", tamanho: 4500 },
  });

  // A conferência automática: o arquivo que não é PDF volta recusado na hora e é apagado.
  m.arm.objetos.set(CAMINHO, BASE);
  m.arm.objetos.set(CAMINHO_ENVIO, new TextEncoder().encode("não é pdf"));
  const v = await (await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/verificar`, { cookie, corpo: {} })).json();
  assertEquals(v.situacao, "RECUSADO_NA_HORA");
  assertEquals((chamada(m, "comercial_verificar_envio_aditivo")!.p_resultado as { valido: boolean }).valido, false);
  assert(m.arm.apagados.includes(CAMINHO_ENVIO));

  const marcas = await erro(await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/conferir`, { cookie, corpo: { versao: 2, assinaturaValida: true } }));
  assertEquals(marcas.detalhes?.campos, ["pessoaConfere", "dataConfere"]);
  const ok = await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/conferir`, {
    cookie, corpo: { versao: 2, assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: null, assinanteNome: null, observacao: null },
  });
  assertEquals((await ok.json()).situacao, "CONFERIDO");
  assertEquals(chamada(m, "comercial_conferir_envio_aditivo"), {
    p_pessoa: CAROLINA, p_envio: ENVIO, p_versao: 2,
    p_dados: { assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: null, assinanteNome: null, observacao: null },
  });
  await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/conferir`, {
    cookie, corpo: { versao: 2, assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: "111.444.777-35", assinanteNome: "Carolina" },
  });
  assertEquals((chamada(m, "comercial_conferir_envio_aditivo")!.p_dados as { cpf: string }).cpf, "11144477735");

  assertEquals((await erro(await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/recusar`, { cookie, corpo: { versao: 2, motivo: "x" } }))).detalhes?.campos,
    ["motivo"]);
  await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/recusar`, { cookie, corpo: { versao: 2, motivo: "Assinou o arquivo errado" } });
  assertEquals(chamada(m, "comercial_recusar_envio_aditivo"), { p_pessoa: CAROLINA, p_envio: ENVIO, p_versao: 2, p_motivo: "Assinou o arquivo errado" });
});

Deno.test("0318: o aditivo gerado de novo enquanto o arquivo subia não conta", async () => {
  const m = montar({ baseCaminho: null });
  const cookie = await entrar(m);
  m.arm.objetos.set(CAMINHO_ENVIO, new TextEncoder().encode("%PDF-1.7"));
  await m.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/verificar`, { cookie, corpo: {} });
  const r = chamada(m, "comercial_verificar_envio_aditivo")!.p_resultado as { valido: boolean; motivo: string };
  assertEquals([r.valido, r.motivo], [false, "O aditivo mudou. Baixe o novo, assine pelo gov.br e envie de novo."]);
  // A base que não bate com o resumo do banco: erro, nada é gravado.
  const m2 = montar();
  const c2 = await entrar(m2);
  m2.arm.objetos.set(CAMINHO, new TextEncoder().encode("bas3"));
  m2.arm.objetos.set(CAMINHO_ENVIO, new TextEncoder().encode("%PDF-1.7"));
  assertEquals((await erro(await m2.pedir(`/v1/comercial/envios-aditivo/${ENVIO}/verificar`, { cookie: c2, corpo: {} }))).codigo, "INTERNAL_ERROR");
  assertEquals(chamada(m2, "comercial_verificar_envio_aditivo"), undefined);
});

Deno.test("0318: reativar pede a versão; o modelo de aditivo leva o tipo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`${URL_K}/reativar`, { cookie, corpo: {} }))).detalhes?.campos, ["versao"]);
  assertEquals((await erro(await m.pedir(`${URL_K}/reativar`, { cookie, corpo: { versao: 5 } }))).detalhes?.motivo, "ADITIVO_SEM_ASSINATURAS");
  const r = await m.pedir(`${URL_K}/reativar`, { cookie, corpo: { versao: 6 } });
  assertEquals((await r.json()).cancelamento.situacao, "REATIVADO");
  assertEquals(chamada(m, "comercial_reativar_cliente"), { p_pessoa: CAROLINA, p_cancelamento: CANCELAMENTO, p_versao: 6, p_dados: {} });

  const texto = "O «condominio» (CNPJ «cnpj»), por «representante», volta ao contrato «contrato» no plano «plano», por «valor_mensal».";
  assertEquals((await m.pedir("/v1/comercial/modelos/aditivo", { cookie, corpo: { tipo: "RETORNO", titulo: "Aditivo de retorno", texto } })).status, 201);
  assertEquals(chamada(m, "comercial_salvar_modelo_aditivo"), {
    p_pessoa: CAROLINA, p_id: null, p_versao: null, p_dados: { tipo: "RETORNO", titulo: "Aditivo de retorno", texto },
  });
  // O campo do reajuste no retorno é recusado antes do banco.
  assertEquals((await erro(await m.pedir("/v1/comercial/modelos/aditivo", { cookie, corpo: { tipo: "RETORNO", titulo: "Aditivo", texto: `${texto} «aniversario»` } })))
    .detalhes?.campos, ["texto"]);
  assertEquals((await erro(await m.pedir(`/v1/comercial/modelos/aditivo/${MODELO}`, { cookie, metodo: "PUT", corpo: { versao: 1, tipo: "OUTRO", titulo: "Aditivo", texto } })))
    .detalhes?.campos, ["tipo"]);
  await m.pedir(`/v1/comercial/modelos/aditivo/${MODELO}`, { cookie, metodo: "PUT", corpo: { versao: 1, tipo: "RETORNO", titulo: "Aditivo de retorno", texto } });
  assertEquals(chamada(m, "comercial_salvar_modelo_aditivo")!.p_id, MODELO);
});
