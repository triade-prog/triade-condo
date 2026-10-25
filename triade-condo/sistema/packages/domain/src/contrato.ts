// Contrato pelo gov.br, piloto, virar cliente, troca de sistema e vários condomínios (0308, R17.4;
// CM-08, CM-09, CM-13, CM-21 e CM-29; quadros 331, 333, 338, 345 e 440 a 444). As mesmas listas
// estão no banco (0308_comercial_contrato_cliente.sql); os testes conferem as duas. Quem pode o
// quê e as regras de cada passo ficam no banco: aqui só a entrada das telas e do link.

import { z } from "zod";
import { MOTIVOS_PERDA } from "./comercial.ts";
import { cpfValido } from "./propostas.ts";

/** Só PDF, até 10 MB: documentos do aceite e PDFs assinados (quadro 441). */
export const TAMANHO_MAXIMO_PDF_CONTRATO = 10 * 1024 * 1024;

/** Os campos que o modelo pode usar entre « e » (quadro 443), na ordem da lista do banco. */
export const CAMPOS_CONTRATO = {
  condominio: "Nome do condomínio",
  cnpj: "CNPJ do condomínio",
  representante: "Quem aceitou a proposta (representante)",
  cpf_representante: "CPF de quem aceitou",
  mandato_ate: "Fim do mandato (da ata da eleição)",
  plano: "Plano: ciclo, tabela e faixa",
  valor_mensal: "Mensalidade",
  valor_anual: "Valor anual (ou não se aplica)",
  implantacao: "Implantação",
  desconto: "Desconto aprovado",
  data_inicio: "Data de início",
  indice_reajuste: "Índice de reajuste",
} as const;
export type CampoContrato = keyof typeof CAMPOS_CONTRATO;

/** Os campos escritos errado: «nome» fora da lista e « ou » sobrando (como contrato_campos_errados). */
export function camposErradosContrato(texto: string | null | undefined): string[] {
  const t = texto ?? "";
  const errados = new Set<string>();
  for (const m of t.matchAll(/«([^«»]*)»/g)) if (!(m[1]! in CAMPOS_CONTRATO)) errados.add(`«${m[1]}»`);
  const sobra = t.replace(/«[^«»]*»/g, "");
  for (const s of ["«", "»"]) if (sobra.includes(s)) errados.add(s);
  return [...errados].sort();
}

/** OAB como "DF 12345" (aceita "OAB/DF 12.345", "12345/DF"); null se não der para ler. */
export function normalizarOab(v: string): string | null {
  let d = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (d.startsWith("OAB")) d = d.slice(3);
  if (/^[A-Z]{2}\d{1,6}[A-Z]?$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (/^\d{1,6}[A-Z]{2}$/.test(d)) return `${d.slice(-2)} ${d.slice(0, -2)}`;
  return null;
}

/** CNPJ com os dois dígitos verificadores; aceita com ou sem pontuação. */
export function cnpjValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

/** 11.222.333/0001-81 */
export function formatarCnpj(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : v;
}

/** O CPF conferido fica só assim: ***.982.247-** (como comercial_cpf_mascarado). */
export function mascararCpf(v: string): string | null {
  const d = v.replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null;
}

/** Situações da versão do modelo (quadro 443). */
export const SITUACOES_MODELO_CONTRATO = { RASCUNHO: "Rascunho", EM_USO: "Em uso", SUBSTITUIDA: "Substituída" } as const;

/** Documentos do aceite (quadro 441). A ata de aprovação é só quando a convenção pede. */
export const DOCUMENTOS_ACEITE = {
  CNPJ: "Cartão do CNPJ",
  ATA_ELEICAO: "Ata da eleição do síndico",
  ATA_APROVACAO: "Ata que aprovou a contratação",
} as const;
export type DocumentoAceite = keyof typeof DOCUMENTOS_ACEITE;
export const SITUACOES_DOCUMENTO = {
  ENVIANDO: "Enviando",
  RECEBIDO: "Recebido",
  RECUSADO: "Recusado",
  SUBSTITUIDO: "Substituído",
  APAGADO: "Apagado",
} as const;

/** Situações do contrato gerado (quadros 440 e 444). */
export const SITUACOES_CONTRATO = {
  GERANDO: "Montando o PDF",
  AGUARDA_CONDOMINIO: "Aguardando a assinatura do condomínio",
  AGUARDA_TRIADE: "Aguardando a assinatura da TRÍADE",
  ASSINADO: "Assinado pelos dois",
  SUBSTITUIDO: "Substituído",
} as const;
export type SituacaoContrato = keyof typeof SITUACOES_CONTRATO;

/** Quem assina, nesta ordem. */
export const PARTES_CONTRATO = { CONDOMINIO: "Condomínio", TRIADE: "TRÍADE" } as const;
export type ParteContrato = keyof typeof PARTES_CONTRATO;

/** Situações de cada envio do PDF assinado (quadros 442 e 444). */
export const SITUACOES_ENVIO = {
  ENVIANDO: "Enviando",
  RECUSADO_NA_HORA: "Recusado na hora",
  NAO_E_O_GERADO: "Não é o contrato gerado",
  A_CONFERIR: "Falta conferir no validador",
  CONFERIDO: "Conferido",
  RECUSADO: "Recusado na conferência",
  SUBSTITUIDO: "Substituído",
} as const;
export type SituacaoEnvio = keyof typeof SITUACOES_ENVIO;

/** Por que a conferência automática não aceitou (quadro 444). */
export const MOTIVOS_ENVIO = {
  ARQUIVO_INVALIDO: "O arquivo não é um PDF que dá para conferir.",
  SEM_ASSINATURA: "O PDF enviado não tem assinatura digital nova. Assine pelo gov.br e envie o arquivo que ele devolver.",
  NAO_E_O_GERADO: "O conteúdo assinado não é o contrato gerado. Baixe o contrato, assine sem mudar nada e envie de novo.",
} as const;

/** As três marcas obrigatórias da conferência no validar.iti.gov.br (quadro 442). */
export const MARCAS_CONFERENCIA = {
  assinaturaValida: "O validador diz que a assinatura é válida",
  pessoaConfere: "Quem assinou é a pessoa do aceite (nome e CPF)",
  dataConfere: "A data da assinatura é depois da geração do contrato",
} as const;

export const TEXTO_ASSINATURA_GOVBR =
  "Assine pelo gov.br (assinador.iti.br) sem mudar nada no arquivo e envie aqui o PDF que ele devolver. Primeiro assina o condomínio; depois a TRÍADE assina sobre o mesmo arquivo.";
export const TEXTO_VALIDADOR = "Abra o PDF em validar.iti.gov.br e marque as três conferências.";

/** Piloto (CM-21, quadro 338). */
export const PRAZOS_PILOTO = [30, 45, 60] as const;
export const METAS_PILOTO = {
  RETORNOS_NO_PRAZO: "Retornos no prazo",
  PEDIDOS_CONCLUIDOS_COM_EXPLICACAO: "Pedidos concluídos com explicação",
  MORADORES_WHATSAPP: "Moradores usando o WhatsApp",
} as const;
export type MetaPiloto = keyof typeof METAS_PILOTO;
export const SITUACOES_PILOTO = {
  EM_ANDAMENTO: "Em andamento",
  VIROU_PROPOSTA: "Virou proposta",
  PERDIDO: "Perdido",
  VIROU_CLIENTE: "Virou cliente",
} as const;

/** Troca de sistema (CM-29, quadro 345): o que pedir à empresa anterior e a planilha-modelo. */
export const ITENS_TROCA_PADRAO = [
  "Lista de unidades e moradores",
  "Contratos e prestadores",
  "Atas e convenção",
  "Pendências abertas com moradores",
] as const;
/** A planilha-modelo com o mínimo para começar: uma linha por unidade, estas colunas. */
export const PLANILHA_TROCA = {
  arquivo: "planilha-modelo-troca-de-sistema.csv",
  colunas: ["Bloco", "Unidade", "Nome do morador", "WhatsApp", "E-mail", "Proprietário ou inquilino", "Observação"],
  exemplo: ["A", "101", "Maria Souza", "(61) 99999-0000", "maria@exemplo.com.br", "Proprietário", ""],
} as const;

/** A planilha-modelo em CSV (separador ponto e vírgula, como o Excel em português abre). */
export function planilhaTrocaCsv(): string {
  const linha = (v: readonly string[]) => v.map((x) => (/[;"\n]/.test(x) ? `"${x.replaceAll('"', '""')}"` : x)).join(";");
  return `\uFEFF${linha(PLANILHA_TROCA.colunas)}\r\n${linha(PLANILHA_TROCA.exemplo)}\r\n`;
}

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dataOpcional = data.optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const uuid = z.string().uuid();
const nomeArquivo = texto(1, 200);
const tamanhoPdf = z.number().int().min(1).max(TAMANHO_MAXIMO_PDF_CONTRATO);
const soPdf = z.literal("application/pdf").optional().default("application/pdf");
const cpf = z
  .string()
  .trim()
  .max(20)
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v, ctx) => {
    if (!v) return null;
    if (!cpfValido(v)) {
      ctx.addIssue({ code: "custom", message: "CPF inválido" });
      return z.NEVER;
    }
    return v.replace(/\D/g, "");
  });
const semCampoErrado = (s: string | null) => camposErradosContrato(s).length === 0;

/** Modelos › Contrato (quadro 443). A revisão vem inteira: nome, OAB e data. */
export const modeloContratoSchema = z
  .object({
    versao: versao.optional().nullable().transform((v) => v ?? null),
    titulo: texto(3, 120),
    texto: texto(50, 100_000).refine(semCampoErrado, { message: "Campo escrito errado" }),
    termo: textoOpcional(50_000).refine((v) => v === null || (v.length >= 50 && semCampoErrado(v)), { message: "Termo de 50 letras ou mais, sem campo errado" }),
    indiceReajuste: textoOpcional(60),
    advogadoNome: textoOpcional(120),
    advogadoOab: textoOpcional(30),
    revisadoEm: dataOpcional,
  })
  .superRefine((d, ctx) => {
    const revisao = [d.advogadoNome, d.advogadoOab, d.revisadoEm];
    if (revisao.some((v) => v !== null) && revisao.some((v) => v === null)) {
      for (const [k, v] of Object.entries({ advogadoNome: d.advogadoNome, advogadoOab: d.advogadoOab, revisadoEm: d.revisadoEm })) {
        if (v === null) ctx.addIssue({ code: "custom", path: [k], message: "A revisão vem inteira: nome, OAB e data" });
      }
    }
    if (d.advogadoOab !== null && normalizarOab(d.advogadoOab) === null) {
      ctx.addIssue({ code: "custom", path: ["advogadoOab"], message: "OAB como DF 12345" });
    }
  });
export const usarModeloContratoSchema = z.object({ versao });

/** Documento do aceite, pelo link ou pela equipe (quadro 441). */
export const documentoAceiteSchema = z
  .object({
    tipo: z.enum(chaves(DOCUMENTOS_ACEITE)),
    nome: nomeArquivo,
    tamanho: tamanhoPdf,
    formato: soPdf,
    cnpj: z.string().trim().max(20).optional().nullable().transform((v) => (v ? v.replace(/\D/g, "") : null)),
    mandatoAte: dataOpcional,
  })
  .superRefine((d, ctx) => {
    if (d.tipo === "CNPJ" && (!d.cnpj || !cnpjValido(d.cnpj))) ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ inválido" });
    if (d.tipo === "ATA_ELEICAO" && !d.mandatoAte) ctx.addIssue({ code: "custom", path: ["mandatoAte"], message: "Diga até quando vai o mandato" });
  });

/** Gerar contrato (quadro 440). Gerar de novo pede o motivo (o banco confere). */
export const gerarContratoSchema = z.object({ dataInicio: data, motivo: textoOpcional(300) });

/** Envio do PDF assinado: pelo link, só o condomínio; pela equipe, quem assinou. */
export const envioContratoSchema = z.object({
  parte: z.enum(chaves(PARTES_CONTRATO)).optional().default("TRIADE"),
  nome: nomeArquivo,
  tamanho: tamanhoPdf,
  formato: soPdf,
});
export const envioContratoPublicoSchema = z.object({ nome: nomeArquivo, tamanho: tamanhoPdf, formato: soPdf });

/** Conferir no validador (quadro 442): as três marcas são obrigatórias. */
export const conferirEnvioSchema = z.object({
  versao,
  assinaturaValida: z.literal(true),
  pessoaConfere: z.literal(true),
  dataConfere: z.literal(true),
  cpf,
  assinanteNome: textoOpcional(120),
  observacao: textoOpcional(300),
});
export const recusarEnvioSchema = z.object({ versao, motivo: texto(3, 300) });

/** Virar cliente (CM-08, quadro 333). */
export const virarClienteSchema = z.object({
  versao,
  responsavelImplantacaoId: uuid,
  cidade: textoOpcional(80),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  cenario: textoOpcional(40),
});

/** Piloto (CM-21, quadro 338): prazo, meta e com quem foi combinado são obrigatórios. */
export const iniciarPilotoSchema = z.object({
  versao,
  prazoDias: z.union([z.literal(30), z.literal(45), z.literal(60)]),
  comecaEm: data,
  meta: z.enum(chaves(METAS_PILOTO)),
  metaPercentual: z.number().int().min(1).max(100),
  combinadoCom: texto(3, 120),
  responsavelImplantacaoId: uuid,
  cidade: textoOpcional(80),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
});
export const encerrarPilotoSchema = z
  .object({
    versao,
    resultado: z.enum(["PROPOSTA", "PERDIDO"]),
    motivoPerda: z.enum(chaves(MOTIVOS_PERDA)).optional().nullable().transform((v) => v ?? null),
    detalhe: textoOpcional(500),
  })
  .superRefine((d, ctx) => {
    if (d.resultado === "PERDIDO" && !d.motivoPerda) ctx.addIssue({ code: "custom", path: ["motivoPerda"], message: "Diga por que não fechou" });
  });

/** Troca de sistema (CM-29, quadro 345). Sem itens, a lista padrão; sem carta, a carta-modelo. */
export const trocaSistemaSchema = z.object({
  versao: versao.optional().nullable().transform((v) => v ?? null),
  empresaAnterior: texto(2, 120),
  dataTroca: data,
  itens: z
    .array(z.object({ texto: texto(3, 120), recebido: z.boolean().optional().default(false) }))
    .min(1)
    .max(20)
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  carta: textoOpcional(4000),
});
export const cartaTrocaSchema = z.object({ versao });

/** Outro condomínio do mesmo contato (CM-09): cada um com a sua etapa e a sua proposta. */
export const novaOportunidadeSchema = z.object({
  condominio: texto(2, 120),
  cnpj: z.string().trim().max(20).optional().nullable().transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine((v) => v === null || v.length === 14, { message: "CNPJ com 14 dígitos" }),
  endereco: textoOpcional(200),
  cidade: textoOpcional(80),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  faixa: z.enum(["ATE_40", "DE_41_A_100", "DE_101_A_200", "DE_201_A_400", "ACIMA_DE_400"]).optional().nullable().transform((v) => v ?? null),
  unidades: z.number().int().min(1).max(20000).optional().nullable().transform((v) => v ?? null),
  responsavelId: uuid.optional().nullable().transform((v) => v ?? null),
});
