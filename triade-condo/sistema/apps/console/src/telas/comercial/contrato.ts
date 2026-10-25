// Contrato pelo gov.br (0308, R17.4; quadros 440 a 444, aprovados em 25/10/2026; CM-13): o que a
// api-console devolve (contrato em comercial/r17-3/contrato-api.md, 8.2 a 8.8), as rotas, o envio
// em três passos (pede o link, sobe o PDF, pede a verificação) e os textos de cada estado. A ordem
// das assinaturas, a conferência automática e quem pode são do banco e da api-console.

import {
  CAMPOS_CONTRATO, cnpjValido, DOCUMENTOS_ACEITE, mostrarDataSemHora, TAMANHO_MAXIMO_PDF_CONTRATO, type DocumentoAceite, type ParteContrato, type SituacaoContrato,
  type SituacaoEnvio, type SITUACOES_DOCUMENTO, type SITUACOES_MODELO_CONTRATO,
} from "@triade/domain";
import { chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { Documento, PessoaRef } from "./propostas.ts";

const cod = (c: string) => encodeURIComponent(c);

export const ROTAS_CONTRATO = {
  contrato: (interessado: string) => `/v1/comercial/interessados/${interessado}/contrato`,
  documentos: (interessado: string) => `/v1/comercial/interessados/${interessado}/documentos`,
  verificarDocumento: (id: string) => `/v1/comercial/documentos/${id}/verificar`,
  linkDocumento: (id: string) => `/v1/comercial/documentos/${id}/link?baixar=1`,
  linkContrato: (contrato: string, envio?: string) => `/v1/comercial/contratos/${contrato}/link?${envio ? `envio=${envio}&` : ""}baixar=1`,
  envios: (contrato: string) => `/v1/comercial/contratos/${contrato}/envios`,
  verificarEnvio: (id: string) => `/v1/comercial/envios/${id}/verificar`,
  conferir: (id: string) => `/v1/comercial/envios/${id}/conferir`,
  recusar: (id: string) => `/v1/comercial/envios/${id}/recusar`,
  modelos: "/v1/comercial/modelos/contrato",
  modelo: (id?: string) => (id ? `/v1/comercial/modelos/contrato/${id}` : "/v1/comercial/modelos/contrato"),
  usarModelo: (id: string) => `/v1/comercial/modelos/contrato/${id}/usar`,
  publico: (codigo: string) => `/v1/publico/propostas/${cod(codigo)}/contrato`,
  publicoDocumentos: (codigo: string) => `/v1/publico/propostas/${cod(codigo)}/documentos`,
  publicoVerificarDocumento: (codigo: string, id: string) => `/v1/publico/propostas/${cod(codigo)}/documentos/${id}/verificar`,
  publicoPdf: (codigo: string, final = false) => `/v1/publico/propostas/${cod(codigo)}/contrato/pdf${final ? "?final=1" : ""}`,
  publicoAssinado: (codigo: string) => `/v1/publico/propostas/${cod(codigo)}/contrato/assinado`,
  publicoVerificarAssinado: (codigo: string, id: string) => `/v1/publico/propostas/${cod(codigo)}/contrato/assinado/${id}/verificar`,
};

export const TELAS_CONTRATO = {
  contrato: (interessado: string) => `/comercial/${interessado}/contrato`,
  link: (codigo: string) => `/o/${codigo}/contrato`,
};

/** Os endereços oficiais do gov.br: assinar e conferir. */
export const ASSINADOR_GOVBR = "https://assinador.iti.br";
export const VALIDADOR_GOVBR = "https://validar.iti.gov.br";

// ---------------------------------------------------------------------------------------------
// O que a API devolve. Campo ausente é nulo (o banco tira os nulos).

export type SituacaoAssinatura = "AGUARDANDO" | "ESPERA_CONDOMINIO" | "A_CONFERIR" | "NAO_E_O_GERADO" | "SEM_ASSINATURA" | "ARQUIVO_INVALIDO" | "RECUSADA" | "CONFERIDA";

export interface Assinatura { situacao: SituacaoAssinatura; enviadoEm?: string; conferidoEm?: string; assinanteNome?: string; motivoTexto?: string }

export interface DocumentoTela {
  id: string; tipo: DocumentoAceite; situacao: keyof typeof SITUACOES_DOCUMENTO; nome: string; tamanho?: number; enviadoEm: string; recebidoEm?: string; peloLink?: boolean;
  motivo?: string; motivoTexto?: string; mandatoAte?: string; cnpj?: string; enviadoPor?: PessoaRef; sha256?: string;
}

export interface ContratoTela {
  id: string; versao?: number; numero: number; situacao: SituacaoContrato; hash: string; geradoEm: string; prontoEm?: string; assinadoEm?: string; dataInicio?: string;
  modelo?: { numero: number; titulo: string }; assinaturas: Record<"condominio" | "triade", Assinatura>; podeBaixar: boolean; finalDisponivel: boolean;
  pdfSha256?: string; pdfTamanho?: number; campos?: Record<string, string>; geradoPor?: PessoaRef; podeEnviar?: boolean;
}

export interface EnvioTela {
  id: string; versao?: number; parte: ParteContrato; situacao: SituacaoEnvio; enviadoEm: string; peloLink?: boolean; nome?: string; tamanho?: number; motivo?: string;
  motivoTexto?: string; sha256?: string; enviadoPor?: PessoaRef; conferidoEm?: string;
  automatica?: { temAssinatura: boolean; assinaturas?: number; eOGerado?: boolean; em: string };
  conferencia?: { assinanteNome?: string; cpfMascarado?: string; observacao?: string; por?: PessoaRef; em: string };
  recusa?: { motivo: string; por?: PessoaRef; em: string };
}

export type MotivoSemGerar = "ANONIMIZADO" | "VIROU_CLIENTE" | "INTERESSADO_FECHADO" | "SEM_ACEITE" | "CONTRATO_ASSINADO" | "SEM_MODELO_CONTRATO" | "FALTA_DOCUMENTO";

export interface RespostaContrato {
  interessado: { id: string; versao: number; condominio: string; etapa: string };
  aceite?: { proposta: number; nome: string; cargo: string; cpfMascarado?: string; aceitoEm: string; linkAte?: string };
  documentos: DocumentoTela[];
  faltam: DocumentoAceite[];
  modeloEmUso?: { id: string; numero: number; titulo: string };
  podeGerar: boolean;
  motivoSemGerar?: MotivoSemGerar;
  contrato?: ContratoTela;
  dadosMudaram?: boolean;
  envios?: EnvioTela[];
  anteriores: { id: string; numero: number; geradoEm: string; substituidoEm?: string; motivo?: string }[];
  podeConferir: boolean;
  podeAssinar: boolean;
  podeVirarCliente: boolean;
  virouClienteEm?: string;
  /** Virou cliente e quem lê é do Comercial (CM-11): só o número e a situação do contrato, sem assinaturas nem dados. */
  restrito?: boolean;
}

export interface ModeloContrato {
  id: string; versao: number; numero: number; titulo: string; situacao: keyof typeof SITUACOES_MODELO_CONTRATO;
  revisao?: { advogado: string; oab: string; em: string }; indiceReajuste?: string; temTermo: boolean; emUsoEm?: string; emUsoPor?: PessoaRef; substituidaEm?: string;
  criadoEm: string; criadoPor?: PessoaRef; contratos: number; falta: ("revisao" | "termo" | "indiceReajuste")[]; texto?: string; termo?: string;
}
export interface RespostaModelos { versoes: ModeloContrato[]; emUso?: ModeloContrato; campos: string[]; podeEditar: boolean }

export interface ContratoPublico {
  condominio: string; proposta: number; aceite: { nome: string; cargo: string; aceitoEm: string }; linkAte?: string;
  documentos: DocumentoTela[]; faltam: DocumentoAceite[]; podeEnviarDocumentos: boolean; contrato?: ContratoTela;
}

// ---------------------------------------------------------------------------------------------
// Textos.

const data = (d?: string) => (d ? mostrarDataSemHora(d.slice(0, 10)) : "");
const hora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  .format(new Date(iso)).replace(",", "");
export { hora as diaHoraCurto };

/** "9f2c…41ab": a impressão digital curta, como no quadro 440. */
export const hashCurto = (h?: string) => (h && h.length > 12 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h ?? "");

/** O selo de cada assinatura (quadros 440 e 444). */
export function seloAssinatura(a: Assinatura, parte: ParteContrato, contrato: Pick<ContratoTela, "situacao">): { texto: string; tom: "ok" | "atencao" | "neutro" | "erro" | "info" } {
  switch (a.situacao) {
    case "CONFERIDA": return { texto: "Conferida", tom: "ok" };
    case "A_CONFERIR": return { texto: "Falta conferir", tom: "atencao" };
    case "NAO_E_O_GERADO": return { texto: "Não é o contrato gerado", tom: "atencao" };
    case "SEM_ASSINATURA": return { texto: "Sem assinatura", tom: "erro" };
    case "ARQUIVO_INVALIDO": return { texto: "Arquivo inválido", tom: "erro" };
    case "RECUSADA": return { texto: "Recusada", tom: "erro" };
    case "ESPERA_CONDOMINIO": return { texto: "Espera o condomínio", tom: "neutro" };
    default:
      return parte === "TRIADE" && contrato.situacao === "AGUARDA_TRIADE" ? { texto: "Sua vez", tom: "atencao" } : { texto: "Aguardando", tom: "neutro" };
  }
}

/** "1 de 2". */
export const assinadas = (c: Pick<ContratoTela, "assinaturas">) => [c.assinaturas.condominio, c.assinaturas.triade].filter((a) => a.situacao === "CONFERIDA").length;

/** O texto de baixo de cada passo das assinaturas (quadro 440). */
export function apoioAssinatura(a: Assinatura, parte: ParteContrato, contrato: Pick<ContratoTela, "situacao">): string {
  if (a.situacao === "CONFERIDA") return `Conferida${a.conferidoEm ? ` em ${hora(a.conferidoEm)}` : ""} no validar.iti.gov.br${a.assinanteNome ? ` · ${a.assinanteNome}` : ""}.`;
  if (a.situacao === "A_CONFERIR") return `PDF assinado enviado${a.enviadoEm ? ` em ${hora(a.enviadoEm)}` : ""}. Falta a equipe conferir no validar.iti.gov.br.`;
  if (a.situacao === "NAO_E_O_GERADO" || a.situacao === "SEM_ASSINATURA" || a.situacao === "ARQUIVO_INVALIDO" || a.situacao === "RECUSADA") {
    return a.motivoTexto ?? "O envio não serviu; é preciso enviar de novo.";
  }
  if (parte === "CONDOMINIO") return "O síndico baixa o contrato pelo link da proposta, assina no gov.br e envia de volta.";
  if (contrato.situacao === "AGUARDA_TRIADE") return "Baixe o PDF já assinado pelo condomínio, assine no gov.br e envie aqui. Assim o arquivo final leva as duas assinaturas.";
  return "Depois da assinatura do condomínio conferida, a TRÍADE assina sobre o mesmo arquivo.";
}

export type Tom = "ok" | "atencao" | "neutro" | "erro" | "info";
export interface EstadoContrato { chave: string; titulo: string; texto: string; tom: Tom }

/**
 * O estado do contrato que a tela mostra no alto (quadro 444): o que falta ou por que o arquivo
 * enviado não serviu. Sem nada a dizer, nulo.
 */
export function estadoDoContrato(r: Pick<RespostaContrato, "motivoSemGerar" | "contrato" | "envios" | "anteriores" | "interessado">): EstadoContrato | null {
  const c = r.contrato;
  if (r.motivoSemGerar === "ANONIMIZADO" || (r.motivoSemGerar === "INTERESSADO_FECHADO" && c?.situacao !== "ASSINADO")) {
    return { chave: "LINK_FECHADO", titulo: "Link do síndico fechado", texto: "O interessado foi marcado como perdido ou pediu exclusão. O link não recebe mais arquivos.", tom: "neutro" };
  }
  if (c?.situacao === "ASSINADO") return { chave: "ASSINADO", titulo: "Assinado pelos dois", texto: "As duas assinaturas foram conferidas. O síndico já pode baixar o PDF final pelo link.", tom: "ok" };
  if (!c) {
    if (r.motivoSemGerar === "SEM_ACEITE") return { chave: "SEM_ACEITE", titulo: "Sem proposta aceita", texto: "O contrato sai da proposta aceita. Mande a proposta e espere o aceite pelo link.", tom: "neutro" };
    if (r.motivoSemGerar === "SEM_MODELO_CONTRATO") {
      return { chave: "SEM_MODELO", titulo: "Sem modelo em uso", texto: "Nenhuma versão do modelo foi revisada por advogado e posta em uso. Gerar contrato fica desligado até a Administração cadastrar em Modelos › Contrato.", tom: "atencao" };
    }
    if (r.motivoSemGerar === "FALTA_DOCUMENTO") {
      return { chave: "FALTA_DOCUMENTO", titulo: "Falta CNPJ ou ata", texto: "O síndico ainda não enviou o cartão do CNPJ e a ata da eleição com o fim do mandato. Gerar contrato espera os dois.", tom: "atencao" };
    }
    return null;
  }
  const ultimo = (r.envios ?? []).filter((e) => e.situacao !== "SUBSTITUIDO" && e.situacao !== "ENVIANDO")[0];
  if (ultimo?.situacao === "RECUSADO_NA_HORA" && ultimo.motivo === "SEM_ASSINATURA") {
    return { chave: "SEM_ASSINATURA", titulo: "Arquivo sem assinatura", texto: "O PDF enviado não tem assinatura digital. Quem enviou vê: assine pelo gov.br e envie o arquivo que ele devolver.", tom: "atencao" };
  }
  if (ultimo?.situacao === "RECUSADO_NA_HORA") return { chave: "ARQUIVO_INVALIDO", titulo: "Arquivo inválido", texto: ultimo.motivoTexto ?? "O arquivo não é um PDF que dá para conferir.", tom: "atencao" };
  if (ultimo?.situacao === "NAO_E_O_GERADO") {
    return { chave: "NAO_E_O_GERADO", titulo: "Não é o contrato gerado", texto: "O conteúdo assinado é diferente do PDF gerado (página trocada ou outro arquivo). O envio fica guardado, mas não conta.", tom: "atencao" };
  }
  if (ultimo?.situacao === "RECUSADO") {
    return { chave: "RECUSADA", titulo: "Assinatura recusada na conferência",
      texto: `${ultimo.recusa?.por?.nome ?? "A equipe"} recusou${ultimo.recusa ? ` em ${data(ultimo.recusa.em)}` : ""}: ${ultimo.recusa?.motivo ?? ultimo.motivoTexto ?? "sem motivo"}. Quem enviou recebe o pedido de envio novo com o motivo.`, tom: "erro" };
  }
  if (r.anteriores.length && assinadas(c) === 0 && !ultimo) {
    return { chave: "GERADO_DE_NOVO", titulo: "Contrato gerado de novo", texto: `O PDF novo precisa das duas assinaturas outra vez; o anterior (nº ${r.anteriores[0]!.numero}) fica substituído.`, tom: "neutro" };
  }
  return null;
}

/** Por que Gerar contrato está desligado, na ordem do quadro 336. */
export const MOTIVOS_SEM_GERAR: Record<MotivoSemGerar, string> = {
  ANONIMIZADO: "Os dados deste interessado foram apagados (LGPD).",
  VIROU_CLIENTE: "Este interessado já virou cliente. O contrato fica na ficha do cliente.",
  INTERESSADO_FECHADO: "O interessado está fechado. Reabra antes de gerar o contrato.",
  SEM_ACEITE: "O contrato sai da proposta aceita. Mande a proposta e espere o aceite pelo link.",
  CONTRATO_ASSINADO: "O contrato já foi assinado pelos dois. Mudança agora é por aditivo.",
  SEM_MODELO_CONTRATO: "Nenhuma versão do modelo de contrato está em uso. A Administração cadastra em Modelos › Contrato, com a revisão do advogado.",
  FALTA_DOCUMENTO: "Falta o cartão do CNPJ ou a ata da eleição com o fim do mandato. Peça pelo link ou envie pela equipe.",
};

/** Os campos preenchidos (quadro 440), na ordem da lista do banco. */
export function linhasCampos(campos?: Record<string, string>): [string, string][] {
  if (!campos) return [];
  return (Object.keys(CAMPOS_CONTRATO) as (keyof typeof CAMPOS_CONTRATO)[]).filter((k) => campos[k]).map((k) => [CAMPOS_CONTRATO[k], campos[k]!]);
}

/** "Revisado por Rui Barros, OAB DF 12345, em 20/10/2026" (quadro 443). */
export const textoRevisao = (m: Pick<ModeloContrato, "revisao">) =>
  m.revisao ? `Revisado por ${m.revisao.advogado}, OAB ${m.revisao.oab}, em ${data(m.revisao.em)}` : "Sem revisão de advogado";

const FALTA_MODELO: Record<ModeloContrato["falta"][number], string> = { revisao: "a revisão do advogado (nome, OAB e data)", termo: "o termo de tratamento de dados", indiceReajuste: "o índice de reajuste" };
/** O que falta para usar a versão. */
export const textoFaltaModelo = (falta: ModeloContrato["falta"]) => (falta.length ? `Para usar falta ${falta.map((f) => FALTA_MODELO[f]).join(", ")}.` : "");

/** O texto do modelo com os campos à vista, para o PDF de exemplo. */
export function documentoExemplo(m: Pick<ModeloContrato, "numero" | "titulo" | "texto" | "termo">): Documento {
  const preencher = (t: string) => t.replace(/«([a-z_]+)»/g, (_, k: string) => `[${CAMPOS_CONTRATO[k as keyof typeof CAMPOS_CONTRATO] ?? k}]`);
  const blocos: Documento["blocos"] = (m.texto ?? "").split(/\n{2,}/).map((p) => ({ tipo: "paragrafo" as const, texto: preencher(p) }));
  if (m.termo) blocos.push({ tipo: "pagina" }, { tipo: "secao", texto: "Termo de tratamento de dados" }, ...m.termo.split(/\n{2,}/).map((p) => ({ tipo: "paragrafo" as const, texto: preencher(p) })));
  return {
    titulo: `${m.titulo} v${m.numero} (exemplo)`, cabecalho: `Modelo de contrato v${m.numero} · exemplo`, principal: m.titulo,
    apoio: "PDF de exemplo: os campos aparecem entre colchetes. O contrato de verdade sai da proposta aceita, com a impressão digital em cada folha.",
    blocos, pe: `Modelo v${m.numero} · exemplo, sem valor de contrato`, nomeArquivo: `modelo-contrato-v${m.numero}-exemplo.pdf`,
  };
}

// ---------------------------------------------------------------------------------------------
// Arquivos: só PDF, até 10 MB.

/** O que há de errado com o arquivo antes de enviar; nulo se serve. */
export function problemaDoPdf(f: { name: string; type: string; size: number }): string | null {
  if (f.type && f.type !== "application/pdf") return "Envie um arquivo PDF.";
  if (!f.type && !/\.pdf$/i.test(f.name)) return "Envie um arquivo PDF.";
  if (f.size < 1) return "O arquivo está vazio.";
  if (f.size > TAMANHO_MAXIMO_PDF_CONTRATO) return "O arquivo passa de 10 MB.";
  return null;
}

/** O que o documento pede além do arquivo: o CNPJ válido no cartão e o fim do mandato na ata da eleição. */
export function problemaDoDocumento(tipo: DocumentoAceite, d: { cnpj?: string; mandatoAte?: string }, hoje: string): { campo: "cnpj" | "mandatoAte"; texto: string } | null {
  if (tipo === "CNPJ" && !cnpjValido(d.cnpj ?? "")) return { campo: "cnpj", texto: "Confira o CNPJ: os números não batem." };
  if (tipo === "ATA_ELEICAO" && !d.mandatoAte) return { campo: "mandatoAte", texto: "Diga até quando vai o mandato." };
  if (tipo === "ATA_ELEICAO" && d.mandatoAte! < hoje) return { campo: "mandatoAte", texto: "Este mandato já acabou. Envie a ata da eleição atual." };
  return null;
}

/** "Cartão do CNPJ · cnpj-cerrado.pdf · enviado 30/10". */
export function textoDocumento(d: DocumentoTela): string {
  return [d.nome, d.situacao === "RECUSADO" ? `recusado: ${d.motivoTexto ?? d.motivo ?? "o arquivo não serve"}` : `enviado ${data(d.enviadoEm).slice(0, 5)}${d.peloLink ? " pelo link" : ""}`,
    d.cnpj ? `CNPJ ${d.cnpj}` : null, d.mandatoAte ? `mandato até ${data(d.mandatoAte)}` : null].filter(Boolean).join(" · ");
}

/** Os documentos que valem agora: o último recebido de cada tipo (ou o último recusado, para dizer o motivo). */
export function documentosAtuais(docs: DocumentoTela[]): Partial<Record<DocumentoAceite, DocumentoTela>> {
  const r: Partial<Record<DocumentoAceite, DocumentoTela>> = {};
  for (const tipo of Object.keys(DOCUMENTOS_ACEITE) as DocumentoAceite[]) {
    const deste = docs.filter((d) => d.tipo === tipo && (d.situacao === "RECEBIDO" || d.situacao === "RECUSADO"));
    r[tipo] = deste.find((d) => d.situacao === "RECEBIDO") ?? deste[0];
  }
  return r;
}

export type ResultadoEnvio = { ok: true; dados: Record<string, unknown> } | { ok: false; texto: string; erro?: ErroApi };

/** Envia ao armazenamento com PUT (content-type application/pdf). */
function subir(url: string, arquivo: File): Promise<boolean> {
  return fetch(url, { method: "PUT", headers: { "content-type": "application/pdf" }, body: arquivo }).then((r) => r.ok, () => false);
}

/**
 * O envio em três passos (como os anexos da Plataforma): (1) o POST que devolve o id e o link,
 * (2) o PUT do arquivo e (3) o POST de verificar. Devolve o que a verificação disse.
 */
export async function enviarPdf(rota: string, corpo: Record<string, unknown>, arquivo: File, verificar: (id: string) => string, chaveId: "documentoId" | "envioId"): Promise<ResultadoEnvio> {
  const problema = problemaDoPdf(arquivo);
  if (problema) return { ok: false, texto: problema };
  const inicio = await chamarApi<Record<string, string> & { envio: { url: string } }>(rota, { corpo: { ...corpo, nome: arquivo.name, tamanho: arquivo.size } });
  if (!inicio.ok) return { ok: false, texto: textoDoErro(inicio.erro), erro: inicio.erro };
  const id = inicio.dados[chaveId]!;
  const subiu = await subir(inicio.dados.envio.url, arquivo);
  if (!subiu) return { ok: false, texto: "O envio não terminou. Confira a internet e envie de novo." };
  const fim = await chamarApi<Record<string, unknown>>(verificar(id), { corpo: {} });
  if (!fim.ok) return { ok: false, texto: textoDoErro(fim.erro), erro: fim.erro };
  return { ok: true, dados: fim.dados };
}

/** Baixa pelo link de 5 minutos que a API devolve. */
export async function baixarPeloLink(caminho: string): Promise<string | null> {
  const r = await chamarApi<{ url: string }>(caminho);
  if (!r.ok) return textoDoErro(r.erro);
  const a = document.createElement("a");
  a.href = r.dados.url;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  return null;
}

/** O que o envio do PDF assinado disse, para quem enviou (quadro 444). */
export function textoDoEnvio(d: Record<string, unknown>): { ok: boolean; texto: string } {
  const s = String(d.situacao ?? "");
  if (s === "A_CONFERIR") return { ok: true, texto: "PDF assinado recebido. A equipe confere a assinatura no validador do gov.br." };
  if (s === "SUBSTITUIDO") return { ok: false, texto: "Este contrato foi gerado de novo. Baixe o contrato novo, assine e envie." };
  return { ok: false, texto: String(d.motivoTexto ?? "O arquivo não serviu. Envie de novo.") };
}
