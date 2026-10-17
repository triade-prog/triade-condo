"use client";
// Marcar a visita a partir da manutenção (MP-04): o compromisso da agenda abre já com quem
// executa, o local e a ligação com a manutenção (e com o pedido dela).

import { useState } from "react";
import { useCarregar } from "../sessao.tsx";
import type { ManutencaoDetalhe, OpcoesAgenda } from "../tipos.ts";
import { FormCompromisso } from "../agenda/FormCompromisso.tsx";

export function MarcarVisita({ manutencaoId, aoFechar, salvo }: { manutencaoId: string; aoFechar: () => void; salvo: (texto: string) => void }) {
  const detalhe = useCarregar<ManutencaoDetalhe>(`/v1/condominio/manutencao/${manutencaoId}`);
  const opcoes = useCarregar<OpcoesAgenda>("/v1/condominio/agenda/opcoes");
  const [aberto, setAberto] = useState(true);
  if (detalhe.estado !== "pronto" || opcoes.estado !== "pronto") return null;
  const m = detalhe.dados.manutencao;
  const e = m.executor;
  const fechar = () => { setAberto(false); aoFechar(); };
  return (
    <FormCompromisso aberto={aberto} opcoes={opcoes.dados} aoFechar={fechar}
      inicio={{
        manutencaoId: m.id, tipo: "VISITA", titulo: `Visita: ${e && e.tipo !== "EQUIPE" ? e.nome : m.titulo}`.slice(0, 120),
        onde: "OUTRO", local: m.local, deFora: e && e.tipo !== "EQUIPE" ? e.nome : undefined,
        participantes: e?.tipo === "EQUIPE" && e.id ? [e.id] : [],
      }}
      salvo={(_, texto) => { setAberto(false); salvo(texto); }} />
  );
}
