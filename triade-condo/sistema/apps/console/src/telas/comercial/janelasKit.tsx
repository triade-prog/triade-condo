"use client";
// O kit pelos critérios do síndico (0307, quadros 322 e 337): os campos dos critérios e do problema
// do prédio (na ficha e no "Escolher critérios" do kit) e a janela do fato confirmado, em que a
// equipe registra, muda ou retira o que sabe do sistema atual ou de um concorrente num critério.
// A fonte fica só para a equipe; o link e o PDF levam só o texto (CM-12).

import { useState, type FormEvent } from "react";
import { CRITERIOS_SINDICO, type CriterioSindico } from "@triade/domain";
import { Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, type ErroApi } from "@triade/ui";
import { ErroJanela, RodapeJanela } from "../planos/comum.tsx";
import { ROTAS_PROPOSTAS, type FatoComparativo } from "./propostas.ts";

export interface EscolhaCriterios { criterios: CriterioSindico[]; criterioOutro: string; problema: string }

const LISTA = Object.entries(CRITERIOS_SINDICO) as [CriterioSindico, string][];

/** Hoje em Brasília, AAAA-MM-DD (a data da confirmação não pode passar dele). */
const hojeBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** A lista fechada dos critérios, o outro e o problema do prédio. */
export function CamposCriterios({ id, valor, aoMudar, campos = [] }: {
  id: string; valor: EscolhaCriterios; aoMudar: (v: EscolhaCriterios) => void; campos?: string[];
}) {
  const marcar = (c: CriterioSindico, sim: boolean) =>
    aoMudar({ ...valor, criterios: sim ? LISTA.map(([k]) => k).filter((k) => k === c || valor.criterios.includes(k)) : valor.criterios.filter((k) => k !== c) });
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-apoio font-medium">O que o síndico quer comparar</legend>
        <div className="flex flex-wrap gap-2">
          {LISTA.map(([c, texto]) => (
            <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-linha px-4 has-checked:border-violeta-600 has-checked:bg-violeta-50 has-checked:font-semibold has-checked:text-violeta-700">
              <input type="checkbox" className="sr-only" checked={valor.criterios.includes(c)} onChange={(e) => marcar(c, e.target.checked)} />
              {valor.criterios.includes(c) ? <Icone nome="check" className="h-4 w-4" /> : null}
              {texto}
            </label>
          ))}
        </div>
        {campos.includes("criterios") ? <span className="t-apoio text-erro">Escolha os critérios da lista.</span> : null}
      </fieldset>
      {valor.criterios.includes("OUTRO") ? (
        <CampoTexto id={`${id}-outro`} rotulo="Qual é o outro critério" maxLength={120} value={valor.criterioOutro}
          onChange={(e) => aoMudar({ ...valor, criterioOutro: e.target.value })} erro={campos.includes("criterioOutro") ? "Diga qual é o outro critério." : undefined} />
      ) : null}
      <CampoAreaTexto id={`${id}-problema`} rotulo="O problema do prédio" opcional maxLength={300} value={valor.problema}
        onChange={(e) => aoMudar({ ...valor, problema: e.target.value })} placeholder="Portaria sem registro e vazamentos que se repetem"
        ajuda="Em texto curto, como o síndico contou. Abre a apresentação do kit." erro={campos.includes("problema") ? "Até 300 letras." : undefined} />
    </div>
  );
}

/** "Escolher critérios" do kit (quadro 337): grava na ficha do prédio do interessado. */
export function JanelaCriterios({ interessado, inicial, aoFechar, feito }: {
  interessado: { id: string; versao: number }; inicial: EscolhaCriterios; aoFechar: () => void; feito: () => void;
}) {
  const [valor, setValor] = useState(inicial);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (valor.criterios.includes("OUTRO") && !valor.criterioOutro.trim()) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["criterioOutro"] } });
    setEnviando(true);
    const r = await chamarApi(ROTAS_PROPOSTAS.criterios(interessado.id), {
      metodo: "PUT",
      corpo: { versao: interessado.versao, criterios: valor.criterios, criterioOutro: valor.criterioOutro.trim() || null, problema: valor.problema.trim() || null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito();
  }

  return (
    <Dialogo aberto titulo="Escolher critérios" aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-5" noValidate>
        <p className="t-apoio">Os critérios que o síndico marcou na visita viram as linhas do comparativo. Fica gravado na ficha do prédio.</p>
        <CamposCriterios id="kit-criterios" valor={valor} aoMudar={setValor} campos={camposComErro(erro)} />
        {erro && !camposComErro(erro).length ? <ErroJanela erro={erro} /> : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando} texto="Salvar os critérios" />
      </form>
    </Dialogo>
  );
}

/**
 * O fato confirmado de um sistema num critério (0307). Vale para todo prédio que tem o mesmo
 * sistema; no critério "outro", só para este prédio. Retirar volta a célula para "a confirmar".
 */
export function JanelaFato({ sistema, criterio, nomeCriterio, interessadoId, fato, aoFechar, feito }: {
  sistema: string; criterio: CriterioSindico; nomeCriterio: string; interessadoId: string; fato?: FatoComparativo; aoFechar: () => void; feito: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(fato?.texto ?? "");
  const [fonte, setFonte] = useState(fato?.fonte ?? "");
  const [confirmadoEm, setConfirmadoEm] = useState(fato?.confirmadoEm ?? hojeBrasilia());
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState<"salvar" | "retirar" | null>(null);
  const campos = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const faltam = [...(texto.trim().length < 2 ? ["texto"] : []), ...(fonte.trim().length < 3 ? ["fonte"] : [])];
    if (faltam.length) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: faltam } });
    setEnviando("salvar");
    const corpo = { texto: texto.trim(), fonte: fonte.trim(), confirmadoEm: confirmadoEm || null };
    const r = fato
      ? await chamarApi(ROTAS_PROPOSTAS.fatos(fato.id), { metodo: "PUT", corpo: { ...corpo, versao: fato.versao } })
      : await chamarApi(ROTAS_PROPOSTAS.fatos(), { corpo: { ...corpo, sistema, criterio, interessadoId: criterio === "OUTRO" ? interessadoId : null } });
    setEnviando(null);
    if (!r.ok) return setErro(r.erro);
    feito(`Fato de ${sistema} salvo no comparativo.`);
  }

  async function retirar() {
    if (!fato) return;
    setErro(null);
    setEnviando("retirar");
    const r = await chamarApi(ROTAS_PROPOSTAS.retirarFato(fato.id), { corpo: { versao: fato.versao } });
    setEnviando(null);
    if (!r.ok) return setErro(r.erro);
    feito(`Fato de ${sistema} retirado: a célula volta a ficar a confirmar.`);
  }

  return (
    <Dialogo aberto titulo={fato ? "Mudar o fato confirmado" : "Registrar o fato confirmado"} aoFechar={aoFechar} media>
      <form onSubmit={salvar} className="grid gap-4" noValidate>
        <dl className="grid gap-1 t-texto">
          <div className="flex flex-wrap gap-x-2"><dt className="text-tinta-suave">Sistema</dt><dd className="font-medium">{sistema}</dd></div>
          <div className="flex flex-wrap gap-x-2"><dt className="text-tinta-suave">Critério</dt><dd className="font-medium">{nomeCriterio}</dd></div>
        </dl>
        <CampoTexto id="fato-texto" rotulo="O que a equipe confirmou" maxLength={200} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Só junto com o contrato da administradora" ajuda="Vai assim para o kit e o link. Só fatos: nada de retorno prometido."
          erro={campos.includes("texto") ? "Escreva o fato, com 2 letras ou mais." : undefined} />
        <CampoTexto id="fato-fonte" rotulo="Onde confirmou" maxLength={200} value={fonte} onChange={(e) => setFonte(e.target.value)}
          placeholder="Site deles, contrato que o síndico mostrou" ajuda="Só a equipe vê." erro={campos.includes("fonte") ? "Diga onde confirmou." : undefined} />
        <CampoTexto id="fato-data" rotulo="Confirmado em" type="date" max={hojeBrasilia()} value={confirmadoEm} onChange={(e) => setConfirmadoEm(e.target.value)}
          erro={campos.includes("confirmadoEm") ? "A data não pode ser futura." : undefined} />
        <p className="t-apoio">{criterio === "OUTRO" ? "Este critério é só deste prédio: o fato fica só aqui." : `Vale para todo prédio que tem ${sistema} na ficha.`}</p>
        {erro && !campos.length ? <ErroJanela erro={erro} /> : null}
        {fato ? (
          <Botao variante="discreto" className="justify-self-start" disabled={!!enviando} onClick={() => void retirar()}>
            <Icone nome="fechar" />{enviando === "retirar" ? "Retirando…" : "Retirar o fato"}
          </Botao>
        ) : null}
        <RodapeJanela aoFechar={aoFechar} enviando={enviando === "salvar"} texto={fato ? "Salvar o fato" : "Registrar o fato"} />
      </form>
    </Dialogo>
  );
}
