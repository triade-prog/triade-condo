"use client";
// Regras dos pedidos (AT-14, AT-15, CF-12): revisar a conclusão antes de encerrar (começa
// desligada) e reabrir pedido encerrado (começa ligada). Nada obrigatório. Ficam na página Prazos
// e avisos, a 4ª parte. Da F7.4 (AT-18): a janela dos pedidos parecidos, que vem com 90 dias e é
// ajuste da TRÍADE (CF-09, PI-04), no bloco "Feito pela TRÍADE" da mesma página.

import { useState } from "react";
import { JANELAS_PARECIDOS } from "@triade/domain";
import { AvisoErro, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, ParteNumerada } from "./comum.tsx";
import { useParte, useVersao } from "./salvar.tsx";
import { AjusteTecnico } from "./tecnica.tsx";
import type { PropsAba } from "./Configuracoes.tsx";
import { naBase, useAmbiente } from "./contexto.tsx";

/** Janela dos pedidos parecidos (F7.4, AT-18): muda só as sugestões; o que já foi ligado não muda. Ajuste da TRÍADE (CF-09). */
export function Parecidos({ config, tecnica, recarregar, salvo, dias }: PropsAba & { dias: number }) {
  return (
    <AjusteTecnico id="parecidos" titulo="Pedidos parecidos" parte="Janela dos parecidos" mudanca="PARECIDOS" atual={String(dias)} tecnica={tecnica} recarregar={recarregar}
      opcoes={JANELAS_PARECIDOS.map((n) => ({ valor: String(n), texto: `${n} dias` }))}
      ajuda="Sugere como parecidos os pedidos da mesma categoria e do mesmo local desta janela para trás. O mesmo local vale pelo texto do campo Local, sem diferença de maiúscula e espaço (o local da etiqueta QR entra assim), ou pela mesma unidade. Muda só as sugestões; o que já foi ligado não muda."
      salvar={(v, motivo) => chamarApi(naBase("/regras-parecidos"), { metodo: "PUT", corpo: { versao: config.versao, dias: Number(v), motivo } })}
      aoSalvar={(v) => salvo(`Pedidos parecidos: o sistema sugere os dos últimos ${v} dias.`)} />
  );
}

/** Revisar e reabrir são decisão do condomínio (CF-03): no Console, só a situação. */
export function RegrasPedidos({ config, pode: podeEditar, recarregar, n }: PropsAba & { n: number }) {
  const { onde } = useAmbiente();
  const pode = podeEditar && onde === "app";
  const [revisao, setRevisao] = useState(config.regrasPedidos.revisao);
  const [reabertura, setReabertura] = useState(config.regrasPedidos.reabertura);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const versao = useVersao("config", config.versao);

  async function salvar(): Promise<string | null> {
    setErro(null);
    const r = await chamarApi(naBase("/regras-pedidos"), { metodo: "PUT", corpo: { versao: versao.atual(), revisao, reabertura } });
    if (!r.ok) { setErro(r.erro); return null; }
    versao.gravou(r.dados);
    return "Regras dos pedidos salvas.";
  }
  useParte("regras-pedidos", {
    nome: "Revisar e reabrir",
    mudancas: Number(revisao !== config.regrasPedidos.revisao) + Number(reabertura !== config.regrasPedidos.reabertura), salvar,
  });

  return (
    <ParteNumerada n={n} id="t-regras" titulo="Revisar e reabrir">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      {pode ? (
        <>
          <Caixa id="regra-revisao" rotulo="Revisar a conclusão antes de encerrar" marcada={revisao} aoMudar={setRevisao}
            ajuda="Quem não é síndico conclui e o síndico aprova ou devolve. O síndico que conclui já revisa." />
          <Caixa id="regra-reabertura" rotulo="Reabrir pedido encerrado" marcada={reabertura} aoMudar={setReabertura}
            ajuda="Com motivo, guardando a conclusão anterior. Desligado, quem voltar a reclamar ganha um pedido novo." />
        </>
      ) : (
        <ul className="grid gap-2 text-sm">
          <li>Revisar a conclusão antes de encerrar: {config.regrasPedidos.revisao ? "ligado" : "desligado"}</li>
          <li>Reabrir pedido encerrado: {config.regrasPedidos.reabertura ? "ligado" : "desligado"}</li>
        </ul>
      )}
    </ParteNumerada>
  );
}
