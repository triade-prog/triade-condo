"use client";
// Etapas e modelos de resposta (AT-05, CF-09, AT-25). Toda etapa pertence a aberto, em
// andamento ou encerrado, e isso não muda depois; pode valer para todos os pedidos ou para
// uma categoria, e pode pausar o prazo (ex.: aguardando o morador). As etapas são ajuste da
// TRÍADE (CF-09, PI-04): no app ficam em leitura; os modelos de resposta, o síndico ajusta.

import { useState } from "react";
import { SITUACOES_ETAPA } from "@triade/domain";
import { Botao, chamarApi, Icone, Selo } from "@triade/ui";
import { Janela, type Campo, type Valores } from "./Janela.tsx";
import type { Configuracoes } from "./tipos.ts";
import type { PropsAba } from "./Configuracoes.tsx";
import { campoMotivo, etapasAtivas, FaixaTriade } from "./tecnica.tsx";
import { naBase } from "./contexto.tsx";

type Etapa = Configuracoes["etapas"][number];
type Modelo = Configuracoes["modelos"][number];
type Edicao = { tipo: "etapa"; item: Etapa | null } | { tipo: "modelo"; item: Modelo | null } | null;

/** Uma das duas páginas: Etapas (da TRÍADE) ou Respostas prontas (do síndico). */
export function AbaEtapas({ config, pode, recarregar, salvo, tecnica, parte }: PropsAba & { parte: "etapas" | "modelos" }) {
  const [edicao, setEdicao] = useState<Edicao>(null);
  const fechar = () => setEdicao(null);
  const nomeCategoria = (id: string | null) => config.categorias.find((c) => c.id === id)?.nome;
  const opcoesCategoria = (rotuloVazio: string) => [
    { valor: "", texto: rotuloVazio },
    ...config.categorias.filter((c) => c.ativa).map((c) => ({ valor: c.id, texto: c.nome })),
  ];

  function campos(): Campo[] {
    if (edicao?.tipo === "modelo") {
      return [
        { id: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true, max: 60, erro: "Escreva de 2 a 60 caracteres." },
        { id: "texto", rotulo: "Texto da resposta", tipo: "area", obrigatorio: true, max: 2000, erro: "Escreva o texto (até 2.000 caracteres)." },
        { id: "categoriaId", rotulo: "Categoria", tipo: "selecao", opcoes: opcoesCategoria("Qualquer categoria"), ajuda: "Com categoria, a resposta aparece primeiro nos pedidos dela." },
        ...(edicao.item ? [{ id: "ativo", rotulo: "Ativo", tipo: "caixa" } as Campo] : []),
      ];
    }
    const nova = !edicao?.item;
    const encerrado = (edicao?.item?.situacao ?? "") === "ENCERRADO";
    return [
      { id: "nome", rotulo: "Nome da etapa", tipo: "texto", obrigatorio: true, max: 40, erro: "Escreva de 2 a 40 caracteres." },
      ...(nova ? [
        { id: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: Object.entries(SITUACOES_ETAPA).map(([valor, texto]) => ({ valor, texto })),
          ajuda: "Não muda depois. Para outra situação, crie outra etapa.", erro: "Escolha a situação." } as Campo,
        { id: "categoriaId", rotulo: "Vale para", tipo: "selecao", opcoes: opcoesCategoria("Todos os pedidos"), ajuda: "Não muda depois.", erro: "Categoria não encontrada." } as Campo,
      ] : []),
      { id: "pausaPrazo", rotulo: "Pausa o prazo enquanto o pedido estiver nesta etapa", tipo: "caixa", desligado: encerrado,
        ajuda: "Use quando a espera não depende do condomínio (ex.: aguardando o morador)." },
      ...(nova ? [] : [{ id: "ativa", rotulo: "Ativa", tipo: "caixa", ajuda: "Desativada não recebe pedidos novos." } as Campo]),
      ...(tecnica.motivo ? [campoMotivo] : []),
    ];
  }

  function iniciais(): Valores {
    if (edicao?.tipo === "modelo") {
      const m = edicao.item;
      return { titulo: m?.titulo ?? "", texto: m?.texto ?? "", categoriaId: m?.categoriaId ?? "", ativo: m?.ativo ?? true };
    }
    const e = edicao?.item;
    return { nome: e?.nome ?? "", situacao: e?.situacao ?? "EM_ANDAMENTO", categoriaId: e?.categoriaId ?? "", pausaPrazo: e?.pausaPrazo ?? false, ativa: e?.ativa ?? true,
             motivo: "" };
  }

  async function salvar(v: Valores) {
    if (!edicao) throw new Error("sem edição");
    const item = edicao.item;
    let corpo: Record<string, unknown>;
    if (edicao.tipo === "modelo") {
      const m = edicao.item;
      corpo = { titulo: v.titulo, texto: v.texto, categoriaId: v.categoriaId || null, ...(m ? { versao: m.versao, ativo: v.ativo === true } : {}) };
    } else if (edicao.item) {
      const e = edicao.item;
      corpo = { versao: e.versao, nome: v.nome, pausaPrazo: e.situacao === "ENCERRADO" ? false : v.pausaPrazo === true, ativa: v.ativa === true,
                motivo: v.motivo || undefined };
    } else {
      corpo = { nome: v.nome, situacao: v.situacao, categoriaId: v.categoriaId || null, pausaPrazo: v.situacao === "ENCERRADO" ? false : v.pausaPrazo === true,
                motivo: v.motivo || undefined };
    }
    const rota = edicao.tipo === "modelo" ? "modelos" : "etapas";
    const r = item
      ? await chamarApi(naBase(`/${rota}/${item.id}`), { metodo: "PUT", corpo })
      : await chamarApi(naBase(`/${rota}`), { corpo });
    if (r.ok) { fechar(); salvo(edicao.tipo === "modelo" ? "Resposta pronta salva." : "Etapa salva."); }
    return r;
  }

  return (
    <div className="grid gap-8 lg:max-w-3xl">
      {parte === "etapas" ? (
      <section aria-labelledby="t-etapas" className="grid content-start gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-etapas" className="text-lg font-medium">Etapas dos pedidos</h2>
          {tecnica.pode ? <Botao variante="contorno" tamanho="m" onClick={() => setEdicao({ tipo: "etapa", item: null })}><Icone nome="mais" />Nova etapa</Botao> : null}
        </div>
        {tecnica.pode ? null : (
          <FaixaTriade porque="As etapas mexem no prazo e no histórico" parte="ETAPAS_PEDIDOS"
            valor={etapasAtivas(config.etapas)} />
        )}
        {(Object.keys(SITUACOES_ETAPA) as (keyof typeof SITUACOES_ETAPA)[]).map((sit) => (
          <div key={sit} className="grid gap-1">
            <h3 className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">{SITUACOES_ETAPA[sit]}</h3>
            <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
              {config.etapas.filter((e) => e.situacao === sit).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={e.ativa ? "font-medium" : "text-tinta-suave"}>{e.nome}</span>
                    {e.pausaPrazo ? <Selo tom="atencao">pausa o prazo</Selo> : null}
                    {e.categoriaId ? <Selo tom="info">{nomeCategoria(e.categoriaId) ?? "Categoria"}</Selo> : null}
                    {e.ativa ? null : <Selo tom="neutro">Desativada</Selo>}
                  </span>
                  {tecnica.pode ? <Botao variante="discreto" onClick={() => setEdicao({ tipo: "etapa", item: e })} aria-label={`Editar a etapa ${e.nome}`}>Editar</Botao> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-sm text-tinta-suave">Sempre sobra ao menos uma etapa geral de aberto e uma de encerrado.</p>
      </section>
      ) : (
      <section aria-labelledby="t-modelos" className="grid content-start gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="t-modelos" className="text-lg font-medium">Respostas prontas</h2>
          {pode ? <Botao variante="contorno" tamanho="m" onClick={() => setEdicao({ tipo: "modelo", item: null })}><Icone nome="mais" />Nova resposta</Botao> : null}
        </div>
        <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
          {config.modelos.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="grid gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={m.ativo ? "font-medium" : "text-tinta-suave"}>{m.titulo}</span>
                  {m.categoriaId ? <Selo tom="info">{nomeCategoria(m.categoriaId) ?? "Categoria"}</Selo> : null}
                  {m.ativo ? null : <Selo tom="neutro">Desativado</Selo>}
                </span>
                <span className="whitespace-pre-line text-tinta-suave">{m.texto}</span>
              </span>
              {pode ? <Botao variante="discreto" onClick={() => setEdicao({ tipo: "modelo", item: m })} aria-label={`Editar a resposta ${m.titulo}`}>Editar</Botao> : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-tinta-suave">As respostas prontas aparecem na hora de dar retorno a um pedido.</p>
      </section>
      )}
      <Janela
        aberto={edicao !== null}
        titulo={edicao?.tipo === "modelo" ? (edicao.item ? `Editar a resposta ${edicao.item.titulo}` : "Nova resposta pronta") : edicao?.item ? `Editar a etapa ${edicao.item.nome}` : "Nova etapa"}
        textoBotao="Salvar"
        campos={campos()}
        iniciais={iniciais()}
        aoFechar={fechar}
        aoSalvar={salvar}
        recarregar={recarregar}
      />
    </div>
  );
}
