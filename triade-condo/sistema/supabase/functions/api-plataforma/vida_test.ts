// Vida em condomínio (peça R12): áreas comuns, reservas, enquetes e assembleias na Plataforma do síndico. As rotas
// validam a entrada, mandam ao banco a pessoa e o condomínio da sessão e deixam as regras para o banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const AREA = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const UNIDADE = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const RESERVA = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENQUETE = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const CONVITE = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const ASSEMBLEIA = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ITEM = "0d1e2f3a-4b5c-4d6e-9f7a-b8c9d0e1f2a3";
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
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, link: 10 }),
    plataforma_areas_comuns: () => ({ areas: [], documentos: [], pode: { editar: true } }),
    plataforma_salvar_area: (a) => ({ id: a.p_id ?? AREA, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_reservas: () => ({ reservas: [], aAprovar: 0, areas: [], hoje: "2026-10-19", pode: { editar: true } }),
    plataforma_reserva_opcoes: () => ({ areas: [], unidades: [], hoje: "2026-10-19" }),
    plataforma_conferir_reserva: () => ({ conferencia: { inicio: "10:00:00", fim: "23:00:00", tolerancia: false } }),
    plataforma_semana_area: () => ({ dias: [] }),
    plataforma_reserva: (a) => ({ reserva: { id: a.p_id } }),
    plataforma_registrar_reserva: () => ({ id: RESERVA, protocolo: "2026-R014", estado: "A_APROVAR" }),
    plataforma_aprovar_reserva: (a) => ({ versao: Number(a.p_versao) + 1, recusadas: 1 }),
    plataforma_recusar_reserva: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_cancelar_reserva: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_enquetes: () => ({ enquetes: [], canais: { whatsapp: true, email: false, mural: true }, unidades: 12, pode: { editar: true } }),
    plataforma_criar_enquete: () => ({ id: ENQUETE, versao: 1, convites: 12, envios: 14 }),
    plataforma_enquete: (a) => ({ enquete: { id: a.p_id }, convites: [], historico: [] }),
    plataforma_encerrar_enquete: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_publicar_enquete: () => ({ comunicadoId: RESERVA, versao: 3 }),
    plataforma_link_enquete: () => ({ codigo: "K7QM-3XPA-9TRE" }),
    publico_enquete: () => ({ pergunta: "Qual cor para a fachada?", aberta: true }),
    publico_responder_enquete: (a) => ({ escolha: a.p_opcao }),
    plataforma_assembleias: () => ({ assembleias: [], regras: { antecedencia: 10, peso: "FRACAO", versao: 3 }, semFracao: 0, unidades: 12, pode: { editar: true } }),
    plataforma_salvar_assembleia: (a) => ({ id: a.p_id ?? ASSEMBLEIA, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_assembleia: (a) => ({ assembleia: { id: a.p_id } }),
    plataforma_convocar_assembleia: (a) => ({ versao: Number(a.p_versao) + 1, unidades: 12, envios: 15 }),
    plataforma_iniciar_assembleia: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_encerrar_assembleia: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_cancelar_assembleia: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_abrir_item: (a) => ({ id: a.p_item, estado: "ABERTO" }),
    plataforma_encerrar_item: (a) => ({ id: a.p_item, estado: "ENCERRADO" }),
    plataforma_presenca_assembleia: () => ({ ok: true }),
    plataforma_direito_voto: () => ({ ok: true }),
    plataforma_procuracao: () => ({ ok: true }),
    plataforma_registrar_voto: (a) => ({ id: a.p_item }),
    plataforma_ata_assembleia: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_link_assembleia: () => ({ codigo: "K7QM-3XPA-9TRE" }),
    plataforma_regras_assembleia: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_fracoes: () => ({ unidades: [], soma: 0, pode: { editar: true } }),
    plataforma_salvar_fracoes: () => ({ alteradas: 1, soma: 40 }),
    publico_assembleia: () => ({ titulo: "AGO de março", estado: "CONVOCADA" }),
    publico_votar_assembleia: (a) => ({ itens: [{ id: a.p_item, meuVoto: a.p_opcao }] }),
    publico_procuracao_assembleia: (a) => ({ procuracao: { estado: "PENDENTE", nome: a.p_nome } }),
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

const SALAO = { nome: " Salão de festas ", reserva: "SINDICO", antecedenciaMin: 2, antecedenciaMax: 60, horaInicio: "10:00", horaFim: "23:00", ativa: true };

Deno.test("AC-07: criar e ajustar área comum; o banco recebe os campos já limpos", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/areas-comuns"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/areas-comuns", { corpo: SALAO, cookie })).status, 201);
  const a = chamada(m, "plataforma_salvar_area");
  assertEquals([a?.p_id, a?.p_versao], [null, null]);
  const d = a?.p_dados as Record<string, unknown>;
  assertEquals([d.nome, d.modo, d.cancelarSemAvisoDias, d.podeInquilino, d.blocoMinutos, "versao" in d], ["Salão de festas", "PERIODO", 3, true, null, false]);
  m.chamadas.length = 0;
  assertEquals((await erro(await m.pedir(`/v1/condominio/areas-comuns/${AREA}`, { metodo: "PUT", corpo: SALAO, cookie }))).detalhes?.campos, ["versao"]);
  assertEquals(await (await m.pedir(`/v1/condominio/areas-comuns/${AREA}`, { metodo: "PUT", corpo: { ...SALAO, versao: 2 }, cookie })).json(),
    { id: AREA, versao: 3 });
  const ruim = await m.pedir("/v1/condominio/areas-comuns", { corpo: { ...SALAO, horaFim: "09:00", modo: "BLOCOS" }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["horaFim", "blocoMinutos"]);
});

Deno.test("AC-01: a lista de reservas pelo filtro e a semana da área", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/reservas", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_reservas"), { p_pessoa: ANA, p_condominio: AURORA, p_filtro: "A_APROVAR", p_area: null });
  m.chamadas.length = 0;
  await m.pedir(`/v1/condominio/reservas?filtro=TODAS&areaId=${AREA}`, { cookie });
  assertEquals(chamada(m, "plataforma_reservas")?.p_area, AREA);
  assertEquals((await erro(await m.pedir("/v1/condominio/reservas?filtro=VELHAS", { cookie }))).detalhes?.campos, ["filtro"]);
  await m.pedir(`/v1/condominio/areas-comuns/${AREA}/semana?de=2026-10-19`, { cookie });
  assertEquals(chamada(m, "plataforma_semana_area"), { p_pessoa: ANA, p_condominio: AURORA, p_area: AREA, p_de: "2026-10-19" });
  assertEquals((await m.pedir(`/v1/condominio/areas-comuns/${AREA}/semana`, { cookie })).status, 400);
  await m.pedir(`/v1/condominio/reservas/conferir?areaId=${AREA}&unidadeId=${UNIDADE}&data=2026-10-25`, { cookie });
  assertEquals(chamada(m, "plataforma_conferir_reserva"), { p_pessoa: ANA, p_condominio: AURORA, p_area: AREA, p_unidade: UNIDADE, p_data: "2026-10-25" });
  assertEquals(await (await m.pedir(`/v1/condominio/reservas/${RESERVA}`, { cookie })).json(), { reserva: { id: RESERVA } });
  assertEquals((await m.pedir("/v1/condominio/reservas/x", { cookie })).status, 404);
});

Deno.test("AC-01: registrar pelo painel, aprovar com recado, recusar e cancelar com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/reservas", { corpo: { areaId: AREA, unidadeId: UNIDADE, data: "2026-10-25", observacao: " " }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_registrar_reserva"), {
    p_pessoa: ANA, p_condominio: AURORA, p_area: AREA, p_unidade: UNIDADE, p_contato: null, p_data: "2026-10-25", p_inicio: null, p_observacao: null,
  });
  const base = `/v1/condominio/reservas/${RESERVA}`;
  assertEquals(await (await m.pedir(`${base}/aprovar`, { corpo: { versao: 1, recado: "A chave fica na portaria." }, cookie })).json(), { versao: 2, recusadas: 1 });
  assertEquals(chamada(m, "plataforma_aprovar_reserva")?.p_recado, "A chave fica na portaria.");
  assertEquals((await erro(await m.pedir(`${base}/recusar`, { corpo: { versao: 1, motivo: " " }, cookie }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`${base}/cancelar`, { corpo: { versao: 2, motivo: "Obra no salão" }, cookie });
  assertEquals(chamada(m, "plataforma_cancelar_reserva"), { p_pessoa: ANA, p_condominio: AURORA, p_id: RESERVA, p_versao: 2, p_motivo: "Obra no salão" });
});

const ENQ = { pergunta: " Qual cor para a fachada? ", opcoes: ["Cinza", " Areia ", ""], por: "UNIDADE", secreta: true,
  abertaAte: "2026-10-31T23:59:00-03:00", canais: ["WHATSAPP", "MURAL", "WHATSAPP"] };

Deno.test("AC-03: criar a enquete; o banco recebe os campos limpos", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/enquetes", { corpo: ENQ, cookie });
  assertEquals(r.status, 201);
  assertEquals(await r.json(), { id: ENQUETE, versao: 1, convites: 12, envios: 14 });
  assertEquals(chamada(m, "plataforma_criar_enquete")?.p_dados, {
    pergunta: "Qual cor para a fachada?", opcoes: ["Cinza", "Areia"], por: "UNIDADE", secreta: true,
    abertaAte: "2026-10-31T23:59:00-03:00", canais: ["WHATSAPP", "MURAL"],
  });
  const ruim = await m.pedir("/v1/condominio/enquetes", { corpo: { ...ENQ, opcoes: ["Sim", "sim"], abertaAte: "amanhã", canais: [] }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["abertaAte", "canais", "opcoes"]);
});

Deno.test("AC-03: a lista, uma enquete, encerrar, publicar o resultado e copiar um link", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/enquetes", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_enquetes"), { p_pessoa: ANA, p_condominio: AURORA });
  assertEquals(await (await m.pedir(`/v1/condominio/enquetes/${ENQUETE}`, { cookie })).json(), { enquete: { id: ENQUETE }, convites: [], historico: [] });
  const base = `/v1/condominio/enquetes/${ENQUETE}`;
  assertEquals(await (await m.pedir(`${base}/encerrar`, { corpo: { versao: 2 }, cookie })).json(), { versao: 3 });
  assertEquals(chamada(m, "plataforma_encerrar_enquete"), { p_pessoa: ANA, p_condominio: AURORA, p_id: ENQUETE, p_versao: 2 });
  assertEquals((await erro(await m.pedir(`${base}/publicar`, { corpo: {}, cookie }))).detalhes?.campos, ["versao"]);
  assertEquals(await (await m.pedir(`${base}/publicar`, { corpo: { versao: 3 }, cookie })).json(), { comunicadoId: RESERVA, versao: 3 });
  assertEquals(await (await m.pedir(`${base}/link`, { corpo: { conviteId: CONVITE }, cookie })).json(), { codigo: "K7QM-3XPA-9TRE" });
  assertEquals(chamada(m, "plataforma_link_enquete")?.p_convite, CONVITE);
});

Deno.test("AC-03: o link pessoal abre e responde sem conta; código fora do formato não chega ao banco", async () => {
  const m = montar();
  assertEquals(await (await m.pedir("/v1/publico/v/K7QM-3XPA-9TRE")).json(), { pergunta: "Qual cor para a fachada?", aberta: true });
  assertEquals(chamada(m, "publico_enquete"), { p_codigo: "K7QM-3XPA-9TRE" });
  assertEquals(await (await m.pedir("/v1/publico/v/K7QM-3XPA-9TRE", { corpo: { opcao: 2 } })).json(), { escolha: 2 });
  assertEquals((await erro(await m.pedir("/v1/publico/v/K7QM-3XPA-9TRE", { corpo: { opcao: 9 } }))).detalhes?.campos, ["opcao"]);
  m.chamadas.length = 0;
  assertEquals((await m.pedir("/v1/publico/v/curto")).status, 404);
  assertEquals(chamada(m, "publico_enquete"), undefined);
});

const AGO = {
  titulo: " AGO de março ", tipo: "ORDINARIA", forma: "HIBRIDA", primeiraChamada: "2027-03-20T19:00:00-03:00", segundaChamada: "2027-03-20T19:30:00-03:00",
  local: "Salão de festas", linkVideo: "https://meet.exemplo.invalid/ago",
  itens: [{ titulo: "Contas de 2026", tipo: "APROVACAO", quorum: "MAIORIA_PRESENTES" }],
};

Deno.test("AC-02: o rascunho da assembleia vai ao banco com a pauta; mudar pede a versão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/assembleias", { corpo: AGO, cookie });
  assertEquals(r.status, 201);
  assertEquals(await r.json(), { id: ASSEMBLEIA, versao: 1 });
  assertEquals(chamada(m, "plataforma_salvar_assembleia"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_dados: { ...AGO, titulo: "AGO de março" },
  });
  const sem = await m.pedir(`/v1/condominio/assembleias/${ASSEMBLEIA}`, { metodo: "PUT", corpo: AGO, cookie });
  assertEquals((await erro(sem)).detalhes?.campos, ["versao"]);
  const ok = await m.pedir(`/v1/condominio/assembleias/${ASSEMBLEIA}`, { metodo: "PUT", corpo: { ...AGO, versao: 2 }, cookie });
  assertEquals(await ok.json(), { id: ASSEMBLEIA, versao: 3 });
  const ruim = await m.pedir("/v1/condominio/assembleias", { corpo: { ...AGO, tipo: "GERAL", itens: [] }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["tipo", "itens"]);
});

Deno.test("AC-02: convocar, conduzir a votação, encerrar e a ata", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const base = `/v1/condominio/assembleias/${ASSEMBLEIA}`;
  assertEquals((await m.pedir("/v1/condominio/assembleias", { cookie })).status, 200);
  assertEquals(await (await m.pedir(`${base}/convocar`, { corpo: { versao: 2 }, cookie })).json(), { versao: 3, unidades: 12, envios: 15 });
  assertEquals(chamada(m, "plataforma_convocar_assembleia"), { p_pessoa: ANA, p_condominio: AURORA, p_id: ASSEMBLEIA, p_versao: 2 });
  assertEquals((await erro(await m.pedir(`${base}/cancelar`, { corpo: { versao: 3, motivo: "x" }, cookie }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`${base}/iniciar`, { corpo: { versao: 3 }, cookie });
  assertEquals(await (await m.pedir(`${base}/itens/abrir`, { corpo: { itemId: ITEM }, cookie })).json(), { id: ITEM, estado: "ABERTO" });
  await m.pedir(`${base}/voto`, { corpo: { conviteId: CONVITE, itemId: ITEM, opcao: 1 }, cookie });
  assertEquals(chamada(m, "plataforma_registrar_voto"), { p_pessoa: ANA, p_condominio: AURORA, p_id: ASSEMBLEIA, p_convite: CONVITE, p_item: ITEM, p_opcao: 1 });
  await m.pedir(`${base}/presenca`, { corpo: { conviteId: CONVITE, presente: true }, cookie });
  assertEquals(chamada(m, "plataforma_presenca_assembleia")?.p_presente, true);
  await m.pedir(`${base}/procuracao`, { corpo: { conviteId: CONVITE, aceitar: false, motivo: "Sem firma reconhecida" }, cookie });
  assertEquals(chamada(m, "plataforma_procuracao")?.p_motivo, "Sem firma reconhecida");
  await m.pedir(`${base}/direito`, { corpo: { conviteId: CONVITE, semDireito: false }, cookie });
  assertEquals(chamada(m, "plataforma_direito_voto")?.p_motivo, null);
  await m.pedir(`${base}/itens/encerrar`, { corpo: { itemId: ITEM }, cookie });
  await m.pedir(`${base}/encerrar`, { corpo: { versao: 4 }, cookie });
  await m.pedir(`${base}/ata`, { metodo: "PUT", corpo: { versao: 5, texto: "Presidente: Ana" }, cookie });
  assertEquals(chamada(m, "plataforma_ata_assembleia"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: ASSEMBLEIA, p_versao: 5, p_texto: "Presidente: Ana", p_documento: null,
  });
  assertEquals(await (await m.pedir(`${base}/link`, { corpo: { conviteId: CONVITE }, cookie })).json(), { codigo: "K7QM-3XPA-9TRE" });
});

Deno.test("AC-02: as regras da convenção e as frações ideais", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir("/v1/condominio/assembleias/regras", { metodo: "PUT", corpo: { versao: 3, antecedencia: 15, peso: "UNIDADE" }, cookie });
  assertEquals(chamada(m, "plataforma_regras_assembleia"), { p_pessoa: ANA, p_condominio: AURORA, p_versao: 3, p_antecedencia: 15, p_peso: "UNIDADE" });
  const ruim = await m.pedir("/v1/condominio/assembleias/regras", { metodo: "PUT", corpo: { versao: 3, antecedencia: 90, peso: "METRO" }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["antecedencia", "peso"]);
  assertEquals((await m.pedir("/v1/condominio/fracoes", { cookie })).status, 200);
  const f = [{ unidadeId: UNIDADE, fracao: 2.5, versao: 1 }];
  assertEquals(await (await m.pedir("/v1/condominio/fracoes", { metodo: "PUT", corpo: { fracoes: f }, cookie })).json(), { alteradas: 1, soma: 40 });
  assertEquals(chamada(m, "plataforma_salvar_fracoes")?.p_fracoes, f);
});

Deno.test("AC-02: o link pessoal da assembleia abre, vota e indica procurador sem conta", async () => {
  const m = montar();
  assertEquals(await (await m.pedir("/v1/publico/a/K7QM-3XPA-9TRE")).json(), { titulo: "AGO de março", estado: "CONVOCADA" });
  assertEquals(await (await m.pedir("/v1/publico/a/K7QM-3XPA-9TRE/voto", { corpo: { itemId: ITEM, opcao: 2 } })).json(), { itens: [{ id: ITEM, meuVoto: 2 }] });
  assertEquals((await erro(await m.pedir("/v1/publico/a/K7QM-3XPA-9TRE/voto", { corpo: { itemId: ITEM, opcao: 0 } }))).detalhes?.campos, ["opcao"]);
  await m.pedir("/v1/publico/a/K7QM-3XPA-9TRE/procuracao", { corpo: { nome: " Rui Lima ", unidadeId: UNIDADE } });
  assertEquals(chamada(m, "publico_procuracao_assembleia"), { p_codigo: "K7QM-3XPA-9TRE", p_nome: "Rui Lima", p_unidade_procurador: UNIDADE });
  m.chamadas.length = 0;
  assertEquals((await m.pedir("/v1/publico/a/curto")).status, 404);
  assertEquals(chamada(m, "publico_assembleia"), undefined);
});
