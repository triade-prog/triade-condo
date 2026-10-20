"use client";
// Regras dos pedidos (AT-14, AT-15, CF-12): revisar a conclusão antes de encerrar (começa
// desligada) e reabrir pedido encerrado (começa ligada). Nada obrigatório. Da F7.4 (AT-18): a
// janela dos pedidos parecidos, que vem com 90 dias.

import { useState } from "react";
import { JANELAS_PARECIDOS } from "@triade/domain";
import { AvisoErro, Botao, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import type { PropsAba } from "./Configuracoes.tsx";

export function AbaRegras(props: PropsAba) {
  return (
    <div className="grid gap-4">
      <RegrasPedidos {...props} />
      {props.config.parecidosDias !== undefined ? <Parecidos {...props} dias={props.config.parecidosDias} /> : null}
    </div>
  );
}

/** Janela dos pedidos parecidos (F7.4, AT-18): muda só as sugestões; o que já foi ligado não muda. Salva ao escolher. */
function Parecidos({ config, pode, recarregar, salvo, dias: atual }: PropsAba & { dias: number }) {
  const [dias, setDias] = useState(String(atual));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolher(v: string) {
    if (enviando || v === dias) return;
    setErro(null);
    setDias(v);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/regras-parecidos", { metodo: "PUT", corpo: { versao: config.versao, dias: Number(v) } });
    setEnviando(false);
    if (!r.ok) { setDias(String(atual)); return setErro(r.erro); }
    salvo(`Pedidos parecidos: o sistema sugere os dos últimos ${v} dias.`);
  }

  const ajuda = "O mesmo local vale pelo texto do campo Local, sem diferença de maiúscula e espaço (o local da etiqueta QR entra assim), ou pela mesma unidade. Muda só as sugestões; o que já foi ligado não muda.";
  return (
    <section aria-labelledby="t-parecidos" className="grid max-w-2xl gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <h2 id="t-parecidos" className="text-lg font-medium">Pedidos parecidos</h2>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      {pode ? (
        <>
          <p className="text-sm">Sugerir como parecidos os pedidos da mesma categoria e do mesmo local dos últimos</p>
          <Escolha rotulo="Janela dos parecidos" atual={dias} aoMudar={(v) => void escolher(v)}
            opcoes={JANELAS_PARECIDOS.map((n) => ({ valor: String(n), texto: `${n} dias` }))} />
          <p className="text-xs text-tinta-suave">{ajuda}</p>
        </>
      ) : (
        <p className="text-sm">Sugere os pedidos parecidos dos últimos {atual} dias. <span className="block text-xs text-tinta-suave">{ajuda}</span></p>
      )}
    </section>
  );
}

function RegrasPedidos({ config, pode, recarregar, salvo }: PropsAba) {
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
