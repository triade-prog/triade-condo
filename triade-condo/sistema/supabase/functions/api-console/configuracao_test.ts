// Configuração na implantação (PI-04, CF-01, CF-09, CF-12): a aba Configuração do Console usa as
// mesmas rotas e funções do app, com a pessoa da equipe e o cliente da rota; os ajustes técnicos
// levam o motivo; quem pode é o banco que diz.
import { assertEquals } from "@std/assert";
import { PARTES_CONFIGURACAO } from "@triade/domain";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const ETAPA = "4f1a7d42-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_configuracao: () => ({ emImplantacao: true, partes: [] }),
    console_conferir_parte: () => ({ id: ETAPA, conferidas: 1, total: 11 }),
    plataforma_configuracoes: () => ({ fuso: "America/Sao_Paulo" }),
    plataforma_definir_horarios: (a) => Number(a.p_versao) + 1,
    plataforma_definir_whatsapp: (a) => Number(a.p_versao) + 1,
    console_definir_fuso: (a) => Number(a.p_versao) + 1,
    console_definir_parecidos: (a) => Number(a.p_versao) + 1,
    console_definir_anexar: (a) => Number(a.p_versao) + 1,
    console_salvar_etapa_pedido: () => ({ id: ETAPA, versao: 2 }),
    console_salvar_etapa_manutencao: () => ({ id: ETAPA, versao: 1 }),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
  });
  return { pedir: pedido(app, "api-console"), ...falso, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const base = `/v1/clientes/${IPE}`;

Deno.test("PI-04: a aba Configuração pede a sessão completa", async () => {
  const m = montar();
  for (const rota of [`${base}/configuracao`, `${base}/condominio/configuracoes`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
});

Deno.test("CF-01: a TRÍADE monta pelas mesmas rotas do app, como ela mesma e no cliente da rota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir(`${base}/configuracao`, { cookie })).json(), { emImplantacao: true, partes: [] });
  assertEquals(chamada(m, "console_configuracao"), { p_pessoa: CAROLINA, p_condominio: IPE });
  assertEquals(await (await m.pedir(`${base}/condominio/configuracoes`, { cookie })).json(), { fuso: "America/Sao_Paulo" });
  const intervalos = [{ dia: 1, inicio: "08:00", fim: "12:00" }];
  assertEquals(await (await m.pedir(`${base}/condominio/horarios/atendimento`, { cookie, metodo: "PUT", corpo: { versao: 1, intervalos } })).json(),
    { versao: 2 });
  assertEquals(chamada(m, "plataforma_definir_horarios"), { p_pessoa: CAROLINA, p_condominio: IPE, p_tipo: "ATENDIMENTO", p_versao: 1, p_intervalos: intervalos });
  // CF-12: o que o app recusa, o Console recusa igual.
  const sobreposto = [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "11:00", fim: "14:00" }];
  const r = await m.pedir(`${base}/condominio/horarios/atendimento`, { cookie, metodo: "PUT", corpo: { versao: 1, intervalos: sobreposto } });
  assertEquals((await erro(r)).codigo, "VALIDATION_ERROR");
  assertEquals((await m.pedir(`/v1/clientes/nao-e-id/condominio/configuracoes`, { cookie })).status, 404);
});

Deno.test("CF-09: o WhatsApp do app não leva mais o tempo de anexar; o Console ajusta à parte, com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { versao: 3, foraHorario: "Recebemos sua mensagem fora do horário de atendimento.", categoriaId: ETAPA, prioridadeId: ETAPA };
  await m.pedir(`${base}/condominio/whatsapp/config`, { cookie, metodo: "PUT", corpo });
  assertEquals(chamada(m, "plataforma_definir_whatsapp"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_versao: 3, p_fora_horario: corpo.foraHorario, p_categoria: ETAPA, p_prioridade: ETAPA,
  });
  const anexar = await m.pedir(`${base}/condominio/whatsapp/anexar`, { cookie, metodo: "PUT", corpo: { versao: 3, minutos: 20 } });
  assertEquals((await erro(anexar)).detalhes?.campos, ["minutos"]);
  await m.pedir(`${base}/condominio/whatsapp/anexar`, { cookie, metodo: "PUT", corpo: { versao: 3, minutos: 15, motivo: "Chamado 2026-0031" } });
  assertEquals(chamada(m, "console_definir_anexar"), { p_pessoa: CAROLINA, p_condominio: IPE, p_versao: 3, p_minutos: 15, p_motivo: "Chamado 2026-0031" });
});

Deno.test("CF-09: fuso, janela dos parecidos e etapas são ajustes técnicos do Console", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`${base}/condominio/fuso`, { cookie, metodo: "PUT", corpo: { versao: 1, fuso: "America/Manaus" } });
  assertEquals(chamada(m, "console_definir_fuso"), { p_pessoa: CAROLINA, p_condominio: IPE, p_versao: 1, p_fuso: "America/Manaus", p_motivo: null });
  const janela = await m.pedir(`${base}/condominio/regras-parecidos`, { cookie, metodo: "PUT", corpo: { versao: 2, dias: 45 } });
  assertEquals((await erro(janela)).detalhes?.campos, ["dias"]);
  await m.pedir(`${base}/condominio/regras-parecidos`, { cookie, metodo: "PUT", corpo: { versao: 2, dias: 60, motivo: "Pedido da síndica" } });
  assertEquals(chamada(m, "console_definir_parecidos"), { p_pessoa: CAROLINA, p_condominio: IPE, p_versao: 2, p_dias: 60, p_motivo: "Pedido da síndica" });
  assertEquals((await m.pedir(`${base}/condominio/etapas`, { cookie, corpo: { nome: "Orçamento", situacao: "EM_ANDAMENTO", pausaPrazo: true } })).status, 201);
  assertEquals(chamada(m, "console_salvar_etapa_pedido"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_id: null, p_versao: null, p_nome: "Orçamento", p_situacao: "EM_ANDAMENTO", p_categoria: null,
    p_pausa_prazo: true, p_ativa: null, p_motivo: null,
  });
  const semVersao = await m.pedir(`${base}/condominio/etapas-manutencao/${ETAPA}`, { cookie, metodo: "PUT", corpo: { nome: "Aguardando" } });
  assertEquals((await erro(semVersao)).detalhes?.campos, ["versao"]);
  await m.pedir(`${base}/condominio/etapas-manutencao/${ETAPA}`, { cookie, metodo: "PUT", corpo: { versao: 1, nome: "Aguardando", ativa: false, motivo: "Fora de uso" } });
  assertEquals(chamada(m, "console_salvar_etapa_manutencao"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_id: ETAPA, p_versao: 1, p_nome: "Aguardando", p_situacao: null, p_ativa: false, p_motivo: "Fora de uso",
  });
});

Deno.test("PI-04: conferir uma parte leva de onde veio; só as 11 partes", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`${base}/configuracao/conferir`, { cookie, corpo: { parte: "HORARIOS", nota: "Ata de 03/2026" } });
  assertEquals(await r.json(), { id: ETAPA, conferidas: 1, total: 11 });
  assertEquals(chamada(m, "console_conferir_parte"), { p_pessoa: CAROLINA, p_condominio: IPE, p_parte: "HORARIOS", p_nota: "Ata de 03/2026" });
  assertEquals((await erro(await m.pedir(`${base}/configuracao/conferir`, { cookie, corpo: { parte: "TERMO" } }))).detalhes?.campos, ["parte"]);
});

Deno.test("PI-04: as 11 partes do domínio são as mesmas do banco, na mesma ordem", async () => {
  const migration = await Deno.readTextFile(new URL("../../migrations/0283_configuracao_implantacao.sql", import.meta.url));
  const lista = migration.match(/function partes_da_configuracao\(\)[\s\S]*?array\[([^\]]+)\]/)?.[1] ?? "";
  assertEquals(lista.match(/'[A-Z]+'/g)?.map((p) => p.slice(1, -1)), Object.keys(PARTES_CONFIGURACAO));
});
