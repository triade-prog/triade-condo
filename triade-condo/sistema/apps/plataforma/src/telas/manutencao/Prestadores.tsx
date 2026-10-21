"use client";
// Prestadores (design "Telas da Manutenção", tela 6; MP-05, MP-09): o cadastro do condomínio,
// que fica quando o síndico muda. Começa pelos contratos e acordos que já existem: com contrato
// mostra a vigência e avisa perto do fim; por chamado mostra a reserva. Registrar não é contratar.

import Link from "next/link";
import { useState } from "react";
import { ACORDOS_PRESTADOR, mostrarDataCurta, mostrarTelefone } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Selo, Vazio } from "@triade/ui";
import { Escolha } from "../moradores/comum.tsx";
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

function SeloPrestador({ p }: { p: PrestadorItem }) {
  if (p.contratoVencido) return <Selo tom="erro">Contrato vencido</Selo>;
  if (p.contratoVence) return <Selo tom="atencao">Contrato perto do fim</Selo>;
  if (p.pendentes) return <Selo tom="erro">{p.pendentes === 1 ? "1 pendente" : `${p.pendentes} pendentes`}</Selo>;
  if (p.abertas) return <Selo tom="andamento">{p.abertas === 1 ? "1 aberta" : `${p.abertas} abertas`}</Selo>;
  return <Selo tom="neutro">Nada aberto</Selo>;
}

export function Prestadores() {
  const [arquivados, setArquivados] = useState<"ATIVOS" | "ARQUIVADOS">("ATIVOS");
  const lista = useCarregar<ListaPrestadores>(`/v1/condominio/manutencao/prestadores${arquivados === "ARQUIVADOS" ? "?arquivados=1" : ""}`);
  const [novo, setNovo] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);
  const [busca, setBusca] = useState("");

  const dados = lista.estado === "pronto" ? lista.dados : null;
  const termo = busca.trim().toLowerCase();
  const itens = (dados?.itens ?? []).filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.servico.toLowerCase().includes(termo));
  const grupos = [
    { titulo: "Com contrato", itens: itens.filter((p) => p.acordo === "CONTRATO") },
    { titulo: "Por chamado", itens: itens.filter((p) => p.acordo === "CHAMADO") },
  ].filter((g) => g.itens.length);

  return (
    <div className="grid gap-5">
      <PartesManutencao />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Prestadores</h1>
          <p className="mt-1 text-tinta-suave">Quem já presta serviço ao condomínio. O cadastro é do condomínio e fica quando o síndico muda.</p>
        </div>
        {dados?.pode.editar ? <Botao onClick={() => setNovo(true)}>+ Novo prestador</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Escolha rotulo="Prestadores ativos ou arquivados" atual={arquivados} aoMudar={setArquivados}
          opcoes={[{ valor: "ATIVOS" as const, texto: "Ativos" }, { valor: "ARQUIVADOS" as const, texto: `Arquivados${dados ? ` · ${dados.arquivados}` : ""}` }]} />
        <label className="grid gap-1 text-sm">
          <span className="text-[13px] font-medium">Buscar</span>
          <input className="campo" placeholder="Nome ou serviço" maxLength={60} value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>

      {lista.estado === "carregando" ? <Carregando rotulo="Carregando os prestadores…" /> : null}
      {lista.estado === "erro" ? <ErroCarregar texto={lista.texto} tentarDeNovo={lista.recarregar} /> : null}
      {dados ? (
        grupos.length === 0 ? (
          <Vazio titulo={arquivados === "ARQUIVADOS" ? "Nenhum prestador arquivado" : termo ? "Nenhum prestador com essa busca" : "Nenhum prestador cadastrado"}>
            {arquivados === "ATIVOS" && !termo ? "Comece pelos contratos e acordos que o condomínio já tem." : undefined}
          </Vazio>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-linha bg-superficie shadow-s1">
            {grupos.map((g) => (
              <section key={g.titulo} aria-label={g.titulo}>
                <h2 className="flex justify-between border-b border-linha bg-violeta-50/60 px-4 py-2 text-[13px] font-medium text-tinta-suave">{g.titulo}<span>{g.itens.length}</span></h2>
                <ul>
                  {g.itens.map((p) => (
                    <li key={p.id} className="grid gap-1 border-b border-linha px-4 py-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_11rem] md:items-center md:gap-4">
                      <span className="grid min-w-0 gap-0.5">
                        <Link href={`/manutencao/prestador?id=${p.id}`} className="font-medium hover:text-violeta-600 hover:underline">{p.nome}</Link>
                        <span className="truncate text-[13px] text-tinta-suave">{[p.contato, p.telefone ? mostrarTelefone(p.telefone) : p.email].filter(Boolean).join(" · ") || "Sem contato"}</span>
                      </span>
                      <span>{p.servico}</span>
                      <span className="text-tinta-suave">
                        {p.acordo === "CONTRATO" ? (p.contratoAte ? `Contrato até ${mostrarDataCurta(p.contratoAte)}` : "Contrato sem data de fim") : "Avulso"}
                        {p.reserva ? ` · reserva: ${p.reserva.nome}` : ""}
                      </span>
                      <span><SeloPrestador p={p} /></span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : null}
      <p className="text-sm text-tinta-suave">Registrar um prestador não é contratar. Prestador que saiu é arquivado e continua no histórico das manutenções que fez.</p>

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
