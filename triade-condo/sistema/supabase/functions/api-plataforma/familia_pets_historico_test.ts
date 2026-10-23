// Família, pets e aniversário no cadastro da unidade (F3.9; MU-06) e o histórico e os
// aniversariantes (F3.10; MU-11). O banco decide; aqui a entrada é validada e repassada.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const UNIDADE = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const CONTATO = "5a2b8e5d-0c6f-4b7a-8d3e-6f7a8b9c0d1e";
const FAMILIAR = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const PET = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar() {
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
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, etiqueta: 2, prestador: 20 }),
    plataforma_incluir_pessoa_unidade: () => ({ vinculoId: CONTATO, contatoId: CONTATO, avisos: [] }),
    plataforma_alterar_contato: (a) => ({ versao: Number(a.p_versao) + 1, avisos: [] }),
    plataforma_salvar_familiar: (a) => ({ id: FAMILIAR, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_salvar_pet: (a) => ({ id: PET, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_retirar_familia_pet: () => ({ ok: true }),
    plataforma_historico_unidade: () => ({ unidade: "Torre A · 101", itens: [], mais: false, total: 0 }),
    plataforma_aniversariantes: () => ({ mes: 3, mesAtual: 3, itens: [], unidades: [] }),
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoManutencao: armazenamentoFalso().armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("MU-06: o aniversário entra ao incluir pessoa, só com dia e mês que existam", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/unidades/${UNIDADE}/contatos`;
  const corpo = { nome: "Joana Lima", telefone: "(61) 98888-7777", marcas: { proprietario: true, principal: true, mora: true } };
  assertEquals((await erro(await m.pedir(url, { cookie, corpo: { ...corpo, aniversario: { dia: 31, mes: 4 } } }))).detalhes?.campos, ["aniversario"]);
  assertEquals((await m.pedir(url, { cookie, corpo: { ...corpo, aniversario: { dia: 3, mes: 11 } } })).status, 201);
  assertEquals(chamada(m, "plataforma_incluir_pessoa_unidade")?.p_aniversario, { dia: 3, mes: 11 });
  await m.pedir(url, { cookie, corpo });
  assertEquals(chamada(m, "plataforma_incluir_pessoa_unidade")?.p_aniversario, null);
});

Deno.test("MU-06: editar o contato deixa, troca ou tira o aniversário", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/contatos/${CONTATO}`;
  const corpo = { versao: 2, nome: "Joana Lima", telefone: "+5561988887777" };
  await m.pedir(url, { metodo: "PUT", cookie, corpo });
  assertEquals(chamada(m, "plataforma_alterar_contato")?.p_aniversario, null);
  await m.pedir(url, { metodo: "PUT", cookie, corpo: { ...corpo, aniversario: { dia: 29, mes: 2 } } });
  assertEquals(chamada(m, "plataforma_alterar_contato")?.p_aniversario, { dia: 29, mes: 2 });
  await m.pedir(url, { metodo: "PUT", cookie, corpo: { ...corpo, aniversario: null } });
  assertEquals(chamada(m, "plataforma_alterar_contato")?.p_aniversario, {});
});

Deno.test("MU-06: familiar sem telefone, com parentesco da lista e aniversário opcional", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/familiares", { corpo: { unidadeId: UNIDADE, nome: "Lucas", parentesco: "FILHO" } })).status, 401);
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/familiares", { cookie, corpo: { nome: "Lucas", parentesco: "FILHO" } }))).detalhes?.campos,
    ["unidadeId"]);
  assertEquals((await erro(await m.pedir("/v1/condominio/familiares", { cookie, corpo: { unidadeId: UNIDADE, nome: "Lucas", parentesco: "IRMAO" } })))
    .detalhes?.campos, ["parentesco"]);
  assertEquals((await m.pedir("/v1/condominio/familiares", { cookie, corpo: { unidadeId: UNIDADE, nome: " Lucas Lima ", parentesco: "FILHO" } })).status, 201);
  assertEquals(chamada(m, "plataforma_salvar_familiar"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_unidade: UNIDADE, p_nome: "Lucas Lima", p_parentesco: "FILHO",
    p_mora: true, p_aniversario: {},
  });
  assertEquals((await erro(await m.pedir(`/v1/condominio/familiares/${FAMILIAR}`, { metodo: "PUT", cookie, corpo: { nome: "Lucas", parentesco: "FILHO" } })))
    .detalhes?.campos, ["versao"]);
  await m.pedir(`/v1/condominio/familiares/${FAMILIAR}`, {
    metodo: "PUT", cookie, corpo: { versao: 1, unidadeId: UNIDADE, nome: "Lucas", parentesco: "FILHO", mora: false, aniversario: { dia: 14, mes: 11 } },
  });
  const a = chamada(m, "plataforma_salvar_familiar");
  assertEquals([a?.p_unidade, a?.p_mora, a?.p_aniversario], [null, false, { dia: 14, mes: 11 }]);
});

Deno.test("MU-06: pet com espécie e porte da lista, raça e observação opcionais", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/pets", { cookie, corpo: { unidadeId: UNIDADE, nome: "Thor", especie: "PEIXE" } }))).detalhes?.campos,
    ["especie"]);
  assertEquals((await m.pedir("/v1/condominio/pets", { cookie, corpo: { unidadeId: UNIDADE, nome: "Thor", especie: "CAO", porte: "MEDIO", raca: " " } })).status,
    201);
  assertEquals(chamada(m, "plataforma_salvar_pet"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_unidade: UNIDADE, p_nome: "Thor", p_especie: "CAO", p_porte: "MEDIO",
    p_raca: null, p_observacao: null,
  });
});

Deno.test("MU-06: retirar familiar ou pet diz se saiu ou se foi engano", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/condominio/pets/${PET}/retirar`, { cookie, corpo: { versao: 1, motivo: "FUGIU" } }))).detalhes?.campos,
    ["motivo"]);
  await m.pedir(`/v1/condominio/pets/${PET}/retirar`, { cookie, corpo: { versao: 1, motivo: "SAIU" } });
  assertEquals(chamada(m, "plataforma_retirar_familia_pet"), { p_pessoa: ANA, p_condominio: AURORA, p_tipo: "PET", p_id: PET, p_versao: 1, p_motivo: "SAIU" });
  await m.pedir(`/v1/condominio/familiares/${FAMILIAR}/retirar`, { cookie, corpo: { versao: 2, motivo: "ENGANO" } });
  assertEquals(chamada(m, "plataforma_retirar_familia_pet")?.p_tipo, "FAMILIAR");
});

Deno.test("MU-11: o histórico filtra por categoria e pagina; os aniversariantes por mês e unidade", async () => {
  const m = montar();
  assertEquals((await m.pedir(`/v1/condominio/unidades/${UNIDADE}/historico`)).status, 401);
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/condominio/unidades/${UNIDADE}/historico?categoria=OUTRA`, { cookie }))).detalhes?.campos, ["categoria"]);
  await m.pedir(`/v1/condominio/unidades/${UNIDADE}/historico?categoria=FAMILIA_PETS&antes=120`, { cookie });
  assertEquals(chamada(m, "plataforma_historico_unidade"), { p_pessoa: ANA, p_condominio: AURORA, p_unidade: UNIDADE, p_categoria: "FAMILIA_PETS", p_antes: 120 });
  await m.pedir(`/v1/condominio/unidades/${UNIDADE}/historico`, { cookie });
  assertEquals(chamada(m, "plataforma_historico_unidade")?.p_categoria, null);
  assertEquals((await erro(await m.pedir("/v1/condominio/aniversariantes?mes=13", { cookie }))).detalhes?.campos, ["mes"]);
  await m.pedir(`/v1/condominio/aniversariantes?mes=11&unidade=${UNIDADE}`, { cookie });
  assertEquals(chamada(m, "plataforma_aniversariantes"), { p_pessoa: ANA, p_condominio: AURORA, p_mes: 11, p_unidade: UNIDADE });
  await m.pedir("/v1/condominio/aniversariantes", { cookie });
  assertEquals(chamada(m, "plataforma_aniversariantes"), { p_pessoa: ANA, p_condominio: AURORA, p_mes: null, p_unidade: null });
});
