"use client";
// Um chamado no Console (PI-20, PI-06; DC15, telas-modelo console-chamado-*, rodada Console de
// 23/10/2026): a conversa vem primeiro, em bolhas, com a resposta embaixo, como o chamado da
// Plataforma; a nota interna, que o cliente nunca vê, fica no trilho da resposta. Situação, Com
// quem e Assumir vão para o cartão Atendimento, ao lado (no celular, fechado no alto). Do
// chamado dá para pedir o acesso excepcional (PI-11). O chamado de mudança (0286, decisão C.1)
// mostra antes do Atendimento o cartão "Mudança pedida", com a parte, o valor de hoje e o caminho
// para a Configuração do cliente, onde a mudança é feita. As imagens que o cliente mandou ficam
// dentro da mensagem em que foram (decisão E.2); daqui só se vê, a TRÍADE ainda não anexa.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { AREAS_CHAMADO, formatarData, formatarDataHora, nomeDaParte, SITUACOES_CHAMADO, TIPOS_CHAMADO } from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, ImagensDaMensagem, textoDoErro,
  type ErroApi, type ImagemDaMensagem,
} from "@triade/ui";
import { Cartao, diaHora, useCelular, Voltar } from "../comum.tsx";
import { useCarregar, useSessao } from "../sessao.tsx";
import { TOM_CHAMADO, type ResumoChamado } from "./Chamados.tsx";
import { PedirAcessoExcepcional } from "./AcessoExcepcional.tsx";

interface Mensagem {
  id: string;
  lado: "CLIENTE" | "TRIADE";
  interna: boolean;
  autor: string;
  texto: string;
  criadoEm: string;
  /** As imagens que foram com a mensagem (decisão E.2), só as conferidas. */
  imagens?: ImagemDaMensagem[];
}

interface DetalheChamado extends ResumoChamado {
  mensagens: Mensagem[];
  equipe: { pessoaId: string; nome: string }[];
  pode: { responder: boolean; notaInterna: boolean; atualizar: boolean; pedirAcesso: boolean };
}

const hora = (iso: string) => formatarDataHora(iso).slice(-5);

/** A conversa em bolhas, com o dia antes da primeira mensagem de cada dia. */
function Conversa({ mensagens, condominio, abrir }: { mensagens: Mensagem[]; condominio?: string; abrir: (id: string) => void }) {
  const linhas: ReactNode[] = [];
  let dia = "";
  for (const m of mensagens) {
    const d = formatarData(m.criadoEm).slice(0, 5);
    if (d !== dia) linhas.push(<li key={`dia-${m.id}`} className="justify-self-center rounded-full bg-superficie-2 px-3 py-0.5 t-apoio text-tinta-suave">{d}</li>);
    dia = d;
    const triade = m.lado === "TRIADE";
    linhas.push(
      <li key={m.id} className={`grid max-w-[min(560px,85%)] gap-1.5 border px-3.5 py-2.5 t-texto ${m.interna
        ? "justify-self-end rounded-[16px_4px_16px_16px] border-dashed border-violeta-300 bg-superficie"
        : triade ? "justify-self-end rounded-[16px_4px_16px_16px] border-violeta-200 bg-violeta-50" : "justify-self-start rounded-[4px_16px_16px_16px] border-linha bg-superficie-2"}`}>
        {m.interna ? <span className="selo justify-self-start" data-tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />Nota interna · o cliente não vê</span> : null}
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.texto}</p>
        <ImagensDaMensagem imagens={m.imagens} abrir={abrir} />
        <span className="t-apoio text-tinta-suave">{m.autor}{triade ? " · TRÍADE" : condominio ? ` · ${condominio}` : ""} · {hora(m.criadoEm)}</span>
      </li>,
    );
  }
  return <ol aria-label="Conversa" className="grid gap-3">{linhas}</ol>;
}

export function ChamadoConsole() {
  const { condominio, chamado } = useParams<{ condominio: string; chamado: string }>();
  const base = `/v1/clientes/${condominio}/chamados/${chamado}`;
  const sessao = useSessao();
  const celular = useCelular();
  const carga = useCarregar<DetalheChamado>(base);
  const [texto, setTexto] = useState("");
  const [interna, setInterna] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo o chamado…" />;
  if (carga.estado === "erro") return <div className="grid gap-3"><Voltar href="/chamados" texto="Voltar aos chamados" /><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const c = carga.dados;
  const primeira = c.mensagens[0];
  const souDaEquipe = c.equipe.some((p) => p.pessoaId === sessao.pessoaId);

  async function abrirImagem(id: string) {
    const r = await chamarApi<{ url: string }>(`${base}/imagens/${id}/link`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi(`${base}/responder`, { corpo: { texto, interna } });
    if (!r.ok) return setErro(r.erro);
    setTexto("");
    setRecado(interna ? "Nota interna guardada. O cliente não vê." : "Resposta enviada. Quem abriu é avisado no sino.");
    carga.recarregar();
  }

  async function atualizar(situacao: string, responsavelId: string | null) {
    setErro(null);
    const r = await chamarApi(base, { metodo: "PUT", corpo: { versao: c.versao, situacao, responsavelId } });
    if (!r.ok) return setErro(r.erro);
    carga.recarregar();
  }

  const atendimento = (
    <div className="grid gap-4">
      {c.pode.atualizar ? (
        <>
          <CampoSelecao id="ch-situacao" rotulo="Situação" value={c.situacao} onChange={(e) => atualizar(e.target.value, c.responsavelId ?? null)}
            opcoes={Object.entries(SITUACOES_CHAMADO).map(([valor, t]) => ({ valor, texto: t }))} />
          <CampoSelecao id="ch-resp" rotulo="Com quem" value={c.responsavelId ?? ""} onChange={(e) => atualizar(c.situacao, e.target.value || null)}
            opcoes={[{ valor: "", texto: "Sem responsável" }, ...c.equipe.map((p) => ({ valor: p.pessoaId, texto: p.nome }))]} />
          {c.responsavelId !== sessao.pessoaId && souDaEquipe ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="t-apoio">Ou assuma você.</span>
              <Botao variante="contorno" tamanho="m" onClick={() => atualizar(c.situacao, sessao.pessoaId)}>Assumir</Botao>
            </div>
          ) : null}
        </>
      ) : <p className="t-apoio">Com quem: {c.responsavel ?? "sem responsável"}.</p>}
      {(c.situacao !== "RESOLVIDO" && c.pode.atualizar) || c.pode.pedirAcesso ? (
        <div className="grid gap-2 border-t border-linha pt-3">
          {c.situacao !== "RESOLVIDO" && c.pode.atualizar ? <Botao variante="contorno" tamanho="m" onClick={() => atualizar("RESOLVIDO", c.responsavelId ?? null)}><Icone nome="check" />Marcar resolvido</Botao> : null}
          {c.pode.pedirAcesso ? <Botao variante="discreto" tamanho="m" onClick={() => setPedindo(true)}><Icone nome="escudo" />Pedir acesso excepcional</Botao> : null}
          {c.pode.pedirAcesso ? <p className="t-apoio text-tinta-suave">O acesso excepcional pede motivo e fica registrado; o síndico aprova.</p> : null}
        </div>
      ) : null}
    </div>
  );

  const mudanca = c.tipo === "MUDANCA" && c.parte ? (
    <Cartao id="t-mudanca-pedida" titulo="Mudança pedida" icone="trocar">
      <dl className="grid gap-2 t-texto">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-tinta-suave">Parte</dt><dd>{nomeDaParte(c.parte)}</dd></div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-tinta-suave">Hoje</dt><dd>{c.hoje}</dd></div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-tinta-suave">Pedida por</dt><dd>{c.abertoPor}</dd></div>
      </dl>
      <Link href={`/clientes/${condominio}?aba=configuracao`} className={classeBotao("contorno", "justify-self-start max-md:justify-self-stretch", "m")}>
        <Icone nome="ajuste" />Abrir a Configuração do cliente
      </Link>
      <p className="t-apoio text-tinta-suave">Mudar com o cliente ativo pede motivo e avisa o síndico. Depois, responda e marque resolvido.</p>
    </Cartao>
  ) : null;

  return (
    <div className="grid gap-5">
      <Voltar href="/chamados" texto="Voltar aos chamados" />
      <header className="flex items-start gap-4">
        <span className="ladrilho h-12 w-12 shrink-0 rounded-[14px] max-md:hidden" data-tom={c.situacao === "NOVO" ? "atencao" : "violeta"} aria-hidden="true"><Icone nome={c.tipo === "MUDANCA" ? "trocar" : "balao"} className="h-6 w-6" /></span>
        <div className="grid min-w-0 gap-2">
          <p className="flex flex-wrap gap-1.5">
            <span className="selo" data-tom={TOM_CHAMADO[c.situacao]}>{SITUACOES_CHAMADO[c.situacao]}</span>
            {c.situacao !== "RESOLVIDO" && !c.responsavelId ? <span className="selo" data-tom="atencao">Sem responsável</span> : null}
            <span className="selo" data-tom="neutro">{TIPOS_CHAMADO[c.tipo]}</span>
          </p>
          <h1 className="t-titulo-tela [overflow-wrap:anywhere] max-md:text-[22px]">{c.titulo}</h1>
          <p className="t-apoio">
            Chamado {c.numero} · {AREAS_CHAMADO[c.area]} · <Link href={`/clientes/${condominio}`} className="hover:underline">{c.condominio}</Link>
            {primeira ? ` · aberto por ${c.abertoPor} em ${diaHora(primeira.criadoEm)}` : ` · aberto por ${c.abertoPor}`}
          </p>
        </div>
      </header>
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={carga.recarregar} /> : null}

      {celular ? mudanca : null}
      {celular ? (
        <details className="group rounded-[18px] border border-linha bg-superficie shadow-s1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span className="grid flex-1 gap-0.5">
              <span className="font-semibold">Atendimento</span>
              <span className="t-apoio">{SITUACOES_CHAMADO[c.situacao]} · {c.responsavel ?? "sem responsável"}</span>
            </span>
            <Icone nome="baixo" className="h-5 w-5 text-tinta-suave group-open:rotate-180" />
          </summary>
          <div className="border-t border-linha p-4">{atendimento}</div>
        </details>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Cartao id="t-conversa" titulo="Conversa" icone="balao">
          <Conversa mensagens={c.mensagens} condominio={c.condominio} abrir={(id) => void abrirImagem(id)} />
          {c.pode.notaInterna ? (
            <form onSubmit={enviar} noValidate className="grid gap-3 rounded-[16px] border border-linha bg-superficie p-4">
              <div role="group" aria-label="Tipo de mensagem" className="trilho justify-self-start">
                <button type="button" className="chip" aria-pressed={!interna} disabled={!c.pode.responder} onClick={() => setInterna(false)}>Responder</button>
                <button type="button" className="chip" aria-pressed={interna} onClick={() => setInterna(true)}>Nota interna</button>
              </div>
              <CampoAreaTexto id="ch-texto" rotulo={interna ? "Nota interna (o cliente não vê)" : "Resposta ao cliente"} maxLength={4000} value={texto}
                placeholder={interna ? "Escreva a nota" : "Escreva a resposta"} onChange={(e) => setTexto(e.target.value)}
                ajuda={interna ? "Só a equipe TRÍADE lê." : "Chega no sino de quem abriu o chamado."} />
              <Botao type="submit" className="justify-self-end max-md:justify-self-stretch" disabled={!interna && !c.pode.responder}>
                <Icone nome="enviar" />{interna ? "Guardar nota" : "Responder"}
              </Botao>
            </form>
          ) : null}
          <p className="t-apoio text-tinta-suave">Resolvido volta a abrir se o cliente responder em até 7 dias; depois disso, abre-se outro.</p>
        </Cartao>
        {celular ? null : (
          <div className="grid gap-6 lg:sticky lg:top-24">
            {mudanca}
            <Cartao id="t-atendimento" titulo="Atendimento" icone="pessoa">{atendimento}</Cartao>
          </div>
        )}
      </div>
      {pedindo ? (
        <PedirAcessoExcepcional condominio={condominio} nome={c.condominio ?? ""} chamadoId={c.id} aoFechar={() => setPedindo(false)}
          aoPedir={() => { setPedindo(false); setRecado("Pedido de acesso excepcional enviado ao síndico."); }} />
      ) : null}
    </div>
  );
}
