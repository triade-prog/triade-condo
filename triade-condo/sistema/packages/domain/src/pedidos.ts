// Plataforma do síndico (passo 4): pedidos no painel. Os mesmos valores estão no banco
// (0090_pedidos.sql).

import { z } from "zod";
import { PARTES_ARQUIVO } from "./arquivos.ts";
import { mostrarDataSemHora } from "./plataforma.ts";
import { descreverAvisoPedido } from "./prazos.ts";
import { descreverEventoDecisao } from "./decisoes.ts";

/** Situação do pedido (guardião). A etapa configurada fica dentro de cada situação (AT-05). */
export const ESTADOS_PEDIDO = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  EM_REVISAO: "Em revisão",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
} as const;
export type EstadoPedido = keyof typeof ESTADOS_PEDIDO;

/** Filtro de situação da fila (AT-02). Ativos: aberto, em andamento e em revisão. */
export const FILTROS_SITUACAO = {
  ATIVOS: "Ativos",
  ABERTO: "Abertos",
  EM_ANDAMENTO: "Em andamento",
  EM_REVISAO: "Em revisão",
  ENCERRADO: "Encerrados",
  CANCELADO: "Cancelados",
  TODOS: "Todos",
} as const;

/** O que pede atenção na fila. */
export const FILTROS_ATENCAO = {
  SEM_RESPONSAVEL: "Sem responsável",
  AGUARDANDO_ACEITE: "Esperando aceite",
  RETORNO_VENCIDO: "Retorno vencido",
  COM_PENDENCIA: "Com pendência",
} as const;

/** Como o pedido chegou ao condomínio (AT-01). O WhatsApp do condomínio entra no passo 5. */
export const CANAIS_PEDIDO = {
  TELEFONE: "Telefone",
  PRESENCIAL: "Pessoalmente",
  MENSAGEM: "Mensagem",
  EMAIL: "E-mail",
  OBSERVACAO: "Visto pela gestão",
  OUTRO: "Outro",
} as const;

/** Os canais como aparecem no pedido: o WhatsApp do condomínio (passo 5) só chega pelo próprio
 * número, nunca escolhido na mão. */
export const CANAIS_PEDIDO_EXIBICAO = { ...CANAIS_PEDIDO, WHATSAPP: "WhatsApp do condomínio" } as const;

/** Como o retorno foi dado ao morador (AT-06). */
export const MEIOS_RETORNO = {
  TELEFONE: "Por telefone",
  PRESENCIAL: "Pessoalmente",
  MENSAGEM: "Por mensagem",
  EMAIL: "Por e-mail",
  OUTRO: "Outro meio",
} as const;

/** O retorno pelo WhatsApp do condomínio (passo 5) sai pela conversa do pedido. */
export const MEIOS_RETORNO_EXIBICAO = { ...MEIOS_RETORNO, WHATSAPP: "Pelo WhatsApp" } as const;

/** Pendências e impedimentos (AT-11, AT-12). */
export const TIPOS_PENDENCIA = {
  FORNECEDOR: "Aguardando fornecedor",
  MORADOR: "Aguardando o morador",
  DECISAO: "Aguardando decisão do síndico",
  PECA: "Aguardando peça",
  ACESSO: "Aguardando acesso",
  SEM_EXECUTOR: "Sem executor disponível",
  OUTRO: "Outro impedimento",
} as const;

export const REVISOES_CONCLUSAO = {
  SEM_REVISAO: "Sem revisão",
  AGUARDANDO: "Esperando revisão",
  APROVADA: "Revisada",
  DEVOLVIDA: "Devolvida",
} as const;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const opcional = (s: z.ZodString) => s.nullable().optional().transform((v) => (v ? v : null));
const motivo = z.string().trim().min(3).max(500);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const registrarPedidoSchema = z
  .object({
    unidadeId: id.nullable().optional().transform((v) => v ?? null),
    contatoId: id.nullable().optional().transform((v) => v ?? null),
    local: opcional(z.string().trim().max(120)),
    categoriaId: id,
    prioridadeId: id,
    assunto: z.string().trim().min(3).max(120),
    descricao: z.string().trim().min(3).max(4000),
    canal: z.enum(chaves(CANAIS_PEDIDO)),
    privado: z.boolean().default(false),
    responsavelId: id.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (!d.unidadeId && !d.local) {
      ctx.addIssue({ code: "custom", path: ["unidadeId"], message: "Informe a unidade ou o local" });
      ctx.addIssue({ code: "custom", path: ["local"], message: "Informe a unidade ou o local" });
    }
    if (d.contatoId && !d.unidadeId) ctx.addIssue({ code: "custom", path: ["unidadeId"], message: "Escolha a unidade de quem pediu" });
  });

export const buscaPedidosSchema = z.object({
  situacao: z.enum(chaves(FILTROS_SITUACAO)).optional(),
  responsavel: z.union([z.enum(["EU", "NENHUM"]), id]).optional(),
  prioridade: id.optional(),
  categoria: id.optional(),
  atencao: z.enum(chaves(FILTROS_ATENCAO)).optional(),
  busca: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

export const alterarPedidoSchema = z.object({
  versao,
  categoriaId: id,
  prioridadeId: id,
  local: opcional(z.string().trim().max(120)),
  privado: z.boolean(),
});

export const moverPedidoSchema = z.object({ versao, etapaId: id });
export const atribuirPedidoSchema = z.object({ versao, responsavelId: id, motivo: opcional(z.string().trim().max(300)) });
export const aceitarPedidoSchema = z.object({ versao });
export const retornoSchema = z.object({ versao, meio: z.enum(chaves(MEIOS_RETORNO)), texto: z.string().trim().min(3).max(2000) });
export const notaPedidoSchema = z.object({ versao, texto: z.string().trim().min(3).max(2000) });
export const mudarRetornoSchema = z.object({ versao, quando: z.string().datetime({ offset: true }), motivo });
export const previsaoSchema = z.object({ versao, data: data.nullable(), motivo: opcional(z.string().trim().max(500)) });
export const pendenciaSchema = z.object({
  versao,
  tipo: z.enum(chaves(TIPOS_PENDENCIA)),
  motivo: z.string().trim().min(3).max(300),
  responsavelId: id,
});
export const resolverPendenciaSchema = z.object({ versao, resolucao: z.string().trim().min(2).max(300) });
export const concluirPedidoSchema = z.object({
  versao,
  etapaId: id,
  explicacao: z.string().trim().min(10).max(2000),
  evidencia: opcional(z.string().trim().max(300)),
});
export const revisarPedidoSchema = z
  .object({ versao, aprovar: z.boolean(), motivo: opcional(z.string().trim().max(500)) })
  .superRefine((d, ctx) => {
    if (!d.aprovar && (!d.motivo || d.motivo.length < 3)) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Explique o que falta" });
  });
export const reabrirPedidoSchema = z.object({ versao, motivo, responsavelId: id.nullable().optional().transform((v) => v ?? null) });
export const cancelarPedidoSchema = z.object({ versao, motivo });
export const regrasPedidosSchema = z.object({ versao, revisao: z.boolean(), reabertura: z.boolean() });

/** Há quanto tempo o pedido está aberto, em palavras curtas (AT-02): "40 min", "5 h", "3 dias". */
export function tempoAberto(desdeIso: string, agoraIso: string): string {
  const minutos = Math.max(0, Math.floor((Date.parse(agoraIso) - Date.parse(desdeIso)) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function nomeDe<T extends Record<string, string>>(lista: T, codigo: unknown): string {
  return typeof codigo === "string" && codigo in lista ? lista[codigo as keyof T]! : String(codigo ?? "");
}

const CAMPOS_PEDIDO: Record<string, string> = {
  categoria: "Categoria",
  prioridade: "Prioridade",
  etapa: "Etapa",
  local: "Local",
};

const EVENTOS_ESTADO: Record<string, string> = {
  CONCLUIDO: "Concluído",
  REVISAO_APROVADA: "Conclusão aprovada na revisão",
  REVISAO_DEVOLVIDA: "Devolvido na revisão",
  REABERTO: "Reaberto",
  CANCELADO: "Cancelado",
};

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const quando = (v: unknown) => (typeof v === "string" ? FORMATO_DATA_HORA.format(new Date(v)).replace(",", "") : "sem prazo");

/** Evento do histórico de um pedido (AT-17), como frase curta. */
export function descreverEventoPedido(acao: string, d: Record<string, unknown>): string {
  const comMotivo = (texto: string) => (d.motivo ? `${texto}. Motivo: ${String(d.motivo)}` : texto);
  switch (acao) {
    case "pedido.registrado":
      return `Pedido registrado · ${nomeDe(CANAIS_PEDIDO_EXIBICAO, d.canal)}${d.privado ? " · privado" : ""}`;
    case "estado.mudou": {
      if (!d.de) return `Situação: ${nomeDe(ESTADOS_PEDIDO, d.para)}`;
      const evento = EVENTOS_ESTADO[String(d.evento)];
      const texto = `Situação: ${nomeDe(ESTADOS_PEDIDO, d.de)} → ${nomeDe(ESTADOS_PEDIDO, d.para)}`;
      return comMotivo(evento ? `${evento}. ${texto}` : texto);
    }
    case "pedido.alterado":
      if (d.campo === "privado") return d.para ? "Pedido marcado como privado" : "Pedido deixou de ser privado";
      return `${CAMPOS_PEDIDO[String(d.campo)] ?? String(d.campo)}: ${String(d.de ?? "nenhum")} → ${String(d.para ?? "nenhum")}`;
    case "pedido.responsavel":
      if (!d.para) return comMotivo(`${String(d.deNome ?? "O responsável")} deixou o pedido; ficou sem responsável`);
      return comMotivo(d.de ? `Repassado: ${String(d.deNome ?? "")} → ${String(d.paraNome ?? "")}` : `Responsável: ${String(d.paraNome ?? "")}`);
    case "pedido.aceito":
      return "Responsável aceitou o pedido";
    case "pedido.retorno_registrado":
      return `Retorno ao morador ${nomeDe(MEIOS_RETORNO_EXIBICAO, d.meio).toLowerCase()} · próximo retorno ${quando(d.para)}`;
    case "pedido.nota":
      return "Nota interna";
    case "pedido.retorno_mudou":
      return comMotivo(`Próximo retorno: ${quando(d.de)} → ${quando(d.para)}`);
    case "pedido.previsao_mudou":
      return comMotivo(`Previsão de solução: ${d.de ? mostrarDataSemHora(String(d.de)) : "sem previsão"} → ${d.para ? mostrarDataSemHora(String(d.para)) : "sem previsão"}`);
    case "pedido.pendencia_aberta":
      return `Pendência aberta · ${nomeDe(TIPOS_PENDENCIA, d.tipo)}`;
    case "pedido.pendencia_resolvida":
      return `Pendência resolvida · ${nomeDe(TIPOS_PENDENCIA, d.tipo)}`;
    case "pedido.arquivo_enviado":
      return `Arquivo enviado no ${nomeDe(PARTES_ARQUIVO, d.parte).toLowerCase()}: ${String(d.arquivoNome ?? "")}`;
    case "pedido.arquivo_recusado":
      return `${String(d.arquivoNome ?? "Arquivo")} não liberado: ${String(d.motivo ?? "")}`;
    case "pedido.arquivo_tirado":
      return comMotivo(`Tirou ${String(d.arquivoNome ?? "um arquivo")} do pedido`);
    case "pedido.manutencao_ligada":
      return "Manutenção ligada ao pedido";
    case "pedido.comunicado_ligado":
      return "Comunicado ligado ao pedido";
    case "pedido.manutencao_concluida":
      return "Manutenção ligada concluída: dê o retorno ao morador";
    case "pedido.revisao_pedida":
      return "O morador pediu revisão pelo WhatsApp";
    case "pedido.revisao_mantida":
      return "Pedido de revisão respondido: o pedido segue concluído";
    case "pedido.whatsapp_juntado":
      return "Mensagens do WhatsApp juntadas ao pedido";
    case "pedido.whatsapp_reenviado":
      return comMotivo("Mensagem do WhatsApp reenviada");
    case "pedido.whatsapp_falha_resolvida":
      return "Falha de envio no WhatsApp dada por resolvida";
    default:
      return descreverEventoDecisao(acao, d) ?? descreverAvisoPedido(acao, d) ?? acao;
  }
}
