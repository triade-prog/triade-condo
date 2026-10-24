"use client";
// Peças da votação do conselho (R5, V-14; quadros 414, 415 e 420): a barra do quórum, os votos com
// quem ainda não votou, o Votar pelo painel, o Reenviar o link e a janela com o link para copiar
// quando o WhatsApp ainda não manda (envio COPIAR). A gestão vê os votos na hora; quem só vota
// vê o próprio até fechar. Aprovar não contrata nem paga nada.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { caminhoLinkConselho, FRASE_ADVOGADO, mostrarCusto, PAPEIS_CONSELHO, textoEscolha, textoPlacar } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Iniciais, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { AlternativaDecisao, LinkMandado, Votacao, VotoConselho } from "../tipos.ts";

/** A barra do quórum: quanto a escolha que lidera já tem e a marca de quantos votos decidem. */
export function BarraQuorum({ votos, titulares, necessarios }: { votos: number; titulares: number; necessarios: number }) {
  const total = Math.max(titulares, 1);
  return (
    <div aria-hidden="true" className="relative h-2.5 rounded-full bg-superficie-2">
      <div className="h-2.5 rounded-full bg-violeta-600" style={{ width: `${Math.min(100, Math.round((100 * votos) / total))}%` }} />
      <span className="absolute -top-1 h-[18px] w-0.5 bg-tinta" style={{ left: `${Math.min(100, Math.round((100 * necessarios) / total))}%` }} />
    </div>
  );
}

/** O placar em uma linha, com o número em destaque: "**2 de 3 votos** para aprovar a alternativa 2". */
export function Placar({ contagem, necessarios }: { contagem?: Record<string, number>; necessarios: number }) {
  const t = textoPlacar(contagem, necessarios);
  const i = t.indexOf(" para ");
  return <p className="t-texto"><strong className="font-semibold">{t.slice(0, i)}</strong>{t.slice(i)}</p>;
}

const TOM_ESCOLHA = (e: string): Tom => (e === "DEVOLVER" || e === "RECUSAR" ? "erro" : "ok");

/** O voto num selo: "Alternativa 2", "Devolver", "Aprova", "Recusa" ou "Ainda não votou". */
export function SeloVoto({ v }: { v: Pick<VotoConselho, "escolha"> }) {
  if (!v.escolha) return <Selo tom="neutro">Ainda não votou</Selo>;
  const texto = v.escolha === "DEVOLVER" ? "Devolver" : v.escolha === "APROVAR" ? "Aprova" : v.escolha === "RECUSAR" ? "Recusa" : `Alternativa ${v.escolha}`;
  return <Selo tom={TOM_ESCOLHA(v.escolha)}>{texto}</Selo>;
}

/** Quando e por onde: "26/10 09:12, pelo painel"; quem não votou, se abriu o link. */
function quandoVotou(v: VotoConselho): string {
  if (v.votadoEm) return `${diaHora(v.votadoEm)}${v.canal === "LINK" ? ", pelo link" : v.canal === "PAINEL" ? ", pelo painel" : ""}`;
  if (v.emDia === false) return "Mandato vencido: não vota";
  if (v.link?.abertoEm) return `Link aberto em ${diaHora(v.link.abertoEm)}`;
  if (v.link?.envio === "COPIAR") return "Link para mandar pelo WhatsApp";
  if (v.link?.envio === "FALHOU") return "O e-mail do link não chegou";
  return v.link ? "Link mandado, ainda não aberto" : "";
}

/** Os votos, um por linha (quadro 414). Quem ainda não votou tem o Reenviar o link, para a gestão. */
export function ListaVotos({ v, reenviar, nivel = "h3" }: { v: Votacao; reenviar?: (x: VotoConselho) => void; nivel?: "h3" | "h4" }) {
  const Titulo = nivel;
  return (
    <section className="grid">
      <Titulo className="t-rotulo">Votos</Titulo>
      <ul className="grid">
        {v.votos.map((x) => (
          <li key={x.membroId} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-linha py-3 md:grid-cols-[36px_minmax(0,1fr)_9rem_11rem_minmax(0,1.3fr)]">
            <Iniciais nome={x.nome} className="h-9 w-9" />
            <span className="grid min-w-0">
              <span className="t-texto font-medium">{x.nome}{x.eu ? " (você)" : ""}</span>
              <span className="t-apoio">{PAPEIS_CONSELHO[x.papel]}</span>
            </span>
            <span className="max-md:col-start-2"><SeloVoto v={x} /></span>
            <span className="t-apoio max-md:col-start-2">{quandoVotou(x)}</span>
            <span className="t-apoio text-tinta max-md:col-start-2">
              {x.justificativa ? `“${x.justificativa}”` : null}
              {!x.escolha && x.emDia !== false && reenviar && x.link ? (
                <Botao variante="discreto" tamanho="p" onClick={() => reenviar(x)} aria-label={`Reenviar o link para ${x.nome}`}><Icone nome="enviar" className="h-4 w-4" />Reenviar o link</Botao>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** As alternativas com os votos de cada uma (quadro 414). */
export function AlternativasComVotos({ alternativas, contagem }: { alternativas: AlternativaDecisao[]; contagem?: Record<string, number> }) {
  return (
    <ul className="grid gap-2">
      {alternativas.map((a) => {
        const n = contagem?.[String(a.numero)] ?? 0;
        return (
          <li key={a.numero} className="flex items-center gap-3 rounded-xl border border-linha bg-fundo px-3 py-2.5 t-texto">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violeta-100 t-apoio font-bold text-violeta-700" aria-hidden="true">{a.numero}</span>
            <span className="min-w-0 flex-1"><span className="sr-only">Alternativa {a.numero}: </span>{a.descricao}</span>
            {contagem ? <span className="t-apoio">{n === 1 ? "1 voto" : `${n} votos`}</span> : null}
            <span className="t-codigo shrink-0">{a.custo !== undefined && a.custo !== null ? mostrarCusto(a.custo) : "sem custo"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Votar pelo painel (quadro 414), na decisão (alternativa ou devolver) ou na despesa (aprovar ou recusar). */
export function VotarNoPainel({ alvo, aoFechar, votado }: {
  alvo: { tipo: "decisoes" | "despesas"; id: string; titulo: string; alternativas?: AlternativaDecisao[]; meu?: string; minhaJustificativa?: string; prazo: string } | null;
  aoFechar: () => void;
  votado: (texto: string) => void;
}) {
  return (
    <Dialogo aberto={alvo !== null} titulo="Votar" aoFechar={aoFechar} fechar media apoio={alvo ? alvo.titulo : undefined}>
      {alvo ? <FormVoto key={alvo.id} alvo={alvo} aoFechar={aoFechar} votado={votado} /> : null}
    </Dialogo>
  );
}

function FormVoto({ alvo, aoFechar, votado }: { alvo: NonNullable<Parameters<typeof VotarNoPainel>[0]["alvo"]>; aoFechar: () => void; votado: (t: string) => void }) {
  const [escolha, setEscolha] = useState<string | null>(alvo.meu ?? null);
  const [justificativa, setJustificativa] = useState(alvo.minhaJustificativa ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const despesa = alvo.tipo === "despesas";
  const pedeMotivo = escolha === "DEVOLVER" || escolha === "RECUSAR";
  const opcoes = despesa
    ? [{ valor: "APROVAR", texto: "Aprovar a despesa", sub: "O porquê é opcional" }, { valor: "RECUSAR", texto: "Recusar", sub: "Escreva o porquê" }]
    : [...(alvo.alternativas ?? []).map((a) => ({ valor: String(a.numero), texto: `${a.numero} · ${a.descricao}`, sub: a.detalhe ?? "" })),
      { valor: "DEVOLVER", texto: "Devolver sem escolher", sub: "Escreva o que falta para decidir" }];

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!escolha) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["escolha"] } });
    setEnviando(true);
    const r = await chamarApi<{ estado: string; trocou: boolean; escolha: string }>(`/v1/condominio/${alvo.tipo}/${alvo.id}/voto`, {
      corpo: { escolha, justificativa: justificativa.trim() || null },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const fechou = r.dados.estado !== "AGUARDANDO";
    votado(fechou ? "Voto registrado. Com ele, a votação fechou: o resultado já está na lista."
      : r.dados.trocou ? "Voto trocado. Dá para trocar de novo até o prazo." : "Voto registrado. Dá para trocar até o prazo.");
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {erro && !comErro.includes("escolha") && !comErro.includes("justificativa") ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-2 t-apoio font-medium">Seu voto</legend>
        {opcoes.map((o) => (
          <label key={o.valor} className={`flex cursor-pointer items-start gap-3 rounded-[14px] p-4 t-texto ${escolha === o.valor ? "border-2 border-violeta-600 bg-violeta-50 p-[15px]" : "border border-linha bg-superficie hover:border-violeta-300"}`}>
            <input type="radio" name={`voto-${alvo.id}`} value={o.valor} checked={escolha === o.valor} onChange={() => setEscolha(o.valor)} className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
            <span className="grid gap-0.5"><span className="font-medium">{o.texto}</span>{o.sub ? <span className="t-apoio">{o.sub}</span> : null}</span>
          </label>
        ))}
        {comErro.includes("escolha") ? <p className="t-texto text-erro">Escolha o seu voto.</p> : null}
      </fieldset>
      <CampoAreaTexto id={`voto-just-${alvo.id}`} rotulo={pedeMotivo ? "Por quê" : "Por quê (opcional para aprovar)"} maxLength={1000} rows={3} value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)} erro={comErro.includes("justificativa") ? "Escreva o porquê (3 a 1000 caracteres)." : null} />
      <p className="flex items-start gap-2 t-apoio">
        <Icone nome="info" className="mt-px h-4 w-4 shrink-0" />
        O voto fica com seu nome e a hora, e pode ser trocado até {alvo.prazo.slice(8, 10)}/{alvo.prazo.slice(5, 7)}. Aprovar não contrata nem paga nada.
      </p>
      <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
        <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{alvo.meu ? "Trocar meu voto" : "Enviar meu voto"}</Botao>
      </div>
    </form>
  );
}

/** O endereço completo do link do conselheiro, neste mesmo app. */
export const enderecoDoLink = (codigo: string) => `${typeof window === "undefined" ? "" : window.location.origin}${caminhoLinkConselho(codigo)}`;

/** Os links que acabaram de sair: os do e-mail já foram; os do WhatsApp, para copiar e mandar (COPIAR). */
export function LinksMandados({ links, aoFechar }: { links: LinkMandado[] | null; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (l: LinkMandado) => {
    try { await navigator.clipboard.writeText(enderecoDoLink(l.codigo!)); setCopiado(l.membroId); } catch { setCopiado(null); }
  };
  const paraCopiar = (links ?? []).filter((l) => l.envio === "COPIAR" && l.codigo);
  const pelosEmails = (links ?? []).filter((l) => l.envio !== "COPIAR");
  return (
    <Dialogo aberto={links !== null && paraCopiar.length > 0} titulo="Mande o link pelo WhatsApp" aoFechar={() => { setCopiado(null); aoFechar(); }} media>
      <div className="grid gap-4">
        <p className="t-texto">
          O WhatsApp do condomínio ainda não manda este aviso sozinho. Copie o link de cada pessoa e mande da sua conversa com ela. O link é pessoal: vale até o fim do dia do prazo.
        </p>
        <ul className="grid gap-3">
          {paraCopiar.map((l) => (
            <li key={l.membroId} className="grid gap-2 rounded-[14px] border border-linha p-3">
              <span className="t-texto font-medium">{l.nome}</span>
              <span className="t-codigo break-all" aria-label={`Link de ${l.nome}`}>{enderecoDoLink(l.codigo!)}</span>
              <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => void copiar(l)} aria-label={copiado === l.membroId ? `Copiado: link de ${l.nome}` : `Copiar o link de ${l.nome}`}>
                <Icone nome="copiar" />{copiado === l.membroId ? "Copiado" : "Copiar o link"}
              </Botao>
            </li>
          ))}
        </ul>
        {pelosEmails.length ? <p className="t-apoio">Pelo e-mail: {pelosEmails.map((l) => l.nome).join(", ")}. Esses já foram.</p> : null}
        <div className="flex justify-end"><Botao onClick={() => { setCopiado(null); aoFechar(); }}>Pronto</Botao></div>
      </div>
    </Dialogo>
  );
}

/** Reenviar o link (quadro 414): troca o código; o anterior para na hora. */
export async function reenviarLink(tipo: "decisoes" | "despesas", id: string, membroId: string) {
  return chamarApi<LinkMandado>(`/v1/condominio/${tipo}/${id}/reenviar-link`, { corpo: { membroId } });
}

/** O recado depois de pedir ao conselho ou reenviar: quem recebeu pelo e-mail e quem falta mandar. */
export function recadoDosLinks(links: LinkMandado[]): string {
  const email = links.filter((l) => l.envio !== "COPIAR").map((l) => l.nome);
  const copiar = links.filter((l) => l.envio === "COPIAR").map((l) => l.nome);
  return [email.length ? `Link mandado pelo e-mail para ${email.join(", ")}.` : null,
    copiar.length ? `Falta mandar pelo WhatsApp para ${copiar.join(", ")}: copie o link na janela.` : null].filter(Boolean).join(" ");
}

/** A frase fixa da tela Decisões, com o atalho para a convenção no Prontuário. */
export function FraseAdvogado() {
  return (
    <p className="flex items-start gap-2 rounded-[14px] border border-linha bg-fundo px-4 py-3 t-apoio text-tinta">
      <Icone nome="documento" className="mt-px h-4 w-4 shrink-0" />
      <span>
        {FRASE_ADVOGADO} A convenção e o regimento estão no Prontuário.{" "}
        <Link href="/documentos/prontuario?item=CONVENCAO" className="font-medium text-violeta-600 hover:underline">Abrir a convenção</Link>
      </span>
    </p>
  );
}

/** O que a escolha quer dizer, para o histórico e o resultado. */
export const escolhaPorExtenso = textoEscolha;
