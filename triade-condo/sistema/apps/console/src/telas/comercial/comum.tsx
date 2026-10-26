"use client";
// Peças comuns do Comercial (0296; quadros 320 a 326, 336, 342 e 343, aprovados em 24/10/2026):
// os selos da etapa e da tarefa, o texto do próximo passo, a linha de quem é o interessado e as
// rotas da api-console.

import { CAMPO_LINK_AGENDA, CANAIS_CONVERSA, ETAPAS_COMERCIAL, FAIXAS_PRECO, mostrarDataSemHora, ORIGENS_COMERCIAL, type CodigoFaixa, type EtapaComercial } from "@triade/domain";
import { chamarApi, Selo, type ErroApi, type NomeIcone, type Tom } from "@triade/ui";
import { diaHora, plural } from "../comum.tsx";
import { ROTAS_AGENDA, urlAgenda } from "./agenda.ts";
import type { Interessado, Tarefa } from "./tipos.ts";

export const ROTAS_COMERCIAL = {
  lista: "/v1/comercial/interessados",
  meuDia: "/v1/comercial/meu-dia",
  interessado: (id: string) => `/v1/comercial/interessados/${id}`,
  etapa: (id: string) => `/v1/comercial/interessados/${id}/etapa`,
  conversas: (id: string) => `/v1/comercial/interessados/${id}/conversas`,
  proximoPasso: (id: string) => `/v1/comercial/interessados/${id}/proximo-passo`,
  cadencia: (id: string) => `/v1/comercial/interessados/${id}/cadencia`,
  excluir: (id: string) => `/v1/comercial/interessados/${id}/excluir`,
  naoContatar: "/v1/comercial/nao-contatar",
  importar: "/v1/comercial/importar",
  exportar: "/v1/comercial/exportar",
  modelos: "/v1/comercial/modelos",
  mensagem: (id?: string) => (id ? `/v1/comercial/mensagens/${id}` : "/v1/comercial/mensagens"),
  cadenciaModelo: (id?: string) => (id ? `/v1/comercial/cadencias/${id}` : "/v1/comercial/cadencias"),
  etapaParametros: (etapa: string) => `/v1/comercial/etapas/${etapa}`,
};

export const nomeEtapa = (e: EtapaComercial) => ETAPAS_COMERCIAL[e] ?? e;
export const nomeFaixa = (f?: string) => (f ? FAIXAS_PRECO[f as CodigoFaixa]?.nome ?? f : undefined);
export const nomeOrigem = (i: Pick<Interessado, "origem" | "origemDetalhe">) =>
  i.origem === "COTACAO" && i.origemDetalhe ? `Cotação (${i.origemDetalhe})` : ORIGENS_COMERCIAL[i.origem] ?? i.origem;
export const nomeCanal = (c: string) => CANAIS_CONVERSA[c as keyof typeof CANAIS_CONVERSA] ?? c;

const TOM_ETAPA: Partial<Record<EtapaComercial, Tom>> = { GANHO: "ok", PERDIDO: "neutro", SEM_RESPOSTA: "neutro", APROVACAO: "andamento" };
export function SeloEtapa({ etapa }: { etapa: EtapaComercial }) {
  return <Selo tom={TOM_ETAPA[etapa] ?? "info"}>{nomeEtapa(etapa)}</Selo>;
}

/** 27/10 ou 27/10, 14:00; hoje e ontem por extenso. */
export function quandoCurto(data: string, hora?: string, hoje = hojeLocal()): string {
  const ontem = somarDias(hoje, -1);
  const dia = data === hoje ? "hoje" : data === ontem ? "ontem" : mostrarDataSemHora(data).slice(0, 5);
  return hora ? `${dia}, ${hora}` : dia;
}

export function hojeLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const horaDe = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const diaDe = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** O texto da tarefa da vez (CM-04): primeiro retorno, próximo passo ou passo da cadência. */
export function textoTarefa(i: Interessado): string {
  const t = i.tarefa;
  if (t.situacao === "FECHADO") return i.etapa === "PERDIDO" ? "Perdido" : nomeEtapa(i.etapa);
  if (t.tarefa === "PRIMEIRO_RETORNO" && t.quando) {
    const venceu = new Date(t.quando).getTime() < Date.now();
    return venceu ? `Primeiro retorno · meta passou às ${horaDe(t.quando)}` : `Primeiro retorno até ${quandoCurto(diaDe(t.quando), horaDe(t.quando))}`;
  }
  if (t.tarefa === "CADENCIA") return `Cadência · passo ${t.passo} de ${t.passos}: ${t.canal === "LIGACAO" ? "ligação" : t.canal === "EMAIL" ? "e-mail" : "WhatsApp"}`;
  if (i.proximoPasso) return `${i.proximoPasso.texto} · ${quandoCurto(i.proximoPasso.data, i.proximoPasso.hora)}`;
  return "Sem próximo passo";
}

export const TOM_SITUACAO: Record<Tarefa["situacao"], Tom> = { ATRASADO: "erro", HOJE: "atencao", SEM_PASSO: "atencao", FUTURO: "neutro", FECHADO: "neutro" };

/** Os selos do que pede atenção: atrasado, parado (CM-14). */
export function SelosAtencao({ i }: { i: Interessado }) {
  return (
    <>
      {i.tarefa.situacao === "ATRASADO" ? <Selo tom="erro">Atrasado</Selo> : null}
      {i.tarefa.diasParado ? <Selo tom="atencao">{`Parado · ${plural(i.tarefa.diasParado, "dia", "dias")}`}</Selo> : null}
    </>
  );
}

/** Pessoa · cidade · UF · faixa, a linha de baixo do nome do condomínio. */
export function linhaInteressado(i: Interessado): string {
  return [i.pessoa, i.cidade, i.uf, nomeFaixa(i.faixa)].filter(Boolean).join(" · ");
}

export function iconeCanal(canal?: string): NomeIcone {
  if (canal === "LIGACAO") return "telefone";
  if (canal === "EMAIL") return "email";
  if (canal === "WHATSAPP") return "whats";
  if (canal === "ENTRADA") return "mais";
  if (canal === "REUNIAO" || canal === "DEMONSTRACAO") return "calendario";
  if (canal === "VISITA") return "predio";
  if (canal === "PROPOSTA") return "documento";
  if (canal === "NOTA") return "editar";
  return "balao";
}

export { diaHora };

/** O [link de agendamento] de uma mensagem que vai sair agora (0310, A): com o campo no texto, a
 *  ficha pede um convite novo e o link leva o ?c= deste interessado; quem marcar por ele entra
 *  nesta ficha. Sem o campo ou sem o link da equipe, nada é pedido. O convite fica só no link que
 *  sai: a conversa registrada usa o link sem ele. */
export async function linkComConvite(interessadoId: string, codigo: string | undefined, texto: string)
  : Promise<{ ok: true; link: string | null; semConvite: string | null } | { ok: false; erro: ErroApi }> {
  if (!codigo || !texto.includes(CAMPO_LINK_AGENDA)) return { ok: true, link: null, semConvite: null };
  const r = await chamarApi<{ codigo: string; convite: string }>(ROTAS_AGENDA.convite(interessadoId), { corpo: {} });
  if (!r.ok) return { ok: false, erro: r.erro };
  return { ok: true, link: urlAgenda(window.location.origin, r.dados.codigo, r.dados.convite), semConvite: urlAgenda(window.location.origin, r.dados.codigo) };
}
