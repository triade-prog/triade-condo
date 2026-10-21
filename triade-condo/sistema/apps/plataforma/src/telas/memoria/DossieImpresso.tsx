"use client";
// O dossiê de passagem de bastão (design "Memória do prédio", tela 5; CT-02), como foi gerado,
// numa página limpa para imprimir ou salvar em PDF. Fica fora da moldura do painel.

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  ACORDOS_PRESTADOR, ASSUNTOS_COMUNICADO, ESTADOS_PEDIDO, FUNCOES_PLATAFORMA, mostrarDataCurta, SITUACOES_MANUTENCAO, SITUACOES_PRONTUARIO,
  TIPOS_ANOTACAO, TIPOS_DOCUMENTO, UNIDADES_TEMPO,
} from "@triade/domain";
import { Botao, Carregando, ErroCarregar, Logo } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Dossie } from "../tipos.ts";

const rotulo = <T extends Record<string, string>>(o: T, k: string) => o[k as keyof T] ?? k;

function Parte({ n, titulo, children, vazio }: { n?: number; titulo: string; children: ReactNode; vazio?: string | false }) {
  return (
    <section className="grid gap-1.5 break-inside-avoid-page">
      <h2 className="mt-2 text-sm font-semibold tracking-wide text-violeta-700 uppercase">{n ? `${n} · ` : ""}{titulo}</h2>
      {vazio ? <p className="text-sm text-tinta-suave">{vazio}</p> : children}
    </section>
  );
}

export function DossieImpresso() {
  const id = useSearchParams().get("id");
  const carga = useCarregar<Dossie>(id ? `/v1/condominio/memoria/dossies/${id}` : null);
  if (!id) return <main className="mx-auto max-w-3xl p-8"><ErroCarregar texto="Falta dizer qual dossiê abrir." /></main>;
  if (carga.estado === "carregando") return <main className="mx-auto max-w-3xl p-8"><Carregando rotulo="Abrindo o dossiê…" /></main>;
  if (carga.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></main>;
  const { conteudo: c, geradoEm } = carga.dados;
  const p = c.pendencias;
  const li = "ml-5 list-disc text-sm";

  return (
    <main className="mx-auto grid max-w-[21cm] gap-4 bg-superficie p-8 print:max-w-none print:p-0">
      <div className="flex justify-end print:hidden"><Botao onClick={() => window.print()}>Imprimir ou salvar em PDF</Botao></div>
      <header className="flex items-start justify-between gap-4 border-b border-linha pb-3">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight">Dossiê de passagem de bastão</h1>
          <p className="text-sm text-tinta-suave">{c.condominio.nome} · gerado em {diaHora(geradoEm)}{c.geradoPor ? `, por ${c.geradoPor}` : ""}</p>
        </div>
        <Logo className="h-9 w-auto" />
      </header>

      <Parte n={1} titulo="Pendências abertas">
        <ul className="grid gap-1">
          <li className={li}>{p.pedidosAbertos === 1 ? "1 pedido aberto" : `${p.pedidosAbertos} pedidos abertos`}{p.pedidos.filter((x) => x.retornoVencido).length ? `, ${p.pedidos.filter((x) => x.retornoVencido).length} com retorno vencido` : ""}</li>
          {p.pedidos.map((x) => (
            <li key={x.protocolo} className={`${li} ml-10`}>
              {x.protocolo} · {x.assunto}{x.unidade ? ` · ${x.unidade}` : ""} · {rotulo(ESTADOS_PEDIDO, x.estado)}
              {x.proximoRetorno ? ` · retorno ${x.retornoVencido ? "vencido em" : "em"} ${diaHora(x.proximoRetorno)}` : ""}{x.responsavel ? ` · ${x.responsavel}` : ""}
            </li>
          ))}
          <li className={li}>{p.manutencoes.length === 1 ? "1 manutenção aberta" : `${p.manutencoes.length} manutenções abertas`}</li>
          {p.manutencoes.map((m, i) => (
            <li key={i} className={`${li} ml-10`}>
              {m.titulo} · {m.local} · {rotulo(SITUACOES_MANUTENCAO, m.estado)}{m.pendencia ? ` (${m.pendencia})` : ""}{m.previsao ? ` · previsão ${mostrarDataCurta(m.previsao)}` : ""}
            </li>
          ))}
          {p.prontuario.length ? (
            <li className={li}>Prontuário: {p.prontuario.map((x) => `${x.item} (${rotulo(SITUACOES_PRONTUARIO, x.situacao).toLowerCase()}${x.valeAte ? ` em ${mostrarDataCurta(x.valeAte)}` : ""})`).join("; ")}</li>
          ) : <li className={li}>Prontuário: nada vencido nem faltando.</li>}
        </ul>
      </Parte>

      <Parte n={2} titulo="Prestadores e contratos" vazio={!c.prestadores.length && "Nenhum prestador cadastrado."}>
        <ul className="grid gap-1">
          {c.prestadores.map((x, i) => (
            <li key={i} className={li}>
              {x.prestador} · {x.servico} · {rotulo(ACORDOS_PRESTADOR, x.acordo).toLowerCase()}{x.contratoAte ? ` até ${mostrarDataCurta(x.contratoAte)}` : ""}
              {x.contato || x.telefone ? ` · ${[x.contato, x.telefone].filter(Boolean).join(", ")}` : ""}
            </li>
          ))}
        </ul>
      </Parte>

      <Parte n={3} titulo="Documentos do prédio" vazio={!c.documentos.length && "Nenhum documento guardado."}>
        <ul className="grid gap-1">
          {c.documentos.map((d, i) => (
            <li key={i} className={li}>
              {rotulo(TIPOS_DOCUMENTO, d.tipo)}: {d.titulo}{d.emVigor ? ` · versão ${d.emVigor} em vigor` : " · sem arquivo em vigor"}
              {d.valeAte ? ` · vale até ${mostrarDataCurta(d.valeAte)}` : ""}{d.restrito ? " · restrito" : ""}
            </li>
          ))}
        </ul>
      </Parte>

      <Parte n={4} titulo="Programa de manutenção" vazio={!c.preventivas.length && "Nenhuma preventiva ativa."}>
        <ul className="grid gap-1">
          {c.preventivas.map((x, i) => {
            const u = UNIDADES_TEMPO[x.unidadeTempo as keyof typeof UNIDADES_TEMPO];
            return <li key={i} className={li}>{x.atividade} · {x.local} · a cada {x.intervalo} {x.intervalo === 1 ? u?.um : u?.varios} · próxima em {mostrarDataCurta(x.proxima)}</li>;
          })}
        </ul>
      </Parte>

      <Parte n={5} titulo="Combinados e decisões" vazio={!c.anotacoes.length && "Nada anotado na memória."}>
        <ul className="grid gap-1">
          {c.anotacoes.map((a, i) => (
            <li key={i} className={li}><strong className="font-medium">{rotulo(TIPOS_ANOTACAO, a.tipo)}: {a.titulo}</strong> ({mostrarDataCurta(a.aconteceuEm)}). {a.texto}</li>
          ))}
        </ul>
      </Parte>

      <Parte n={6} titulo="Agenda dos próximos 60 dias" vazio={!c.agenda.length && "Nada marcado."}>
        <ul className="grid gap-1">
          {c.agenda.map((a, i) => <li key={i} className={li}>{mostrarDataCurta(a.data)}{a.hora ? `, ${a.hora}` : ""} · {a.titulo}{a.local ? ` · ${a.local}` : ""}</li>)}
        </ul>
      </Parte>

      <Parte n={7} titulo="Comunicados recentes" vazio={!c.comunicados.length && "Nenhum comunicado publicado."}>
        <ul className="grid gap-1">
          {c.comunicados.map((x, i) => <li key={i} className={li}>{diaHora(x.publicadoEm)} · {rotulo(ASSUNTOS_COMUNICADO, x.assunto)}: {x.titulo}</li>)}
        </ul>
      </Parte>

      <Parte n={8} titulo="Quem tem acesso hoje">
        <ul className="grid gap-1">
          {c.acesso.map((x, i) => (
            <li key={i} className={li}>
              {x.pessoa} · {rotulo(FUNCOES_PLATAFORMA, x.funcao)}{x.cargo ? ` (${x.cargo})` : ""}{x.permissoes?.length ? `: ${x.permissoes.join(", ")}` : ""} · desde {diaHora(x.desde).slice(0, 10)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-tinta-suave">Confira com o novo síndico quem continua. Encerrar acessos é feito em Pessoas e acesso.</p>
      </Parte>

      <Parte n={9} titulo="Manual do prédio" vazio={!c.manual.length && "Nenhuma seção escrita."}>
        <div className="grid gap-3">
          {c.manual.map((s, i) => (
            <article key={i} className="grid gap-1 break-inside-avoid">
              <h3 className="font-medium">{s.titulo}{s.noMural ? "" : " (só a gestão)"}</h3>
              <p className="text-sm whitespace-pre-line">{s.texto}</p>
            </article>
          ))}
        </div>
      </Parte>

      <Parte titulo="Para entregar fora do sistema">
        <ul className="grid gap-1">
          <li className={li}>Chaves, controles e cartões de acesso.</li>
          <li className={li}>Senhas de serviços de fora (banco, concessionárias, e-mail do condomínio): trocar na passagem. Este dossiê nunca traz senha.</li>
        </ul>
      </Parte>
    </main>
  );
}
