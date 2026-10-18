// Peça R4 no Console (PI-04, PI-05, CT-01, PI-09, PI-11, PI-20): as rotas validam a entrada e
// deixam a permissão para o banco. A troca só convida depois de o banco confirmar quem pode; o
// suporte de acesso manda o link só ao e-mail cadastrado e desfaz o pedido se o envio falhar.
import { assert, assertEquals } from "@std/assert";
import { AREAS_CHAMADO, AREAS_EXCEPCIONAIS, CANAIS_SUPORTE, SITUACOES_CHAMADO, TIPOS_CHAMADO, TIPOS_SUPORTE_ACESSO } from "@triade/domain";
import { criarApiConsole } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const BRUNA = "3e0f6c31-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const PEDIDO = "4f1a7d42-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const VINCULO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const CHAMADO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ARQUIVO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar(opcoes: { permissoes?: string[]; handlers?: Record<string, (a: Record<string, unknown>) => unknown> } = {}) {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const convites = adminFalso({ "bruna@exemplo.com.br": BRUNA });
  const suporte = armazenamentoFalso();
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_contagens: () => ({ carteira: 1, implantacoes: 1, chamados: 0, suporteAcesso: 1 }),
    console_implantacoes: () => [],
    console_implantacao: () => ({ legado: false }),
    console_salvar_etapa: (a) => Number(a.p_versao) + 1,
    console_salvar_pendencia: () => ({ id: PEDIDO, versao: 1 }),
    console_resolver_pendencia: () => 2,
    console_entregar_implantacao: () => 2,
    console_ficha: () => ({ condominio: { id: IPE }, permissoes: opcoes.permissoes ?? ["console.ficha.ver", "console.troca.fazer"] }),
    console_trocar_sindico: () => ({ trocaId: PEDIDO, vinculoId: VINCULO, autorizados: [] }),
    console_suporte_acesso: () => ({ id: PEDIDO, pessoaId: BRUNA, situacao: "ABERTO" }),
    console_decidir_suporte_acesso: (a) => ({
      situacao: { ENVIAR: "ENVIADO", TIRAR_AUTENTICADOR: "AUTENTICADOR_TIRADO", DUVIDOSO: "DUVIDOSO", RECUSAR: "RECUSADO" }[String(a.p_decisao)],
      pessoaId: BRUNA, versao: 3,
    }),
    console_falha_suporte_acesso: () => null,
    console_ler_excepcional: () => ({ acessoId: PEDIDO, validoAte: "2026-10-19T10:00:00Z" }),
    plataforma_pedidos: () => ({ pedidos: [] }),
    console_chamados: () => [],
    console_abrir_arquivo_chamado: () => ({ caminho: `${IPE}/${CHAMADO}/${ARQUIVO}`, nome: "print.png", tipo: "image/png" }),
    ...opcoes.handlers,
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: convites.admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    armazenamentoSuporte: suporte.armazenamento,
  });
  return { pedir: pedido(app, "api-console"), ...falso, ...db, ...convites, suporte };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("as rotas da peça R4 pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/contagens", "/v1/implantacoes", "/v1/suporte-acesso", "/v1/chamados", `/v1/clientes/${IPE}/implantacao`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
});

Deno.test("PI-04: etapa e pendência vão inteiras; realizada pede o que foi feito", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/clientes/${IPE}/implantacao/etapas/4`, { cookie, metodo: "PUT", corpo: { versao: 1, situacao: "REALIZADA" } });
  assertEquals((await erro(r)).codigo, "VALIDATION_ERROR");
  await m.pedir(`/v1/clientes/${IPE}/implantacao/etapas/5`, {
    cookie, metodo: "PUT", corpo: { versao: 1, situacao: "REALIZADA", feito: "Apresentado.", modalidade: "VIDEO", quando: "2026-10-22" },
  });
  assertEquals(chamada(m, "console_salvar_etapa"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_numero: 5, p_versao: 1, p_situacao: "REALIZADA", p_responsavel: null, p_substituto: null,
    p_feito: "Apresentado.", p_motivo: null, p_modalidade: "VIDEO", p_quando: "2026-10-22",
  });
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/implantacao/etapas/x`, { cookie, metodo: "PUT", corpo: { versao: 1, situacao: "PENDENTE" } })).status, 404);
  const p = { texto: "Pedir o AVCB", comQuem: "EQUIPE", responsavelId: CAROLINA, proximoRetorno: "2026-10-28", etapa: 3 };
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/implantacao/pendencias`, { cookie, corpo: p })).status, 201);
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/implantacao/pendencias/${PEDIDO}`, { cookie, metodo: "PUT", corpo: p })).status, 400);
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/implantacao/entregar`, { cookie, corpo: { versao: 1, recado: "Pronto." } })).status, 200);
});

Deno.test("CT-01: a troca só convida depois de o banco confirmar a permissão", async () => {
  const corpo = {
    vinculoId: VINCULO, versao: 1, pedidoPor: "Conselheira Rita", canal: "WHATSAPP", conferido: ["Ata da AGE"], nome: "Marcos", email: "marcos@exemplo.com.br",
  };
  const sem = montar({ permissoes: ["console.ficha.ver"] });
  assertEquals((await erro(await sem.pedir(`/v1/clientes/${IPE}/troca-sindico`, { cookie: await entrar(sem), corpo }))).codigo, "FORBIDDEN");
  assertEquals(sem.enviados.length, 0);
  const m = montar();
  const r = await m.pedir(`/v1/clientes/${IPE}/troca-sindico`, { cookie: await entrar(m), corpo });
  assertEquals(r.status, 201);
  assertEquals(m.enviados.map((e) => e.voltarPara), ["https://plataforma.exemplo/convite"]);
  assertEquals(chamada(m, "console_trocar_sindico")?.p_conferido, ["Ata da AGE"]);
  assertEquals(chamada(m, "console_trocar_sindico")?.p_novo, m.contas["marcos@exemplo.com.br"]);
});

Deno.test("PI-09: o e-mail aparece mascarado e o link vai só para ele", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const d = await (await m.pedir(`/v1/clientes/${IPE}/suporte-acesso/${PEDIDO}`, { cookie })).json();
  assertEquals(d.emailMascarado, "b••••@exemplo.com.br");
  assert(!JSON.stringify(d).includes("bruna@"));
  const r = await m.pedir(`/v1/clientes/${IPE}/suporte-acesso/${PEDIDO}/decidir`, { cookie, corpo: { versao: 2, decisao: "ENVIAR" } });
  assertEquals((await r.json()).situacao, "ENVIADO");
  assertEquals(m.recuperacoes, ["bruna@exemplo.com.br"]);
  await m.pedir(`/v1/clientes/${IPE}/suporte-acesso/${PEDIDO}/decidir`, { cookie, corpo: { versao: 2, decisao: "TIRAR_AUTENTICADOR" } });
  assertEquals(m.autenticadoresTirados, [BRUNA]);
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/suporte-acesso/${PEDIDO}/decidir`, { cookie, corpo: { versao: 2, decisao: "RECUSAR" } })).status, 400);
});

Deno.test("PI-09: envio que falha volta o pedido para verificação", async () => {
  const m = montar({ handlers: { console_suporte_acesso: () => ({}) } });
  m.admin.emailDe = () => Promise.reject(new Error("Auth fora do ar"));
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/clientes/${IPE}/suporte-acesso/${PEDIDO}/decidir`, { cookie, corpo: { versao: 2, decisao: "ENVIAR" } });
  assertEquals(r.status, 500);
  assertEquals(chamada(m, "console_falha_suporte_acesso"), { p_pessoa: CAROLINA, p_condominio: IPE, p_id: PEDIDO });
});

Deno.test("PI-11: a leitura passa pelo registro antes de abrir a área, só leitura", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await (await m.pedir(`/v1/clientes/${IPE}/excepcional/pedidos?busca=limpeza`, { cookie })).json();
  assertEquals(r.area, "PEDIDOS");
  const ordem = m.chamadas.map((c) => c.funcao).filter((f) => f === "console_ler_excepcional" || f === "plataforma_pedidos");
  assertEquals(ordem, ["console_ler_excepcional", "plataforma_pedidos"]);
  assertEquals(chamada(m, "plataforma_pedidos")?.p_busca, "limpeza");
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/excepcional/financeiro`, { cookie })).status, 404);
  const sem = montar({ handlers: { console_ler_excepcional: () => erroBanco("TC401") } });
  assertEquals((await sem.pedir(`/v1/clientes/${IPE}/excepcional/pedidos`, { cookie: await entrar(sem) })).status, 403);
  assertEquals(sem.chamadas.filter((c) => c.funcao === "plataforma_pedidos").length, 0);
});

Deno.test("PI-20: fila com filtro conhecido; imagem por link curto", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/chamados?filtro=QUALQUER", { cookie })).status, 400);
  await m.pedir("/v1/chamados?filtro=RESOLVIDOS", { cookie });
  assertEquals(chamada(m, "console_chamados")?.p_filtro, "RESOLVIDOS");
  const l = await (await m.pedir(`/v1/clientes/${IPE}/chamados/${CHAMADO}/imagens/${ARQUIVO}/link`, { cookie })).json();
  assert(l.url.includes(`${IPE}/${CHAMADO}/${ARQUIVO}`));
  assertEquals(m.suporte.links.at(-1)?.segundos, 300);
});

Deno.test("as listas da peça R4 no domínio são as mesmas do banco", async () => {
  const migration = await Deno.readTextFile(new URL("../../migrations/0190_implantacao_suporte.sql", import.meta.url));
  for (const lista of [AREAS_CHAMADO, AREAS_EXCEPCIONAIS, CANAIS_SUPORTE, SITUACOES_CHAMADO, TIPOS_CHAMADO, TIPOS_SUPORTE_ACESSO]) {
    for (const k of Object.keys(lista)) assert(migration.includes(`'${k}'`), k);
  }
});
