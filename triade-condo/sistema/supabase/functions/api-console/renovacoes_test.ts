// Renovações (0311, R17.7; CM-30, CM-31 e CM-32): as rotas validam a entrada e levam a pessoa da
// sessão; o valor com reajuste, o último dia e quem pode saem do banco. O aviso com modelo em uso
// monta o PDF do aditivo, guarda como o contrato e manda o sha256 ao banco.
import { assert, assertEquals } from "@std/assert";
import { MOTIVOS_CANCELAMENTO } from "@triade/domain";
import { criarApiConsole } from "./app.ts";
import { gerarPdfAditivo, type RetratoAditivo, sha256Bytes } from "./contrato.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const PEQUI = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const RENOVACAO = "6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e";
const ADITIVO = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const RISCO = "8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a";
const PEDIDO = "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b";
const EXPANSAO = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const MODELO = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const CAMINHO = `${PEQUI}/${PEQUI}/${ADITIVO}`;
const HASH = "a".repeat(64);
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const RETRATO: RetratoAditivo = {
  numero: 1,
  titulo: "Aditivo de reajuste",
  texto: "Aditivo ao contrato nº 3 do Residencial Pequi. O valor passa de R$ 229,00 por mês para R$ 239,99 por mês desde a competência de 01/2027.",
  campos: { condominio: "Residencial Pequi", valor_novo: "R$ 239,99 por mês" },
  modelo: { numero: 1 },
  contrato: { numero: 3, hash: "b".repeat(64) },
  geradoEm: "2026-11-20T10:00:00-03:00",
};
const AVISO = { interessadoId: PEQUI, aniversario: "2026-12-01", valorNovo: 23999, canal: "WHATSAPP", para: "Marta (síndica)", texto: "Olá, Marta. O contrato faz aniversário..." };

function montar(opcoes: { semArmazenamento?: boolean } = {}) {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const arm = armazenamentoFalso();
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    comercial_renovacoes: (a) => ({ mes: a.p_mes ? String(a.p_mes).slice(0, 7) : "2026-11", renovacoes: [], riscos: [], expansoes: [], cancelamentos: [] }),
    comercial_salvar_regra_reajuste: (a) => ({ indice: a.p_indice, percentual: a.p_percentual, prazoAvisoDias: a.p_prazo_aviso_dias, versao: 2 }),
    comercial_registrar_aviso: (a) => ((a.p_dados as { para: string }).para === "Sem modelo"
      ? { renovacao: { id: RENOVACAO, situacao: "AVISO_ENVIADO" }, aditivo: null }
      : { renovacao: { id: RENOVACAO, situacao: "AVISO_ENVIADO" }, aditivo: { aditivoId: ADITIVO, caminho: CAMINHO, hash: HASH, dados: RETRATO } }),
    comercial_aditivo_pronto: (a) => ({ id: a.p_aditivo, numero: 1, situacao: "PRONTO", hash: HASH }),
    comercial_aditivo_para_montar: () => ({ aditivoId: ADITIVO, caminho: CAMINHO, hash: HASH, dados: RETRATO }),
    comercial_abrir_aditivo: () => ({ caminho: CAMINHO, nome: "aditivo-1.pdf", tipo: "application/pdf" }),
    comercial_dispensar_renovacao: () => ({ id: RENOVACAO, situacao: "DISPENSADO" }),
    comercial_modelos_aditivo: () => ({ versoes: [], campos: ["condominio"], podeEditar: true }),
    comercial_salvar_modelo_aditivo: (a) => ({ id: a.p_id ?? MODELO, versao: 1, situacao: "RASCUNHO" }),
    comercial_usar_modelo_aditivo: (a) => ({ id: a.p_id, versao: 2, situacao: "EM_USO" }),
    comercial_marcar_risco: () => ({ id: RISCO, versao: 1, tipo: "TROCA_NA_PAUTA" }),
    comercial_tratar_risco: () => ({ id: RISCO, versao: 2, tratado: true }),
    comercial_pedir_cancelamento: (a) => ((a.p_dados as { pedidoPor: string }).pedidoPor === "Repetido"
      ? erroBanco("TC422", { motivo: "CANCELAMENTO_ABERTO" })
      : { id: PEDIDO, versao: 1, situacao: "PEDIDO", ultimoDia: "2026-11-23" }),
    comercial_tentar_retencao: () => ({ id: PEDIDO, versao: 2, situacao: "EM_RETENCAO", ultimoDia: "2026-11-23" }),
    comercial_cliente_ficou: () => ({ id: PEDIDO, versao: 3, situacao: "FICOU", ultimoDia: "2026-11-23" }),
    comercial_confirmar_cancelamento: () => erroBanco("TC401"),
    comercial_salvar_expansao: (a) => ({ id: a.p_id ?? EXPANSAO, versao: 1, etapa: "ABERTA" }),
    comercial_encerrar_expansao: (a) => ({ id: a.p_id, versao: 2, etapa: a.p_etapa }),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    armazenamentoContrato: opcoes.semArmazenamento ? undefined : arm.armazenamento,
  });
  return { pedir: pedido(app, "api-console"), arm, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("0311: Renovações pede a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/comercial/renovacoes", "/v1/comercial/modelos/aditivo", `/v1/comercial/renovacoes/${RENOVACAO}/aditivo/link`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  for (const rota of ["/v1/comercial/renovacoes/aviso", "/v1/comercial/cancelamentos", "/v1/comercial/riscos", "/v1/comercial/expansoes"]) {
    assertEquals((await erro(await m.pedir(rota, { corpo: {} }))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals(Object.keys(MOTIVOS_CANCELAMENTO).length, 7);
});

Deno.test("0311: a tela do mês e a regra do reajuste", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir("/v1/comercial/renovacoes?mes=2026-12", { cookie });
  assertEquals(chamada(m, "comercial_renovacoes"), { p_pessoa: CAROLINA, p_mes: "2026-12-01" });
  assertEquals((await erro(await m.pedir("/v1/comercial/renovacoes?mes=dezembro", { cookie }))).detalhes?.campos, ["mes"]);

  const regra = { versao: 1, indice: "IPCA", percentual: 4.8, referencia: "12 meses até outubro", prazoAvisoDias: 30 };
  assertEquals((await m.pedir("/v1/comercial/renovacoes/regra", { cookie, metodo: "PUT", corpo: regra })).status, 200);
  assertEquals(chamada(m, "comercial_salvar_regra_reajuste"), {
    p_pessoa: CAROLINA, p_versao: 1, p_indice: "IPCA", p_percentual: 4.8, p_referencia: "12 meses até outubro", p_prazo_aviso_dias: 30,
  });
  // Sem índice: a regra fica "a definir" (nada calculado).
  await m.pedir("/v1/comercial/renovacoes/regra", { cookie, metodo: "PUT", corpo: { versao: 2, indice: "", prazoAvisoDias: 45 } });
  assertEquals([chamada(m, "comercial_salvar_regra_reajuste")!.p_indice, chamada(m, "comercial_salvar_regra_reajuste")!.p_percentual], [null, null]);
  assertEquals((await erro(await m.pedir("/v1/comercial/renovacoes/regra", { cookie, metodo: "PUT", corpo: { ...regra, percentual: null } })))
    .detalhes?.campos, ["percentual"]);
  assertEquals((await erro(await m.pedir("/v1/comercial/renovacoes/regra", { cookie, metodo: "PUT", corpo: { ...regra, prazoAvisoDias: 10 } })))
    .detalhes?.campos, ["prazoAvisoDias"]);
});

Deno.test("0311: o aviso registra, monta o PDF do aditivo, guarda e manda o sha256", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/comercial/renovacoes/aviso", { cookie, corpo: { ...AVISO, canal: "SMS" } }))).detalhes?.campos, ["canal"]);
  const r = await m.pedir("/v1/comercial/renovacoes/aviso", { cookie, corpo: AVISO });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "comercial_registrar_aviso"), {
    p_pessoa: CAROLINA, p_interessado: PEQUI, p_aniversario: "2026-12-01",
    p_dados: { valorNovo: 23999, avisoEm: null, canal: "WHATSAPP", para: "Marta (síndica)", texto: AVISO.texto },
  });
  const guardado = m.arm.objetos.get(CAMINHO)!;
  assertEquals(guardado, await gerarPdfAditivo(RETRATO, HASH), "o PDF guardado é o do retrato");
  assertEquals(chamada(m, "comercial_aditivo_pronto"), { p_pessoa: CAROLINA, p_aditivo: ADITIVO, p_sha256: await sha256Bytes(guardado), p_tamanho: guardado.length });
  const corpo = await r.json();
  assertEquals([corpo.renovacao.situacao, corpo.renovacao.aditivo.situacao], ["AVISO_ENVIADO", "PRONTO"]);
  assert(new TextDecoder("latin1").decode(guardado).includes("%PDF-"));

  // Sem modelo em uso: o aviso vale sozinho, sem PDF.
  const s = await (await m.pedir("/v1/comercial/renovacoes/aviso", { cookie, corpo: { ...AVISO, para: "Sem modelo" } })).json();
  assertEquals(s.renovacao.aditivo, undefined);

  // Montar de novo o que ficou montando, e o link para baixar.
  m.arm.objetos.clear();
  assertEquals((await m.pedir(`/v1/comercial/renovacoes/${RENOVACAO}/aditivo`, { cookie, corpo: {} })).status, 200);
  assert(m.arm.objetos.has(CAMINHO));
  const l = await (await m.pedir(`/v1/comercial/renovacoes/${RENOVACAO}/aditivo/link?baixar=1`, { cookie })).json();
  assert(l.url.includes(CAMINHO) && l.url.includes("aditivo-1.pdf"));
  assertEquals(chamada(m, "comercial_abrir_aditivo"), { p_pessoa: CAROLINA, p_renovacao: RENOVACAO });
});

Deno.test("0311: sem armazenamento, o aviso não é registrado pela metade", async () => {
  const m = montar({ semArmazenamento: true });
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/comercial/renovacoes/aviso", { cookie, corpo: AVISO }))).codigo, "INTERNAL_ERROR");
  assertEquals(chamada(m, "comercial_registrar_aviso"), undefined);
});

Deno.test("0311: renovar sem reajuste e o modelo de aditivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/renovacoes/dispensar", { cookie, corpo: { interessadoId: PEQUI, aniversario: "2026-12-01", motivo: "Combinado na proposta" } }))
    .status, 201);
  assertEquals(chamada(m, "comercial_dispensar_renovacao"), { p_pessoa: CAROLINA, p_interessado: PEQUI, p_aniversario: "2026-12-01", p_motivo: "Combinado na proposta" });

  const texto = "Aditivo ao contrato «contrato» do «condominio»: o valor passa a «valor_novo» desde a «vale_desde».";
  assertEquals((await m.pedir("/v1/comercial/modelos/aditivo", { cookie, corpo: { titulo: "Aditivo de reajuste", texto } })).status, 201);
  assertEquals(chamada(m, "comercial_salvar_modelo_aditivo"), { p_pessoa: CAROLINA, p_id: null, p_versao: null, p_dados: { titulo: "Aditivo de reajuste", texto } });
  assertEquals((await erro(await m.pedir(`/v1/comercial/modelos/aditivo/${MODELO}`, { cookie, metodo: "PUT", corpo: { titulo: "Aditivo de reajuste", texto } })))
    .detalhes?.campos, ["versao"]);
  assertEquals((await erro(await m.pedir("/v1/comercial/modelos/aditivo", { cookie, corpo: { titulo: "Aditivo", texto: texto.replace("«contrato»", "«numero»") } })))
    .detalhes?.campos, ["texto"]);
  assertEquals((await (await m.pedir(`/v1/comercial/modelos/aditivo/${MODELO}/usar`, { cookie, corpo: { versao: 1 } })).json()).situacao, "EM_USO");
  await m.pedir("/v1/comercial/modelos/aditivo", { cookie });
  assertEquals(chamada(m, "comercial_modelos_aditivo"), { p_pessoa: CAROLINA });
});

Deno.test("0311: sinais de risco e o cancelamento com a tentativa de retenção", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/riscos", { cookie, corpo: { interessadoId: PEQUI, tipo: "TROCA_NA_PAUTA", data: "2026-12-10" } })).status, 201);
  assertEquals(chamada(m, "comercial_marcar_risco"), { p_pessoa: CAROLINA, p_interessado: PEQUI, p_dados: { tipo: "TROCA_NA_PAUTA", data: "2026-12-10", detalhe: null } });
  assertEquals((await erro(await m.pedir("/v1/comercial/riscos", { cookie, corpo: { interessadoId: PEQUI, tipo: "USO_CAINDO", data: "2026-12-10" } }))).detalhes?.campos,
    ["tipo"]);
  await m.pedir(`/v1/comercial/riscos/${RISCO}/tratar`, { cookie, corpo: { versao: 1, nota: "Falei com a síndica" } });
  assertEquals(chamada(m, "comercial_tratar_risco"), { p_pessoa: CAROLINA, p_id: RISCO, p_versao: 1, p_nota: "Falei com a síndica" });

  assertEquals((await m.pedir("/v1/comercial/cancelamentos", { cookie, corpo: { interessadoId: PEQUI, pedidoPor: "Síndica Marta" } })).status, 201);
  assertEquals(chamada(m, "comercial_pedir_cancelamento"), { p_pessoa: CAROLINA, p_interessado: PEQUI, p_dados: { pedidoPor: "Síndica Marta", pedidoEm: null } });
  const repetido = await erro(await m.pedir("/v1/comercial/cancelamentos", { cookie, corpo: { interessadoId: PEQUI, pedidoPor: "Repetido" } }));
  assertEquals(repetido.detalhes?.motivo, "CANCELAMENTO_ABERTO");

  const url = `/v1/comercial/cancelamentos/${PEDIDO}`;
  assertEquals((await erro(await m.pedir(`${url}/retencao`, { cookie, corpo: { versao: 1, motivo: "OUTRO", retencao: "Dois meses com 20%" } }))).detalhes?.campos,
    ["motivoTexto"]);
  await m.pedir(`${url}/retencao`, { cookie, corpo: { versao: 1, motivo: "PRECO", retencao: "Dois meses com 20%" } });
  assertEquals(chamada(m, "comercial_tentar_retencao"), {
    p_pessoa: CAROLINA, p_id: PEDIDO, p_versao: 1, p_dados: { motivo: "PRECO", motivoTexto: null, retencao: "Dois meses com 20%" },
  });
  assertEquals((await (await m.pedir(`${url}/ficou`, { cookie, corpo: { versao: 2 } })).json()).situacao, "FICOU");
  // Confirmar: o motivo é obrigatório; quem não é da Administração recebe a recusa do banco.
  assertEquals((await erro(await m.pedir(`${url}/confirmar`, { cookie, corpo: { versao: 2 } }))).detalhes?.campos, ["motivo"]);
  assertEquals((await m.pedir(`${url}/confirmar`, { cookie, corpo: { versao: 2, motivo: "PRECO", lembrarEm: "2027-06-01" } })).status, 403);
  assertEquals(chamada(m, "comercial_confirmar_cancelamento")!.p_dados, { motivo: "PRECO", motivoTexto: null, lembrarEm: "2027-06-01" });
});

Deno.test("0311: a expansão abre, muda e encerra", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const base = { interessadoId: PEQUI, motivo: "Tem outro prédio no bairro", responsavelId: CAROLINA, proximoPasso: "Ligar na segunda" };
  assertEquals((await erro(await m.pedir("/v1/comercial/expansoes", { cookie, corpo: { ...base, tipo: "MAIS_UM_PREDIO" } }))).detalhes?.campos, ["oportunidade"]);
  assertEquals((await m.pedir("/v1/comercial/expansoes", { cookie, corpo: { ...base, tipo: "MAIS_UM_PREDIO", oportunidade: { condominio: "Residencial Pequi II" } } }))
    .status, 201);
  const d = chamada(m, "comercial_salvar_expansao")!;
  assertEquals([d.p_id, d.p_versao, (d.p_dados as { oportunidade: { condominio: string } }).oportunidade.condominio, (d.p_dados as { etapa: string }).etapa],
    [null, null, "Residencial Pequi II", "ABERTA"]);
  await m.pedir(`/v1/comercial/expansoes/${EXPANSAO}`, { cookie, metodo: "PUT", corpo: { ...base, versao: 1, etapa: "PROPOSTA" } });
  assertEquals([chamada(m, "comercial_salvar_expansao")!.p_id, chamada(m, "comercial_salvar_expansao")!.p_versao], [EXPANSAO, 1]);
  assertEquals((await erro(await m.pedir(`/v1/comercial/expansoes/${EXPANSAO}/encerrar`, { cookie, corpo: { versao: 2, etapa: "PERDIDA" } }))).detalhes?.campos,
    ["resultado"]);
  await m.pedir(`/v1/comercial/expansoes/${EXPANSAO}/encerrar`, { cookie, corpo: { versao: 2, etapa: "GANHA" } });
  assertEquals(chamada(m, "comercial_encerrar_expansao"), { p_pessoa: CAROLINA, p_id: EXPANSAO, p_versao: 2, p_etapa: "GANHA", p_resultado: null });
});
