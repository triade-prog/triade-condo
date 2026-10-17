"use client";
// O pedido mostra o aviso (passos 6; AT-06, AT-08, AT-09): com o retorno vencido, há quanto
// tempo venceu, quem já foi avisado e quando o próximo nível será avisado se nada mudar.
// Registrar o retorno ao morador encerra o vencimento.

import { mostrarHoras } from "@triade/domain";
import { Aviso, Botao } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { PrazoDoPedido } from "../tipos.ts";
import { aHora } from "./comum.tsx";

const PARA: Record<string, string> = {
  RETORNO_VENCIDO: "ao responsável",
  ESCALADO_SINDICO: "ao síndico",
  ESCALADO_SUBSTITUTO: "ao substituto",
};

export function FaixaPrazo({ pedidoId, agora, versao, semResponsavel, aoDarRetorno }: {
  pedidoId: string;
  agora: string;
  /** Recarrega quando o pedido muda. */
  versao: number;
  semResponsavel: boolean;
  aoDarRetorno?: () => void;
}) {
  const prazo = useCarregar<PrazoDoPedido>(`/v1/condominio/pedidos/${pedidoId}/prazo?v=${versao}`);
  if (prazo.estado !== "pronto" || !prazo.dados.vencido) return null;
  const p = prazo.dados;
  const avisados = p.avisos.map((a) => {
    const quem = a.tipo === "RETORNO_VENCIDO" && semResponsavel ? "ao síndico" : PARA[a.tipo] ?? "";
    return `${quem}, ${a.nomes.join(" e ")}, ${aHora(a.em, agora)}`;
  });
  return (
    <Aviso tom="atencao" titulo={`Retorno vencido há ${mostrarHoras(p.horas)} de atendimento`}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {avisados.length ? `Avisado ${avisados.join("; ")}.` : "O aviso sai na próxima conferência, em até 5 minutos."}
          {p.proximo ? ` ${p.proximo.tipo === "ESCALADO_SINDICO" ? "O síndico" : "O substituto"} será avisado ${aHora(p.proximo.em, agora)} se nada mudar.` : ""}
          {" "}O vencimento só acaba com o retorno ao morador.
        </span>
        {aoDarRetorno ? <Botao onClick={aoDarRetorno}>Registrar retorno</Botao> : null}
      </span>
    </Aviso>
  );
}
