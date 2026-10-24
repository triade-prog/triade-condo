// Privacidade e dados (F0.11; PT-11, PT-03, EM-08) na Plataforma do síndico: a API valida a entrada,
// repassa ao banco quem está na sessão, monta a planilha de "Baixar tudo" e apaga do armazenamento
// os arquivos vencidos. Quem pode o quê e os prazos ficam no banco (044_retencao_dados_test.sql).
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { dataHoraBrasilia } from "./privacidade.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const JOAO = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AGUA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const CONTATO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const PEDIDO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const GUARDA = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const ENTRAR = { email: "joao@exemplo.invalid", senha: "senha-do-sindico" };
const caminho = (n: number) => `${AGUA}/${PEDIDO}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Fila = { id: number; bucket: string; caminho: string }[];

function montar(opcoes: { fila?: Fila; semComunicados?: boolean; falhaManutencao?: boolean } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: JOAO, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const pedidos = armazenamentoFalso();
  const manutencoes = armazenamentoFalso();
  const comunicados = armazenamentoFalso();
  const portaria = armazenamentoFalso();
  if (opcoes.falhaManutencao) {
    manutencoes.armazenamento.apagar = () => Promise.reject(new Error("Armazenamento: falha ao apagar (500)"));
  }
  // A fila falsa: o que deu certo sai; o que falhou volta na próxima busca.
  const fila = [...(opcoes.fila ?? [])];
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AGUA, nome: "Residencial Águas Claras", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AGUA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_privacidade: () => ({ modo: "CONTANDO", ultimaRodada: null, vencidos: 3, proximos30: 1, podeCuidar: true, guardados: [], tipos: [] }),
    plataforma_dados_pessoa: () => ({ pessoas: [{ contato: { id: CONTATO, nome: "Marina Lopes", versao: 2 } }] }),
    plataforma_dados_pessoa_exportar: () => ({
      geradoEm: "2026-10-25T01:30:00Z", // 24/10 às 22h30 em Brasília
      linhas: [
        { parte: "Cadastro", quando: "2026-03-01T12:05:00Z", o_que: "Marina Lopes · 11987654321 · marina@exemplo.invalid" },
        { parte: "Pedido", quando: "2026-04-02T02:59:00+00:00", o_que: 'Vazamento; "urgente"' },
        { parte: "Mensagem de WhatsApp", quando: "2026-05-10T15:00:00Z", o_que: "=HYPERLINK(\"x\")\nsegunda linha" },
        { parte: "Encomenda retirada", quando: null, o_que: null },
      ],
    }),
    plataforma_remover_dados_pessoa: (a) => (a.p_versao === 9 ? erroBanco("TC409") : { arquivos: 2 }),
    plataforma_guardar: (a) => ({ id: GUARDA, entidade: a.p_entidade, alvoId: a.p_alvo, motivo: a.p_motivo, detalhe: a.p_detalhe, versao: 1 }),
    plataforma_tirar_guarda: () => null,
    plataforma_guarda: (a) => (a.p_alvo === PEDIDO ? { id: GUARDA, entidade: a.p_entidade, alvoId: a.p_alvo, motivo: "PROCESSO", versao: 1 } : null),
    retencao_arquivos_pendentes: (a) => fila.slice(0, Number(a.p_limite)),
    retencao_arquivo_resultado: (a) => {
      if (a.p_erro === null) fila.splice(fila.findIndex((x) => x.id === a.p_id), 1);
      return null;
    },
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: pedidos.armazenamento, armazenamentoManutencao: manutencoes.armazenamento,
    armazenamentoComunicados: opcoes.semComunicados ? undefined : comunicados.armazenamento,
    armazenamentoPortaria: portaria.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), pedidos, manutencoes, comunicados, portaria, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AGUA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const QUEM = { p_pessoa: JOAO, p_condominio: AGUA };

Deno.test("F0.11: sem sessão, nenhuma rota da privacidade chega ao banco", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/privacidade"))).codigo, "UNAUTHORIZED");
  assertEquals((await erro(await m.pedir("/v1/condominio/privacidade/dados-pessoa", { corpo: { busca: "11987654321" } }))).codigo, "UNAUTHORIZED");
  assertEquals(m.chamadas.some((c) => c.funcao.startsWith("plataforma_")), false);
});

Deno.test("PT-11: a página de privacidade leva quem está na sessão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/privacidade", { cookie });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).vencidos, 3);
  assertEquals(chamada(m, "plataforma_privacidade"), QUEM);
});

Deno.test("PT-03: a busca vai no corpo, limpa, e a curta demais nem chega ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/privacidade/dados-pessoa", { corpo: { busca: "  (11)  98765-4321 " }, cookie });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).pessoas.length, 1);
  assertEquals(chamada(m, "plataforma_dados_pessoa"), { ...QUEM, p_busca: "(11) 98765-4321" });

  const curta = await m.pedir("/v1/condominio/privacidade/dados-pessoa", { corpo: { busca: " 1 " }, cookie });
  assertEquals(curta.status, 400);
  assertEquals((await erro(curta)).detalhes?.campos, ["busca"]);
  assertEquals(m.chamadas.filter((c) => c.funcao === "plataforma_dados_pessoa").length, 1);
});

Deno.test("PT-03: Baixar tudo devolve a planilha em CSV, com BOM, datas de Brasília e células seguras", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/privacidade/dados-pessoa/${CONTATO}/planilha`, { cookie });
  assertEquals(r.status, 200);
  assertEquals(r.headers.get("content-type"), "text/csv; charset=utf-8");
  assertEquals(r.headers.get("content-disposition"), 'attachment; filename="dados-pessoa-2026-10-24.csv"');
  assertEquals(r.headers.get("cache-control"), "no-store");
  assertEquals(chamada(m, "plataforma_dados_pessoa_exportar"), { ...QUEM, p_contato: CONTATO });

  const bytes = new Uint8Array(await r.arrayBuffer());
  assertEquals([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const texto = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  assertEquals(texto.split("\r\n"), [
    "﻿Parte;Quando;O que",
    "Cadastro;01/03/2026 09:05;Marina Lopes · 11987654321 · marina@exemplo.invalid",
    'Pedido;01/04/2026 23:59;"Vazamento; ""urgente"""',
    `Mensagem de WhatsApp;10/05/2026 12:00;"'=HYPERLINK(""x"") segunda linha"`,
    "Encomenda retirada;;",
    "",
  ]);
});

Deno.test("PT-03: a data da planilha é a de Brasília e o vazio fica vazio", () => {
  assertEquals(dataHoraBrasilia("2026-01-01T02:00:00Z"), "31/12/2025 23:00");
  assertEquals(dataHoraBrasilia("2026-07-15T00:00:00.123456+00:00"), "14/07/2026 21:00");
  assertEquals(dataHoraBrasilia(null), null);
});

Deno.test("PT-03: id fora do formato responde como não encontrado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/privacidade/dados-pessoa/abc/planilha", { cookie })).status, 404);
  assertEquals(m.chamadas.some((c) => c.funcao === "plataforma_dados_pessoa_exportar"), false);
});

Deno.test("EM-08: remover os dados leva a versão e o motivo; PRAZO é só da rotina", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/privacidade/dados-pessoa/${CONTATO}/remover`;
  const r = await m.pedir(url, { corpo: { versao: 2, motivo: "PEDIDO" }, cookie });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { arquivos: 2 });
  assertEquals(chamada(m, "plataforma_remover_dados_pessoa"), { ...QUEM, p_contato: CONTATO, p_versao: 2, p_motivo: "PEDIDO" });

  const prazo = await m.pedir(url, { corpo: { versao: 2, motivo: "PRAZO" }, cookie });
  assertEquals(prazo.status, 400);
  assertEquals((await erro(prazo)).detalhes?.campos, ["motivo"]);
  assertEquals((await m.pedir(url, { corpo: { motivo: "OUTRO" }, cookie })).status, 400);
  assertEquals(m.chamadas.filter((c) => c.funcao === "plataforma_remover_dados_pessoa").length, 1);

  assertEquals((await erro(await m.pedir(url, { corpo: { versao: 9, motivo: "OUTRO" }, cookie }))).codigo, "VERSION_CONFLICT");
});

Deno.test("PT-11: guardar leva o item, o motivo e o detalhe limpo, com 201", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/privacidade/guardas", {
    corpo: { entidade: "PEDIDO", alvoId: PEDIDO, motivo: "PROCESSO", detalhe: "  Processo   0001234-56 " }, cookie,
  });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).id, GUARDA);
  assertEquals(chamada(m, "plataforma_guardar"), {
    ...QUEM, p_entidade: "PEDIDO", p_alvo: PEDIDO, p_motivo: "PROCESSO", p_detalhe: "Processo 0001234-56",
  });
  await m.pedir("/v1/condominio/privacidade/guardas", { corpo: { entidade: "CONTATO", alvoId: CONTATO, motivo: "SINISTRO", detalhe: "  " }, cookie });
  assertEquals(chamada(m, "plataforma_guardar")?.p_detalhe, null);
});

Deno.test("PT-11: OUTRO sem detalhe, entidade desconhecida ou alvo fora do formato nem chegam ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = "/v1/condominio/privacidade/guardas";
  const outro = await m.pedir(url, { corpo: { entidade: "PEDIDO", alvoId: PEDIDO, motivo: "OUTRO" }, cookie });
  assertEquals(outro.status, 400);
  assertEquals((await erro(outro)).detalhes?.campos, ["detalhe"]);
  const curto = await m.pedir(url, { corpo: { entidade: "PEDIDO", alvoId: PEDIDO, motivo: "PROCESSO", detalhe: "ab" }, cookie });
  assertEquals((await erro(curto)).detalhes?.campos, ["detalhe"]);
  assertEquals((await m.pedir(url, { corpo: { entidade: "RESERVA", alvoId: PEDIDO, motivo: "PROCESSO" }, cookie })).status, 400);
  assertEquals((await m.pedir(url, { corpo: { entidade: "PEDIDO", alvoId: "123", motivo: "PROCESSO" }, cookie })).status, 400);
  assertEquals(m.chamadas.some((c) => c.funcao === "plataforma_guardar"), false);
});

Deno.test("PT-11: tirar a guarda leva a versão e o motivo e responde ok", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/privacidade/guardas/${GUARDA}/tirar`;
  const r = await m.pedir(url, { corpo: { versao: 1, motivo: "  Processo   arquivado " }, cookie });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true });
  assertEquals(chamada(m, "plataforma_tirar_guarda"), { ...QUEM, p_guarda: GUARDA, p_versao: 1, p_motivo: "Processo arquivado" });
  assertEquals((await erro(await m.pedir(url, { corpo: { versao: 1, motivo: "ok" }, cookie }))).detalhes?.campos, ["motivo"]);
  assertEquals((await m.pedir(url, { corpo: { motivo: "Processo arquivado" }, cookie })).status, 400);
  assertEquals(m.chamadas.filter((c) => c.funcao === "plataforma_tirar_guarda").length, 1);
});

Deno.test("PT-11: o selo da ficha responde a guarda ou null; entidade desconhecida é 404", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/privacidade/guardas/PEDIDO/${PEDIDO}`, { cookie });
  assertEquals((await r.json()).guarda.id, GUARDA);
  assertEquals(chamada(m, "plataforma_guarda"), { ...QUEM, p_entidade: "PEDIDO", p_alvo: PEDIDO });
  assertEquals(await (await m.pedir(`/v1/condominio/privacidade/guardas/CONTATO/${CONTATO}`, { cookie })).json(), { guarda: null });
  for (const e of ["RESERVA", "pedido", "toString"]) {
    assertEquals((await m.pedir(`/v1/condominio/privacidade/guardas/${e}/${PEDIDO}`, { cookie })).status, 404, e);
  }
  assertEquals(m.chamadas.filter((c) => c.funcao === "plataforma_guarda").length, 2);
});

Deno.test("PT-11: a rotina apaga os arquivos bucket por bucket e devolve o resultado ao banco", async () => {
  const m = montar({
    semComunicados: true,
    falhaManutencao: true,
    fila: [
      { id: 1, bucket: "pedidos", caminho: caminho(1) },
      { id: 2, bucket: "portaria", caminho: caminho(2) },
      { id: 3, bucket: "manutencoes", caminho: caminho(3) },
      { id: 4, bucket: "comunicados", caminho: caminho(4) },
      { id: 5, bucket: "pedidos", caminho: caminho(5) },
    ],
  });
  const r = await m.pedir("/v1/interno/retencao-arquivos", { corpo: {} });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { apagados: 3, erros: 2 });
  assertEquals(m.pedidos.apagados, [caminho(1), caminho(5)]);
  assertEquals(m.portaria.apagados, [caminho(2)]);
  assertEquals(m.comunicados.apagados, []);
  const resultados = m.chamadas.filter((c) => c.funcao === "retencao_arquivo_resultado").map((c) => c.args);
  assertEquals(resultados, [
    { p_id: 1, p_erro: null },
    { p_id: 2, p_erro: null },
    { p_id: 3, p_erro: "Armazenamento: falha ao apagar (500)" },
    { p_id: 4, p_erro: "Armazenamento não configurado" },
    { p_id: 5, p_erro: null },
  ]);
  assertEquals(chamada(m, "retencao_arquivos_pendentes"), { p_limite: 50 });
  assertEquals(m.chamadas.filter((c) => c.funcao === "retencao_arquivos_pendentes").length, 1);
});

Deno.test("PT-11: a rotina vai em lotes de 50, até 5 por chamada, e não tenta de novo o que falhou", async () => {
  const fila = Array.from({ length: 260 }, (_, i) => ({ id: i + 1, bucket: "pedidos", caminho: caminho(i + 1) }));
  const m = montar({ fila });
  const r = await m.pedir("/v1/interno/retencao-arquivos", { corpo: {} });
  assertEquals(await r.json(), { apagados: 250, erros: 0 });
  assertEquals(m.chamadas.filter((c) => c.funcao === "retencao_arquivos_pendentes").length, 5);
  assertEquals(m.pedidos.apagados.length, 250);

  // Tudo falhando: um lote cheio, e o segundo só traz os mesmos de volta.
  const falha = montar({ fila: fila.slice(0, 60).map((a) => ({ ...a, bucket: "suporte" })) });
  const f = await falha.pedir("/v1/interno/retencao-arquivos", { corpo: {} });
  assertEquals(await f.json(), { apagados: 0, erros: 50 });
  assertEquals(falha.chamadas.filter((c) => c.funcao === "retencao_arquivos_pendentes").length, 2);
});

Deno.test("PT-11: a rotina sem o segredo de repasse é recusada e não toca na fila", async () => {
  const m = montar({ fila: [{ id: 1, bucket: "pedidos", caminho: caminho(1) }] });
  const r = await m.pedir("/v1/interno/retencao-arquivos", { corpo: {}, segredo: null });
  assertEquals(r.status, 403);
  assertEquals((await erro(r)).codigo, "FORBIDDEN");
  const errado = await m.pedir("/v1/interno/retencao-arquivos", { corpo: {}, segredo: "outro-segredo" });
  assertEquals(errado.status, 403);
  assertEquals(m.chamadas.some((c) => c.funcao.startsWith("retencao_")), false);
  assertEquals(m.pedidos.apagados, []);
});

Deno.test("PT-11: arquivo que já não existe conta como apagado", async () => {
  const m = montar({ fila: [{ id: 7, bucket: "pedidos", caminho: caminho(7) }] });
  assert(!m.pedidos.objetos.has(caminho(7)));
  const r = await m.pedir("/v1/interno/retencao-arquivos", { corpo: {} });
  assertStringIncludes(await r.text(), '"apagados":1');
  assertEquals(chamada(m, "retencao_arquivo_resultado"), { p_id: 7, p_erro: null });
});
