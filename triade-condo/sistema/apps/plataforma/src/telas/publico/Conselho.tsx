"use client";
// O link do conselheiro (R5, V-14; quadros 416 e 417): sem conta e sem senha, só daquele membro.
// O titular vota (e troca o voto até o prazo); o subsíndico, na ausência do síndico, responde no
// lugar dele; o link de aviso só mostra a decisão vencida. Os outros votos aparecem quando a
// votação fecha. O conselheiro não vê nome nem telefone de moradores.

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ESTADOS_LINK_CONSELHO, LINK_NAO_VALE, mostrarCusto, PAPEIS_CONSELHO, textoEscolha } from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, Carregando, chamarApi, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { ConselhoPublico } from "../tipos.ts";
import { Cartao, Opcao, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: ConselhoPublico };
const RODAPE = "Não precisa de conta nem senha. O link é só seu: não repasse.";
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const votos = (n: number) => (n === 1 ? "1 voto" : `${n} votos`);

/** O resultado da votação fechada, numa frase (quadro 417). */
export function textoResultado(c: ConselhoPublico): string {
  const r = c.item?.resultado;
  const despesa = c.item?.tipo === "DESPESA";
  if (!r) return "A votação fechou.";
  if (r.voltouAoSindico) return `Sem ${votos(c.conselho?.necessarios ?? 0)} iguais no conselho: a ${despesa ? "despesa" : "decisão"} voltou para o síndico.`;
  const alt = c.item?.alternativas?.find((a) => a.numero === r.alternativaAprovada);
  const oQue = r.estado === "APROVADA" ? (despesa ? "Despesa aprovada" : `Aprovada a alternativa ${r.alternativaAprovada}${alt ? ` · ${alt.descricao}` : ""}`)
    : r.estado === "RECUSADA" ? "Despesa recusada" : r.estado === "DEVOLVIDA" ? "Decisão devolvida sem escolher" : r.estado === "RETIRADA" ? "O pedido foi retirado" : "Fechada";
  return `${oQue}${r.justificativa ? `. ${r.justificativa}` : ""}.`;
}

function Mini({ icone, tom, titulo, children }: { icone: NomeIcone; tom: string; titulo: string; children: React.ReactNode }) {
  return (
    <Cartao>
      <div className="flex items-start gap-3">
        <span className="ladrilho" data-tom={tom} aria-hidden="true"><Icone nome={icone} /></span>
        <div className="grid gap-1">
          <h2 className="t-titulo-cartao">{titulo}</h2>
          <div className="t-texto">{children}</div>
        </div>
      </div>
    </Cartao>
  );
}

export function ConselhoLink() {
  const { codigo } = useParams<{ codigo: string }>();
  const base = `/v1/publico/conselho/${encodeURIComponent(codigo)}`;
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [trocando, setTrocando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  const carregar = useCallback(() => {
    void chamarApi<ConselhoPublico>(base).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este link não existe. Confira o endereço ou peça um novo ao síndico." : textoDoErro(r.erro) });
    });
  }, [base]);
  useEffect(carregar, [carregar]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Conselho do condomínio" icone="pessoas" rodape={RODAPE}><Carregando rotulo="Abrindo…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Conselho do condomínio" icone="pessoas" rodape={RODAPE}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const c = carga.dados;
  const nome = typeof c.membro === "string" ? c.membro : c.membro.nome;
  const papel = typeof c.membro === "string" ? null : PAPEIS_CONSELHO[c.membro.papel];
  const pronto = (d: ConselhoPublico, texto: string) => { setCarga({ estado: "pronto", dados: d }); setTrocando(false); setRecado(texto); };

  return (
    <TelaPublica titulo={`Conselho do ${c.condominio}`} subtitulo={papel ? `${nome} · ${papel}` : nome} icone="pessoas" rodape={RODAPE}>
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
      {c.estado === "NAO_VALE" ? (
        <Mini icone="fechar" tom="erro" titulo={ESTADOS_LINK_CONSELHO.NAO_VALE}>
          {c.motivo ? `${LINK_NAO_VALE[c.motivo]} ` : ""}
          {c.motivo === "SAIU_DO_CONSELHO" || c.motivo === "SUPLENTE_NAO_VOTA" ? "Se acha que é engano, fale com o síndico." : "Se você é do conselho, peça um novo ao síndico."}
        </Mini>
      ) : c.estado === "LINK_VENCIDO" ? (
        <Mini icone="relogio" tom="neutro" titulo="Este link venceu">
          O resultado fica à vista pelo link até 7 dias depois do prazo. Para saber como ficou, fale com o síndico.
        </Mini>
      ) : c.estado === "PRAZO_ACABOU" ? (
        <Mini icone="relogio" tom="atencao" titulo="O prazo acabou">
          A votação fechou em {c.prazo ? ddmm(c.prazo) : "o prazo"} sem {votos(c.conselho?.necessarios ?? 0)} iguais. {c.item?.tipo === "DESPESA" ? "A despesa" : "A decisão"} segue a regra do condomínio para o empate.
        </Mini>
      ) : c.estado === "FECHADA" ? (
        <>
          <Mini icone="pessoas" tom="violeta" titulo={c.item?.tipo === "DESPESA" ? "Despesa fechada" : "Decisão fechada"}>{textoResultado(c)}</Mini>
          {c.meuVoto ? <p className="t-apoio">Seu voto: {textoEscolha(c.meuVoto.escolha, c.item?.alternativas)} · {diaHora(c.meuVoto.votadoEm)}.</p> : null}
          {c.item ? <Item c={c} codigo={base} /> : null}
          {c.conselho?.votos.length ? <VotosFechados c={c} /> : null}
        </>
      ) : c.estado === "VOTADO" && !trocando ? (
        <>
          <Mini icone="check" tom="ok" titulo="Seu voto foi registrado">
            {c.meuVoto ? `${textoEscolha(c.meuVoto.escolha, c.item?.alternativas)} · ${diaHora(c.meuVoto.votadoEm)}.` : ""} Você pode trocar até {c.prazo ? `${ddmm(c.prazo)}, 23:59` : "o prazo"}.
          </Mini>
          <Botao variante="secundario" className="w-full" onClick={() => { setRecado(null); setTrocando(true); }}><Icone nome="editar" />Trocar meu voto</Botao>
          {c.item ? <Item c={c} codigo={base} /> : null}
        </>
      ) : c.item ? (
        <Cartao className="gap-3">
          <span className="flex flex-wrap gap-1.5">
            {c.prazo ? <Selo tom="info">{c.estado === "AGUARDANDO" ? `Venceu em ${ddmm(c.prazo)}` : `${c.estado === "RESPONDER" ? "Responder" : "Votar"} até ${ddmm(c.prazo)}, 23:59`}</Selo> : null}
            {c.estado !== "RESPONDER" && c.conselho?.necessarios ? <Selo tom="neutro">{votos(c.conselho.necessarios)} {c.conselho.necessarios === 1 ? "aprova" : "aprovam"}</Selo> : null}
          </span>
          <Item c={c} codigo={base} solto />
          {c.estado === "VOTAR" || c.estado === "VOTADO" ? <FormVoto c={c} base={base} pronto={pronto} recarregar={carregar} />
            : c.estado === "RESPONDER" ? <FormResposta c={c} base={base} pronto={pronto} recarregar={carregar} />
              : <p className="t-apoio">{ESTADOS_LINK_CONSELHO.AGUARDANDO}. Quem decide foi avisado no sino.</p>}
        </Cartao>
      ) : <Aviso tom="atencao">{ESTADOS_LINK_CONSELHO[c.estado]}</Aviso>}
    </TelaPublica>
  );
}

/** O que está sendo decidido: a pergunta ou a despesa, o porquê e os anexos. */
function Item({ c, codigo, solto }: { c: ConselhoPublico; codigo: string; solto?: boolean }) {
  const i = c.item!;
  const [falha, setFalha] = useState<string | null>(null);
  async function abrir(id: string) {
    setFalha(null);
    const aba = window.open("about:blank", "_blank");
    const r = await chamarApi<{ url: string }>(`${codigo}/arquivos/${id}`);
    if (!r.ok) { aba?.close(); return setFalha("Não deu para abrir o arquivo agora. Tente de novo."); }
    if (aba) aba.location.href = r.dados.url;
  }
  const corpo = (
    <>
      <h2 className="t-titulo-secao font-medium">{i.tipo === "DESPESA" ? i.descricao : i.pergunta}</h2>
      {i.tipo === "DESPESA" ? (
        <p className="t-texto"><span className="t-codigo">{i.valor !== undefined ? mostrarCusto(i.valor) : ""}</span>{i.fornecedor ? ` · ${i.fornecedor}` : ""}{i.vencimento ? ` · vence ${ddmm(i.vencimento)}` : ""}</p>
      ) : null}
      {i.porque ? <p className="t-texto">{i.porque}</p> : null}
      {i.pedidaPor ? <p className="t-apoio">Pedida por {i.pedidaPor}{i.pedidaEm ? ` em ${diaHora(i.pedidaEm)}` : ""}</p> : null}
      {i.anexos.length ? (
        <section className="grid gap-2">
          <h3 className="t-rotulo">Anexos</h3>
          {i.anexos.map((a) => (
            <Botao key={a.id} variante="discreto" className="w-full justify-start rounded-xl border border-linha bg-fundo text-tinta" onClick={() => void abrir(a.id)}>
              <Icone nome="clipe" /><span className="min-w-0 flex-1 truncate text-left"><span className="sr-only">Abrir </span>{a.nome}</span><span className="t-apoio">{a.tipo === "application/pdf" ? "PDF" : "Foto"}</span>
            </Botao>
          ))}
          {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
        </section>
      ) : null}
    </>
  );
  return solto ? corpo : <Cartao className="gap-3">{corpo}</Cartao>;
}

function VotosFechados({ c }: { c: ConselhoPublico }) {
  return (
    <Cartao>
      <h2 className="t-rotulo">Votos</h2>
      <ul className="grid">
        {c.conselho!.votos.map((v) => (
          <li key={v.membroId ?? v.nome} className="grid gap-0.5 border-t border-linha py-2 first:border-t-0">
            <span className="t-texto font-medium">{v.nome}</span>
            <span className="t-apoio">{v.escolha ? textoEscolha(v.escolha, c.item?.alternativas) : "Não votou"}{v.justificativa ? ` · “${v.justificativa}”` : ""}</span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

type PropsForm = { c: ConselhoPublico; base: string; pronto: (d: ConselhoPublico, texto: string) => void; recarregar: () => void };

/** Votar (quadro 416): uma alternativa ou devolver; na despesa, aprovar ou recusar. */
function FormVoto({ c, base, pronto, recarregar }: PropsForm) {
  const despesa = c.item?.tipo === "DESPESA";
  const [escolha, setEscolha] = useState<string | null>(c.meuVoto?.escolha ?? null);
  const [justificativa, setJustificativa] = useState(c.meuVoto?.justificativa ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const opcoes = despesa
    ? [{ valor: "APROVAR", texto: "Aprovar a despesa", sub: "" }, { valor: "RECUSAR", texto: "Recusar", sub: "Escreva o porquê" }]
    : [...(c.item?.alternativas ?? []).map((a) => ({ valor: String(a.numero), texto: `${a.numero} · ${a.descricao}`, sub: [a.custo !== undefined && a.custo !== null ? mostrarCusto(a.custo) : null, a.detalhe].filter(Boolean).join(" · ") })),
      { valor: "DEVOLVER", texto: "Devolver sem escolher", sub: "Escreva o que falta para decidir" }];
  const pedeMotivo = escolha === "DEVOLVER" || escolha === "RECUSAR";

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!escolha) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["escolha"] } });
    setEnviando(true);
    const r = await chamarApi<ConselhoPublico>(`${base}/voto`, { corpo: { escolha, justificativa: justificativa.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    pronto(r.dados, r.dados.estado === "FECHADA" ? "Voto registrado. Com ele, a votação fechou." : c.meuVoto ? "Voto trocado." : "Voto registrado.");
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-rotulo">Seu voto</legend>
        {opcoes.map((o) => (
          <Opcao key={o.valor} nome="voto" valor={o.valor} marcada={escolha === o.valor} aoMarcar={() => setEscolha(o.valor)}>
            <span className="grid gap-0.5"><span>{o.texto}</span>{o.sub ? <span className="t-apoio font-normal">{o.sub}</span> : null}</span>
          </Opcao>
        ))}
        {comErro.includes("escolha") ? <p className="t-texto text-erro">Escolha o seu voto.</p> : null}
      </fieldset>
      <CampoAreaTexto id="voto-porque" rotulo={pedeMotivo ? "Por quê" : "Por quê (opcional para aprovar)"} maxLength={1000} rows={3} value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)} erro={comErro.includes("justificativa") ? "Escreva o porquê (3 a 1000 caracteres)." : null} />
      <Botao type="submit" className="w-full" disabled={enviando}><Icone nome="enviar" />{c.meuVoto ? "Trocar meu voto" : "Enviar meu voto"}</Botao>
      <p className="t-apoio">Seu voto fica com seu nome e a hora, e pode ser trocado até o prazo. Os outros votos aparecem quando a {despesa ? "despesa" : "decisão"} fechar.</p>
    </form>
  );
}

/** Responder no lugar do síndico ausente (link SUBSTITUTO). */
function FormResposta({ c, base, pronto, recarregar }: PropsForm) {
  const despesa = c.item?.tipo === "DESPESA";
  const [escolha, setEscolha] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const opcoes = despesa
    ? [{ valor: "APROVAR", texto: "Aprovar a despesa" }, { valor: "RECUSAR", texto: "Recusar" }]
    : [...(c.item?.alternativas ?? []).map((a) => ({ valor: String(a.numero), texto: `${a.numero} · ${a.descricao}${a.custo ? ` · ${mostrarCusto(a.custo)}` : ""}` })),
      { valor: "DEVOLVER", texto: "Devolver sem decidir" }];
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!escolha) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["alternativa"] } });
    const aprovar = escolha !== "DEVOLVER" && escolha !== "RECUSAR";
    setEnviando(true);
    const r = await chamarApi<ConselhoPublico>(`${base}/resposta`, {
      corpo: { aprovar, alternativa: aprovar && !despesa ? Number(escolha) : null, justificativa: justificativa.trim() },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    pronto(r.dados, "Resposta registrada no lugar do síndico. Quem pediu foi avisado.");
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3">
      <p className="t-texto">O síndico está ausente: você responde no lugar dele. A resposta fica no histórico com o seu nome.</p>
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 t-rotulo">Sua resposta</legend>
        {opcoes.map((o) => <Opcao key={o.valor} nome="resposta" valor={o.valor} marcada={escolha === o.valor} aoMarcar={() => setEscolha(o.valor)}>{o.texto}</Opcao>)}
        {comErro.includes("alternativa") ? <p className="t-texto text-erro">Escolha a resposta.</p> : null}
      </fieldset>
      <CampoAreaTexto id="resposta-porque" rotulo="Justificativa" required maxLength={1000} rows={3} value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)} erro={comErro.includes("justificativa") ? "Explique a resposta (3 a 1000 caracteres)." : null} />
      <Botao type="submit" className="w-full" disabled={enviando}><Icone nome="enviar" />Enviar a resposta</Botao>
    </form>
  );
}
