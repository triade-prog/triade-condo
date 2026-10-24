// Meu plano (0291; NG-21, decisões E e F): o plano e os conjuntos sem valores, o modo de cada
// conjunto para o menu e o pedido de teste ou contratação, que vira chamado. Quem pode e o
// bloqueio do que está fora do plano ficam no banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const CHAMADO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const MODOS = { ATENDIMENTO: "COMPLETO", AGENDA: "COMPLETO", MANUTENCAO: "CONSULTA", VIDA: "FORA", COMUNICACAO_AMPLIADA: "FORA" };

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
    plataforma_meu_plano: () => ({ plano: { nome: "Fundador" }, unidadesAtivas: 32, conjuntos: [], podePedir: true }),
    plataforma_conjuntos: () => MODOS,
    plataforma_pedir_conjunto: (a) => a.p_conjunto === "AGENDA" ? erroBanco("TC422", { motivo: "JA_NO_PLANO" }) : { id: CHAMADO, numero: 7 },
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("NG-21: Meu plano e os conjuntos pedem sessão; o condomínio vem da sessão", async () => {
  const m = montar();
  assertEquals((await m.pedir("/v1/condominio/plano")).status, 401);
  assertEquals((await m.pedir("/v1/condominio/conjuntos")).status, 401);
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/plano", { cookie })).json()).plano, { nome: "Fundador" });
  assertEquals(chamada(m, "plataforma_meu_plano"), { p_pessoa: ANA, p_condominio: AURORA });
  assertEquals(await (await m.pedir("/v1/condominio/conjuntos", { cookie })).json(), MODOS);
});

Deno.test("E.1: pedir para testar ou contratar vira chamado; a base e o que já está no plano não se pedem", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/plano/pedidos", { cookie, corpo: { conjunto: "VIDA", pedido: "TESTE" } });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_pedir_conjunto"), { p_pessoa: ANA, p_condominio: AURORA, p_conjunto: "VIDA", p_pedido: "TESTE", p_texto: null });
  assertEquals((await erro(await m.pedir("/v1/condominio/plano/pedidos", { cookie, corpo: { conjunto: "ATENDIMENTO", pedido: "TESTE" } }))).codigo,
    "VALIDATION_ERROR");
  assertEquals((await erro(await m.pedir("/v1/condominio/plano/pedidos", { cookie, corpo: { conjunto: "VIDA", pedido: "LIBERAR" } }))).codigo,
    "VALIDATION_ERROR");
  const ja = await erro(await m.pedir("/v1/condominio/plano/pedidos", { cookie, corpo: { conjunto: "AGENDA", pedido: "CONTRATAR" } }));
  assertEquals([ja.codigo, ja.detalhes?.motivo], ["VALIDATION_ERROR", "JA_NO_PLANO"]);
});
