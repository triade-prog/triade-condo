"use client";
// WhatsApp do condomínio na Plataforma (passo 5; W-14, W-15, W-17, MU-02), no padrão novo (canvas
// do novo frontend, quadros 101 a 112). No topo, o trilho de três partes e o selo do número, que
// abre o que era a aba Conexão (decisão A.1 de 22/10/2026). "A identificar" é uma lista com uma
// linha por número; a linha abre a conversa daquele número, com "Registrar pedido com esta
// mensagem" como ação principal (B.1). Mensagem de contato confirmado vira pedido sozinha; aqui
// ficam as de números que ainda não são de ninguém e os recados. "Falhas de envio" mostra o que
// não saiu, com motivo e responsável. "Quedas" (F5.10, W-17): a queda aberta, o canal alternativo
// e a conferência do que ficou parado.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ESTADOS_ENVIO_WHATSAPP, FINALIDADES_ENVIO, formatarDataHora, mostrarTelefone, relatoDasMensagens, SITUACOES_CONEXAO,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio,
  type ErroApi, type NomeIcone,
} from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { OpcoesPedidos, QuedaWhatsapp } from "../tipos.ts";
import { RegistrarPedido } from "../pedidos/RegistrarPedido.tsx";
import { AbaQuedas, FaixaQueda } from "./Quedas.tsx";
import { Bolha, comDias } from "./ConversaWhatsapp.tsx";
import { SituacaoDaConexao, TOM_CONEXAO, type Conexao } from "@triade/configuracoes";

export { SituacaoDaConexao, TOM_CONEXAO, type Conexao };

interface MensagemAIdentificar {
  id: string;
  telefone: string;
  tipo: string;
  texto?: string;
  enviadaEm: string;
  triagem: "A_IDENTIFICAR" | "RECADO";
  /** Chegou com mais de 24 horas (número desconectado): ninguém respondeu sozinho (W-17, W-20). */
  atrasada?: boolean;
  contato?: { id: string; nome: string; unidades?: string };
  vinculoPendente: boolean;
  midia?: { tipo: string; situacao: string; motivo?: string };
}

interface Falha {
  id: string;
  finalidade: keyof typeof FINALIDADES_ENVIO;
  estado: keyof typeof ESTADOS_ENVIO_WHATSAPP;
  motivo?: string;
  tentativas: number;
  criadoEm: string;
  texto: string;
  responsavel?: string;
  para?: string;
  unidades?: string;
  pedido?: { id: string; protocolo: string };
}

interface DadosWhatsapp {
  numero: string | null;
  conexao: Conexao;
  aIdentificar: MensagemAIdentificar[];
  falhas: Falha[];
  pode: { triar: boolean; ligar: boolean; reenviar: boolean; queda?: boolean };
  queda?: QuedaWhatsapp;
  quedas?: QuedaWhatsapp[];
  responsavelQuedas?: string;
}

const PARTES = { identificar: "A identificar", falhas: "Falhas de envio", quedas: "Quedas" } as const;
type Parte = keyof typeof PARTES;
const ICONE: Record<Parte, NomeIcone> = { identificar: "balao", falhas: "alerta", quedas: "relogio" };
const CURTO: Partial<Record<Parte, string>> = { falhas: "Falhas" };
const APOIO: Record<Parte, string> = {
  identificar: "Mensagens de números que ainda não são de ninguém, e recados. Mensagem de contato confirmado já vira pedido sozinha.",
  falhas: "Mensagens que não saíram. Cada uma tem quem cuida.",
  quedas: "Quando o número cai: o canal alternativo e o que ficou parado.",
};

/** As mensagens de um número, da mais antiga à mais nova. */
interface Numero { telefone: string; mensagens: MensagemAIdentificar[]; ultima: MensagemAIdentificar }

function porTelefone(lista: MensagemAIdentificar[]): Numero[] {
  const mapa = new Map<string, MensagemAIdentificar[]>();
  for (const m of lista) mapa.set(m.telefone, [...(mapa.get(m.telefone) ?? []), m]);
  return [...mapa.entries()].map(([telefone, ms]) => {
    const mensagens = [...ms].sort((a, b) => Date.parse(a.enviadaEm) - Date.parse(b.enviadaEm));
    return { telefone, mensagens, ultima: mensagens[mensagens.length - 1]! };
  }).sort((a, b) => Date.parse(b.ultima.enviadaEm) - Date.parse(a.ultima.enviadaEm));
}

const quantas = (n: number, uma: string, varias: string) => (n === 1 ? `1 ${uma}` : `${n} ${varias}`);

/** A situação do número numa palavra: a mais importante primeiro. */
function SeloDoNumero({ n }: { n: Numero }) {
  if (n.mensagens.some((m) => m.atrasada)) return <Selo tom="atencao">Chegou com o número desconectado</Selo>;
  if (n.ultima.triagem === "RECADO") return <Selo tom="info">Recado</Selo>;
  if (n.ultima.vinculoPendente) return <Selo tom="atencao">Vínculo a confirmar</Selo>;
  return <Selo tom="neutro">Número novo</Selo>;
}

function apoioDoNumero(n: Numero): string {
  const c = n.ultima.contato;
  return [c ? `${n.ultima.vinculoPendente ? "Parece de " : ""}${c.nome}${c.unidades ? ` · ${c.unidades}` : ""}` : null,
    quantas(n.mensagens.length, "mensagem", "mensagens")].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------------------
// Topo: o trilho das partes e o selo do número.

function Trilho({ atual, d }: { atual: Parte; d: DadosWhatsapp }) {
  const conta: Record<Parte, number> = { identificar: porTelefone(d.aIdentificar).length, falhas: d.falhas.length, quedas: d.queda ? 1 : 0 };
  return (
    <nav aria-label="Partes do WhatsApp" className="trilho justify-self-start max-md:flex max-md:w-full max-md:flex-nowrap">
      {(Object.keys(PARTES) as Parte[]).map((p) => {
        const e = p === atual;
        const n = conta[p];
        return (
          <Link key={p} href={`/whatsapp?parte=${p}`} replace className={`chip whitespace-nowrap max-md:justify-center ${e ? "max-md:flex-1" : "max-md:shrink-0 max-md:px-3"}`}
            aria-current={e ? "page" : undefined} data-escolhido={e ? "" : undefined}>
            <Icone nome={ICONE[p]} />
            <span className={e ? "" : "max-md:sr-only"}>
              {CURTO[p] ? <><span className="md:hidden">{CURTO[p]}</span><span className="max-md:hidden">{PARTES[p]}</span></> : PARTES[p]}
            </span>
            {n ? <><span className="sr-only"> ({n})</span><span aria-hidden="true" className={`contagem ml-0 ${e ? "bg-superficie" : ""}`}>{n}</span></> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** O selo do número no topo; aberto, mostra a conexão (o que era a aba Conexão). */
function SeloNumero({ d }: { d: DadosWhatsapp }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  const c = d.conexao;
  const piloto = c.oficial === false || c.situacao === "SEM_CREDENCIAIS";
  const curto = d.queda?.estado === "FORA_DO_AR" ? "Fora do ar" : SITUACOES_CONEXAO[c.situacao];
  const texto = `${curto}${piloto && d.queda?.estado !== "FORA_DO_AR" ? " · piloto" : ""}`;
  const tom = d.queda?.estado === "FORA_DO_AR" ? "erro" : TOM_CONEXAO[c.situacao];
  return (
    <div ref={caixa} className="relative">
      <button type="button" className="selo selo-botao" data-tom={tom} aria-expanded={aberto} aria-label={`Número do condomínio: ${texto}`} onClick={() => setAberto(!aberto)}>
        <Icone nome={tom === "erro" ? "alerta" : "whats"} className="h-4 w-4" /><span className="md:hidden">{curto}</span><span className="max-md:hidden">{texto}</span><Icone nome="baixo" className="h-3.5 w-3.5" />
      </button>
      {aberto ? (
        <div role="group" aria-label="Número do condomínio" className="menu-pessoa w-[min(380px,calc(100vw-32px))] gap-3 p-4">
          <SituacaoDaConexao numero={d.numero} conexao={c} />
          <p className="t-apoio">Quem conecta e desconecta é a TRÍADE, pelo Console. Os avisos e os modelos ficam em Configurações › WhatsApp.</p>
          <Link href="/configuracoes/whatsapp" className="inline-flex items-center gap-1 text-sm font-medium text-violeta-600 hover:underline">
            Configurações do WhatsApp<Icone nome="dir" className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// A identificar: a lista e a conversa de cada número.

const COLUNAS = "md:grid-cols-[44px_minmax(0,1.8fr)_minmax(0,0.9fr)_120px_20px]";

function LinhaNumero({ n, abrir }: { n: Numero; abrir: () => void }) {
  const fone = mostrarTelefone(n.telefone);
  return (
    <li className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
      <span className="ladrilho h-11 w-11 self-start rounded-xl md:self-center" data-tom="violeta" aria-hidden="true"><Icone nome="whats" /></span>
      <div className="grid min-w-0 gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <button type="button" onClick={abrir} aria-label={`Abrir a conversa de ${fone}`}
            className="text-left font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{fone}</button>
          <span className="t-apoio whitespace-nowrap md:hidden">{formatarDataHora(n.ultima.enviadaEm)}</span>
        </span>
        <span className="truncate text-sm">{n.ultima.texto ?? "Mensagem sem texto"}</span>
        <span className="t-apoio">{apoioDoNumero(n)}</span>
        <span className="pt-1 md:hidden"><SeloDoNumero n={n} /></span>
      </div>
      <span className="justify-self-start max-md:hidden"><SeloDoNumero n={n} /></span>
      <span className="t-apoio max-md:hidden">{formatarDataHora(n.ultima.enviadaEm)}</span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
    </li>
  );
}

type Etapa = "conversa" | "arquivar" | "ligar" | "juntar" | "registrar";

/** Escolher numa lista que filtra enquanto a pessoa digita. */
function Escolher<T extends { id: string }>({ id, rotulo, ajuda, caminho, ler, grupos, mostrar, escolhido, escolher }: {
  id: string; rotulo: string; ajuda?: string; caminho: (q: string) => string | null; ler: (d: unknown) => T[];
  grupos?: (itens: T[]) => { titulo: string; itens: T[] }[]; mostrar: (x: T) => { titulo: string; apoio?: string }; escolhido: string | null; escolher: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<{ caminho: string; itens: T[] } | null>(null);
  const atual = caminho(q.trim());
  const itens = atual && achados?.caminho === atual ? achados.itens : null;
  useEffect(() => {
    if (!atual) return;
    const controle = new AbortController();
    const espera = setTimeout(() => {
      void chamarApi<unknown>(atual, { sinal: controle.signal }).then((r) => { if (!controle.signal.aborted) setAchados({ caminho: atual, itens: r.ok ? ler(r.dados) : [] }); });
    }, 250);
    return () => { clearTimeout(espera); controle.abort(); };
    // ler é fixo para cada janela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual]);
  const divididos = itens && grupos ? grupos(itens) : itens ? [{ titulo: "", itens }] : [];
  return (
    <div className="grid gap-3">
      <CampoTexto id={id} rotulo={rotulo} ajuda={ajuda} icone="busca" type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      {itens && itens.length === 0 ? <p className="t-apoio">Nada encontrado.</p> : null}
      {divididos.filter((g) => g.itens.length).map((g) => (
        <div key={g.titulo || "todos"} className="grid gap-2">
          {g.titulo ? <p className="t-rotulo">{g.titulo}</p> : null}
          <ul className="grid max-h-64 gap-2 overflow-y-auto">
            {g.itens.map((x) => {
              const m = mostrar(x);
              return (
                <li key={x.id}>
                  <button type="button" className="escolha" aria-current={escolhido === x.id} onClick={() => escolher(x.id)}>
                    <span className="font-medium">{m.titulo}</span>
                    {m.apoio ? <span className="t-apoio">{m.apoio}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface PedidoAchado { id: string; protocolo: string; assunto: string; unidade: string | null; local: string | null; categoria: string; abertoEm: string }
interface ContatoAchado { id: string; nome: string; unidade: string; bloco?: string; estado: string }

function ConversaDoNumero({ n, d, opcoes, aoFechar, feito, registrado }: {
  n: Numero; d: DadosWhatsapp; opcoes: OpcoesPedidos | null; aoFechar: () => void; feito: (texto: string) => void; registrado: (id: string) => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>("conversa");
  const [motivo, setMotivo] = useState("");
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const m = n.ultima;
  const fone = mostrarTelefone(n.telefone);
  const semDono = m.triagem === "A_IDENTIFICAR" && !m.contato;
  const atrasada = n.mensagens.some((x) => x.atrasada);
  const arquivos = n.mensagens.filter((x) => x.midia).length;
  const agora = new Date().toISOString();
  const podeRegistrar = d.pode.triar && !!opcoes?.pode.registrar;
  const ir = (e: Etapa) => { setErro(null); setAlvo(null); setEtapa(e); };

  async function abrirMidia(id: string) {
    const r = await chamarApi<{ url: string }>(`/v1/condominio/whatsapp/mensagens/${id}/midia`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  async function triar(acao: "ARQUIVAR" | "PEDIDO" | "CONTATO", pedidoId?: string) {
    return chamarApi<{ tratadas: number; contatoAtivo?: boolean }>(`/v1/condominio/whatsapp/mensagens/${m.id}/triar`, {
      corpo: { acao, motivo: acao === "ARQUIVAR" ? motivo : null, pedidoId: acao === "PEDIDO" ? (pedidoId ?? alvo) : null, contatoId: acao === "CONTATO" ? alvo : null },
    });
  }

  async function confirmar(acao: "ARQUIVAR" | "PEDIDO" | "CONTATO") {
    setErro(null);
    setEnviando(true);
    const r = await triar(acao);
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    feito(acao === "ARQUIVAR" ? "Conversa arquivada."
      : acao === "PEDIDO" ? "Mensagens juntadas ao pedido."
      : r.dados.contatoAtivo ? "Número ligado ao contato. As próximas mensagens já são reconhecidas."
      : "Número ligado ao contato. Ele só é reconhecido depois de o vínculo com a unidade ser confirmado.");
  }

  if (etapa === "registrar" && opcoes) {
    const origem = (
      <div className="grid gap-3">
        <p className="flex items-center gap-2.5 rounded-[14px] border border-violeta-100 bg-violeta-50 px-3.5 py-2.5 text-sm">
          <Icone nome="whats" className="h-4.5 w-4.5 shrink-0 text-violeta-700" />
          <span>Das mensagens de <b className="font-semibold">{fone}</b> · {quantas(n.mensagens.length, "mensagem", "mensagens")}{arquivos ? ` e ${quantas(arquivos, "arquivo", "arquivos")}` : ""} vão junto com o pedido</span>
        </p>
        {m.triagem === "A_IDENTIFICAR" ? (
          <Aviso tom="atencao" titulo="O morador não recebe o protocolo pelo WhatsApp">
            O número ainda não é de um contato confirmado. Ligue o número a um contato depois, para os próximos retornos irem por ali.
          </Aviso>
        ) : null}
      </div>
    );
    return (
      <RegistrarPedido aberto opcoes={opcoes} aoFechar={aoFechar} registrado={(_, id) => registrado(id)}
        daMensagem={{ origem, relato: relatoDasMensagens(n.mensagens), juntar: async (pedidoId) => (await triar("PEDIDO", pedidoId)).ok }} />
    );
  }

  const titulo = { conversa: fone, arquivar: "Arquivar a conversa", ligar: "Ligar o número a um contato", juntar: "Juntar a um pedido", registrar: fone }[etapa];
  const voltar = <Botao variante="discreto" onClick={() => ir("conversa")}>Voltar</Botao>;
  const citacao = <p className="text-sm">{fone}{m.texto ? `: “${m.texto}”` : ""}</p>;
  const unidadeDoContato = m.contato?.unidades;

  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar} media fechar
      apoio={etapa === "conversa" ? `${m.triagem === "RECADO" ? "Recado" : "A identificar"} · desde ${formatarDataHora(n.mensagens[0]!.enviadaEm)}`
        : etapa === "juntar" ? "Os pedidos em andamento; os da unidade do contato primeiro." : undefined}>
      {erro && etapa !== "arquivar" ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {etapa === "conversa" ? (
        <div className="grid gap-4">
          <p className="flex flex-wrap items-center gap-2"><SeloDoNumero n={n} /><span className="t-apoio">{apoioDoNumero(n)}</span></p>
          {atrasada ? (
            <Aviso tom="atencao" titulo="Chegou com o número desconectado">
              Chegou quando o número estava fora do ar, por isso ninguém respondeu sozinho.
            </Aviso>
          ) : null}
          <ol aria-label="Mensagens" className="grid gap-2.5">
            {comDias(n.mensagens, (x) => x.enviadaEm, agora, (x) => (
              <Bolha key={x.id} lado="MORADOR" rodape={<>{x.contato?.nome ?? "Morador"} · {formatarDataHora(x.enviadaEm).slice(-5)}</>}>
                {x.texto ? <span className="whitespace-pre-line">{x.texto}</span> : x.midia ? null : <span className="text-tinta-suave">Mensagem sem texto.</span>}
                {x.midia ? (
                  x.midia.situacao === "LIBERADA"
                    ? <Botao variante="contorno" tamanho="p" className="justify-self-start" onClick={() => void abrirMidia(x.id)}><Icone nome="clipe" />Abrir o arquivo</Botao>
                    : <span className="text-xs text-tinta-suave">Arquivo {x.midia.situacao === "BAIXAR" ? "sendo conferido" : `não liberado: ${x.midia.motivo ?? ""}`}</span>
                ) : null}
              </Bolha>
            ))}
          </ol>
          {semDono ? (
            <Aviso tom="info" titulo="Este número não é de ninguém ainda">
              Se souber quem é, ligue a um contato antes de registrar: assim a pessoa recebe o protocolo pelo WhatsApp.
              {d.pode.ligar ? <span className="mt-2 block"><Botao variante="contorno" tamanho="m" onClick={() => ir("ligar")}><Icone nome="pessoa" />Ligar a um contato</Botao></span> : null}
            </Aviso>
          ) : null}
          {m.vinculoPendente ? (
            <Aviso tom="atencao" titulo="O vínculo com a unidade está a confirmar">
              Enquanto não for confirmado, o número não é reconhecido e não recebe o protocolo.{" "}
              <Link href="/moradores?estado=PENDENTE" className="font-medium text-violeta-600 underline">Conferir vínculo</Link>
            </Aviso>
          ) : null}
          {!d.pode.triar ? <p className="t-apoio">Quem só vê os pedidos lê a conversa, sem registrar, juntar ou arquivar.</p> : null}
          {d.pode.triar ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-4 max-md:grid max-md:grid-cols-1">
              <Botao variante="discreto" onClick={() => ir("arquivar")} className="max-md:order-3"><Icone nome="fechar" />Arquivar a conversa</Botao>
              <span className="ml-auto flex flex-wrap justify-end gap-2 max-md:contents">
                <Botao variante="contorno" onClick={() => ir("juntar")} className="max-md:order-2"><Icone nome="link" />Juntar a um pedido</Botao>
                {podeRegistrar ? <Botao onClick={() => ir("registrar")} className="max-md:order-1"><Icone nome="pedido" />Registrar pedido com esta mensagem</Botao> : null}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {etapa === "arquivar" ? (
        <div className="grid gap-4">
          {citacao}
          {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <CampoAreaTexto id="tri-motivo" rotulo="Motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (3 a 300 caracteres)." : null}
            ajuda="Todas as mensagens deste número saem de A identificar e ficam guardadas." />
          <div className="flex justify-end gap-2">{voltar}<Botao disabled={enviando} onClick={() => void confirmar("ARQUIVAR")}>Arquivar</Botao></div>
        </div>
      ) : null}

      {etapa === "ligar" ? (
        <div className="grid gap-4">
          {citacao}
          <Escolher<ContatoAchado> id="tri-contato" rotulo="Nome ou unidade" ajuda="Filtra enquanto você digita." escolhido={alvo} escolher={setAlvo}
            caminho={(q) => (q.length >= 2 ? `/v1/condominio/moradores?busca=${encodeURIComponent(q)}` : null)}
            ler={(x) => (x as { itens: { contatoId: string; nome: string; unidade: string; bloco?: string; estado: string }[] }).itens
              .map((c) => ({ ...c, id: c.contatoId })).filter((c, i, l) => l.findIndex((y) => y.id === c.id) === i)}
            mostrar={(c) => ({ titulo: c.nome, apoio: `${[c.bloco, c.unidade].filter(Boolean).join(" · ")}${c.estado === "PENDENTE" ? " · vínculo a confirmar" : ""}` })} />
          <p className="t-apoio">O telefone não prova quem é a pessoa: confira antes de ligar. O número passa a ser o telefone do contato.</p>
          <div className="flex justify-end gap-2">{voltar}<Botao disabled={!alvo || enviando} onClick={() => void confirmar("CONTATO")}><Icone nome="pessoa" />Ligar ao contato</Botao></div>
        </div>
      ) : null}

      {etapa === "juntar" ? (
        <div className="grid gap-4">
          {citacao}
          <Escolher<PedidoAchado> id="tri-pedido" rotulo="Buscar pedido" ajuda="Protocolo, assunto ou unidade. Filtra enquanto você digita." escolhido={alvo} escolher={setAlvo}
            caminho={(q) => `/v1/condominio/pedidos?busca=${encodeURIComponent(q)}`}
            ler={(x) => (x as { itens: PedidoAchado[] }).itens}
            grupos={(itens) => {
              const daUnidade = unidadeDoContato ? itens.filter((p) => p.unidade && unidadeDoContato.includes(p.unidade)) : [];
              return [{ titulo: `Em andamento em ${unidadeDoContato}`, itens: daUnidade }, { titulo: daUnidade.length ? "Os outros" : "Em andamento", itens: itens.filter((p) => !daUnidade.includes(p)) }];
            }}
            mostrar={(p) => ({ titulo: `${p.protocolo} · ${p.assunto}`, apoio: [p.unidade ?? p.local, p.categoria, `aberto em ${formatarDataHora(p.abertoEm).slice(0, 10)}`].filter(Boolean).join(" · ") })} />
          <p className="t-apoio">As mensagens deste número vão para a conversa do pedido, com os arquivos. O número continua sem vínculo até alguém confirmar.</p>
          <div className="flex justify-end gap-2">{voltar}<Botao disabled={!alvo || enviando} onClick={() => void confirmar("PEDIDO")}><Icone nome="link" />Juntar ao pedido</Botao></div>
        </div>
      ) : null}
    </Dialogo>
  );
}

function AIdentificar({ d, opcoes, recarregar }: { d: DadosWhatsapp; opcoes: OpcoesPedidos | null; recarregar: () => void }) {
  const { atualizar } = usePlataforma();
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const numeros = porTelefone(d.aIdentificar);
  const n = numeros.find((x) => x.telefone === aberto);
  const total = d.aIdentificar.length;

  return (
    <div className="grid gap-3">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {numeros.length === 0 ? (
        <Vazio titulo="Nada a identificar" icone="balao">Mensagens de números que ainda não são de ninguém e os recados aparecem aqui.</Vazio>
      ) : (
        <section aria-label="A identificar" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
          <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
            <span /><span className="t-rotulo">Número e última mensagem</span><span className="t-rotulo">Situação</span><span className="t-rotulo">Chegou</span><span />
          </div>
          <ul className="grid max-md:gap-3">{numeros.map((x) => <LinhaNumero key={x.telefone} n={x} abrir={() => { setRecado(null); setAberto(x.telefone); }} />)}</ul>
          <p className="t-apoio py-4 md:border-t md:border-linha md:px-5">
            {quantas(numeros.length, "número", "números")} · {quantas(total, "mensagem", "mensagens")}. Uma linha por número; a mais recente primeiro.
          </p>
        </section>
      )}
      {n ? (
        <ConversaDoNumero key={n.telefone} n={n} d={d} opcoes={opcoes} aoFechar={() => { setAberto(null); recarregar(); }}
          feito={(t) => { setAberto(null); setRecado(t); recarregar(); atualizar(); }}
          registrado={(id) => { setAberto(null); atualizar(); router.push(`/pedidos/pedido?id=${id}&novo=1`); }} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Falhas de envio.

const COLUNAS_FALHA = "md:grid-cols-[44px_minmax(0,1.8fr)_minmax(0,0.8fr)_auto]";

function Falhas({ d, recarregar }: { d: DadosWhatsapp; recarregar: () => void }) {
  const { atualizar } = usePlataforma();
  const [aberta, setAberta] = useState<{ f: Falha; acao: "reenviar" | "resolver" } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  async function confirmar() {
    if (!aberta) return;
    setErro(null);
    const r = await chamarApi(`/v1/condominio/whatsapp/envios/${aberta.f.id}/${aberta.acao}`, { corpo: { motivo } });
    if (!r.ok) return setErro(r.erro);
    setRecado(aberta.acao === "reenviar" ? "Mensagem de novo na fila." : "Falha dada por resolvida.");
    setAberta(null);
    setMotivo("");
    recarregar();
    atualizar();
  }

  return (
    <div className="grid gap-3">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {d.falhas.length === 0 ? <Vazio titulo="Nenhuma falha de envio" icone="check">Quando uma mensagem não sair, ela aparece aqui com o motivo e quem cuida.</Vazio> : (
        <section aria-label="Falhas de envio" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
          <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS_FALHA}`}>
            <span /><span className="t-rotulo">Mensagem</span><span className="t-rotulo">Por quê</span><span />
          </div>
          <ul className="grid max-md:gap-3">
            {d.falhas.map((f) => (
              <li key={f.id} className={`grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-5 py-3 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS_FALHA} md:border-t md:border-linha md:first:border-t-0`}>
                <span className="ladrilho h-11 w-11 self-start rounded-xl md:self-center" data-tom="erro" aria-hidden="true"><Icone nome="alerta" /></span>
                <div className="grid min-w-0 gap-0.5">
                  <span className="font-medium">{FINALIDADES_ENVIO[f.finalidade]}{f.para ? ` para ${f.para}` : ""}{f.unidades ? ` · ${f.unidades}` : ""}</span>
                  <span className="line-clamp-2 whitespace-pre-line text-sm">“{f.texto}”</span>
                  <span className="t-apoio">
                    {f.pedido ? <><Link href={`/pedidos/pedido?id=${f.pedido.id}`} className="font-medium text-violeta-600 hover:underline">Pedido {f.pedido.protocolo}</Link> · </> : null}
                    {formatarDataHora(f.criadoEm)} · {quantas(f.tentativas, "tentativa", "tentativas")}{f.responsavel ? ` · quem cuida: ${f.responsavel}` : ""}
                  </span>
                </div>
                <span className="justify-self-start max-md:col-start-2">
                  <Selo tom={f.estado === "FALHOU" ? "erro" : "atencao"}>{f.motivo ?? ESTADOS_ENVIO_WHATSAPP[f.estado]}</Selo>
                </span>
                <span className="flex flex-wrap justify-end gap-2 max-md:col-span-2 max-md:justify-start">
                  <Botao variante="discreto" tamanho="m" onClick={() => setAberta({ f, acao: "resolver" })}>Avisei por outro meio</Botao>
                  {/* Comunicado não tem reenvio (F6.6): a pessoa lê pelo grupo, pelo mural ou pelo e-mail. */}
                  {d.pode.reenviar && f.finalidade !== "COMUNICADO" ? <Botao variante="contorno" tamanho="m" onClick={() => setAberta({ f, acao: "reenviar" })}><Icone nome="enviar" />Reenviar</Botao> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="t-apoio py-4 md:border-t md:border-linha md:px-5">{quantas(d.falhas.length, "falha", "falhas")}.</p>
        </section>
      )}
      <p className="t-apoio">
        Falha passageira tenta de novo sozinha, com intervalo crescente. Tempo esgotado fica como resultado desconhecido: pode ter saído, então nada é repetido sem você.
        Reenviar e Avisei por outro meio pedem o motivo; comunicado não tem reenvio.
      </p>
      {aberta ? (
        <Dialogo aberto titulo={aberta.acao === "reenviar" ? "Reenviar a mensagem" : "Dar a falha por resolvida"} aoFechar={() => setAberta(null)}>
          <div className="grid gap-4">
            {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
            <CampoAreaTexto id="falha-motivo" rotulo={aberta.acao === "reenviar" ? "Por que reenviar" : "O que foi feito"} required maxLength={300}
              value={motivo} onChange={(e) => setMotivo(e.target.value)}
              erro={camposComErro(erro).includes("motivo") ? "Escreva de 3 a 300 caracteres." : null} />
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setAberta(null)}>Voltar</Botao>
              <Botao onClick={() => void confirmar()}>{aberta.acao === "reenviar" ? "Reenviar" : "Confirmar"}</Botao>
            </div>
          </div>
        </Dialogo>
      ) : null}
    </div>
  );
}

export function Whatsapp() {
  const busca = useSearchParams();
  const router = useRouter();
  const carga = useCarregar<DadosWhatsapp>("/v1/condominio/whatsapp");
  const opcoes = useCarregar<OpcoesPedidos>(carga.estado === "pronto" && carga.dados.pode.triar ? "/v1/condominio/pedidos/opcoes" : null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o WhatsApp…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const pedida = busca.get("parte");
  const atual: Parte = pedida && pedida in PARTES ? (pedida as Parte) : d.queda ? "quedas" : "identificar";
  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <Trilho atual={atual} d={d} />
        <div className="flex items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="t-titulo-tela">WhatsApp</h1>
            <p className="t-apoio mt-1">{APOIO[atual]}</p>
          </div>
          <SeloNumero d={d} />
        </div>
      </div>
      {d.queda ? <FaixaQueda q={d.queda} /> : d.conexao.situacao === "DESCONECTADO" ? (
        <Aviso tom="erro" titulo="O WhatsApp do condomínio está desconectado">
          As mensagens dos moradores não chegam e os envios esperam na fila. A TRÍADE já foi avisada. Enquanto isso, atenda por telefone e registre no painel.
          {d.pode.queda ? <> <Link href="/whatsapp?parte=quedas" replace className={classeBotao("discreto", "!px-0", "m")}>Ver Quedas</Link></> : null}
        </Aviso>
      ) : null}
      {atual === "identificar" ? <AIdentificar d={d} opcoes={opcoes.estado === "pronto" ? opcoes.dados : null} recarregar={carga.recarregar} /> : null}
      {atual === "falhas" ? <Falhas d={d} recarregar={carga.recarregar} /> : null}
      {atual === "quedas" ? (
        <AbaQuedas queda={d.queda} quedas={d.quedas ?? []} responsavel={d.responsavelQuedas} pode={d.pode.queda === true}
          noAr={d.conexao.situacao === "CONECTADO"}
          // Sem a parte no endereço, encerrar a queda mudaria a parte escolhida: fica em Quedas.
          recarregar={() => { if (!pedida) router.replace("/whatsapp?parte=quedas"); carga.recarregar(); }} />
      ) : null}
    </div>
  );
}
