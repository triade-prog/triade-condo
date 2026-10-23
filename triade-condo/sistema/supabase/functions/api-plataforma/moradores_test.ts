// Passo 3 e 3b na Plataforma do síndico: blocos, unidades, contatos e o vínculo detalhado. As rotas validam a entrada,
// mandam ao banco a pessoa e o condomínio da sessão e deixam a permissão para o banco.
import { assert, assertEquals } from "@std/assert";
import { AGRUPAMENTOS, LIGACOES, MOTIVOS_ENCERRAMENTO, OCUPACOES, PARENTESCOS, RELACOES_UNIDADE } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const OUTRO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ITEM = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar(handlers: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_unidades: () => ({ blocos: [], unidades: [] }),
    plataforma_incluir_unidades: (a) => ({ criadas: (a.p_unidades as unknown[]).length, jaExistiam: [] }),
    plataforma_definir_estrutura: (a) => Number(a.p_versao) + 1,
    plataforma_incluir_pessoa_unidade: () => ({ vinculoId: ITEM, contatoId: OUTRO, avisos: [] }),
    plataforma_alterar_marcas_vinculo: (a) => Number(a.p_versao) + 1,
    plataforma_moradores: () => ({ itens: [], total: 0 }),
    plataforma_registrar_mudanca: () => ({ saem: 1, entram: 1 }),
    plataforma_confirmar_contatos: (a) => (a.p_itens as unknown[]).length,
    plataforma_importar_moradores: (a) => ({ linhas: (a.p_linhas as unknown[]).length }),
    plataforma_marcar_unidade: (a) => Number(a.p_versao) + 1,
    ...handlers,
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo", armazenamento: armazenamentoFalso().armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("PT-01: sem sessão nada chega ao banco; com sessão, o condomínio vem dela", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/unidades"))).codigo, "UNAUTHORIZED");
  assertEquals(m.chamadas.filter((c) => c.funcao === "plataforma_unidades").length, 0);
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/unidades?condominio=${OUTRO}`, { cookie });
  assertEquals(chamada(m, "plataforma_unidades"), { p_pessoa: ANA, p_condominio: AURORA });
});

Deno.test("F3.1: várias unidades de uma vez, com o andar de cada uma; identificação vazia para antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/unidades", { corpo: { blocoId: null, unidades: [{ identificacao: " " }] }, cookie }))).codigo,
    "VALIDATION_ERROR");
  const r = await m.pedir("/v1/condominio/unidades", {
    corpo: { blocoId: ITEM, unidades: [{ identificacao: " 101", andar: " 1 " }, { identificacao: "102", andar: "" }] }, cookie,
  });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_incluir_unidades")?.p_unidades, [{ identificacao: "101", andar: "1" }, { identificacao: "102", andar: null }]);
});

Deno.test("estrutura do prédio: torre, bloco, quadra ou prédio, com ou sem andar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/estrutura", { metodo: "PUT", corpo: { versao: 1, agrupamento: "ALA", usaAndar: true }, cookie }))).codigo,
    "VALIDATION_ERROR");
  const r = await m.pedir("/v1/condominio/estrutura", { metodo: "PUT", corpo: { versao: 1, agrupamento: "TORRE", usaAndar: true }, cookie });
  assertEquals(await r.json(), { versao: 2 });
  assertEquals(chamada(m, "plataforma_definir_estrutura"), { p_pessoa: ANA, p_condominio: AURORA, p_versao: 1, p_agrupamento: "TORRE", p_usa_andar: true });
});

Deno.test("MU-01: o telefone chega ao banco no formato internacional", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { nome: " Marina Souza ", telefone: "(61) 99999-0001", relacao: "PROPRIETARIO", principal: true };
  const r = await m.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo, cookie });
  assertEquals(r.status, 201);
  const args = chamada(m, "plataforma_incluir_pessoa_unidade")!;
  assertEquals([args.p_unidade, args.p_nome, args.p_telefone, args.p_recebe], [ITEM, "Marina Souza", "+5561999990001", true]);
  const ruim = await m.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { ...corpo, telefone: "9999" }, cookie });
  assertEquals(await erro(ruim), { codigo: "VALIDATION_ERROR", detalhes: { campos: ["telefone"] } });
});

Deno.test("MU-04: contato que já existe vai pelo id, sem nome nem telefone", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { contatoId: OUTRO, nome: "Outro nome", relacao: "PROPRIETARIO" }, cookie });
  const args = chamada(m, "plataforma_incluir_pessoa_unidade")!;
  assertEquals([args.p_contato, args.p_nome, args.p_telefone], [OUTRO, null, null]);
});

Deno.test("MU-01: inquilino leva junto o proprietário do imóvel, novo ou já cadastrado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const inquilino = { nome: "Joana Lima", telefone: "61988887777", relacao: "INQUILINO" };
  await m.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { ...inquilino, proprietario: { nome: " Rita Prado ", telefone: "(61) 94444-0001" } }, cookie });
  assertEquals(chamada(m, "plataforma_incluir_pessoa_unidade")?.p_proprietario, { nome: "Rita Prado", telefone: "+5561944440001" });
  const m2 = montar();
  const cookie2 = await entrar(m2);
  await m2.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { ...inquilino, proprietario: { contatoId: OUTRO } }, cookie: cookie2 });
  assertEquals(chamada(m2, "plataforma_incluir_pessoa_unidade")?.p_proprietario, { contatoId: OUTRO });
  const ruim = await m2.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { ...inquilino, proprietario: { nome: "Rita", telefone: "123" } }, cookie: cookie2 });
  assertEquals((await erro(ruim)).codigo, "VALIDATION_ERROR");
  const sem = montar();
  await sem.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: inquilino, cookie: await entrar(sem) });
  assertEquals(chamada(sem, "plataforma_incluir_pessoa_unidade")?.p_proprietario, null);
});

Deno.test("MU-07: mudança valida a data e quem entra antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const entra = { nome: "Caio", telefone: "61966660001", relacao: "INQUILINO" };
  const ruim = await m.pedir(`/v1/condominio/unidades/${ITEM}/mudanca`, { corpo: { data: "01/10/2026", saem: [], entram: [entra] }, cookie });
  assertEquals((await erro(ruim)).codigo, "VALIDATION_ERROR");
  const r = await m.pedir(`/v1/condominio/unidades/${ITEM}/mudanca`, {
    corpo: { data: "2026-10-01", saem: [{ id: OUTRO, versao: 2 }], entram: [entra] }, cookie,
  });
  assertEquals(await r.json(), { saem: 1, entram: 1 });
  const args = chamada(m, "plataforma_registrar_mudanca")!;
  assertEquals(args.p_entram, [{
    nome: "Caio", telefone: "+5561966660001", proprietario: false, principal: false, mora: true, ligacao: "INQUILINO", parentesco: null,
    recebeComunicados: true,
  }]);
});

Deno.test("MU-10: incluir pessoa com as três marcações, a ligação, o parentesco e a entrada", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const marcas = { mora: true, ligacao: "FAMILIAR", parentesco: "CONJUGE", ocupaDesde: "2025-03-01" };
  const r = await m.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { nome: "Paulo Lima", telefone: "61988887778", marcas }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_incluir_pessoa_unidade")?.p_marcas, { ...marcas, proprietario: false, principal: false });
  for (const ruim of [{ mora: true }, { proprietario: true, ligacao: "INQUILINO" }, { ligacao: "OUTRO", parentesco: "FILHO" }, { ligacao: "OUTRO", ocupaDesde: "2025-02-30" }]) {
    const e = await m.pedir(`/v1/condominio/unidades/${ITEM}/contatos`, { corpo: { nome: "Paulo", telefone: "61988887778", marcas: ruim }, cookie });
    assertEquals(await erro(e), { codigo: "VALIDATION_ERROR", detalhes: { campos: ["marcas"] } }, JSON.stringify(ruim));
  }
});

Deno.test("MU-10: alterar as marcações segue a versão lida; a chamada de antes, com a relação, ainda vale", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/vinculos-unidade/${ITEM}`, {
    metodo: "PUT", corpo: { versao: 3, marcas: { proprietario: true, principal: true }, recebeComunicados: false }, cookie,
  });
  assertEquals(await r.json(), { versao: 4 });
  assertEquals(chamada(m, "plataforma_alterar_marcas_vinculo"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: ITEM, p_versao: 3, p_recebe: false,
    p_marcas: { proprietario: true, principal: true, mora: false, ligacao: null, parentesco: null, ocupaDesde: null },
  });
  const m2 = montar();
  await m2.pedir(`/v1/condominio/vinculos-unidade/${ITEM}`, {
    metodo: "PUT", corpo: { versao: 1, relacao: "INQUILINO", principal: true, recebeComunicados: true }, cookie: await entrar(m2),
  });
  assertEquals(chamada(m2, "plataforma_alterar_marcas_vinculo")?.p_marcas,
    { proprietario: false, principal: true, mora: true, ligacao: "INQUILINO", parentesco: null, ocupaDesde: null });
});

Deno.test("MU-02: confirmar vários de uma vez, cada um com a versão lida", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/vinculos-unidade/confirmar", { corpo: { itens: [] }, cookie }))).codigo, "VALIDATION_ERROR");
  const r = await m.pedir("/v1/condominio/vinculos-unidade/confirmar", { corpo: { itens: [{ id: ITEM, versao: 1 }, { id: OUTRO, versao: 3 }] }, cookie });
  assertEquals(await r.json(), { confirmados: 2 });
});

Deno.test("AT-24: confirmar com a versão velha volta como conflito", async () => {
  const m = montar({ plataforma_confirmar_contatos: () => erroBanco("TC409", { versao: 2, atual: {} }) });
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/vinculos-unidade/confirmar", { corpo: { itens: [{ id: ITEM, versao: 1 }] }, cookie });
  assertEquals(r.status, 409);
});

Deno.test("F3.3: planilha com linha errada volta com a linha, e nada é gravado", async () => {
  const m = montar({ plataforma_importar_moradores: () => erroBanco("TC422", { motivo: "LINHA_INVALIDA", linha: 2, campos: ["telefone"] }) });
  const cookie = await entrar(m);
  const linhas = [{ bloco: null, andar: null, unidade: "101", nome: "Ana", telefone: "61999990001", relacao: "MORADOR" }];
  const r = await m.pedir("/v1/condominio/importacoes", { corpo: { linhas }, cookie });
  assertEquals(await erro(r), { codigo: "VALIDATION_ERROR", detalhes: { motivo: "LINHA_INVALIDA", linha: 2, campos: ["telefone"] } });
  assertEquals((await erro(await m.pedir("/v1/condominio/importacoes", { corpo: { linhas: [] }, cookie }))).codigo, "VALIDATION_ERROR");
});

Deno.test("busca de moradores: só os filtros conhecidos, página como número", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir("/v1/condominio/moradores?busca=%20lia%20&estado=PENDENTE&pagina=2", { cookie });
  assertEquals(chamada(m, "plataforma_moradores"), { p_pessoa: ANA, p_condominio: AURORA, p_busca: "lia", p_estado: "PENDENTE", p_pagina: 2, p_unidade: null });
  assertEquals((await erro(await m.pedir("/v1/condominio/moradores?estado=ENCERRADO", { cookie }))).codigo, "VALIDATION_ERROR");
});

Deno.test("id fora do formato responde como não encontrado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/unidades/101", { cookie }))).codigo, "NOT_FOUND");
});

Deno.test("as listas do domínio (relações e motivos) são as mesmas do banco", async () => {
  const migration = await Deno.readTextFile(new URL("../../migrations/0080_moradores_unidades.sql", import.meta.url));
  for (const s of [...Object.keys(RELACOES_UNIDADE), ...Object.keys(MOTIVOS_ENCERRAMENTO), ...Object.keys(AGRUPAMENTOS)]) {
    assert(migration.includes(`'${s}'`), s);
  }
  const vinculo = await Deno.readTextFile(new URL("../../migrations/0110_vinculo_detalhado.sql", import.meta.url));
  for (const s of [...Object.keys(LIGACOES), ...Object.keys(PARENTESCOS), ...Object.keys(OCUPACOES)]) {
    assert(vinculo.includes(`'${s}'`), s);
  }
});

Deno.test("MU-11: as marcas de venda e aluguel vão juntas ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/unidades/${ITEM}/situacao`, { corpo: { versao: 3, aVenda: true, paraAlugar: false }, cookie });
  assertEquals(await r.json(), { versao: 4 });
  assertEquals(chamada(m, "plataforma_marcar_unidade"), { p_pessoa: ANA, p_condominio: AURORA, p_id: ITEM, p_versao: 3, p_a_venda: true, p_para_alugar: false });
  const ruim = await m.pedir(`/v1/condominio/unidades/${ITEM}/situacao`, { corpo: { versao: 3, aVenda: true }, cookie });
  assertEquals(await erro(ruim), { codigo: "VALIDATION_ERROR", detalhes: { campos: ["paraAlugar"] } });
});
