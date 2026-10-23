"use client";
// A assembleia nova ou o rascunho (design "Vida em condomínio", tela 6; DC15, telas-modelo
// vida-nova-assembleia-*; decisão D.1 de 22/10/2026; AC-02): uma página. No computador, 3 partes
// numeradas (o que é; quando e onde; a pauta, cada item com o seu quórum) com a convocação ao lado
// (até quando mandar o edital, pela antecedência da convenção); no celular, 3 passos com
// Continuar, Voltar e o resumo com Alterar. Fica como rascunho até convocar.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  FORMAS_ASSEMBLEIA, formatarDataHora, PESOS_ASSEMBLEIA, QUORUNS, somarDias, TIPOS_ASSEMBLEIA, TIPOS_ITEM,
  type FormaAssembleia, type Quorum, type TipoAssembleia, type TipoItem,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, ErroCarregar, Icone, Vazio, textoDoErro, type ErroApi } from "@triade/ui";
import { useCelular } from "../celular.ts";
import { CartaoFicha, Escolha } from "../moradores/comum.tsx";
import { diaDe } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { AssembleiaDetalhe, AssembleiaTela, ListaAssembleias } from "../tipos.ts";
import { Voltar } from "./comum.tsx";
import { tipoEForma } from "./Assembleias.tsx";

type Passo = 1 | 2 | 3;
const PARTES = ["O que é", "Quando e onde", "Pauta"] as const;
const PASSO_DO_CAMPO: Record<string, Passo> = { titulo: 1, tipo: 1, forma: 1, primeiraChamada: 2, segundaChamada: 2, local: 2, linkVideo: 2 };

interface ItemForm { titulo: string; descricao: string; tipo: TipoItem; opcoes: string[]; quorum: Quorum }
const itemVazio = (): ItemForm => ({ titulo: "", descricao: "", tipo: "APROVACAO", opcoes: ["", ""], quorum: "MAIORIA_PRESENTES" });

/** ISO para o campo "AAAA-MM-DDTHH:MM", no relógio de quem usa a tela. */
function paraCampo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const paraIso = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toISOString(); };
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

function Parte({ n, passo, children }: { n: Passo; passo: Passo; children: ReactNode }) {
  return (
    <section aria-labelledby={`t-parte-${n}`} className={`parte ${n === passo ? "" : "max-md:hidden"}`}>
      <div className="cabeca">
        <span className="numero" aria-hidden="true">{n}</span>
        <h2 id={`t-parte-${n}`} className="t-titulo-cartao">{PARTES[n - 1]}</h2>
      </div>
      {children}
    </section>
  );
}

export function NovaAssembleia() {
  const id = useSearchParams().get("id");
  const lista = useCarregar<ListaAssembleias>("/v1/condominio/assembleias");
  const atual = useCarregar<AssembleiaDetalhe>(id ? `/v1/condominio/assembleias/${id}` : null);
  const voltar = <Voltar href={id ? `/vida/assembleia?id=${id}` : "/vida?aba=assembleias"} texto={id ? "Assembleia" : "Assembleias"} />;
  const titulo = id ? "Editar a assembleia" : "Nova assembleia";
  if (lista.estado === "carregando" || (id && atual.estado === "carregando")) return <Carregando rotulo="Abrindo a assembleia…" />;
  const erro = lista.estado === "erro" ? lista : id && atual.estado === "erro" ? atual : null;
  if (erro) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">{titulo}</h1><ErroCarregar erro={erro.erro} texto={erro.texto} tentarDeNovo={erro.recarregar} /></div>;
  if (lista.estado !== "pronto") return null;
  const a = id && atual.estado === "pronto" ? atual.dados.assembleia : undefined;
  if (a && a.estado !== "RASCUNHO") {
    return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">{titulo}</h1><Vazio titulo="Esta assembleia não muda mais">Depois de convocada, a assembleia não se edita: para mudar, cancele e convoque outra.</Vazio></div>;
  }
  return <Formulario key={a?.id ?? "nova"} l={lista.dados} a={a} voltar={voltar} titulo={titulo} />;
}

function Formulario({ l, a, voltar, titulo: tituloTela }: { l: ListaAssembleias; a?: AssembleiaTela; voltar: ReactNode; titulo: string }) {
  const router = useRouter();
  const celular = useCelular();
  const [passo, setPasso] = useState<Passo>(1);
  const [titulo, setTitulo] = useState(a?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoAssembleia>(a?.tipo ?? "ORDINARIA");
  const [forma, setForma] = useState<FormaAssembleia>(a?.forma ?? "PRESENCIAL");
  const [primeira, setPrimeira] = useState(paraCampo(a?.primeiraChamada));
  const [segunda, setSegunda] = useState(paraCampo(a?.segundaChamada));
  const [local, setLocal] = useState(a?.local ?? "");
  const [video, setVideo] = useState(a?.linkVideo ?? "");
  const [itens, setItens] = useState<ItemForm[]>(a?.itens.length
    ? a.itens.map((i) => ({ titulo: i.titulo, descricao: i.descricao ?? "", tipo: i.tipo, quorum: i.quorum, opcoes: i.tipo === "ESCOLHA" ? i.opcoes.slice(0, -1) : ["", ""] }))
    : [itemVazio()]);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const detalhe = (erro?.detalhes?.campos as string[] | undefined) ?? [];
  const erroItem = (n: number, campo: string) => detalhe.includes(`itens.${n + 1}.${campo}`);
  const mudarItem = (n: number, x: Partial<ItemForm>) => setItens((xs) => xs.map((i, j) => (j === n ? { ...i, ...x } : i)));

  async function salvar(ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = {
      ...(a ? { versao: a.versao } : {}), titulo, tipo, forma, primeiraChamada: paraIso(primeira), segundaChamada: paraIso(segunda || primeira),
      local: forma === "ONLINE" ? "" : local, linkVideo: forma === "PRESENCIAL" ? "" : video,
      itens: itens.map((i) => ({ titulo: i.titulo, descricao: i.descricao, tipo: i.tipo, quorum: i.quorum, ...(i.tipo === "ESCOLHA" ? { opcoes: i.opcoes } : {}) })),
    };
    const r = await chamarApi<{ id: string }>(a ? `/v1/condominio/assembleias/${a.id}` : "/v1/condominio/assembleias", { metodo: a ? "PUT" : "POST", corpo });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      const campos = camposComErro(r.erro);
      const volta = campos.some((c) => c.startsWith("itens")) ? 3 : campos.map((c) => PASSO_DO_CAMPO[c]).filter(Boolean).sort()[0];
      if (volta) setPasso(volta as Passo);
      return;
    }
    router.push(`/vida/assembleia?id=${r.dados.id}&feito=rascunho`);
  }

  const dia = primeira ? primeira.slice(0, 10) : "";
  const enviarAte = dia ? dataBr(somarDias(dia, -l.regras.antecedencia)) : "escolha a 1ª chamada";
  const atrasado = dia ? somarDias(dia, -l.regras.antecedencia) < diaDe(new Date().toISOString()) : false;
  const resumos = [
    `${titulo.trim() || "Sem nome"} · ${tipoEForma({ tipo, forma })}`,
    `${primeira ? formatarDataHora(paraIso(primeira)).replace(" ", " às ") : "Sem data"}${forma !== "ONLINE" && local ? ` · ${local}` : ""}`,
  ];

  const parte1 = (
    <>
      <CampoTexto id="as-titulo" rotulo="Nome" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)}
        erro={comErro.includes("titulo") ? "Escreva o nome, com 5 a 120 letras" : null} ajuda="Como aparece no edital e no link de cada unidade. Por exemplo: Assembleia geral ordinária 2026." />
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <span className="t-apoio font-medium">Tipo</span>
          <Escolha rotulo="Tipo" atual={tipo} aoMudar={setTipo} opcoes={(Object.keys(TIPOS_ASSEMBLEIA) as TipoAssembleia[]).map((v) => ({ valor: v, texto: TIPOS_ASSEMBLEIA[v] }))} />
        </div>
        <div className="grid gap-1.5">
          <span className="t-apoio font-medium">Forma</span>
          <Escolha rotulo="Forma" atual={forma} aoMudar={setForma} opcoes={(Object.keys(FORMAS_ASSEMBLEIA) as FormaAssembleia[]).map((v) => ({ valor: v, texto: FORMAS_ASSEMBLEIA[v] }))} />
        </div>
      </div>
      <p className="t-apoio">Ordinária: contas, orçamento e eleição. Extraordinária: o resto. Online e híbrida pedem que a convenção não proíba.</p>
    </>
  );

  const parte2 = (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto id="as-primeira" rotulo="1ª chamada" type="datetime-local" value={primeira} onChange={(e) => setPrimeira(e.target.value)}
        erro={comErro.includes("primeiraChamada") ? "Escolha uma data no futuro" : null} />
      <CampoTexto id="as-segunda" rotulo="2ª chamada" type="datetime-local" value={segunda} onChange={(e) => setSegunda(e.target.value)}
        erro={comErro.includes("segundaChamada") ? "Na hora da 1ª chamada ou depois" : null} />
      {forma !== "ONLINE" ? (
        <CampoTexto id="as-local" rotulo="Local" maxLength={200} value={local} onChange={(e) => setLocal(e.target.value)}
          erro={comErro.includes("local") ? "Escreva onde vai ser" : null} />
      ) : null}
      {forma !== "PRESENCIAL" ? (
        <CampoTexto id="as-video" rotulo="Link da videochamada" type="url" maxLength={300} value={video} onChange={(e) => setVideo(e.target.value)} icone="link"
          erro={comErro.includes("linkVideo") ? "Cole o endereço que começa com https://" : null} ajuda="Meet, Zoom ou Jitsi. Vai só nos links pessoais, não no edital do mural." />
      ) : null}
    </div>
  );

  const parte3 = (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Pauta</legend>
      {comErro.some((c) => c.startsWith("itens")) ? <Aviso tom="erro" papel="alert">Confira a pauta: cada item precisa de título e, na escolha, de 2 a 10 opções diferentes.</Aviso> : null}
      {itens.map((i, n) => (
        <div key={n} className="grid gap-3 rounded-2xl border border-linha bg-superficie p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5"><span className="numero" aria-hidden="true">{n + 1}</span><span className="font-semibold">Item {n + 1}</span></span>
            {itens.length > 1 ? (
              <Botao variante="discreto" tamanho="p" onClick={() => setItens((xs) => xs.filter((_, j) => j !== n))} aria-label={`Tirar o item ${n + 1}`}><Icone nome="fechar" className="h-4 w-4" />Tirar</Botao>
            ) : null}
          </div>
          <CampoTexto id={`as-item-${n}`} rotulo={`O que se vota no item ${n + 1}`} maxLength={200} value={i.titulo} onChange={(e) => mudarItem(n, { titulo: e.target.value })}
            erro={erroItem(n, "titulo") ? "Escreva o item, com 3 a 200 letras" : null} />
          <CampoTexto id={`as-item-${n}-desc`} rotulo="Detalhe" opcional maxLength={1000} value={i.descricao} onChange={(e) => mudarItem(n, { descricao: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoSelecao id={`as-item-${n}-tipo`} rotulo="Votação" value={i.tipo} onChange={(e) => mudarItem(n, { tipo: e.target.value as TipoItem })}
              opcoes={(Object.keys(TIPOS_ITEM) as TipoItem[]).map((v) => ({ valor: v, texto: TIPOS_ITEM[v] }))} />
            <CampoSelecao id={`as-item-${n}-quorum`} rotulo="Quórum" value={i.quorum} onChange={(e) => mudarItem(n, { quorum: e.target.value as Quorum })}
              opcoes={(Object.keys(QUORUNS) as Quorum[]).map((v) => ({ valor: v, texto: QUORUNS[v] }))} ajuda="Confira na convenção" />
          </div>
          {i.tipo === "ESCOLHA" ? (
            <div className="grid gap-2">
              {i.opcoes.map((o, k) => (
                <CampoTexto key={k} id={`as-item-${n}-op-${k}`} rotulo={`Opção ${k + 1} do item ${n + 1}`} maxLength={80} value={o}
                  onChange={(e) => mudarItem(n, { opcoes: i.opcoes.map((x, j) => (j === k ? e.target.value : x)) })} />
              ))}
              <span className="flex flex-wrap items-center gap-2 t-apoio text-tinta-suave">
                {i.opcoes.length < 10 ? <Botao variante="discreto" tamanho="p" onClick={() => mudarItem(n, { opcoes: [...i.opcoes, ""] })}>Mais uma opção</Botao> : null}
                Em branco entra sozinho no fim.
              </span>
              {erroItem(n, "opcoes") ? <span className="t-apoio text-erro" role="alert">Escreva de 2 a 10 opções, diferentes entre si</span> : null}
            </div>
          ) : null}
        </div>
      ))}
      {itens.length < 30 ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => setItens((xs) => [...xs, itemVazio()])}><Icone nome="mais" className="h-4 w-4" />Item da pauta</Botao> : null}
    </fieldset>
  );

  const convocacao = (
    <CartaoFicha id="convocacao" titulo="Convocação" icone="megafone">
      <dl className="grid t-texto">
        {[["Enviar o edital até", enviarAte], ["Antecedência", `${l.regras.antecedencia} dias, pela convenção`], ["Peso do voto", PESOS_ASSEMBLEIA[l.regras.peso]], ["Unidades que votam", String(l.unidades)]].map(([n, v]) => (
          <div key={n} className="flex justify-between gap-3 border-t border-linha py-2.5"><dt className="t-apoio">{n}</dt><dd className="text-right font-semibold">{v}</dd></div>
        ))}
      </dl>
      {atrasado ? <Aviso tom="atencao">Com essa data, o edital já está atrasado pela antecedência da convenção.</Aviso> : null}
      <p className="t-apoio">Ao convocar, o edital vai como comunicado e cada unidade recebe um link só dela, para indicar procurador, marcar presença e votar.</p>
    </CartaoFicha>
  );

  return (
    <form onSubmit={(e) => { if (celular && passo < 3) { e.preventDefault(); setPasso((passo + 1) as Passo); return; } void salvar(e); }} noValidate className="grid gap-5">
      {voltar}
      <div>
        <h1 className="t-titulo-tela">{tituloTela}</h1>
        <p className="t-apoio mt-1">Fica como rascunho até você convocar. Confira o quórum de cada item na convenção.</p>
      </div>
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid gap-3 md:hidden">
        <div className="passos" role="progressbar" aria-label="Passos da assembleia" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passo}
          aria-valuetext={`Passo ${passo} de 3: ${PARTES[passo - 1]}`}>
          {[1, 2, 3].map((n) => <span key={n} data-feito={n <= passo ? "" : undefined} />)}
        </div>
        {resumos.slice(0, passo - 1).map((texto, i) => (
          <button key={i} type="button" className="resumo-passo" onClick={() => setPasso((i + 1) as Passo)}>
            <span className="numero" aria-hidden="true"><Icone nome="check" className="h-3.5 w-3.5" /></span>
            <span className="grid min-w-0 flex-1"><span className="t-apoio">{PARTES[i]}</span><span className="truncate">{texto}</span></span>
            <span className="alterar">Alterar</span>
          </button>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Assembleia" className="rounded-[18px] border border-linha bg-superficie px-6 shadow-s1 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:shadow-none">
          <Parte n={1} passo={passo}>{parte1}</Parte>
          <Parte n={2} passo={passo}>{parte2}</Parte>
          <Parte n={3} passo={passo}>{parte3}</Parte>
        </section>
        <div className={`lg:sticky lg:top-6 ${passo === 2 ? "" : "max-md:hidden"}`}>{convocacao}</div>
      </div>
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-2 border-t border-linha bg-superficie px-4 py-3 shadow-s2 max-md:bottom-[calc(61px+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        {passo > 1 ? <Botao variante="contorno" className="md:hidden" onClick={() => setPasso((passo - 1) as Passo)}><Icone nome="esq" />Voltar</Botao> : null}
        <Botao variante="contorno" className={passo > 1 ? "max-md:hidden" : ""} onClick={() => router.push(a ? `/vida/assembleia?id=${a.id}` : "/vida?aba=assembleias")}>Cancelar</Botao>
        {passo < 3 ? <Botao className="md:hidden max-md:flex-1" onClick={() => setPasso((passo + 1) as Passo)}>Continuar<Icone nome="dir" /></Botao> : null}
        <Botao type="submit" disabled={enviando} className={passo < 3 ? "max-md:hidden" : "max-md:flex-1"}><Icone nome="check" />{enviando ? "Salvando…" : "Salvar o rascunho"}</Botao>
      </div>
    </form>
  );
}
