// Mural online e e-mail (CD-12, CD-13, CD-14). As rotas sem conta só aceitam o código do link e
// contam o uso por aparelho; a fila de e-mails sai pelo correio e devolve o resultado ao banco;
// o aviso do provedor só vale assinado.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { SITUACOES_EMAIL } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { avisoAssinado, correioResend, lerEventoResend, montarEmail, type Correio, type EmailPronto, type MensagemFila } from "../_shared/email.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const COMUNICADO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const DOCUMENTO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const ARQUIVO = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const CONTATO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ENVIO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const MURAL = "7KQ2-X9MP-4WD8";
const CODIGO = "Zm9vYmFyYmF6cXV4LWNvZGlnby1kZS10ZXN0ZQ";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const SEGREDO_WEBHOOK = `whsec_${btoa("segredo-do-provedor-de-teste")}`;

const MSG: MensagemFila = {
  envio: ENVIO, condominio: AURORA, tipo: "COMUNICADO", para: "marina@exemplo.invalid", condominioNome: "Residencial Aurora",
  responderPara: "sindica@exemplo.invalid", nome: "Marina", unidades: "A · 101",
  codigos: { ver: CODIGO, parar: `${CODIGO}-parar` },
  comunicado: { assunto: "OBRAS", titulo: "Falta de água na quinta", texto: "Das 9h às 13h.\n\nDeixem água reservada.", assinatura: "Ana, síndica", imagens: [ARQUIVO] },
};

function montar(opcoes: { correio?: Correio; fila?: MensagemFila[] } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const fila = [...(opcoes.fila ?? [])];
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, mural: 3, link: 5, pedido_aparelho: 2, pedido_documento: 1 }),
    plataforma_salvar_comunicado: () => ({ id: COMUNICADO, versao: 2 }),
    plataforma_corrigir_comunicado: () => ({ id: ARQUIVO, versao: 2 }),
    plataforma_mural_comunicado: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_definir_mural_email: (a) => ({ versao: Number(a.p_versao) + 1, codigo: MURAL }),
    plataforma_trocar_link_mural: (a) => ({ versao: Number(a.p_versao) + 1, codigo: "AAAA-BBBB-CCCC" }),
    plataforma_email_contato: () => ({ versao: 4, situacao: "PENDENTE", confirmacaoNaFila: true }),
    plataforma_reenviar_confirmacao: () => ({ ok: true }),
    plataforma_pedidos_documento: () => ({ itens: [], esperando: 0 }),
    plataforma_decidir_pedido_documento: (a) => ({ estado: a.p_enviar ? "ENVIADO" : "RECUSADO" }),
    plataforma_enviar_documento: () => ({ enviados: 2 }),
    plataforma_cancelar_envio_documento: () => ({ ok: true }),
    publico_mural: () => ({ condominio: "Residencial Aurora", comunicados: [], documentos: [] }),
    publico_mural_arquivo: () => ({ caminho: `${AURORA}/${COMUNICADO}/${ARQUIVO}`, nome: "foto.jpg", tipo: "image/jpeg" }),
    publico_pedir_documento: () => ({ ok: true }),
    publico_comunicado: () => ({ condominio: "Residencial Aurora", comunicado: { titulo: "Falta de água" } }),
    publico_documento: () => ({ caminho: `${AURORA}/${DOCUMENTO}/${ARQUIVO}`, nome: "regimento.pdf", tipo: "application/pdf", titulo: "Regimento", numero: 3, condominio: "Residencial Aurora" }),
    publico_confirmar_email: () => ({ nome: "Marina", email: "marina@exemplo.invalid", condominio: "Residencial Aurora" }),
    publico_parar_email: () => ({ condominio: "Residencial Aurora", parou: true }),
    publico_voltar_email: () => ({ condominio: "Residencial Aurora", parou: false }),
    email_pegar_lote: () => fila.splice(0, 100),
    email_resultado: () => null,
    email_evento: () => true,
  });
  const fundo: Promise<unknown>[] = [];
  const comunicados = armazenamentoFalso();
  const documentos = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: armazenamentoFalso().armazenamento, armazenamentoComunicados: comunicados.armazenamento,
    armazenamentoDocumentos: documentos.armazenamento,
    correio: opcoes.correio, urlFuncao: "https://funcao.exemplo/functions/v1/api-plataforma", segredoWebhook: SEGREDO_WEBHOOK,
    aoFundo: (p) => fundo.push(p),
  });
  return { pedir: pedido(app, "api-plataforma"), app, fundo, comunicados, documentos, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const quantas = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.filter((c) => c.funcao === funcao).length;

function correioFalso(resultado: (e: EmailPronto, i: number) => { ok: true; id: string } | { ok: false; erro: string; tentarDeNovo: boolean }) {
  const enviados: EmailPronto[] = [];
  const correio: Correio = {
    enviarLote(emails) {
      enviados.push(...emails);
      return Promise.resolve(emails.map(resultado));
    },
  };
  return { correio, enviados };
}

async function assinar(corpo: string, ts = Math.floor(Date.now() / 1000)) {
  const chave = Uint8Array.from(atob(SEGREDO_WEBHOOK.slice(6)), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`msg_1.${ts}.${corpo}`)));
  return { "svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": `v1,${btoa(String.fromCharCode(...assinatura))}` };
}

Deno.test("CD-12: o mural abre sem sessão, só pelo código, e conta o uso por aparelho", async () => {
  const m = montar();
  const r = await m.pedir(`/v1/publico/mural/${MURAL}`);
  assertEquals((await r.json()).condominio, "Residencial Aurora");
  assertEquals(chamada(m, "publico_mural"), { p_codigo: MURAL });
  assertEquals(chamada(m, "limite_contar")?.p_tipo, "mural");
  assert(!String(chamada(m, "limite_contar")?.p_chave).includes("200.1.2.3"), "a chave do limite não leva o IP em claro");
  assertEquals((await m.pedir("/v1/publico/mural/curto")).status, 404);
  await m.pedir(`/v1/publico/mural/${MURAL}`);
  await m.pedir(`/v1/publico/mural/${MURAL}`);
  assertEquals((await erro(await m.pedir(`/v1/publico/mural/${MURAL}`))).codigo, "RATE_LIMITED");
  assertEquals((await m.pedir(`/v1/publico/mural/${MURAL}`, { segredo: null })).status, 403);
});

Deno.test("CD-12, CD-04: a foto do mural sai por link de 5 minutos do armazenamento dos comunicados", async () => {
  const m = montar();
  const r = await (await m.pedir(`/v1/publico/mural/${MURAL}/comunicados/${COMUNICADO}/arquivos/${ARQUIVO}`)).json();
  assertEquals(r.url, `https://armazenamento.exemplo/ler/${AURORA}/${COMUNICADO}/${ARQUIVO}?token=t`);
  assertEquals(m.comunicados.links[0]?.segundos, 300);
  assertEquals((await m.pedir(`/v1/publico/mural/${MURAL}/comunicados/x/arquivos/${ARQUIVO}`)).status, 404);
});

Deno.test("CD-14: pedir documento pelo mural valida o e-mail e conta por aparelho e por e-mail", async () => {
  const m = montar();
  const url = `/v1/publico/mural/${MURAL}/documentos`;
  assertEquals((await erro(await m.pedir(url, { corpo: { documentoId: DOCUMENTO, email: "sem-arroba" } }))).detalhes?.campos, ["email"]);
  const r = await m.pedir(url, { corpo: { documentoId: DOCUMENTO, email: "Imobiliaria@exemplo.invalid" } });
  assertEquals(await r.json(), { ok: true });
  assertEquals(chamada(m, "publico_pedir_documento"), { p_codigo: MURAL, p_documento: DOCUMENTO, p_email: "Imobiliaria@exemplo.invalid" });
  assertEquals((await erro(await m.pedir(url, { corpo: { documentoId: DOCUMENTO, email: "imobiliaria@exemplo.invalid" } }))).codigo, "RATE_LIMITED");
});

Deno.test("CD-13, CD-14: os links do e-mail abrem o comunicado, o documento e confirmam ou param o e-mail", async () => {
  const m = montar();
  assertEquals((await (await m.pedir(`/v1/publico/c/${CODIGO}`)).json()).comunicado.titulo, "Falta de água");
  const d = await (await m.pedir(`/v1/publico/d/${CODIGO}`)).json();
  assertEquals([d.titulo, d.numero], ["Regimento", 3]);
  assertStringIncludes(d.url, "download=regimento.pdf");
  assertEquals((await (await m.pedir("/v1/publico/email/confirmar", { corpo: { codigo: CODIGO } })).json()).nome, "Marina");
  assertEquals((await (await m.pedir("/v1/publico/email/parar", { corpo: { codigo: CODIGO } })).json()).parou, true);
  assertEquals((await (await m.pedir("/v1/publico/email/voltar", { corpo: { codigo: CODIGO } })).json()).parou, false);
  assertEquals((await erro(await m.pedir("/v1/publico/email/parar", { corpo: { codigo: "x" } }))).detalhes?.campos, ["codigo"]);
});

Deno.test("CD-13: o parar de receber em um clique vem direto do programa de e-mail, sem repasse", async () => {
  const m = montar();
  const r = await m.app.request(`/api-plataforma/v1/email/parar/${CODIGO}`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click",
  });
  assertEquals(r.status, 200);
  assertEquals(chamada(m, "publico_parar_email"), { p_codigo: CODIGO });
  const outra = await m.app.request(`/api-plataforma/v1/publico/c/${CODIGO}`, { method: "GET" });
  assertEquals(outra.status, 403, "as outras rotas continuam exigindo o repasse");
  const fila = await m.app.request("/api-plataforma/v1/interno/fila-email", { method: "POST" });
  assertEquals(fila.status, 403, "a fila só com o segredo de repasse");
});

Deno.test("CD-13: o aviso do provedor só vale assinado e volta ao banco com o envio", async () => {
  const m = montar();
  const corpo = JSON.stringify({
    type: "email.bounced",
    data: { email_id: "re_123", tags: { condominio: AURORA, envio: ENVIO }, bounce: { type: "Permanent", message: "Caixa não existe" } },
  });
  const sem = await m.app.request("/api-plataforma/v1/email/eventos", { method: "POST", headers: { "content-type": "application/json" }, body: corpo });
  assertEquals(sem.status, 403);
  assertEquals(quantas(m, "email_evento"), 0);
  const r = await m.app.request("/api-plataforma/v1/email/eventos", {
    method: "POST", headers: { "content-type": "application/json", ...(await assinar(corpo)) }, body: corpo,
  });
  assertEquals(r.status, 200);
  assertEquals(chamada(m, "email_evento"), {
    p_condominio: AURORA, p_envio: ENVIO, p_provedor_id: "re_123", p_tipo: "DEVOLVIDO", p_detalhe: "Caixa não existe",
  });
  const velho = await m.app.request("/api-plataforma/v1/email/eventos", {
    method: "POST", headers: { "content-type": "application/json", ...(await assinar(corpo, Math.floor(Date.now() / 1000) - 3600)) }, body: corpo,
  });
  assertEquals(velho.status, 403, "aviso de uma hora atrás não vale");
});

Deno.test("CD-13: os avisos do Resend viram entregue, devolvido, adiado ou spam", () => {
  const tags = [{ name: "condominio", value: AURORA }, { name: "envio", value: ENVIO }];
  assertEquals(lerEventoResend({ type: "email.delivered", data: { email_id: "re_1", tags } })?.tipo, "ENTREGUE");
  assertEquals(lerEventoResend({ type: "email.complained", data: { email_id: "re_1", tags } })?.tipo, "SPAM");
  assertEquals(lerEventoResend({ type: "email.bounced", data: { email_id: "re_1", tags, bounce: { type: "Transient" } } })?.tipo, "ADIADO");
  assertEquals(lerEventoResend({ type: "email.opened", data: { email_id: "re_1", tags } }), null);
  assertEquals(lerEventoResend({ type: "email.delivered", data: { email_id: "re_1", tags: { envio: "x" } } }), null);
});

Deno.test("CD-13: publicar esvazia a fila depois da resposta; o correio recebe o e-mail pronto", async () => {
  const c = correioFalso((_, i) => ({ ok: true, id: `re_${i}` }));
  const m = montar({ correio: c.correio, fila: [MSG] });
  const cookie = await entrar(m);
  const corpo = { assunto: "OBRAS", titulo: "Falta de água na quinta", texto: "Das 9h às 13h.", publico: "TODOS", acao: "PUBLICAR", noMural: true, porEmail: true };
  assertEquals((await m.pedir("/v1/condominio/comunicados", { corpo, cookie })).status, 201);
  assertEquals([chamada(m, "plataforma_salvar_comunicado")?.p_no_mural, chamada(m, "plataforma_salvar_comunicado")?.p_por_email], [true, true]);
  await Promise.all(m.fundo);
  const e = c.enviados[0]!;
  assertEquals(e.para, "marina@exemplo.invalid");
  assertEquals(e.assunto, "[Residencial Aurora] Falta de água na quinta");
  assertEquals(e.de, `"Residencial Aurora (pela TRÍADE Condo)" <nao-responda@t3condo.trihub.com.br>`);
  assertEquals(e.responderPara, "sindica@exemplo.invalid");
  assertStringIncludes(e.html, `https://plataforma.exemplo/c/${CODIGO}`);
  assertStringIncludes(e.html, `https://plataforma.exemplo/c/${CODIGO}/foto/${ARQUIVO}`);
  assertStringIncludes(e.html, "Parar de receber por e-mail");
  assertStringIncludes(e.html, "nunca pedem senha");
  assertEquals(e.cabecalhos?.["List-Unsubscribe"], `<https://funcao.exemplo/functions/v1/api-plataforma/v1/email/parar/${CODIGO}-parar>`);
  assertEquals(e.marcas, { condominio: AURORA, envio: ENVIO });
  assertEquals(chamada(m, "email_resultado"), { p_condominio: AURORA, p_envio: ENVIO, p_provedor_id: "re_0", p_erro: null, p_tentar_de_novo: false });
  assertEquals(quantas(m, "email_pegar_lote"), 1);
});

Deno.test("CD-13: falha passageira do provedor volta para a fila; sem correio, a fila espera", async () => {
  const c = correioFalso(() => ({ ok: false, erro: "Resend respondeu 503", tentarDeNovo: true }));
  const m = montar({ correio: c.correio, fila: [MSG] });
  const r = await m.pedir("/v1/interno/fila-email", { corpo: {} });
  assertEquals(await r.json(), { enviados: 0 });
  assertEquals(chamada(m, "email_resultado")?.p_tentar_de_novo, true);
  const sem = montar({ fila: [MSG] });
  assertEquals(await (await sem.pedir("/v1/interno/fila-email", { corpo: {} })).json(), { enviados: 0 });
  assertEquals(quantas(sem, "email_pegar_lote"), 0, "sem correio, nada sai da fila");
});

Deno.test("CD-13, CD-14: o e-mail de confirmação e o do documento", () => {
  const end = { urlApp: "https://plataforma.exemplo/", urlFuncao: "https://f.exemplo", remetente: "nao-responda@exemplo.invalid" };
  const conf = montarEmail({ ...MSG, tipo: "CONFIRMACAO", codigos: { confirmar: CODIGO }, comunicado: undefined }, end);
  assertStringIncludes(conf.html, `https://plataforma.exemplo/e/confirmar?c=${CODIGO}`);
  assertStringIncludes(conf.texto, "O link vale 7 dias");
  assertEquals(conf.cabecalhos, undefined);
  const doc = montarEmail({ ...MSG, tipo: "DOCUMENTO", codigos: { abrir: CODIGO }, comunicado: undefined,
    documento: { titulo: "Regimento <interno>", numero: 3, vigenteDesde: "2026-03-01", recado: "Segue." } }, end);
  assertStringIncludes(doc.html, "Regimento &lt;interno&gt;");
  assertStringIncludes(doc.texto, "em vigor desde 01/03/2026");
  assertStringIncludes(doc.html, `https://plataforma.exemplo/d/${CODIGO}`);
  const corrigido = montarEmail({ ...MSG, comunicado: { ...MSG.comunicado!, correcao: "Mudou o horário" } }, end);
  assertEquals(corrigido.assunto, "[Residencial Aurora] Corrigido: Falta de água na quinta");
  assertStringIncludes(corrigido.html, "O que mudou:");
  const enq = montarEmail({ ...MSG, tipo: "ENQUETE", codigos: { responder: MURAL, parar: CODIGO }, comunicado: undefined,
    enquete: { pergunta: "Qual cor para a fachada?", prazo: "31/10, às 23:59", dono: "da Torre A · 302", lembrete: true, secreta: true } }, end);
  assertEquals(enq.assunto, "[Residencial Aurora] Lembrete: Enquete: Qual cor para a fachada?");
  assertStringIncludes(enq.html, `https://plataforma.exemplo/v/${MURAL}`);
  assertStringIncludes(enq.texto, "ainda falta a resposta da Torre A · 302");
  assertStringIncludes(enq.texto, "o condomínio vê só quem respondeu, não o que respondeu");
  assertStringIncludes(enq.cabecalhos?.["List-Unsubscribe"] ?? "", `/v1/email/parar/${CODIGO}`);
  const ass = montarEmail({ ...MSG, tipo: "ASSEMBLEIA", codigos: { votar: MURAL, parar: CODIGO }, comunicado: undefined,
    assembleia: { titulo: "AGO de março", nome: "assembleia geral ordinária", chamada: "sábado, 20/03, às 19:00", dono: "da Torre A · 302", lembrete: false } }, end);
  assertEquals(ass.assunto, "[Residencial Aurora] AGO de março");
  assertStringIncludes(ass.html, `https://plataforma.exemplo/a/${MURAL}`);
  assertStringIncludes(ass.texto, "O Residencial Aurora convoca a assembleia geral ordinária, com 1ª chamada em sábado, 20/03, às 19:00.");
  assertStringIncludes(ass.texto, "Pelo link, que é só da Torre A · 302, dá para indicar procurador");
  assertStringIncludes(ass.cabecalhos?.["List-Unsubscribe"] ?? "", `/v1/email/parar/${CODIGO}`);
});

Deno.test("CD-13: o Resend recebe o lote e devolve um id por e-mail; 429 tenta de novo", async () => {
  const pedidos: { url: string; corpo: unknown }[] = [];
  const ok = correioResend("re_chave", (url, init) => {
    pedidos.push({ url: String(url), corpo: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response(JSON.stringify({ data: [{ id: "re_a" }] }), { status: 200 }));
  });
  const e = montarEmail(MSG, { urlApp: "https://p.exemplo", urlFuncao: "https://f.exemplo", remetente: "n@exemplo.invalid" });
  assertEquals(await ok.enviarLote([e]), [{ ok: true, id: "re_a" }]);
  assertEquals(pedidos[0]!.url, "https://api.resend.com/emails/batch");
  const enviado = (pedidos[0]!.corpo as Record<string, unknown>[])[0]!;
  assertEquals(enviado.tags, [{ name: "condominio", value: AURORA }, { name: "envio", value: ENVIO }]);
  assertEquals(enviado.reply_to, ["sindica@exemplo.invalid"]);
  const cheio = correioResend("re_chave", () => Promise.resolve(new Response("{}", { status: 429 })));
  assertEquals((await cheio.enviarLote([e]))[0], { ok: false, erro: "Resend respondeu 429", tentarDeNovo: true });
  const ruim = correioResend("re_chave", () => Promise.resolve(new Response(JSON.stringify({ message: "domínio não verificado" }), { status: 403 })));
  assertEquals((await ruim.enviarLote([e]))[0], { ok: false, erro: "Resend respondeu 403: domínio não verificado", tentarDeNovo: false });
});

Deno.test("CD-12, CD-13, CD-14: as rotas do síndico levam a versão e os campos ao banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const mural = { versao: 3, muralLigado: true, muralAssuntos: ["AVISO", "OBRAS"], emailLigado: false, responderPara: "", documentosNoMural: true, documentosAutomatico: false };
  assertEquals(await (await m.pedir("/v1/condominio/mural-email", { metodo: "PUT", corpo: mural, cookie })).json(), { versao: 4, codigo: MURAL });
  assertEquals(chamada(m, "plataforma_definir_mural_email")?.p_responder_para, null);
  assertEquals((await erro(await m.pedir("/v1/condominio/mural/trocar-link", { corpo: { versao: 4 }, cookie }))).detalhes?.campos, ["motivo"]);
  assertEquals((await (await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}/mural`, { metodo: "PUT", corpo: { versao: 2, noMural: false }, cookie })).json()), { versao: 3 });
  const email = await m.pedir(`/v1/condominio/contatos/${CONTATO}/email`, { metodo: "PUT", corpo: { versao: 3, email: "Marina@Exemplo.invalid", recebe: true }, cookie });
  assertEquals((await email.json()).situacao, "PENDENTE");
  assertEquals(chamada(m, "plataforma_email_contato")?.p_email, "Marina@Exemplo.invalid");
  await m.pedir(`/v1/condominio/contatos/${CONTATO}/email`, { metodo: "PUT", corpo: { versao: 4, email: "", recebe: true }, cookie });
  assertEquals(chamada(m, "plataforma_email_contato")?.p_email, null, "vazio tira o e-mail");
  const doc = await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/email`, { corpo: { contatos: [CONTATO], emails: ["adv@exemplo.invalid"], recado: "" }, cookie });
  assertEquals(doc.status, 201);
  assertEquals(chamada(m, "plataforma_enviar_documento"), { p_pessoa: ANA, p_condominio: AURORA, p_id: DOCUMENTO, p_contatos: [CONTATO], p_emails: ["adv@exemplo.invalid"], p_recado: null });
  assertEquals((await erro(await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/email`, { corpo: { contatos: [], emails: [] }, cookie }))).detalhes?.campos, ["contatos"]);
  assertEquals((await (await m.pedir("/v1/condominio/documentos/pedidos", { cookie })).json()).esperando, 0);
  assertEquals((await erro(await m.pedir(`/v1/condominio/documentos/pedidos/${ENVIO}/decidir`, { corpo: { enviar: false }, cookie }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`/v1/condominio/documentos/pedidos/${ENVIO}/decidir`, { corpo: { enviar: true }, cookie });
  assertEquals(chamada(m, "plataforma_decidir_pedido_documento")?.p_enviar, true);
  await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/envios/${ENVIO}/cancelar`, { corpo: {}, cookie });
  assertEquals(chamada(m, "plataforma_cancelar_envio_documento")?.p_envio, ENVIO);
  await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}/corrigir`, { corpo: { versao: 2, titulo: "Falta de água", texto: "Das 9h às 13h.", mudanca: "Horário", avisarEmail: true }, cookie });
  assertEquals(chamada(m, "plataforma_corrigir_comunicado")?.p_avisar_email, true);
});

Deno.test("a assinatura do aviso confere o segredo", async () => {
  const corpo = "{}";
  const h = new Headers(await assinar(corpo));
  assert(await avisoAssinado(SEGREDO_WEBHOOK, h, corpo));
  assert(!(await avisoAssinado(`whsec_${btoa("outro")}`, h, corpo)));
  assert(!(await avisoAssinado(SEGREDO_WEBHOOK, h, "{ }")));
});

Deno.test("as situações do e-mail são as mesmas do banco", async () => {
  const migration = await Deno.readTextFile(new URL("../../migrations/0160_mural_email.sql", import.meta.url));
  for (const k of Object.keys(SITUACOES_EMAIL)) assert(migration.includes(`'${k}'`), k);
});
