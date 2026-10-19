// Passo 2 na Plataforma do síndico: as rotas validam a entrada, mandam ao banco a pessoa e o
// condomínio da sessão (nunca do navegador) e deixam a permissão para o banco (CF-03).
import { assert, assertEquals } from "@std/assert";
import { FUSOS, PENDENCIAS_CONFIG, PERMISSOES, SITUACOES_ETAPA, TIPOS_HORARIO } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const OUTRO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ITEM = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar(opcoes: { acoes?: string[]; handlers?: Record<string, (a: Record<string, unknown>) => unknown> } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const convites = adminFalso();
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      if (a.p_condominio !== AURORA) erroBanco("TC401");
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_painel: () => ({ condominio: { id: AURORA }, acoes: opcoes.acoes ?? ["pessoas.autorizar"], pendencias: [] }),
    plataforma_configuracoes: () => ({ fuso: "America/Sao_Paulo" }),
    plataforma_definir_horarios: (a) => Number(a.p_versao) + 1,
    plataforma_incluir_feriado: () => ITEM,
    plataforma_salvar_categoria: (a) => ({ id: a.p_id ?? ITEM, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_autorizar_pessoa: () => ITEM,
    plataforma_revogar_pessoa: () => null,
    plataforma_definir_atendimento: (a) => Number(a.p_versao) + 1,
    ...opcoes.handlers,
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: convites.admin, urlApp: "https://plataforma.exemplo", armazenamento: armazenamentoFalso().armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), ...db, ...convites };
}

async function entrar(m: ReturnType<typeof montar>, escolher = true): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  if (escolher) await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("sem sessão ou sem condomínio escolhido, nenhuma rota do passo 2 chega ao banco", async () => {
  const m = montar();
  for (const rota of ["/v1/condominio/painel", "/v1/condominio/configuracoes", "/v1/condominio/pessoas"]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  const cookie = await entrar(m, false);
  assertEquals((await erro(await m.pedir("/v1/condominio/configuracoes", { cookie }))).codigo, "CONDOMINIO_REQUIRED");
  assertEquals(m.chamadas.filter((c) => c.funcao.startsWith("plataforma_")).length, 0);
});

Deno.test("V-08: o condomínio vem da sessão, não do navegador", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/configuracoes?condominio=${OUTRO}`, { cookie });
  assertEquals(chamada(m, "plataforma_configuracoes"), { p_pessoa: ANA, p_condominio: AURORA });
});

Deno.test("CF-10: horários sobrepostos e tipo desconhecido param antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const sobrepostos = [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "11:00", fim: "13:00" }];
  const r = await m.pedir("/v1/condominio/horarios/atendimento", { metodo: "PUT", corpo: { versao: 1, intervalos: sobrepostos }, cookie });
  assertEquals((await erro(r)).codigo, "VALIDATION_ERROR");
  assertEquals((await erro(await m.pedir("/v1/condominio/horarios/plantao", { metodo: "PUT", corpo: { versao: 1, intervalos: [] }, cookie }))).codigo, "NOT_FOUND");
  assertEquals(chamada(m, "plataforma_definir_horarios"), undefined);
  const ok = await m.pedir("/v1/condominio/horarios/atendimento", { metodo: "PUT", corpo: { versao: 1, intervalos: [sobrepostos[0]] }, cookie });
  assertEquals(await ok.json(), { versao: 2 });
  assertEquals(chamada(m, "plataforma_definir_horarios")?.p_tipo, "ATENDIMENTO");
});

Deno.test("CF-10: feriado é data sem hora, conferida no calendário", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/feriados", { corpo: { data: "2026-02-30", descricao: "Errado" }, cookie }))).codigo, "VALIDATION_ERROR");
  const r = await m.pedir("/v1/condominio/feriados", { corpo: { data: "2026-11-20", descricao: "Consciência Negra" }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_incluir_feriado")?.p_data, "2026-11-20");
});

Deno.test("CF-09: POST cria, PUT altera só com a versão lida", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/categorias", { corpo: { nome: " Animais " }, cookie })).status, 201);
  assertEquals(chamada(m, "plataforma_salvar_categoria"), { p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_nome: "Animais", p_ativa: null });
  const sem = await m.pedir(`/v1/condominio/categorias/${ITEM}`, { metodo: "PUT", corpo: { nome: "Animais" }, cookie });
  assertEquals(await erro(sem), { codigo: "VALIDATION_ERROR", detalhes: { campos: ["versao"] } });
  const r = await m.pedir(`/v1/condominio/categorias/${ITEM}`, { metodo: "PUT", corpo: { versao: 3, nome: "Animais", ativa: false }, cookie });
  assertEquals(await r.json(), { id: ITEM, versao: 4 });
});

Deno.test("AT-24: conflito de versão do banco volta com a versão nova", async () => {
  const m = montar({ handlers: { plataforma_definir_atendimento: () => erroBanco("TC409", { versao: 5, atual: {} }) } });
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/atendimento", { metodo: "PUT", corpo: { versao: 4, responsaveis: [], padraoId: null }, cookie });
  assertEquals(r.status, 409);
  assertEquals(await erro(r), { codigo: "VERSION_CONFLICT", detalhes: { versao: 5, atual: {} } });
});

Deno.test("V-09: sem permissão de autorizar, o convite nem sai", async () => {
  const m = montar({ acoes: ["config.ver"] });
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/pessoas", { corpo: { nome: "Bruna", email: "bruna@exemplo.invalid", cargo: "Secretária", permissoes: [] }, cookie });
  assertEquals((await erro(r)).codigo, "FORBIDDEN");
  assertEquals(m.enviados.length, 0);
});

Deno.test("V-09 e CF-03: o síndico convida a pessoa autorizada, com cargo e permissões", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { nome: "Bruna", email: " Bruna@Exemplo.invalid ", cargo: "Secretária", permissoes: ["CONFIGURAR"] };
  const r = await m.pedir("/v1/condominio/pessoas", { corpo, cookie });
  assertEquals(r.status, 201);
  assertEquals(m.enviados, [{ email: "bruna@exemplo.invalid", voltarPara: "https://plataforma.exemplo/convite" }]);
  const args = chamada(m, "plataforma_autorizar_pessoa")!;
  assertEquals([args.p_condominio, args.p_cargo, args.p_permissoes], [AURORA, "Secretária", ["CONFIGURAR"]]);
  assertEquals((await erro(await m.pedir("/v1/condominio/pessoas", { corpo: { ...corpo, permissoes: ["MANDAR"] }, cookie }))).codigo, "VALIDATION_ERROR");
  await m.pedir("/v1/condominio/pessoas", { corpo: { ...corpo, email: "c@exemplo.invalid" }, cookie });
  assertEquals((await erro(await m.pedir("/v1/condominio/pessoas", { corpo: { ...corpo, email: "d@exemplo.invalid" }, cookie }))).codigo, "RATE_LIMITED");
});

Deno.test("CF-05: revogar a padrão leva o substituto ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/pessoas/${ITEM}/revogar`, { corpo: { versao: 2, substitutoId: OUTRO }, cookie });
  assertEquals(r.status, 200);
  assertEquals(chamada(m, "plataforma_revogar_pessoa"), {
    p_pessoa: ANA, p_condominio: AURORA, p_vinculo: ITEM, p_versao: 2, p_substituto: OUTRO, p_deixar_pendente: false,
  });
});

Deno.test("as listas do domínio (permissões, fusos, situações, pendências) são as mesmas do banco", async () => {
  const migration = (await Promise.all(["0070_configuracoes_condominio.sql", "0080_moradores_unidades.sql", "0130_agenda.sql", "0140_manutencao.sql",
    "0150_comunicados_documentos.sql", "0160_mural_email.sql", "0220_vida_reservas.sql", "0230_vida_enquetes.sql", "0240_vida_assembleias.sql"]
    .map((f) => Deno.readTextFile(new URL(`../../migrations/${f}`, import.meta.url))))).join("\n");
  for (const p of Object.keys(PERMISSOES)) assert(migration.includes(`('${p}', '`), p);
  for (const f of Object.keys(FUSOS)) assert(migration.includes(`'${f}'`), f);
  for (const s of [...Object.keys(SITUACOES_ETAPA), ...Object.keys(TIPOS_HORARIO), ...Object.keys(PENDENCIAS_CONFIG)]) {
    assert(migration.includes(`'${s}'`), s);
  }
});
