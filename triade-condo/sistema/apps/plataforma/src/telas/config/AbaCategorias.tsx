"use client";
// Categorias e prioridades (CF-08, CF-09, AT-04). Renomear mantém o identificador e o
// histórico não quebra; desativa em vez de apagar. Prioridade sempre com o significado escrito.

import { useState } from "react";
import { AvisoErro, Botao, chamarApi, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Janela, type Campo, type Valores } from "../Janela.tsx";
import type { Configuracoes } from "../tipos.ts";
import type { PropsAba } from "./Configuracoes.tsx";

type Categoria = Configuracoes["categorias"][number];
type Prioridade = Configuracoes["prioridades"][number];

type Edicao =
  | { tipo: "categoria"; item: Categoria | null }
  | { tipo: "prioridade"; item: Prioridade | null }
  | null;

const CAMPOS_CATEGORIA: Campo[] = [{ id: "nome", rotulo: "Nome da categoria", tipo: "texto", obrigatorio: true, max: 60, erro: "Escreva de 2 a 60 caracteres." }];
const CAMPOS_PRIORIDADE: Campo[] = [
  { id: "nome", rotulo: "Nome da prioridade", tipo: "texto", obrigatorio: true, max: 40, erro: "Escreva de 2 a 40 caracteres." },
  { id: "significado", rotulo: "O que ela significa", tipo: "area", obrigatorio: true, max: 200, erro: "Explique em 3 a 200 caracteres.",
    ajuda: "Quem registra o pedido lê isto para escolher. Ex.: risco à segurança ou dano acontecendo agora." },
  { id: "ativa", rotulo: "Ativa", tipo: "caixa", ajuda: "Desativada não aparece para pedidos novos; os antigos continuam com ela." },
];

export function AbaCategorias({ config, pode, recarregar, salvo }: PropsAba) {
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const fechar = () => setEdicao(null);

  async function alternar(c: Categoria) {
    const r = await chamarApi(`/v1/condominio/categorias/${c.id}`, { metodo: "PUT", corpo: { versao: c.versao, nome: c.nome, ativa: !c.ativa } });
    if (r.ok) salvo(c.ativa ? `Categoria ${c.nome} desativada. Os pedidos antigos continuam com ela.` : `Categoria ${c.nome} reativada.`);
    else setFalha(r.erro);
  }

  async function salvar(v: Valores) {
    if (!edicao) throw new Error("sem edição");
    const rota = edicao.tipo === "categoria" ? "categorias" : "prioridades";
    const corpo = edicao.tipo === "categoria"
      ? { nome: v.nome, ...(edicao.item ? { versao: edicao.item.versao, ativa: edicao.item.ativa } : {}) }
      : { nome: v.nome, significado: v.significado, ...(edicao.item ? { versao: edicao.item.versao, ativa: v.ativa === true } : {}) };
    const r = edicao.item
      ? await chamarApi(`/v1/condominio/${rota}/${edicao.item.id}`, { metodo: "PUT", corpo })
      : await chamarApi(`/v1/condominio/${rota}`, { corpo });
    if (r.ok) { fechar(); salvo(edicao.tipo === "categoria" ? "Categoria salva." : "Prioridade salva."); }
    return r;
  }

  const prioridades = [...config.prioridades].sort((a, b) => b.nivel - a.nivel);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {falha ? <div className="lg:col-span-2"><AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={recarregar} /></div> : null}
      <section aria-labelledby="t-categorias" className="grid content-start gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-categorias" className="text-lg font-semibold">Categorias</h2>
          {pode ? <Botao variante="secundario" onClick={() => setEdicao({ tipo: "categoria", item: null })}>+ Categoria</Botao> : null}
        </div>
        <ul className="divide-y divide-linha rounded-lg border border-linha">
          {config.categorias.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span className={c.ativa ? "font-medium" : "text-tinta-suave"}>{c.nome}</span>
                {c.ativa ? <Selo tom="ok" marca="ok">Ativa</Selo> : <Selo tom="neutro" marca="inativo">Desativada</Selo>}
              </span>
              {pode ? (
                <span className="flex gap-1">
                  {c.ativa ? <Botao variante="texto" onClick={() => setEdicao({ tipo: "categoria", item: c })} aria-label={`Renomear ${c.nome}`}>Renomear</Botao> : null}
                  <Botao variante="texto" onClick={() => void alternar(c)} aria-label={`${c.ativa ? "Desativar" : "Reativar"} ${c.nome}`}>{c.ativa ? "Desativar" : "Reativar"}</Botao>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-tinta-suave">Desativada não aparece para pedidos novos; os antigos continuam com ela.</p>
      </section>
      <section aria-labelledby="t-prioridades" className="grid content-start gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-prioridades" className="text-lg font-semibold">Prioridades</h2>
          {pode ? <Botao variante="secundario" onClick={() => setEdicao({ tipo: "prioridade", item: null })}>+ Prioridade</Botao> : null}
        </div>
        <ul className="divide-y divide-linha rounded-lg border border-linha">
          {prioridades.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="grid gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={p.ativa ? "font-medium" : "text-tinta-suave"}>{p.nome}</span>
                  {p.ativa ? null : <Selo tom="neutro" marca="inativo">Desativada</Selo>}
                </span>
                <span className="text-tinta-suave">{p.significado}</span>
              </span>
              {pode ? <Botao variante="texto" onClick={() => setEdicao({ tipo: "prioridade", item: p })} aria-label={`Editar a prioridade ${p.nome}`}>Editar</Botao> : null}
            </li>
          ))}
        </ul>
      </section>
      <Janela
        aberto={edicao !== null}
        titulo={edicao?.tipo === "prioridade" ? (edicao.item ? `Editar prioridade ${edicao.item.nome}` : "Nova prioridade") : edicao?.item ? `Renomear ${edicao.item.nome}` : "Nova categoria"}
        textoBotao="Salvar"
        campos={edicao?.tipo === "prioridade" ? (edicao.item ? CAMPOS_PRIORIDADE : CAMPOS_PRIORIDADE.slice(0, 2)) : CAMPOS_CATEGORIA}
        iniciais={edicao?.tipo === "prioridade"
          ? { nome: edicao.item?.nome ?? "", significado: edicao.item?.significado ?? "", ativa: edicao.item?.ativa ?? true }
          : { nome: edicao?.item?.nome ?? "" }}
        explicacao={edicao?.tipo === "categoria" && edicao.item ? "Renomear mantém o mesmo identificador: os pedidos antigos passam a mostrar o nome novo." : undefined}
        aoFechar={fechar}
        aoSalvar={salvar}
        recarregar={recarregar}
      />
    </div>
  );
}
