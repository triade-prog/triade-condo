"use client";
// Carteira de clientes (PI-01, V-10): só os condomínios atribuídos a quem está vendo (PI-10),
// com estágio e situações a tratar.

import Link from "next/link";
import { useState } from "react";
import { Carregando, classeBotao, ErroCarregar, Vazio } from "@triade/ui";
import { useCarregar, useSessao } from "./sessao.tsx";
import { nomeFuncao, SeloEstagio, SeloSituacao } from "./rotulos.tsx";

interface Cliente {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  estagio: string;
  cenario: string | null;
  funcoes: string[];
  situacoes: string[];
}

const FILTROS = [
  { id: "todos", texto: "Todos", aceita: () => true },
  { id: "implantacao", texto: "Em implantação", aceita: (c: Cliente) => c.estagio === "IMPLANTACAO" },
  { id: "ativos", texto: "Ativos", aceita: (c: Cliente) => c.estagio === "ATIVO" },
  { id: "tratar", texto: "Com situações a tratar", aceita: (c: Cliente) => c.situacoes.length > 0 },
] as const;

export function Carteira() {
  const sessao = useSessao();
  const carga = useCarregar<{ clientes: Cliente[] }>("/v1/clientes");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const podeCadastrar = sessao.acoes.includes("console.condominios.criar");
  const visiveis = carga.estado === "pronto" ? carga.dados.clientes.filter(FILTROS.find((f) => f.id === filtro)!.aceita) : [];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Carteira de clientes</h1>
          <p className="text-tinta-suave">Os condomínios que você atende.</p>
        </div>
        {podeCadastrar ? <Link href="/clientes/novo" className={classeBotao()}>+ Cadastrar condomínio</Link> : null}
      </div>

      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.clientes.length === 0 ? (
        <Vazio titulo="Nenhum cliente atribuído a você ainda">
          {podeCadastrar
            ? "Cadastre o primeiro condomínio. Ele aparece aqui, em implantação."
            : "Quando a administração atribuir um condomínio a você, ele aparece aqui."}
        </Vazio>
      ) : null}
      {carga.estado === "pronto" && carga.dados.clientes.length > 0 ? (
        <>
          <div role="group" aria-label="Filtrar a carteira" className="trilho justify-self-start">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className="chip"
              >
                {f.texto} · {carga.dados.clientes.filter(f.aceita).length}
              </button>
            ))}
          </div>
          <ul className="grid gap-2.5 md:hidden">
            {visiveis.map((c) => (
              <li key={c.id} className="grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/clientes/${c.id}`} className="font-semibold text-tinta hover:underline">{c.nome}</Link>
                  <SeloEstagio estagio={c.estagio} />
                </span>
                <span className="text-xs text-tinta-suave">{[c.cidade, c.uf].filter(Boolean).join(" · ")} · {c.funcoes.map(nomeFuncao).join(", ")}</span>
                {c.situacoes.length ? (
                  <span className="flex flex-wrap gap-1">{c.situacoes.map((s) => <SeloSituacao key={s} situacao={s} />)}</span>
                ) : <span className="text-xs text-tinta-suave">Nada a tratar</span>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-linha bg-superficie shadow-s1 md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Clientes da carteira</caption>
              <thead>
                <tr className="bg-violeta-50/60 text-left text-[13px] text-tinta-suave">
                  <th scope="col" className="px-4 py-3 font-medium">Condomínio</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estágio</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situações a tratar</th>
                  <th scope="col" className="px-4 py-3 font-medium">Sua função</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.id} className="border-t border-linha align-top hover:bg-superficie-2">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="font-semibold text-tinta hover:underline">{c.nome}</Link>
                      <span className="block text-xs text-tinta-suave">{[c.cidade, c.uf].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-4 py-3"><SeloEstagio estagio={c.estagio} /></td>
                    <td className="px-4 py-3">
                      {c.situacoes.length ? (
                        <span className="flex flex-wrap gap-1">{c.situacoes.map((s) => <SeloSituacao key={s} situacao={s} />)}</span>
                      ) : <span className="text-xs text-tinta-suave">Nada a tratar</span>}
                    </td>
                    <td className="px-4 py-3">{c.funcoes.map(nomeFuncao).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
