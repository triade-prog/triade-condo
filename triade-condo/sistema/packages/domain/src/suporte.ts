// Implantação e suporte (peça R4; PI-04, PI-05, CT-01, PI-09, PI-11, PI-17, PI-20, SH-01):
// roteiro de implantação, pendências e entrega; troca de síndico; suporte de acesso; acesso
// excepcional da TRÍADE; chamados de suporte técnico. Os mesmos valores estão no banco
// (0190_implantacao_suporte.sql).

import { z } from "zod";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));

// ---------------------------------------------------------------------------------------
// Implantação (PI-04, PI-05, SH-01).

export const SITUACOES_ETAPA_IMPLANTACAO = {
  PREPARADA: "Preparada",
  PENDENTE: "Pendente",
  REALIZADA: "Realizada",
  NAO_SE_APLICA: "Não se aplica",
} as const;
export type SituacaoEtapaImplantacao = keyof typeof SITUACOES_ETAPA_IMPLANTACAO;

export const MODALIDADES_APRESENTACAO = {
  PRESENCIAL: "Presencial em Brasília/DF",
  VIDEO: "Por vídeo",
} as const;

export const COM_QUEM = {
  EQUIPE: "Equipe TRÍADE",
  CLIENTE: "Cliente",
} as const;

/** O que ainda falta para entregar, como a tela explica. */
export const FALTAS_ENTREGA = {
  ETAPAS_ABERTAS: "Etapas 1 a 7 realizadas ou que não se aplicam",
  SEM_SINDICO: "Síndico com conta própria",
  SEM_PEDIDO_TESTE: "Pedido de teste registrado e concluído pelo síndico",
} as const;

export const etapaImplantacaoSchema = z
  .object({
    versao,
    situacao: z.enum(chaves(SITUACOES_ETAPA_IMPLANTACAO)),
    responsavelId: id.nullable().optional().transform((v) => v ?? null),
    substitutoId: id.nullable().optional().transform((v) => v ?? null),
    feito: texto(2000),
    motivo: texto(500),
    modalidade: z.enum(chaves(MODALIDADES_APRESENTACAO)).nullable().optional().transform((v) => v ?? null),
    quando: data.nullable().optional().transform((v) => v ?? null),
  })
  .refine((e) => e.situacao !== "REALIZADA" || (e.feito && e.feito.length >= 3), { message: "Escreva o que foi feito", path: ["feito"] })
  .refine((e) => e.situacao !== "NAO_SE_APLICA" || (e.motivo && e.motivo.length >= 3), { message: "Diga por que não se aplica", path: ["motivo"] })
  .refine((e) => !e.substitutoId || e.substitutoId !== e.responsavelId, { message: "Substituto diferente do responsável", path: ["substitutoId"] });

export const pendenciaImplantacaoSchema = z.object({
  versao: versao.nullable().optional().transform((v) => v ?? null),
  etapa: z.number().int().min(1).max(20).nullable().optional().transform((v) => v ?? null),
  texto: z.string().trim().min(3).max(300),
  comQuem: z.enum(chaves(COM_QUEM)),
  responsavelId: id,
  proximoRetorno: data,
});

export const resolverPendenciaImplantacaoSchema = z.object({ versao, resolucao: z.string().trim().min(2).max(300) });

export const entregaSchema = z.object({ versao, recado: z.string().trim().min(3).max(1000) });

export const RECADO_ENTREGA = (nome: string) => `O ${nome} está pronto. Qualquer dúvida, use Ajuda e suporte na Plataforma.`;

// ---------------------------------------------------------------------------------------
// Troca de síndico (CT-01).

export const CANAIS_SUPORTE = {
  WHATSAPP: "WhatsApp da TRÍADE",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  PRESENCIAL: "Presencial",
  OUTRO: "Outro",
} as const;
export type CanalSuporte = keyof typeof CANAIS_SUPORTE;

const email = z.string().trim().toLowerCase().max(254).email();

export const trocaSindicoSchema = z.object({
  vinculoId: id,
  versao,
  pedidoPor: z.string().trim().min(2).max(120),
  canal: z.enum(chaves(CANAIS_SUPORTE)),
  conferido: z.array(z.string().trim().min(3).max(200)).min(1).max(6),
  nome: z.string().trim().min(1).max(120),
  email,
});

// ---------------------------------------------------------------------------------------
// Suporte de acesso (PI-09).

export const TIPOS_SUPORTE_ACESSO = {
  SENHA: "Esqueceu a senha",
  AUTENTICADOR: "Perdeu o autenticador",
  EMAIL_NAO_CHEGA: "E-mail não chega",
  OUTRO: "Outro",
} as const;

export const SITUACOES_SUPORTE_ACESSO = {
  ABERTO: "Verificando",
  DUVIDOSO: "Com a administração",
  ENVIADO: "Link enviado",
  AUTENTICADOR_TIRADO: "Autenticador tirado",
  RECUSADO: "Recusado",
} as const;

export const abrirSuporteAcessoSchema = z.object({
  pessoaId: id,
  tipo: z.enum(chaves(TIPOS_SUPORTE_ACESSO)),
  canal: z.enum(chaves(CANAIS_SUPORTE)),
  descricao: z.string().trim().min(3).max(1000),
});

export const verificarSuporteAcessoSchema = z.object({
  versao,
  tipo: z.enum(chaves(TIPOS_SUPORTE_ACESSO)),
  dadosConferidos: z.boolean(),
  canalConhecido: z.boolean(),
});

export const decidirSuporteAcessoSchema = z
  .object({
    versao,
    decisao: z.enum(["ENVIAR", "TIRAR_AUTENTICADOR", "DUVIDOSO", "RECUSAR"]),
    motivo: texto(500),
  })
  .refine((d) => !["DUVIDOSO", "RECUSAR"].includes(d.decisao) || (d.motivo && d.motivo.length >= 3), {
    message: "Diga o motivo",
    path: ["motivo"],
  });

/** b•••••@exemplo.com.br: a equipe confere o e-mail sem lê-lo inteiro. */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return "•••";
  return `${usuario[0]}${"•".repeat(Math.max(3, Math.min(usuario.length - 1, 8)))}@${dominio}`;
}

// ---------------------------------------------------------------------------------------
// Acesso excepcional (PI-11).

export const AREAS_EXCEPCIONAIS = {
  PEDIDOS: "Pedidos",
  MORADORES: "Moradores",
  COMUNICADOS: "Comunicados e documentos",
  MANUTENCAO: "Manutenção",
} as const;
export type AreaExcepcional = keyof typeof AREAS_EXCEPCIONAIS;

export const SITUACOES_ACESSO_EXCEPCIONAL = {
  PEDIDO: "Esperando o síndico",
  APROVADO: "Valendo",
  RECUSADO: "Recusado",
  ENCERRADO: "Encerrado",
  EXPIRADO: "Acabou o prazo",
} as const;

export const PRAZOS_ACESSO_EXCEPCIONAL = [2, 4, 8, 24, 48, 72] as const;

export const pedirAcessoExcepcionalSchema = z.object({
  motivo: z.string().trim().min(10).max(1000),
  areas: z.array(z.enum(chaves(AREAS_EXCEPCIONAIS))).min(1).max(4),
  horas: z.number().int().min(1).max(72),
  chamadoId: id.nullable().optional().transform((v) => v ?? null),
});

export const decidirAcessoExcepcionalSchema = z
  .object({ aprovar: z.boolean(), motivo: texto(500) })
  .refine((d) => d.aprovar || (d.motivo && d.motivo.length >= 3), { message: "Diga o motivo", path: ["motivo"] });

/** "Pedidos e Moradores por 24 horas". */
export function descreverAcessoExcepcional(areas: string[], horas: number): string {
  const nomes = areas.map((a) => AREAS_EXCEPCIONAIS[a as AreaExcepcional] ?? a);
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : (nomes[0] ?? "");
  return `${lista} por ${horas} ${horas === 1 ? "hora" : "horas"}`;
}

// ---------------------------------------------------------------------------------------
// Chamados (PI-17, PI-20).

export const TIPOS_CHAMADO = {
  DUVIDA: "Dúvida",
  PROBLEMA: "Problema",
  SUGESTAO: "Sugestão",
} as const;

export const AREAS_CHAMADO = {
  INICIO: "Início",
  PEDIDOS: "Pedidos",
  AGENDA: "Agenda",
  MANUTENCAO: "Manutenção",
  COMUNICADOS: "Comunicados",
  MEMORIA: "Memória do prédio",
  MORADORES: "Moradores e unidades",
  CONFIGURACOES: "Configurações",
  PESSOAS: "Pessoas e acesso",
  ACESSO: "Entrar no sistema",
  OUTRO: "Outro",
} as const;

export const SITUACOES_CHAMADO = {
  NOVO: "Novo",
  ANDAMENTO: "Em andamento",
  ESPERANDO_CLIENTE: "Esperando o cliente",
  RESOLVIDO: "Resolvido",
} as const;
export type SituacaoChamado = keyof typeof SITUACOES_CHAMADO;

export const FILTROS_CHAMADO = {
  ABERTOS: "Abertos",
  ESPERANDO_CLIENTE: "Esperando o cliente",
  RESOLVIDOS: "Resolvidos",
  TODOS: "Todos",
} as const;

/** Imagens do chamado: as regras das fotos dos pedidos, até 3. */
export const IMAGENS_CHAMADO = { maximo: 3, tamanho: 10 * 1024 * 1024, tipos: ["image/jpeg", "image/png", "image/webp"] } as const;
export const DIAS_REABRIR_CHAMADO = 7;

export const abrirChamadoSchema = z.object({
  tipo: z.enum(chaves(TIPOS_CHAMADO)),
  area: z.enum(chaves(AREAS_CHAMADO)),
  titulo: z.string().trim().min(3).max(120),
  texto: z.string().trim().min(2).max(4000),
});

export const responderChamadoSchema = z.object({
  texto: z.string().trim().min(2).max(4000),
  interna: z.boolean().optional().default(false),
});

export const atualizarChamadoSchema = z.object({
  versao,
  situacao: z.enum(chaves(SITUACOES_CHAMADO)),
  responsavelId: id.nullable().optional().transform((v) => v ?? null),
});

export const iniciarImagemChamadoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(IMAGENS_CHAMADO.tipos),
  tamanho: z.number().int().min(1).max(IMAGENS_CHAMADO.tamanho),
});

/** Quem fala no chamado, do ponto de vista do cliente. */
export function rotuloSituacaoChamadoCliente(situacao: string): string {
  if (situacao === "NOVO" || situacao === "ANDAMENTO") return "Com a TRÍADE";
  if (situacao === "ESPERANDO_CLIENTE") return "Esperando você";
  return "Resolvido";
}

// ---------------------------------------------------------------------------------------
// Histórico (PI-12).

export function descreverEventoSuporte(acao: string, d: Record<string, unknown>): string | null {
  switch (acao) {
    case "implantacao.iniciada":
      return `Implantação iniciada · roteiro versão ${String(d.roteiro)}`;
    case "implantacao.etapa":
      return `Etapa ${String(d.etapa)}: ${SITUACOES_ETAPA_IMPLANTACAO[d.para as SituacaoEtapaImplantacao] ?? String(d.para)}`;
    case "implantacao.pendencia_criada":
      return d.etapa ? `Pendência criada na etapa ${String(d.etapa)}` : "Pendência criada";
    case "implantacao.pendencia_alterada":
      return "Pendência alterada";
    case "implantacao.pendencia_resolvida":
      return "Pendência resolvida";
    case "implantacao.entregue":
      return "Implantação entregue ao cliente";
    case "sindico.trocado":
      return "Síndico trocado: o anterior saiu e o novo entrou com conta própria";
    case "troca.registrada":
      return `Troca registrada · ${String(d.conferidos)} ${d.conferidos === 1 ? "item conferido" : "itens conferidos"}`;
    case "suporte_acesso.aberto":
      return `Suporte de acesso aberto · ${TIPOS_SUPORTE_ACESSO[d.tipo as keyof typeof TIPOS_SUPORTE_ACESSO] ?? String(d.tipo)}`;
    case "suporte_acesso.verificado":
      return "Suporte de acesso: verificação registrada";
    case "suporte_acesso.enviado":
      return "Suporte de acesso: link de senha nova enviado ao e-mail cadastrado";
    case "suporte_acesso.autenticador_tirado":
      return "Suporte de acesso: autenticador tirado pela administração";
    case "suporte_acesso.duvidoso":
      return "Suporte de acesso: caso duvidoso passado à administração";
    case "suporte_acesso.recusado":
      return "Suporte de acesso recusado";
    case "suporte_acesso.falhou":
      return "Suporte de acesso: o envio falhou e o pedido voltou para verificação";
    case "acesso.link_senha_suporte":
      return "Link de senha nova enviado pelo suporte";
    case "acesso.autenticador_tirado_suporte":
      return "Autenticador tirado pelo suporte, depois da verificação";
    case "acesso_excepcional.pedido":
      return `A TRÍADE pediu acesso excepcional · ${descreverAcessoExcepcional((d.areas as string[]) ?? [], Number(d.horas))}`;
    case "acesso_excepcional.aprovado":
      return "Acesso excepcional aprovado pelo síndico";
    case "acesso_excepcional.recusado":
      return "Acesso excepcional recusado pelo síndico";
    case "acesso_excepcional.encerrado":
      return "Acesso excepcional encerrado pelo síndico";
    case "acesso_excepcional.leitura":
      return `A TRÍADE abriu ${AREAS_EXCEPCIONAIS[d.area as AreaExcepcional] ?? String(d.area)} pelo acesso excepcional`;
    case "chamado.aberto":
      return `Chamado de suporte aberto · ${TIPOS_CHAMADO[d.tipo as keyof typeof TIPOS_CHAMADO] ?? String(d.tipo)}`;
    case "chamado.reaberto":
      return "Chamado reaberto pelo cliente";
    case "chamado.resolvido":
      return "Chamado resolvido";
    case "chamado.situacao":
      return `Chamado: ${SITUACOES_CHAMADO[d.para as SituacaoChamado] ?? String(d.para)}`;
    case "chamado.nota_interna":
      return "Nota interna no chamado";
    default:
      return null;
  }
}
