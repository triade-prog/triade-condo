"use client";
// A decisão dentro do pedido (F7.4; design "Reincidência e decisões", tela 2; AT-23, AT-11): pedir
// a decisão ao síndico com as alternativas, o prazo e por quê; a faixa enquanto espera; ver,
// responder ou retirar; e as já respondidas. Depois de enviado, o pedido de decisão não muda.

import { useState, type FormEvent } from "react";
import { lerReais } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import type { DecisaoPedido, PedidoDetalhe } from "../tipos.ts";
import { diaDe, diaHora } from "../pedidos/comum.tsx";
import { diaDoPrazo, ListaAlternativas, ResponderDecisao, resumoResposta, RetirarDecisao, SeloDecisao } from "./comum.tsx";

const qtdAlternativas = (n: number) => (n === 1 ? "1 alternativa" : `${n} alternativas`);

interface Props {
  d: PedidoDetalhe;
  salvo: (texto: string) => void;
  recarregar: () => void;
}

/** Faixa de cada decisão que espera resposta, com Ver; e as respondidas, recolhidas. */
export function DecisoesNoPedido({ d, salvo, recarregar }: Props) {
  const [ver, setVer] = useState<DecisaoPedido | null>(null);
  const [responder, setResponder] = useState<DecisaoPedido | null>(null);
  const [retirar, setRetirar] = useState<DecisaoPedido | null>(null);
  const decisoes = d.decisoes ?? [];
  if (!decisoes.length) return null;
  const hoje = diaDe(d.agora);
  const aguardando = decisoes.filter((x) => x.estado === "AGUARDANDO");
  const fechadas = decisoes.filter((x) => x.estado !== "AGUARDANDO");
  const fechar = () => { setVer(null); setResponder(null); setRetirar(null); };
  const pronto = (t: string) => { fechar(); salvo(t); };

  return (
    <>
      {aguardando.map((x) => (
        <div key={x.id} role="status" data-tom={x.vencida ? "erro" : "atencao"} className="aviso flex-wrap items-center justify-between">
          <span className="quadro"><Icone nome="decisao" /></span>
          <span className="texto">
            <strong className="block font-semibold">
              {x.decisor.eu ? "Esperando a sua decisão" : `Esperando a decisão de ${x.decisor.nome}`} até {diaDoPrazo(x.prazo)}{x.vencida ? " (prazo vencido)" : ""}
            </strong>
            <span className="block">{x.pergunta} · {qtdAlternativas(x.alternativas.length)} · pedida{x.pedidaPor ? ` por ${x.pedidaPor}` : ""} em {diaHora(x.pedidaEm)}</span>
          </span>
          <span className="flex flex-wrap gap-2">
            {x.pode.responder ? <Botao variante="secundario" tamanho="m" onClick={() => setResponder(x)}>Decidir</Botao> : null}
            <Botao variante="contorno" tamanho="m" aria-label={`Ver a decisão: ${x.pergunta}`} onClick={() => setVer(x)}>Ver</Botao>
          </span>
        </div>
      ))}
      {fechadas.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-violeta-600">{fechadas.length === 1 ? "1 decisão respondida ou retirada" : `${fechadas.length} decisões respondidas ou retiradas`}</summary>
          <ul className="mt-2 grid gap-2">
            {fechadas.map((x) => (
              <li key={x.id} className="grid gap-1 rounded-2xl border border-linha bg-superficie p-3">
                <span className="flex flex-wrap items-center gap-2"><SeloDecisao d={x} hoje={hoje} /><span className="font-medium">{x.pergunta}</span></span>
                <span className="text-xs text-tinta-suave">{resumoResposta(x)}</span>
                <Botao variante="discreto" tamanho="m" className="justify-self-start" aria-label={`Ver a decisão: ${x.pergunta}`} onClick={() => setVer(x)}>Ver</Botao>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialogo aberto={ver !== null} titulo="Decisão pedida" aoFechar={() => setVer(null)}>
        {ver ? (
          <div className="grid gap-3">
            <p className="flex flex-wrap items-center gap-2 text-sm"><SeloDecisao d={ver} hoje={hoje} /><span className="text-tinta-suave">quem decide: {ver.decisor.nome}</span></p>
            <p className="text-sm font-medium">{ver.pergunta}</p>
            {ver.porque ? <p className="text-sm">Por que agora: {ver.porque}</p> : null}
            <ListaAlternativas alternativas={ver.alternativas} aprovada={ver.alternativaAprovada} />
            <p className="text-xs text-tinta-suave">Pedida{ver.pedidaPor ? ` por ${ver.pedidaPor}` : ""} em {diaHora(ver.pedidaEm)} · decidir até {diaDoPrazo(ver.prazo)}</p>
            {resumoResposta(ver) ? <p className="text-sm">{resumoResposta(ver)}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="discreto" onClick={() => setVer(null)}>Fechar</Botao>
              {ver.pode.retirar ? <Botao variante="contorno" onClick={() => { setRetirar(ver); setVer(null); }}>Retirar</Botao> : null}
              {ver.pode.responder ? <Botao onClick={() => { setResponder(ver); setVer(null); }}>Decidir</Botao> : null}
            </div>
          </div>
        ) : null}
      </Dialogo>
      <ResponderDecisao d={responder} aoFechar={() => setResponder(null)} salvo={pronto} recarregar={recarregar} />
      <RetirarDecisao d={retirar} aoFechar={() => setRetirar(null)} salvo={pronto} recarregar={recarregar} />
    </>
  );
}

interface AlternativaEscrita { descricao: string; custo: string; detalhe: string }
const vazia = (): AlternativaEscrita => ({ descricao: "", custo: "", detalhe: "" });

function somarDias(data: string, n: number): string {
  const t = Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Pedir decisão ao síndico (decisões 5 a 8): abre a pendência Decisão para quem decide. */
function FormPedir({ d, aoFechar, salvo, recarregar }: { d: PedidoDetalhe; aoFechar: () => void; salvo: (t: string) => void; recarregar: () => void }) {
  const p = d.pedido;
  const decisores = d.decisores ?? [];
  const hoje = diaDe(d.agora);
  const [pergunta, setPergunta] = useState("");
  const [alternativas, setAlternativas] = useState<AlternativaEscrita[]>([vazia()]);
  const [prazo, setPrazo] = useState(somarDias(hoje, 3));
  const [decisor, setDecisor] = useState(decisores[0]?.vinculoId ?? "");
  const [porque, setPorque] = useState("");
  const [custoErrado, setCustoErrado] = useState<number[]>([]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const mudar = (i: number, campo: keyof AlternativaEscrita, v: string) =>
    setAlternativas((l) => l.map((a, j) => (j === i ? { ...a, [campo]: v } : a)));

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const errados: number[] = [];
    const lidas = alternativas.map((a, i) => {
      let custo: number | null = null;
      if (a.custo.trim()) {
        try {
          custo = lerReais(a.custo).centavos;
          if (custo < 0) errados.push(i);
        } catch { errados.push(i); }
      }
      return { descricao: a.descricao.trim(), detalhe: a.detalhe.trim() || null, custo };
    });
    setCustoErrado(errados);
    if (errados.length) return;
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/pedidos/${p.id}/decisoes`, {
      corpo: { versao: p.versao, pergunta: pergunta.trim(), porque: porque.trim() || null, prazo, decisorId: decisor, alternativas: lidas },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const quem = decisores.find((x) => x.vinculoId === decisor);
    salvo(quem?.eu ? "Decisão registrada para você responder. O pedido ganhou a pendência Decisão."
      : `Decisão pedida a ${quem?.nome ?? "quem decide"}, com aviso no sino. O pedido ganhou a pendência Decisão.`);
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <p className="text-sm text-tinta-suave">Pedido {p.protocolo} · {p.assunto}</p>
      <CampoAreaTexto id="dec-pergunta" rotulo="O que precisa ser decidido" required maxLength={500} rows={3} value={pergunta}
        onChange={(e) => setPergunta(e.target.value)} erro={comErro.includes("pergunta") ? "Diga o que precisa ser decidido (3 a 500 caracteres)." : null} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Alternativas <span className="text-tinta-suave">(de 1 a 5)</span></legend>
        {comErro.includes("alternativas") ? <p className="text-sm text-erro">Confira as alternativas: descrição de 3 a 200 caracteres e custo em reais.</p> : null}
        {alternativas.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-linha p-3">
            <CampoTexto id={`dec-alt-${i}`} rotulo={`Alternativa ${i + 1}`} required maxLength={200} value={a.descricao}
              onChange={(e) => mudar(i, "descricao", e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <CampoTexto id={`dec-custo-${i}`} rotulo="Custo estimado" opcional inputMode="decimal" maxLength={20} value={a.custo}
                onChange={(e) => mudar(i, "custo", e.target.value)} ajuda="Em reais, como 2.400,00."
                erro={custoErrado.includes(i) ? "Escreva o valor em reais, como 2.400,00." : null} />
              <CampoTexto id={`dec-detalhe-${i}`} rotulo="Detalhe" opcional maxLength={200} value={a.detalhe}
                onChange={(e) => mudar(i, "detalhe", e.target.value)} ajuda="Quem faz, em quanto tempo, o que muda." />
            </div>
            {alternativas.length > 1 ? (
              <Botao variante="discreto" tamanho="m" className="justify-self-start" aria-label={`Tirar a alternativa ${i + 1}`}
                onClick={() => setAlternativas((l) => l.filter((_, j) => j !== i))}>Tirar</Botao>
            ) : null}
          </div>
        ))}
        {alternativas.length < 5 ? (
          <Botao variante="discreto" tamanho="m" className="justify-self-start" onClick={() => setAlternativas((l) => [...l, vazia()])}>+ Alternativa</Botao>
        ) : null}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="dec-prazo" rotulo="Decidir até" required type="date" min={hoje} max={somarDias(hoje, 90)} value={prazo}
          onChange={(e) => setPrazo(e.target.value)} erro={comErro.includes("prazo") ? "O prazo vai de hoje a 90 dias." : null} />
        <CampoSelecao id="dec-decisor" rotulo="Quem decide" value={decisor} onChange={(e) => setDecisor(e.target.value)}
          opcoes={decisores.map((x) => ({ valor: x.vinculoId, texto: x.sindico ? `${x.nome} (síndico)` : x.nome }))}
          erro={comErro.includes("decisorId") ? "Escolha o síndico ou quem tem a permissão Aprovar." : null} />
      </div>
      <CampoAreaTexto id="dec-porque" rotulo="Por que agora" opcional maxLength={500} rows={2} value={porque}
        onChange={(e) => setPorque(e.target.value)} erro={comErro.includes("porque") ? "De 3 a 500 caracteres." : null} />
      <p className="text-xs text-tinta-suave">Os orçamentos ficam nos arquivos do pedido. Aprovar não contrata nem paga nada: a contratação continua como o condomínio já faz.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Pedir decisão"}</Botao>
      </div>
    </form>
  );
}

export function PedirDecisao({ aberto, d, aoFechar, salvo, recarregar }: Props & { aberto: boolean; aoFechar: () => void }) {
  return (
    <Dialogo aberto={aberto} titulo="Pedir decisão ao síndico" aoFechar={aoFechar}>
      {aberto ? (
        (d.decisores ?? []).length
          ? <FormPedir d={d} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} />
          : <><Aviso tom="atencao">Ninguém pode decidir agora: o síndico não tem acesso e ninguém tem a permissão Aprovar.</Aviso>
            <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div></>
      ) : null}
    </Dialogo>
  );
}

/** "resolve sozinha quando Ana Souza responder", para a pendência que nasceu da decisão. */
export function pendenciaDaDecisao(d: PedidoDetalhe, pendenciaId: string): string | null {
  const x = (d.decisoes ?? []).find((y) => y.pendenciaId === pendenciaId && y.estado === "AGUARDANDO");
  return x ? `resolve sozinha quando ${x.decisor.eu ? "você" : x.decisor.nome} responder` : null;
}

