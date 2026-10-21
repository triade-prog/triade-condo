// Comunicados e documentos (peça R1; CD-01, CD-02, CD-04 a CD-07, CD-09, CD-11 e MP-12 em
// parte), com o mural online e o e-mail (CD-12 a CD-14). Os mesmos valores estão no banco
// (0150_comunicados_documentos.sql e 0160_mural_email.sql).

import { z } from "zod";
import { mostrarDataCurta } from "./agenda.ts";

/** Assuntos (CD-11): cada condomínio escolhe os que usa. */
export const ASSUNTOS_COMUNICADO = {
  AVISO: "Aviso geral",
  OBRAS: "Obras e manutenção",
  SEGURANCA: "Segurança",
  ASSEMBLEIA: "Assembleia e convocação",
  LEMBRETE: "Lembrete",
} as const;
export type AssuntoComunicado = keyof typeof ASSUNTOS_COMUNICADO;

/** Ciclo do comunicado (CD-01). Publicado não se edita; substituído e arquivado não voltam. */
export const SITUACOES_COMUNICADO = {
  RASCUNHO: "Rascunho",
  PROGRAMADO: "Programado",
  PUBLICADO: "Publicado",
  SUBSTITUIDO: "Substituído",
  ARQUIVADO: "Arquivado",
} as const;
export type SituacaoComunicado = keyof typeof SITUACOES_COMUNICADO;

export const FILTROS_COMUNICADO = {
  EM_USO: "Em uso",
  PUBLICADO: "Publicados",
  PROGRAMADO: "Programados",
  RASCUNHO: "Rascunhos",
  ARQUIVADO: "Arquivados",
} as const;
export type FiltroComunicado = keyof typeof FILTROS_COMUNICADO;

export const ATALHOS_COMUNICADO = {
  RASCUNHOS_PARADOS: "Rascunhos parados há mais de 3 dias",
  PROGRAMADOS_HOJE: "Programados para hoje",
} as const;
export type AtalhoComunicado = keyof typeof ATALHOS_COMUNICADO;

/** Para quem (CD-02). */
export const PUBLICOS_COMUNICADO = {
  TODOS: "Todo o condomínio",
  BLOCOS: "Blocos",
  UNIDADES: "Unidades",
  CONTATOS: "Contatos",
} as const;
export type PublicoComunicado = keyof typeof PUBLICOS_COMUNICADO;

/** Tipos de documento (CD-07). */
export const TIPOS_DOCUMENTO = {
  CONVENCAO: "Convenção",
  REGIMENTO: "Regimento",
  ATA: "Ata",
  CONTRATO: "Contrato",
  LAUDO: "Laudo e certificado",
  ORCAMENTO: "Orçamento anual",
  OUTRO: "Outro",
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export const FILTROS_DOCUMENTO = {
  VIGOR: "Em vigor",
  CONVENCAO_REGIMENTO: "Convenção e regimento",
  ATA: "Atas",
  CONTRATO: "Contratos",
  LAUDO: "Laudos",
  ARQUIVADOS: "Arquivados",
} as const;
export type FiltroDocumento = keyof typeof FILTROS_DOCUMENTO;

/** "Pode ir ao morador" já nasce ligado para o que é do prédio inteiro (decisão 9). */
export function aoMoradorPadrao(tipo: TipoDocumento): boolean {
  return tipo === "CONVENCAO" || tipo === "REGIMENTO" || tipo === "ATA" || tipo === "ORCAMENTO";
}

/** Tipos que costumam ter validade (MP-12). */
export function tipoComValidade(tipo: TipoDocumento): boolean {
  return tipo === "CONTRATO" || tipo === "LAUDO" || tipo === "OUTRO";
}

export const ARQUIVOS_POR_COMUNICADO = 4;
export const TAMANHO_MAXIMO_DOCUMENTO = 20 * 1024 * 1024;
/** Quantos dias antes do fim da validade o documento aparece e avisa (MP-12). */
export const DIAS_AVISO_VALIDADE = 60;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const motivo = z.string().trim().min(3).max(500);
const idOpcional = id.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));
const ids = (max: number) => z.array(id).max(max).default([]);

const camposPublico = {
  publico: z.enum(chaves(PUBLICOS_COMUNICADO)),
  blocos: ids(100),
  unidades: ids(1000),
  contatos: ids(1000),
};
function publicoCompleto(d: { publico: PublicoComunicado; blocos: string[]; unidades: string[]; contatos: string[] }, ctx: z.RefinementCtx) {
  const falta = { BLOCOS: d.blocos, UNIDADES: d.unidades, CONTATOS: d.contatos, TODOS: null }[d.publico];
  if (falta && falta.length === 0) {
    ctx.addIssue({ code: "custom", path: [d.publico.toLowerCase()], message: "Escolha para quem" });
  }
}

/** Escrever ou mudar o rascunho ou o programado, e decidir o que fazer (CD-01, CD-06). */
export const salvarComunicadoSchema = z
  .object({
    versao: versao.optional(),
    assunto: z.enum(chaves(ASSUNTOS_COMUNICADO)),
    titulo: z.string().trim().min(3).max(120),
    texto: z.string().trim().min(3).max(4000),
    ...camposPublico,
    pedidoId: idOpcional,
    manutencaoId: idOpcional,
    acao: z.enum(["RASCUNHO", "PROGRAMAR", "PUBLICAR"]),
    programadoPara: z.string().datetime({ offset: true }).nullable().optional().transform((v) => v ?? null),
    /** Aparece no mural online (só para todo o condomínio). Sem escolha, segue os assuntos do mural. */
    noMural: z.boolean().nullable().optional().transform((v) => v ?? null),
    /** Vai por e-mail a quem tem e-mail confirmado (CD-13). */
    porEmail: z.boolean().nullable().optional().transform((v) => v ?? null),
    /** Vai pelo WhatsApp do condomínio a quem aceitou receber por lá (CD-02, W-20). */
    porWhatsapp: z.boolean().nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    publicoCompleto(d, ctx);
    if (d.acao === "PROGRAMAR" && !d.programadoPara) {
      ctx.addIssue({ code: "custom", path: ["programadoPara"], message: "Diga o dia e a hora" });
    }
  });
export type SalvarComunicado = z.infer<typeof salvarComunicadoSchema>;

/** Comunicados pelo WhatsApp saem aos poucos, por condomínio (F6.6, W-14). */
export const COMUNICADOS_WHATSAPP_POR_MINUTO = 10;

/** Quanto tempo a fila do WhatsApp leva para mandar n mensagens, em minutos inteiros. */
export function minutosDoWhatsapp(n: number): number {
  return Math.max(1, Math.ceil(n / COMUNICADOS_WHATSAPP_POR_MINUTO));
}

/**
 * Por onde chega, com os canais que estiverem ligados no comunicado (CD-02): quem recebe por
 * e-mail, pelo WhatsApp, pelos dois e por nenhum dos dois.
 */
export function contagemDosCanais(
  p: { contatos: number; comEmail: number; comWhatsapp?: number; pelosDois?: number },
  canais: { email: boolean; whatsapp: boolean },
): { email: number; whatsapp: number; pelosDois: number; nenhum: number } {
  const email = canais.email ? p.comEmail : 0;
  const whatsapp = canais.whatsapp ? p.comWhatsapp ?? 0 : 0;
  const pelosDois = canais.email && canais.whatsapp ? p.pelosDois ?? 0 : 0;
  return { email, whatsapp, pelosDois, nenhum: Math.max(0, p.contatos - email - whatsapp + pelosDois) };
}

/** Quem recebe, antes de publicar (CD-02). */
export const publicoComunicadoSchema = z.object({ assunto: z.enum(chaves(ASSUNTOS_COMUNICADO)), ...camposPublico });

/** Corrigir o publicado: vira a versão seguinte (CD-01). */
export const corrigirComunicadoSchema = z.object({
  versao,
  titulo: z.string().trim().min(3).max(120),
  texto: z.string().trim().min(3).max(4000),
  mudanca: motivo,
  /** Reenviar por e-mail, começando pelo que mudou. Sem pedir, não reenvia. */
  avisarEmail: z.boolean().default(false),
  /** Avisar pelo WhatsApp quem recebeu a versão anterior, com "Corrigido:" no título (CD-01). */
  avisarWhatsapp: z.boolean().default(false),
});
/** Tirar do mural ou pôr de volta (CD-12). */
export const muralComunicadoSchema = z.object({ versao, noMural: z.boolean() });
export const arquivarComunicadoSchema = z.object({ versao, motivo });
/** Copiar o texto ou imprimir para o mural (o caminho até o morador sem WhatsApp). */
export const usoComunicadoSchema = z.object({ uso: z.enum(["COPIADO", "MURAL"]) });

export const buscaComunicadosSchema = z.object({
  filtro: z.enum(chaves(FILTROS_COMUNICADO)).optional(),
  assunto: z.enum(chaves(ASSUNTOS_COMUNICADO)).optional(),
  atencao: z.enum(chaves(ATALHOS_COMUNICADO)).optional(),
  busca: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

export const enviarArquivoComunicadoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});

/** Plano de comunicação (CD-11), nas Configurações. */
export const planoComunicacaoSchema = z.object({
  versao,
  assuntos: z.array(z.enum(chaves(ASSUNTOS_COMUNICADO))).min(1).max(5),
  plano: texto(2000),
  assinatura: z.string().trim().min(2).max(120),
  silencioInicio: hora,
  silencioFim: hora,
});

/** Mural online, e-mail e documentos pedidos pelo mural (CD-12 a CD-14), nas Configurações. */
export const muralEmailSchema = z.object({
  versao,
  muralLigado: z.boolean(),
  muralAssuntos: z.array(z.enum(chaves(ASSUNTOS_COMUNICADO))).max(5),
  emailLigado: z.boolean(),
  responderPara: z.union([z.string().trim().max(254).email(), z.literal(""), z.null()]).transform((v) => v || null),
  documentosNoMural: z.boolean(),
  documentosAutomatico: z.boolean(),
});
export const trocarLinkMuralSchema = z.object({ versao, motivo });

/** Enviar o documento por e-mail, pela tela do documento (CD-14): até 20 destinatários. */
export const enviarDocumentoSchema = z
  .object({
    contatos: ids(20),
    emails: z.array(z.string().trim().max(254).email()).max(20).default([]),
    recado: texto(500),
  })
  .refine((d) => d.contatos.length + d.emails.length >= 1 && d.contatos.length + d.emails.length <= 20, {
    path: ["contatos"],
    message: "Escolha de 1 a 20 destinatários",
  });
export const decidirPedidoDocumentoSchema = z
  .object({ enviar: z.boolean(), motivo: texto(500) })
  .superRefine((d, ctx) => {
    if (!d.enviar && (!d.motivo || d.motivo.length < 3)) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Diga o motivo" });
  });

/** Sem conta: pedir documento pelo mural e os links do e-mail. */
export const pedirDocumentoSchema = z.object({ documentoId: id, email: z.string().trim().max(254).email() });
export const codigoLinkSchema = z.object({ codigo: z.string().min(14).max(64).regex(/^[A-Za-z0-9_-]+$/) });
/** O código do mural: 12 caracteres em três grupos, sem os que se confundem. */
export const CODIGO_MURAL = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

/** Documento (CD-07, CD-04): restrito não vai ao morador. */
export const documentoSchema = z
  .object({
    versao: versao.optional(),
    tipo: z.enum(chaves(TIPOS_DOCUMENTO)),
    titulo: z.string().trim().min(3).max(120),
    descricao: texto(500),
    restrito: z.boolean().default(false),
    aoMorador: z.boolean().default(false),
    valeAte: data.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.restrito && d.aoMorador) {
      ctx.addIssue({ code: "custom", path: ["aoMorador"], message: "Documento só da gestão não vai ao morador" });
    }
    if (d.descricao !== null && d.descricao.length < 2) {
      ctx.addIssue({ code: "custom", path: ["descricao"], message: "Descrição de 2 a 500 caracteres" });
    }
  });
export type Documento = z.infer<typeof documentoSchema>;
export const arquivarDocumentoSchema = z.object({ versao, motivo });

/** Nova versão do documento: o arquivo, o que mudou e desde quando vale. */
export const versaoDocumentoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
  mudanca: texto(500),
  vigenteDesde: data,
  aprovadoEm: texto(120),
});

export const buscaDocumentosSchema = z.object({
  filtro: z.enum([...chaves(FILTROS_DOCUMENTO), "VENCENDO"]).optional(),
  busca: z.string().trim().max(60).optional(),
});

// ---------------------------------------------------------------------------------------
// Textos.

/** O texto como vai para o grupo do prédio: título, texto e assinatura. */
export function textoParaCopiar(c: { titulo: string; texto: string; assinatura?: string | null }): string {
  return [`*${c.titulo}*`, c.texto, c.assinatura ?? ""].filter((x) => x.trim()).join("\n\n");
}

/** A hora local ("HH:MM") cai no horário sem envio? O horário pode atravessar a meia-noite. */
export function noHorarioSemEnvio(hora: string, inicio: string, fim: string): boolean {
  if (inicio === fim) return false;
  return inicio < fim ? hora >= inicio && hora < fim : hora >= inicio || hora < fim;
}

/** "1 contato", "38 contatos". */
export function quantos(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** O que aconteceu com os e-mails de um comunicado (CD-13), numa linha. */
export function descreverEnvioEmail(e: { enviados?: number; entregues?: number; devolvidos?: number; spam?: number; naFila?: number; falharam?: number }): string {
  const partes: string[] = [];
  if (e.entregues) partes.push(`${e.entregues} ${e.entregues === 1 ? "entregue" : "entregues"}`);
  if (e.devolvidos) partes.push(`${e.devolvidos} ${e.devolvidos === 1 ? "voltou" : "voltaram"}`);
  if (e.spam) partes.push(e.spam === 1 ? "1 marcou como spam" : `${e.spam} marcaram como spam`);
  if (e.falharam) partes.push(`${e.falharam} não ${e.falharam === 1 ? "saiu" : "saíram"}`);
  if (e.naFila) partes.push(`${e.naFila} na fila`);
  return partes.join(" · ");
}

/**
 * O que houve com as mensagens do comunicado pelo WhatsApp (F6.6, CD-08): entregue e lida são o
 * que o WhatsApp informa; enviada não quer dizer lida.
 */
export function descreverEnvioWhatsapp(w: { entregues?: number; lidas?: number; falharam?: number; canceladas?: number; naFila?: number }): string {
  const partes: string[] = [];
  if (w.entregues) partes.push(`${w.entregues} ${w.entregues === 1 ? "entregue" : "entregues"}`);
  if (w.lidas) partes.push(`${w.lidas} ${w.lidas === 1 ? "lida" : "lidas"}`);
  if (w.falharam) partes.push(`${w.falharam} ${w.falharam === 1 ? "falhou" : "falharam"}`);
  if (w.canceladas) partes.push(`${w.canceladas} não ${w.canceladas === 1 ? "saiu" : "saíram"}`);
  if (w.naFila) partes.push(`${w.naFila} na fila`);
  return partes.join(" · ");
}

/** "61 contatos de 44 unidades", "1 contato de 1 unidade", "Ninguém recebe". */
export function descreverAlcance(contatos: number, unidades: number): string {
  if (contatos === 0) return "Ninguém recebe";
  const c = contatos === 1 ? "1 contato" : `${contatos} contatos`;
  if (unidades === 0) return c;
  return `${c} de ${unidades === 1 ? "1 unidade" : `${unidades} unidades`}`;
}

/** Dias até a data (negativo se já passou), contando no calendário. */
export function diasAte(dataAlvo: string, hoje: string): number {
  return Math.round((Date.parse(`${dataAlvo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
}

/** "vence em 42 dias", "vence hoje", "venceu há 3 dias", "vale até 03/2027". */
export function descreverValidade(valeAte: string | null | undefined, hoje: string): string | null {
  if (!valeAte) return null;
  const d = diasAte(valeAte, hoje);
  if (d < 0) return d === -1 ? "venceu ontem" : `venceu há ${-d} dias`;
  if (d === 0) return "vence hoje";
  if (d <= DIAS_AVISO_VALIDADE) return d === 1 ? "vence amanhã" : `vence em ${d} dias`;
  const [ano, mes] = valeAte.split("-");
  return `vale até ${mes}/${ano}`;
}

/** Os eventos do comunicado no histórico. */
export function descreverEventoComunicado(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "comunicado.escrito":
      return "Escrito como rascunho";
    case "comunicado.alterado":
      return "Rascunho alterado";
    case "comunicado.programado":
      return "Programado";
    case "comunicado.publicado":
      return d.programado ? `Versão ${String(d.numero)} publicada na hora marcada` : `Versão ${String(d.numero)} publicada`;
    case "comunicado.corrigido":
      return `Corrigido na versão ${String(d.numero)}: ${String(d.mudanca)}`;
    case "comunicado.copiado":
      return "Texto copiado";
    case "comunicado.mural":
      return "Versão para o mural aberta";
    case "comunicado.arquivo_enviado":
      return `Arquivo enviado: ${String(d.arquivoNome)}`;
    case "comunicado.arquivo_recusado":
      return `Arquivo não liberado: ${String(d.arquivoNome)}`;
    case "comunicado.arquivo_tirado":
      return `Arquivo tirado: ${String(d.arquivoNome)}`;
    case "comunicado.email_na_fila":
      return `E-mail da versão ${String(d.numero)} para ${quantos(Number(d.quantos), "contato", "contatos")}`;
    case "comunicado.whatsapp_na_fila":
      return `WhatsApp da versão ${String(d.numero)}${d.corrigido ? ", com \"Corrigido:\"" : ""}: ${quantos(Number(d.quantos), "mensagem", "mensagens")} na fila`;
    case "comunicado.mural_ligado":
      return "Posto no mural online";
    case "comunicado.mural_tirado":
      return "Tirado do mural online";
    case "estado.mudou":
      if (d.para === "ARQUIVADO") return d.motivo ? `Arquivado: ${String(d.motivo)}` : "Arquivado";
      if (d.para === "RASCUNHO") return "Voltou a rascunho";
      if (d.para === "SUBSTITUIDO") return "Versão substituída";
      return SITUACOES_COMUNICADO[d.para as SituacaoComunicado] ?? "Situação mudou";
    default:
      return "Alteração";
  }
}

/** Os eventos do documento no histórico. */
export function descreverEventoDocumento(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "documento.criado":
      return "Documento criado";
    case "documento.alterado":
      return "Dados alterados";
    case "documento.versao_guardada":
      return `Versão ${String(d.numero)} guardada, vale desde ${mostrarDataCurta(String(d.vigenteDesde))}`;
    case "documento.versao_recusada":
      return `Arquivo não liberado: ${String(d.arquivoNome)}`;
    case "documento.aberto":
      return `Versão ${String(d.numero)} aberta`;
    case "documento.baixado":
      return `Versão ${String(d.numero)} baixada`;
    case "documento.arquivado":
      return `Arquivado: ${String(d.motivo)}`;
    case "documento.enviado_por_email":
      return `Enviado por e-mail a ${quantos(Number(d.quantos), "pessoa", "pessoas")}`;
    case "documento.pedido":
      return d.automatico ? "Pedido pelo mural e enviado na hora" : "Pedido pelo mural, esperando decisão";
    case "documento.pedido_enviado":
      return "Pedido pelo mural aprovado e enviado";
    case "documento.pedido_recusado":
      return `Pedido pelo mural recusado: ${String(d.motivo)}`;
    case "documento.aberto_por_email":
      return `Versão ${String(d.numero)} aberta pelo link do e-mail`;
    case "documento.link_cancelado":
      return "Link do e-mail cancelado";
    default:
      return "Alteração";
  }
}
