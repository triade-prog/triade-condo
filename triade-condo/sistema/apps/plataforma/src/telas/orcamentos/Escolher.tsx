"use client";
// Escolher a proposta (R8, OC-04; quadro 481): a proposta escolhida, o aviso quando não é a de
// menor total, o motivo (obrigatório quando não é a mais barata ou quando decide abaixo do mínimo)
// e quem aprova: o conselho, como despesa para aprovar em Decisões, ou o síndico. Aprovar não é
// contratar nem pagar.

import { useState, type FormEvent } from "react";
import { avisoNaoMaisBarata, mostrarTotal, motivoObrigatorio } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { Escolha as EscolhaCartao } from "../decisoes/Despesas.tsx";
import { faixaPorExtenso, NOTA_DECIDIR, reais, textoValidade } from "./comum.tsx";
import { usePlataforma } from "../sessao.tsx";
import type { LinkMandado } from "../tipos.ts";
import type { Comparacao, OpcoesOrcamento, Orcamento, PropostaComparada } from "./tipos.ts";

export function EscolherProposta({ o, c, p, opcoes, aoFechar, escolhida }: {
  o: Orcamento; c: Comparacao; p: PropostaComparada | null; opcoes: OpcoesOrcamento | null;
  aoFechar: () => void; escolhida: (texto: string, despesaId: string | null, links: LinkMandado[]) => void;
}) {
  return (
    <Dialogo aberto={p !== null} titulo="Escolher a proposta" aoFechar={aoFechar} media apoio={`${o.titulo} · ${c.propostas.length === 1 ? "1 proposta comparada" : `${c.propostas.length} propostas comparadas`}`}>
      {p ? <Formulario key={p.id} o={o} c={c} p={p} opcoes={opcoes} aoFechar={aoFechar} escolhida={escolhida} /> : null}
    </Dialogo>
  );
}

function Formulario({ o, c, p, opcoes, aoFechar, escolhida }: {
  o: Orcamento; c: Comparacao; p: PropostaComparada; opcoes: OpcoesOrcamento | null;
  aoFechar: () => void; escolhida: (texto: string, despesaId: string | null, links: LinkMandado[]) => void;
}) {
  const { painel } = usePlataforma();
  const conselho = c.conselho ?? opcoes?.conselho ?? null;
  const eu = opcoes?.quem ? `${opcoes.quem.nome}, ${opcoes.quem.cargo.toLowerCase()}` : painel.pessoa.nome;
  // Na faixa em que a regra pede o conselho, só o conselho aprova; a alçada sozinha só avisa (passaAlcada).
  const faixaPedeConselho = c.regra?.ligada && c.regra.faixa?.quemAprova === "CONSELHO";
  const menor = c.propostas.find((x) => x.conviteId === c.menorTotal) ?? p;
  const aviso = avisoNaoMaisBarata(p.total, { nome: menor.nome, total: menor.total });
  const obrigatorio = motivoObrigatorio({ escolhidaTotal: p.total, menorTotal: menor.total, minimoAtendido: c.minimo.atendido });
  const bloqueia = !c.minimo.atendido && (c.minimo.abaixoMinimo ?? opcoes?.regras.abaixoMinimo) === "BLOQUEIA";
  const alcada = c.alcadaConselho;
  const passaAlcada = alcada !== null && p.total > alcada;
  const conselhoPode = !!conselho?.podePedir;
  const [motivo, setMotivo] = useState("");
  const [quem, setQuem] = useState<"CONSELHO" | "PESSOA">(conselhoPode && (passaAlcada || faixaPedeConselho) ? "CONSELHO" : "PESSOA");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [curto, setCurto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (obrigatorio && motivo.trim().length < 20) { setCurto(true); return; }
    setCurto(false);
    setEnviando(true);
    const r = await chamarApi<{ estado: string; versao: number; despesaId?: string | null; passaAlcada: boolean; links?: LinkMandado[] }>(`/v1/condominio/orcamentos/${o.id}/escolher`, {
      corpo: { versao: c.orcamento?.versao ?? o.versao, propostaId: p.id, motivo: motivo.trim() || null, quemAprova: quem },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    escolhida(quem === "CONSELHO"
      ? `Proposta de ${p.nome} mandada ao conselho como despesa para aprovar. O fornecedor é avisado no link depois do sim.`
      : `Proposta de ${p.nome} escolhida. O fornecedor confirma pelo link; depois você registra a compra.`, r.dados.despesaId ?? null, r.dados.links ?? []);
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !comErro.includes("motivo") ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid gap-1 rounded-[14px] border-2 border-violeta-600 bg-violeta-50 p-4">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="t-texto font-medium">{p.letra} · {p.nome}</span>
          <span className="t-codigo">{reais(p.total)}</span>
        </span>
        <span className="t-apoio">{[p.garantia ? `garantia ${p.garantia}` : null, p.prazoExecucao, textoValidade(p)].filter(Boolean).join(" · ")}</span>
      </div>
      {aviso ? <Aviso tom="atencao">{aviso}</Aviso> : null}
      {!c.minimo.atendido ? (
        <Aviso tom={bloqueia ? "erro" : "atencao"}>
          {`Chegaram ${c.minimo.recebidas === 1 ? "1 proposta" : `${c.minimo.recebidas} propostas`}; a regra pede ${c.minimo.pedido}${faixaPorExtenso(c.regra ?? o.regra)}.`}
          {bloqueia ? " A regra do condomínio não deixa decidir com menos: estenda o prazo ou convide mais." : " Pode decidir assim mesmo, escrevendo o motivo."}
        </Aviso>
      ) : null}
      <CampoAreaTexto id="escolher-motivo" rotulo="Por que esta proposta" rows={3} maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setCurto(false); }}
        opcional={!obrigatorio} required={obrigatorio} ajuda="Obrigatório quando não é a mais barata (mínimo 20 letras)"
        erro={curto || comErro.includes("motivo") ? "Escreva o motivo da escolha, com pelo menos 20 letras." : null} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-apoio font-medium">Quem aprova</legend>
        {conselhoPode ? (
          <EscolhaCartao nome="escolher-quem" valor="CONSELHO" atual={quem} mudar={(v) => setQuem(v as "CONSELHO")} texto="O conselho"
            sub={`${passaAlcada && alcada !== null ? `Passa da alçada de ${mostrarTotal(alcada, false)}. ` : ""}Vira uma despesa para aprovar em Decisões, com ${c.propostas.length === 1 ? "a proposta" : `as ${c.propostas.length} propostas`} e a planilha`} />
        ) : null}
        {faixaPedeConselho ? (
          <label className="flex items-start gap-3 rounded-[14px] border border-linha bg-superficie-2 p-4 t-texto text-tinta-suave">
            <input type="radio" name="escolher-quem" value="PESSOA" disabled className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
            <span className="grid gap-0.5"><span className="font-medium">{eu}</span><span className="t-apoio">{`A regra do condomínio pede o conselho${faixaPorExtenso(c.regra ?? o.regra)}`}</span></span>
          </label>
        ) : (
          <EscolhaCartao nome="escolher-quem" valor="PESSOA" atual={quem} mudar={(v) => setQuem(v as "PESSOA")} texto={eu}
            sub={conselhoPode ? "Escolha sem o conselho: a alçada só avisa, não bloqueia" : "Não há conselho com mandato em dia para pedir; a alçada só avisa"} />
        )}
      </fieldset>
      <p className="t-apoio">{NOTA_DECIDIR}</p>
      <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
        <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando || bloqueia}><Icone nome={quem === "CONSELHO" ? "enviar" : "check"} />{enviando ? "Enviando…" : quem === "CONSELHO" ? "Mandar para o conselho" : "Escolher esta proposta"}</Botao>
      </div>
    </form>
  );
}
