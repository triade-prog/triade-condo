"use client";
// Documentos (design "Telas dos Comunicados", tela 4; DC15, telas-modelo documentos-lista-* e
// documentos-memoria-*; CD-04, CD-07, MP-12): a primeira parte de Documentos e memória. Abas Em
// vigor, Contratos, Arquivados e Pedidos por e-mail; o tipo e quem vê em Filtros; o que pede atenção
// (vence em até 60 dias, vencido, sem arquivo) em atalhos, só quando existe. Cada linha mostra a
// versão em vigor, quem vê em selo, a validade, que aparece 60 dias antes do fim, e a qual item do
// prontuário o documento está ligado; o documento solto que parece ser o de um item que falta
// sugere ligar. Contratos junta os documentos do tipo contrato e os contratos dos prestadores, só
// para ler, cada um abrindo a ficha do prestador (decisão D.1 de 22/10/2026). O documento restrito
// só aparece a quem cuida dos documentos. Os pedidos de documento pelo mural ficam na parte
// "Pedidos por e-mail" (CD-14).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { aoMoradorPadrao, descreverValidade, documentoPareceDoItem, FILTROS_DOCUMENTO, mostrarDataCurta, TIPOS_DOCUMENTO, type TipoDocumento } from "@triade/domain";
import { Aviso, Botao, CampoSelecao, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, Vazio, type NomeIcone } from "@triade/ui";
import type { PropsAbaMemoria } from "../documentos/DocumentosEMemoria.tsx";
import { Janela, type Campo } from "../Janela.tsx";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { DocumentoResumo, ItemProntuario, ListaDocumentos, ListaPrestadores, PrestadorItem, Prontuario } from "../tipos.ts";
import { nomeTipoDocumento, SeloQuemVe } from "./comum.tsx";
import { PedidosDocumento } from "./PedidosDocumento.tsx";

export const camposDocumento = (restritos: boolean): Campo[] => [
  { id: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => ({ valor, texto })), erro: "Escolha o tipo." },
  { id: "titulo", rotulo: "Nome", tipo: "texto", obrigatorio: true, max: 120, erro: "De 3 a 120 caracteres, sem repetir outro documento." },
  { id: "descricao", rotulo: "Descrição", tipo: "area", max: 500, ajuda: "Opcional.", erro: "De 2 a 500 caracteres." },
  { id: "valeAte", rotulo: "Vale até", tipo: "data", ajuda: "Para laudo, certificado, seguro e contrato. Avisa 60 dias antes.", erro: "Data fora do esperado." },
  { id: "aoMorador", rotulo: "Pode ir ao morador", tipo: "caixa", ajuda: "Aparece no mural online e pode ser pedido e enviado por e-mail. Já ligado para convenção, regimento, atas e orçamento." },
  ...(restritos ? [{ id: "restrito", rotulo: "Só quem cuida dos documentos vê", tipo: "caixa", ajuda: "Para contratos e laudos sensíveis. Documento restrito não vai ao morador." } as Campo] : []),
];

/** Do formulário para a API. */
export const documentoParaApi = (v: Record<string, string | boolean>) => ({
  tipo: v.tipo, titulo: v.titulo, descricao: v.descricao || null, valeAte: v.valeAte || null,
  restrito: v.restrito === true, aoMorador: v.restrito === true ? false : v.aoMorador === true,
});

const COLUNAS = "md:grid-cols-[44px_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_20px]";
const ICONE_TIPO: Record<TipoDocumento, NomeIcone> = {
  CONVENCAO: "documento", REGIMENTO: "lista", ATA: "editar", CONTRATO: "documento", LAUDO: "escudo", ORCAMENTO: "grafico", OUTRO: "documento",
};

/** A validade em selo: âmbar quando faltam até 60 dias, vermelho só depois de vencida. */
function Validade({ d, hoje }: { d: DocumentoResumo; hoje: string }) {
  const texto = descreverValidade(d.valeAte, hoje);
  if (!texto) return <span className="t-apoio">Sem validade</span>;
  const frase = texto.charAt(0).toUpperCase() + texto.slice(1);
  if (d.vencido) return <Selo tom="erro">{frase}</Selo>;
  if (d.vencendo) return <Selo tom="atencao">{frase}</Selo>;
  return <span className="text-sm">{frase}</span>;
}

/** O que o prontuário diz do documento: a que itens está ligado, ou o item que falta e parece ser dele. */
export interface NoProntuario { itens: string[]; sugestao?: ItemProntuario }

export const chaveDoItem = (i: ItemProntuario) => i.id ?? i.chave!;

export function lerProntuario(p: Prontuario | null): (d: { id: string; titulo: string; tipo: string }) => NoProntuario | undefined {
  if (!p) return () => undefined;
  return (d) => {
    const itens = p.itens.filter((i) => i.documento?.id === d.id).map((i) => i.nome);
    if (itens.length) return { itens };
    const sugestao = p.podeEditar ? p.itens.find((i) => i.situacao === "FALTA" && documentoPareceDoItem(i.chave, d)) : undefined;
    return sugestao ? { itens, sugestao } : undefined;
  };
}

function LinhaDoProntuario({ n, d }: { n?: NoProntuario; d: DocumentoResumo }) {
  if (!n) return null;
  if (n.itens.length) return <span className="flex items-center gap-1.5 text-xs text-tinta-suave"><Icone nome="lista" className="h-3.5 w-3.5" />No prontuário: {n.itens.join(", ")}</span>;
  if (!n.sugestao) return null;
  return (
    <Link href={`/documentos/prontuario?item=${encodeURIComponent(chaveDoItem(n.sugestao))}&ligar=${d.id}`}
      className="relative z-10 flex items-center gap-1.5 justify-self-start text-xs font-semibold text-violeta-600 hover:underline">
      <Icone nome="link" className="h-3.5 w-3.5" />Parece o do item {n.sugestao.nome}. Ligar?
    </Link>
  );
}

export function LinhaDocumento({ d, hoje, prontuario }: { d: DocumentoResumo; hoje: string; prontuario?: NoProntuario }) {
  return (
    <li className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
      <span className="ladrilho h-11 w-11 self-start rounded-xl md:self-center" data-tom="violeta" aria-hidden="true"><Icone nome={ICONE_TIPO[d.tipo] ?? "documento"} /></span>
      <div className="grid min-w-0 gap-0.5">
        <Link href={`/documentos/documento?id=${d.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{d.titulo}</Link>
        <span className="t-apoio">
          {nomeTipoDocumento(d.tipo) === d.titulo ? "" : `${nomeTipoDocumento(d.tipo)} · `}{d.emVigor ? `${nomeTipoDocumento(d.tipo) === d.titulo ? "V" : "v"}ersão ${d.emVigor.numero} em vigor desde ${mostrarDataCurta(d.emVigor.vigenteDesde)}` : <span className="font-medium text-atencao">sem arquivo</span>}
          {d.proxima ? ` · versão ${d.proxima.numero} a partir de ${mostrarDataCurta(d.proxima.vigenteDesde)}` : ""}
        </span>
        <span className="flex flex-wrap items-center gap-2 pt-1 md:hidden"><SeloQuemVe d={d} sempre />{d.valeAte ? <Validade d={d} hoje={hoje} /> : null}</span>
        <LinhaDoProntuario n={prontuario} d={d} />
      </div>
      <span className="justify-self-start max-md:hidden"><SeloQuemVe d={d} sempre /></span>
      <span className="justify-self-start max-md:hidden"><Validade d={d} hoje={hoje} /></span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
    </li>
  );
}

/** As abas (decisão C.1 de 21/10/2026; Contratos pela D.1 de 22/10/2026); o tipo foi para Filtros. */
type Aba = "VIGOR" | "CONTRATOS" | "ARQUIVADOS" | "PEDIDOS";
const TIPOS_FILTRO = { CONVENCAO_REGIMENTO: FILTROS_DOCUMENTO.CONVENCAO_REGIMENTO, ATA: FILTROS_DOCUMENTO.ATA, CONTRATO: FILTROS_DOCUMENTO.CONTRATO, LAUDO: FILTROS_DOCUMENTO.LAUDO };
const QUEM_VE = { MORADOR: "Vai ao morador", RESTRITO: "Só quem cuida", GESTAO: "Só a gestão" } as const;
const ATENCAO = { VENCENDO: "Vence em até 60 dias", VENCIDO: "Vencido", SEM_ARQUIVO: "Sem arquivo" } as const;
type Atencao = keyof typeof ATENCAO;
const TOM_ATENCAO: Record<Atencao, string> = { VENCENDO: "atencao", VENCIDO: "erro", SEM_ARQUIVO: "neutro" };
const NA_ATENCAO: Record<Atencao, (d: DocumentoResumo) => boolean> = {
  VENCENDO: (d) => d.vencendo && !d.vencido, VENCIDO: (d) => d.vencido, SEM_ARQUIVO: (d) => !d.emVigor && !d.proxima,
};
const NO_QUEM_VE: Record<keyof typeof QUEM_VE, (d: DocumentoResumo) => boolean> = {
  MORADOR: (d) => !d.restrito && d.aoMorador, RESTRITO: (d) => d.restrito, GESTAO: (d) => !d.restrito && !d.aoMorador,
};

type Filtros = { aba: Aba; tipo: string; quem: string; atencao: string; busca: string };

function lerFiltros(b: URLSearchParams): Filtros {
  const v = (k: string) => b.get(k) ?? "";
  // O Início chega com ?filtro=VENCENDO e o sino com ?filtro=PEDIDOS.
  const velho = v("filtro");
  return {
    aba: velho === "PEDIDOS" || velho === "ARQUIVADOS" || velho === "CONTRATOS" ? velho : "VIGOR",
    tipo: v("tipo") in TIPOS_FILTRO ? v("tipo") : "",
    quem: v("quem") in QUEM_VE ? v("quem") : "",
    atencao: velho === "VENCENDO" ? "VENCENDO" : v("atencao") in ATENCAO ? v("atencao") : "",
    busca: v("busca"),
  };
}

function consulta(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.aba !== "VIGOR") q.set("filtro", f.aba);
  if (f.tipo) q.set("tipo", f.tipo);
  if (f.quem) q.set("quem", f.quem);
  if (f.atencao) q.set("atencao", f.atencao);
  if (f.busca) q.set("busca", f.busca);
  return q.toString();
}

function JanelaFiltros({ aberto, f, aoFechar, aplicar }: { aberto: boolean; f: Filtros; aoFechar: () => void; aplicar: (m: Partial<Filtros>) => void }) {
  const [v, setV] = useState({ tipo: f.tipo, quem: f.quem });
  return (
    <Dialogo aberto={aberto} titulo="Filtrar documentos" aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); aplicar(v); }}>
        <CampoSelecao id="doc-f-tipo" rotulo="Tipo" icone="lista" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })} disabled={f.aba !== "VIGOR"}
          ajuda={f.aba === "ARQUIVADOS" ? "Nos arquivados aparecem todos os tipos." : f.aba === "CONTRATOS" ? "Em Contratos aparecem só os contratos." : undefined}
          opcoes={[{ valor: "", texto: "Todos os tipos" }, ...Object.entries(TIPOS_FILTRO).map(([valor, texto]) => ({ valor, texto }))]} />
        <CampoSelecao id="doc-f-quem" rotulo="Quem vê" icone="olho" value={v.quem} onChange={(e) => setV({ ...v, quem: e.target.value })}
          opcoes={[{ valor: "", texto: "Todos" }, ...Object.entries(QUEM_VE).map(([valor, texto]) => ({ valor, texto }))]} />
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={() => aplicar({ tipo: "", quem: "" })}>Tirar filtros</Botao>
          <Botao type="submit">Mostrar documentos</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function Busca({ inicial, aoBuscar }: { inicial: string; aoBuscar: (b: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <form role="search" aria-label="Buscar documentos" className="busca min-w-0 flex-1 md:max-w-[520px]" onSubmit={(e) => { e.preventDefault(); aoBuscar(texto.trim()); }}>
      <Icone nome="busca" />
      <label htmlFor="doc-busca" className="sr-only">Buscar</label>
      <input id="doc-busca" className="campo" type="search" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nome ou descrição" />
    </form>
  );
}

/** O contrato de um prestador, só para ler: abre a ficha do prestador (D.1). */
function LinhaContrato({ p, hoje }: { p: PrestadorItem; hoje: string }) {
  const texto = p.contratoAte ? descreverValidade(p.contratoAte, hoje) : null;
  const frase = texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "Sem data de fim";
  return (
    <li className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 ${COLUNAS} md:border-t md:border-linha md:first:border-t-0`}>
      <span className="ladrilho h-11 w-11 self-start rounded-xl md:self-center" data-tom="violeta" aria-hidden="true"><Icone nome="ferramenta" /></span>
      <div className="grid min-w-0 gap-0.5">
        <Link href={`/manutencao/prestador?id=${p.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">Contrato com {p.nome}</Link>
        <span className="t-apoio">{p.servico}</span>
        <span className="flex flex-wrap items-center gap-2 pt-1 md:hidden"><Selo tom="andamento">Do prestador</Selo>{p.contratoVencido || p.contratoVence ? <Selo tom={p.contratoVencido ? "erro" : "atencao"}>{frase}</Selo> : null}</span>
      </div>
      <span className="justify-self-start max-md:hidden"><Selo tom="andamento">Do prestador</Selo></span>
      <span className="justify-self-start max-md:hidden">
        {p.contratoVencido || p.contratoVence ? <Selo tom={p.contratoVencido ? "erro" : "atencao"}>{frase}</Selo> : <span className="text-sm">{frase}</span>}
      </span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
    </li>
  );
}

function Cabeca({ quem = "Quem vê" }: { quem?: string }) {
  return (
    <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
      <span /><span className="t-rotulo">Documento</span><span className="t-rotulo">{quem}</span><span className="t-rotulo">Validade</span><span />
    </div>
  );
}

export function Documentos({ definir }: PropsAbaMemoria) {
  const router = useRouter();
  const busca = useSearchParams();
  const { pode } = usePlataforma();
  const f = lerFiltros(busca);
  const pedidos = f.aba === "PEDIDOS";
  const contratos = f.aba === "CONTRATOS";
  const api = new URLSearchParams();
  const filtroApi = f.aba === "ARQUIVADOS" ? "ARQUIVADOS" : contratos ? "CONTRATO" : f.tipo || "VIGOR";
  if (filtroApi !== "VIGOR") api.set("filtro", filtroApi);
  if (f.busca) api.set("busca", f.busca);
  const lista = useCarregar<ListaDocumentos>(`/v1/condominio/documentos${api.size ? `?${api}` : ""}`);
  const prontuario = useCarregar<Prontuario>("/v1/condominio/memoria/prontuario");
  const prestadores = useCarregar<ListaPrestadores>(contratos && pode("manutencao.ver") ? "/v1/condominio/manutencao/prestadores" : null);
  const [novo, setNovo] = useState(false);
  const [filtrandoAberto, setFiltrando] = useState(false);
  const hoje = hojeEmBrasilia();

  const ir = (m: Partial<Filtros>) => {
    const x = consulta({ ...f, ...m });
    router.replace(x ? `/documentos?${x}` : "/documentos", { scroll: false });
  };
  const dados = lista.estado === "pronto" ? lista.dados : null;
  const editar = dados?.pode.editar ?? false;
  useEffect(() => {
    definir({ principal: editar ? { texto: "Novo documento", icone: "mais", aoClicar: () => setNovo(true) } : null });
  }, [editar, definir]);
  const noProntuario = lerProntuario(prontuario.estado === "pronto" ? prontuario.dados : null);
  const noFiltro = (d: DocumentoResumo) => (!f.quem || NO_QUEM_VE[f.quem as keyof typeof QUEM_VE](d));
  const base = dados ? dados.itens.filter(noFiltro) : [];
  const itens = f.atencao ? base.filter(NA_ATENCAO[f.atencao as Atencao]) : base;
  const doPrestador = prestadores.estado === "pronto"
    ? prestadores.dados.itens.filter((p) => p.acordo === "CONTRATO" && !p.arquivado && (!f.busca || p.nome.toLowerCase().includes(f.busca.toLowerCase())))
    : [];
  const atalhos = f.aba === "VIGOR" ? (Object.keys(ATENCAO) as Atencao[]).map((a) => ({ a, n: base.filter(NA_ATENCAO[a]).length })).filter((x) => x.n > 0 || x.a === f.atencao) : [];
  const outros = [f.tipo, f.quem].filter(Boolean).length;
  const filtrando = Boolean(outros || f.atencao || f.busca);
  const novoDoc = <Botao onClick={() => setNovo(true)}><Icone nome="mais" />Novo documento</Botao>;
  const conta = (a: Aba) => (f.aba === a && dados && !f.busca && (a !== "VIGOR" || !f.tipo) ? { n: dados.total + (a === "CONTRATOS" ? doPrestador.length : 0) } : {});
  const abas: { id: Aba; texto: string; n?: number }[] = [
    { id: "VIGOR", texto: "Em vigor", ...conta("VIGOR") },
    { id: "CONTRATOS", texto: "Contratos", ...(contratos && prestadores.estado === "carregando" ? {} : conta("CONTRATOS")) },
    { id: "ARQUIVADOS", texto: "Arquivados", ...conta("ARQUIVADOS") },
    ...(dados?.pedidosEsperando !== undefined || pedidos ? [{ id: "PEDIDOS" as const, texto: "Pedidos por e-mail", ...(dados?.pedidosEsperando ? { n: dados.pedidosEsperando } : {}) }] : []),
  ];

  return (
    <div className="grid gap-5">
      {pedidos ? null : (
        <div className="flex items-center gap-3">
          <Busca key={f.busca} inicial={f.busca} aoBuscar={(b) => ir({ busca: b })} />
          <Botao variante="contorno" aria-label={outros ? `Filtros, ${outros} em uso` : "Filtros"} className="max-md:w-11 max-md:px-0" onClick={() => setFiltrando(true)}>
            <Icone nome="filtro" /><span className="max-md:hidden">Filtros{outros ? ` · ${outros}` : ""}</span>
          </Botao>
          {filtrando ? <Botao variante="discreto" className="max-md:hidden" onClick={() => ir({ tipo: "", quem: "", atencao: "", busca: "" })}>Limpar filtros</Botao> : null}
        </div>
      )}

      <section aria-labelledby="t-docs" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-docs" className="sr-only">Documentos encontrados</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {abas.map((a) => {
            const atual = f.aba === a.id;
            return (
              <button key={a.id} type="button" aria-pressed={atual} onClick={() => ir({ aba: a.id, atencao: "", tipo: a.id === "VIGOR" ? f.tipo : "" })}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {a.texto}
                {a.n !== undefined ? <><span className="sr-only"> ({a.n})</span><span aria-hidden="true" className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{a.n}</span></> : null}
              </button>
            );
          })}
        </nav>
        {atalhos.length ? (
          <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
            {atalhos.map(({ a, n }) => (
              <button key={a} type="button" aria-pressed={f.atencao === a} data-tom={TOM_ATENCAO[a]} className="chip-atencao" onClick={() => ir({ atencao: f.atencao === a ? "" : a })}>
                {ATENCAO[a]} <b>{n}</b>
              </button>
            ))}
          </div>
        ) : null}

        {pedidos ? <div className="md:p-5"><PedidosDocumento aoMudar={lista.recarregar} /></div> : null}
        {!pedidos && lista.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando os documentos…" /></div> : null}
        {!pedidos && lista.estado === "erro" ? <div className="p-5"><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} oQue="os documentos" /></div> : null}
        {dados && contratos ? (
          <>
            <h3 className="t-rotulo px-5 py-3 max-md:px-0">Guardados em Documentos</h3>
            {itens.length ? (
              <><Cabeca /><ul aria-label="Contratos guardados em Documentos" className="grid max-md:gap-3">{itens.map((d) => <LinhaDocumento key={d.id} d={d} hoje={hoje} />)}</ul></>
            ) : (
              <p className="t-apoio px-5 pb-4 max-md:px-0">Nenhum documento do tipo contrato{f.busca ? " com esta busca" : ""}. Contrato de administração ou de portaria entra por Novo documento, com o tipo Contrato.</p>
            )}
            {pode("manutencao.ver") ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-linha px-5 py-3 max-md:px-0">
                  <h3 className="t-rotulo">Dos prestadores · só para ler</h3>
                  <span className="t-apoio">Vêm da ficha de cada prestador, na Manutenção</span>
                </div>
                {prestadores.estado === "carregando" ? <div className="p-5"><Carregando linhas={2} rotulo="Carregando os contratos dos prestadores…" /></div> : null}
                {prestadores.estado === "erro" ? <div className="p-5"><ErroCarregar erro={prestadores.erro} texto={prestadores.texto} tentarDeNovo={prestadores.recarregar} oQue="os contratos dos prestadores" /></div> : null}
                {prestadores.estado === "pronto" ? (
                  doPrestador.length ? (
                    <><Cabeca quem="De onde vem" /><ul aria-label="Contratos dos prestadores" className="grid max-md:gap-3">{doPrestador.map((p) => <LinhaContrato key={p.id} p={p} hoje={hoje} />)}</ul></>
                  ) : <p className="t-apoio px-5 pb-4 max-md:px-0">Nenhum prestador com contrato{f.busca ? " com esta busca" : ""}.</p>
                ) : null}
                <p className="t-apoio py-4 md:border-t md:border-linha md:px-5">Para mudar o contrato de um prestador, abra a ficha dele: a data de fim fica com o prestador, para não haver duas cópias.</p>
              </>
            ) : null}
          </>
        ) : null}
        {dados && !pedidos && !contratos ? (
          itens.length === 0 ? (
            <div className="md:p-5">
              {filtrando ? <Vazio titulo="Nenhum documento com estes filtros" icone="filtro"
                acao={<Botao variante="contorno" onClick={() => ir({ tipo: "", quem: "", atencao: "", busca: "" })}>Limpar filtros</Botao>} />
                : f.aba === "ARQUIVADOS" ? <Vazio titulo="Nenhum documento arquivado" icone="documento">Arquivado sai de Em vigor e fica guardado aqui, com as versões.</Vazio>
                  : <Vazio titulo="Nenhum documento guardado" icone="documento" acao={dados.pode.editar ? novoDoc : undefined}>
                      Comece pela convenção e pelo regimento interno. Cada arquivo novo vira uma versão; as anteriores ficam guardadas.
                    </Vazio>}
            </div>
          ) : (
            <>
              <Cabeca />
              <ul aria-label="Documentos" className="grid max-md:gap-3">{itens.map((d) => <LinhaDocumento key={d.id} d={d} hoje={hoje} prontuario={noProntuario(d)} />)}</ul>
              <p className="t-apoio py-4 md:border-t md:border-linha md:px-5">{itens.length === 1 ? "1 documento" : `${itens.length} documentos`}. As versões anteriores ficam dentro de cada documento.</p>
            </>
          )
        ) : null}
      </section>
      {!dados?.pode.editar && dados ? <Aviso tom="neutro">Para guardar documentos, o síndico precisa dar a você a permissão Cuidar dos documentos.</Aviso> : null}
      <JanelaFiltros key={`${filtrandoAberto}`} aberto={filtrandoAberto} f={f} aoFechar={() => setFiltrando(false)} aplicar={(m) => { setFiltrando(false); ir(m); }} />

      {novo && dados ? (
        <Janela aberto titulo="Novo documento" textoBotao="Guardar documento" aoFechar={() => setNovo(false)}
          explicacao="Primeiro os dados; o arquivo entra em seguida, como a versão 1."
          campos={camposDocumento(dados.pode.restritos)}
          iniciais={{ tipo: contratos ? "CONTRATO" : "REGIMENTO", titulo: "", descricao: "", valeAte: "", aoMorador: aoMoradorPadrao((contratos ? "CONTRATO" : "REGIMENTO") as TipoDocumento), restrito: false }}
          aoSalvar={async (v) => {
            const r = await chamarApi<{ id: string }>("/v1/condominio/documentos", { corpo: documentoParaApi(v) });
            if (r.ok) router.push(`/documentos/documento?id=${r.dados.id}&novo=1`);
            return r;
          }} />
      ) : null}
    </div>
  );
}
