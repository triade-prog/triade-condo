// Configuração na implantação (PI-04, CF-01, CF-03, CF-09, CF-12): a TRÍADE monta pelo Console,
// parte por parte, e o síndico ajusta o dia a dia. Os mesmos valores estão no banco
// (0283_configuracao_implantacao.sql).

import { z } from "zod";
import { MINUTOS_ANEXAR } from "./whatsapp.ts";
import { etapaSchema, fusoSchema, DIAS_SEMANA, type Intervalo } from "./plataforma.ts";
import { parecidosSchema } from "./decisoes.ts";
import { etapaManutencaoSchema } from "./manutencao.ts";

const versao = z.number().int().min(1);

/** De quem é cada configuração (os três grupos aprovados em 20/10/2026). */
export const GRUPOS_CONFIGURACAO = {
  TRIADE: "Só a TRÍADE",
  MONTA: "TRÍADE monta · síndico ajusta",
  SINDICO: "Só o síndico",
} as const;
export type GrupoConfiguracao = keyof typeof GRUPOS_CONFIGURACAO;

/** As 11 partes que a implantação confere, na ordem das abas do app. `aba` é a aba das Configurações. */
export const PARTES_CONFIGURACAO = {
  HORARIOS: { nome: "Horários e fuso", aba: "horarios", grupo: "MONTA" },
  FERIADOS: { nome: "Feriados", aba: "feriados", grupo: "MONTA" },
  AREAS: { nome: "Áreas comuns", aba: "areas", grupo: "MONTA" },
  CATEGORIAS: { nome: "Categorias e prioridades", aba: "categorias", grupo: "MONTA" },
  ETAPAS: { nome: "Etapas dos pedidos", aba: "etapas", grupo: "TRIADE" },
  MODELOS: { nome: "Modelos de resposta", aba: "respostas", grupo: "MONTA" },
  PRAZOS: { nome: "Prazos e avisos", aba: "prazos", grupo: "MONTA" },
  MANUTENCAO: { nome: "Etapas da manutenção", aba: "manutencao", grupo: "TRIADE" },
  COMUNICADOS: { nome: "Comunicados, mural e e-mail", aba: "comunicados", grupo: "MONTA" },
  ETIQUETAS: { nome: "Etiquetas por local", aba: "etiquetas", grupo: "MONTA" },
  WHATSAPP: { nome: "WhatsApp", aba: "whatsapp", grupo: "MONTA" },
} as const satisfies Record<string, { nome: string; aba: string; grupo: GrupoConfiguracao }>;
export type ParteConfiguracao = keyof typeof PARTES_CONFIGURACAO;
export const TOTAL_PARTES = Object.keys(PARTES_CONFIGURACAO).length;

/** Motivo do ajuste técnico: com o cliente ativo, o banco exige de 3 a 500 caracteres (decisão 10). */
const motivo = z.string().trim().max(500).optional();

export const ajusteFusoSchema = fusoSchema.extend({ motivo });
export const ajusteEtapaSchema = etapaSchema.extend({ motivo });
export const ajusteEtapaManutencaoSchema = etapaManutencaoSchema.extend({ motivo });
export const ajusteParecidosSchema = parecidosSchema.extend({ motivo });
export const ajusteAnexarSchema = z.object({
  versao,
  minutos: z.number().int().refine((n) => (MINUTOS_ANEXAR as readonly number[]).includes(n), "Escolha 15, 30 ou 60 minutos"),
  motivo,
});

/** Marcar uma parte como conferida, com "de onde veio" (só no Console). */
export const conferirParteSchema = z.object({
  parte: z.enum(Object.keys(PARTES_CONFIGURACAO) as [ParteConfiguracao, ...ParteConfiguracao[]]),
  nota: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------------------
// Resumo para o síndico (tela 5): sai da configuração do momento, em linguagem simples.

/** "08:00" vira "8h"; "08:30" vira "8h30". */
export function hora(h: string): string {
  const [hh, mm] = h.split(":");
  return `${Number(hh)}h${mm && mm !== "00" ? mm : ""}`;
}

function juntar(itens: string[], e = "e"): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${e} ${itens.at(-1)}`;
}

/**
 * Os intervalos da semana em uma frase: dias seguidos com os mesmos intervalos ficam juntos
 * ("Segunda a sexta, das 8h às 12h e das 13h às 18h; sábado, das 8h às 12h").
 */
export function descreverSemana(intervalos: Intervalo[]): string {
  const porDia = new Map<number, string>();
  for (let dia = 0; dia < 7; dia++) {
    const doDia = intervalos.filter((i) => i.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (doDia.length) porDia.set(dia, juntar(doDia.map((i) => `das ${hora(i.inicio)} às ${hora(i.fim)}`)));
  }
  if (!porDia.size) return "Sem horário definido";
  // Segunda primeiro, domingo no fim, como se fala.
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const grupos: { de: number; ate: number; texto: string }[] = [];
  for (const dia of ordem) {
    const texto = porDia.get(dia);
    if (!texto) continue;
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.texto === texto && ordem.indexOf(ultimo.ate) === ordem.indexOf(dia) - 1) ultimo.ate = dia;
    else grupos.push({ de: dia, ate: dia, texto });
  }
  const frase = grupos
    .map((g) => {
      const de = DIAS_SEMANA[g.de]!.toLowerCase();
      const dias = g.de === g.ate ? de : `${de} a ${DIAS_SEMANA[g.ate]!.toLowerCase()}`;
      return `${dias}, ${g.texto}`;
    })
    .join("; ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** O que o resumo precisa da configuração (o que plataforma_configuracoes e as áreas devolvem). */
export interface DadosResumo {
  nome: string;
  horarios: { ATENDIMENTO: { intervalos: Intervalo[] } };
  categorias: { id: string; nome: string; ativa: boolean }[];
  prioridades: { id: string; nome: string; significado: string; nivel: number; ativa: boolean }[];
  prazos: { categoriaId: string | null; prioridadeId: string | null; horas: number }[];
  feriados: { data: string; descricao: string }[];
  areas?: { nome: string; ativa: boolean }[];
}

export interface SecaoResumo {
  titulo: string;
  texto: string;
}

/** As seções do resumo, sem notas internas nem "de onde veio" (PI-06). */
export function resumoConfiguracao(d: DadosResumo): SecaoResumo[] {
  const categorias = d.categorias.filter((c) => c.ativa).map((c) => c.nome);
  const prioridades = d.prioridades.filter((p) => p.ativa).sort((a, b) => b.nivel - a.nivel);
  const geral = d.prazos.find((p) => !p.categoriaId && !p.prioridadeId);
  const excecoes = d.prazos
    .filter((p) => p.prioridadeId && !p.categoriaId)
    .map((p) => {
      const nome = d.prioridades.find((x) => x.id === p.prioridadeId)?.nome;
      return nome ? `${nome.toLowerCase()} em até ${p.horas} horas` : null;
    })
    .filter((x): x is string => !!x);
  const prazos = [geral ? `Retorno em até ${geral.horas} horas de atendimento` : "Sem prazo geral de retorno", ...excecoes];
  const secoes: SecaoResumo[] = [
    {
      titulo: "Atendimento",
      texto: `${descreverSemana(d.horarios.ATENDIMENTO.intervalos)}. Fora disso, o prazo para.`,
    },
    {
      titulo: "Pedidos",
      texto: [
        `${categorias.length} categorias: ${juntar(categorias)}.`,
        prioridades.length ? `Prioridades: ${juntar(prioridades.map((p) => `${p.nome} (${p.significado})`))}.` : "",
        `${prazos.join("; ")}.`,
      ].filter(Boolean).join(" "),
    },
  ];
  if (d.feriados.length) secoes.push({ titulo: "Feriados", texto: `${d.feriados.length} feriados cadastrados, sem contar prazo.` });
  const areas = (d.areas ?? []).filter((a) => a.ativa).map((a) => a.nome);
  if (areas.length) secoes.push({ titulo: "Áreas comuns", texto: `${juntar(areas)}.` });
  secoes.push(
    {
      titulo: "O que é com vocês no app",
      texto: "Aceitar o termo do piloto do WhatsApp. Cada pessoa ligar os próprios avisos no WhatsApp. "
        + "Decidir se a conclusão passa por revisão e se pedido encerrado pode reabrir.",
    },
    {
      titulo: "O que fica com a TRÍADE",
      texto: "Fuso, etapas dos pedidos e da manutenção e as janelas técnicas. Para mudar, peçam pelo suporte.",
    },
  );
  return secoes;
}

/** "O que foi feito" da etapa 4, já preenchido com o resumo (decisão 4). */
export function textoEtapaConfiguracao(d: DadosResumo): string {
  return resumoConfiguracao(d)
    .filter((s) => !s.titulo.startsWith("O que"))
    .map((s) => `${s.titulo}: ${s.texto}`)
    .join("\n")
    .slice(0, 2000);
}
