// Portaria 1 · Encomendas (PA-01, PA-07, V-04, CF-12, W-20, W-21) na Plataforma do síndico: a API
// valida a entrada, repassa ao banco quem está na sessão e cuida das fotos no bucket "portaria".
// Quem pode o quê, o cenário e quem recebe o aviso ficam no banco (042_encomendas_test.sql).
import { assert, assertEquals, assertMatch } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { NUMERO_FORA_DO_WHATSAPP, conectorWafly, textoNumeroForaDoWhatsapp } from "../_shared/whatsapp.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const JOAO = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AGUA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const UNIDADE = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const LUGAR = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ENCOMENDA = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const FOTO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const CONTATO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const ENTRAR = { email: "joao@exemplo.invalid", senha: "senha-do-porteiro" };
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
const CAMINHO = `${AGUA}/${ENCOMENDA}/${FOTO}`;

function montar() {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: JOAO, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const portaria = armazenamentoFalso();
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AGUA, nome: "Residencial Águas Claras", funcoes: ["AUTORIZADO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AGUA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_encomendas: () => ({ itens: [], total: 0, contagens: { GUARDADAS: 6, ENTREGUES: 12, ANTIGAS: 1, AVISO_FALHOU: 1, SEM_AVISO: 2 } }),
    plataforma_registrar_encomenda: () => ({ id: ENCOMENDA, avisos: 1, encomenda: { id: ENCOMENDA, aviso: "AVISADA" } }),
    plataforma_entregar_encomenda: () => ({ id: ENCOMENDA, estado: "ENTREGUE" }),
    plataforma_avisei_encomenda: () => ({ id: ENCOMENDA, aviso: "OUTRO_MEIO" }),
    plataforma_avisar_encomenda: () => ({ avisos: 1 }),
    plataforma_encomenda_quem: () => ({ pessoas: [{ contatoId: CONTATO, nome: "Marina Lopes", recebe: true }] }),
    plataforma_iniciar_foto_encomenda: () => ({ fotoId: FOTO, caminho: CAMINHO, tipo: "image/jpeg" }),
    plataforma_foto_encomenda_a_verificar: () => ({ caminho: CAMINHO, tipo: "image/jpeg" }),
    plataforma_verificar_foto_encomenda: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_foto_encomenda: () => ({ caminho: CAMINHO, nome: "etiqueta.jpg", tipo: "image/jpeg" }),
    plataforma_definir_portaria: () => 4,
    plataforma_configuracoes: () => ({}),
    plataforma_portaria: () => ({ lembreteDias: 7 }),
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoPortaria: portaria.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), portaria, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AGUA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("PA-01: registrar leva quem está na sessão e já sai com o aviso", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/encomendas", {
    corpo: { unidadeId: UNIDADE, remetente: "  Mercado   Livre ", volumes: 1, lugarId: LUGAR, observacao: "" }, cookie,
  });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).avisos, 1);
  assertEquals(chamada(m, "plataforma_registrar_encomenda"), {
    p_pessoa: JOAO, p_condominio: AGUA, p_unidade: UNIDADE, p_remetente: "Mercado Livre", p_volumes: 1, p_lugar: LUGAR, p_observacao: null,
  });
});

Deno.test("PA-01: registro sem unidade ou com volumes demais nem chega ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/encomendas", { corpo: { remetente: "Amazon", volumes: 60, lugarId: LUGAR }, cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["unidadeId", "volumes"]);
  assertEquals(chamada(m, "plataforma_registrar_encomenda"), undefined);
});

Deno.test("PA-01: a lista com abas, atalhos e a busca; as contagens do menu", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/encomendas?aba=GUARDADAS&atalho=ANTIGAS&busca=101", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_encomendas"), {
    p_pessoa: JOAO, p_condominio: AGUA, p_aba: "GUARDADAS", p_atalho: "ANTIGAS", p_busca: "101", p_pagina: 1,
  });
  assertEquals((await m.pedir("/v1/condominio/encomendas?aba=ENTREGUES&atalho=SEM_AVISO", { cookie })).status, 400);
  const n = await (await m.pedir("/v1/condominio/contagens/encomendas", { cookie })).json();
  assertEquals(n.SEM_AVISO + n.AVISO_FALHOU, 3);
});

Deno.test("W-21: entregar registra quem retirou, sem código", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/entregar`, { corpo: { contatoId: CONTATO }, cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_entregar_encomenda"), {
    p_pessoa: JOAO, p_condominio: AGUA, p_id: ENCOMENDA, p_contato: CONTATO, p_nome: null, p_ligacao: null,
  });
  const r = await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/entregar`, { corpo: { contatoId: CONTATO, nome: "Outro" }, cookie });
  assertEquals(r.status, 400);
  assertEquals((await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/entregar`, { corpo: {}, cookie })).status, 400);
});

Deno.test("PA-01: avisar de novo e avisei por outro meio", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/avisar`, { metodo: "POST", cookie })).status, 200);
  assertEquals((await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/outro-meio`, { corpo: { meio: "INTERFONE", com: " Lúcia Ramos " }, cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_avisei_encomenda")?.p_com, "Lúcia Ramos");
  assertEquals((await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/outro-meio`, { corpo: { meio: "EMAIL" }, cookie })).status, 400);
});

Deno.test("PA-01: a foto da etiqueta é conferida antes de liberar e abre por link curto", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/fotos`, {
    corpo: { tipoFoto: "ETIQUETA", nome: "etiqueta.jpg", tipo: "image/jpeg", tamanho: JPG.length }, cookie,
  });
  assertEquals(r.status, 201);
  assertMatch((await r.json()).envio.url, /envio\/.*\?token=t/);
  m.portaria.objetos.set(CAMINHO, JPG);
  const v = await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/fotos/${FOTO}/verificar`, { metodo: "POST", cookie });
  assertEquals((await v.json()).situacao, "LIBERADO");
  assertEquals(chamada(m, "plataforma_verificar_foto_encomenda")?.p_tamanho, JPG.length);
  const l = await (await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/fotos/${FOTO}/link`, { cookie })).json();
  assertMatch(l.url, /ler\//);
  assertEquals(m.portaria.links[0]!.segundos, 300);
});

Deno.test("PA-01: foto que não é imagem é recusada e apagada", async () => {
  const m = montar();
  const cookie = await entrar(m);
  m.portaria.objetos.set(CAMINHO, new TextEncoder().encode("não é uma foto"));
  const v = await (await m.pedir(`/v1/condominio/encomendas/${ENCOMENDA}/fotos/${FOTO}/verificar`, { metodo: "POST", cookie })).json();
  assertEquals(v.situacao, "NAO_LIBERADO");
  assertEquals(m.portaria.apagados, [CAMINHO]);
});

Deno.test("CF-12: Configurações › Portaria e a entrada das configurações", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/portaria", { metodo: "PUT", corpo: { versao: 3, lembreteLigado: true, lembreteDias: 7, sindicoIndicado: false }, cookie });
  assertEquals(await r.json(), { versao: 4 });
  assertEquals((await m.pedir("/v1/condominio/portaria", { metodo: "PUT", corpo: { versao: 3, lembreteLigado: true, lembreteDias: 0, sindicoIndicado: false }, cookie })).status, 400);
  await m.pedir("/v1/condominio/configuracoes/entrada", { cookie });
  assert(m.chamadas.some((c) => c.funcao === "plataforma_portaria"));
});

Deno.test("PA-01: o número que não está no WhatsApp vira um motivo que o banco reconhece", async () => {
  for (const t of ["Phone number does not exist", "The number is not on WhatsApp", "O número não está no WhatsApp", '{"exists": false}']) {
    assert(NUMERO_FORA_DO_WHATSAPP.test(t), t);
  }
  assert(!NUMERO_FORA_DO_WHATSAPP.test("Instance disconnected"));
  assertEquals(textoNumeroForaDoWhatsapp("x").startsWith("O número não está no WhatsApp"), true);
  const buscar = (() => Promise.resolve(Response.json({ error: "Phone number does not exist" }, { status: 400 }))) as typeof fetch;
  const c = conectorWafly("client-token", buscar, "https://wafly.invalid/api-bridge-whats");
  const r = await c.enviarTexto({ instancia: "i", token: "t" } as never, "+5561999990003", "Oi");
  assertEquals(r, { ok: false, erro: "O número não está no WhatsApp (Phone number does not exist)", falha: "PERMANENTE" });
});
