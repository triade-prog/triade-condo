"use client";
// Preventivas (design "Telas da Manutenção", tela 5; MP-03, MP-13, AG-09): o que se repete,
// com a frequência, a próxima data e quem executa. Perto da data, a preventiva abre uma
// manutenção sozinha. As sugestões seguem a NBR 5674 e só entram se o síndico escolher.

import Link from "next/link";
import { useState } from "react";
import { descreverFrequencia, mostrarDataCurta, SUGESTOES_PREVENTIVAS, UNIDADES_TEMPO, type UnidadeTempo } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Selo, Vazio } from "@triade/ui";
import { Janela, type Valores } from "../Janela.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { ListaPreventivas, OpcoesManutencao, PreventivaItem, Recado } from "../tipos.ts";
import { executorParaApi, nomeExecutor, opcoesExecutor, PartesManutencao, SeloManutencao, valorExecutor } from "./comum.tsx";

type Edicao = { item: PreventivaItem | null; sugestao?: (typeof SUGESTOES_PREVENTIVAS)[number] } | null;

export function Preventivas() {
  const { atualizar } = usePlataforma();
  const lista = useCarregar<ListaPreventivas>("/v1/condominio/manutencao/preventivas");
  const opcoes = useCarregar<OpcoesManutencao>("/v1/condominio/manutencao/opcoes");
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [recado, setRecado] = useState<Recado>(null);

  if (lista.estado === "carregando") return <div className="grid gap-5"><PartesManutencao /><Carregando rotulo="Carregando as preventivas…" /></div>;
  if (lista.estado === "erro") {
    return <div className="grid gap-5"><PartesManutencao /><h1 className="text-[28px] font-normal tracking-tight">Preventivas</h1><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /></div>;
  }
  const { itens, hoje, pode } = lista.dados;
  const o = opcoes.estado === "pronto" ? opcoes.dados : null;
  const existentes = new Set(itens.map((p) => p.atividade.toLowerCase()));
  const sugestoes = SUGESTOES_PREVENTIVAS.filter((s) => !existentes.has(s.atividade.toLowerCase()));

  function iniciais(): Valores {
    const p = edicao?.item;
    const s = edicao?.sugestao;
    const exec = valorExecutor(p?.executor);
    const eu = o?.pessoas.find((x) => x.eu && x.veManutencao);
    return {
      atividade: p?.atividade ?? s?.atividade ?? "", local: p?.local ?? s?.local ?? "",
      unidadeTempo: p?.unidadeTempo ?? s?.unidadeTempo ?? "MES", intervalo: String(p?.intervalo ?? s?.intervalo ?? 1),
      proximaData: p?.proximaData ?? "", antecedenciaDias: String(p?.antecedenciaDias ?? 15),
      responsavelId: p?.responsavel.vinculoId ?? eu?.vinculoId ?? "", executor: exec.escolha, executorTexto: exec.texto,
      observacao: p?.observacao ?? "", ativa: p?.ativa ?? true,
    };
  }

  async function salvar(v: Valores) {
    const p = edicao?.item;
    const corpo = {
      atividade: v.atividade, local: v.local, unidadeTempo: v.unidadeTempo, intervalo: Number(v.intervalo) || 0,
      proximaData: v.proximaData, antecedenciaDias: Number(v.antecedenciaDias), responsavelId: v.responsavelId,
      ...executorParaApi(String(v.executor), String(v.executorTexto)), observacao: v.observacao || null, ativa: v.ativa === true,
      ...(p ? { versao: p.versao } : {}),
    };
    const r = p
      ? await chamarApi<{ abertas: number }>(`/v1/condominio/manutencao/preventivas/${p.id}`, { metodo: "PUT", corpo })
      : await chamarApi<{ abertas: number }>("/v1/condominio/manutencao/preventivas", { corpo });
    if (r.ok) {
      setEdicao(null);
      setRecado({ tom: "ok", texto: r.dados.abertas ? "Preventiva salva. A data já está perto: a manutenção foi aberta." : "Preventiva salva." });
      lista.recarregar();
      atualizar();
    }
    return r;
  }

  return (
    <div className="grid gap-5">
      <PartesManutencao />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Preventivas</h1>
          <p className="mt-1 text-tinta-suave">O que se repete para o prédio não parar. Cada uma vira manutenção perto da data.</p>
        </div>
        {pode.editar ? <Botao disabled={!o} onClick={() => setEdicao({ item: null })}>+ Nova preventiva</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      {itens.length === 0 ? (
        <Vazio titulo="Nenhuma preventiva ainda">Comece pelas sugestões abaixo ou cadastre o que já é feito no prédio.</Vazio>
      ) : (
        <section aria-labelledby="t-prev" className="overflow-hidden rounded-2xl border border-linha bg-superficie shadow-s1">
          <h2 id="t-prev" className="sr-only">Preventivas do condomínio</h2>
          <div aria-hidden="true" className="hidden border-b border-linha bg-violeta-50/60 px-4 py-2.5 text-[13px] font-medium text-tinta-suave md:grid md:grid-cols-[minmax(0,1.6fr)_8rem_7rem_minmax(0,1fr)_9rem] md:gap-4">
            <span>Atividade</span><span>Repete</span><span>Próxima</span><span>Quem executa</span><span />
          </div>
          <ul>
            {itens.map((p) => {
              const atrasada = p.aberta?.atrasada;
              return (
                <li key={p.id} className="grid gap-1.5 border-b border-linha px-4 py-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_8rem_7rem_minmax(0,1fr)_9rem] md:items-center md:gap-4">
                  <span className="grid min-w-0 gap-0.5">
                    {pode.editar
                      ? <button type="button" className="w-fit text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => setEdicao({ item: p })}>{p.atividade}</button>
                      : <span className="font-medium">{p.atividade}</span>}
                    <span className="text-[13px] text-tinta-suave">{p.local}{p.ultima ? ` · feita em ${mostrarDataCurta(p.ultima.realizadaEm)}` : ""}</span>
                  </span>
                  <span>{descreverFrequencia(p.unidadeTempo, p.intervalo)}</span>
                  <span className={atrasada ? "font-medium text-erro" : ""}>{mostrarDataCurta(p.aberta?.dataPrevista ?? p.proximaData).slice(0, 5)}{p.proximaData < hoje && !p.aberta ? " (passou)" : ""}</span>
                  <span>{nomeExecutor(p.executor)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    {!p.ativa ? <Selo tom="neutro">Parada</Selo>
                      : atrasada ? <Selo tom="erro">Atrasada</Selo>
                        : p.aberta ? <Link href={`/manutencao/manutencao?id=${p.aberta.id}`} className="inline-flex"><SeloManutencao estado={p.aberta.estado} /></Link>
                          : <Selo tom="neutro">Agendada</Selo>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p className="text-sm text-tinta-suave">A próxima data conta a partir da data prevista, não da data em que foi feita, para o calendário não escorregar. A data aparece na Agenda tracejada, como os feriados.</p>

      {pode.editar && sugestoes.length ? (
        <section aria-labelledby="t-sug" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
          <h2 id="t-sug" className="text-lg font-medium">Sugestões para começar</h2>
          <p className="text-sm text-tinta-suave">Atividades comuns em prédios, na linha da ABNT NBR 5674. Nada entra sozinho: escolha as que valem aqui e ajuste a frequência.</p>
          <ul className="grid gap-0 rounded-2xl border border-dashed border-violeta-300 bg-violeta-50 px-4">
            {sugestoes.map((s) => (
              <li key={s.atividade} className="flex flex-wrap items-center justify-between gap-2 border-b border-violeta-100 py-2.5 text-sm last:border-b-0">
                <span className="grid gap-0.5"><span>{s.atividade}</span><span className="text-xs text-tinta-suave">{descreverFrequencia(s.unidadeTempo, s.intervalo)} · {s.nota}</span></span>
                <Botao variante="contorno" tamanho="p" disabled={!o} onClick={() => setEdicao({ item: null, sugestao: s })} aria-label={`Usar a sugestão ${s.atividade}`}>Usar</Botao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {o && edicao ? (
        <Janela key={edicao.item?.id ?? edicao.sugestao?.atividade ?? "nova"} aberto titulo={edicao.item ? "Editar preventiva" : "Nova preventiva"}
          textoBotao="Salvar preventiva" aoFechar={() => setEdicao(null)} recarregar={lista.recarregar} iniciais={iniciais()}
          explicacao="A manutenção abre sozinha alguns dias antes da data. Com uma manutenção aberta para a data atual, a data só muda depois que ela terminar."
          campos={[
            { id: "atividade", rotulo: "Atividade", tipo: "texto", obrigatorio: true, max: 120, erro: "De 3 a 120 caracteres." },
            { id: "local", rotulo: "Local ou equipamento", tipo: "texto", obrigatorio: true, max: 120, erro: "Diga o local ou o equipamento." },
            { id: "unidadeTempo", rotulo: "Repete em", tipo: "selecao",
              opcoes: (Object.keys(UNIDADES_TEMPO) as UnidadeTempo[]).map((u) => ({ valor: u, texto: UNIDADES_TEMPO[u].varios })), erro: "Escolha." },
            { id: "intervalo", rotulo: "A cada quantos", tipo: "numero", obrigatorio: true, ajuda: "Até 52 semanas, 60 meses ou 10 anos.", erro: "A cada 1 a 52 semanas, 1 a 60 meses ou 1 a 10 anos." },
            { id: "proximaData", rotulo: "Próxima data", tipo: "data", obrigatorio: true, erro: "Entre hoje e dez anos à frente." },
            { id: "antecedenciaDias", rotulo: "Abrir a manutenção quantos dias antes", tipo: "numero", erro: "De 0 a 90 dias." },
            { id: "responsavelId", rotulo: "Responsável", tipo: "selecao", erro: "Escolha alguém que vê a manutenção.",
              opcoes: [{ valor: "", texto: "Escolha o responsável" }, ...o.pessoas.filter((p) => p.veManutencao).map((p) => ({ valor: p.vinculoId, texto: p.nome }))] },
            { id: "executor", rotulo: "Quem executa", tipo: "selecao", opcoes: opcoesExecutor(o, edicao.item?.executor), erro: "Escolha um só." },
            { id: "executorTexto", rotulo: "Nome de quem executa (se escolheu Outro)", tipo: "texto", max: 120 },
            { id: "observacao", rotulo: "Observação", tipo: "area", max: 1000 },
            ...(edicao.item ? [{ id: "ativa", rotulo: "Ativa", tipo: "caixa" as const, ajuda: "Parada, não abre manutenção nem aparece na agenda." }] : []),
          ]}
          aoSalvar={salvar} />
      ) : null}
    </div>
  );
}
