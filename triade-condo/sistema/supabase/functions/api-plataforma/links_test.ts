// Links e QR (peça R13; AT-30, MP-08, V-11). As etiquetas e o link do prestador do lado do
// síndico só com sessão; as rotas sem conta só aceitam o código e contam o uso por aparelho; a
// foto do prestador passa pela mesma conferência dos pedidos.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const ETIQUETA = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const MANUTENCAO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const LINK = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const FOTO = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const CODIGO_ETIQUETA = "R7TW-2KHM-9QXF";
const CODIGO = "Zm9vYmFyYmF6cXV4LWNvZGlnby1kZS10ZXN0ZQ";
const CAMINHO = `${AURORA}/${MANUTENCAO}/prestador/${FOTO}`;
const CODIGO_ENCERRADO = "ZW5jZXJyYWRvLWVuY2VycmFkby1lbmNlcnJhZG8tdGVzdGU";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);

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
    plataforma_links_qr: () => ({ etiquetas: [], numeroWhatsapp: "+5561990001234" }),
    plataforma_locais: () => ["Casa de bombas"],
    plataforma_salvar_etiqueta: (a) => ({ id: ETIQUETA, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_trocar_codigo_etiqueta: (a) => ({ versao: Number(a.p_versao) + 1, codigo: "AAAA-BBBB-CCCC" }),
    plataforma_desativar_etiqueta: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_criar_link_prestador: () => ({ id: LINK, codigo: CODIGO, versao: 5 }),
    plataforma_envio_link_prestador: () => ({ ok: true }),
    plataforma_cancelar_link_prestador: () => ({ ok: true }),
    publico_etiqueta: () => ({ condominio: "Residencial Aurora", local: "Casa de bombas", rotulo: "E03", whatsapp: "5561990001234" }),
    publico_prestador: () => ({ condominio: "Residencial Aurora", titulo: "Bomba com ruído" }),
    publico_prestador_chegada: (a) => ({ confirmado: a.p_etiqueta === CODIGO_ETIQUETA }),
    publico_prestador_iniciar_foto: () => ({ arquivoId: FOTO, caminho: CAMINHO, tipo: "image/jpeg" }),
    publico_prestador_foto_a_verificar: () => ({ caminho: CAMINHO, tipo: "image/jpeg" }),
    publico_prestador_verificar_foto: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    publico_prestador_impedimento: () => ({ ok: true }),
    publico_prestador_terminei: () => ({ ok: true }),
    publico_prestador_foto: (a) =>
      a.p_codigo === CODIGO_ENCERRADO ? erroBanco("TC422", { motivo: "LINK_ENCERRADO" })
      : a.p_arquivo === FOTO ? { caminho: CAMINHO, nome: "depois.jpg", tipo: "image/jpeg" } : erroBanco("TC404"),
  });
  const manutencao = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoManutencao: manutencao.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), manutencao, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("AT-30: as etiquetas pedem sessão e o recado precisa da data em que some", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/links-qr")).status, 401);
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/links-qr", { cookie })).json()).numeroWhatsapp, "+5561990001234");
  assertEquals(await (await m.pedir("/v1/condominio/locais", { cookie })).json(), ["Casa de bombas"]);
  assertEquals((await erro(await m.pedir("/v1/condominio/etiquetas", { cookie, corpo: { local: "Garagem", recado: "Já sabemos" } }))).detalhes?.campos,
    ["recadoAte"]);
  const r = await m.pedir("/v1/condominio/etiquetas", { cookie, corpo: { local: " Garagem ", onde: "", recado: "Já sabemos", recadoAte: "2026-10-25" } });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_salvar_etiqueta"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_local: "Garagem", p_onde: null, p_recado: "Já sabemos", p_recado_ate: "2026-10-25",
  });
  assertEquals((await erro(await m.pedir(`/v1/condominio/etiquetas/${ETIQUETA}`, { metodo: "PUT", cookie, corpo: { local: "Garagem" } }))).detalhes?.campos,
    ["versao"]);
});

Deno.test("AT-30: trocar o código e desativar pedem motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/condominio/etiquetas/${ETIQUETA}/trocar-codigo`, { cookie, corpo: { versao: 2, motivo: "" } }))).detalhes?.campos,
    ["motivo"]);
  const r = await (await m.pedir(`/v1/condominio/etiquetas/${ETIQUETA}/trocar-codigo`, { cookie, corpo: { versao: 2, motivo: "Cópia no vizinho" } })).json();
  assertEquals(r.codigo, "AAAA-BBBB-CCCC");
  await m.pedir(`/v1/condominio/etiquetas/${ETIQUETA}/desativar`, { cookie, corpo: { versao: 3, motivo: "Sala fechada" } });
  assertEquals(chamada(m, "plataforma_desativar_etiqueta"), { p_pessoa: ANA, p_condominio: AURORA, p_id: ETIQUETA, p_versao: 3, p_motivo: "Sala fechada" });
});

Deno.test("AT-30: a página da etiqueta só com o código, com limite por aparelho", async () => {
  const m = montar();
  assertEquals((await (await m.pedir(`/v1/publico/etiqueta/${CODIGO_ETIQUETA}`)).json()).rotulo, "E03");
  assertEquals((await m.pedir("/v1/publico/etiqueta/curto")).status, 404);
  await m.pedir(`/v1/publico/etiqueta/${CODIGO_ETIQUETA}`);
  assertEquals((await erro(await m.pedir(`/v1/publico/etiqueta/${CODIGO_ETIQUETA}`))).codigo, "RATE_LIMITED");
});

Deno.test("V-11: mandar o link ao prestador valida o que vai e devolve o código uma vez", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const url = `/v1/condominio/manutencao/${MANUTENCAO}/link-prestador`;
  assertEquals((await erro(await m.pedir(url, { cookie, corpo: { versao: 4, oQueFazer: "Trocar", valeAte: "2026-10-31" } }))).detalhes?.campos, ["oQueFazer"]);
  const r = await m.pedir(url, { cookie, corpo: { versao: 4, oQueFazer: "Trocar o rolamento da bomba 2", valeAte: "2026-10-31", quando: "Hoje, 14h" } });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).codigo, CODIGO);
  assertEquals(chamada(m, "plataforma_criar_link_prestador"), {
    p_pessoa: ANA, p_condominio: AURORA, p_manutencao: MANUTENCAO, p_versao: 4, p_o_que_fazer: "Trocar o rolamento da bomba 2",
    p_quando: "Hoje, 14h", p_como_entrar: null, p_vale_ate: "2026-10-31", p_arquivos: [], p_responder_horas: null,
  });
  assertEquals((await erro(await m.pedir(`${url}/${LINK}/envio`, { cookie, corpo: { canal: "SMS" } }))).detalhes?.campos, ["canal"]);
  assertEquals((await m.pedir(`${url}/${LINK}/envio`, { cookie, corpo: { canal: "WHATSAPP" } })).status, 200);
  assertEquals((await erro(await m.pedir(`${url}/${LINK}/cancelar`, { cookie, corpo: { motivo: "x" } }))).detalhes?.campos, ["motivo"]);
});

Deno.test("V-11, MP-08: o prestador abre o serviço, registra a chegada e conta o que fez", async () => {
  const m = montar();
  const base = `/v1/publico/p/${CODIGO}`;
  assertEquals((await (await m.pedir(base)).json()).titulo, "Bomba com ruído");
  assertEquals((await m.pedir("/v1/publico/p/x")).status, 404);
  assertEquals(await (await m.pedir(`${base}/chegada`, { corpo: { etiqueta: CODIGO_ETIQUETA } })).json(), { confirmado: true });
  assertEquals(await (await m.pedir(`${base}/chegada`, { corpo: {} })).json(), { confirmado: false });
  assertEquals((await erro(await m.pedir(`${base}/impedimento`, { corpo: { impedimento: "CHUVA", texto: "Choveu muito" } }))).detalhes?.campos,
    ["impedimento"]);
  assertEquals((await m.pedir(`${base}/impedimento`, { corpo: { impedimento: "SEM_ACESSO", texto: "Ninguém com a chave" } })).status, 200);
  assertEquals((await erro(await m.pedir(`${base}/terminei`, { corpo: { texto: "Troquei", ficouPendente: true, quemFez: "Márcio" } }))).detalhes?.campos,
    ["pendenteTexto"]);
  await m.pedir(`${base}/terminei`, { corpo: { texto: "Troquei o rolamento", ficouPendente: false, quemFez: "Márcio", fotos: [FOTO] } });
  assertEquals(chamada(m, "publico_prestador_terminei"), {
    p_codigo: CODIGO, p_texto: "Troquei o rolamento", p_ficou_pendente: false, p_pendente_texto: null, p_quem_fez: "Márcio", p_fotos: [FOTO],
  });
});

Deno.test("V-11: a foto do prestador passa pela conferência; o que não é foto de verdade sai do armazenamento", async () => {
  const m = montar();
  const base = `/v1/publico/p/${CODIGO}/fotos`;
  const r = await (await m.pedir(base, { corpo: { nome: "depois.jpg", tipo: "image/jpeg", tamanho: JPG.length } })).json();
  assertEquals(r.envio.url, `https://armazenamento.exemplo/envio/${CAMINHO}?token=t`);
  m.manutencao.objetos.set(CAMINHO, JPG);
  assertEquals(await (await m.pedir(`${base}/${FOTO}/verificar`, { corpo: {} })).json(), { situacao: "LIBERADO" });
  m.manutencao.objetos.set(CAMINHO, new TextEncoder().encode("<script>alert(1)</script>"));
  const ruim = await (await m.pedir(`${base}/${FOTO}/verificar`, { corpo: {} })).json();
  assertEquals(ruim.situacao, "NAO_LIBERADO");
  assertEquals(m.manutencao.apagados, [CAMINHO]);
});

Deno.test("V-11 (0297): a foto que o prestador mandou abre pela página, só a do link e só enquanto vale", async () => {
  const m = montar();
  const r = await m.pedir(`/v1/publico/p/${CODIGO}/fotos/${FOTO}`);
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { url: `https://armazenamento.exemplo/ler/${CAMINHO}?token=t`, nome: "depois.jpg", tipo: "image/jpeg" });
  assertEquals(chamada(m, "publico_prestador_foto"), { p_codigo: CODIGO, p_arquivo: FOTO });
  assertEquals(m.manutencao.links.at(-1)?.segundos, 300);
  assertEquals((await m.pedir(`/v1/publico/p/${CODIGO}/fotos/${LINK}`)).status, 404);
  assertEquals((await m.pedir(`/v1/publico/p/${CODIGO}/fotos/nao-e-id`)).status, 404);
  const fechado = await erro(await m.pedir(`/v1/publico/p/${CODIGO_ENCERRADO}/fotos/${FOTO}`));
  assertEquals(fechado.detalhes?.motivo, "LINK_ENCERRADO");
});
