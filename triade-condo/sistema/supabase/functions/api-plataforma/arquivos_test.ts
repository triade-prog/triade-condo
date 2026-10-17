// Passo 4b na Plataforma do síndico: fotos e documentos dos pedidos. A rota valida a entrada,
// manda ao banco a pessoa e o condomínio da sessão, e só libera o arquivo depois de conferir o
// conteúdo; o link de abrir vale 5 minutos (PT-07).
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ARQUIVO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const CAMINHO = `${AURORA}/${PEDIDO}/${ARQUIVO}`;
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj << >> endobj\ntrailer\n%%EOF\n");

function montar(handlers: Record<string, (a: Record<string, unknown>) => unknown> = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const arm = armazenamentoFalso();
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
    plataforma_arquivos_pedido: () => ({ arquivos: [], pode: { enviar: true, enviarConclusao: false } }),
    plataforma_iniciar_arquivo: (a) => ({ arquivoId: ARQUIVO, caminho: CAMINHO, tipo: a.p_tipo }),
    plataforma_arquivo_a_verificar: () => ({ caminho: CAMINHO, tipo: "application/pdf" }),
    plataforma_verificar_arquivo: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_arquivo: () => ({ caminho: CAMINHO, nome: "orcamento encanador.pdf", tipo: "application/pdf" }),
    plataforma_tirar_arquivo: () => ({ ok: true }),
    ...handlers,
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo", armazenamento: arm.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), arm, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;
const BASE = `/v1/condominio/pedidos/${PEDIDO}/arquivos`;

Deno.test("PT-01: arquivos só com sessão, e o condomínio vem dela", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir(BASE))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir(BASE, { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_arquivos_pedido"), { p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO });
  assertEquals((await m.pedir(`/v1/condominio/pedidos/nao-e-id/arquivos`, { cookie })).status, 404);
});

Deno.test("PT-07: começar o envio devolve o link de envio do armazenamento", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(BASE, { cookie, corpo: { parte: "RELATO", nome: "teto.jpg", tipo: "image/jpeg", tamanho: 2100000 } });
  assertEquals(r.status, 201);
  assertEquals(await r.json(), {
    arquivoId: ARQUIVO,
    envio: { url: `https://armazenamento.exemplo/envio/${CAMINHO}?token=t`, metodo: "PUT", tipo: "image/jpeg" },
  });
  assertEquals(chamada(m, "plataforma_iniciar_arquivo"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_parte: "RELATO", p_nome: "teto.jpg", p_descricao: null, p_tipo: "image/jpeg", p_tamanho: 2100000,
  });
  assertEquals((await erro(await m.pedir(BASE, { cookie, corpo: { parte: "X", nome: "", tipo: "image/jpeg", tamanho: 0 } }))).detalhes,
    { campos: ["parte", "nome", "tamanho"] });
});

Deno.test("PT-07: o banco recusa o tipo ou o limite, e nenhum link de envio sai", async () => {
  const m = montar({ plataforma_iniciar_arquivo: () => erroBanco("TC422", { motivo: "TIPO_NAO_ACEITO" }) });
  const cookie = await entrar(m);
  const e = await erro(await m.pedir(BASE, { cookie, corpo: { parte: "RELATO", nome: "v.mov", tipo: "video/quicktime", tamanho: 10 } }));
  assertEquals(e.codigo, "VALIDATION_ERROR");
  assertEquals(e.detalhes, { motivo: "TIPO_NAO_ACEITO" });
});

Deno.test("PT-07: verificado, o arquivo é regravado limpo e liberado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  m.arm.objetos.set(CAMINHO, PDF);
  const r = await m.pedir(`${BASE}/${ARQUIVO}/verificar`, { cookie, corpo: {} });
  assertEquals(await r.json(), { situacao: "LIBERADO" });
  assertEquals(chamada(m, "plataforma_verificar_arquivo"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_arquivo: ARQUIVO, p_liberado: true, p_tamanho: PDF.length, p_motivo: null,
  });
});

Deno.test("PT-07: conteúdo que não confere fica não liberado e sai do armazenamento", async () => {
  const m = montar();
  const cookie = await entrar(m);
  m.arm.objetos.set(CAMINHO, new TextEncoder().encode("<html>não é PDF</html>"));
  const r = await m.pedir(`${BASE}/${ARQUIVO}/verificar`, { cookie, corpo: {} });
  assertEquals(await r.json(), { situacao: "NAO_LIBERADO", motivo: "O conteúdo não é um PDF de verdade." });
  assertEquals(m.arm.apagados, [CAMINHO]);
  assertEquals(chamada(m, "plataforma_verificar_arquivo")?.p_motivo, "O conteúdo não é um PDF de verdade.");

  const semArquivo = montar();
  const c2 = await entrar(semArquivo);
  assertEquals(await (await semArquivo.pedir(`${BASE}/${ARQUIVO}/verificar`, { cookie: c2, corpo: {} })).json(),
    { situacao: "NAO_LIBERADO", motivo: "O arquivo não chegou. Envie de novo." });
});

Deno.test("PT-07: o link de abrir vale 5 minutos e só sai depois do banco conferir", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await (await m.pedir(`${BASE}/${ARQUIVO}/link?baixar=1`, { cookie })).json();
  assertEquals(r.url, `https://armazenamento.exemplo/ler/${CAMINHO}?token=t&download=orcamento encanador.pdf`);
  assertEquals(m.arm.links, [{ caminho: CAMINHO, segundos: 300, baixarComo: "orcamento encanador.pdf" }]);
  assert(Date.parse(r.expiraEm) - Date.now() <= 300_000);

  const negado = montar({ plataforma_abrir_arquivo: () => erroBanco("TC404") });
  const c2 = await entrar(negado);
  assertEquals((await erro(await negado.pedir(`${BASE}/${ARQUIVO}/link`, { cookie: c2 }))).codigo, "NOT_FOUND");
  assertEquals(negado.arm.links, [], "PT-01: sem permissão, nenhum link é gerado");
});

Deno.test("AT-17: tirar do pedido pede motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`${BASE}/${ARQUIVO}/tirar`, { cookie, corpo: { motivo: "x" } }))).detalhes, { campos: ["motivo"] });
  assertEquals((await m.pedir(`${BASE}/${ARQUIVO}/tirar`, { cookie, corpo: { motivo: "Arquivo errado" } })).status, 200);
  assertEquals(chamada(m, "plataforma_tirar_arquivo")?.p_motivo, "Arquivo errado");
});
