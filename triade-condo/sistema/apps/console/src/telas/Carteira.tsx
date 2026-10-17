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
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.clientes.length === 0 ? (
        <Vazio titulo="Nenhum cliente atribuído a você ainda">
          {podeCadastrar
            ? "Cadastre o primeiro condomínio. Ele aparece aqui, em implantação."
            : "Quando a administração atribuir um condomínio a você, ele aparece aqui."}
        </Vazio>
      ) : null}
      {carga.estado === "pronto" && carga.dados.clientes.length > 0 ? (
        <>
          <div role="group" aria-label="Filtrar a carteira" className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className="min-h-9 rounded-full border border-linha px-3 text-xs aria-pressed:border-lilas aria-pressed:bg-selecao aria-pressed:font-semibold aria-pressed:text-selecao-tinta"
              >
                {f.texto} · {carga.dados.clientes.filter(f.aceita).length}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-linha">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Clientes da carteira</caption>
              <thead>
                <tr className="text-left text-xs text-tinta-suave">
                  <th scope="col" className="px-4 py-3 font-semibold">Condomínio</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Estágio</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Situações a tratar</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Sua função</th>
                </tr>
              </thead>
              <tbody>
                {carga.dados.clientes.filter(FILTROS.find((f) => f.id === filtro)!.aceita).map((c) => (
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
