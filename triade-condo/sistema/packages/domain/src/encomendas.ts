// Portaria 1 · Encomendas (PA-01, PA-07 em parte, V-04 a V-06, CF-12, W-20, W-21, PT-01). Os
// mesmos valores estão no banco (0299_encomendas.sql). Quem cuida da portaria vê o nome das
// pessoas de cada unidade, nunca o telefone.

import { z } from "zod";
import { renderizarModelo } from "./whatsapp.ts";

const chaves = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const uuid = z.string().uuid();
const textoOpcional = (max: number) =>
  z.string().max(max * 2).nullable().optional().transform((v) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    return t ? t : null;
  }).refine((v) => v === null || v.length <= max, { message: `Até ${max} caracteres` });
const textoLimpo = (min: number, max: number) =>
  z.string().transform((v) => v.replace(/\s+/g, " ").trim()).pipe(z.string().min(min).max(max));

/** Estados pelo guardião. */
export const ESTADOS_ENCOMENDA = {
  GUARDADA: "Guardada",
  ENTREGUE: "Entregue",
} as const;
export type EstadoEncomenda = keyof typeof ESTADOS_ENCOMENDA;

/** A situação do aviso à unidade (regra 5): "Sem aviso" e "Aviso falhou" não se confundem. */
export const AVISOS_ENCOMENDA = {
  AVISADA: "Avisada",
  SEM_AVISO: "Sem aviso",
  AVISO_FALHOU: "Aviso falhou",
  OUTRO_MEIO: "Avisada por outro meio",
} as const;
export type AvisoEncomenda = keyof typeof AVISOS_ENCOMENDA;

/** O tom do selo de cada situação (verde, âmbar, vermelho). */
export const TOM_AVISO_ENCOMENDA: Record<AvisoEncomenda, "ok" | "atencao" | "erro" | "info"> = {
  AVISADA: "ok",
  SEM_AVISO: "atencao",
  AVISO_FALHOU: "erro",
  OUTRO_MEIO: "ok",
};

/** Por que ninguém da unidade recebe. */
export const MOTIVOS_SEM_AVISO = {
  PAROU: "Pediu PARAR",
  SEM_CONTATO: "Ninguém com WhatsApp",
  SEM_WHATSAPP: "Ninguém com WhatsApp",
  WHATSAPP_DESLIGADO: "WhatsApp do condomínio desligado",
} as const;
export type MotivoSemAviso = keyof typeof MOTIVOS_SEM_AVISO;

/** Por que uma pessoa da unidade não recebe. */
export const MOTIVOS_NAO_RECEBE = {
  PAROU: "Pediu PARAR pelo WhatsApp",
  SEM_WHATSAPP: "O número não está no WhatsApp",
  NAO_MORA: "Não mora na unidade",
  WHATSAPP_DESLIGADO: "O WhatsApp do condomínio está desligado",
} as const;
export type MotivoNaoRecebe = keyof typeof MOTIVOS_NAO_RECEBE;

/** Como a portaria avisou, quando não foi pelo WhatsApp. */
export const MEIOS_AVISO = {
  INTERFONE: "Interfone",
  BILHETE: "Bilhete na porta",
  PESSOALMENTE: "Pessoalmente",
} as const;
export type MeioAviso = keyof typeof MEIOS_AVISO;

export const ABAS_ENCOMENDAS = { GUARDADAS: "Guardadas", ENTREGUES: "Entregues" } as const;
export type AbaEncomendas = keyof typeof ABAS_ENCOMENDAS;

export const ATALHOS_ENCOMENDAS = {
  ANTIGAS: "Guardadas há mais de N dias",
  AVISO_FALHOU: "Aviso falhou",
  SEM_AVISO: "Sem aviso",
} as const;
export type AtalhoEncomendas = keyof typeof ATALHOS_ENCOMENDAS;

/** O nome do atalho das antigas, com os dias da configuração. */
export function nomeAtalho(a: AtalhoEncomendas, dias: number): string {
  return a === "ANTIGAS" ? `Guardadas há mais de ${dias} ${dias === 1 ? "dia" : "dias"}` : ATALHOS_ENCOMENDAS[a];
}

/** Sugestões de quem mandou; qualquer outro nome vale. */
export const REMETENTES_SUGERIDOS = ["Correios", "Mercado Livre", "Amazon", "Shopee"] as const;

export const FOTOS_ENCOMENDA = { ETIQUETA: "Foto da etiqueta", RETIRADA: "Foto da retirada" } as const;
export type FotoEncomenda = keyof typeof FOTOS_ENCOMENDA;
export const TIPOS_FOTO_ENCOMENDA = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANHO_MAXIMO_FOTO_ENCOMENDA = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------------------
// Entrada.

export const buscaEncomendasSchema = z.object({
  aba: z.enum(chaves(ABAS_ENCOMENDAS)).default("GUARDADAS"),
  atalho: z.enum(chaves(ATALHOS_ENCOMENDAS)).optional(),
  busca: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
}).refine((q) => !q.atalho || q.aba === "GUARDADAS", { path: ["atalho"], message: "Os atalhos são das guardadas" });

export const registrarEncomendaSchema = z.object({
  unidadeId: uuid,
  remetente: textoLimpo(2, 60),
  volumes: z.number().int().min(1).max(50),
  lugarId: uuid,
  observacao: textoOpcional(200),
});

export const corrigirEncomendaSchema = registrarEncomendaSchema.extend({ versao });

export const entregarEncomendaSchema = z.object({
  contatoId: uuid.nullable().optional().transform((v) => v ?? null),
  nome: textoOpcional(80),
  ligacao: textoOpcional(60),
})
  .refine((d) => (d.contatoId === null) !== (d.nome === null), { path: ["nome"], message: "Escolha quem retirou" })
  .refine((d) => d.nome === null || d.nome.length >= 2, { path: ["nome"], message: "Nome de quem retirou: 2 a 80 caracteres" })
  .refine((d) => d.contatoId === null || d.ligacao === null, { path: ["ligacao"], message: "A ligação só vale para outra pessoa" });

export const outroMeioSchema = z.object({
  meio: z.enum(chaves(MEIOS_AVISO)),
  com: textoOpcional(80).refine((v) => v === null || v.length >= 2, { message: "Com quem falou: 2 a 80 caracteres" }),
});

export const enviarFotoEncomendaSchema = z.object({
  tipoFoto: z.enum(chaves(FOTOS_ENCOMENDA)),
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});

export const portariaSchema = z.object({
  versao,
  lembreteLigado: z.boolean(),
  lembreteDias: z.number().int().min(1).max(60),
  sindicoIndicado: z.boolean(),
});

export const lugarEncomendaSchema = z.object({
  versao: versao.nullable().optional().transform((v) => v ?? null),
  nome: textoLimpo(2, 40),
  ativo: z.boolean().default(true),
});

// ---------------------------------------------------------------------------------------
// Saída e textos.

export interface PessoaEncomenda {
  contatoId: string;
  nome: string;
  papel: string;
  mora: boolean;
  recebe: boolean;
  motivo?: MotivoNaoRecebe;
  parouEm?: string;
}

export interface Encomenda {
  id: string;
  unidade: { id: string; rotulo: string };
  remetente: string;
  volumes: number;
  lugar?: { id: string; nome: string; ativo: boolean };
  observacao?: string;
  estado: EstadoEncomenda;
  aviso: AvisoEncomenda;
  avisoMotivo?: MotivoSemAviso;
  avisados?: string[];
  naoChegou?: string[];
  pararam?: string[];
  semWhatsapp?: string[];
  moradores: number;
  outroMeio?: { meio: MeioAviso; com?: string; em: string; por: string };
  guardadaEm: string;
  guardadaPor: { id: string; nome: string; eu: boolean };
  entregueEm?: string;
  entreguePor?: { id: string; nome: string; eu: boolean };
  retirou?: { contatoId?: string; nome: string; ligacao?: string; daUnidade: boolean };
  lembreteEm?: string;
  lembrarEm?: string;
  dias: number;
  antiga: boolean;
  fotoEtiqueta?: string;
  fotoRetirada?: string;
  versao: number;
}

/** "1 volume", "3 volumes". */
export function textoVolumes(n: number): string {
  return `${n} ${n === 1 ? "volume" : "volumes"}`;
}

const lista = (nomes: string[]) =>
  nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

/**
 * A linha embaixo do selo do aviso, como no desenho: quem recebeu e quantos dos que moram lá,
 * quem pediu PARAR, o número fora do WhatsApp, o envio que não chegou ou como foi o outro meio.
 */
export function detalheAviso(e: Pick<Encomenda, "aviso" | "avisoMotivo" | "avisados" | "naoChegou" | "pararam" | "semWhatsapp" | "moradores" | "outroMeio">,
  quando?: (iso: string) => string): string {
  const avisados = e.avisados ?? [];
  switch (e.aviso) {
    case "AVISADA": {
      const n = avisados.length;
      const base = lista(avisados);
      return e.moradores > n ? `${base} · ${n} de ${e.moradores} recebe${n === 1 ? "" : "m"}` : base;
    }
    case "AVISO_FALHOU":
      return (e.naoChegou ?? []).length ? `O envio a ${lista(e.naoChegou ?? [])} não chegou` : "O envio não chegou";
    case "SEM_AVISO":
      if (e.avisoMotivo === "WHATSAPP_DESLIGADO") return "O WhatsApp do condomínio está desligado";
      if (e.avisoMotivo === "SEM_CONTATO") return "Ninguém que mora na unidade tem contato confirmado";
      if ((e.pararam ?? []).length) {
        const p = e.pararam ?? [];
        return `${lista(p)} ${p.length === 1 ? "pediu" : "pediram"} PARAR`;
      }
      if ((e.semWhatsapp ?? []).length) {
        const s = e.semWhatsapp ?? [];
        return s.length === 1 ? `O número de ${s[0]} não está no WhatsApp` : `Os números de ${lista(s)} não estão no WhatsApp`;
      }
      return "Ninguém da unidade recebe pelo WhatsApp";
    case "OUTRO_MEIO": {
      const o = e.outroMeio;
      if (!o) return "";
      const como = { INTERFONE: "Pelo interfone", BILHETE: "Por bilhete na porta", PESSOALMENTE: "Pessoalmente" }[o.meio];
      return `${como}${o.com ? `, com ${o.com}` : ""} · ${o.por}${quando ? `, ${quando(o.em)}` : ""}`;
    }
  }
}

/** As variáveis do modelo, na mesma ordem do banco (parametros_encomenda). */
export function parametrosEncomenda(p: {
  unidade: string; remetente: string; volumes: number; lugar: string; quando: string; recebidaPor: string; condominio: string;
}): string[] {
  return [p.unidade, `${p.remetente.trim()} · ${textoVolumes(p.volumes)}`, p.lugar, p.quando, p.recebidaPor, p.condominio];
}

/** A prévia "Como chega no WhatsApp", com o modelo que o banco devolve. */
export function previaEncomenda(modelo: { corpo: string; rodape?: string | null }, p: Parameters<typeof parametrosEncomenda>[0]): string {
  return renderizarModelo(modelo.corpo, modelo.rodape, parametrosEncomenda(p));
}
