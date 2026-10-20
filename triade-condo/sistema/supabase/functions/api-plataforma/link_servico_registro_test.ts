// Link do serviço para o prestador avisado no registro (F6.7; MP-09, V-11) na Plataforma do
// síndico: o registro leva o link junto com o prestador, o e-mail ao prestador ganha o botão do
// serviço com o prazo e a fila do WhatsApp manda a página do prestador. As regras (manutenção que
// nasce, prazo contado da saída, reserva) ficam no banco (031_link_servico_registro_test.sql).
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { montarEmail, type MensagemFila } from "../_shared/email.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const OUTRO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const PRESTADOR = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
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
    plataforma_registrar_pedido: () => ({
      id: PEDIDO, protocolo: "2026-0153", versao: 2,
      avisos: [{ destino: "PRESTADOR", meio: "WHATSAPP", situacao: "NA_FILA", link: { situacao: "ESPERANDO_ENVIO", horas: 4 } }],
    }),
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
const LINK = { quando: " Hoje, assim que possível ", comoEntrar: "Portaria da Torre B", valeAte: "2027-03-10", responderHoras: 4, reserva: true };

Deno.test("V-11: o link do serviço vai junto com o prestador, na transação do registro (PT-04)", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const avisar = { prestador: { id: PRESTADOR, texto: "Elevador parado; avaliar e religar.", link: LINK } };
  const r = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, avisar }, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).avisos[0].link, { situacao: "ESPERANDO_ENVIO", horas: 4 });
  assertEquals(chamada(m, "plataforma_registrar_pedido")?.p_avisar, {
    prestador: { id: PRESTADOR, texto: "Elevador parado; avaliar e religar.", link: { ...LINK, quando: "Hoje, assim que possível" } },
  });
});

Deno.test("V-11: link incompleto ou com prazo fora da lista nem chega ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  for (const link of [{ ...LINK, comoEntrar: "" }, { ...LINK, responderHoras: 12 }, { ...LINK, valeAte: "10/03/2027" }]) {
    const r = await m.pedir("/v1/condominio/pedidos", { corpo: { ...NOVO, avisar: { prestador: { id: PRESTADOR, texto: "Elevador parado.", link } } }, cookie });
    assertEquals(r.status, 400);
    assertEquals((await erro(r)).detalhes?.campos, ["avisar"]);
  }
  assertEquals(chamada(m, "plataforma_registrar_pedido"), undefined);
});

const END = { urlApp: "https://plataforma.exemplo/", urlFuncao: "https://f.exemplo", remetente: "nao-responda@exemplo.invalid" };
const BASE: MensagemFila = {
  envio: ENVIO, condominio: AURORA, tipo: "PRESTADOR", para: "contato@hidraulica.invalid", condominioNome: "Residencial Aurora",
  responderPara: "sindica@exemplo.invalid", nome: "Hidráulica Lima", codigos: {},
  pedido: { protocolo: "2026-0155", prioridade: "normal", texto: "Poça embaixo da bomba 2; trocar a vedação.", link: "codigo-do-servico",
            responderAte: "05/03, 13:10", titulo: "Bomba vazando" },
};

Deno.test("V-11: com o link, o e-mail ao prestador traz o texto, o prazo e o botão do serviço", () => {
  const e = montarEmail(BASE, END);
  assertEquals(e.assunto, "[Residencial Aurora] Serviço: Bomba vazando · confirme até 05/03, 13:10");
  assertStringIncludes(e.texto, "Pedido 2026-0155 · normal\n\nPoça embaixo da bomba 2; trocar a vedação.\n\nConfirme até 05/03, 13:10.");
  assertStringIncludes(e.texto, "Ver o serviço e confirmar: https://plataforma.exemplo/p/codigo-do-servico");
  assertStringIncludes(e.html, 'href="https://plataforma.exemplo/p/codigo-do-servico"');
  assertStringIncludes(e.texto, "O link é só para este serviço e não precisa de conta.");
  assertStringIncludes(e.texto, "O condomínio nunca pede pagamento por e-mail.");
  assert(!e.html.includes("Parar de receber"), "o link do serviço não é lista de comunicados");
});

Deno.test("V-11: sem o link, o e-mail ao prestador continua só com o texto (F6.4)", () => {
  const e = montarEmail({ ...BASE, pedido: { protocolo: "2026-0155", prioridade: "normal", texto: "Bomba vazando." } }, END);
  assertEquals(e.assunto, "[Residencial Aurora] Pedido 2026-0155 (normal)");
  assert(!e.texto.includes("/p/"), "sem link");
});

Deno.test("as listas do link do registro são as mesmas do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0282_link_servico_registro.sql", import.meta.url));
  assertStringIncludes(sql, "check (prazo_no_envio in (4, 8, 24, 48))");
  assertStringIncludes(sql, "'RESERVA_SEM_RESPOSTA', 'SEM_RESPOSTA'");
});
