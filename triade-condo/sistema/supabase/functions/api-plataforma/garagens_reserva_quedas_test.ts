// Garagens e busca por placa (F3.8; MU-06, MU-11), troca para o prestador reserva (F5.9; MP-09) e
// queda do WhatsApp (F5.10; W-17). O banco decide; aqui a entrada é validada e repassada.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const UNIDADE = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const VAGA = "5a2b8e5d-0c6f-4b7a-8d3e-6f7a8b9c0d1e";
const VEICULO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const MANUTENCAO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const LINK = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const QUEDA = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ENVIO = "0d1e2f3a-4b5c-4d6e-9f7a-b8c9d0e1f2a3";
const CODIGO = "Zm9vYmFyYmF6cXV4LWNvZGlnby1kZS10ZXN0ZQ";
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
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, etiqueta: 2, prestador: 20 }),
    plataforma_buscar_unidades: () => [{ unidadeId: UNIDADE, tipo: "PLACA", texto: "placa QMF2A41 · Onix prata · vaga 31" }],
    plataforma_garagens: () => ({ vagas: [], resumo: { vagas: 0 } }),
    plataforma_salvar_vaga: (a) => ({ id: VAGA, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_salvar_veiculo: (a) => ({ id: VEICULO, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_retirar_veiculo: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_criar_link_prestador: () => ({ id: LINK, codigo: CODIGO, versao: 5 }),
    plataforma_desligar_troca: () => ({ ok: true }),
    publico_prestador_confirmar: () => ({ ok: true, resposta: "CONFIRMOU" }),
    publico_prestador_recusar: () => ({ ok: true, resposta: "RECUSOU" }),
    plataforma_abrir_queda: () => ({ id: QUEDA, versao: 1 }),
    plataforma_queda: () => ({ id: QUEDA, estado: "CONFERINDO", envios: [] }),
    plataforma_editar_queda: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_queda_voltou: () => ({ ok: true }),
    plataforma_conciliar_queda: (a) => ({ decididas: (a.p_envios as string[]).length }),
    plataforma_encerrar_queda: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_quedas_responsavel: (a) => ({ versao: Number(a.p_versao) + 1 }),
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

Deno.test("MU-11: a busca da lista de unidades pede sessão e de 2 a 60 caracteres", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/busca-unidades?busca=qmf2")).status, 401);
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/busca-unidades?busca=q", { cookie }))).detalhes?.campos, ["busca"]);
  const r = await (await m.pedir("/v1/condominio/busca-unidades?busca=%20qmf2%20", { cookie })).json();
  assertEquals(r[0].tipo, "PLACA");
  assertEquals(chamada(m, "plataforma_buscar_unidades"), { p_pessoa: ANA, p_condominio: AURORA, p_busca: "qmf2" });
  assertEquals((await m.pedir("/v1/condominio/garagens", { cookie })).status, 200);
});

Deno.test("MU-06: vaga e veículo validam a entrada e a placa vai normalizada", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/vagas", { cookie, corpo: { identificacao: " 31 ", onde: "Subsolo 1", unidadeId: UNIDADE } })).status, 201);
  assertEquals(chamada(m, "plataforma_salvar_vaga"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_identificacao: "31", p_onde: "Subsolo 1", p_coberta: null,
    p_unidade: UNIDADE, p_ativa: null,
  });
  assertEquals((await erro(await m.pedir(`/v1/condominio/vagas/${VAGA}`, { metodo: "PUT", cookie, corpo: { identificacao: "31" } }))).detalhes?.campos,
    ["versao"]);
  assertEquals((await erro(await m.pedir("/v1/condominio/veiculos", { cookie, corpo: { unidadeId: UNIDADE, placa: "XYZ", tipo: "CARRO" } }))).detalhes?.campos,
    ["placa"]);
  assertEquals((await erro(await m.pedir("/v1/condominio/veiculos", { cookie, corpo: { placa: "QMF2A41", tipo: "CARRO" } }))).detalhes?.campos,
    ["unidadeId"]);
  const r = await m.pedir("/v1/condominio/veiculos", { cookie, corpo: { unidadeId: UNIDADE, placa: "qmf-2a41", tipo: "CARRO", modelo: "Onix prata", vagaId: VAGA } });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_salvar_veiculo"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_unidade: UNIDADE, p_placa: "QMF2A41", p_tipo: "CARRO",
    p_modelo: "Onix prata", p_contato: null, p_vaga: VAGA,
  });
  await m.pedir(`/v1/condominio/veiculos/${VEICULO}`, { metodo: "PUT", cookie, corpo: { versao: 1, unidadeId: UNIDADE, placa: "ABC-1234", tipo: "MOTO" } });
  assertEquals(chamada(m, "plataforma_salvar_veiculo")?.p_unidade, null);
  assertEquals((await (await m.pedir(`/v1/condominio/veiculos/${VEICULO}/retirar`, { cookie, corpo: { versao: 2 } })).json()).versao, 3);
});

Deno.test("MP-09: mandar o link com prazo para responder e desligar a troca", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/manutencao/${MANUTENCAO}/link-prestador`;
  const corpo = { versao: 4, oQueFazer: "Trocar o rolamento da bomba 2", valeAte: "2026-10-31" };
  assertEquals((await erro(await m.pedir(url, { cookie, corpo: { ...corpo, responderHoras: 12 } }))).detalhes?.campos, ["responderHoras"]);
  assertEquals((await m.pedir(url, { cookie, corpo: { ...corpo, responderHoras: 24 } })).status, 201);
  assertEquals(chamada(m, "plataforma_criar_link_prestador")?.p_responder_horas, 24);
  assertEquals((await m.pedir(`${url}/${LINK}/nao-trocar`, { cookie, corpo: {} })).status, 200);
  assertEquals(chamada(m, "plataforma_desligar_troca"), { p_pessoa: ANA, p_condominio: AURORA, p_manutencao: MANUTENCAO, p_link: LINK });
});

Deno.test("MP-09: o prestador confirma ou diz que não pode atender, só com o código", async () => {
  const m = montar();
  const base = `/v1/publico/p/${CODIGO}`;
  assertEquals((await (await m.pedir(`${base}/confirmar`, { corpo: {} })).json()).resposta, "CONFIRMOU");
  assertEquals((await m.pedir("/v1/publico/p/x/confirmar", { corpo: {} })).status, 404);
  assertEquals((await erro(await m.pedir(`${base}/recusar`, { corpo: { texto: "x" } }))).detalhes?.campos, ["texto"]);
  await m.pedir(`${base}/recusar`, { corpo: { texto: " Equipe em outro serviço " } });
  assertEquals(chamada(m, "publico_prestador_recusar"), { p_codigo: CODIGO, p_texto: "Equipe em outro serviço" });
  await m.pedir(`${base}/recusar`, { corpo: {} });
  assertEquals(chamada(m, "publico_prestador_recusar"), { p_codigo: CODIGO, p_texto: null });
});

Deno.test("W-17: a queda do WhatsApp pede sessão e valida o canal, as decisões e o resumo", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/whatsapp/quedas", { corpo: {} })).status, 401);
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/whatsapp/quedas", { cookie, corpo: { oQueAconteceu: "As mensagens pararam" } })).status, 201);
  assertEquals(chamada(m, "plataforma_abrir_queda"), { p_pessoa: ANA, p_condominio: AURORA, p_o_que_aconteceu: "As mensagens pararam" });
  const q = `/v1/condominio/whatsapp/quedas/${QUEDA}`;
  assertEquals((await (await m.pedir(q, { cookie })).json()).estado, "CONFERINDO");
  assertEquals((await erro(await m.pedir(q, { metodo: "PUT", cookie, corpo: { versao: 1, canalAlternativo: "Tel" } }))).detalhes?.campos,
    ["canalAlternativo"]);
  await m.pedir(q, { metodo: "PUT", cookie, corpo: { versao: 1, canalAlternativo: "Portaria: (61) 3333-4444" } });
  assertEquals(chamada(m, "plataforma_editar_queda"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: QUEDA, p_versao: 1, p_canal: "Portaria: (61) 3333-4444", p_o_que_aconteceu: null,
  });
  assertEquals((await m.pedir(`${q}/voltou`, { cookie, corpo: {} })).status, 200);
  assertEquals((await erro(await m.pedir(`${q}/conciliar`, { cookie, corpo: { envios: [ENVIO], decisao: "OUTRO_CANAL" } }))).detalhes?.campos,
    ["motivo"]);
  assertEquals((await erro(await m.pedir(`${q}/conciliar`, { cookie, corpo: { envios: [], decisao: "MANDAR" } }))).detalhes?.campos, ["envios"]);
  assertEquals((await (await m.pedir(`${q}/conciliar`, { cookie, corpo: { envios: [ENVIO], decisao: "MANDAR" } })).json()).decididas, 1);
  assertEquals((await erro(await m.pedir(`${q}/encerrar`, { cookie, corpo: { versao: 3, resumo: "curto" } }))).detalhes?.campos, ["resumo"]);
  assertEquals((await (await m.pedir(`${q}/encerrar`, { cookie, corpo: { versao: 3, resumo: "Avisamos pela portaria." } })).json()).versao, 4);
  await m.pedir("/v1/condominio/whatsapp/config/quedas", { metodo: "PUT", cookie, corpo: { versao: 2, pessoaId: null } });
  assertEquals(chamada(m, "plataforma_quedas_responsavel"), { p_pessoa: ANA, p_condominio: AURORA, p_versao: 2, p_responsavel: null });
});
