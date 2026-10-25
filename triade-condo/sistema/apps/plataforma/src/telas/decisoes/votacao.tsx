"use client";
// Peças da votação do conselho (R5, V-14; quadros 414, 415 e 420): a barra do quórum, os votos com
// quem ainda não votou, o Votar pelo painel, o Reenviar o link e a janela com o link para copiar
// quando o WhatsApp ainda não manda (envio COPIAR), ou mandado pelo WhatsApp do condomínio (envio
// WHATSAPP, R5.3), com o Copiar para quem vê o código. A gestão vê os votos na hora; quem só vota
// vê o próprio até fechar. Aprovar não contrata nem paga nada.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AVISO_PECA_O_LINK, caminhoLinkConselho, ESTADOS_ENVIO_WHATSAPP, FRASE_ADVOGADO, MOTIVOS_SEM_WHATSAPP_CONSELHO, mostrarCusto, PAPEIS_CONSELHO, textoEscolha,
  textoPlacar } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Iniciais, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { AlternativaDecisao, EnvioLink, FinalidadeLink, LinkDoItem, LinkMandado, Votacao, VotoConselho } from "../tipos.ts";

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
  if (!v.link) return "";
  if (copiaDoWhatsapp(v.link)) return "Link para mandar pelo WhatsApp";
  if (v.link.canal === "WHATSAPP") return v.link.envio === "FALHOU" ? "A mensagem do link não chegou" : `Pelo WhatsApp: ${rotuloEnvioWhatsapp(v.link.envio).toLowerCase()}, ainda não aberto`;
  if (v.link.envio === "FALHOU") return "O e-mail do link não chegou";
  return "Link mandado, ainda não aberto";
}

/** O link de WhatsApp que a pessoa copia e manda: nada foi para a fila do WhatsApp do condomínio (COPIAR). */
const copiaDoWhatsapp = (l: { canal: string; envio?: EnvioLink }) => l.canal === "WHATSAPP" && (!l.envio || l.envio === "COPIAR");

/** A situação da mensagem do link no WhatsApp do condomínio: "Na fila", "Entregue", "Lida"… */
export function rotuloEnvioWhatsapp(e?: EnvioLink): string {
  if (e && e in ESTADOS_ENVIO_WHATSAPP) return ESTADOS_ENVIO_WHATSAPP[e as keyof typeof ESTADOS_ENVIO_WHATSAPP];
  return e === "WHATSAPP" ? ESTADOS_ENVIO_WHATSAPP.NA_FILA : "Mandada";
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
              {!x.escolha && x.emDia !== false && reenviar && x.link && x.link.podeReenviar !== false ? (
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

/** O link pelo e-mail (fila do e-mail): nem COPIAR nem WHATSAPP. */
const peloEmail = (l: LinkMandado) => l.envio !== "COPIAR" && l.envio !== "WHATSAPP";

/** Depois de pedir: a janela abre quando falta mandar algum link pelo WhatsApp (COPIAR). */
export const temLinkParaCopiar = (links: LinkMandado[]) => links.some((l) => l.envio === "COPIAR");

/** Depois do Reenviar ou do Copiar o link: a janela abre com o link para copiar, também quando o
 * WhatsApp do condomínio já mandou (WHATSAPP com código, para o síndico e quem cuida do conselho). */
export const abreJanelaDoReenvio = (l: LinkMandado) => l.envio === "COPIAR" || (l.envio === "WHATSAPP" && !!l.codigo);

/** Os links que acabaram de sair: os do e-mail e os do WhatsApp do condomínio (WHATSAPP) já foram; os
 * de COPIAR, para copiar e mandar. O link que o WhatsApp do condomínio mandou também tem o Copiar, para
 * quem vê o código, se a pessoa não achar a mensagem. */
export function LinksMandados({ links, aoFechar }: { links: LinkMandado[] | null; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (l: LinkMandado) => {
    try { await navigator.clipboard.writeText(enderecoDoLink(l.codigo!)); setCopiado(l.membroId); } catch { setCopiado(null); }
  };
  const lista = links ?? [];
  const paraCopiar = lista.filter((l) => (l.envio === "COPIAR" && (l.codigo || l.aviso)) || (l.envio === "WHATSAPP" && l.codigo));
  const pelosEmails = lista.filter(peloEmail);
  const peloWhatsapp = lista.filter((l) => l.envio === "WHATSAPP" && !l.codigo);
  const falta = paraCopiar.some((l) => l.envio === "COPIAR");
  const comCodigo = paraCopiar.some((l) => l.envio === "COPIAR" && l.codigo);
  const naoSaiu = paraCopiar.some((l) => l.envio === "COPIAR" && l.semWhatsapp)
    ? "O link não saiu pelo WhatsApp do condomínio" : "O WhatsApp do condomínio ainda não manda este aviso sozinho";
  const chave = (l: LinkMandado) => `${l.membroId}-${l.finalidade ?? ""}-${l.decisaoId ?? l.despesaId ?? ""}`;
  const fechar = () => { setCopiado(null); aoFechar(); };
  return (
    <Dialogo aberto={links !== null && paraCopiar.length > 0} titulo={falta ? "Mande o link pelo WhatsApp" : "Link mandado pelo WhatsApp"} aoFechar={fechar} media>
      <div className="grid gap-4">
        <p className="t-texto">
          {!falta ? "O WhatsApp do condomínio já mandou o link. Se a pessoa não achar a mensagem, copie o link e mande da sua conversa com ela: é o mesmo link, pessoal, e vale até o fim do dia do prazo."
            : comCodigo ? `${naoSaiu}. Copie o link de cada pessoa e mande da sua conversa com ela. O link é pessoal: vale até o fim do dia do prazo.`
              : `${naoSaiu}, e o link para copiar só aparece para o síndico e para quem cuida do conselho.`}
        </p>
        <ul className="grid gap-3">
          {paraCopiar.map((l) => (
            <li key={chave(l)} className="grid gap-2 rounded-[14px] border border-linha p-3">
              <span className="t-texto font-medium">{l.nome}{l.finalidade && l.finalidade !== "VOTO" ? ` · ${NOME_FINALIDADE[l.finalidade]}` : ""}</span>
              {l.envio === "COPIAR" && l.semWhatsapp ? <span className="flex items-start gap-1.5 t-apoio"><Icone nome="info" className="mt-px h-4 w-4 shrink-0" />{MOTIVOS_SEM_WHATSAPP_CONSELHO[l.semWhatsapp]}</span> : null}
              {l.envio === "WHATSAPP" ? <span className="flex items-center gap-1.5 t-apoio"><Icone nome="check" className="h-4 w-4 shrink-0 text-ok" />Enviado pelo WhatsApp do condomínio</span> : null}
              {l.codigo ? (
                <>
                  <span className="t-codigo break-all" aria-label={`Link de ${l.nome}`}>{enderecoDoLink(l.codigo)}</span>
                  <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => void copiar(l)} aria-label={copiado === l.membroId ? `Copiado: link de ${l.nome}` : `Copiar o link de ${l.nome}`}>
                    <Icone nome="copiar" />{copiado === l.membroId ? "Copiado" : "Copiar o link"}
                  </Botao>
                </>
              ) : (
                <p className="flex items-start gap-2 t-apoio text-tinta"><Icone nome="info" className="mt-px h-4 w-4 shrink-0" />{l.aviso ?? AVISO_PECA_O_LINK}. Se {l.nome.split(" ")[0]} já tinha um link, ele continua valendo.</p>
              )}
            </li>
          ))}
        </ul>
        {pelosEmails.length ? <p className="t-apoio">Pelo e-mail: {pelosEmails.map((l) => l.nome).join(", ")}. Esses já foram.</p> : null}
        {peloWhatsapp.length ? <p className="t-apoio">Pelo WhatsApp do condomínio: {peloWhatsapp.map((l) => l.nome).join(", ")}. Esses já foram.</p> : null}
        <div className="flex justify-end"><Botao onClick={fechar}>Pronto</Botao></div>
      </div>
    </Dialogo>
  );
}

/** O link pelo que ele faz: "link do substituto", "link do aviso". */
const NOME_FINALIDADE: Record<FinalidadeLink, string> = { VOTO: "link de voto", SUBSTITUTO: "link do substituto", AVISO: "link do aviso" };

/** Reenviar o link (quadro 414): troca o código; o anterior para na hora. Vale para o de voto, o do substituto e o do aviso. */
export async function reenviarLink(tipo: "decisoes" | "despesas", id: string, membroId: string, finalidade: FinalidadeLink = "VOTO") {
  return chamarApi<LinkMandado>(`/v1/condominio/${tipo}/${id}/reenviar-link`, { corpo: { membroId, finalidade } });
}

/** O recado depois de Reenviar: o link novo foi pelo e-mail ou pelo WhatsApp do condomínio, está na
 * janela para copiar ou fica com o síndico. */
export function recadoDoReenvio(l: LinkMandado): string {
  const qual = l.finalidade && l.finalidade !== "VOTO" ? `${NOME_FINALIDADE[l.finalidade][0]!.toUpperCase()}${NOME_FINALIDADE[l.finalidade].slice(1)} novo` : "Link novo";
  if (l.envio === "WHATSAPP") return `${qual} mandado pelo WhatsApp do condomínio para ${l.nome}. O anterior parou de valer.`;
  if (l.envio !== "COPIAR") return `${qual} mandado pelo e-mail para ${l.nome}. O anterior parou de valer.`;
  if (!l.codigo) return `${l.aviso ?? AVISO_PECA_O_LINK}: o link de ${l.nome} pelo WhatsApp só sai com ele. O que ${l.nome.split(" ")[0]} já tinha continua valendo.`;
  return `${qual} para ${l.nome}. O anterior parou de valer. Copie e mande pelo WhatsApp.`;
}

/** O recado depois de pedir ao conselho, criar a despesa ou marcar a ausência: quem recebeu pelo
 * e-mail ou pelo WhatsApp do condomínio, quem falta mandar pelo WhatsApp e de quem o link fica com o síndico. */
export function recadoDosLinks(links: LinkMandado[]): string {
  const email = links.filter(peloEmail).map((l) => l.nome);
  const whatsapp = links.filter((l) => l.envio === "WHATSAPP").map((l) => l.nome);
  const copiar = links.filter((l) => l.envio === "COPIAR" && l.codigo).map((l) => l.nome);
  const comSindico = links.filter((l) => l.envio === "COPIAR" && !l.codigo).map((l) => l.nome);
  return [email.length ? `Link mandado pelo e-mail para ${email.join(", ")}.` : null,
    whatsapp.length ? `Link mandado pelo WhatsApp do condomínio para ${whatsapp.join(", ")}.` : null,
    copiar.length ? `Falta mandar pelo WhatsApp para ${copiar.join(", ")}: copie o link na janela.` : null,
    comSindico.length ? `${AVISO_PECA_O_LINK} de ${comSindico.join(", ")} pelo WhatsApp.` : null].filter(Boolean).join(" ");
}

/** Quando o link do substituto ou do aviso saiu e se foi aberto. */
function situacaoDoLink(l: LinkDoItem): string {
  if (l.abertoEm) return `Aberto em ${diaHora(l.abertoEm)}`;
  if (!l.mandadoEm) return l.canal === "WHATSAPP" ? "Ainda sem link para copiar" : "Ainda não mandado";
  if (l.envio === "FALHOU") return l.canal === "WHATSAPP" ? "A mensagem do link não chegou" : "O e-mail do link não chegou";
  if (l.canal === "WHATSAPP" && !copiaDoWhatsapp(l)) return `Mandado em ${diaHora(l.mandadoEm)} · mensagem ${rotuloEnvioWhatsapp(l.envio).toLowerCase()}, ainda não aberto`;
  return `${copiaDoWhatsapp(l) ? "Gerado" : "Mandado"} em ${diaHora(l.mandadoEm)}, ainda não aberto`;
}

/** Os links do substituto e do aviso da vencida, na decisão e na despesa pedidas a uma pessoa: o
 * de WhatsApp para copiar tem o Copiar (gera um código novo); o de e-mail e o que o WhatsApp do
 * condomínio manda têm o Reenviar (que, para quem vê o código, abre a janela com o Copiar). */
export function LinksDoItem({ links, reenviar, nivel = "h3" }: { links: LinkDoItem[]; reenviar?: (l: LinkDoItem) => void; nivel?: "h2" | "h3" }) {
  const Titulo = nivel;
  if (!links.length) return null;
  return (
    <section className="grid gap-1">
      <Titulo className="t-rotulo">Links pelo conselho</Titulo>
      <ul className="grid">
        {links.map((l) => (
          <li key={`${l.membroId}-${l.finalidade}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-linha py-2.5">
            <span className="grid min-w-0 flex-1">
              <span className="t-texto font-medium">{l.nome} · {NOME_FINALIDADE[l.finalidade]}</span>
              <span className="t-apoio">{copiaDoWhatsapp(l) ? "Pelo WhatsApp" : l.canal === "WHATSAPP" ? "Pelo WhatsApp do condomínio" : "Pelo e-mail"} · {situacaoDoLink(l)}</span>
            </span>
            {reenviar && l.podeReenviar ? (
              <Botao variante="contorno" tamanho="m" onClick={() => reenviar(l)}>
                <Icone nome={copiaDoWhatsapp(l) ? "copiar" : "enviar"} />{copiaDoWhatsapp(l) ? "Copiar" : "Reenviar"} o {NOME_FINALIDADE[l.finalidade]}
              </Botao>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
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
