// Contrato pelo gov.br no Console falso (0308, R17.4; quadros 440 a 444; CM-13): o modelo em uso,
// os documentos do aceite, o contrato gerado, os envios do PDF assinado e o "armazenamento" em
// /api/v1/arquivos-comercial (a CSP dos testes não tem o endereço do Supabase). A conferência
// automática daqui lê marcas no conteúdo do arquivo: NAO-E-PDF (ou sem %PDF-) é arquivo inválido,
// SEM-ASSINATURA é sem assinatura e OUTRO-ARQUIVO não é o contrato gerado. As regras de verdade
// estão no banco (pgTAP 051) e na API (Deno, contrato_test.ts); aqui se confere a tela.
import type { Route } from "@playwright/test";
import type { ComercialConsole, PodeComercial } from "./api-falsa-console-comercial";

type Json = Record<string, unknown>;

const CAROLINA = { id: "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f", nome: "Carolina" };
export const MODELO_V1 = "5e6f7a8b-0000-4000-8000-0000000000f1";
export const CODIGO_CERRADO = "codigo-do-link-residencial-cerrado-01";
/** O CPF de quem aceitou a proposta do Cerrado (o do validador precisa bater). */
export const CPF_LUCIA = "529.982.247-25";
export const HASH_CONTRATO = `9f2c${"0".repeat(56)}41ab`;

const TEXTO_MODELO = "CONTRATO DE USO DA PLATAFORMA TRÍADE CONDO\n\nO «condominio», inscrito no CNPJ «cnpj», representado por «representante», contrata o plano «plano» por «valor_mensal» a partir de «data_inicio».\n\nO reajuste é anual pelo «indice_reajuste», com aviso antes.";
const TERMO = "TERMO DE TRATAMENTO DE DADOS\n\nA TRÍADE trata os dados do «condominio» como operadora, só para o atendimento contratado.";

let n = 0;
const novoId = (p: string) => `${p}-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export function criarContratos(hoje: string) {
  return {
    modelos: [{
      id: MODELO_V1, versao: 2, numero: 1, titulo: "Contrato de uso da plataforma", situacao: "EM_USO", revisao: { advogado: "Rui Barros", oab: "DF 12345", em: hoje },
      indiceReajuste: "IPCA", texto: TEXTO_MODELO, termo: TERMO, emUsoEm: new Date().toISOString(), emUsoPor: CAROLINA, criadoEm: new Date().toISOString(), criadoPor: CAROLINA,
    }] as Json[],
    documentos: [] as Json[],
    contratos: [] as Json[],
    envios: [] as Json[],
    /** id do arquivo → o nome, o tipo e o conteúdo que chegou. */
    arquivos: new Map<string, { nome: string; conteudo: Buffer }>(),
  };
}
export type Contratos = ReturnType<typeof criarContratos>;

const erro = (route: Route, status: number, codigo: string, detalhes?: Json) =>
  route.fulfill({ status, json: { erro: detalhes ? { codigo, detalhes } : { codigo } } });
const semVazios = (o: Json) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
const ABERTAS = ["NOVO", "EM_CONTATO", "DEMO_MARCADA", "DEMO_FEITA", "PROPOSTA_ENVIADA", "NEGOCIACAO", "APROVACAO"];
const linkDe = (id: string, baixar = true) => ({ url: `/api/v1/arquivos-comercial/${id}${baixar ? "?baixar=1" : ""}`, tipo: "application/pdf", expiraEm: new Date(Date.now() + 300_000).toISOString() });
const br = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

/** Põe no lugar um contrato assinado pelos dois (para o Virar cliente). */
export function contratoAssinado(p: ComercialConsole, interessadoId: string) {
  const id = novoId("c0a1b2c3");
  const em = new Date().toISOString();
  p.contrato.contratos.push({ id, interessadoId, versao: 3, numero: 1, situacao: "ASSINADO", hash: HASH_CONTRATO, geradoEm: em, prontoEm: em, assinadoEm: em, dataInicio: p.hoje,
    modeloId: MODELO_V1, pdfSha256: "a".repeat(64), pdfTamanho: 1200, geradoPor: CAROLINA, campos: {} });
  for (const parte of ["CONDOMINIO", "TRIADE"]) {
    p.contrato.envios.push({ id: novoId("e0a1b2c3"), contratoId: id, parte, situacao: "CONFERIDO", enviadoEm: em, conferidoEm: em, versao: 2, nome: `assinado-${parte.toLowerCase()}.pdf`,
      assinanteNome: parte === "TRIADE" ? "Carolina" : "Lúcia Prado" });
  }
}

/** Põe no lugar os documentos recebidos e o contrato gerado, à espera da assinatura do condomínio. */
export function contratoGerado(p: ComercialConsole, interessadoId: string) {
  const em = new Date().toISOString();
  p.contrato.documentos.push(
    { id: novoId("d0a1b2c3"), interessadoId, tipo: "CNPJ", situacao: "RECEBIDO", nome: "cnpj-cerrado.pdf", tamanho: 900, enviadoEm: em, recebidoEm: em, peloLink: true, cnpj: "11.222.333/0001-81" },
    { id: novoId("d0a1b2c3"), interessadoId, tipo: "ATA_ELEICAO", situacao: "RECEBIDO", nome: "ata-2025.pdf", tamanho: 900, enviadoEm: em, recebidoEm: em, peloLink: true, mandatoAte: "2030-03-31" },
  );
  return gerar(p, p.interessados.find((i) => i.id === interessadoId)!, { dataInicio: p.hoje });
}

const vigente = (p: ComercialConsole, interessadoId: unknown) => p.contrato.contratos.find((c) => c.interessadoId === interessadoId && c.situacao !== "SUBSTITUIDO");
export const situacaoDoContrato = (p: ComercialConsole, interessadoId: unknown) => vigente(p, interessadoId)?.situacao as string | undefined;

function aceiteDe(p: ComercialConsole, interessadoId: unknown) {
  const x = p.propostas.find((y) => y.interessadoId === interessadoId) as (Json & { id: string; versoes: Json[] }) | undefined;
  const v = x?.versoes.find((y) => y.situacao === "ACEITA" && y.aceite);
  return v ? { x, v, a: v.aceite as Json } : undefined;
}

function faltam(p: ComercialConsole, interessadoId: unknown): string[] {
  const recebido = (tipo: string) => p.contrato.documentos.find((d) => d.interessadoId === interessadoId && d.tipo === tipo && d.situacao === "RECEBIDO");
  const ata = recebido("ATA_ELEICAO");
  return [...(recebido("CNPJ") ? [] : ["CNPJ"]), ...(ata && String(ata.mandatoAte) >= p.hoje ? [] : ["ATA_ELEICAO"])];
}

function motivoSemGerar(p: ComercialConsole, i: Json): string | undefined {
  if (i.anonimizado) return "ANONIMIZADO";
  if (i.virouClienteEm) return "VIROU_CLIENTE";
  if (!ABERTAS.includes(String(i.etapa))) return "INTERESSADO_FECHADO";
  if (!aceiteDe(p, i.id)) return "SEM_ACEITE";
  if (p.contrato.contratos.some((c) => c.interessadoId === i.id && c.situacao === "ASSINADO")) return "CONTRATO_ASSINADO";
  if (!p.contrato.modelos.some((m) => m.situacao === "EM_USO")) return "SEM_MODELO_CONTRATO";
  if (faltam(p, i.id).length) return "FALTA_DOCUMENTO";
  return undefined;
}

function assinatura(p: ComercialConsole, c: Json, parte: string): Json {
  const deste = p.contrato.envios.filter((e) => e.contratoId === c.id && e.parte === parte);
  const ok = deste.find((e) => e.situacao === "CONFERIDO");
  if (ok) return semVazios({ situacao: "CONFERIDA", enviadoEm: ok.enviadoEm, conferidoEm: ok.conferidoEm, assinanteNome: ok.assinanteNome });
  const ultimo = deste.filter((e) => e.situacao !== "SUBSTITUIDO").at(-1);
  if (ultimo) {
    const s = ultimo.situacao === "A_CONFERIR" ? "A_CONFERIR" : ultimo.situacao === "RECUSADO" ? "RECUSADA" : ultimo.situacao === "ENVIANDO" ? "AGUARDANDO" : ultimo.motivo;
    return semVazios({ situacao: s, enviadoEm: ultimo.enviadoEm, motivoTexto: ultimo.motivoTexto });
  }
  return { situacao: parte === "TRIADE" && ["GERANDO", "AGUARDA_CONDOMINIO"].includes(String(c.situacao)) ? "ESPERA_CONDOMINIO" : "AGUARDANDO" };
}

function contratoJson(p: ComercialConsole, c: Json, interno: boolean): Json {
  const m = p.contrato.modelos.find((x) => x.id === c.modeloId);
  const base = semVazios({
    id: c.id, numero: c.numero, situacao: c.situacao, hash: c.hash, geradoEm: c.geradoEm, prontoEm: c.prontoEm, assinadoEm: c.assinadoEm, dataInicio: c.dataInicio,
    modelo: m ? { numero: m.numero, titulo: m.titulo } : undefined,
    assinaturas: { condominio: assinatura(p, c, "CONDOMINIO"), triade: assinatura(p, c, "TRIADE") },
    podeBaixar: ["AGUARDA_CONDOMINIO", "AGUARDA_TRIADE", "ASSINADO"].includes(String(c.situacao)), finalDisponivel: c.situacao === "ASSINADO",
  });
  return interno ? { ...base, ...semVazios({ versao: c.versao, pdfSha256: c.pdfSha256, pdfTamanho: c.pdfTamanho, geradoPor: c.geradoPor, campos: c.campos }) } : base;
}

const INTERNOS_ENVIO = ["versao", "enviadoPor", "sha256", "automatica", "conferencia", "recusa"];
function envioJson(e: Json, interno: boolean): Json {
  const { contratoId: _c, interessadoId: _i, assinanteNome: _a, ...resto } = e;
  return semVazios(interno ? resto : Object.fromEntries(Object.entries(resto).filter(([k]) => !INTERNOS_ENVIO.includes(k))));
}
function documentoJson(d: Json, interno: boolean): Json {
  const { interessadoId: _i, enviadoPor, sha256, ...resto } = d;
  return semVazios(interno ? { ...resto, enviadoPor, sha256 } : resto);
}

function respostaContrato(p: ComercialConsole, i: Json, pode: PodeComercial): Json {
  const ac = aceiteDe(p, i.id);
  const c = vigente(p, i.id);
  const motivo = motivoSemGerar(p, i);
  const m = p.contrato.modelos.find((x) => x.situacao === "EM_USO");
  if (i.virouClienteEm && !pode.cliente) {
    // Virou cliente: o Comercial vê só que o contrato foi assinado (CM-11).
    return semVazios({ interessado: { id: i.id, versao: i.versao, condominio: i.condominio, etapa: i.etapa }, documentos: [], faltam: [], envios: [], anteriores: [],
      contrato: c ? semVazios({ id: c.id, numero: c.numero, situacao: c.situacao, assinadoEm: c.assinadoEm }) : undefined, podeGerar: false, motivoSemGerar: motivo,
      podeConferir: false, podeAssinar: false, podeVirarCliente: false, virouClienteEm: i.virouClienteEm, restrito: true });
  }
  return semVazios({
    interessado: { id: i.id, versao: i.versao, condominio: i.condominio, etapa: i.etapa },
    aceite: ac ? { proposta: ac.v.numero, nome: ac.a.nome, cargo: ac.a.cargo, cpfMascarado: "***.982.247-**", aceitoEm: ac.a.em, linkAte: p.hoje } : undefined,
    documentos: p.contrato.documentos.filter((d) => d.interessadoId === i.id && d.situacao !== "ENVIANDO").map((d) => documentoJson(d, true)).reverse(),
    faltam: faltam(p, i.id),
    modeloEmUso: m ? { id: m.id, numero: m.numero, titulo: m.titulo } : undefined,
    podeGerar: pode.editar && !motivo, motivoSemGerar: motivo,
    contrato: c ? contratoJson(p, c, true) : undefined, dadosMudaram: c ? false : undefined,
    envios: c ? p.contrato.envios.filter((e) => e.contratoId === c.id).map((e) => envioJson(e, true)).reverse() : undefined,
    anteriores: p.contrato.contratos.filter((x) => x.interessadoId === i.id && x.situacao === "SUBSTITUIDO")
      .map((x) => semVazios({ id: x.id, numero: x.numero, geradoEm: x.geradoEm, substituidoEm: x.substituidoEm, motivo: x.substituidoMotivo })).reverse(),
    podeConferir: pode.editar, podeAssinar: !!pode.assinar, podeVirarCliente: !!pode.cliente && c?.situacao === "ASSINADO" && !i.virouClienteEm,
    virouClienteEm: i.virouClienteEm,
  });
}

function gerar(p: ComercialConsole, i: Json, corpo: Json): { ok: true; json: Json } | { ok: false; campos?: string[]; motivo?: string } {
  const motivo = motivoSemGerar(p, i);
  if (motivo) return { ok: false, motivo };
  if (!corpo.dataInicio || String(corpo.dataInicio) < p.hoje) return { ok: false, campos: ["dataInicio"] };
  const ant = vigente(p, i.id);
  if (ant && String(corpo.motivo ?? "").trim().length < 3) return { ok: false, campos: ["motivo"] };
  const ac = aceiteDe(p, i.id)!;
  const m = p.contrato.modelos.find((x) => x.situacao === "EM_USO")!;
  const doc = (tipo: string) => p.contrato.documentos.find((d) => d.interessadoId === i.id && d.tipo === tipo && d.situacao === "RECEBIDO");
  if (ant) {
    Object.assign(ant, { situacao: "SUBSTITUIDO", substituidoEm: new Date().toISOString(), substituidoMotivo: String(corpo.motivo).trim() });
    for (const e of p.contrato.envios) if (e.contratoId === ant.id) e.situacao = "SUBSTITUIDO";
  }
  const numero = p.contrato.contratos.filter((x) => x.interessadoId === i.id).length + 1;
  const id = novoId("c0a1b2c3");
  const em = new Date().toISOString();
  const c: Json = {
    id, interessadoId: i.id, versao: 2, numero, situacao: "AGUARDA_CONDOMINIO", hash: numero === 1 ? HASH_CONTRATO : `77aa${"1".repeat(56)}${String(numero).padStart(4, "0")}`,
    geradoEm: em, prontoEm: em, dataInicio: corpo.dataInicio, modeloId: m.id, pdfSha256: "b".repeat(64), pdfTamanho: 1500, geradoPor: CAROLINA,
    campos: { condominio: i.condominio, cnpj: doc("CNPJ")?.cnpj, representante: `${ac.a.nome}, ${ac.a.cargo}`, cpf_representante: "***.982.247-**",
      mandato_ate: doc("ATA_ELEICAO") ? br(String(doc("ATA_ELEICAO")!.mandatoAte)) : undefined, plano: "Mensal · fundador · 41 a 100 unidades", valor_mensal: "R$ 229,00",
      valor_anual: "Não se aplica", implantacao: "Sem custo", desconto: "Sem desconto", data_inicio: br(String(corpo.dataInicio)), indice_reajuste: m.indiceReajuste },
  };
  p.contrato.contratos.push(c);
  p.contrato.arquivos.set(id, { nome: `contrato-${numero}-residencial-cerrado.pdf`, conteudo: Buffer.from(`%PDF-1.7\nContrato gerado ${c.hash}\n%%EOF`) });
  return { ok: true, json: contratoJson(p, c, true) };
}

/** O começo do envio de um documento (pela equipe ou pelo link). */
function iniciarDocumento(p: ComercialConsole, i: Json, corpo: Json, peloLink: boolean): Json | { campos: string[] } {
  const campos = [
    ...(!["CNPJ", "ATA_ELEICAO", "ATA_APROVACAO"].includes(String(corpo.tipo)) ? ["tipo"] : []),
    ...(corpo.tipo === "CNPJ" && String(corpo.cnpj ?? "").replace(/\D/g, "").length !== 14 ? ["cnpj"] : []),
    ...(corpo.tipo === "ATA_ELEICAO" && !corpo.mandatoAte ? ["mandatoAte"] : []),
    ...(!(Number(corpo.tamanho) >= 1 && Number(corpo.tamanho) <= 10 * 1024 * 1024) ? ["tamanho"] : []),
  ];
  if (campos.length) return { campos };
  const id = novoId("d0a1b2c3");
  const d = String(corpo.cnpj ?? "").replace(/\D/g, "");
  p.contrato.documentos.push(semVazios({
    id, interessadoId: i.id, tipo: corpo.tipo, situacao: "ENVIANDO", nome: corpo.nome, tamanho: corpo.tamanho, enviadoEm: new Date().toISOString(), peloLink,
    cnpj: corpo.tipo === "CNPJ" ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : undefined,
    mandatoAte: corpo.tipo === "ATA_ELEICAO" ? corpo.mandatoAte : undefined, enviadoPor: peloLink ? undefined : CAROLINA,
  }));
  p.contrato.arquivos.set(id, { nome: String(corpo.nome), conteudo: Buffer.alloc(0) });
  return { documentoId: id, envio: { url: `/api/v1/arquivos-comercial/${id}`, metodo: "PUT", tipo: "application/pdf" } };
}

function verificarDocumento(p: ComercialConsole, id: string, interno: boolean): Json | null {
  const d = p.contrato.documentos.find((x) => x.id === id);
  if (!d || d.situacao !== "ENVIANDO") return null;
  const b = p.contrato.arquivos.get(id)?.conteudo ?? Buffer.alloc(0);
  if (b.subarray(0, 5).toString("latin1") !== "%PDF-") {
    Object.assign(d, { situacao: "RECUSADO", motivo: "O conteúdo não é um PDF de verdade." });
    return { ...documentoJson(d, interno), motivoTexto: "O conteúdo não é um PDF de verdade." };
  }
  for (const x of p.contrato.documentos) if (x.interessadoId === d.interessadoId && x.tipo === d.tipo && x.situacao === "RECEBIDO") x.situacao = "SUBSTITUIDO";
  Object.assign(d, { situacao: "RECEBIDO", recebidoEm: new Date().toISOString(), sha256: "c".repeat(64) });
  return documentoJson(d, interno);
}

function iniciarEnvio(p: ComercialConsole, c: Json, parte: string, corpo: Json, peloLink: boolean): Json | { motivo: string } | { campos: string[] } {
  if (c.situacao === "ASSINADO") return { motivo: "CONTRATO_ASSINADO" };
  if (parte === "CONDOMINIO" && c.situacao !== "AGUARDA_CONDOMINIO") return { motivo: "CONDOMINIO_JA_CONFERIDO" };
  if (parte === "TRIADE" && c.situacao !== "AGUARDA_TRIADE") return { motivo: "ORDEM_DAS_ASSINATURAS" };
  if (!(Number(corpo.tamanho) >= 1 && Number(corpo.tamanho) <= 10 * 1024 * 1024)) return { campos: ["tamanho"] };
  const id = novoId("e0a1b2c3");
  p.contrato.envios.push({ id, contratoId: c.id, interessadoId: c.interessadoId, parte, situacao: "ENVIANDO", enviadoEm: new Date().toISOString(), peloLink, nome: corpo.nome,
    tamanho: corpo.tamanho, versao: 1, enviadoPor: peloLink ? undefined : CAROLINA });
  p.contrato.arquivos.set(id, { nome: String(corpo.nome), conteudo: Buffer.alloc(0) });
  return { envioId: id, envio: { url: `/api/v1/arquivos-comercial/${id}`, metodo: "PUT", tipo: "application/pdf" } };
}

const TEXTOS_AUTO: Record<string, string> = {
  ARQUIVO_INVALIDO: "O arquivo não é um PDF que dá para conferir.",
  SEM_ASSINATURA: "O PDF enviado não tem assinatura digital nova. Assine pelo gov.br e envie o arquivo que ele devolver.",
  NAO_E_O_GERADO: "O conteúdo assinado não é o contrato gerado. Baixe o contrato, assine sem mudar nada e envie de novo.",
};

function verificarEnvio(p: ComercialConsole, id: string, interno: boolean): Json | null {
  const e = p.contrato.envios.find((x) => x.id === id);
  if (!e || e.situacao !== "ENVIANDO") return null;
  const t = (p.contrato.arquivos.get(id)?.conteudo ?? Buffer.alloc(0)).toString("latin1");
  const motivo = !t.startsWith("%PDF-") || t.includes("NAO-E-PDF") ? "ARQUIVO_INVALIDO" : t.includes("SEM-ASSINATURA") ? "SEM_ASSINATURA" : t.includes("OUTRO-ARQUIVO") ? "NAO_E_O_GERADO" : null;
  const em = new Date().toISOString();
  if (!motivo) {
    for (const x of p.contrato.envios) if (x.contratoId === e.contratoId && x.parte === e.parte && ["A_CONFERIR", "NAO_E_O_GERADO"].includes(String(x.situacao))) x.situacao = "SUBSTITUIDO";
    Object.assign(e, { situacao: "A_CONFERIR", sha256: "d".repeat(64), automatica: { temAssinatura: true, assinaturas: e.parte === "TRIADE" ? 2 : 1, eOGerado: true, em } });
  } else {
    Object.assign(e, { situacao: motivo === "NAO_E_O_GERADO" ? "NAO_E_O_GERADO" : "RECUSADO_NA_HORA", motivo, motivoTexto: TEXTOS_AUTO[motivo],
      automatica: motivo === "ARQUIVO_INVALIDO" ? undefined : { temAssinatura: motivo !== "SEM_ASSINATURA", assinaturas: motivo === "SEM_ASSINATURA" ? 0 : 1, eOGerado: false, em } });
  }
  return { ...envioJson(e, interno), apagarArquivo: e.situacao === "RECUSADO_NA_HORA" };
}

/** As rotas do contrato no Console: as do interessado e as de contrato, envio, documento e modelo. */
export async function rotasContrato(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json, pode: PodeComercial, url: URL): Promise<unknown> {
  // Modelos › Contrato (quadro 443).
  if (caminho === "/v1/comercial/modelos/contrato" && metodo === "GET") {
    const json = (m: Json, texto: boolean) => {
      const { texto: t, termo, ...resto } = m;
      const falta = [...(m.revisao ? [] : ["revisao"]), ...(termo ? [] : ["termo"]), ...(m.indiceReajuste ? [] : ["indiceReajuste"])];
      const contratos = p.contrato.contratos.filter((c) => c.modeloId === m.id).length;
      return semVazios({ ...resto, temTermo: !!termo, contratos, falta, ...(texto ? { texto: t, termo } : {}) });
    };
    const emUso = p.contrato.modelos.find((m) => m.situacao === "EM_USO");
    return route.fulfill({ json: { versoes: [...p.contrato.modelos].reverse().map((m) => json(m, true)), emUso: emUso ? json(emUso, false) : undefined,
      campos: ["condominio", "cnpj", "representante", "cpf_representante", "mandato_ate", "plano", "valor_mensal", "valor_anual", "implantacao", "desconto", "data_inicio", "indice_reajuste"],
      podeEditar: pode.modelos } });
  }
  const mm = /^\/v1\/comercial\/modelos\/contrato(?:\/([0-9a-f-]{36}))?(\/usar)?$/.exec(caminho);
  if (mm) {
    if (!pode.modelos) return erro(route, 403, "FORBIDDEN");
    const m = mm[1] ? p.contrato.modelos.find((x) => x.id === mm[1]) : undefined;
    if (mm[1] && !m) return erro(route, 404, "NOT_FOUND");
    if (mm[2]) {
      if (corpo.versao !== m!.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: m!.versao });
      const falta = [...(m!.revisao ? [] : ["advogadoNome", "advogadoOab", "revisadoEm"]), ...(m!.termo ? [] : ["termo"]), ...(m!.indiceReajuste ? [] : ["indiceReajuste"])];
      if (falta.length) return erro(route, 422, "VALIDATION_ERROR", { motivo: "MODELO_SEM_REVISAO", campos: falta });
      for (const x of p.contrato.modelos) if (x.situacao === "EM_USO") Object.assign(x, { situacao: "SUBSTITUIDA", substituidaEm: new Date().toISOString(), versao: Number(x.versao) + 1 });
      Object.assign(m!, { situacao: "EM_USO", emUsoEm: new Date().toISOString(), emUsoPor: CAROLINA, versao: Number(m!.versao) + 1 });
      return route.fulfill({ json: m });
    }
    const texto = String(corpo.texto ?? "");
    const errados = [...`${texto}\n${corpo.termo ?? ""}`.matchAll(/«([^«»]*)»/g)].map((x) => x[1]!).filter((k) => !/^(condominio|cnpj|representante|cpf_representante|mandato_ate|plano|valor_mensal|valor_anual|implantacao|desconto|data_inicio|indice_reajuste)$/.test(k));
    if (errados.length) return erro(route, 422, "VALIDATION_ERROR", { motivo: "CAMPO_ERRADO", campos: ["texto"], camposErrados: errados.map((x) => `«${x}»`) });
    const campos = [...(String(corpo.titulo ?? "").trim().length < 3 ? ["titulo"] : []), ...(texto.trim().length < 50 ? ["texto"] : [])];
    const revisao = [corpo.advogadoNome, corpo.advogadoOab, corpo.revisadoEm];
    if (revisao.some(Boolean) && !revisao.every(Boolean)) campos.push(...["advogadoNome", "advogadoOab", "revisadoEm"].filter((_, k) => !revisao[k]));
    if (campos.length) return erro(route, 400, "VALIDATION_ERROR", { campos });
    if (m && m.situacao !== "RASCUNHO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "MODELO_EM_USO" });
    if (m && corpo.versao !== m.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: m.versao });
    const dados = semVazios({ titulo: String(corpo.titulo).trim(), texto, termo: corpo.termo || undefined, indiceReajuste: corpo.indiceReajuste || undefined,
      revisao: corpo.advogadoNome ? { advogado: corpo.advogadoNome, oab: String(corpo.advogadoOab).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^OAB/, "").replace(/^([A-Z]{2})/, "$1 "), em: corpo.revisadoEm } : undefined });
    if (m) {
      for (const k of ["termo", "indiceReajuste", "revisao"]) delete m[k];
      Object.assign(m, dados, { versao: Number(m.versao) + 1 });
      return route.fulfill({ json: m });
    }
    const novo = { id: novoId("5e6f7a8b"), versao: 1, numero: p.contrato.modelos.length + 1, situacao: "RASCUNHO", criadoEm: new Date().toISOString(), criadoPor: CAROLINA, ...dados };
    p.contrato.modelos.push(novo);
    return route.fulfill({ status: 201, json: novo });
  }

  const mi = /^\/v1\/comercial\/interessados\/([0-9a-f-]{36})\/(contrato|documentos)$/.exec(caminho);
  if (mi) {
    const i = p.interessados.find((x) => x.id === mi[1]);
    if (!i) return erro(route, 404, "NOT_FOUND");
    if (mi[2] === "contrato" && metodo === "GET") return route.fulfill({ json: respostaContrato(p, i, pode) });
    if (!pode.editar) return erro(route, 403, "FORBIDDEN");
    if (mi[2] === "contrato" && metodo === "POST") {
      const r = gerar(p, i, corpo);
      if (r.ok) return route.fulfill({ status: 201, json: r.json });
      if (r.motivo) return erro(route, 422, "VALIDATION_ERROR", { motivo: r.motivo, ...(r.motivo === "FALTA_DOCUMENTO" ? { faltam: faltam(p, i.id) } : {}) });
      return erro(route, 400, "VALIDATION_ERROR", { campos: r.campos });
    }
    if (mi[2] === "documentos" && metodo === "POST") {
      if (!aceiteDe(p, i.id)) return erro(route, 422, "VALIDATION_ERROR", { motivo: "SEM_ACEITE" });
      const r = iniciarDocumento(p, i, corpo, false);
      return "campos" in r ? erro(route, 400, "VALIDATION_ERROR", { campos: r.campos }) : route.fulfill({ status: 201, json: r });
    }
    return erro(route, 404, "NOT_FOUND");
  }
  const md = /^\/v1\/comercial\/documentos\/([0-9a-f-]{36})\/(verificar|link)$/.exec(caminho);
  if (md) {
    if (md[2] === "link") return p.contrato.documentos.some((d) => d.id === md[1]) ? route.fulfill({ json: linkDe(md[1]!) }) : erro(route, 404, "NOT_FOUND");
    const r = verificarDocumento(p, md[1]!, true);
    return r ? route.fulfill({ json: r }) : erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_CONFERIDO" });
  }
  const mc = /^\/v1\/comercial\/contratos\/([0-9a-f-]{36})\/(link|envios)$/.exec(caminho);
  if (mc) {
    const c = p.contrato.contratos.find((x) => x.id === mc[1]);
    if (!c) return erro(route, 404, "NOT_FOUND");
    if (mc[2] === "link") {
      const envio = url.searchParams.get("envio");
      if (envio && !p.contrato.envios.some((e) => e.id === envio && e.contratoId === c.id)) return erro(route, 404, "NOT_FOUND");
      return route.fulfill({ json: linkDe(envio ?? String(c.id), url.searchParams.get("baixar") === "1") });
    }
    const parte = String(corpo.parte ?? "TRIADE");
    if (parte === "TRIADE" ? !pode.assinar : !pode.editar) return erro(route, 403, "FORBIDDEN");
    const r = iniciarEnvio(p, c, parte, corpo, false);
    if ("motivo" in r) return erro(route, 422, "VALIDATION_ERROR", { motivo: r.motivo });
    return "campos" in r ? erro(route, 400, "VALIDATION_ERROR", { campos: r.campos }) : route.fulfill({ status: 201, json: r });
  }
  const me = /^\/v1\/comercial\/envios\/([0-9a-f-]{36})\/(verificar|conferir|recusar)$/.exec(caminho);
  if (me) {
    if (!pode.editar) return erro(route, 403, "FORBIDDEN");
    const e = p.contrato.envios.find((x) => x.id === me[1]);
    if (!e) return erro(route, 404, "NOT_FOUND");
    if (me[2] === "verificar") {
      const r = verificarEnvio(p, me[1]!, true);
      return r ? route.fulfill({ json: r }) : erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_CONFERIDO" });
    }
    if (corpo.versao !== e.versao) return erro(route, 409, "VERSION_CONFLICT", { versao: e.versao });
    const c = p.contrato.contratos.find((x) => x.id === e.contratoId)!;
    if (me[2] === "recusar") {
      if (!["A_CONFERIR", "NAO_E_O_GERADO"].includes(String(e.situacao))) return erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_NAO_CONFERIVEL" });
      const motivo = String(corpo.motivo ?? "").trim();
      if (motivo.length < 3) return erro(route, 400, "VALIDATION_ERROR", { campos: ["motivo"] });
      Object.assign(e, { situacao: "RECUSADO", motivo: "RECUSADO_NA_CONFERENCIA", motivoTexto: motivo, recusa: { motivo, por: CAROLINA, em: new Date().toISOString() }, versao: Number(e.versao) + 1 });
      return route.fulfill({ json: envioJson(e, true) });
    }
    if (e.situacao !== "A_CONFERIR") return erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_NAO_CONFERIVEL" });
    const falta = ["assinaturaValida", "pessoaConfere", "dataConfere"].filter((k) => corpo[k] !== true);
    if (falta.length) return erro(route, 400, "VALIDATION_ERROR", { campos: falta });
    const cpf = String(corpo.cpf ?? "").replace(/\D/g, "");
    if (e.parte === "CONDOMINIO" && cpf && cpf !== CPF_LUCIA.replace(/\D/g, "")) return erro(route, 422, "VALIDATION_ERROR", { motivo: "CPF_NAO_CONFERE" });
    if (e.parte === "TRIADE" && cpf.length !== 11) return erro(route, 400, "VALIDATION_ERROR", { campos: ["cpf"] });
    const em = new Date().toISOString();
    const nome = e.parte === "CONDOMINIO" ? "Lúcia Prado" : String(corpo.assinanteNome || "Carolina");
    Object.assign(e, { situacao: "CONFERIDO", conferidoEm: em, assinanteNome: nome, versao: Number(e.versao) + 1,
      conferencia: semVazios({ assinaturaValida: true, pessoaConfere: true, dataConfere: true, assinanteNome: nome, cpfMascarado: `***.${(cpf || "52998224725").slice(3, 6)}.${(cpf || "52998224725").slice(6, 9)}-**`,
        observacao: corpo.observacao || undefined, por: CAROLINA, em }) });
    Object.assign(c, e.parte === "CONDOMINIO" ? { situacao: "AGUARDA_TRIADE" } : { situacao: "ASSINADO", assinadoEm: em }, { versao: Number(c.versao) + 1 });
    if (c.situacao === "ASSINADO") {
      p.contrato.arquivos.set(`${c.id}-final`, { nome: "contrato-assinado-residencial-cerrado.pdf", conteudo: Buffer.from("%PDF-1.7\nAssinado pelos dois\n%%EOF") });
    }
    return route.fulfill({ json: { ...envioJson(e, true), contrato: contratoJson(p, c, true) } });
  }
  return null;
}

/** As rotas do link do síndico depois do aceite (quadro 441), sem sessão. */
export async function rotasPublicasContrato(route: Route, p: ComercialConsole, caminho: string, metodo: string, corpo: Json): Promise<unknown> {
  const m = /^\/v1\/publico\/propostas\/([A-Za-z0-9_-]+)\/(contrato|contrato\/pdf|contrato\/assinado|contrato\/assinado\/([0-9a-f-]{36})\/verificar|documentos|documentos\/([0-9a-f-]{36})\/verificar)$/.exec(caminho);
  if (!m) return null;
  const l = p.links[m[1]!];
  const x = l ? p.propostas.find((y) => y.id === l.propostaId) as (Json & { interessadoId: string; versoes: Json[] }) | undefined : undefined;
  const v = x?.versoes.find((y) => y.id === l!.versaoId);
  const i = x ? p.interessados.find((y) => y.id === x.interessadoId) : undefined;
  if (!x || !v || !i || v.situacao !== "ACEITA" || i.anonimizado || ["PERDIDO", "SEM_RESPOSTA"].includes(String(i.etapa))) return erro(route, 404, "NOT_FOUND");
  if (metodo !== "GET") p.pedidos.push({ caminho, corpo });
  const c = vigente(p, i.id);
  const qual = m[2]!;
  if (qual === "contrato" && metodo === "GET") {
    const a = v.aceite as Json;
    return route.fulfill({ json: semVazios({
      condominio: v.condominio, proposta: v.numero, aceite: { nome: a.nome, cargo: a.cargo, aceitoEm: a.em }, linkAte: p.hoje,
      documentos: p.contrato.documentos.filter((d) => d.interessadoId === i.id && ["RECEBIDO", "RECUSADO"].includes(String(d.situacao))).map((d) => documentoJson(d, false)).reverse(),
      faltam: faltam(p, i.id), podeEnviarDocumentos: c?.situacao !== "ASSINADO",
      contrato: c && c.situacao !== "GERANDO" ? { ...contratoJson(p, c, false), podeEnviar: c.situacao === "AGUARDA_CONDOMINIO" } : undefined,
    }) });
  }
  if (qual === "contrato/pdf") {
    const final = new URL(route.request().url()).searchParams.get("final") === "1";
    if (!c || (final && c.situacao !== "ASSINADO")) return erro(route, 404, "NOT_FOUND");
    return route.fulfill({ json: linkDe(final ? `${c.id}-final` : String(c.id)) });
  }
  if (qual === "documentos" && metodo === "POST") {
    if (c?.situacao === "ASSINADO") return erro(route, 422, "VALIDATION_ERROR", { motivo: "CONTRATO_ASSINADO" });
    const r = iniciarDocumento(p, i, corpo, true);
    return "campos" in r ? erro(route, 400, "VALIDATION_ERROR", { campos: r.campos }) : route.fulfill({ status: 201, json: r });
  }
  if (m[4]) {
    const r = verificarDocumento(p, m[4], false);
    return r ? route.fulfill({ json: r }) : erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_CONFERIDO" });
  }
  if (qual === "contrato/assinado" && metodo === "POST") {
    if (!c) return erro(route, 404, "NOT_FOUND");
    const r = iniciarEnvio(p, c, "CONDOMINIO", corpo, true);
    if ("motivo" in r) return erro(route, 422, "VALIDATION_ERROR", { motivo: r.motivo });
    return "campos" in r ? erro(route, 400, "VALIDATION_ERROR", { campos: r.campos }) : route.fulfill({ status: 201, json: r });
  }
  if (m[3]) {
    const r = verificarEnvio(p, m[3], false);
    return r ? route.fulfill({ json: r }) : erro(route, 422, "VALIDATION_ERROR", { motivo: "ENVIO_CONFERIDO" });
  }
  return erro(route, 404, "NOT_FOUND");
}

/** O "armazenamento" do Comercial: recebe o PDF em binário e devolve como download. */
export async function rotasArquivoComercial(route: Route, p: ComercialConsole, caminho: string, metodo: string): Promise<unknown> {
  const m = /^\/v1\/arquivos-comercial\/([0-9a-f-]{36}(?:-final)?)$/.exec(caminho);
  if (!m) return null;
  const a = p.contrato.arquivos.get(m[1]!);
  if (!a) return route.fulfill({ status: 404, body: "" });
  if (metodo === "PUT") {
    a.conteudo = route.request().postDataBuffer() ?? Buffer.alloc(0);
    return route.fulfill({ json: { Key: m[1] } });
  }
  return route.fulfill({ status: 200, body: a.conteudo, contentType: "application/pdf", headers: { "content-disposition": `attachment; filename="${a.nome}"` } });
}
