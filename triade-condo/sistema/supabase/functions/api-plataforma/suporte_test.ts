// Ajuda e suporte (peça R4; PI-17, PI-20) e acesso excepcional (PI-11) na Plataforma: o banco
// decide quem vê e quem aprova; aqui as imagens passam pela mesma verificação das fotos.
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const CHAMADO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const IMAGEM = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const ACESSO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function pngComTexto(): Uint8Array {
  const pedaco = (tipo: string, corpo: string) => {
    const c = new TextEncoder().encode(corpo);
    const b = new Uint8Array(12 + c.length);
    new DataView(b.buffer).setUint32(0, c.length);
    b.set(new TextEncoder().encode(tipo), 4);
    b.set(c, 8);
    return b;
  };
  const partes = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco("IHDR", "0123456789abc"),
    pedaco("tEXt", "Local\0Rua X"), pedaco("IDAT", "imagem"), pedaco("IEND", "")];
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

function montar() {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const caminho = `${AURORA}/${CHAMADO}/${IMAGEM}`;
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
    plataforma_chamados: () => ({ itens: [], todos: true }),
    plataforma_abrir_chamado: () => ({ id: CHAMADO, numero: 1 }),
    plataforma_chamado: () => ({ id: CHAMADO, mensagens: [] }),
    plataforma_responder_chamado: () => ({ reaberto: false }),
    plataforma_resolver_chamado: () => ({ situacao: "RESOLVIDO" }),
    plataforma_iniciar_arquivo_chamado: () => ({ arquivoId: IMAGEM, caminho, tipo: "image/png" }),
    plataforma_arquivo_chamado_a_verificar: () => ({ caminho, tipo: "image/png" }),
    plataforma_verificar_arquivo_chamado: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_arquivo_chamado: () => ({ caminho, nome: "print.png", tipo: "image/png" }),
    plataforma_acessos_excepcionais: () => [],
    plataforma_decidir_acesso_excepcional: (a) => ({ id: ACESSO, situacao: a.p_aprovar ? "APROVADO" : "RECUSADO" }),
    plataforma_encerrar_acesso_excepcional: () => ({ id: ACESSO, situacao: "ENCERRADO" }),
  });
  const suporte = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoSuporte: suporte.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), suporte, caminho, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("PI-20: chamado pede sessão, tipo e área; o condomínio vem da sessão", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/chamados")).status, 401);
  const cookie = await entrar(m);
  const base = { tipo: "PROBLEMA", area: "PEDIDOS", titulo: "Fila some", texto: "Escolho a categoria e some." };
  assertEquals((await erro(await m.pedir("/v1/condominio/chamados", { cookie, corpo: { ...base, tipo: "RECLAMACAO" } }))).codigo, "VALIDATION_ERROR");
  assertEquals((await m.pedir("/v1/condominio/chamados", { cookie, corpo: base })).status, 201);
  assertEquals(chamada(m, "plataforma_abrir_chamado"), {
    p_pessoa: ANA, p_condominio: AURORA, p_tipo: "PROBLEMA", p_area: "PEDIDOS", p_titulo: "Fila some", p_texto: "Escolho a categoria e some.",
  });
  assertEquals((await m.pedir(`/v1/condominio/chamados/${CHAMADO}/responder`, { cookie, corpo: { texto: "Voltou." } })).status, 201);
  assertEquals((await m.pedir(`/v1/condominio/chamados/${CHAMADO}/resolver`, { cookie, corpo: {} })).status, 200);
  assertEquals((await m.pedir("/v1/condominio/chamados/nao-e-id", { cookie })).status, 404);
});

Deno.test("PT-07: a imagem do chamado perde o texto escondido antes de liberar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/chamados/${CHAMADO}/imagens`, { cookie, corpo: { nome: "print.png", tipo: "image/png", tamanho: 100 } });
  assertEquals(r.status, 201);
  assert((await r.json()).envio.url.includes(m.caminho));
  assertEquals((await m.pedir(`/v1/condominio/chamados/${CHAMADO}/imagens`, { cookie, corpo: { nome: "x.pdf", tipo: "application/pdf", tamanho: 100 } })).status, 400);
  m.suporte.objetos.set(m.caminho, pngComTexto());
  const v = await m.pedir(`/v1/condominio/chamados/${CHAMADO}/imagens/${IMAGEM}/verificar`, { cookie, corpo: {} });
  assertEquals((await v.json()).situacao, "LIBERADO");
  assert(!new TextDecoder().decode(m.suporte.objetos.get(m.caminho)).includes("Rua X"));
  const l = await (await m.pedir(`/v1/condominio/chamados/${CHAMADO}/imagens/${IMAGEM}/link`, { cookie })).json();
  assertEquals(m.suporte.links.at(-1)?.segundos, 300);
  assert(l.url.includes(m.caminho));
});

Deno.test("PT-07: imagem que não confere é apagada e recusada", async () => {
  const m = montar();
  const cookie = await entrar(m);
  m.suporte.objetos.set(m.caminho, new TextEncoder().encode("não é imagem"));
  const v = await (await m.pedir(`/v1/condominio/chamados/${CHAMADO}/imagens/${IMAGEM}/verificar`, { cookie, corpo: {} })).json();
  assertEquals(v.situacao, "NAO_LIBERADO");
  assertEquals(m.suporte.apagados, [m.caminho]);
});

Deno.test("PI-11: o síndico aprova, recusa com motivo e encerra", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/acessos-excepcionais", { cookie })).json()).acessos, []);
  assertEquals((await m.pedir(`/v1/condominio/acessos-excepcionais/${ACESSO}/decidir`, { cookie, corpo: { aprovar: false } })).status, 400);
  const r = await m.pedir(`/v1/condominio/acessos-excepcionais/${ACESSO}/decidir`, { cookie, corpo: { aprovar: true } });
  assertEquals((await r.json()).situacao, "APROVADO");
  assertEquals(chamada(m, "plataforma_decidir_acesso_excepcional"), { p_pessoa: ANA, p_condominio: AURORA, p_id: ACESSO, p_aprovar: true, p_motivo: null });
  assertEquals((await (await m.pedir(`/v1/condominio/acessos-excepcionais/${ACESSO}/encerrar`, { cookie, corpo: {} })).json()).situacao, "ENCERRADO");
});
