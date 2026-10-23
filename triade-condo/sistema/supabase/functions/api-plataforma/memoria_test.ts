// Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04). O prontuário aceita o item
// sugerido pela chave ou o item guardado pelo id; a exportação é montada aqui, pacote por pacote,
// e só sai por link curto; a rota interna pede o segredo de repasse.
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const ITEM = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const DOC = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const EXP = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const PARTE = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const PARTE2 = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const VERSAO = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar(extra: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const partes = [
    { condominio: AURORA, exportacao: EXP, parte: PARTE, numero: 1, tipo: "DADOS", caminho: `${AURORA}/${EXP}/${PARTE}`, arquivos: [] },
    {
      condominio: AURORA, exportacao: EXP, parte: PARTE2, numero: 2, tipo: "ARQUIVOS", caminho: `${AURORA}/${EXP}/${PARTE2}`,
      arquivos: [
        { b: "documentos", c: `${AURORA}/${DOC}/${VERSAO}`, n: "documentos/Convenção/v1-convencao.pdf" },
        { b: "pedidos", c: `${AURORA}/${DOC}/${ITEM}`, n: "pedidos/2026-0001/sumiu.jpg" },
      ],
    },
  ];
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
    plataforma_prontuario: () => ({ itens: [], resumo: { falta: 14 } }),
    plataforma_item_prontuario: (a) => ({ id: a.p_id ?? ITEM, versao: 2 }),
    plataforma_linha_do_tempo: () => ({ eventos: [] }),
    plataforma_salvar_anotacao: () => ({ id: ITEM, versao: 1 }),
    plataforma_salvar_secao_manual: () => ({ id: ITEM, versao: 1 }),
    plataforma_ordem_manual: () => ({ ok: true }),
    plataforma_gerar_dossie: () => ({ id: ITEM }),
    plataforma_exportacoes: () => ({ exportacoes: [], podePedir: true, montando: true }),
    plataforma_pedir_exportacao: () => ({ id: EXP, pacotes: 2 }),
    plataforma_baixar_exportacao: () => ({ caminho: `${AURORA}/${EXP}/${PARTE}`, arquivo: "triade-2026-10-18-dados.zip" }),
    exportacao_pegar_parte: () => partes.shift() ?? null,
    exportacao_dados: () => ({ condominio: { nome: "Residencial Aurora" }, tabelas: { anotacoes_memoria: [{ id: ITEM, titulo: "Muro; lote 12" }] } }),
    exportacao_parte_pronta: () => ({ ok: true }),
    ...extra,
  });
  const documentos = armazenamentoFalso();
  documentos.objetos.set(`${AURORA}/${DOC}/${VERSAO}`, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  const exportacoes = armazenamentoFalso();
  const fundo: Promise<unknown>[] = [];
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoManutencao: armazenamentoFalso().armazenamento,
    armazenamentoComunicados: armazenamentoFalso().armazenamento, armazenamentoDocumentos: documentos.armazenamento,
    armazenamentoExportacoes: exportacoes.armazenamento, aoFundo: (p) => fundo.push(p),
  });
  return { pedir: pedido(app, "api-plataforma"), exportacoes, fundo, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("MP-12: o prontuário pede sessão; o item sugerido vai pela chave e o guardado pelo id", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/memoria/prontuario")).status, 401);
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/memoria/prontuario", { cookie })).json()).resumo.falta, 14);
  assertEquals((await m.pedir("/v1/condominio/memoria/prontuario/itens/AVCB", { cookie, corpo: { acao: "LIGAR", documentoId: DOC } })).status, 200);
  assertEquals(chamada(m, "plataforma_item_prontuario"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_chave: "AVCB", p_versao: null, p_acao: "LIGAR", p_nome: null, p_grupo: null,
    p_documento: DOC, p_avisar_dias: 60, p_motivo: null,
  });
  await m.pedir(`/v1/condominio/memoria/prontuario/itens/${ITEM}`, { cookie, corpo: { acao: "NAO_SE_APLICA", versao: 3, motivo: "Prédio sem poço" } });
  assertEquals(chamada(m, "plataforma_item_prontuario")?.p_id, ITEM);
  assertEquals(chamada(m, "plataforma_item_prontuario")?.p_motivo, "Prédio sem poço");
  assertEquals((await m.pedir("/v1/condominio/memoria/prontuario/itens/avcb", { cookie, corpo: { acao: "VALE" } })).status, 404);
  const r = await m.pedir("/v1/condominio/memoria/prontuario/itens/AVCB", { cookie, corpo: { acao: "NAO_SE_APLICA", motivo: "" } });
  assertEquals((await erro(r)).codigo, "VALIDATION_ERROR");
  assertEquals((await m.pedir("/v1/condominio/memoria/prontuario/itens", { cookie, corpo: { nome: "Licença do gerador", grupo: "LAUDOS" } })).status, 201);
  assertEquals(chamada(m, "plataforma_item_prontuario")?.p_acao, "CRIAR");
});

Deno.test("CT-03: a linha do tempo filtra e a anotação liga a uma coisa só", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir("/v1/condominio/memoria/linha-do-tempo?filtro=ANOTADO&antes=2026-01-01", { cookie });
  assertEquals(chamada(m, "plataforma_linha_do_tempo"), { p_pessoa: ANA, p_condominio: AURORA, p_filtro: "ANOTADO", p_antes: "2026-01-01" });
  assertEquals((await m.pedir("/v1/condominio/memoria/linha-do-tempo?filtro=QUALQUER", { cookie })).status, 400);
  const base = { tipo: "COMBINADO", titulo: "Muro com o lote 12", texto: "Metade cada", aconteceuEm: "2026-10-10" };
  assertEquals((await m.pedir("/v1/condominio/memoria/anotacoes", { cookie, corpo: { ...base, documentoId: DOC, manutencaoId: DOC } })).status, 400);
  assertEquals((await m.pedir("/v1/condominio/memoria/anotacoes", { cookie, corpo: base })).status, 201);
  assertEquals((await m.pedir(`/v1/condominio/memoria/anotacoes/${ITEM}`, { cookie, metodo: "PUT", corpo: base })).status, 400);
});

Deno.test("MP-14: a ordem do manual vai inteira", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/memoria/manual/ordem", { cookie, metodo: "PUT", corpo: { ids: [ITEM, DOC] } })).status, 200);
  assertEquals(chamada(m, "plataforma_ordem_manual")?.p_ids, [ITEM, DOC]);
  assertEquals((await m.pedir("/v1/condominio/memoria/manual", { cookie, corpo: { titulo: "Água e gás", texto: "Registro na casa de bombas" } })).status, 201);
});

Deno.test("CT-04: pedir a exportação monta os pacotes ao fundo; o pacote sai só por link curto", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/memoria/exportacoes", { cookie, metodo: "POST" })).status, 201);
  await Promise.all(m.fundo);
  const dados = m.exportacoes.objetos.get(`${AURORA}/${EXP}/${PARTE}`)!;
  const texto = new TextDecoder().decode(dados);
  assert(texto.includes("dados.json") && texto.includes("planilhas/anotacoes_memoria.csv") && texto.includes("LEIA-ME.txt"));
  const arquivos = new TextDecoder().decode(m.exportacoes.objetos.get(`${AURORA}/${EXP}/${PARTE2}`)!);
  assert(arquivos.includes("documentos/Convenção/v1-convencao.pdf"));
  assert(arquivos.includes("arquivos-que-nao-vieram.txt"));
  assertEquals(m.chamadas.filter((c) => c.funcao === "exportacao_parte_pronta").map((c) => c.args.p_erro), [null, null]);

  const r = await (await m.pedir(`/v1/condominio/memoria/exportacoes/${EXP}/pacotes/1/link`, { cookie })).json();
  assertEquals(r.arquivo, "triade-2026-10-18-dados.zip");
  assertEquals(m.exportacoes.links.at(-1)?.baixarComo, "triade-2026-10-18-dados.zip");
  assertEquals((await m.pedir(`/v1/condominio/memoria/exportacoes/${EXP}/pacotes/x/link`, { cookie })).status, 404);
});

Deno.test("CT-04: a rota interna da exportação pede o segredo de repasse", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/interno/exportacao", { metodo: "POST", corpo: {}, segredo: null })).status, 403);
  assertEquals((await (await m.pedir("/v1/interno/exportacao", { metodo: "POST", corpo: {} })).json()).montados, 2);
});

Deno.test("CT-02 (D4.18): o que vai no dossiê hoje conta com as leituras das telas e os cortes do dossiê", async () => {
  const m = montar({
    plataforma_linha_do_tempo: () => ({ eventos: Array.from({ length: 52 }) }),
    plataforma_pessoas: () => ({ pessoas: [{}, {}, {}] }),
    plataforma_agenda: () => ({ compromissos: [{ estado: "MARCADO" }, { estado: "CANCELADO" }, { estado: "REALIZADO" }, { estado: "MARCADO" }] }),
  });
  assertEquals((await erro(await m.pedir("/v1/condominio/memoria/dossie-hoje?de=2026-10-23"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/memoria/dossie-hoje?de=2026-10-23", { cookie });
  assertEquals(await r.json(), { anotacoes: 40, acesso: 3, compromissos: 2 });
  assertEquals(chamada(m, "plataforma_linha_do_tempo"), { p_pessoa: ANA, p_condominio: AURORA, p_filtro: "ANOTADO", p_antes: null });
  assertEquals(chamada(m, "plataforma_agenda"), { p_pessoa: ANA, p_condominio: AURORA, p_de: "2026-10-23", p_ate: "2026-12-22" });
  assertEquals((await m.pedir("/v1/condominio/memoria/dossie-hoje?de=ontem", { cookie })).status, 400);
  const sem = montar();
  assertEquals(await (await sem.pedir("/v1/condominio/memoria/dossie-hoje?de=2026-10-23", { cookie: await entrar(sem) })).json(),
    { anotacoes: 0, acesso: null, compromissos: null });
});

Deno.test("MP-12 (D4.18): guardar e ligar numa chamada só; se a ligação falha, o documento fica guardado", async () => {
  let falhar = false;
  const m = montar({
    plataforma_salvar_documento: () => ({ id: DOC, versao: 1 }),
    plataforma_item_prontuario: (a) => (falhar ? erroBanco("TC409") : { id: ITEM, versao: Number(a.p_versao ?? 0) + 1 }),
  });
  const cookie = await entrar(m);
  const corpo = { documento: { tipo: "LAUDO", titulo: "AVCB 2026", valeAte: "2027-10-01" }, versao: 2, avisarDias: 30 };
  const r = await m.pedir("/v1/condominio/memoria/prontuario/itens/AVCB/documento", { cookie, corpo });
  assertEquals([r.status, await r.json()], [201, { id: DOC, ligado: true }]);
  assertEquals(chamada(m, "plataforma_salvar_documento"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_tipo: "LAUDO", p_titulo: "AVCB 2026", p_descricao: null,
    p_restrito: false, p_ao_morador: false, p_vale_ate: "2027-10-01",
  });
  assertEquals(chamada(m, "plataforma_item_prontuario"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_chave: "AVCB", p_versao: 2, p_acao: "LIGAR", p_nome: null, p_grupo: null,
    p_documento: DOC, p_avisar_dias: 30, p_motivo: null,
  });
  falhar = true;
  assertEquals(await (await m.pedir("/v1/condominio/memoria/prontuario/itens/AVCB/documento", { cookie, corpo })).json(), { id: DOC, ligado: false });
  const ruim = await m.pedir("/v1/condominio/memoria/prontuario/itens/AVCB/documento", { cookie, corpo: { documento: { tipo: "LAUDO", titulo: "A" } } });
  assertEquals((await erro(ruim)).codigo, "VALIDATION_ERROR");
  const antes = m.chamadas.filter((x) => x.funcao === "plataforma_salvar_documento").length;
  assertEquals((await m.pedir("/v1/condominio/memoria/prontuario/itens/avcb/documento", { cookie, corpo })).status, 404);
  assertEquals(m.chamadas.filter((x) => x.funcao === "plataforma_salvar_documento").length, antes);
});
