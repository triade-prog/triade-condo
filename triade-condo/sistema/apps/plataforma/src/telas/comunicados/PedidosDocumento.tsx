"use client";
// Pedidos de documento pelo mural (design "Mural online e e-mail", tela 7; CD-14): quem pediu,
// qual documento e a situação. Contato confirmado recebe na hora (se o síndico deixou assim);
// e-mail que não é de contato espera aqui. Recusar pede motivo e não manda nada a quem pediu.

import { useState } from "react";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi, type Tom } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { PedidoDocumento, PedidosDocumento as Lista } from "../tipos.ts";

const SITUACAO: Record<PedidoDocumento["estado"], { texto: string; tom: Tom }> = {
  ESPERANDO: { texto: "Esperando você", tom: "atencao" },
  ENVIADO: { texto: "Enviado", tom: "ok" },
  RECUSADO: { texto: "Recusado", tom: "neutro" },
};

export function PedidosDocumento({ aoMudar }: { aoMudar: () => void }) {
  const { atualizar } = usePlataforma();
  const lista = useCarregar<Lista>("/v1/condominio/documentos/pedidos");
  const [recusar, setRecusar] = useState<PedidoDocumento | null>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  async function enviar(p: PedidoDocumento) {
    setFalha(null);
    setEnviando(p.id);
    const r = await chamarApi(`/v1/condominio/documentos/pedidos/${p.id}/decidir`, { corpo: { enviar: true } });
    setEnviando(null);
    if (!r.ok) return setFalha(r.erro);
    setRecado(`${p.titulo} enviado por e-mail. O link vale 7 dias.`);
    lista.recarregar();
    aoMudar();
    atualizar();
  }

  if (lista.estado === "carregando") return <Carregando rotulo="Carregando os pedidos…" />;
  if (lista.estado === "erro") return <ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} />;
  const d = lista.dados;
  return (
    <section aria-labelledby="t-pedidos" className="grid gap-3">
      <h2 id="t-pedidos" className="sr-only">Pedidos de documento por e-mail</h2>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={() => { setFalha(null); lista.recarregar(); }} /> : null}
      {d.itens.length === 0 ? (
        <Vazio titulo="Nenhum pedido ainda">Quando alguém pedir um documento pelo mural online, o pedido aparece aqui.</Vazio>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-linha bg-superficie shadow-s1">
          {d.itens.map((p) => (
            <li key={p.id} className="grid gap-1.5 border-b border-linha px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center md:gap-4">
              <span className="grid gap-0.5">
                <span className="font-medium">{p.titulo}</span>
                <span className="text-[13px] text-tinta-suave">{diaHora(p.criadoEm)} · pelo mural</span>
              </span>
              <span className="grid gap-0.5 text-sm [overflow-wrap:anywhere]">
                {p.contato ? <span>{p.contato.nome}{p.contato.unidades ? ` · ${p.contato.unidades}` : ""}</span> : <span>{p.email ?? "E-mail"}</span>}
                <span className="text-[13px] text-tinta-suave">{p.contato ? "Contato do prédio" : "Não é contato do prédio"}</span>
              </span>
              <span className="grid gap-0.5 text-sm">
                <Selo tom={SITUACAO[p.estado].tom}>{p.estado === "ENVIADO" && p.automatico ? "Enviado na hora" : SITUACAO[p.estado].texto}</Selo>
                {p.motivo ? <span className="text-[13px] text-tinta-suave">{p.motivo}</span> : null}
                {p.abertoEm ? <span className="text-[13px] text-tinta-suave">Aberto {diaHora(p.abertoEm)}</span> : null}
              </span>
              {p.estado === "ESPERANDO" && d.podeDecidir ? (
                <span className="flex flex-wrap gap-2">
                  <Botao tamanho="m" disabled={enviando !== null} onClick={() => void enviar(p)} aria-label={`Enviar ${p.titulo} para ${p.contato?.nome ?? p.email ?? "quem pediu"}`}>
                    {enviando === p.id ? "Enviando…" : "Enviar"}
                  </Botao>
                  <Botao tamanho="m" variante="contorno" onClick={() => setRecusar(p)} aria-label={`Recusar o pedido de ${p.titulo}`}>Recusar</Botao>
                </span>
              ) : <span />}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-tinta-suave">Recusar pede motivo e não manda nada a quem pediu. O pedido de quem não é contato do prédio avisa no sino de quem cuida dos documentos.</p>
      <Janela aberto={recusar !== null} titulo="Recusar pedido" textoBotao="Recusar" aoFechar={() => setRecusar(null)}
        explicacao="Quem pediu não recebe nada. O motivo fica no histórico do documento."
        campos={[{ id: "motivo", rotulo: "Por que recusar", tipo: "area", obrigatorio: true, max: 500, erro: "Diga o motivo, de 3 a 500 caracteres." }]}
        iniciais={{ motivo: "" }}
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/documentos/pedidos/${recusar?.id}/decidir`, { corpo: { enviar: false, motivo: v.motivo } });
          if (r.ok) { setRecusar(null); setRecado("Pedido recusado."); lista.recarregar(); aoMudar(); atualizar(); }
          return r;
        }} />
    </section>
  );
}
