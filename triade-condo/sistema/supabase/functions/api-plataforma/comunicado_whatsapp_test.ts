// Comunicado pelo WhatsApp do condomínio (F6.6; CD-02, W-20, W-16) na Plataforma do síndico: o
// comunicado guarda "Vai pelo WhatsApp", a correção pode avisar de novo, o cartão de Configurações
// liga e desliga e a fila manda o link pessoal do comunicado (/c). O aceite, a fila lenta e o
// horário sem envio ficam no banco (033_comunicado_whatsapp_test.sql).
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { contagemDosCanais, minutosDoWhatsapp } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { chaveCredenciais, cifrarCredenciais, type ConectorWhatsapp } from "../_shared/whatsapp.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const IPE = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const COMUNICADO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENVIO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const TEXTO = "Comunicado do Residencial Ipê: Falta de água\n\nLeia o comunicado inteiro no link, que é só seu:\n[link]";

async function montar() {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const chave = await chaveCredenciais(CHAVE);
  const bytea = await cifrarCredenciais(chave, { instancia: "ipe-inst", token: "t-123456789" });
  const credenciais = btoa(String.fromCharCode(...bytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));
  let lotes: unknown[] = [{ condominio: IPE, instancia: "ipe-inst", credenciais,
    envios: [{ envio: ENVIO, para: "+5561999990001", texto: TEXTO, link: "Q7RM4KXPq9TRE2wbN3aZ", rota: "c" }] }];
  const enviados: { para: string; texto: string }[] = [];
  const conector = {
    provedor: "TESTE",
    enviarTexto(_cred: unknown, para: string, texto: string) {
      enviados.push({ para, texto });
      return Promise.resolve({ ok: true, id: "P1" });
    },
  } as unknown as ConectorWhatsapp;
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: IPE, nome: "Residencial Ipê", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), IPE);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    whatsapp_pegar_lote: () => {
      const l = lotes;
      lotes = [];
      return l;
    },
    whatsapp_resultado: () => null,
    whatsapp_midias_pendentes: () => [],
    plataforma_salvar_comunicado: () => ({ id: COMUNICADO, versao: 1 }),
    plataforma_corrigir_comunicado: () => ({ id: COMUNICADO, versao: 1 }),
    plataforma_comunicados_whatsapp: () => ({ ligado: false, versao: 4, conectado: true, contagens: { aceitaram: 0 } }),
    plataforma_definir_comunicados_whatsapp: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_moradores: () => ({ itens: [], total: 0, pagina: 1, porPagina: 50 }),
  });
  const fundo: Promise<unknown>[] = [];
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, aoFundo: (p) => fundo.push(p), whatsapp: { conector, chave },
  });
  return { pedir: pedido(app, "api-plataforma"), enviados, fundo, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: IPE }, cookie });
  return cookie;
}
const chamada = (m: Awaited<ReturnType<typeof montar>>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const BASE = { assunto: "AVISO", titulo: "Falta de água na quinta", texto: "Das 9h às 13h.", publico: "TODOS", acao: "PUBLICAR" };

Deno.test("CD-02: o comunicado guarda se vai pelo WhatsApp, e publicar já começa a fila", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/comunicados", { corpo: { ...BASE, porWhatsapp: false }, cookie })).status, 201);
  assertEquals(chamada(m, "plataforma_salvar_comunicado")?.p_por_whatsapp, false);
  assertEquals(m.fundo.length, 1, "a fila do WhatsApp começa sem esperar o minuto");
  await m.pedir("/v1/condominio/comunicados", { corpo: { ...BASE, acao: "RASCUNHO" }, cookie });
  assertEquals(chamada(m, "plataforma_salvar_comunicado")?.p_por_whatsapp, null, "sem escolha, o banco mantém o que estava");
  assertEquals(m.fundo.length, 1);
  const r = await m.pedir("/v1/condominio/comunicados", { corpo: { ...BASE, porWhatsapp: "sim" }, cookie });
  assertEquals((await erro(r)).codigo, "VALIDATION_ERROR");
});

Deno.test("CD-01: corrigir pode avisar de novo pelo WhatsApp; sem pedir, não avisa", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const corpo = { versao: 3, titulo: "Falta de água na quinta, das 10h", texto: "Das 10h às 14h.", mudanca: "O horário mudou." };
  await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}/corrigir`, { corpo, cookie });
  assertEquals(chamada(m, "plataforma_corrigir_comunicado")?.p_avisar_whatsapp, false);
  assertEquals(m.fundo.length, 0);
  await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}/corrigir`, { corpo: { ...corpo, avisarWhatsapp: true }, cookie });
  assertEquals(chamada(m, "plataforma_corrigir_comunicado")?.p_avisar_whatsapp, true);
  assertEquals(m.fundo.length, 1);
});

Deno.test("CF-11: o cartão de Configurações › WhatsApp liga e desliga, com a versão", async () => {
  const m = await montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/whatsapp/comunicados"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/whatsapp/comunicados", { cookie })).json()).ligado, false);
  const r = await m.pedir("/v1/condominio/whatsapp/comunicados", { metodo: "PUT", corpo: { versao: 4, ligado: true }, cookie });
  assertEquals(await r.json(), { versao: 5 });
  assertEquals(chamada(m, "plataforma_definir_comunicados_whatsapp"), { p_pessoa: ANA, p_condominio: IPE, p_versao: 4, p_ligado: true });
  const sem = await m.pedir("/v1/condominio/whatsapp/comunicados", { metodo: "PUT", corpo: { versao: 4 }, cookie });
  assertEquals((await erro(sem)).codigo, "VALIDATION_ERROR");
});

Deno.test("W-20: a mensagem do comunicado sai com o link pessoal na rota do comunicado", async () => {
  const m = await montar();
  await m.pedir("/v1/interno/fila-whatsapp", { corpo: {} });
  assertEquals(m.enviados[0]!.texto, TEXTO.replace("[link]", "https://plataforma.exemplo/c/Q7RM4KXPq9TRE2wbN3aZ"));
});

Deno.test("MU-01: a lista de contatos filtra quem não recebe comunicado pelo WhatsApp", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/moradores?estado=SEM_WHATSAPP", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_moradores")?.p_estado, "SEM_WHATSAPP");
});

Deno.test("CD-02: a conta de por onde chega segue os canais ligados", () => {
  const p = { contatos: 46, comEmail: 18, comWhatsapp: 21, pelosDois: 11 };
  assertEquals(contagemDosCanais(p, { email: true, whatsapp: true }), { email: 18, whatsapp: 21, pelosDois: 11, nenhum: 18 });
  assertEquals(contagemDosCanais(p, { email: true, whatsapp: false }), { email: 18, whatsapp: 0, pelosDois: 0, nenhum: 28 });
  assertEquals(contagemDosCanais({ contatos: 3, comEmail: 1 }, { email: false, whatsapp: true }).nenhum, 3);
  assertEquals([minutosDoWhatsapp(0), minutosDoWhatsapp(10), minutosDoWhatsapp(21)], [1, 1, 3]);
});

Deno.test("o modelo e as palavras do comunicado são as mesmas do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0284_comunicado_whatsapp.sql", import.meta.url));
  const rodape = "Para parar os comunicados, responda PARAR COMUNICADOS.";
  assertStringIncludes(sql, `'${rodape}'`);
  assert(rodape.length <= 60, "o rodapé cabe nos 60 caracteres da Meta");
  assertStringIncludes(sql, "v_cmd in ('COMUNICADOS', 'PARAR COMUNICADOS')");
  assertStringIncludes(sql, "interval '6 seconds'");
});
