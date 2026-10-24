// Passo 1 no Console TRÍADE: as rotas validam a entrada, deixam a permissão para o banco
// (PI-10) e só convidam pelo Auth depois de o banco confirmar quem pode (CF-02).
import { assert, assertEquals } from "@std/assert";
import { CENARIOS, FUNCOES_CONSOLE, SITUACOES, UFS } from "@triade/domain";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido, TOKEN_CONVITE } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar(opcoes: { permissoes?: string[]; contas?: Record<string, string>; handlers?: Record<string, (a: Record<string, unknown>) => unknown> } = {}) {
  const falso = authFalso([
    { id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha },
    { id: "9f0a1b2c-3d4e-4f50-8a6b-7c8d9e0f1a2b", email: "convidada@exemplo.invalid", senha: "x", emailVerificado: false },
  ]);
  const convites = adminFalso(opcoes.contas);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_ficha: () => ({ condominio: { id: IPE }, permissoes: opcoes.permissoes ?? ["console.ficha.ver", "console.sindicos.convidar"] }),
    console_vincular_sindico: () => "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9",
    console_criar_condominio: () => IPE,
    console_carteira: () => [{
      condominio_id: IPE, nome: "Residencial Ipê", cidade: "Brasília", uf: "DF", estagio: "IMPLANTACAO", cenario: null,
      funcoes: ["ADMINISTRACAO"], situacoes: ["SEM_SINDICO"], criado_em: "2026-10-16T10:00:00Z",
    }],
    console_editar_ficha: (a) => Number(a.p_versao) + 1,
    console_equipe: () => [],
    console_cadastrar_membro: () => null,
    ...opcoes.handlers,
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: convites.admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
  });
  return { pedir: pedido(app, "api-console"), ...falso, ...db, ...convites };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}

Deno.test("nenhuma rota do passo 1 responde sem a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/clientes", `/v1/clientes/${IPE}`, "/v1/equipe", "/v1/equipe/historico"]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals(m.chamadas.filter((c) => c.funcao.startsWith("console_")).length, 0);
});

Deno.test("PI-01: a carteira vem do banco, com estágio e situações a tratar", async () => {
  const m = montar();
  const r = await m.pedir("/v1/clientes", { cookie: await entrar(m) });
  const { clientes } = await r.json();
  assertEquals(clientes[0], {
    id: IPE, nome: "Residencial Ipê", cidade: "Brasília", uf: "DF", estagio: "IMPLANTACAO", cenario: null,
    funcoes: ["ADMINISTRACAO"], situacoes: ["SEM_SINDICO"], criadoEm: "2026-10-16T10:00:00Z",
  });
  assertEquals(m.chamadas.find((c) => c.funcao === "console_carteira")?.args, { p_pessoa: CAROLINA });
});

Deno.test("cadastrar condomínio: entrada validada antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const ruim = await m.pedir("/v1/clientes", { corpo: { nome: "Residencial Ipê", cidade: "Brasília", uf: "XX" }, cookie });
  assertEquals(await erro(ruim), { codigo: "VALIDATION_ERROR", detalhes: { campos: ["uf"] } });
  assertEquals(m.chamadas.filter((c) => c.funcao === "console_criar_condominio").length, 0);
  const ok = await m.pedir("/v1/clientes", { corpo: { nome: " Residencial Ipê ", cidade: "Brasília", uf: "DF", cenario: "SEM_PORTARIA" }, cookie });
  assertEquals(ok.status, 201);
  assertEquals(m.chamadas.find((c) => c.funcao === "console_criar_condominio")?.args, {
    p_pessoa: CAROLINA, p_nome: "Residencial Ipê", p_cidade: "Brasília", p_uf: "DF", p_cenario: "SEM_PORTARIA",
  });
});

Deno.test("id de cliente fora do formato responde como não encontrado", async () => {
  const m = montar();
  const r = await m.pedir("/v1/clientes/nao-e-um-id", { cookie: await entrar(m) });
  assertEquals(r.status, 404);
});

Deno.test("CF-01: a ficha vai com telefone no formato internacional", async () => {
  const m = montar();
  const r = await m.pedir(`/v1/clientes/${IPE}/ficha`, {
    metodo: "PUT",
    cookie: await entrar(m),
    corpo: { versao: 1, nome: "Residencial Ipê", cidade: "Brasília", uf: "DF", numeroWhatsapp: "(61) 99999-0001",
             contatos: [{ nome: "Ana", papel: "Síndica", telefone: "61 98888 0000" }] },
  });
  assertEquals(await r.json(), { versao: 2 });
  const args = m.chamadas.find((c) => c.funcao === "console_editar_ficha")!.args;
  assertEquals(args.p_numero_whatsapp, "+5561999990001");
  assertEquals(args.p_contatos, [{ nome: "Ana", papel: "Síndica", telefone: "+5561988880000" }]);
  assertEquals(args.p_endereco, null);
});

Deno.test("AT-24 e W-01: conflito e número repetido chegam com os detalhes do banco", async () => {
  const m = montar({
    handlers: {
      console_editar_ficha: (a) => a.p_versao === 1
        ? erroBanco("TC409", { versao: 3, atual: { nome: "Outro" } })
        : erroBanco("TC422", { campos: ["numeroWhatsapp"] }),
    },
  });
  const cookie = await entrar(m);
  const corpo = { nome: "Residencial Ipê", cidade: "Brasília", uf: "DF", contatos: [] };
  const conflito = await m.pedir(`/v1/clientes/${IPE}/ficha`, { metodo: "PUT", cookie, corpo: { ...corpo, versao: 1 } });
  assertEquals(conflito.status, 409);
  assertEquals(await erro(conflito), { codigo: "VERSION_CONFLICT", detalhes: { versao: 3, atual: { nome: "Outro" } } });
  const repetido = await m.pedir(`/v1/clientes/${IPE}/ficha`, { metodo: "PUT", cookie, corpo: { ...corpo, versao: 2 } });
  assertEquals(await erro(repetido), { codigo: "VALIDATION_ERROR", detalhes: { campos: ["numeroWhatsapp"] } });
});

Deno.test("PI-01: ativo não volta para implantação (transição proibida)", async () => {
  const m = montar({ handlers: { console_mudar_estagio: () => erroBanco("TC023") } });
  const r = await m.pedir(`/v1/clientes/${IPE}/estagio`, { metodo: "PUT", cookie: await entrar(m), corpo: { versao: 3, estagio: "IMPLANTACAO" } });
  assertEquals(r.status, 409);
  assertEquals((await erro(r)).codigo, "INVALID_TRANSITION");
});

Deno.test("CF-02: convite do síndico cria a conta e manda o link para a Plataforma", async () => {
  const m = montar();
  const r = await m.pedir(`/v1/clientes/${IPE}/sindicos`, { cookie: await entrar(m), corpo: { nome: "Ana Souza", email: "Ana@Exemplo.invalid" } });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).contaNova, true);
  assertEquals(m.enviados, [{ email: "ana@exemplo.invalid", voltarPara: "https://plataforma.exemplo/convite" }]);
  const args = m.chamadas.find((c) => c.funcao === "console_vincular_sindico")!.args;
  assertEquals(args.p_convidado, m.contas["ana@exemplo.invalid"]);
  assertEquals(args.p_nome, "Ana Souza");
  assert(!JSON.stringify(m.chamadas.map((c) => c.args)).includes("ana@exemplo.invalid"), "o e-mail não vai para o banco");
});

Deno.test("MU-04: síndico que já tem conta não recebe e-mail novo, só o vínculo", async () => {
  const m = montar({ contas: { "ana@exemplo.invalid": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d" } });
  const r = await m.pedir(`/v1/clientes/${IPE}/sindicos`, { cookie: await entrar(m), corpo: { nome: "Ana", email: "ana@exemplo.invalid" } });
  assertEquals((await r.json()).contaNova, false);
  assertEquals(m.enviados, []);
});

Deno.test("PI-10: sem a permissão de convidar, nenhum convite sai", async () => {
  const m = montar({ permissoes: ["console.ficha.ver"] });
  const r = await m.pedir(`/v1/clientes/${IPE}/sindicos`, { cookie: await entrar(m), corpo: { nome: "Ana", email: "ana@exemplo.invalid" } });
  assertEquals(r.status, 403);
  assertEquals(m.enviados, []);
});

Deno.test("PI-10: cliente não atribuído não chega nem ao convite", async () => {
  const m = montar({ handlers: { console_ficha: () => erroBanco("TC401") } });
  const r = await m.pedir(`/v1/clientes/${IPE}/sindicos`, { cookie: await entrar(m), corpo: { nome: "Ana", email: "ana@exemplo.invalid" } });
  assertEquals((await erro(r)).codigo, "FORBIDDEN");
  assertEquals(m.enviados, []);
});

Deno.test("convites têm limite por pessoa da equipe", async () => {
  const m = montar();
  const cookie = await entrar(m);
  for (const n of [1, 2]) {
    assertEquals((await m.pedir(`/v1/clientes/${IPE}/sindicos`, { cookie, corpo: { nome: "P", email: `p${n}@exemplo.invalid` } })).status, 201);
  }
  const r = await m.pedir(`/v1/clientes/${IPE}/sindicos`, { cookie, corpo: { nome: "P", email: "p3@exemplo.invalid" } });
  assertEquals((await erro(r)).codigo, "RATE_LIMITED");
  assertEquals(m.enviados.length, 2);
});

Deno.test("PI-10: equipe nova recebe o convite para o Console, depois de o banco conferir a administração", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/equipe", { cookie, corpo: { nome: "Inês", email: "ines@triade.exemplo", funcoes: ["IMPLANTACAO"] } });
  assertEquals(r.status, 201);
  assertEquals(m.enviados, [{ email: "ines@triade.exemplo", voltarPara: "https://console.exemplo/convite" }]);
  const ordem = m.chamadas.map((c) => c.funcao).filter((f) => f.startsWith("console_"));
  assertEquals(ordem, ["console_equipe", "console_cadastrar_membro"]);

  const sem = montar({ handlers: { console_equipe: () => erroBanco("TC401") } });
  const negado = await sem.pedir("/v1/equipe", { cookie: await entrar(sem), corpo: { nome: "X", email: "x@triade.exemplo", funcoes: ["SUPORTE"] } });
  assertEquals((await erro(negado)).codigo, "FORBIDDEN");
  assertEquals(sem.enviados, []);
});

Deno.test("PI-12: o histórico da equipe diz de quem o evento fala, com o nome que o banco leu na hora", async () => {
  const OLGA = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
  const linha = { ocorrido_em: "2026-10-24T13:00:00Z", autor_id: CAROLINA, autor_nome: "Carolina", dados: {} };
  const m = montar({
    handlers: {
      console_historico_equipe: () => [
        { ...linha, id: 3, acao: "equipe.membro_desativado", entidade: "pessoa", entidade_id: OLGA, alvo_nome: "Olga Lima" },
        { ...linha, id: 2, acao: "equipe.membro_cadastrado", entidade: "pessoa", entidade_id: OLGA, alvo_nome: null },
        { ...linha, id: 1, acao: "equipe.atribuida", entidade: "vinculo", entidade_id: IPE, alvo_nome: null },
      ],
    },
  });
  const { eventos } = await (await m.pedir("/v1/equipe/historico?limite=10", { cookie: await entrar(m) })).json();
  assertEquals(eventos[0], {
    id: 3, ocorridoEm: "2026-10-24T13:00:00Z", autor: { id: CAROLINA, nome: "Carolina" }, acao: "equipe.membro_desativado",
    entidade: "pessoa", entidadeId: OLGA, dados: {}, alvo: { id: OLGA, nome: "Olga Lima" },
  });
  assertEquals(eventos.map((e: { alvo: unknown }) => e.alvo), [{ id: OLGA, nome: "Olga Lima" }, null, null]);
  assertEquals(m.chamadas.find((c) => c.funcao === "console_historico_equipe")?.args, { p_pessoa: CAROLINA, p_antes: null, p_limite: 10 });
});

Deno.test("D4.28: a lista de Implantações passa a vencida e a configuração como o banco mandou", async () => {
  const item = {
    condominioId: IPE, nome: "Residencial Ipê", iniciada: true, vencidas: 1,
    vencida: { id: "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9", texto: "Síndica enviar a planilha", comQuem: "CLIENTE", responsavel: "Inês", etapa: 6,
               proximoRetorno: "2026-10-21" },
    configuracao: { conferidas: 2, total: 11 },
  };
  const m = montar({ handlers: { console_implantacoes: () => [item] } });
  assertEquals(await (await m.pedir("/v1/implantacoes", { cookie: await entrar(m) })).json(), { implantacoes: [item] });
});

Deno.test("CF-02: quem foi convidado cria a senha pelo link de uso único", async () => {
  const m = montar();
  const r = await m.pedir("/v1/auth/criar-senha", { corpo: { tokenHash: TOKEN_CONVITE, novaSenha: "senha-nova-bem-forte" } });
  assertEquals(r.status, 200);
  assert(m.acessos().includes("acesso.convite_aceito"));
  const deNovo = await m.pedir("/v1/auth/criar-senha", { corpo: { tokenHash: TOKEN_CONVITE, novaSenha: "senha-nova-bem-forte" } });
  assertEquals((await erro(deNovo)).codigo, "TOKEN_INVALID");
});

Deno.test("as listas do domínio (cenários, funções, situações, UFs) são as mesmas do banco", async () => {
  const migration = await Deno.readTextFile(new URL("../../migrations/0060_console_clientes.sql", import.meta.url)) +
    await Deno.readTextFile(new URL("../../migrations/0190_implantacao_suporte.sql", import.meta.url)) +
    await Deno.readTextFile(new URL("../../migrations/0291_planos_cobranca.sql", import.meta.url));
  for (const c of Object.keys(CENARIOS)) assert(migration.includes(`('${c}', '`), c);
  for (const f of Object.keys(FUNCOES_CONSOLE)) assert(migration.includes(`('${f}', '`), f);
  for (const s of Object.keys(SITUACOES)) assert(migration.includes(`'${s}'`), s);
  for (const uf of UFS) assert(migration.includes(`'${uf}'`), uf);
});
