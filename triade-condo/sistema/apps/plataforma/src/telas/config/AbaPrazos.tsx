"use client";
// Prazos de retorno (AT-10): uma regra geral e exceções por categoria, por prioridade ou
// pelas duas. Vale a mais específica, e a prioridade vem antes da categoria. Conta em horas
// de atendimento e para fora do horário, nos feriados e nas etapas que pausam. Em cima, as
// regras de aviso (passo 6).

import { useState } from "react";
import { AvisoErro, Aviso, Botao, chamarApi, textoDoErro, type ErroApi } from "@triade/ui";
import { Janela, type Valores } from "../Janela.tsx";
import type { Configuracoes } from "../tipos.ts";
import type { PropsAba } from "./Configuracoes.tsx";
import { RegrasAviso } from "./RegrasAviso.tsx";

type Prazo = Configuracoes["prazos"][number];

function horas(n: number): string {
  return `${n} h de atendimento`;
}

export function AbaPrazos(props: PropsAba) {
  return (
    <div className="grid gap-6">
      <RegrasAviso {...props} />
      <section aria-labelledby="t-prazos" className="grid gap-3">
        <h2 id="t-prazos" className="font-semibold">Prazos de retorno</h2>
        <TabelaPrazos {...props} />
      </section>
    </div>
  );
}

function TabelaPrazos({ config, pode, recarregar, salvo }: PropsAba) {
  const [mudando, setMudando] = useState<Prazo | null>(null);
  const [nova, setNova] = useState(false);
  const [falha, setFalha] = useState<ErroApi | null>(null);
  const cat = (id: string | null) => config.categorias.find((c) => c.id === id)?.nome ?? "categoria";
  const pri = (id: string | null) => config.prioridades.find((p) => p.id === id)?.nome ?? "prioridade";
  const valePara = (p: Prazo) =>
    !p.categoriaId && !p.prioridadeId ? "Regra geral"
      : p.categoriaId && p.prioridadeId ? `Categoria ${cat(p.categoriaId)} com prioridade ${pri(p.prioridadeId)}`
        : p.prioridadeId ? `Prioridade ${pri(p.prioridadeId)}` : `Categoria ${cat(p.categoriaId)}`;
  const semHorario = config.pendencias.includes("SEM_HORARIO_ATENDIMENTO");

  async function tirar(p: Prazo) {
    const r = await chamarApi(`/v1/condominio/prazos/${p.id}/remover`, { corpo: { versao: p.versao } });
    if (!r.ok) return setFalha(r.erro);
    salvo(`Exceção retirada: ${valePara(p)}.`);
  }

  function horasValidas(v: Valores): number | null {
    const n = Number(String(v.horas).trim());
    return Number.isInteger(n) && n >= 1 && n <= 720 ? n : null;
  }

  return (
    <div className="grid gap-4">
      {semHorario ? <Aviso tom="atencao">Sem horário de atendimento definido, os prazos contam em horas corridas. Defina o horário na aba Horários.</Aviso> : null}
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} recarregar={recarregar} /> : null}
      <div className="overflow-x-auto rounded-lg border border-linha">
        <table className="w-full text-sm">
          <caption className="sr-only">Prazos de retorno</caption>
          <thead className="bg-superficie-2 text-left text-tinta-suave">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Vale para</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Prazo de retorno</th>
              {pode ? <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {config.prazos.map((p) => {
              const geral = !p.categoriaId && !p.prioridadeId;
              return (
                <tr key={p.id} className="border-t border-linha">
                  <td className="px-4 py-2.5">
                    <span className={geral ? "font-semibold" : ""}>{valePara(p)}</span>
                    {geral ? <span className="block text-xs text-tinta-suave">Todos os pedidos sem exceção</span> : null}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{horas(p.horas)}</td>
                  {pode ? (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Botao variante="discreto" onClick={() => { setFalha(null); setMudando(p); }} aria-label={`Mudar o prazo de ${valePara(p)}`}>Mudar</Botao>
                      {geral ? null : <Botao variante="discreto" onClick={() => void tirar(p)} aria-label={`Tirar a exceção de ${valePara(p)}`}>Tirar</Botao>}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pode ? <Botao variante="secundario" className="justify-self-start" onClick={() => setNova(true)}>+ Exceção</Botao> : null}
      <Aviso tom="info">
        Exemplo: pedido aberto quinta às 17h com prazo de 4 h, atendimento de segunda a sexta até as 18h. Conta 1 h na quinta; se sexta for feriado, o retorno vence segunda às 11h.
      </Aviso>

      <Janela
        aberto={mudando !== null}
        titulo={mudando ? `Prazo de ${valePara(mudando)}` : "Prazo"}
        textoBotao="Salvar prazo"
        campos={[{ id: "horas", rotulo: "Horas de atendimento", tipo: "numero", obrigatorio: true, erro: "De 1 a 720 horas.", ajuda: "De 1 a 720." }]}
        iniciais={{ horas: String(mudando?.horas ?? "") }}
        aoFechar={() => setMudando(null)}
        recarregar={recarregar}
        aoSalvar={async (v) => {
          const n = horasValidas(v);
          if (n === null || !mudando) return { ok: false, status: 400, erro: { codigo: "VALIDATION_ERROR", detalhes: { campos: ["horas"] } } };
          const r = await chamarApi(`/v1/condominio/prazos/${mudando.id}`, { metodo: "PUT", corpo: { versao: mudando.versao, horas: n } });
          if (r.ok) { setMudando(null); salvo("Prazo salvo."); }
          return r;
        }}
      />
      <Janela
        aberto={nova}
        titulo="Nova exceção de prazo"
        textoBotao="Criar exceção"
        explicacao="Escolha a categoria, a prioridade ou as duas. A prioridade vem antes da categoria quando as duas regras valem."
        campos={[
          { id: "categoriaId", rotulo: "Categoria", tipo: "selecao", opcoes: [{ valor: "", texto: "Qualquer categoria" }, ...config.categorias.filter((c) => c.ativa).map((c) => ({ valor: c.id, texto: c.nome }))] },
          { id: "prioridadeId", rotulo: "Prioridade", tipo: "selecao", opcoes: [{ valor: "", texto: "Qualquer prioridade" }, ...config.prioridades.filter((p) => p.ativa).map((p) => ({ valor: p.id, texto: p.nome }))] },
          { id: "horas", rotulo: "Horas de atendimento", tipo: "numero", obrigatorio: true, erro: "De 1 a 720 horas." },
        ]}
        iniciais={{ categoriaId: "", prioridadeId: "", horas: "" }}
        aoFechar={() => setNova(false)}
        aoSalvar={async (v) => {
          const n = horasValidas(v);
          if (n === null) return { ok: false, status: 400, erro: { codigo: "VALIDATION_ERROR", detalhes: { campos: ["horas"] } } };
          if (!v.categoriaId && !v.prioridadeId) return { ok: false, status: 400, erro: { codigo: "VALIDATION_ERROR", detalhes: { motivo: "PRAZO_REPETIDO" } } };
          const r = await chamarApi("/v1/condominio/prazos", { corpo: { categoriaId: v.categoriaId || null, prioridadeId: v.prioridadeId || null, horas: n } });
          if (r.ok) { setNova(false); salvo("Exceção de prazo criada."); }
          return r;
        }}
      />
    </div>
  );
}
