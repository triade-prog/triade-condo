// Relatório do mês para a assembleia (TR-02, TR-05, TR-08, TR-10). A rota valida o mês, as
// partes e os anexos; o anexo enviado só é liberado depois de conferido; o link de cada anexo sai
// do armazenamento certo (o dos relatórios ou o dos documentos), por 5 minutos.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const REL = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ARQ = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const DOC = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
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
    plataforma_relatorios: () => ({ mesFechado: "2026-09", gerados: [] }),
    plataforma_previa_relatorio: (a) => ({ mes: a.p_mes, foraPorPermissao: [] }),
    plataforma_gerar_relatorio: () => ({ id: REL, mes: "2026-09", numero: 1 }),
    plataforma_relatorio: () => ({ id: REL }),
    plataforma_iniciar_anexo_relatorio: () => ({ arquivoId: ARQ, caminho: `${AURORA}/${ANA}/${ARQ}`, tipo: "application/pdf" }),
    plataforma_anexo_relatorio_a_verificar: () => ({ caminho: `${AURORA}/${ANA}/${ARQ}`, tipo: "application/pdf" }),
    plataforma_verificar_anexo_relatorio: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_anexo_relatorio: (a) => a.p_ordem === 1
      ? { armazenamento: "documentos", caminho: `${AURORA}/${DOC}/${ARQ}`, nome: "contrato.pdf", tipo: "application/pdf" }
      : { armazenamento: "relatorios", caminho: `${AURORA}/${ANA}/${ARQ}`, nome: "foto.jpg", tipo: "image/jpeg" },
    plataforma_relatorio_baixado: () => null,
  });
  const relatorios = armazenamentoFalso();
  const documentos = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoDocumentos: documentos.armazenamento,
    armazenamentoRelatorios: relatorios.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), relatorios, documentos, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("TR-02: a prévia pede sessão e o mês como 2026-09", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/relatorios/previa?mes=2026-09")).status, 401);
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/relatorios/previa?mes=2026-09", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_previa_relatorio"), { p_pessoa: ANA, p_condominio: AURORA, p_mes: "2026-09" });
  assertEquals((await erro(await m.pedir("/v1/condominio/relatorios/previa?mes=setembro", { cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals((await m.pedir("/v1/condominio/relatorios", { cookie })).status, 200);
});

Deno.test("TR-10: gerar manda as partes, os textos, os anexos e o modelo; parte desconhecida não passa", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = {
    mes: "2026-09", partes: ["RESUMO", "ATENDIMENTO", "TORRE"], resumo: "  Setembro com 45 pedidos.  ", palavra: "",
    anexos: [{ documentoId: DOC }, { arquivoId: ARQ }], guardarModelo: true,
  };
  assertEquals((await m.pedir("/v1/condominio/relatorios", { cookie, corpo })).status, 201);
  assertEquals(chamada(m, "plataforma_gerar_relatorio"), {
    p_pessoa: ANA, p_condominio: AURORA, p_mes: "2026-09", p_partes: ["RESUMO", "ATENDIMENTO", "TORRE"], p_resumo: "Setembro com 45 pedidos.",
    p_palavra: null, p_anexos: [{ documentoId: DOC }, { arquivoId: ARQ }], p_guardar_modelo: true,
  });
  assertEquals((await m.pedir("/v1/condominio/relatorios", { cookie, corpo: { ...corpo, partes: ["OUTRA"] } })).status, 400);
  assertEquals((await m.pedir("/v1/condominio/relatorios", { cookie, corpo: { ...corpo, anexos: [{ arquivoId: ARQ, documentoId: DOC }] } })).status, 400);
  const onze = Array.from({ length: 11 }, () => ({ arquivoId: ARQ }));
  assertEquals((await m.pedir("/v1/condominio/relatorios", { cookie, corpo: { ...corpo, anexos: onze } })).status, 400);
});

Deno.test("PT-07: o anexo só sai liberado depois de conferido; o que não confere é apagado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/relatorios/anexos", { cookie, corpo: { nome: "planta.webp", tipo: "image/webp", tamanho: 10 } })).status, 400);
  const r = await m.pedir("/v1/condominio/relatorios/anexos", { cookie, corpo: { nome: "orcamento.pdf", tipo: "application/pdf", tamanho: 10 } });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).envio.metodo, "PUT");
  m.relatorios.objetos.set(`${AURORA}/${ANA}/${ARQ}`, new TextEncoder().encode("não é pdf"));
  const v = await (await m.pedir(`/v1/condominio/relatorios/anexos/${ARQ}/verificar`, { cookie, metodo: "POST" })).json();
  assertEquals(v.situacao, "NAO_LIBERADO");
  assertEquals(m.relatorios.apagados, [`${AURORA}/${ANA}/${ARQ}`]);
});

Deno.test("TR-08: o link do anexo vem do armazenamento certo, por 5 minutos; baixar fica no histórico", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const doc = await (await m.pedir(`/v1/condominio/relatorios/${REL}/anexos/1/link`, { cookie })).json();
  assertEquals(doc.tipo, "application/pdf");
  assertEquals(m.documentos.links.at(-1)?.caminho, `${AURORA}/${DOC}/${ARQ}`);
  assertEquals(m.documentos.links.at(-1)?.segundos, 300);
  await m.pedir(`/v1/condominio/relatorios/${REL}/anexos/2/link`, { cookie });
  assertEquals(m.relatorios.links.at(-1)?.caminho, `${AURORA}/${ANA}/${ARQ}`);
  assertEquals((await m.pedir(`/v1/condominio/relatorios/${REL}/anexos/11/link`, { cookie })).status, 404);
  assertEquals((await m.pedir(`/v1/condominio/relatorios/${REL}/baixado`, { cookie, corpo: { formato: "CSV" } })).status, 200);
  assertEquals(chamada(m, "plataforma_relatorio_baixado")?.p_formato, "CSV");
  assertEquals((await m.pedir(`/v1/condominio/relatorios/${REL}/baixado`, { cookie, corpo: { formato: "DOCX" } })).status, 400);
});
