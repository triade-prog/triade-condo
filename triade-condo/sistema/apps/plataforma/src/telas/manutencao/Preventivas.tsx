"use client";
// Preventivas (DC15, telas-modelo manutencao-preventivas-*; MP-03, MP-13, AG-09): o que se
// repete, com a frequência, a próxima data e quem executa, em tabela no computador e em cartões
// com uma frase no celular. Perto da data, a preventiva abre uma manutenção sozinha, e a linha
// leva a ela. As sugestões seguem a NBR 5674 e só entram se o síndico escolher; com alguma
// preventiva já cadastrada, ficam recolhidas (decisão C.1 de 22/10/2026).

import Link from "next/link";
import { useState } from "react";
import { descreverFrequencia, mostrarDataCurta, SUGESTOES_PREVENTIVAS, UNIDADES_TEMPO, type UnidadeTempo } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo, Vazio } from "@triade/ui";
import { Cartao } from "../Ficha.tsx";
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
  const [verSugestoes, setVerSugestoes] = useState(false);

  if (lista.estado === "carregando") return <div className="grid gap-5"><PartesManutencao /><Carregando rotulo="Carregando as preventivas…" /></div>;
  if (lista.estado === "erro") {
    return <div className="grid gap-5"><PartesManutencao /><h1 className="t-titulo-tela">Preventivas</h1><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /></div>;
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

  const nova = pode.editar ? <Botao disabled={!o} onClick={() => setEdicao({ item: null })}><Icone nome="mais" />Nova preventiva</Botao> : null;
  const lista_ = sugestoes.length ? (
    <ul className="grid">
      {sugestoes.map((s) => (
        <li key={s.atividade} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha py-3 first:border-t-0">
          <span className="grid gap-0.5"><span>{s.atividade}</span><span className="t-apoio">{descreverFrequencia(s.unidadeTempo, s.intervalo)} · {s.nota}</span></span>
          <Botao variante="contorno" tamanho="p" disabled={!o} onClick={() => setEdicao({ item: null, sugestao: s })} aria-label={`Usar a sugestão ${s.atividade}`}><Icone nome="mais" />Usar</Botao>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className="grid gap-5 max-md:pb-16">
      <PartesManutencao />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Preventivas</h1>
          <p className="t-apoio mt-1">O que se repete para o prédio não parar. Cada uma vira manutenção perto da data e aparece na Agenda.</p>
        </div>
        {nova ? <div className="max-md:hidden">{nova}</div> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      {itens.length === 0 ? (
        <Vazio titulo="Nenhuma preventiva ainda" icone="calendario">Comece por uma sugestão abaixo ou cadastre o que já é feito no prédio.</Vazio>
      ) : (
        <section aria-labelledby="t-prev" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
          <h2 id="t-prev" className="sr-only">Preventivas do condomínio</h2>
          <div aria-hidden="true" className="hidden grid-cols-[36px_minmax(0,1.6fr)_9rem_8rem_minmax(0,1fr)_12rem] gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid">
            <span /><span className="t-rotulo">Atividade</span><span className="t-rotulo">Repete</span><span className="t-rotulo">Próxima</span><span className="t-rotulo">Quem executa</span><span className="t-rotulo">Situação</span>
          </div>
          <ul className="grid max-md:gap-3">
            {itens.map((p) => {
              const atrasada = p.aberta?.atrasada;
              const data = p.aberta?.dataPrevista ?? p.proximaData;
              const proxima = `${mostrarDataCurta(data).slice(0, 5)}${p.proximaData < hoje && !p.aberta ? " (passou)" : ""}`;
              const repete = descreverFrequencia(p.unidadeTempo, p.intervalo);
              const quem = nomeExecutor(p.executor);
              return (
                <li key={p.id} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-5 py-3.5 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[36px_minmax(0,1.6fr)_9rem_8rem_minmax(0,1fr)_12rem] md:border-t md:border-linha md:first:border-t-0">
                  <span className="ladrilho self-start md:self-center" aria-hidden="true"><Icone nome="calendario" /></span>
                  <span className="grid min-w-0 gap-0.5">
                    {pode.editar
                      ? <button type="button" className="w-fit text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => setEdicao({ item: p })}>{p.atividade}</button>
                      : <span className="font-medium">{p.atividade}</span>}
                    <span className="t-apoio">{p.local}{p.ultima ? ` · feita em ${mostrarDataCurta(p.ultima.realizadaEm)}` : ""}</span>
                    <span className="text-sm md:hidden">
                      Repete {repete} · próxima em <b className={`font-semibold ${atrasada ? "text-erro" : ""}`}>{proxima}</b> · {quem}
                    </span>
                  </span>
                  <span className="text-sm max-md:hidden">{repete}</span>
                  <span className={`t-codigo max-md:hidden ${atrasada ? "text-erro" : ""}`}>{proxima}</span>
                  <span className="text-sm max-md:hidden">{quem}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 max-md:col-start-2 max-md:pt-1 md:grid md:justify-items-start">
                    {!p.ativa ? <Selo tom="neutro">Parada</Selo>
                      : atrasada ? <Selo tom="erro">Atrasada</Selo>
                        : p.aberta ? <SeloManutencao estado={p.aberta.estado} />
                          : <Selo tom="neutro">Agendada</Selo>}
                    {p.aberta ? (
                      <Link href={`/manutencao/manutencao?id=${p.aberta.id}`} aria-label={`Abrir a manutenção de ${p.atividade}`}
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-violeta-600 hover:underline">Abrir a manutenção<Icone nome="dir" className="h-3.5 w-3.5" /></Link>
                    ) : p.ativa ? <span className="t-apoio">A manutenção abre {p.antecedenciaDias === 1 ? "1 dia" : `${p.antecedenciaDias} dias`} antes</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
            <span className="t-apoio">{itens.length === 1 ? "1 preventiva" : `${itens.length} preventivas`}</span>
            <span className="t-apoio">A próxima data conta da data prevista, não da data em que foi feita, para o calendário não escorregar.</span>
          </div>
        </section>
      )}

      {pode.editar && sugestoes.length ? (
        itens.length && !verSugestoes ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-dashed border-violeta-300 bg-violeta-50 px-5 py-3.5">
            <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="lista" /></span>
            <span className="grid min-w-0 flex-1">
              <span className="font-medium">{sugestoes.length === 1 ? "1 sugestão" : `${sugestoes.length} sugestões`} da ABNT NBR 5674</span>
              <span className="t-apoio">Atividades comuns em prédios. Nada entra sozinho: escolha e ajuste a frequência.</span>
            </span>
            <Botao variante="contorno" tamanho="m" aria-expanded={false} onClick={() => setVerSugestoes(true)}><Icone nome="baixo" />Ver sugestões</Botao>
          </div>
        ) : (
          <Cartao id="t-sug" titulo="Sugestões para começar" icone="lista"
            acao={itens.length ? <Botao variante="discreto" tamanho="m" aria-expanded onClick={() => setVerSugestoes(false)}>Esconder</Botao> : undefined}>
            <p className="t-apoio">Atividades comuns em prédios, na linha da ABNT NBR 5674. Nada entra sozinho: escolha as que valem aqui e ajuste a frequência.</p>
            {lista_}
          </Cartao>
        )
      ) : null}

      {nova ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{nova}</div> : null}

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
