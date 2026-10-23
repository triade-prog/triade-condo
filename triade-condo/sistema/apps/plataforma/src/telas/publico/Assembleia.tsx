"use client";
// Link pessoal da assembleia (design "Vida em condomínio", tela 7; AC-02): só daquela unidade, sem
// conta e sem senha. Antes, o proprietário indica quem vota por ela; o síndico confere a procuração.
// Durante, abrir o link registra a presença online, e cada item recebe voto enquanto está aberto.
// Depois, o link mostra o resultado de cada item.

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ESTADOS_PROCURACAO, formatarDataHora, PESOS_ASSEMBLEIA, porcento, QUORUNS, SITUACOES_ITEM } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, classeBotao, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import type { AssembleiaPublica } from "../tipos.ts";
import { Cartao, Opcao, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: AssembleiaPublica };
type Item = AssembleiaPublica["itens"][number];

const RODAPE = "Não precisa de conta nem senha. O link é só da sua unidade: não repasse.";

export function Assembleia() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/a/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  useEffect(() => {
    void chamarApi<AssembleiaPublica>(base).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este link não existe. Confira o endereço ou peça um novo ao condomínio." : textoDoErro(r.erro) });
    });
  }, [base]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Assembleia do condomínio" icone="convivio" rodape={RODAPE}><Carregando rotulo="Abrindo a assembleia…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Assembleia do condomínio" icone="convivio" rodape={RODAPE}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const a = carga.dados;
  const pronto = (dados: AssembleiaPublica) => setCarga({ estado: "pronto", dados });

  return (
    <TelaPublica titulo={a.titulo} subtitulo={`${a.condominio} · ${a.unidade}${a.proprietarios ? ` · ${a.proprietarios}` : ""}`} icone="convivio" rodape={RODAPE}>
      <QuandoEOnde a={a} />
      {a.estado === "CONVOCADA" ? <Procuracao a={a} base={base} aoMudar={pronto} /> : null}
      {a.estado === "EM_ANDAMENTO" || a.estado === "ENCERRADA" ? <Pauta a={a} base={base} aoMudar={pronto} /> : null}
      {a.representa?.length ? (
        <p className="t-apoio text-tinta-suave">Este link é da {a.unidade} nesta assembleia. Vale também pela procuração da {a.representa.join(" e da ")}.</p>
      ) : null}
    </TelaPublica>
  );
}

const Dado = ({ rotulo, className = "", children }: { rotulo: string; className?: string; children: ReactNode }) => (
  <div className={`grid gap-0.5 ${className}`}><dt className="t-apoio text-tinta-suave">{rotulo}</dt><dd className="t-texto">{children}</dd></div>
);

/** Quando e onde: antes, as chamadas e o local; durante, o andamento e a presença. */
function QuandoEOnde({ a }: { a: AssembleiaPublica }) {
  if (a.estado === "CANCELADA") return <Aviso tom="atencao" titulo="Assembleia cancelada">{a.motivoCancelamento}</Aviso>;
  return (
    <Cartao className="gap-2.5">
      <h2 className="t-titulo-cartao flex items-center gap-2"><Icone nome="calendario" />Quando e onde</h2>
      {a.estado === "EM_ANDAMENTO" ? (
        <span className="flex flex-wrap gap-1.5">
          <Selo tom="andamento">Em andamento</Selo>
          {a.presenteEm ? <Selo tom="ok">Presença registrada às {formatarDataHora(a.presenteEm).slice(11)}</Selo> : null}
        </span>
      ) : (
        <>
          {a.estado === "ENCERRADA" ? <span className="justify-self-start"><Selo tom="neutro">Encerrada</Selo></span> : null}
          <dl className="grid grid-cols-2 gap-3">
            <Dado rotulo="1ª chamada">{formatarDataHora(a.primeiraChamada)}</Dado>
            <Dado rotulo="2ª chamada">{formatarDataHora(a.segundaChamada)}</Dado>
            {a.local ? <Dado rotulo="Onde" className="col-span-2">{a.local}</Dado> : null}
          </dl>
          {a.estado === "CONVOCADA" ? <p className="t-texto text-tinta-suave">No dia, abra este link para registrar a presença e votar, do salão ou de casa.</p> : null}
        </>
      )}
      {a.linkVideo && a.estado !== "ENCERRADA" ? (
        <a href={a.linkVideo} target="_blank" rel="noreferrer" className={classeBotao("contorno", "justify-self-start", "m")}><Icone nome="link" />Entrar na videochamada</a>
      ) : null}
      {a.semDireito ? <Aviso tom="atencao">O síndico marcou esta unidade sem direito a voto nesta assembleia. A presença continua valendo.</Aviso> : null}
    </Cartao>
  );
}

function Procuracao({ a, base, aoMudar }: { a: AssembleiaPublica; base: string; aoMudar: (d: AssembleiaPublica) => void }) {
  const p = a.procuracao;
  const vale = p && p.estado !== "RECUSADA";
  const [quem, setQuem] = useState(vale ? "outra" : "eu");
  const [nome, setNome] = useState(p?.nome ?? "");
  const [unidade, setUnidade] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<AssembleiaPublica>(`${base}/procuracao`, { corpo: quem === "eu" ? { nome: null } : { nome, unidadeId: unidade || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoMudar(r.dados);
  }

  const titulo = <h2 className="t-titulo-cartao flex items-center gap-2"><Icone nome="pessoa" />Quem vota pela {a.unidade}</h2>;
  if (p?.estado === "ACEITA") {
    return (
      <Cartao className="gap-2.5">
        {titulo}
        <Aviso tom="ok">Procuração aceita pelo síndico: {p.nome}{p.unidade ? `, da ${p.unidade}, vota pelo link da unidade dele` : ", pelo link que o condomínio mandar"}.</Aviso>
      </Cartao>
    );
  }
  // O botão só aparece quando há o que enviar (decisão B.1).
  const acao = quem === "eu" ? (vale ? "Retirar a procuração" : null)
    : !vale ? "Indicar o procurador" : nome.trim() !== p.nome || unidade ? "Trocar o procurador" : null;
  const atual = <Selo tom="andamento">Atual</Selo>;
  return (
    <Cartao className="gap-2.5">
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <fieldset className="grid gap-2">
          <legend className="contents">{titulo}</legend>
          <div className="mt-0.5 grid gap-2">
            <Opcao nome="quem" valor="eu" marcada={quem === "eu"} aoMarcar={() => setQuem("eu")} selo={!vale ? atual : null}>Eu mesmo, pelo proprietário</Opcao>
            <Opcao nome="quem" valor="outra" marcada={quem === "outra"} aoMarcar={() => setQuem("outra")} selo={vale ? atual : null}>Outra pessoa, por procuração</Opcao>
          </div>
        </fieldset>
        {p ? (
          <Aviso tom={p.estado === "PENDENTE" ? "info" : "atencao"}>
            Procuração para {p.nome}{p.unidade ? ` (${p.unidade})` : ""}: {ESTADOS_PROCURACAO[p.estado].toLowerCase()}{p.motivo ? `. ${p.motivo}` : ""}.
          </Aviso>
        ) : null}
        {quem === "outra" ? (
          <>
            <CampoTexto id="pr-nome" rotulo="Nome do procurador" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)}
              erro={comErro.includes("nome") ? "Escreva o nome do procurador" : null} />
            <CampoSelecao id="pr-unidade" rotulo="O procurador é de outra unidade?" value={unidade} onChange={(e) => setUnidade(e.target.value)}
              opcoes={[{ valor: "", texto: "Não, é de fora do prédio" }, ...(a.outrasUnidades ?? []).map((u) => ({ valor: u.id, texto: u.nome }))]}
              erro={comErro.includes("unidadeId") ? "Escolha outra unidade desta assembleia" : null}
              ajuda="Sendo de outra unidade, depois de aceita, o link dela vale pelas duas" />
            <p className="t-apoio">Entregue a procuração assinada ao condomínio: o síndico confere antes da assembleia e aceita ou recusa.</p>
          </>
        ) : null}
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {acao ? <Botao type="submit" className="w-full" disabled={enviando}>{acao}</Botao> : null}
        <p className="t-apoio">Até a 1ª chamada dá para indicar um procurador. O condomínio confere a procuração.</p>
      </form>
    </Cartao>
  );
}

/** A pauta inteira num cartão (decisão C.1): o que já foi decidido, o item em votação e o que vem depois. */
function Pauta({ a, base, aoMudar }: { a: AssembleiaPublica; base: string; aoMudar: (d: AssembleiaPublica) => void }) {
  const decididos = a.itens.filter((i) => i.estado === "ENCERRADO").length;
  const aberto = a.itens.find((i) => i.estado === "ABERTO");
  const passou = a.procuracao?.estado === "ACEITA";
  return (
    <>
      {passou && a.estado === "EM_ANDAMENTO" ? <Aviso tom="info">O voto desta unidade está com {a.procuracao!.nome}, pela procuração aceita.</Aviso> : null}
      {a.estado === "EM_ANDAMENTO" && !aberto ? (
        <Aviso tom="info">Nenhum item em votação agora. Esta página mostra o próximo quando a mesa abrir: atualize daqui a pouco.</Aviso>
      ) : null}
      <Cartao className="gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <h2 className="t-titulo-cartao flex items-center gap-2"><Icone nome="lista" />Pauta</h2>
          <span className="t-apoio">{a.itens.length} {a.itens.length === 1 ? "item" : "itens"} · {decididos} {decididos === 1 ? "decidido" : "decididos"}</span>
        </span>
        <ol className="grid">
          {a.itens.map((i, n) => (
            <ItemDaPauta key={i.id} i={i} ultimo={n === a.itens.length - 1} peso={a.peso}>
              {i.estado === "ABERTO" ? (passou || a.semDireito
                ? <p className="t-apoio">{QUORUNS[i.quorum]}. {passou ? "Quem vota é o procurador." : "Esta unidade não vota nesta assembleia."}</p>
                : <Voto key={i.id} i={i} base={base} aoMudar={aoMudar} />) : null}
            </ItemDaPauta>
          ))}
        </ol>
      </Cartao>
    </>
  );
}

function seloDoItem(i: Item) {
  if (i.estado === "ABERTO") return <Selo tom="andamento">Votação aberta</Selo>;
  if (i.estado === "AGUARDANDO") return <Selo tom="neutro">Depois</Selo>;
  const r = i.resultado;
  if (!r) return <Selo tom="neutro">Votado</Selo>;
  if (r.situacao === "APROVADO") return <Selo tom="ok">Decidido: aprovado</Selo>;
  if (r.situacao === "ESCOLHIDA") return <Selo tom="ok">Decidido: {r.vencedor}</Selo>;
  return <Selo tom={r.situacao === "REPROVADO" ? "neutro" : "atencao"}>Decidido: {SITUACOES_ITEM[r.situacao].toLowerCase()}</Selo>;
}

function ItemDaPauta({ i, ultimo, peso, children }: { i: Item; ultimo: boolean; peso?: AssembleiaPublica["peso"]; children: ReactNode }) {
  const r = i.resultado;
  const corpo = (
    <div className="grid gap-2.5 pb-3.5 pl-[38px]">
      {i.descricao ? <p className="t-texto">{i.descricao}</p> : null}
      {r ? (
        <>
          {r.opcoes.map((o, k) => {
            const vence = Math.max(...r.opcoes.map((x) => x.porcentagem)) === o.porcentagem && (r.situacao === "APROVADO" || r.situacao === "ESCOLHIDA");
            return (
              <div key={k} className="grid gap-1">
                <span className="flex justify-between gap-2 t-apoio">
                  <span>{o.texto}{i.meuVoto === k + 1 ? " · seu voto" : ""}</span><span className="text-tinta-suave">{porcento(o.porcentagem)}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-superficie-2" aria-hidden="true">
                  <span className={`block h-full rounded-full ${vence ? "bg-ok" : "bg-neutro"}`} style={{ width: `${o.porcentagem}%` }} />
                </span>
              </div>
            );
          })}
          <span className="t-apoio text-tinta-suave">{peso ? `${PESOS_ASSEMBLEIA[peso]} · ` : ""}{r.votaram} {r.votaram === 1 ? "unidade votou" : "unidades votaram"}</span>
        </>
      ) : null}
      {children}
    </div>
  );
  const temCorpo = Boolean(i.descricao || r || children);
  const linha = (
    <>
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-violeta-100 t-apoio font-bold text-violeta-700" aria-hidden="true">{i.ordem}</span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="t-titulo-cartao font-semibold"><span className="sr-only">{i.ordem}. </span>{i.titulo}</span>
        <span>{seloDoItem(i)}</span>
      </span>
    </>
  );
  return (
    <li className={ultimo ? "" : "border-b border-linha"}>
      {temCorpo ? (
        <details open={i.estado !== "AGUARDANDO"} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
            {linha}
            <span className="text-tinta-suave transition-transform group-open:rotate-180" aria-hidden="true"><Icone nome="baixo" /></span>
          </summary>
          {corpo}
        </details>
      ) : <div className="flex items-center gap-3 py-3.5">{linha}</div>}
    </li>
  );
}

function Voto({ i, base, aoMudar }: { i: Item; base: string; aoMudar: (d: AssembleiaPublica) => void }) {
  const [escolha, setEscolha] = useState<number | null>(i.meuVoto ?? null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function votar(ev: FormEvent) {
    ev.preventDefault();
    if (!escolha) return;
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<AssembleiaPublica>(`${base}/voto`, { corpo: { itemId: i.id, opcao: escolha } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoMudar(r.dados);
  }

  return (
    <form onSubmit={votar} noValidate className="grid gap-2.5">
      <fieldset className="grid gap-2">
        <legend className="t-apoio mb-1">{QUORUNS[i.quorum]}</legend>
        {i.opcoes.map((o, k) => (
          <Opcao key={k} nome={`opcao-${i.id}`} valor={k + 1} marcada={escolha === k + 1} aoMarcar={() => setEscolha(k + 1)}
            selo={i.meuVoto === k + 1 ? <Selo tom="andamento">Seu voto</Selo> : null}>{o}</Opcao>
        ))}
      </fieldset>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {escolha && escolha !== i.meuVoto ? (
        <Botao type="submit" className="w-full" disabled={enviando}>{i.meuVoto ? "Trocar o voto" : "Votar"}</Botao>
      ) : i.meuVoto ? (
        <Aviso tom="ok" titulo={`Voto registrado: ${i.opcoes[i.meuVoto - 1]}`}>Dá para trocar enquanto o item está aberto: escolha outra opção e aparece Trocar o voto.</Aviso>
      ) : null}
    </form>
  );
}
