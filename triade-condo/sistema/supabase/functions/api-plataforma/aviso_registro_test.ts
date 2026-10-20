// Aviso de pedido registrado (F6.4, AT-26) na Plataforma do síndico: o registro leva o que quem
// registra escolheu avisar, a prévia de Quem avisar vai ao banco com o que já foi preenchido, a
// regra do síndico tem rota própria e os e-mails do protocolo e do prestador ganham forma aqui.
// As regras de quem é avisado e o que pode sair ficam no banco (029_aviso_pedido_registrado_test.sql).
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { AVISO_NOVO_SINDICO, DESTINOS_AVISO_REGISTRO, MEIOS_AVISO_REGISTRO } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { montarEmail, type MensagemFila } from "../_shared/email.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const OUTRO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ITEM = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENVIO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
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
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_registrar_pedido: () => ({ id: PEDIDO, protocolo: "2026-0153", versao: 2, avisos: [{ destino: "QUEM_PEDIU", meio: "WHATSAPP", situacao: "NA_FILA" }] }),
    plataforma_quem_avisar: () => ({ quemPediu: { marcado: true, meio: "WHATSAPP" } }),
    plataforma_definir_aviso_novo: (a) => Number(a.p_versao) + 1,
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

const NOVO = { local: "Elevador social da Torre B", categoriaId: OUTRO, prioridadeId: OUTRO, assunto: "Elevador parado", descricao: "Entre o 3º e o 4º andar.", canal: "OBSERVACAO" };

Deno.test("AT-26: sem escolha, o registro vai ao banco sem avisar nada a mais", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/pedidos", { corpo: NOVO, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).avisos, [{ destino: "QUEM_PEDIU", meio: "WHATSAPP", situacao: "NA_FILA" }]);
  assertEquals(chamada(m, "plataforma_registrar_pedido")?.p_avisar, null);
});

Deno.test("AT-26: o prestador e os moradores afetados vão junto com o registro (PT-04)", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const avisar = {
    quemPediu: false, sindico: true,
    prestador: { id: ITEM, texto: "  Elevador parado entre o 3º e o 4º andar.  " },
    moradores: { publico: "BLOCOS", blocos: [OUTRO], titulo: "Elevador da Torre B parado", texto: "Use o de serviço." },
  };
  const r = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, avisar }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_registrar_pedido")?.p_avisar, {
    quemPediu: false, sindico: true,
    prestador: { id: ITEM, texto: "Elevador parado entre o 3º e o 4º andar." },
    moradores: { publico: "BLOCOS", blocos: [OUTRO], unidades: [], titulo: "Elevador da Torre B parado", texto: "Use o de serviço." },
  });
});

Deno.test("AT-26: escolha incompleta nem chega ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const sem = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, avisar: { moradores: { publico: "BLOCOS", titulo: "Aviso", texto: "Texto." } } }, cookie });
  assertEquals(sem.status, 400);
  assertEquals((await erro(sem)).detalhes?.campos, ["avisar"]);
  const curto = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, avisar: { prestador: { id: ITEM, texto: "Oi" } } }, cookie });
  assertEquals(curto.status, 400);
  assertEquals(chamada(m, "plataforma_registrar_pedido"), undefined);
});

Deno.test("AT-26: a prévia de Quem avisar vai ao banco com a pessoa da sessão e o que já foi preenchido", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/pedidos/quem-avisar", { corpo: {} }))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  const corpo = { unidadeId: ITEM, contatoId: OUTRO, prioridadeId: OUTRO, privado: false, textoPrestador: "Ligue no (61) 99999-0001", pessoa: OUTRO };
  const r = await m.pedir("/v1/condominio/pedidos/quem-avisar", { corpo, cookie });
  assertEquals(await r.json(), { quemPediu: { marcado: true, meio: "WHATSAPP" } });
  const args = chamada(m, "plataforma_quem_avisar")!;
  assertEquals(args.p_pessoa, ANA);
  assertEquals(args.p_condominio, AURORA);
  assertEquals(args.p_dados, { unidadeId: ITEM, contatoId: OUTRO, prioridadeId: OUTRO, privado: false, textoPrestador: "Ligue no (61) 99999-0001" });
  const ruim = await m.pedir("/v1/condominio/pedidos/quem-avisar", { corpo: { unidadeId: "101" }, cookie });
  assertEquals(ruim.status, 400);
});

Deno.test("AT-26: a regra do síndico e o protocolo, com a versão lida (AT-24)", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/regras-aviso-novo", { metodo: "PUT", corpo: { versao: 4, sindico: "TODOS", protocolo: false }, cookie });
  assertEquals(await r.json(), { versao: 5 });
  assertEquals(chamada(m, "plataforma_definir_aviso_novo"), { p_pessoa: ANA, p_condominio: AURORA, p_versao: 4, p_sindico: "TODOS", p_protocolo: false });
  const ruim = await m.pedir("/v1/condominio/regras-aviso-novo", { metodo: "PUT", corpo: { versao: 4, sindico: "SEMPRE", protocolo: true }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["sindico"]);
});

Deno.test("as listas do aviso de pedido registrado são as mesmas do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0280_aviso_pedido_registrado.sql", import.meta.url));
  const lista = (re: RegExp) => [...sql.match(re)![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
  assertEquals(lista(/aviso_novo_sindico +text not null default '[A-Z_]+'\s+check \(aviso_novo_sindico in \(([^)]*)\)/), Object.keys(AVISO_NOVO_SINDICO));
  assertEquals(lista(/destino +text not null check \(destino in \(([^)]*)\)/), Object.keys(DESTINOS_AVISO_REGISTRO));
  assertEquals(lista(/meio +text not null check \(meio in \(([^)]*)\)/), Object.keys(MEIOS_AVISO_REGISTRO));
});

const END = { urlApp: "https://plataforma.exemplo/", urlFuncao: "https://f.exemplo", remetente: "nao-responda@exemplo.invalid" };
const BASE: MensagemFila = {
  envio: ENVIO, condominio: AURORA, tipo: "PROTOCOLO", para: "rui@exemplo.invalid", condominioNome: "Residencial Aurora",
  responderPara: "sindica@exemplo.invalid", nome: "Rui", codigos: { parar: "codigo-parar" },
  pedido: { protocolo: "2026-0154", prioridade: "normal", assunto: "Interfone mudo", unidade: "Torre A · 102", canal: "por telefone",
            atendimento: "em dias úteis, das 8h às 18h" },
};

Deno.test("W-08: o protocolo por e-mail traz o número, a unidade, como chegou e o que acontece agora", () => {
  const e = montarEmail(BASE, END);
  assertEquals(e.assunto, "[Residencial Aurora] Pedido 2026-0154 registrado");
  assertStringIncludes(e.texto, "Olá, Rui.\n\nRegistramos seu pedido 2026-0154 (Torre A · 102): Interfone mudo.");
  assertStringIncludes(e.texto, "Chegou por telefone.");
  assertStringIncludes(e.texto, "confere os pedidos em dias úteis, das 8h às 18h e dá notícia. Em emergência, ligue 193.");
  assertStringIncludes(e.texto, "Para falar sobre este pedido, responda este e-mail.");
  assertStringIncludes(e.html, "https://plataforma.exemplo/e/parar?c=codigo-parar");
  assertEquals(e.cabecalhos?.["List-Unsubscribe"], "<https://f.exemplo/v1/email/parar/codigo-parar>");
  assertEquals(e.responderPara, "sindica@exemplo.invalid");
});

Deno.test("AT-26: o prestador recebe por e-mail só o texto que quem registrou viu", () => {
  const e = montarEmail({ ...BASE, tipo: "PRESTADOR", para: "contato@hidraulica.invalid", nome: "Hidráulica Lima", codigos: {},
    pedido: { protocolo: "2026-0155", prioridade: "urgente", texto: "Casa de bombas: Bomba vazando.\n\nPara combinar, fale com Gil, do condomínio." } }, END);
  assertEquals(e.assunto, "[Residencial Aurora] Pedido 2026-0155 (urgente)");
  assertEquals(e.texto,
    "Pedido 2026-0155 · urgente\n\nCasa de bombas: Bomba vazando.\n\nPara combinar, fale com Gil, do condomínio.\n\nPara combinar, responda este e-mail.\n\nO condomínio nunca pede pagamento por e-mail.");
  assert(!e.html.includes("Parar de receber"), "aviso ao prestador não é lista de comunicados");
  assertEquals(e.cabecalhos, undefined);
});
