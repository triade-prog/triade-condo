// Passo 4 na Plataforma do síndico: pedidos no painel. As rotas validam a entrada, mandam ao
// banco a pessoa e o condomínio da sessão, a versão lida (AT-24) e deixam a permissão para o banco.
import { assert, assertEquals } from "@std/assert";
import { CANAIS_PEDIDO, MEIOS_RETORNO, TIPOS_PENDENCIA } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const OUTRO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ITEM = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
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
    plataforma_pedidos: () => ({ itens: [], total: 0 }),
    plataforma_registrar_pedido: () => ({ id: PEDIDO, protocolo: "2026-0001", versao: 1 }),
    plataforma_registrar_retorno: (a) => ({ versao: Number(a.p_versao) + 1, proximoRetorno: "2026-10-18T12:00:00Z" }),
    plataforma_concluir_pedido: (a) => ({ versao: Number(a.p_versao) + 1, estado: "ENCERRADO" }),
    plataforma_resolver_pendencia: (a) => ({ versao: Number(a.p_versao) + 1 }),
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

const NOVO = {
  unidadeId: ITEM,
  categoriaId: OUTRO,
  prioridadeId: OUTRO,
  assunto: "Vazamento no banheiro",
  descricao: "A moradora ligou: mancha no teto.",
  canal: "TELEFONE",
};

Deno.test("PT-01: a fila só com sessão, e o condomínio vem dela", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/pedidos"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/pedidos?condominio=${OUTRO}`, { cookie });
  const args = chamada(m, "plataforma_pedidos")!;
  assertEquals(args.p_condominio, AURORA);
  assertEquals(args.p_situacao, null);
  assertEquals(args.p_pagina, 1);
});

Deno.test("AT-02: filtros da fila validados antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/pedidos?situacao=EM_REVISAO&responsavel=EU&atencao=RETORNO_VENCIDO&busca=0001&pagina=2`, { cookie });
  const args = chamada(m, "plataforma_pedidos")!;
  assertEquals([args.p_situacao, args.p_responsavel, args.p_atencao, args.p_busca, args.p_pagina], ["EM_REVISAO", "EU", "RETORNO_VENCIDO", "0001", 2]);
  const r = await m.pedir("/v1/condominio/pedidos?situacao=PERDIDO", { cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["situacao"]);
});

Deno.test("AT-01: registrar pedido manda a pessoa da sessão, não a do corpo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, criadoPor: OUTRO }, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).protocolo, "2026-0001");
  const args = chamada(m, "plataforma_registrar_pedido")!;
  assertEquals(args.p_pessoa, ANA);
  assertEquals(args.p_privado, false);
  assertEquals(args.p_responsavel, null);
  assert(!("criadoPor" in args));
});

Deno.test("AT-01: sem unidade nem local, nem chega ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, unidadeId: null }, cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["unidadeId", "local"]);
  assertEquals(chamada(m, "plataforma_registrar_pedido"), undefined);
});

Deno.test("AT-06: retorno ao morador com a versão lida e o meio", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/retornos`, { corpo: { versao: 3, meio: "TELEFONE", texto: "Avisei a moradora." }, cookie });
  assertEquals((await r.json()).versao, 4);
  assertEquals(chamada(m, "plataforma_registrar_retorno"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_versao: 3, p_meio: "TELEFONE", p_texto: "Avisei a moradora.",
  });
});

Deno.test("AT-24: ação sem versão é recusada antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/concluir`, { corpo: { etapaId: ITEM, explicacao: "Trocamos o cano do banheiro." }, cookie });
  assertEquals((await erro(r)).detalhes?.campos, ["versao"]);
  assertEquals(chamada(m, "plataforma_concluir_pedido"), undefined);
});

Deno.test("AT-24: o conflito do banco vira VERSION_CONFLICT com a versão atual", async () => {
  const m = montar({
    plataforma_anotar_pedido: () => {
      erroBanco("TC409", { versao: 5, atual: { id: PEDIDO } });
    },
  });
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/notas`, { corpo: { versao: 4, texto: "Cobrei o encanador." }, cookie });
  assertEquals(r.status, 409);
  assertEquals((await erro(r)).codigo, "VERSION_CONFLICT");
});

Deno.test("AT-14: devolver na revisão exige motivo; aprovar não", async () => {
  const m = montar({ plataforma_revisar_pedido: (a) => ({ versao: Number(a.p_versao) + 1 }) });
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/revisar`, { corpo: { versao: 2, aprovar: false }, cookie });
  assertEquals((await erro(r)).detalhes?.campos, ["motivo"]);
  const ok = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/revisar`, { corpo: { versao: 2, aprovar: true }, cookie });
  assertEquals((await ok.json()).versao, 3);
  assertEquals(chamada(m, "plataforma_revisar_pedido")!.p_motivo, null);
});

Deno.test("AT-11: resolver pendência leva o pedido e a pendência da rota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/pendencias/${ITEM}/resolver`, { corpo: { versao: 7, resolucao: "Encanador confirmado" }, cookie });
  assertEquals(chamada(m, "plataforma_resolver_pendencia"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_versao: 7, p_pendencia: ITEM, p_resolucao: "Encanador confirmado",
  });
});

Deno.test("id fora do formato responde como não encontrado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/pedidos/abc/cancelar", { corpo: { versao: 1, motivo: "Engano" }, cookie });
  assertEquals(r.status, 404);
});

Deno.test("os códigos do domínio são os mesmos do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0090_pedidos.sql", import.meta.url));
  const lista = (re: RegExp) => [...sql.match(re)![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
  assertEquals(lista(/canal +text not null check \(canal in \(([^)]*)\)/), Object.keys(CANAIS_PEDIDO));
  assertEquals(lista(/meio +text check \(meio in \(([^)]*)\)/), Object.keys(MEIOS_RETORNO));
  assertEquals(lista(/tipo +text not null check \(tipo in \(('FORNECEDOR'[^)]*)\)/), Object.keys(TIPOS_PENDENCIA));
});

Deno.test("AT-01 (D4.20, decisão A.2): registrar com as mensagens do WhatsApp é uma chamada só ao banco", async () => {
  let juntar = true;
  const m = montar({
    plataforma_registrar_pedido_whatsapp: () => (juntar ? { id: PEDIDO, protocolo: "2026-0001", versao: 1, juntou: true } : erroBanco("TC404")),
  });
  const cookie = await entrar(m);
  const { canal: _, ...semCanal } = NOVO;
  const r = await m.pedir("/v1/condominio/pedidos", { corpo: { ...semCanal, mensagemId: ITEM }, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).juntou, true);
  assertEquals(chamada(m, "plataforma_registrar_pedido_whatsapp"), {
    p_pessoa: ANA, p_condominio: AURORA, p_mensagem: ITEM, p_unidade: ITEM, p_contato: null, p_local: null, p_categoria: OUTRO,
    p_prioridade: OUTRO, p_assunto: "Vazamento no banheiro", p_descricao: "A moradora ligou: mancha no teto.", p_privado: false,
    p_responsavel: null, p_avisar: null,
  });
  assertEquals(chamada(m, "plataforma_registrar_pedido"), undefined);
  assertEquals(chamada(m, "plataforma_triar_whatsapp"), undefined);
  juntar = false;
  const s = await m.pedir("/v1/condominio/pedidos", { corpo: { ...semCanal, mensagemId: ITEM }, cookie });
  assertEquals(s.status, 404);
  const sem = montar();
  const semCookie = await entrar(sem);
  assertEquals((await erro(await sem.pedir("/v1/condominio/pedidos", { corpo: semCanal, cookie: semCookie }))).detalhes?.campos, ["canal"]);
  assertEquals("juntou" in (await (await sem.pedir("/v1/condominio/pedidos", { corpo: NOVO, cookie: semCookie })).json()), false);
  assertEquals(chamada(sem, "plataforma_registrar_pedido_whatsapp"), undefined);
});

Deno.test("AT-02 (D4.2, decisão A.1): a ordem da fila fica guardada na pessoa", async () => {
  const m = montar({ plataforma_ordem_pedidos: (a) => ({ ordem: a.p_ordem }) });
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/pedidos/ordem", { metodo: "PUT", corpo: { ordem: "RECENTES" }, cookie });
  assertEquals([r.status, await r.json()], [200, { ordem: "RECENTES" }]);
  assertEquals(chamada(m, "plataforma_ordem_pedidos"), { p_pessoa: ANA, p_condominio: AURORA, p_ordem: "RECENTES" });
  const x = await m.pedir("/v1/condominio/pedidos/ordem", { metodo: "PUT", corpo: { ordem: "ALFABETICA" }, cookie });
  assertEquals((await erro(x)).detalhes?.campos, ["ordem"]);
});
