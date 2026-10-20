// Pedidos relacionados (AT-18) e decisões pedidas ao síndico (AT-23), base dos dois indicadores
// da F7.4 (TR-01). As rotas validam a entrada e mandam ao banco a pessoa e o condomínio da sessão;
// quem pode ligar, pedir e responder é decidido no banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const PEDIDO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ANTIGO = "5a2b8e5d-0c6f-4b7a-8d3e-6f7a8b9c0d1e";
const LIGACAO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const DECISAO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const GIL = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
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
    plataforma_ligar_pedidos: (a) => ({ versao: Number(a.p_versao) + 1, id: LIGACAO }),
    plataforma_desfazer_ligacao: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_descartar_parecido: () => null,
    plataforma_definir_parecidos: (a) => Number(a.p_versao) + 1,
    plataforma_pedir_decisao: (a) => ({ versao: Number(a.p_versao) + 1, id: DECISAO }),
    plataforma_decisoes: (a) => ({ decisoes: [], aguardandoEu: 0, filtro: a.p_filtro, pode: { aprovar: true } }),
    plataforma_responder_decisao: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_retirar_decisao: (a) => ({ versao: Number(a.p_versao) + 1 }),
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

Deno.test("AT-18: ligar pedidos só com sessão, com a versão lida e o motivo", async () => {
  const m = montar();
  const corpo = { versao: 3, outroId: ANTIGO, tipo: "REINCIDENCIA", motivo: "Voltou a pingar na vaga 31" };
  assertEquals((await erro(await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/ligacoes`, { corpo }))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/ligacoes`, { corpo, cookie })).json(), { versao: 4, id: LIGACAO });
  assertEquals(chamada(m, "plataforma_ligar_pedidos"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_versao: 3, p_outro: ANTIGO, p_tipo: "REINCIDENCIA",
    p_motivo: "Voltou a pingar na vaga 31", p_encerrar: false, p_texto: null, p_versao_outro: null,
  });
});

Deno.test("AT-18: encerrar o duplicado pede o texto ao morador antes do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const base = { versao: 3, outroId: ANTIGO, tipo: "DUPLICADO", motivo: "Mesma lâmpada do hall", encerrar: true };
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/ligacoes`, { corpo: base, cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["texto"]);
  assertEquals(chamada(m, "plataforma_ligar_pedidos"), undefined);
  const texto = "Já estamos cuidando disso no pedido 2027-0001.";
  await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/ligacoes`, { corpo: { ...base, texto, versaoOutro: 7 }, cookie });
  assertEquals(chamada(m, "plataforma_ligar_pedidos")?.p_encerrar, true);
  assertEquals(chamada(m, "plataforma_ligar_pedidos")?.p_texto, texto);
  assertEquals(chamada(m, "plataforma_ligar_pedidos")?.p_versao_outro, 7);
});

Deno.test("AT-18: desfazer com motivo, descartar a sugestão e a janela dos parecidos", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const desfazer = `/v1/condominio/pedidos/${PEDIDO}/ligacoes/${LIGACAO}/desfazer`;
  assertEquals((await m.pedir(desfazer, { corpo: { versao: 4, motivo: "x" }, cookie })).status, 400);
  assertEquals(await (await m.pedir(desfazer, { corpo: { versao: 4, motivo: "Liguei o pedido errado" }, cookie })).json(), { versao: 5 });
  assertEquals(chamada(m, "plataforma_desfazer_ligacao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_versao: 4, p_ligacao: LIGACAO, p_motivo: "Liguei o pedido errado",
  });
  assertEquals((await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/ligacoes/nao-e-id/desfazer`, { corpo: { versao: 4, motivo: "Liguei errado" }, cookie })).status, 404);

  assertEquals(await (await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/parecidos/descartar`, { corpo: { outroId: ANTIGO }, cookie })).json(), { ok: true });
  assertEquals(chamada(m, "plataforma_descartar_parecido"), { p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_outro: ANTIGO });

  const janela = await m.pedir("/v1/condominio/regras-parecidos", { metodo: "PUT", corpo: { versao: 2, dias: 45 }, cookie });
  assertEquals((await erro(janela)).detalhes?.campos, ["dias"]);
  assertEquals(await (await m.pedir("/v1/condominio/regras-parecidos", { metodo: "PUT", corpo: { versao: 2, dias: 60 }, cookie })).json(), { versao: 3 });
  assertEquals(chamada(m, "plataforma_definir_parecidos"), { p_pessoa: ANA, p_condominio: AURORA, p_versao: 2, p_dias: 60 });
});

Deno.test("AT-23: pedir decisão leva pergunta, prazo, quem decide e as alternativas em centavos", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = {
    versao: 5, pergunta: "Qual orçamento aprovamos para o motor do portão?", porque: "O portão parou duas vezes", prazo: "2027-03-20",
    decisorId: GIL, alternativas: [{ descricao: "Trocar o motor", detalhe: "Portões Rio", custo: 480000 }, { descricao: "Consertar o atual" }],
  };
  assertEquals(await (await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/decisoes`, { corpo, cookie })).json(), { versao: 6, id: DECISAO });
  assertEquals(chamada(m, "plataforma_pedir_decisao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_versao: 5, p_pergunta: corpo.pergunta, p_porque: corpo.porque, p_prazo: "2027-03-20",
    p_decisor: GIL, p_alternativas: [{ descricao: "Trocar o motor", detalhe: "Portões Rio", custo: 480000 }, { descricao: "Consertar o atual", detalhe: null, custo: null }],
  });
  m.chamadas.length = 0;
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/decisoes`, { corpo: { ...corpo, alternativas: [{ descricao: "Opção", custo: 10.5 }] }, cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["alternativas"]);
  assertEquals(chamada(m, "plataforma_pedir_decisao"), undefined);
});

Deno.test("AT-23: a lista de decisões abre nas que aguardam e recusa filtro desconhecido", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/decisoes", { cookie })).json()).filtro, "AGUARDANDO");
  assertEquals(chamada(m, "plataforma_decisoes"), { p_pessoa: ANA, p_condominio: AURORA, p_filtro: "AGUARDANDO" });
  assertEquals((await (await m.pedir("/v1/condominio/decisoes?filtro=TODAS", { cookie })).json()).filtro, "TODAS");
  const r = await m.pedir("/v1/condominio/decisoes?filtro=VENCIDAS", { cookie });
  assertEquals((await erro(r)).detalhes?.campos, ["filtro"]);
});

Deno.test("AT-23: responder aprova uma alternativa ou devolve, sempre com justificativa; retirar pede motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const responder = `/v1/condominio/decisoes/${DECISAO}/responder`;
  const semAlternativa = await m.pedir(responder, { corpo: { versao: 1, aprovar: true, justificativa: "Mais barato" }, cookie });
  assertEquals((await erro(semAlternativa)).detalhes?.campos, ["alternativa"]);
  assertEquals(await (await m.pedir(responder, { corpo: { versao: 1, aprovar: true, alternativa: 2, justificativa: "Mais barato" }, cookie })).json(), { versao: 2 });
  assertEquals(chamada(m, "plataforma_responder_decisao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_decisao: DECISAO, p_versao: 1, p_aprovar: true, p_alternativa: 2, p_justificativa: "Mais barato",
  });
  m.chamadas.length = 0;
  await m.pedir(responder, { corpo: { versao: 1, aprovar: false, justificativa: "Falta um terceiro orçamento" }, cookie });
  assertEquals(chamada(m, "plataforma_responder_decisao")?.p_alternativa, null);

  const retirar = `/v1/condominio/decisoes/${DECISAO}/retirar`;
  assertEquals((await m.pedir(retirar, { corpo: { versao: 1 }, cookie })).status, 400);
  assertEquals(await (await m.pedir(retirar, { corpo: { versao: 1, motivo: "O morador resolveu por conta" }, cookie })).json(), { versao: 2 });
  assertEquals(chamada(m, "plataforma_retirar_decisao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_decisao: DECISAO, p_versao: 1, p_motivo: "O morador resolveu por conta",
  });
});
