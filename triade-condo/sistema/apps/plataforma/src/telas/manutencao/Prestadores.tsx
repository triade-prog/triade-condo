"use client";
// Prestadores (DC15, telas-modelo manutencao-prestadores-*; MP-05, MP-09): o cadastro do
// condomínio, que fica quando o síndico muda. Começa pelos contratos e acordos que já existem:
// com contrato mostra a vigência e avisa perto do fim; por chamado mostra a reserva. Ativos e
// arquivados em abas com a contagem, a busca com a lupa (nome, serviço ou telefone) e, em "Pede
// atenção", o contrato perto do fim e quem tem manutenção pendente. No celular, cartões.
// Registrar não é contratar.

import Link from "next/link";
import { useState } from "react";
import { ACORDOS_PRESTADOR, mostrarDataCurta, mostrarTelefone } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, Iniciais, Selo, Vazio } from "@triade/ui";
import { opcoesDe } from "../pedidos/comum.tsx";
import { Janela, type Campo, type Valores } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ListaPrestadores, PrestadorItem, Recado } from "../tipos.ts";
import { PartesManutencao } from "./comum.tsx";

/** Campos do prestador, para cadastrar e editar. */
export function camposPrestador(outros: { id: string; nome: string }[]): Campo[] {
  return [
    { id: "nome", rotulo: "Nome ou empresa", tipo: "texto", obrigatorio: true, max: 120, erro: "De 2 a 120 caracteres, sem repetir outro ativo." },
    { id: "servico", rotulo: "Serviço", tipo: "texto", obrigatorio: true, max: 80, ajuda: "Ex.: elevadores, bombas, extintores.", erro: "De 2 a 80 caracteres." },
    { id: "acordo", rotulo: "Como trabalha com o condomínio", tipo: "selecao", opcoes: opcoesDe(ACORDOS_PRESTADOR), erro: "Escolha." },
    { id: "contratoAte", rotulo: "Contrato até (só com contrato)", tipo: "data", ajuda: "Avisa no início 60 dias antes do fim.", erro: "Vigência só de contrato." },
    { id: "desde", rotulo: "Trabalha com o prédio desde", tipo: "data", erro: "Uma data até hoje." },
    { id: "contato", rotulo: "Pessoa de contato", tipo: "texto", max: 120, erro: "De 2 a 120 caracteres." },
    { id: "telefone", rotulo: "Telefone", tipo: "texto", max: 30, ajuda: "Com DDD.", erro: "Telefone inválido." },
    { id: "email", rotulo: "E-mail", tipo: "texto", max: 254, erro: "E-mail inválido." },
    { id: "documento", rotulo: "CNPJ ou CPF", tipo: "texto", max: 18, erro: "CNPJ ou CPF inválido." },
    { id: "reservaId", rotulo: "Reserva indicada", tipo: "selecao", ajuda: "Para chamar quando o principal não responder.", erro: "A reserva é outro prestador do cadastro.",
      opcoes: [{ valor: "", texto: "Nenhuma" }, ...outros.map((p) => ({ valor: p.id, texto: p.nome }))] },
    { id: "observacao", rotulo: "Observação", tipo: "area", max: 1000, ajuda: "Ex.: atende fora do horário, com taxa." },
  ];
}

export function iniciaisPrestador(p: PrestadorItem | null): Valores {
  return {
    nome: p?.nome ?? "", servico: p?.servico ?? "", acordo: p?.acordo ?? "CHAMADO", contratoAte: p?.contratoAte ?? "", desde: p?.desde ?? "",
    contato: p?.contato ?? "", telefone: p?.telefone ?? "", email: p?.email ?? "", documento: p?.documento ?? "",
    reservaId: p?.reserva?.id ?? "", observacao: p?.observacao ?? "",
  };
}

export async function salvarPrestador(p: PrestadorItem | null, v: Valores) {
  const corpo = {
    nome: v.nome, servico: v.servico, acordo: v.acordo, contratoAte: v.acordo === "CONTRATO" ? v.contratoAte || null : null, desde: v.desde || null,
    contato: v.contato || null, telefone: v.telefone || null, email: v.email || null, documento: v.documento || null,
    reservaId: v.reservaId || null, observacao: v.observacao || null, ...(p ? { versao: p.versao } : {}),
  };
  return p
    ? chamarApi<{ id: string }>(`/v1/condominio/manutencao/prestadores/${p.id}`, { metodo: "PUT", corpo })
    : chamarApi<{ id: string }>("/v1/condominio/manutencao/prestadores", { corpo });
}

/** O que o prestador tem aberto no prédio. */
function SeloManutencoes({ p }: { p: PrestadorItem }) {
  if (p.pendentes) return <Selo tom="atencao">{p.pendentes === 1 ? "1 pendente" : `${p.pendentes} pendentes`}</Selo>;
  if (p.abertas) return <Selo tom="andamento">{p.abertas === 1 ? "1 aberta" : `${p.abertas} abertas`}</Selo>;
  return <span className="t-apoio">Nada aberto</span>;
}

function SeloContrato({ p }: { p: PrestadorItem }) {
  if (p.contratoVencido) return <Selo tom="erro">Contrato vencido</Selo>;
  if (p.contratoVence) return <Selo tom="atencao">Contrato perto do fim</Selo>;
  return null;
}

type Atencao = "" | "CONTRATO" | "PENDENCIA";
const COLUNAS = "md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_10rem_20px]";

export function Prestadores() {
  const [arquivados, setArquivados] = useState<"ATIVOS" | "ARQUIVADOS">("ATIVOS");
  const lista = useCarregar<ListaPrestadores>(`/v1/condominio/manutencao/prestadores${arquivados === "ARQUIVADOS" ? "?arquivados=1" : ""}`);
  const [novo, setNovo] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);
  const [busca, setBusca] = useState("");
  const [atencao, setAtencao] = useState<Atencao>("");
  const [ativos, setAtivos] = useState<number | null>(null);

  const dados = lista.estado === "pronto" ? lista.dados : null;
  if (dados && arquivados === "ATIVOS" && ativos !== dados.itens.length) setAtivos(dados.itens.length);
  const termo = busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  const todos = dados?.itens ?? [];
  const contrato = todos.filter((p) => p.contratoVence || p.contratoVencido).length;
  const pendencia = todos.filter((p) => p.pendentes > 0).length;
  const itens = todos.filter((p) => (!termo || p.nome.toLowerCase().includes(termo) || p.servico.toLowerCase().includes(termo)
    || (digitos.length >= 4 && (p.telefone ?? "").replace(/\D/g, "").includes(digitos)))
    && (atencao !== "CONTRATO" || p.contratoVence || p.contratoVencido) && (atencao !== "PENDENCIA" || p.pendentes > 0));
  const grupos = [
    { titulo: "Com contrato", itens: itens.filter((p) => p.acordo === "CONTRATO") },
    { titulo: "Por chamado", itens: itens.filter((p) => p.acordo === "CHAMADO") },
  ].filter((g) => g.itens.length);
  const novo_ = dados?.pode.editar ? <Botao onClick={() => setNovo(true)}><Icone nome="pessoa-mais" />Novo prestador</Botao> : null;
  const abas = [{ valor: "ATIVOS" as const, texto: "Ativos", n: ativos }, { valor: "ARQUIVADOS" as const, texto: "Arquivados", n: dados?.arquivados ?? null }];

  return (
    <div className="grid gap-5 max-md:pb-16">
      <PartesManutencao />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Prestadores</h1>
          <p className="t-apoio mt-1">Quem já presta serviço ao condomínio. O cadastro é do condomínio e fica quando o síndico muda.</p>
        </div>
        {novo_ ? <div className="max-md:hidden">{novo_}</div> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <form role="search" aria-label="Buscar prestadores" className="busca min-w-0 md:max-w-[520px]" onSubmit={(e) => e.preventDefault()}>
        <Icone nome="busca" />
        <label htmlFor="pr-busca" className="sr-only">Buscar prestadores</label>
        <input id="pr-busca" className="campo" type="search" placeholder="Buscar por nome, serviço ou telefone" maxLength={60} value={busca} onChange={(e) => setBusca(e.target.value)} />
      </form>

      <section aria-labelledby="t-prestadores" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-prestadores" className="sr-only">Prestadores do cadastro</h2>
        <nav aria-label="Ativos ou arquivados" className="flex gap-1 border-b border-linha md:px-3">
          {abas.map((a) => {
            const atual = arquivados === a.valor;
            return (
              <button key={a.valor} type="button" aria-pressed={atual} onClick={() => { setArquivados(a.valor); setAtencao(""); }}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {a.texto}
                {a.n !== null ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : ""}`}>{a.n}</span> : null}
              </button>
            );
          })}
        </nav>
        {arquivados === "ATIVOS" && (contrato || pendencia) ? (
          <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
            {contrato ? (
              <button type="button" aria-pressed={atencao === "CONTRATO"} data-tom="atencao" className="chip-atencao" onClick={() => setAtencao(atencao === "CONTRATO" ? "" : "CONTRATO")}>
                <Icone nome="documento" className="h-4 w-4" />Contrato perto do fim <b>{contrato}</b>
              </button>
            ) : null}
            {pendencia ? (
              <button type="button" aria-pressed={atencao === "PENDENCIA"} data-tom="atencao" className="chip-atencao" onClick={() => setAtencao(atencao === "PENDENCIA" ? "" : "PENDENCIA")}>
                <Icone nome="alerta" className="h-4 w-4" />Com pendência <b>{pendencia}</b>
              </button>
            ) : null}
          </div>
        ) : null}

        {lista.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando os prestadores…" /></div> : null}
        {lista.estado === "erro" ? <div className="p-5"><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /></div> : null}
        {dados ? (
          grupos.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={arquivados === "ARQUIVADOS" ? "Nenhum prestador arquivado" : termo || atencao ? "Nenhum prestador com essa busca" : "Nenhum prestador cadastrado"} icone="pessoas"
                acao={arquivados === "ATIVOS" && !termo && !atencao ? novo_ ?? undefined : undefined}>
                {arquivados === "ATIVOS" && !termo && !atencao ? "Comece pelos contratos e acordos que o condomínio já tem." : undefined}
              </Vazio>
            </div>
          ) : (
            <>
              <div aria-hidden="true" className={`hidden gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid ${COLUNAS}`}>
                <span /><span className="t-rotulo">Prestador</span><span className="t-rotulo">Serviço</span><span className="t-rotulo">Acordo</span><span className="t-rotulo">Manutenções</span><span />
              </div>
              {grupos.map((g) => (
                <section key={g.titulo} aria-label={g.titulo}>
                  <h3 className="flex justify-between py-2 t-apoio font-medium text-tinta-suave md:border-b md:border-linha md:bg-fundo md:px-5">{g.titulo}<span>{g.itens.length}</span></h3>
                  <ul className="grid max-md:gap-3">
                    {g.itens.map((p) => {
                      const contato = [p.contato, p.telefone ? mostrarTelefone(p.telefone) : p.email].filter(Boolean).join(" · ") || "Sem contato";
                      const acordo = `${p.acordo === "CONTRATO" ? (p.contratoAte ? `Contrato até ${mostrarDataCurta(p.contratoAte)}` : "Contrato sem data de fim") : "Avulso"}${p.reserva ? ` · reserva: ${p.reserva.nome}` : ""}`;
                      return (
                        <li key={p.id} className={`relative grid grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-b md:border-linha md:last:border-b-0 ${COLUNAS}`}>
                          <Iniciais nome={p.nome} className="h-9 w-9 self-start md:self-center" />
                          <span className="grid min-w-0 gap-0.5">
                            <Link href={`/manutencao/prestador?id=${p.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{p.nome}</Link>
                            <span className="t-apoio md:hidden">{p.servico} · {acordo}</span>
                            <span className="t-apoio truncate">{contato}</span>
                            <span className="flex flex-wrap items-center gap-2 pt-1 md:hidden"><SeloContrato p={p} /><SeloManutencoes p={p} /></span>
                          </span>
                          <span className="t-texto max-md:hidden">{p.servico}</span>
                          <span className="grid justify-items-start gap-1 t-texto max-md:hidden">{acordo}<SeloContrato p={p} /></span>
                          <span className="max-md:hidden"><SeloManutencoes p={p} /></span>
                          <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
                <span className="t-apoio">{itens.length === 1 ? "1 prestador" : `${itens.length} prestadores`}{arquivados === "ATIVOS" ? (itens.length === 1 ? " ativo" : " ativos") : ""}</span>
                <span className="t-apoio">Registrar um prestador não é contratar. Quem saiu é arquivado e continua no histórico das manutenções que fez.</span>
              </div>
            </>
          )
        ) : null}
      </section>

      {novo_ ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{novo_}</div> : null}

      {dados && novo ? (
        <Janela aberto titulo="Novo prestador" textoBotao="Cadastrar prestador" aoFechar={() => setNovo(false)} recarregar={lista.recarregar}
          campos={camposPrestador(dados.itens.filter((p) => !p.arquivado))} iniciais={iniciaisPrestador(null)}
          aoSalvar={async (v) => {
            const r = await salvarPrestador(null, v);
            if (r.ok) { setNovo(false); setRecado({ tom: "ok", texto: "Prestador cadastrado." }); lista.recarregar(); }
            return r;
          }} />
      ) : null}
    </div>
  );
}
