"use client";
// Peças comuns de Orçamentos e compras (R8; quadros 470 a 486): os selos da situação, as datas no
// jeito dos quadros ("26/10/2026, 18h"), o endereço do link do fornecedor e os textos que só as
// telas usam. O domínio (packages/domain/src/orcamentos.ts) dá os nomes e as regras.

import { ESTADOS_CONVITE, mostrarCusto, mostrarDataSemHora, mostrarTotal } from "@triade/domain";
import { Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import type { ConviteDoOrcamento, OrcamentoDaLista, PropostaComparada, PropostaEmUso } from "./tipos.ts";

/** O que a lista e a ficha dizem em cada situação, e a cor. */
export function seloSituacao(o: Pick<OrcamentoDaLista, "estado" | "situacao" | "prazoFechou">): { texto: string; tom: Tom } {
  if (o.estado === "CANCELADO") return { texto: o.situacao, tom: "neutro" };
  if (o.estado === "ENTREGUE") return { texto: o.situacao, tom: "ok" };
  if (o.estado === "COMPRANDO") return { texto: o.situacao, tom: "andamento" };
  if (o.estado === "ESCOLHIDA") return { texto: o.situacao, tom: "andamento" };
  if (o.estado === "COMPARANDO" || (o.estado === "PEDINDO" && o.prazoFechou)) return { texto: "Pronto para comparar", tom: "atencao" };
  if (o.estado === "RASCUNHO") return { texto: o.situacao, tom: "neutro" };
  return { texto: o.situacao, tom: "info" };
}

/** O selo de cada convite (quadro 474): "Mandou a proposta · versão 1", "Recusou", "Link revogado", "Convidado". */
export function seloConvite(c: Pick<ConviteDoOrcamento, "estado" | "propostaEmUso" | "versoes" | "escolhido">): { texto: string; tom: Tom } {
  if (c.escolhido) return { texto: "Escolhida", tom: "ok" };
  if (c.estado === "REVOGADO") return { texto: ESTADOS_CONVITE.REVOGADO, tom: "neutro" };
  if (c.estado === "RECUSOU") return { texto: ESTADOS_CONVITE.RECUSOU, tom: "neutro" };
  if (c.estado === "RESPONDEU" && c.propostaEmUso) return { texto: `${ESTADOS_CONVITE.RESPONDEU} · versão ${c.propostaEmUso.numero}`, tom: "ok" };
  return { texto: "Esperando a proposta", tom: "info" };
}

const DIA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "26/10/2026, 18h" (ou "26/10/2026, 18h30"), no horário de Brasília. */
export function diaHoraPrazo(iso: string): string {
  const p = Object.fromEntries(DIA_HORA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}, ${Number(p.hour)}h${p.minute === "00" ? "" : p.minute}`;
}

/** "26/10, 18h": a mesma coisa, sem o ano (o link do fornecedor e os avisos curtos). */
export function diaHoraCurta(iso: string): string {
  return diaHoraPrazo(iso).replace(/\/\d{4},/, ",");
}

/** "24/10" de "2026-10-24" ou de um instante. */
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** O dia, por extenso curto, de uma data ou de um instante: "20/10/2026". */
export function diaCompleto(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return mostrarDataSemHora(d);
  const p = Object.fromEntries(DIA_HORA.formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}`;
}

/** O endereço do link do fornecedor (/o/<código>), para copiar ou mandar pelo WhatsApp. */
export const enderecoDoLinkOrcamento = (codigo: string) => `${typeof window === "undefined" ? "" : window.location.origin}/o/${codigo}`;

/** O WhatsApp já aberto com a mensagem: na conversa do número, quando ele existe; senão, para escolher o contato. */
export function enderecoWhatsapp(celular: string | null | undefined, texto: string): string {
  const numero = (celular ?? "").replace(/\D/g, "");
  const n = numero ? (numero.startsWith("55") ? numero : `55${numero}`) : "";
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

/** "R$ 6.480,00 · frete incluso" ou "R$ 6.130,00 · R$ 5.950,00 + frete R$ 180,00". */
export function linhaDoTotal(p: Pick<PropostaEmUso, "total" | "valor" | "frete" | "freteIncluso">): string {
  return p.freteIncluso ? `${mostrarCusto(p.total)} · frete incluso` : `${mostrarCusto(p.total)} · ${mostrarCusto(p.valor)} + frete ${mostrarCusto(p.frete)}`;
}

/** "vale até 10/11" ou "venceu em 27/10". */
export function textoValidade(p: Pick<PropostaEmUso, "validaAte" | "vencida">): string {
  return p.vencida ? `venceu em ${ddmm(p.validaAte)}` : `vale até ${ddmm(p.validaAte)}`;
}

/** "Prestador · versão 2 de 2" ou "Só pelo link · versão 1" (cabeçalho da comparação, quadro 479). */
export function linhaDaOrigem(p: Pick<PropostaComparada, "origem" | "numero" | "versoes">): string {
  const versao = p.versoes > 1 ? `versão ${p.numero} de ${p.versoes}` : `versão ${p.numero}`;
  return `${p.origem === "PRESTADOR" ? "Prestador" : "Só pelo link"} · ${versao}`;
}

/** As linhas de "Inclui" e "Não inclui" numa lista com marca. */
export function ListaInclui({ texto, tom = "ok" }: { texto: string | null; tom?: "ok" | "atencao" }) {
  const linhas = (texto ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return <span className="t-apoio">—</span>;
  return (
    <ul className="grid gap-0.5">
      {linhas.map((l) => (
        <li key={l} className="flex items-start gap-1.5">
          <Icone nome={tom === "ok" ? "check" : "alerta"} className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tom === "ok" ? "text-ok" : "text-atencao"}`} />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

/** O ladrilho com o ícone da origem (manutenção, pedido, preventiva ou escrito à mão). */
export const ICONE_ORIGEM: Record<string, NomeIcone> = { MANUTENCAO: "ferramenta", PEDIDO: "pedido", PREVENTIVA: "trocar", MAO: "editar" };

export function SeloMenor({ menor }: { menor: boolean }) {
  return menor ? <Selo tom="ok">Menor total</Selo> : null;
}

/** "R$ 6.480" nos cartões, "R$ 6.480,00" no detalhe. */
export const totalCurto = (centavos: number) => mostrarTotal(centavos, false);

export const NOTA_RODAPE = "O orçamento funciona sem o financeiro e sem pagamento: aprovar não é contratar, receber nem pagar. Depois de decidir, a compra e a entrega ficam registradas aqui; a despesa e a ordem de serviço são opcionais.";
export const NOTA_DECIDIR = "Aprovar não é contratar nem pagar. Depois do sim, o fornecedor confirma pelo link e você registra a compra e a entrega.";
export const NOTA_CONVITE = "O fornecedor vê só o que você escreveu e os arquivos marcados. Nunca vê quem mais foi convidado nem os preços dos outros. Você pode revogar o link a qualquer hora; ele para na hora.";
