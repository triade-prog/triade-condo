"use client";
// Pedido novo (F6.4, AT-26; desenho "Aviso de pedido registrado", tela 7): quando o síndico fica
// sabendo e se o protocolo vai para quem pediu. O responsável é sempre avisado. Só o síndico
// muda; quem só vê lê a regra. O aviso no WhatsApp de cada pessoa continua em WhatsApp.

import { useState } from "react";
import { AVISO_NOVO_SINDICO, type AvisoNovoSindico } from "@triade/domain";
import { AvisoErro, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { PropsAba } from "./Configuracoes.tsx";
import { naBase } from "./contexto.tsx";
import { ParteNumerada } from "./comum.tsx";
import { useParte, useVersao } from "./salvar.tsx";

export function AvisoPedidoNovo({ config, recarregar, n }: PropsAba & { n: number }) {
  const a = config.avisoNovo;
  const [sindico, setSindico] = useState<AvisoNovoSindico>(a.sindico);
  const [protocolo, setProtocolo] = useState(a.protocolo);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const versao = useVersao("config", config.versao);

  async function salvar(): Promise<string | null> {
    setFalha(null);
    const r = await chamarApi(naBase("/regras-aviso-novo"), { metodo: "PUT", corpo: { versao: versao.atual(), sindico, protocolo } });
    if (!r.ok) { setFalha(r.erro); return null; }
    versao.gravou(r.dados);
    return "Regra de pedido novo salva.";
  }
  useParte("aviso-novo", { nome: "Pedido novo", mudancas: Number(sindico !== a.sindico) + Number(protocolo !== a.protocolo), salvar });

  return (
    <ParteNumerada n={n} id="t-pedido-novo" titulo="Pedido novo">
      <p className="text-sm text-tinta-suave">O responsável fica sabendo sempre, menos quando foi ele quem registrou. Sem responsável, ficam sabendo os que cuidam dos pedidos.</p>
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={recarregar} /> : null}
      {a.podeMudar ? (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-medium">Avisar o síndico</legend>
            <div role="radiogroup" aria-label="Avisar o síndico" className="trilho justify-self-start">
              {(Object.entries(AVISO_NOVO_SINDICO) as [AvisoNovoSindico, string][]).map(([k, t]) => (
                <button key={k} type="button" role="radio" aria-checked={sindico === k} className="chip" data-escolhido={sindico === k ? "" : undefined} onClick={() => setSindico(k)}>{t}</button>
              ))}
            </div>
            <span className="text-xs text-tinta-suave">“Urgente” é a prioridade de nível mais alto do condomínio. Sem responsável continua avisando também depois, pela regra de escalonamento. Quem registra pode avisar a mais em cada pedido.</span>
          </fieldset>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-violeta-600" checked={protocolo} onChange={(e) => setProtocolo(e.target.checked)} />
            <span>
              Mandar o protocolo para quem pediu
              <span className="block text-xs text-tinta-suave">Ligado, a linha Quem pediu já vem marcada. Pelo WhatsApp do condomínio quando o número está conectado; senão, por e-mail confirmado. Quem registra pode desmarcar em cada pedido.</span>
            </span>
          </label>
        </>
      ) : (
        <ul className="grid gap-2 text-sm">
          <li>Avisar o síndico: {AVISO_NOVO_SINDICO[a.sindico].toLowerCase()}</li>
          <li>Protocolo para quem pediu: {a.protocolo ? "ligado" : "desligado"}</li>
          <li className="text-tinta-suave">Só o síndico muda esta regra.</li>
        </ul>
      )}
    </ParteNumerada>
  );
}
