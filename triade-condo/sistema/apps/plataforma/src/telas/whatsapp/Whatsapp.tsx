"use client";
// WhatsApp do condomínio na Plataforma (passo 5; W-14, W-15, W-17, MU-02), tela 5 do desenho:
// "A identificar" junta as mensagens de números sem vínculo confirmado e os recados; "Falhas de
// envio" mostra o que não saiu, com motivo e responsável; "Conexão" diz se o número está no ar.
// Nada vira pedido sozinho: quem cuida liga o número a um contato, junta a um pedido ou arquiva.
// "Quedas" (F5.10, W-17): a queda aberta, o canal alternativo e a conferência do que ficou parado.

import Link from "next/link";
import { useState } from "react";
import { ESTADOS_ENVIO_WHATSAPP, FINALIDADES_ENVIO, formatarDataHora, mostrarTelefone } from "@triade/domain";
import {
  Abas, Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio,
  type ErroApi,
} from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { QuedaWhatsapp } from "../tipos.ts";
import { AbaQuedas, FaixaQueda } from "./Quedas.tsx";
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


const ABAS = [
  { id: "identificar", texto: "A identificar" },
  { id: "falhas", texto: "Falhas de envio" },
  { id: "quedas", texto: "Quedas" },
  { id: "conexao", texto: "Conexão" },
] as const;
type IdAba = (typeof ABAS)[number]["id"];

/** Um telefone por linha: a mensagem mais nova e quantas mais. */
function porTelefone(lista: MensagemAIdentificar[]) {
  const mapa = new Map<string, { ultima: MensagemAIdentificar; total: number }>();
  for (const m of lista) {
    const atual = mapa.get(m.telefone);
    if (atual) atual.total++;
    else mapa.set(m.telefone, { ultima: m, total: 1 });
  }
  return [...mapa.values()];
}

type Triagem = { mensagem: MensagemAIdentificar; acao: "ARQUIVAR" | "PEDIDO" | "CONTATO" };

function Escolher<T extends { id: string }>({ rotulo, caminho, ler, mostrar, escolhido, escolher }: {
  rotulo: string; caminho: (q: string) => string; ler: (d: unknown) => T[]; mostrar: (x: T) => string; escolhido: string | null; escolher: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [itens, setItens] = useState<T[] | null>(null);
  async function buscar() {
    const r = await chamarApi<unknown>(caminho(q.trim()));
    setItens(r.ok ? ler(r.dados) : []);
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <CampoTexto id="tri-busca" rotulo={rotulo} value={q} maxLength={60} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void buscar(); } }} />
        </div>
        <Botao variante="contorno" onClick={() => void buscar()}>Buscar</Botao>
      </div>
      {itens && itens.length === 0 ? <p className="text-sm text-tinta-suave">Nada encontrado.</p> : null}
      {itens && itens.length ? (
        <ul className="grid max-h-56 gap-1 overflow-y-auto">
          {itens.map((x) => (
            <li key={x.id}>
              <button type="button" aria-pressed={escolhido === x.id} onClick={() => escolher(x.id)}
                className="w-full rounded-lg border border-linha px-3 py-2 text-left text-sm hover:border-violeta-300 aria-[pressed=true]:border-violeta-600 aria-[pressed=true]:bg-violeta-50">
                {mostrar(x)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function JanelaTriagem({ t, aoFechar, aoTerminar }: { t: Triagem; aoFechar: () => void; aoTerminar: (texto: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const titulo = { ARQUIVAR: "Arquivar a conversa", PEDIDO: "Juntar a um pedido", CONTATO: "Ligar o número a um contato" }[t.acao];

  async function confirmar() {
    setErro(null);
    const r = await chamarApi<{ tratadas: number; contatoAtivo?: boolean }>(`/v1/condominio/whatsapp/mensagens/${t.mensagem.id}/triar`, {
      corpo: { acao: t.acao, motivo: t.acao === "ARQUIVAR" ? motivo : null, pedidoId: t.acao === "PEDIDO" ? alvo : null, contatoId: t.acao === "CONTATO" ? alvo : null },
    });
    if (!r.ok) return setErro(r.erro);
    aoTerminar(t.acao === "ARQUIVAR" ? "Conversa arquivada."
      : t.acao === "PEDIDO" ? "Mensagens juntadas ao pedido."
      : r.dados.contatoAtivo ? "Número ligado ao contato. As próximas mensagens já são reconhecidas."
      : "Número ligado ao contato. Ele só é reconhecido depois de o vínculo com a unidade ser confirmado.");
  }

  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar}>
      <div className="grid gap-4">
        <p className="text-sm">{mostrarTelefone(t.mensagem.telefone)}{t.mensagem.texto ? `: “${t.mensagem.texto}”` : ""}</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {t.acao === "ARQUIVAR" ? (
          <CampoAreaTexto id="tri-motivo" rotulo="Motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={camposComErro(erro).includes("motivo") ? "Diga o motivo (3 a 300 caracteres)." : null} />
        ) : null}
        {t.acao === "PEDIDO" ? (
          <Escolher<{ id: string; protocolo: string; assunto: string; unidade?: string }> rotulo="Protocolo, assunto ou unidade" escolhido={alvo} escolher={setAlvo}
            caminho={(q) => `/v1/condominio/pedidos?busca=${encodeURIComponent(q)}`}
            ler={(d) => (d as { itens: { id: string; protocolo: string; assunto: string; unidade?: string }[] }).itens}
            mostrar={(p) => `${p.protocolo} · ${p.assunto}${p.unidade ? ` (${p.unidade})` : ""}`} />
        ) : null}
        {t.acao === "CONTATO" ? (
          <>
            <Escolher<{ id: string; nome: string; unidade: string; bloco?: string; estado: string }> rotulo="Nome ou unidade" escolhido={alvo} escolher={setAlvo}
              caminho={(q) => `/v1/condominio/moradores?busca=${encodeURIComponent(q)}`}
              ler={(d) => (d as { itens: { contatoId: string; nome: string; unidade: string; bloco?: string; estado: string }[] }).itens
                .map((x) => ({ ...x, id: x.contatoId })).filter((x, i, l) => l.findIndex((y) => y.id === x.id) === i)}
              mostrar={(x) => `${x.nome} · ${[x.bloco, x.unidade].filter(Boolean).join(" · ")}${x.estado === "PENDENTE" ? " · vínculo a confirmar" : ""}`} />
            <p className="text-xs text-tinta-suave">O telefone não prova quem é a pessoa: confira antes de ligar. O número passa a ser o telefone do contato.</p>
          </>
        ) : null}
        <div className="flex justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao onClick={() => void confirmar()} disabled={t.acao !== "ARQUIVAR" && !alvo}>Confirmar</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

function AIdentificar({ d, recarregar }: { d: DadosWhatsapp; recarregar: () => void }) {
  const { atualizar } = usePlataforma();
  const [triagem, setTriagem] = useState<Triagem | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const grupos = porTelefone(d.aIdentificar);

  async function abrirMidia(id: string) {
    const r = await chamarApi<{ url: string }>(`/v1/condominio/whatsapp/mensagens/${id}/midia`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  return (
    <div className="grid gap-3">
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {grupos.length === 0 ? <Vazio titulo="Nada a identificar">Mensagens de números sem vínculo confirmado e recados aparecem aqui.</Vazio> : (
        <ul className="grid gap-2.5">
          {grupos.map(({ ultima: m, total }) => (
            <li key={m.telefone} className="grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <strong className="font-semibold">{m.contato ? `${m.contato.nome}${m.contato.unidades ? ` · ${m.contato.unidades}` : ""}` : mostrarTelefone(m.telefone)}</strong>
                {m.atrasada ? <Selo tom="atencao">Chegou com o número desconectado</Selo> : null}
                {m.triagem === "RECADO" ? <Selo tom="info">Recado</Selo> : m.vinculoPendente ? <Selo tom="atencao">Vínculo a confirmar</Selo> : <Selo tom="neutro">Número novo</Selo>}
                <span className="text-xs text-tinta-suave">{formatarDataHora(m.enviadaEm)}{total > 1 ? ` · ${total} mensagens` : ""}</span>
              </span>
              {m.texto ? <p className="whitespace-pre-line text-sm">{m.texto}</p> : <p className="text-sm text-tinta-suave">Mensagem sem texto.</p>}
              {m.midia ? (
                m.midia.situacao === "LIBERADA" ? <Botao variante="contorno" tamanho="p" className="justify-self-start" onClick={() => void abrirMidia(m.id)}>Abrir o arquivo</Botao>
                  : <p className="text-xs text-tinta-suave">Arquivo {m.midia.situacao === "BAIXAR" ? "sendo conferido" : `não liberado: ${m.midia.motivo ?? ""}`}</p>
              ) : null}
              <span className="flex flex-wrap gap-2">
                {d.pode.ligar && m.triagem === "A_IDENTIFICAR" ? <Botao variante="contorno" tamanho="m" onClick={() => setTriagem({ mensagem: m, acao: "CONTATO" })}>Ligar a um contato</Botao> : null}
                {m.vinculoPendente ? <Link href="/moradores?estado=PENDENTE" className="inline-flex items-center text-sm font-medium text-violeta-600 hover:underline">Conferir vínculo</Link> : null}
                {d.pode.triar ? <Botao variante="contorno" tamanho="m" onClick={() => setTriagem({ mensagem: m, acao: "PEDIDO" })}>Juntar a um pedido</Botao> : null}
                {d.pode.triar ? <Botao variante="discreto" tamanho="m" onClick={() => setTriagem({ mensagem: m, acao: "ARQUIVAR" })}>Arquivar</Botao> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">Nada vira pedido sozinho. Para registrar um pedido para a unidade, use Pedidos e depois junte as mensagens a ele.</p>
      {triagem ? <JanelaTriagem t={triagem} aoFechar={() => setTriagem(null)} aoTerminar={(t) => { setTriagem(null); setRecado(t); recarregar(); atualizar(); }} /> : null}
    </div>
  );
}

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
      {d.falhas.length === 0 ? <Vazio titulo="Nenhuma falha de envio">Quando uma mensagem não sair, ela aparece aqui com o motivo e quem cuida.</Vazio> : (
        <ul className="grid gap-2.5">
          {d.falhas.map((f) => (
            <li key={f.id} className="grid gap-1.5 rounded-2xl border border-linha bg-superficie p-4 text-sm shadow-s1">
              <span className="flex flex-wrap items-center gap-2">
                <Selo tom={f.estado === "FALHOU" ? "erro" : "atencao"}>{ESTADOS_ENVIO_WHATSAPP[f.estado]}</Selo>
                <strong className="font-semibold">{FINALIDADES_ENVIO[f.finalidade]}{f.para ? ` para ${f.para}` : ""}{f.unidades ? ` (${f.unidades})` : ""}</strong>
              </span>
              <span className="text-tinta-suave">{f.motivo ?? "Sem motivo do provedor"} · {formatarDataHora(f.criadoEm)} · {f.tentativas === 1 ? "1 tentativa" : `${f.tentativas} tentativas`}{f.responsavel ? ` · cuida: ${f.responsavel}` : ""}</span>
              <span className="line-clamp-2 whitespace-pre-line">{f.texto}</span>
              <span className="flex flex-wrap gap-2">
                {f.pedido ? <Link href={`/pedidos/pedido?id=${f.pedido.id}`} className="inline-flex items-center font-medium text-violeta-600 hover:underline">Pedido {f.pedido.protocolo}</Link> : null}
                {/* Comunicado não tem reenvio (F6.6): a pessoa lê pelo grupo, pelo mural ou pelo e-mail. */}
                {d.pode.reenviar && f.finalidade !== "COMUNICADO" ? <Botao variante="contorno" tamanho="m" onClick={() => setAberta({ f, acao: "reenviar" })}>Reenviar com motivo</Botao> : null}
                <Botao variante="discreto" tamanho="m" onClick={() => setAberta({ f, acao: "resolver" })}>Avisei por outro meio</Botao>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">Falha passageira tenta de novo sozinha, com intervalo crescente. Tempo esgotado fica como resultado desconhecido: pode ter saído, então não repete sozinho.</p>
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
  const carga = useCarregar<DadosWhatsapp>("/v1/condominio/whatsapp");
  const [aba, setAba] = useState<IdAba | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando o WhatsApp…" />;
  if (carga.estado === "erro") return <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const d = carga.dados;
  const telefones = porTelefone(d.aIdentificar).length;
  const abas = ABAS.map((a) => (a.id === "identificar" && telefones ? { ...a, texto: `${a.texto} (${telefones})` }
    : a.id === "falhas" && d.falhas.length ? { ...a, texto: `${a.texto} (${d.falhas.length})` }
      : a.id === "quedas" && d.queda ? { ...a, texto: `${a.texto} (1)` } : a));
  const atual: IdAba = aba ?? (d.queda ? "quedas" : "identificar");
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">WhatsApp</h1>
        <p className="text-tinta-suave">Mensagens que precisam de alguém e envios que não deram certo.</p>
      </div>
      {d.queda ? <FaixaQueda q={d.queda} /> : d.conexao.situacao === "DESCONECTADO" ? <SituacaoDaConexao numero={d.numero} conexao={d.conexao} /> : null}
      <Abas abas={abas} atual={atual} aoMudar={setAba} rotulo="Partes do WhatsApp">
        <div className="pt-4">
          {atual === "identificar" ? <AIdentificar d={d} recarregar={carga.recarregar} /> : null}
          {atual === "falhas" ? <Falhas d={d} recarregar={carga.recarregar} /> : null}
          {atual === "quedas" ? (
            <AbaQuedas queda={d.queda} quedas={d.quedas ?? []} responsavel={d.responsavelQuedas} pode={d.pode.queda === true}
              recarregar={() => { setAba("quedas"); carga.recarregar(); }} />
          ) : null}
          {atual === "conexao" ? <SituacaoDaConexao numero={d.numero} conexao={d.conexao} /> : null}
        </div>
      </Abas>
    </div>
  );
}
