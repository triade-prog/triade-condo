"use client";
// Os comunicados ligados a um pedido ou a uma manutenção (design "Telas dos Comunicados", tela 6;
// CD-05). Escrever a partir daqui já liga o rascunho. Comunicar o prédio não conta como retorno
// ao morador do pedido.

import Link from "next/link";
import { classeBotao } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ComunicadosLigados } from "../tipos.ts";
import { quando, SeloComunicado } from "./comum.tsx";

export function NosComunicados({ pedidoId, manutencaoId, ativo }: { pedidoId?: string; manutencaoId?: string; ativo: boolean }) {
  const caminho = pedidoId ? `/v1/condominio/pedidos/${pedidoId}/comunicados` : `/v1/condominio/manutencao/${manutencaoId}/comunicados`;
  const carga = useCarregar<ComunicadosLigados>(caminho);
  if (carga.estado !== "pronto" || !carga.dados.podeVer) return null;
  const { comunicados, podeEscrever } = carga.dados;
  const escrever = podeEscrever && ativo;
  if (comunicados.length === 0 && !escrever) return null;
  const novo = `/comunicados/escrever?${pedidoId ? `pedido=${pedidoId}` : `manutencao=${manutencaoId}`}`;

  return (
    <section aria-labelledby="t-nos-comunicados" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-nos-comunicados" className="t-rotulo font-medium tracking-[.1em] text-tinta-suave uppercase">Comunicados</h2>
      {comunicados.length ? (
        <ul className="grid gap-1.5">
          {comunicados.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 t-texto">
              <span className="grid gap-0.5">
                <Link href={`/comunicados/comunicado?id=${c.id}`} className="font-medium hover:text-violeta-600 hover:underline">{c.titulo}</Link>
                <span className="t-apoio text-tinta-suave">{c.publicoResumo}{c.numero > 1 ? ` · versão ${c.numero}` : ""} · {quando(c)}</span>
              </span>
              <SeloComunicado estado={c.estado} />
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio text-tinta-suave">Nenhum comunicado ligado.</p>}
      {escrever ? (
        <div className="grid justify-items-start gap-1">
          <Link href={novo} className={classeBotao("contorno", "", "m")}>+ Escrever comunicado</Link>
          {pedidoId ? <span className="t-apoio text-tinta-suave">Comunicar o prédio não conta como retorno ao morador do pedido.</span> : null}
        </div>
      ) : null}
    </section>
  );
}
