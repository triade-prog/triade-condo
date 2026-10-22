"use client";
// Regras de aviso (passo 6; F6.2, AT-09): quando o retorno vence, o responsável é avisado na
// hora; o aviso sobe para o síndico e depois para o substituto, uma pessoa autorizada. Os
// outros avisos: pedido sem responsável e pendência parada. As horas são de atendimento.

import { useState } from "react";
import { REGRAS_AVISO_PADRAO } from "@triade/domain";
import { AvisoErro, CampoSelecao, CampoTexto, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import type { PropsAba } from "./Configuracoes.tsx";
import { naBase } from "./contexto.tsx";
import { ParteNumerada } from "./comum.tsx";
import { contarMudancas, useParte, useVersao } from "./salvar.tsx";

const LIMITES = { sindicoHoras: 240, substitutoHoras: 240, semResponsavelHoras: 240, pendenciaDias: 60 } as const;
type Campo = keyof typeof LIMITES;

export function RegrasAviso({ config, pode, recarregar, n: numeroParte }: PropsAba & { n: number }) {
  const a = config.avisos;
  const [v, setV] = useState<Record<Campo, string>>({
    sindicoHoras: String(a.sindicoHoras), substitutoHoras: String(a.substitutoHoras),
    semResponsavelHoras: String(a.semResponsavelHoras), pendenciaDias: String(a.pendenciaDias),
  });
  const [substituto, setSubstituto] = useState(a.substitutoId ?? "");
  const [erros, setErros] = useState<string[]>([]);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const versao = useVersao("config", config.versao);
  const nomeSubstituto = a.substitutosPossiveis.find((p) => p.vinculoId === a.substitutoId);

  async function salvar(): Promise<string | null> {
    setFalha(null);
    const n = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x.trim())])) as Record<Campo, number>;
    const ruins = (Object.keys(LIMITES) as Campo[]).filter((k) => !Number.isInteger(n[k]) || n[k] < 1 || n[k] > LIMITES[k]);
    if (!ruins.includes("substitutoHoras") && !ruins.includes("sindicoHoras") && n.substitutoHoras <= n.sindicoHoras) ruins.push("substitutoHoras");
    setErros(ruins);
    if (ruins.length) return null;
    const r = await chamarApi(naBase("/regras-aviso"), { metodo: "PUT", corpo: { versao: versao.atual(), ...n, substitutoId: substituto || null } });
    if (!r.ok) {
      const campos = r.erro.detalhes?.campos;
      if (Array.isArray(campos)) setErros(campos.map(String));
      setFalha(r.erro);
      return null;
    }
    versao.gravou(r.dados);
    return "Regras de aviso salvas.";
  }
  const iniciais = {
    sindicoHoras: String(a.sindicoHoras), substitutoHoras: String(a.substitutoHoras),
    semResponsavelHoras: String(a.semResponsavelHoras), pendenciaDias: String(a.pendenciaDias), substituto: a.substitutoId ?? "",
  };
  useParte("regras-aviso", { nome: "Quando o retorno vence", mudancas: contarMudancas(iniciais, { ...v, substituto }), salvar });

  const erroDe = (k: string, texto: string) => (erros.includes(k) ? texto : null);
  const numero = (k: Campo, rotulo: string, unidade: string, extra?: string) => (
    <CampoTexto id={`aviso-${k}`} rotulo={rotulo} inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}
      ajuda={`${unidade}, de 1 a ${LIMITES[k]}.${extra ? ` ${extra}` : ""}`}
      erro={erroDe(k, k === "substitutoHoras" && erros.includes(k) && Number(v.substitutoHoras) <= Number(v.sindicoHoras)
        ? "O substituto é avisado depois do síndico. Use mais horas." : `De 1 a ${LIMITES[k]}.`)} />
  );

  return (
    <ParteNumerada n={numeroParte} id="t-avisos" titulo="Quando o retorno vence">
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={recarregar} /> : null}
      {pode ? (
        <>
          <ol className="grid gap-4 md:grid-cols-2">
            <li className="grid content-start gap-1 md:col-span-2">
              <span className="text-[13px] font-medium">1. Avisar o responsável</span>
              <span className="text-sm">Na hora em que o retorno vence. Sem responsável, quem recebe é o síndico.</span>
            </li>
            <li>{numero("sindicoHoras", "2. Avisar o síndico depois de", "Horas de atendimento", `Sugestão: ${REGRAS_AVISO_PADRAO.sindicoHoras}.`)}</li>
            <li>{numero("substitutoHoras", "3. Avisar o substituto depois de", "Horas de atendimento", `Sugestão: ${REGRAS_AVISO_PADRAO.substitutoHoras}.`)}</li>
            <li className="md:col-span-2">
              <CampoSelecao id="aviso-substituto" rotulo="Substituto" value={substituto} onChange={(e) => setSubstituto(e.target.value)}
                opcoes={[{ valor: "", texto: "Ninguém: o aviso para no síndico" },
                  ...a.substitutosPossiveis.map((p) => ({ valor: p.vinculoId, texto: p.cargo ? `${p.nome} · ${p.cargo}` : p.nome }))]}
                ajuda={a.substitutosPossiveis.length ? "Uma das pessoas autorizadas. Em branco, o aviso para no síndico."
                  : "Ainda não há pessoa autorizada. Autorize alguém em Pessoas e acesso para escolher um substituto."}
                erro={erroDe("substitutoId", "Escolha uma pessoa autorizada.")} />
            </li>
          </ol>
          <h3 className="font-semibold">Outros avisos</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {numero("semResponsavelHoras", "Pedido sem responsável depois de", "Horas de atendimento", "Avisa o síndico.")}
            {numero("pendenciaDias", "Pendência parada depois de", "Dias", "Avisa quem cuida da pendência.")}
          </div>
          <p className="text-sm text-tinta-suave">As horas contam só o horário de atendimento e pulam feriados. Etapa que pausa o prazo também pausa o aviso. Ninguém recebe o mesmo aviso duas vezes.</p>
        </>
      ) : (
        <ul className="grid gap-2 text-sm">
          <li>Responsável: na hora</li>
          <li>Síndico: depois de {a.sindicoHoras} h de atendimento</li>
          <li>Substituto: {nomeSubstituto ? `${nomeSubstituto.nome}, depois de ${a.substitutoHoras} h de atendimento` : "ninguém; o aviso para no síndico"}</li>
          <li>Pedido sem responsável: depois de {a.semResponsavelHoras} h de atendimento</li>
          <li>Pendência parada: depois de {a.pendenciaDias} {a.pendenciaDias === 1 ? "dia" : "dias"}</li>
        </ul>
      )}
    </ParteNumerada>
  );
}
