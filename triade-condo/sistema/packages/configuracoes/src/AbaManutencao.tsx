"use client";
// Etapas da manutenção (MP-02): ajustáveis por condomínio, sempre dentro de uma das situações
// fixas (planejada, em andamento, pendente, concluída). A situação da etapa não muda depois.
// Ajuste da TRÍADE (CF-09, PI-04): no app fica em leitura.

import { useState } from "react";
import { SITUACOES_MANUTENCAO } from "@triade/domain";
import { Botao, Carregando, chamarApi, ErroCarregar, Icone, Selo } from "@triade/ui";
import { Janela, type Campo, type Valores } from "./Janela.tsx";
import { useCarregar, naBase } from "./contexto.tsx";
import type { PropsAba } from "./Configuracoes.tsx";
import { campoMotivo, etapasAtivas, FaixaTriade } from "./tecnica.tsx";

interface Etapa { id: string; nome: string; situacao: "PLANEJADA" | "EM_ANDAMENTO" | "PENDENTE" | "CONCLUIDA"; ordem: number; ativa: boolean; versao: number }
const SITUACOES = ["PLANEJADA", "EM_ANDAMENTO", "PENDENTE", "CONCLUIDA"] as const;

export function AbaManutencao({ salvo, tecnica }: PropsAba) {
  const carga = useCarregar<{ etapas: Etapa[]; podeEditar: boolean }>(naBase("/etapas-manutencao"));
  const [edicao, setEdicao] = useState<{ item: Etapa | null } | null>(null);
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as etapas da manutenção…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const { etapas } = carga.dados;
  const nova = !edicao?.item;

  const campos: Campo[] = [
    { id: "nome", rotulo: "Nome da etapa", tipo: "texto", obrigatorio: true, max: 40, erro: "De 2 a 40 caracteres, sem repetir na mesma situação." },
    ...(nova ? [{ id: "situacao", rotulo: "Situação", tipo: "selecao", opcoes: SITUACOES.map((s) => ({ valor: s, texto: SITUACOES_MANUTENCAO[s] })),
      ajuda: "Não muda depois. Para outra situação, crie outra etapa.", erro: "Escolha a situação." } as Campo] : []),
    ...(nova ? [] : [{ id: "ativa", rotulo: "Ativa", tipo: "caixa", ajuda: "Desativada não aparece para escolher." } as Campo]),
    ...(tecnica.motivo ? [campoMotivo] : []),
  ];
  const iniciais: Valores = { nome: edicao?.item?.nome ?? "", situacao: edicao?.item?.situacao ?? "EM_ANDAMENTO", ativa: edicao?.item?.ativa ?? true, motivo: "" };

  return (
    <section aria-labelledby="t-etapas-man" className="grid content-start gap-3 lg:max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 id="t-etapas-man" className="text-lg font-medium">Etapas da manutenção</h2>
        {tecnica.pode ? <Botao variante="contorno" tamanho="m" onClick={() => setEdicao({ item: null })}><Icone nome="mais" />Nova etapa</Botao> : null}
      </div>
      {tecnica.pode ? null : (
        <FaixaTriade porque="As etapas organizam o acompanhamento da manutenção" parte="ETAPAS_MANUTENCAO"
          valor={etapasAtivas(etapas)} />
      )}
      <p className="text-sm text-tinta-suave">As situações são fixas. As etapas dizem onde a manutenção está dentro delas, como &ldquo;Aguardando visita&rdquo; ou &ldquo;Aguardando orçamento&rdquo;. Nenhuma é obrigatória.</p>
      {SITUACOES.map((sit) => {
        const daSituacao = etapas.filter((e) => e.situacao === sit);
        return (
          <div key={sit} className="grid gap-1">
            <h3 className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">{SITUACOES_MANUTENCAO[sit]}</h3>
            {daSituacao.length === 0 ? <p className="rounded-2xl border border-dashed border-linha px-4 py-2.5 text-sm text-tinta-suave">Sem etapas.</p> : (
              <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
                {daSituacao.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={e.ativa ? "font-medium" : "text-tinta-suave"}>{e.nome}</span>
                      {e.ativa ? null : <Selo tom="neutro">Desativada</Selo>}
                    </span>
                    {tecnica.pode ? <Botao variante="discreto" onClick={() => setEdicao({ item: e })} aria-label={`Editar a etapa ${e.nome}`}>Editar</Botao> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {edicao ? (
        <Janela aberto titulo={edicao.item ? "Editar etapa da manutenção" : "Nova etapa da manutenção"} textoBotao="Salvar etapa"
          campos={campos} iniciais={iniciais} aoFechar={() => setEdicao(null)} recarregar={carga.recarregar}
          aoSalvar={async (v) => {
            const e = edicao.item;
            const r = e
              ? await chamarApi(naBase(`/etapas-manutencao/${e.id}`), {
                metodo: "PUT", corpo: { versao: e.versao, nome: v.nome, ativa: v.ativa === true, motivo: v.motivo || undefined } })
              : await chamarApi(naBase("/etapas-manutencao"), { corpo: { nome: v.nome, situacao: v.situacao, motivo: v.motivo || undefined } });
            if (r.ok) { setEdicao(null); carga.recarregar(); salvo("Etapa da manutenção salva."); }
            return r;
          }} />
      ) : null}
    </section>
  );
}
