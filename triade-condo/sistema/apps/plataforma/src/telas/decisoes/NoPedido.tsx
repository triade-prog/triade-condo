"use client";
// A decisão dentro do pedido (F7.4; design "Reincidência e decisões", tela 2; AT-23, AT-11): pedir
// a decisão ao síndico com as alternativas, o prazo e por quê; a faixa enquanto espera; ver,
// responder ou retirar; e as já respondidas. Depois de enviado, o pedido de decisão não muda.
// R5 (V-14; quadro 413): "O conselho" em Quem decide, com o quórum; os links que o WhatsApp ainda
// não manda aparecem para copiar.

import { useState, type FormEvent } from "react";
import { lerReais, mostrarCusto, textoQuemVotaNoConselho, textoSemQuorum } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, chamarApi, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import type { DecisaoPedido, LinkMandado, PedidoDetalhe } from "../tipos.ts";
import { diaDe, diaHora } from "../pedidos/comum.tsx";
import { diaDoPrazo, ListaAlternativas, ResponderDecisao, resumoResposta, RetirarDecisao, SeloDecisao } from "./comum.tsx";
import { Escolha } from "./Despesas.tsx";
import { LinksMandados, recadoDosLinks } from "./votacao.tsx";

const qtdAlternativas = (n: number) => (n === 1 ? "1 alternativa" : `${n} alternativas`);

/** "Esperando a decisão de Ana", "Esperando a sua decisão" ou "Em votação no conselho". */
function esperando(x: DecisaoPedido): string {
  if (x.modo === "CONSELHO" && x.conselho) return `Em votação no conselho (${x.conselho.votaram} de ${x.conselho.titulares} votaram)`;
  if (!x.decisor) return "Esperando a decisão";
  return x.decisor.eu ? "Esperando a sua decisão" : `Esperando a decisão de ${x.decisor.nome}`;
}
const quemDecide = (x: DecisaoPedido) => (x.modo === "CONSELHO" ? "o conselho" : x.decisor?.nome ?? "—");

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
              {esperando(x)} até {diaDoPrazo(x.prazo)}{x.vencida ? " (prazo vencido)" : ""}
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
        <details className="t-texto">
          <summary className="cursor-pointer font-medium text-violeta-600">{fechadas.length === 1 ? "1 decisão respondida ou retirada" : `${fechadas.length} decisões respondidas ou retiradas`}</summary>
          <ul className="mt-2 grid gap-2">
            {fechadas.map((x) => (
              <li key={x.id} className="grid gap-1 rounded-2xl border border-linha bg-superficie p-3">
                <span className="flex flex-wrap items-center gap-2"><SeloDecisao d={x} hoje={hoje} /><span className="font-medium">{x.pergunta}</span></span>
                <span className="t-apoio text-tinta-suave">{resumoResposta(x)}</span>
                <Botao variante="discreto" tamanho="m" className="justify-self-start" aria-label={`Ver a decisão: ${x.pergunta}`} onClick={() => setVer(x)}>Ver</Botao>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialogo aberto={ver !== null} titulo="Decisão pedida" aoFechar={() => setVer(null)}>
        {ver ? (
          <div className="grid gap-3">
            <p className="flex flex-wrap items-center gap-2 t-texto"><SeloDecisao d={ver} hoje={hoje} /><span className="text-tinta-suave">quem decide: {quemDecide(ver)}</span></p>
            <p className="t-texto font-medium">{ver.pergunta}</p>
            {ver.porque ? <p className="t-texto">Por que agora: {ver.porque}</p> : null}
            <ListaAlternativas alternativas={ver.alternativas} aprovada={ver.alternativaAprovada} />
            <p className="t-apoio text-tinta-suave">Pedida{ver.pedidaPor ? ` por ${ver.pedidaPor}` : ""} em {diaHora(ver.pedidaEm)} · decidir até {diaDoPrazo(ver.prazo)}</p>
            {resumoResposta(ver) ? <p className="t-texto">{resumoResposta(ver)}</p> : null}
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
const CONSELHO = "__conselho";

/** "2 alternativas · de R$ 1.800 a R$ 9.400", do que já foi escrito. */
export function faixaDeCusto(alternativas: { custo: string }[]): string {
  const custos: number[] = [];
  for (const a of alternativas) {
    try { if (a.custo.trim()) custos.push(lerReais(a.custo).centavos); } catch { /* o erro aparece ao enviar */ }
  }
  const n = qtdAlternativas(alternativas.length);
  if (!custos.length) return n;
  const min = Math.min(...custos);
  const max = Math.max(...custos);
  return min === max ? `${n} · ${mostrarCusto(min)}` : `${n} · de ${mostrarCusto(min)} a ${mostrarCusto(max)}`;
}
const vazia = (): AlternativaEscrita => ({ descricao: "", custo: "", detalhe: "" });

function somarDias(data: string, n: number): string {
  const t = Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Pedir decisão ao síndico (decisões 5 a 8): abre a pendência Decisão para quem decide. */
function FormPedir({ d, aoFechar, salvo, recarregar }: { d: PedidoDetalhe; aoFechar: () => void; salvo: (t: string, links: LinkMandado[]) => void; recarregar: () => void }) {
  const p = d.pedido;
  const decisores = d.decisores ?? [];
  const conselho = d.conselho;
  const hoje = diaDe(d.agora);
  const [pergunta, setPergunta] = useState("");
  const [alternativas, setAlternativas] = useState<AlternativaEscrita[]>([vazia()]);
  const [prazo, setPrazo] = useState(somarDias(hoje, 3));
  const [decisor, setDecisor] = useState(decisores[0]?.vinculoId ?? (conselho?.podePedir ? CONSELHO : ""));
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
    const aoConselho = decisor === CONSELHO;
    const r = await chamarApi<{ id: string; links?: LinkMandado[] }>(`/v1/condominio/pedidos/${p.id}/decisoes`, {
      corpo: { versao: p.versao, pergunta: pergunta.trim(), porque: porque.trim() || null, prazo, alternativas: lidas,
        ...(aoConselho ? { modo: "CONSELHO" } : { decisorId: decisor }) },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    if (aoConselho) {
      const links = r.dados.links ?? [];
      return salvo(`Decisão pedida ao conselho, para votar até ${diaDoPrazo(prazo)}. ${recadoDosLinks(links)} O pedido ganhou a pendência Decisão.`, links);
    }
    const quem = decisores.find((x) => x.vinculoId === decisor);
    salvo(quem?.eu ? "Decisão registrada para você responder. O pedido ganhou a pendência Decisão."
      : `Decisão pedida a ${quem?.nome ?? "quem decide"}, com aviso no sino. O pedido ganhou a pendência Decisão.`, []);
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <CampoAreaTexto id="dec-pergunta" rotulo="O que precisa ser decidido" required maxLength={500} rows={3} value={pergunta}
        onChange={(e) => setPergunta(e.target.value)} erro={comErro.includes("pergunta") ? "Diga o que precisa ser decidido (3 a 500 caracteres)." : null} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 t-texto font-medium">Alternativas <span className="text-tinta-suave">(de 1 a 5)</span></legend>
        {comErro.includes("alternativas") ? <p className="t-texto text-erro">Confira as alternativas: descrição de 3 a 200 caracteres e custo em reais.</p> : null}
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
      <CampoAreaTexto id="dec-porque" rotulo="Por que agora" opcional maxLength={500} rows={2} value={porque}
        onChange={(e) => setPorque(e.target.value)} erro={comErro.includes("porque") ? "De 3 a 500 caracteres." : null} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-texto font-medium">Quem decide</legend>
        {decisores.map((x) => (
          <Escolha key={x.vinculoId} nome="dec-decisor" valor={x.vinculoId} atual={decisor} mudar={setDecisor}
            texto={x.sindico ? `${x.nome} (síndico)` : x.eu ? `${x.nome} (você)` : x.nome} sub={x.sindico ? "Síndico" : "Tem a permissão Aprovar"} />
        ))}
        {conselho?.podePedir ? (
          <Escolha nome="dec-decisor" valor={CONSELHO} atual={decisor} mudar={setDecisor} texto="O conselho"
            sub={`${textoQuemVotaNoConselho(conselho)} Prazo para votar até o dia escolhido abaixo.`} />
        ) : conselho && conselho.titularesEmDia > 0 ? <p className="t-apoio">{textoSemQuorum(conselho)}</p> : null}
        {comErro.includes("decisorId") ? <p className="t-texto text-erro">Escolha o síndico, quem tem a permissão Aprovar ou o conselho.</p> : null}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="dec-prazo" rotulo={decisor === CONSELHO ? "Votar até" : "Decidir até"} required type="date" min={hoje} max={somarDias(hoje, 90)} value={prazo}
          onChange={(e) => setPrazo(e.target.value)} ajuda="De hoje a 90 dias." erro={comErro.includes("prazo") ? "O prazo vai de hoje a 90 dias." : null} />
        <p className="t-apoio self-center">{faixaDeCusto(alternativas)}</p>
      </div>
      {decisor === CONSELHO ? (
        <p className="flex items-start gap-2 t-apoio">
          <Icone nome="info" className="mt-px h-4 w-4 shrink-0" />
          Cada conselheiro recebe um link pessoal pelo contato do conselho. Quem tem acesso ao painel vota também em Decisões. O conselheiro vê a pergunta, as alternativas e os anexos; não vê nome nem telefone de moradores.
        </p>
      ) : null}
      <p className="t-apoio text-tinta-suave">Os orçamentos ficam nos arquivos do pedido. Aprovar não contrata nem paga nada: a contratação continua como o condomínio já faz.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : decisor === CONSELHO ? "Pedir ao conselho" : "Pedir decisão"}</Botao>
      </div>
    </form>
  );
}

export function PedirDecisao({ aberto, d, aoFechar, salvo, recarregar }: Props & { aberto: boolean; aoFechar: () => void }) {
  const [links, setLinks] = useState<LinkMandado[] | null>(null);
  return (
    <>
      <Dialogo aberto={aberto} titulo={`Pedir decisão · ${d.pedido.protocolo}`} aoFechar={aoFechar} apoio={d.pedido.assunto}>
        {aberto ? (
          (d.decisores ?? []).length || d.conselho?.podePedir
            ? <FormPedir d={d} aoFechar={aoFechar} recarregar={recarregar}
              salvo={(t, l) => { salvo(t); if (l.some((x) => x.envio === "COPIAR")) setLinks(l); }} />
            : <><Aviso tom="atencao">Ninguém pode decidir agora: o síndico não tem acesso, ninguém tem a permissão Aprovar e não há conselho com mandato em dia.</Aviso>
              <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div></>
        ) : null}
      </Dialogo>
      <LinksMandados links={links} aoFechar={() => setLinks(null)} />
    </>
  );
}

/** "resolve sozinha quando Ana Souza responder", para a pendência que nasceu da decisão. */
export function pendenciaDaDecisao(d: PedidoDetalhe, pendenciaId: string): string | null {
  const x = (d.decisoes ?? []).find((y) => y.pendenciaId === pendenciaId && y.estado === "AGUARDANDO");
  if (!x) return null;
  if (x.modo === "CONSELHO") return "resolve sozinha quando o conselho fechar a votação";
  return `resolve sozinha quando ${x.decisor?.eu ? "você" : x.decisor?.nome ?? "quem decide"} responder`;
}

