"use client";
// Link pessoal da assembleia (design "Vida em condomínio", tela 7; AC-02): só daquela unidade, sem
// conta e sem senha. Antes, o proprietário indica quem vota por ela; o síndico confere a procuração.
// Durante, abrir o link registra a presença online, e cada item recebe voto enquanto está aberto.
// Depois, o link mostra o resultado de cada item.

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ESTADOS_PROCURACAO, formatarDataHora, porcento, QUORUNS, SITUACOES_ITEM } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, classeBotao, textoDoErro, type ErroApi } from "@triade/ui";
import type { AssembleiaPublica } from "../tipos.ts";
import { Cartao, TelaPublica } from "./comum.tsx";

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
      <Cabecalho a={a} />
      {a.estado === "CONVOCADA" ? <Procuracao a={a} base={base} aoMudar={pronto} /> : null}
      {a.estado === "EM_ANDAMENTO" ? <Votacao a={a} base={base} aoMudar={pronto} /> : null}
      {a.estado === "ENCERRADA" ? <Resultados a={a} /> : null}
      {a.representa?.length ? (
        <p className="text-[13px] text-tinta-suave">Este link é da {a.unidade} nesta assembleia. Vale também pela procuração da {a.representa.join(" e da ")}.</p>
      ) : null}
    </TelaPublica>
  );
}

function Cabecalho({ a }: { a: AssembleiaPublica }) {
  if (a.estado === "CANCELADA") return <Aviso tom="atencao" titulo="Assembleia cancelada">{a.motivoCancelamento}</Aviso>;
  return (
    <Cartao>
      <p className="text-sm">
        1ª chamada em {formatarDataHora(a.primeiraChamada)} · 2ª em {formatarDataHora(a.segundaChamada)}
        {a.local ? ` · ${a.local}` : ""}
      </p>
      {a.estado === "EM_ANDAMENTO" ? (
        <p className="text-sm text-tinta-suave">Em andamento{a.presenteEm ? ` · presença registrada às ${formatarDataHora(a.presenteEm).slice(11)}` : ""}</p>
      ) : null}
      {a.estado === "ENCERRADA" ? <p className="text-sm text-tinta-suave">Assembleia encerrada.</p> : null}
      {a.linkVideo ? <a href={a.linkVideo} target="_blank" rel="noreferrer" className={classeBotao("contorno", "justify-self-start", "m")}>Entrar na videochamada</a> : null}
      {a.semDireito ? <Aviso tom="atencao">O síndico marcou esta unidade sem direito a voto nesta assembleia. A presença continua valendo.</Aviso> : null}
    </Cartao>
  );
}

function Procuracao({ a, base, aoMudar }: { a: AssembleiaPublica; base: string; aoMudar: (d: AssembleiaPublica) => void }) {
  const p = a.procuracao;
  const [quem, setQuem] = useState(p && p.estado !== "RECUSADA" ? "outra" : "eu");
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

  if (p?.estado === "ACEITA") {
    return (
      <Cartao>
        <h2 className="font-medium">Quem vota pela {a.unidade}</h2>
        <Aviso tom="ok">Procuração aceita pelo síndico: {p.nome}{p.unidade ? `, da ${p.unidade}, vota pelo link da unidade dele` : ", pelo link que o condomínio mandar"}.</Aviso>
      </Cartao>
    );
  }
  return (
    <Cartao>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <fieldset className="grid gap-2">
          <legend className="font-medium">Quem vota pela {a.unidade}</legend>
          {[{ v: "eu", t: "Eu mesmo, pelo proprietário" }, { v: "outra", t: "Outra pessoa, por procuração" }].map((o) => (
            <label key={o.v} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-[15px] ${quem === o.v ? "border-violeta-500 bg-violeta-50" : "border-linha"}`}>
              <input type="radio" name="quem" value={o.v} checked={quem === o.v} onChange={() => setQuem(o.v)} />{o.t}
            </label>
          ))}
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
            <p className="text-[13px] text-tinta-suave">Entregue a procuração assinada ao condomínio: o síndico confere antes da assembleia e aceita ou recusa.</p>
          </>
        ) : null}
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <Botao type="submit" disabled={enviando || (quem === "eu" && !p)}>{quem === "eu" ? "Retirar a procuração" : p ? "Trocar o procurador" : "Indicar o procurador"}</Botao>
        <p className="text-[13px] text-tinta-suave">Até a 1ª chamada. No dia, abra este link para registrar a presença e votar.</p>
      </form>
    </Cartao>
  );
}

function Votacao({ a, base, aoMudar }: { a: AssembleiaPublica; base: string; aoMudar: (d: AssembleiaPublica) => void }) {
  const aberto = a.itens.find((i) => i.estado === "ABERTO");
  const votados = a.itens.filter((i) => i.meuVoto).map((i) => i.ordem);
  const passou = a.procuracao?.estado === "ACEITA";
  return (
    <>
      {passou ? <Aviso tom="info">O voto desta unidade está com {a.procuracao!.nome}, pela procuração aceita.</Aviso> : null}
      {aberto && !passou && !a.semDireito ? <Voto key={aberto.id} i={aberto} total={a.itens.length} base={base} aoMudar={aoMudar} /> : null}
      {!aberto ? <Aviso tom="info">Nenhum item em votação agora. Esta página mostra o próximo quando a mesa abrir: atualize daqui a pouco.</Aviso> : null}
      {votados.length ? <p className="text-[13px] text-tinta-suave">Itens {votados.join(", ").replace(/, (\d+)$/, " e $1")}: voto registrado.</p> : null}
      <Resultados a={a} />
    </>
  );
}

function Voto({ i, total, base, aoMudar }: { i: Item; total: number; base: string; aoMudar: (d: AssembleiaPublica) => void }) {
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
    <Cartao>
      <form onSubmit={votar} noValidate className="grid gap-3">
        <fieldset className="grid gap-2">
          <legend className="grid gap-1">
            <span className="text-[13px] text-tinta-suave">Item {i.ordem} de {total} · votação aberta</span>
            <span className="text-xl font-medium">{i.titulo}</span>
          </legend>
          <p className="text-[13px] text-tinta-suave">{i.descricao ? `${i.descricao} ` : ""}{QUORUNS[i.quorum]}.</p>
          {i.opcoes.map((o, k) => (
            <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-[15px] ${escolha === k + 1 ? "border-violeta-500 bg-violeta-50" : "border-linha"}`}>
              <input type="radio" name="opcao" value={k + 1} checked={escolha === k + 1} onChange={() => setEscolha(k + 1)} />{o}
            </label>
          ))}
        </fieldset>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {i.meuVoto ? <Aviso tom="ok">Voto registrado: {i.opcoes[i.meuVoto - 1]}. Dá para trocar enquanto o item está aberto.</Aviso> : null}
        <Botao type="submit" disabled={enviando || !escolha || escolha === i.meuVoto}>{i.meuVoto ? "Trocar o voto" : "Votar"}</Botao>
      </form>
    </Cartao>
  );
}

function Resultados({ a }: { a: AssembleiaPublica }) {
  const votados = a.itens.filter((i) => i.resultado);
  if (!votados.length) return null;
  return (
    <Cartao>
      <h2 className="font-medium">Resultado</h2>
      <ul className="grid gap-2 text-sm">
        {votados.map((i) => {
          const r = i.resultado!;
          return (
            <li key={i.id} className="grid gap-0.5">
              <span className="font-medium">{i.ordem}. {i.titulo}: {r.situacao === "ESCOLHIDA" ? `escolhida ${r.vencedor}` : SITUACOES_ITEM[r.situacao].toLowerCase()}</span>
              <span className="text-tinta-suave">
                {r.opcoes.map((o) => `${o.texto} ${porcento(o.porcentagem)}`).join(" · ")}{i.meuVoto ? ` · seu voto: ${i.opcoes[i.meuVoto - 1]}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}
