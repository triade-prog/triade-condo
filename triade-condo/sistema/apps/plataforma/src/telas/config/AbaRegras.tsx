"use client";
// Regras dos pedidos (AT-14, AT-15, CF-12): revisar a conclusão antes de encerrar (começa
// desligada) e reabrir pedido encerrado (começa ligada). Nada obrigatório.

import { useState } from "react";
import { AvisoErro, Botao, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa } from "../moradores/comum.tsx";
import type { PropsAba } from "./Configuracoes.tsx";

export function AbaRegras({ config, pode, recarregar, salvo }: PropsAba) {
  const [revisao, setRevisao] = useState(config.regrasPedidos.revisao);
  const [reabertura, setReabertura] = useState(config.regrasPedidos.reabertura);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/regras-pedidos", { metodo: "PUT", corpo: { versao: config.versao, revisao, reabertura } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo("Regras dos pedidos salvas.");
  }

  const mudou = revisao !== config.regrasPedidos.revisao || reabertura !== config.regrasPedidos.reabertura;
  return (
    <section aria-labelledby="t-regras" className="grid max-w-2xl gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-regras" className="text-lg font-medium">Regras dos pedidos</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      {pode ? (
        <>
          <Caixa id="regra-revisao" rotulo="Revisar a conclusão antes de encerrar" marcada={revisao} aoMudar={setRevisao}
            ajuda="Quem não é síndico conclui e o síndico aprova ou devolve. O síndico que conclui já revisa." />
          <Caixa id="regra-reabertura" rotulo="Reabrir pedido encerrado" marcada={reabertura} aoMudar={setReabertura}
            ajuda="Com motivo, guardando a conclusão anterior. Desligado, quem voltar a reclamar ganha um pedido novo." />
          <div className="flex justify-end"><Botao disabled={!mudou || enviando} onClick={() => void salvar()}>{enviando ? "Salvando…" : "Salvar"}</Botao></div>
        </>
      ) : (
        <ul className="grid gap-2 text-sm">
          <li>Revisar a conclusão antes de encerrar: {config.regrasPedidos.revisao ? "ligado" : "desligado"}</li>
          <li>Reabrir pedido encerrado: {config.regrasPedidos.reabertura ? "ligado" : "desligado"}</li>
        </ul>
      )}
    </section>
  );
}
