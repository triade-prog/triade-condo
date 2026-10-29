"use client";
// Os convites do orçamento (R8, OC-02; quadros 472 e 475): quem convidar (prestadores do cadastro
// e quem não está nele, com nome e WhatsApp ou e-mail) e a janela "Mandar convite", com o link só
// daquele fornecedor, a mensagem pronta que sai do WhatsApp de quem manda e o Copiar o link. O
// e-mail sai sozinho pela fila. Ninguém vê o preço do outro.

import { useState, type FormEvent } from "react";
import { CANAIS_CONVITE, type CanalConvite } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, camposComErro, chamarApi, classeBotao, Dialogo, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { Caixa, Escolha } from "../moradores/comum.tsx";
import { diaHoraPrazo, enderecoWhatsapp, linkDoConvite, NOTA_CONVITE } from "./comum.tsx";
import type { LinkConvite, OpcoesOrcamento } from "./tipos.ts";

/** Quem não está no cadastro: nome e WhatsApp ou e-mail. Vira prestador só se a proposta dele for a escolhida. */
export interface ConvidadoNovo { chave: string; nome: string; canal: CanalConvite; celular: string; email: string }

export interface Convidados { prestadores: string[]; novos: ConvidadoNovo[] }

export const SEM_CONVIDADOS: Convidados = { prestadores: [], novos: [] };

export const totalConvidados = (c: Convidados) => c.prestadores.length + c.novos.length;

/** O corpo da API: o prestador pelo id; o novo com nome e contato. */
export function convitesParaApi(c: Convidados, o: OpcoesOrcamento) {
  return [
    ...c.prestadores.map((prestadorId) => ({ prestadorId, canal: o.prestadores.find((p) => p.id === prestadorId)?.canal ?? "WHATSAPP" })),
    ...c.novos.map((n) => ({ nome: n.nome.trim(), canal: n.canal, celular: n.canal === "WHATSAPP" ? n.celular.replace(/\D/g, "") : null, email: n.canal === "EMAIL" ? n.email.trim() : null })),
  ];
}

let n = 0;
const novaChave = () => `novo-${++n}`;

/** Quem convidar (quadro 472): os prestadores do cadastro como cartões para marcar, e os de fora. */
export function EscolherConvidados({ o, valor, mudar, jaConvidados = [], erro, prefixo = "oc" }: {
  o: OpcoesOrcamento; valor: Convidados; mudar: (c: Convidados) => void; jaConvidados?: string[]; erro?: string | null; prefixo?: string;
}) {
  const prestadores = o.prestadores.filter((p) => !jaConvidados.includes(p.id));
  const marcar = (id: string, sim: boolean) => mudar({ ...valor, prestadores: sim ? [...valor.prestadores, id] : valor.prestadores.filter((x) => x !== id) });
  const mudarNovo = (chave: string, x: Partial<ConvidadoNovo>) => mudar({ ...valor, novos: valor.novos.map((v) => (v.chave === chave ? { ...v, ...x } : v)) });
  return (
    <div className="grid gap-3">
      {prestadores.length ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-apoio font-medium">Prestadores do cadastro</legend>
          {prestadores.map((p) => (
            <div key={p.id} className={`rounded-[14px] border px-4 py-3 ${valor.prestadores.includes(p.id) ? "border-violeta-600 bg-violeta-50" : "border-linha bg-superficie"}`}>
              <Caixa id={`${prefixo}-prestador-${p.id}`} rotulo={p.nome} marcada={valor.prestadores.includes(p.id)} aoMudar={(v) => marcar(p.id, v)}
                ajuda={["Prestador", p.servico, p.servicosFeitos ? `fez ${p.servicosFeitos === 1 ? "1 serviço" : `${p.servicosFeitos} serviços`} aqui` : "ainda não fez serviço aqui", CANAIS_CONVITE[p.canal]].filter(Boolean).join(" · ")} />
            </div>
          ))}
        </fieldset>
      ) : <p className="t-apoio">Nenhum prestador no cadastro para este serviço. Convide quem não está nele.</p>}
      {valor.novos.map((v, i) => (
        <fieldset key={v.chave} className="grid gap-3 rounded-[14px] border border-linha p-4">
          <legend className="t-apoio font-medium">Convidado {i + 1}, fora do cadastro</legend>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CampoTexto id={`${prefixo}-novo-nome-${v.chave}`} rotulo="Nome" required maxLength={120} value={v.nome} onChange={(e) => mudarNovo(v.chave, { nome: e.target.value })} />
            <CampoSelecao id={`${prefixo}-novo-canal-${v.chave}`} rotulo="Mandar por" value={v.canal} onChange={(e) => mudarNovo(v.chave, { canal: e.target.value as CanalConvite })}
              opcoes={[{ valor: "WHATSAPP", texto: "WhatsApp" }, { valor: "EMAIL", texto: "E-mail" }]} />
          </div>
          {v.canal === "WHATSAPP"
            ? <CampoTexto id={`${prefixo}-novo-celular-${v.chave}`} rotulo="WhatsApp" required inputMode="tel" maxLength={20} value={v.celular} onChange={(e) => mudarNovo(v.chave, { celular: e.target.value })} ajuda="Com o DDD, como (61) 9 8123-4567." />
            : <CampoTexto id={`${prefixo}-novo-email-${v.chave}`} rotulo="E-mail" required type="email" maxLength={120} value={v.email} onChange={(e) => mudarNovo(v.chave, { email: e.target.value })} />}
          <Botao variante="discreto" tamanho="m" className="justify-self-start" onClick={() => mudar({ ...valor, novos: valor.novos.filter((x) => x.chave !== v.chave) })}><Icone nome="fechar" />Tirar este convidado</Botao>
        </fieldset>
      ))}
      <div className="grid gap-1">
        <Botao variante="contorno" className="justify-self-start" onClick={() => mudar({ ...valor, novos: [...valor.novos, { chave: novaChave(), nome: "", canal: "WHATSAPP", celular: "", email: "" }] })}>
          <Icone nome="mais" />Convidar quem não está no cadastro
        </Botao>
        <p className="t-apoio">Nome e WhatsApp ou e-mail. Vira prestador só se você escolher a proposta dele.</p>
      </div>
      {erro ? <p className="t-texto text-erro" role="alert">{erro}</p> : null}
    </div>
  );
}

/** O que falta nos convidados de fora, antes de mandar. */
export function faltaNosConvidados(c: Convidados): string | null {
  for (const v of c.novos) {
    if (v.nome.trim().length < 2) return "Diga o nome de cada convidado de fora (2 a 120 caracteres).";
    if (v.canal === "WHATSAPP" && v.celular.replace(/\D/g, "").length < 10) return "Escreva o WhatsApp com o DDD.";
    if (v.canal === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return "Confira o e-mail.";
  }
  return null;
}

/** A janela "Mandar convite" (quadro 475): um link só para cada fornecedor, sem conta. */
export function JanelaConvites({ links, titulo, prazo, aoFechar }: { links: LinkConvite[] | null; titulo: string; prazo: string; aoFechar: () => void }) {
  const lista = links ?? [];
  const paraMandar = lista.filter((l) => l.envio === "COPIAR" && (l.link || l.codigo));
  const pelosEmails = lista.filter((l) => l.envio === "EMAIL");
  const [i, setI] = useState(0);
  const [mensagens, setMensagens] = useState<Record<string, string>>({});
  const [como, setComo] = useState<Record<string, "WHATSAPP" | "COPIAR">>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  const atual = paraMandar[Math.min(i, Math.max(0, paraMandar.length - 1))];
  const fechar = () => { setI(0); setCopiado(null); aoFechar(); };
  if (!atual) {
    return (
      <Dialogo aberto={links !== null && pelosEmails.length > 0} titulo="Convites mandados" aoFechar={fechar} media>
        <div className="grid gap-4">
          <p className="t-texto">Pelo e-mail: {pelosEmails.map((l) => l.nome).join(", ")}. Esses já foram, cada um com um link só dele.</p>
          <div className="flex justify-end"><Botao onClick={fechar}>Pronto</Botao></div>
        </div>
      </Dialogo>
    );
  }
  const pronto = linkDoConvite(atual);
  const endereco = pronto.link;
  const mensagem = mensagens[atual.conviteId] ?? pronto.texto;
  const jeito = como[atual.conviteId] ?? "WHATSAPP";
  const copiar = async () => {
    try { await navigator.clipboard.writeText(jeito === "COPIAR" ? endereco : mensagem); setCopiado(atual.conviteId); } catch { setCopiado(null); }
  };
  return (
    <Dialogo aberto={links !== null} titulo="Mandar convite" aoFechar={fechar} media fechar apoio="Um link só para este fornecedor, sem conta">
      <div className="grid gap-4">
        {paraMandar.length > 1 ? <p className="t-apoio">Convite {i + 1} de {paraMandar.length}. Cada convidado recebe um link só dele; ninguém vê o preço do outro.</p> : null}
        <dl className="grid gap-3">
          <div className="grid gap-0.5"><dt className="t-apoio">Para</dt><dd className="t-texto font-medium">{atual.nome}</dd></div>
          <div className="grid gap-1">
            <dt className="t-apoio">Mandar por</dt>
            <dd><Escolha rotulo="Mandar por" atual={jeito} aoMudar={(v) => setComo({ ...como, [atual.conviteId]: v })} opcoes={[{ valor: "WHATSAPP", texto: "WhatsApp" }, { valor: "COPIAR", texto: "Copiar o link" }]} /></dd>
          </div>
        </dl>
        {jeito === "WHATSAPP" ? (
          <CampoAreaTexto id={`convite-mensagem-${atual.conviteId}`} rotulo="Mensagem pronta" rows={5} maxLength={1000} value={mensagem}
            onChange={(e) => setMensagens({ ...mensagens, [atual.conviteId]: e.target.value })} ajuda="Sai do seu WhatsApp, com o seu número. Você pode mudar o texto." />
        ) : (
          <div className="grid gap-1">
            <span className="t-apoio">O link</span>
            <span className="t-codigo break-all" aria-label={`Link de ${atual.nome}`}>{endereco}</span>
          </div>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-0.5"><dt className="t-apoio">O link vale até</dt><dd className="t-texto">{diaHoraPrazo(prazo)}<span className="block t-apoio">O mesmo prazo das propostas</span></dd></div>
          <div className="grid gap-0.5"><dt className="t-apoio">Depois de mandar</dt><dd className="t-texto">Aceita uma versão nova até o prazo<span className="block t-apoio">A versão anterior fica guardada</span></dd></div>
        </dl>
        <p className="t-apoio">{NOTA_CONVITE}</p>
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
          {jeito === "WHATSAPP" ? (
            <a href={enderecoWhatsapp(mensagem)} target="_blank" rel="noopener noreferrer" className={classeBotao("primario")}>
              <Icone nome="whats" />Abrir o WhatsApp com a mensagem
            </a>
          ) : null}
          <Botao variante={jeito === "WHATSAPP" ? "contorno" : "primario"} onClick={() => void copiar()} aria-label={copiado === atual.conviteId ? `Copiado: ${jeito === "COPIAR" ? "link" : "mensagem"} de ${atual.nome}` : undefined}>
            <Icone nome="copiar" />{copiado === atual.conviteId ? "Copiado" : jeito === "COPIAR" ? "Copiar o link" : "Copiar a mensagem"}
          </Botao>
          {i + 1 < paraMandar.length ? <Botao variante="secundario" onClick={() => { setCopiado(null); setI(i + 1); }}>Próximo convidado<Icone nome="dir" /></Botao>
            : <Botao variante="secundario" onClick={fechar}>Pronto</Botao>}
        </div>
        {pelosEmails.length ? <p className="t-apoio">Pelo e-mail: {pelosEmails.map((l) => l.nome).join(", ")}. Esses já foram.</p> : null}
        <p className="t-apoio">{titulo}: se o fornecedor não achar a mensagem, abra a ficha e use Reenviar link.</p>
      </div>
    </Dialogo>
  );
}

/** Convidar mais (quadro 474): os mesmos cartões, só para quem ainda não foi convidado. */
export function JanelaConvidarMais({ aberto, orcamentoId, o, jaConvidados, aoFechar, convidados }: {
  aberto: boolean; orcamentoId: string; o: OpcoesOrcamento | null; jaConvidados: string[]; aoFechar: () => void; convidados: (links: LinkConvite[]) => void;
}) {
  const [valor, setValor] = useState<Convidados>(SEM_CONVIDADOS);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fechar = () => { setValor(SEM_CONVIDADOS); setErro(null); setFalta(null); aoFechar(); };
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const f = totalConvidados(valor) === 0 ? "Marque pelo menos um convidado." : faltaNosConvidados(valor);
    setFalta(f);
    if (f) return;
    setEnviando(true);
    const r = await chamarApi<{ versao: number; links: LinkConvite[] }>(`/v1/condominio/orcamentos/${orcamentoId}/convites`, { corpo: { convites: convitesParaApi(valor, o!) } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setValor(SEM_CONVIDADOS);
    convidados(r.dados.links);
  }
  return (
    <Dialogo aberto={aberto} titulo="Convidar mais" aoFechar={fechar} media apoio="Cada convidado recebe um link só dele">
      {aberto && o ? (
        <form onSubmit={enviar} noValidate className="grid gap-4">
          {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <EscolherConvidados o={o} valor={valor} mudar={setValor} jaConvidados={jaConvidados} prefixo="mais" erro={falta ?? (camposComErro(erro).length ? "Confira os convidados: o nome e o contato de cada um." : null)} />
          <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
            <Botao variante="contorno" onClick={fechar} disabled={enviando}>Cancelar</Botao>
            <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Mandando…" : "Mandar os convites"}</Botao>
          </div>
        </form>
      ) : null}
    </Dialogo>
  );
}
