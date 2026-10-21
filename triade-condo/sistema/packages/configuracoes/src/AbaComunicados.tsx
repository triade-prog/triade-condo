"use client";
// Plano de comunicação (CD-11): os assuntos em uso e quem recebe cada um por padrão, o combinado
// com os moradores, a assinatura padrão e o horário sem envio. Abaixo, o mural online e o e-mail
// (CD-12 a CD-14).

import { useState, type FormEvent } from "react";
import { ASSUNTOS_COMUNICADO, type AssuntoComunicado } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, ErroCarregar, textoDoErro, type ErroApi } from "@triade/ui";
import { useCarregar, naBase } from "./contexto.tsx";
import type { PlanoComunicacao } from "./tipos.ts";
import type { PropsAba } from "./Configuracoes.tsx";
import { MuralEmail } from "./MuralEmail.tsx";

export function AbaComunicados({ salvo }: PropsAba) {
  const carga = useCarregar<PlanoComunicacao>(naBase("/plano-comunicacao"));
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o plano de comunicação…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  return (
    <div className="grid gap-6">
      <Formulario key={carga.dados.versao} p={carga.dados} recarregar={carga.recarregar} salvo={salvo} />
      <MuralEmail key={`me-${carga.dados.versao}`} p={carga.dados} recarregar={carga.recarregar} salvo={salvo} />
    </div>
  );
}

function Formulario({ p, recarregar, salvo }: { p: PlanoComunicacao; recarregar: () => void; salvo: (t: string) => void }) {
  const [v, setV] = useState({ assuntos: p.assuntos, plano: p.plano ?? "", assinatura: p.assinatura ?? "", silencioInicio: p.silencioInicio, silencioFim: p.silencioFim });
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(naBase("/plano-comunicacao"), { metodo: "PUT", corpo: { ...v, versao: p.versao, plano: v.plano || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    recarregar();
    salvo("Plano de comunicação salvo.");
  }

  return (
    <form onSubmit={salvar} noValidate className="grid content-start gap-4 lg:max-w-2xl">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-lg font-medium">Assuntos em uso</legend>
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
          {(Object.keys(ASSUNTOS_COMUNICADO) as AssuntoComunicado[]).map((a) => (
            <li key={a} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-violeta-600" disabled={!p.podeEditar} checked={v.assuntos.includes(a)}
                  onChange={() => setV({ ...v, assuntos: v.assuntos.includes(a) ? v.assuntos.filter((x) => x !== a) : [...v.assuntos, a] })} />
                <span className="font-medium">{ASSUNTOS_COMUNICADO[a]}</span>
              </label>
              <span className="text-tinta-suave">Quem recebe comunicados{a === "ASSEMBLEIA" ? " + proprietários" : ""}</span>
            </li>
          ))}
        </ul>
        {comErro.includes("assuntos") ? <span className="text-xs text-erro">Deixe pelo menos um assunto em uso.</span> : null}
        <p className="text-xs text-tinta-suave">Assembleia e convocação também chega ao proprietário que não recebe o dia a dia, como pede a convenção.</p>
      </fieldset>
      <CampoAreaTexto id="pc-plano" rotulo="O que o morador recebe e quando" opcional maxLength={2000} rows={4} disabled={!p.podeEditar}
        value={v.plano} onChange={(e) => setV({ ...v, plano: e.target.value })} erro={comErro.includes("plano") ? "Até 2000 caracteres." : null}
        ajuda="Fica à vista de quem escreve comunicados e, com o WhatsApp, vai para o morador que perguntar." />
      <CampoTexto id="pc-assinatura" rotulo="Assinatura padrão" required maxLength={120} disabled={!p.podeEditar}
        placeholder="Ana, síndica do Residencial Ipê" value={v.assinatura} onChange={(e) => setV({ ...v, assinatura: e.target.value })}
        erro={comErro.includes("assinatura") ? "De 2 a 120 caracteres." : null} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="pc-inicio" rotulo="Não enviar a partir de" type="time" disabled={!p.podeEditar} value={v.silencioInicio}
          onChange={(e) => setV({ ...v, silencioInicio: e.target.value })} erro={comErro.includes("silencioInicio") ? "Diga o horário." : null} />
        <CampoTexto id="pc-fim" rotulo="Até" type="time" disabled={!p.podeEditar} value={v.silencioFim}
          onChange={(e) => setV({ ...v, silencioFim: e.target.value })} erro={comErro.includes("silencioFim") ? "Diga o horário." : null}
          ajuda="Vale para o e-mail e, depois, para o WhatsApp. Programar nesse horário mostra um aviso." />
      </div>
      {p.podeEditar ? <Botao type="submit" className="justify-self-start" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</Botao> : null}
    </form>
  );
}
