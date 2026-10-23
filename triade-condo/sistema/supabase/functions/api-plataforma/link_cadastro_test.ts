// Link de cadastro da unidade e a fila do que chega por ele (F3.10; MU-09). O banco decide; aqui
// a entrada é validada e repassada, e a página sem conta tem limite por aparelho.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const UNIDADE = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const LINK = "5a2b8e5d-0c6f-4b7a-8d3e-6f7a8b9c0d1e";
const CADASTRO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const CODIGO = "K7P2-9QXA-M4RT";
const CHAVE = "c".repeat(43);
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar(cadastro = 20) {
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
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, link: 60, cadastro }),
    plataforma_links_cadastro: () => ({ itens: [], podeCriar: true }),
    plataforma_criar_link_cadastro: () => ({ id: LINK, codigo: CODIGO, versao: 1 }),
    plataforma_encerrar_link_cadastro: (a) => ({ id: a.p_id, versao: Number(a.p_versao) + 1 }),
    plataforma_cadastros_link: () => ({ itens: [], podeConfirmar: true }),
    plataforma_aprovar_cadastro_link: () => ({ id: CADASTRO, versao: 3, contatoId: LINK, confirmacaoNaFila: false }),
    plataforma_recusar_cadastro_link: () => ({ id: CADASTRO, versao: 3 }),
    plataforma_moradores: () => ({ itens: [], total: 0, pagina: 1, porPagina: 50 }),
    publico_cadastro: () => ({ condominio: "Residencial Aurora", unidade: "Torre A · 102", pede: [], aberto: true }),
    publico_enviar_cadastro: () => ({ condominio: "Residencial Aurora", chave: CHAVE, envio: { estado: "ENVIADO" } }),
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

Deno.test("MU-09: criar o link pede sessão, a validade da lista e só o que pode ser pedido", async () => {
  const m = montar();
  const url = "/v1/condominio/links-cadastro";
  assertEquals((await m.pedir(url, { corpo: { unidadeId: UNIDADE, pede: [], dias: 7 } })).status, 401);
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(url, { cookie, corpo: { unidadeId: UNIDADE, pede: [], dias: 10 } }))).detalhes?.campos, ["dias"]);
  assertEquals((await erro(await m.pedir(url, { cookie, corpo: { unidadeId: UNIDADE, pede: ["SENHA"], dias: 7 } }))).detalhes?.campos, ["pede"]);
  assertEquals((await m.pedir(url, { cookie, corpo: { unidadeId: UNIDADE, pede: ["FAMILIA", "PETS", "FAMILIA"], dias: 7 } })).status, 201);
  assertEquals(chamada(m, "plataforma_criar_link_cadastro"), { p_pessoa: ANA, p_condominio: AURORA, p_unidade: UNIDADE, p_pede: ["FAMILIA", "PETS"], p_dias: 7 });
  await m.pedir(url, { cookie, corpo: { unidadeId: null, pede: [], dias: 30 } });
  assertEquals(chamada(m, "plataforma_criar_link_cadastro")?.p_unidade, null);
});

Deno.test("MU-09: os links e a fila filtram pela unidade; encerrar pede a versão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/condominio/links-cadastro?unidade=${UNIDADE}`, { cookie });
  assertEquals(chamada(m, "plataforma_links_cadastro")?.p_unidade, UNIDADE);
  await m.pedir("/v1/condominio/cadastros-link", { cookie });
  assertEquals(chamada(m, "plataforma_cadastros_link")?.p_unidade, null);
  assertEquals((await erro(await m.pedir("/v1/condominio/cadastros-link?unidade=102", { cookie }))).detalhes?.campos, ["unidade"]);
  assertEquals((await erro(await m.pedir(`/v1/condominio/links-cadastro/${LINK}/encerrar`, { cookie, corpo: {} }))).detalhes?.campos, ["versao"]);
  assertEquals((await m.pedir(`/v1/condominio/links-cadastro/${LINK}/encerrar`, { cookie, corpo: { versao: 1 } })).status, 200);
  await m.pedir(`/v1/condominio/moradores?estado=PENDENTE&unidade=${UNIDADE}`, { cookie });
  assertEquals(chamada(m, "plataforma_moradores")?.p_unidade, UNIDADE);
});

Deno.test("MU-09: aprovar repassa o que o síndico corrigiu; recusar pede o motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/cadastros-link/${CADASTRO}`;
  const corpo = {
    versao: 2, nome: "Roberto Prado", telefone: "(61) 96666-4321", ligacao: "PROPRIETARIO", email: "",
    familia: [{ nome: "Clara Prado", parentesco: "CONJUGE", mora: false }], veiculos: [{ placa: "abc-1234", tipo: "CARRO" }],
  };
  assertEquals((await erro(await m.pedir(`${url}/aprovar`, { cookie, corpo: { ...corpo, ligacao: "VIZINHO" } }))).detalhes?.campos, ["ligacao"]);
  assertEquals((await m.pedir(`${url}/aprovar`, { cookie, corpo })).status, 200);
  const a = chamada(m, "plataforma_aprovar_cadastro_link")!;
  assertEquals([a.p_telefone, a.p_email, a.p_pets], ["+5561966664321", null, []]);
  assertEquals(a.p_familia, [{ nome: "Clara Prado", parentesco: "CONJUGE", mora: false, aniversario: null }]);
  assertEquals(a.p_veiculos, [{ placa: "ABC1234", tipo: "CARRO", modelo: null }]);
  assertEquals((await erro(await m.pedir(`${url}/recusar`, { cookie, corpo: { versao: 2, motivo: "OUTRO" } }))).detalhes?.campos, ["explicacao"]);
  await m.pedir(`${url}/recusar`, { cookie, corpo: { versao: 2, motivo: "NAO_E_DA_UNIDADE", explicacao: "Já tem outro dono." } });
  assertEquals(chamada(m, "plataforma_recusar_cadastro_link")?.p_explicacao, "Já tem outro dono.");
});

Deno.test("MU-09: a página sem conta abre pelo código e a chave vai no corpo, nunca no endereço", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/publico/cadastro/curto")).status, 404);
  assertEquals((await m.pedir(`/v1/publico/cadastro/${CODIGO}`)).status, 200);
  assertEquals(chamada(m, "publico_cadastro"), { p_codigo: CODIGO, p_chave: null });
  assertEquals((await erro(await m.pedir(`/v1/publico/cadastro/${CODIGO}/ver`, { corpo: { chave: "x" } }))).detalhes?.campos, ["chave"]);
  await m.pedir(`/v1/publico/cadastro/${CODIGO}/ver`, { corpo: { chave: CHAVE } });
  assertEquals(chamada(m, "publico_cadastro")?.p_chave, CHAVE);
});

Deno.test("MU-09: mandar pelo link normaliza o telefone e a placa e tem limite por aparelho", async () => {
  const m = montar(2);
  const url = `/v1/publico/cadastro/${CODIGO}`;
  const corpo = {
    nome: "Roberto Prado", telefone: "(61) 96666-4321", ligacao: "PROPRIETARIO", email: "roberto.prado@email.com",
    aniversario: { dia: 3, mes: 11 }, pets: [{ nome: "Bolota", especie: "CAO" }], veiculos: [{ placa: "abc1d23", tipo: "CARRO", modelo: "Onix prata" }],
  };
  assertEquals((await erro(await m.pedir(url, { corpo: { ...corpo, aniversario: { dia: 31, mes: 4 } } }))).detalhes?.campos, ["aniversario"]);
  assertEquals((await m.pedir(url, { corpo })).status, 200);
  const a = chamada(m, "publico_enviar_cadastro")!;
  assertEquals(a.p_chave, null);
  const d = a.p_dados as Record<string, unknown>;
  assertEquals([d.telefone, d.unidadeId, (d.veiculos as { placa: string }[])[0]!.placa, d.familia], ["+5561966664321", null, "ABC1D23", []]);
  assertEquals("chave" in d, false);
  await m.pedir(url, { corpo: { ...corpo, chave: CHAVE } });
  assertEquals(chamada(m, "publico_enviar_cadastro")?.p_chave, CHAVE);
  assertEquals((await erro(await m.pedir(url, { corpo }))).codigo, "RATE_LIMITED");
});
