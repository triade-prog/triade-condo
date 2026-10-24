"use client";
// Indicadores do atendimento (passo 7; F7.2, TR-01, TR-03, TR-07), no padrão novo (DC15, quadros 59 a 61,
// decisões A.1 B.1 C.1 D.2 de 22/10/2026). A tela tem duas partes: Agora (o que está aberto hoje e não muda
// com o período) e No período (com o trilho do período só ali). A métrica principal, retornos no prazo,
// fica em destaque com a diferença para o período anterior. As duas tabelas por categoria viram uma só.
// Cada número leva à lista de onde veio, pelos filtros que a lista de Pedidos entende no endereço. A base
// de cálculo de cada parte fica atrás de um "Como se calcula". Sem nenhum caso no período, a tela diz
// "sem dados", nunca zero. Da F7.4 (TR-01): a reincidência no período, com onde o problema volta (AT-18),
// e as decisões aguardando o síndico (AT-23). Sem botão principal: é tela de ler.
// Relatório do mês (TR-02, TR-10; quadro 230, decisão A.1 de 23/10/2026): um botão de contorno leva
// aos relatórios e, enquanto o mês que fechou não tem relatório, um cartão chama para montar.

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  mostrarDuracao, mostrarHoras, mostrarPorcentagem, PERIODOS_INDICADORES, PERMISSOES, textoDoPeriodo, tituloDoMes, type PeriodoIndicadores,
} from "@triade/domain";
import { Carregando, classeBotao, ErroCarregar, Icone, Iniciais, SemPermissao, Selo, Trilho, type NomeIcone, type Tom } from "@triade/ui";
import { iconeDaCategoria } from "./pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { ListaRelatorios } from "./relatorios/comum.tsx";
import type { Indicadores as Dados } from "./tipos.ts";

const ANTERIOR: Record<PeriodoIndicadores, string> = {
  ESTE_MES: "Mês passado",
  MES_PASSADO: "O mês antes dele",
  TRES_MESES: "Os 3 meses antes",
};

const nada = (v: number | null | undefined) => v === null || v === undefined;
const dias = (n: number) => (n === 0 ? "hoje" : n === 1 ? "1 dia" : `${n} dias`);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const COMO_AGORA = "Agora, não no período: pedidos abertos ou em andamento, pelo responsável de hoje. Retorno vencido conta o próximo retorno que já passou. Mais antigo é a idade do pedido aberto há mais tempo. Decisões aguardando são pedidos de decisão sem resposta, com o prazo no fuso do condomínio.";
const COMO_PERIODO = "Um retorno está no prazo quando é registrado antes de o retorno combinado vencer. Retorno combinado que venceu sem notícia conta como fora do prazo. Nota interna não conta. Pedido privado entra na conta, sem aparecer. O primeiro retorno é a média de horas de atendimento entre o registro e o primeiro retorno, dos pedidos registrados no período.";
const COMO_CATEGORIA = "Pedidos concluídos no período, da abertura até a conclusão, em horas corridas. Tempo típico é a mediana: metade dos pedidos levou menos que isso. O pedido reaberto conta da primeira abertura até a última conclusão. Sem pedido concluído, a linha diz sem dados, nunca zero.";
const COMO_REINCIDENCIA = "Pedidos abertos no período e ligados como reincidência de um pedido concluído, sobre todos os pedidos abertos no período, no fuso do condomínio. Duplicado não conta. Sem pedido no período, \"sem dados\"; com pedidos e nenhuma reincidência, 0%. Reincidência é sinal para investigar, não causa confirmada.";
const COMO_DECISOES = "Decididas e tempo típico (mediana, do pedido até a resposta) usam o período escolhido; devolvida conta como decidida. Sem nenhuma decisão no período, \"sem dados\".";

/** "Como se calcula": botão discreto que abre a base de cálculo, sem mudar uma palavra (B.1). */
function useComo(texto: string, rotulo?: string) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const botao = (
    <button type="button" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(!aberto)}
      aria-label={rotulo ? `Como se calcula: ${rotulo}` : undefined}
      className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 t-apoio font-medium text-violeta-600 hover:bg-violeta-50 aria-expanded:bg-violeta-50">
      <Icone nome="info" className="h-4 w-4" />Como se calcula<Icone nome="baixo" className={`h-3.5 w-3.5 ${aberto ? "rotate-180" : ""}`} />
    </button>
  );
  const painel = <p id={id} hidden={!aberto} className="rounded-[14px] border border-violeta-200 bg-violeta-50 px-4 py-3 t-apoio text-tinta-suave">{texto}</p>;
  return { botao, painel };
}

/** Título de cartão no padrão: ladrilho com ícone e, à direita, uma ação. */
function TituloCartao({ id, titulo, icone, acao }: { id: string; titulo: string; icone: NomeIcone; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2.5">
        <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
        <h3 id={id} className="t-titulo-cartao">{titulo}</h3>
      </span>
      {acao}
    </div>
  );
}

/** Cartão com título. Com tabela, no computador a tabela encosta nas bordas e só o título tem margem. */
function Cartao({ id, titulo, icone, acao, tabela, className = "", children }: {
  id: string; titulo: string; icone: NomeIcone; acao?: ReactNode; tabela?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <section aria-labelledby={`t-${id}`} className={`grid content-start gap-3 overflow-hidden rounded-[18px] border border-linha bg-superficie shadow-s1 max-md:gap-1 max-md:p-4 ${tabela ? "md:pt-5" : "p-5"} ${className}`}>
      <div className={tabela ? "md:px-5" : ""}><TituloCartao id={`t-${id}`} titulo={titulo} icone={icone} acao={acao} /></div>
      {children}
    </section>
  );
}

/** Título de uma parte da tela (Agora, No período), com o que fica à direita. */
function Parte({ id, titulo, apoio, direita }: { id: string; titulo: string; apoio: string; direita?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-0.5">
        <h2 id={id} className="t-titulo-secao font-medium">{titulo}</h2>
        <p className="t-apoio">{apoio}</p>
      </div>
      {direita ? <div className="flex flex-wrap items-center gap-3">{direita}</div> : null}
    </div>
  );
}

/** Atalho de agora: o número grande abre a lista de onde veio. */
function Atalho({ href, icone, tom, n, titulo, apoio }: { href?: string; icone: NomeIcone; tom: Tom; n: number; titulo: string; apoio: string }) {
  const conteudo = (
    <>
      <span className="flex items-center justify-between max-md:hidden">
        <span className="ladrilho h-10 w-10 rounded-xl" data-tom={tom} aria-hidden="true"><Icone nome={icone} className="h-5 w-5" /></span>
        {href ? <Icone nome="dir" className="h-[18px] w-[18px] text-violeta-600" /> : null}
      </span>
      <span className="ladrilho h-10 w-10 rounded-xl md:hidden" data-tom={tom} aria-hidden="true"><Icone nome={icone} className="h-5 w-5" /></span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex items-baseline gap-2.5"><strong className="text-[32px] font-semibold leading-tight tracking-tight max-md:text-[22px]">{n}</strong><span className="font-medium">{titulo}</span></span>
        <span className="t-apoio">{apoio}</span>
      </span>
      {href ? <Icone nome="dir" className="h-[18px] w-[18px] text-tinta-suave md:hidden" /> : null}
    </>
  );
  const classe = "flex gap-3 md:flex-col md:rounded-[18px] md:border md:border-linha md:bg-superficie md:p-5 md:shadow-s1 max-md:items-center max-md:border-t max-md:border-linha max-md:py-3";
  return href
    ? <Link href={href} className={`${classe} text-tinta no-underline hover:md:border-violeta-300`}>{conteudo}</Link>
    : <div className={classe}>{conteudo}</div>;
}

/** Número pequeno do período, com ícone e rótulo. */
function Numero({ icone, titulo, n, apoio }: { icone: NomeIcone; titulo: string; n: string; apoio?: string }) {
  return (
    <div className="grid content-start gap-1.5 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <span className="flex items-center gap-2 t-apoio text-tinta-suave">
        <span className="ladrilho h-7 w-7 rounded-[9px]" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>{titulo}
      </span>
      <span className="flex flex-wrap items-baseline gap-1.5"><strong className="t-titulo-ficha font-semibold tracking-tight">{n}</strong>{apoio ? <span className="t-apoio">{apoio}</span> : null}</span>
    </div>
  );
}

const TH = "px-3 py-2.5 t-apoio font-semibold text-tinta-suave";
const TD = "px-3 py-3 border-t border-linha";
const ENTRA = "inline-flex items-center gap-2.5 font-medium text-tinta no-underline hover:text-violeta-700 hover:underline";

/** Diferença em pontos para o período anterior, com seta e cor, além da palavra. */
function Diferenca({ atual, anterior }: { atual: number | null; anterior: number | null }) {
  if (nada(atual) || nada(anterior)) return null;
  const d = atual! - anterior!;
  if (d === 0) return <Selo tom="neutro">igual ao anterior</Selo>;
  return (
    <Selo tom={d > 0 ? "ok" : "erro"}>
      <Icone nome="seta" className={`h-3.5 w-3.5 ${d > 0 ? "-rotate-90" : "rotate-90"}`} />
      {plural(Math.abs(d), "ponto", "pontos")}<span className="sr-only">{d > 0 ? " acima do anterior" : " abaixo do anterior"}</span>
    </Selo>
  );
}

function Agora({ d, podeDecidir }: { d: Dados; podeDecidir: boolean }) {
  const como = useComo(COMO_AGORA, "agora");
  const vencidos = d.pendencias.reduce((t, p) => t + p.retornoVencido, 0);
  const semResp = d.pendencias.find((p) => !p.responsavelId);
  const comVencido = d.pendencias.filter((p) => p.retornoVencido);
  const deQuem = comVencido.map((p) => `${p.retornoVencido} ${p.nome ? `de ${p.nome}` : "sem responsável"}`).join(" e ");
  const x = d.decisoes;
  const linkPessoa = (p: Dados["pendencias"][number]) => (p.responsavelId ? `/pedidos?responsavel=${p.responsavelId}` : "/pedidos?atencao=SEM_RESPONSAVEL");
  return (
    <section aria-labelledby="t-agora" className="grid gap-4">
      <Parte id="t-agora" titulo="Agora" apoio="Não muda com o período. É o que está aberto hoje." direita={como.botao} />
      {como.painel}
      <div className="grid gap-4 rounded-[18px] max-md:gap-0 max-md:border max-md:border-linha max-md:bg-superficie max-md:px-4 max-md:pb-1 max-md:shadow-s1 md:grid-cols-3">
        <Atalho href="/pedidos?atencao=RETORNO_VENCIDO" icone="relogio" tom={vencidos ? "erro" : "neutro"} n={vencidos}
          titulo={vencidos === 1 ? "retorno vencido" : "retornos vencidos"} apoio={vencidos ? `${deQuem}.` : "Nenhum retorno passou do prazo."} />
        <Atalho href="/pedidos?atencao=SEM_RESPONSAVEL" icone="pessoa-mais" tom={semResp ? "atencao" : "neutro"} n={semResp?.abertos ?? 0}
          titulo="sem responsável" apoio={semResp ? `O mais antigo está aberto há ${dias(semResp.maisAntigoDias)}.` : "Todo pedido aberto tem alguém cuidando."} />
        {x ? (
          <Atalho href={podeDecidir ? "/decisoes" : undefined} icone="decisao" tom={x.aguardando ? "andamento" : "neutro"} n={x.aguardando}
            titulo={x.aguardando === 1 ? "decisão aguardando" : "decisões aguardando"}
            apoio={x.aguardando ? `${plural(x.vencidas, "com prazo vencido", "com prazo vencido")}${nada(x.maisAntigaDias) ? "" : ` · a mais antiga espera há ${dias(x.maisAntigaDias!)}`}.` : "Nenhuma decisão esperando o síndico."} />
        ) : null}
      </div>
      <Cartao id="pendencias" titulo="Pendências por responsável" icone="pessoas" tabela>
        {d.pendencias.length ? (
          <>
            <table className="w-full t-texto max-md:hidden">
              <caption className="sr-only">Pendências por responsável, agora</caption>
              <thead className="text-left">
                <tr><th scope="col" className={`${TH} pl-5`}>Responsável</th><th scope="col" className={`${TH} text-right`}>Abertos</th>
                  <th scope="col" className={`${TH} text-right`}>Retorno vencido</th><th scope="col" className={`${TH} pr-5 text-right`}>Mais antigo</th></tr>
              </thead>
              <tbody>
                {d.pendencias.map((p) => (
                  <tr key={p.responsavelId ?? "sem"}>
                    <th scope="row" className={`${TD} pl-5 text-left font-normal`}>
                      <Link href={linkPessoa(p)} className={ENTRA}>
                        {p.nome ? <Iniciais nome={p.nome} /> : <span className="ladrilho h-8 w-8 rounded-full" data-tom="atencao" aria-hidden="true"><Icone nome="pessoa-mais" className="h-4 w-4" /></span>}
                        {p.nome ?? "Sem responsável"}
                      </Link>
                    </th>
                    <td className={`${TD} text-right`}>{p.abertos}</td>
                    <td className={`${TD} text-right`}>{p.retornoVencido ? <Selo tom="erro">{p.retornoVencido} vencido</Selo> : 0}</td>
                    <td className={`${TD} pr-5 text-right`}>{dias(p.maisAntigoDias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="md:hidden">
              {d.pendencias.map((p) => (
                <li key={p.responsavelId ?? "sem"} className="border-t border-linha">
                  <Link href={linkPessoa(p)} className="flex items-center gap-3 py-3 text-tinta no-underline">
                    {p.nome ? <Iniciais nome={p.nome} /> : <span className="ladrilho rounded-full" data-tom="atencao" aria-hidden="true"><Icone nome="pessoa-mais" /></span>}
                    <span className="grid flex-1">
                      <span className="font-medium">{p.nome ?? "Sem responsável"}</span>
                      <span className="t-apoio">{plural(p.abertos, "aberto", "abertos")}{p.retornoVencido ? <> · <span className="text-erro">{p.retornoVencido} vencido</span></> : null} · o mais antigo há {dias(p.maisAntigoDias)}</span>
                    </span>
                    <Icone nome="dir" className="h-[18px] w-[18px] text-tinta-suave" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="t-apoio border-t border-linha px-5 py-3 max-md:hidden">A linha abre Pedidos filtrado pela pessoa.</p>
          </>
        ) : <p className="t-apoio md:px-5 md:pb-5">Nenhum pedido aberto ou em andamento agora.</p>}
      </Cartao>
    </section>
  );
}

/** Uma linha por categoria, juntando retornos no prazo, concluídos e o tempo de solução (C.1). */
function linhasPorCategoria(d: Dados) {
  const linhas = d.atual.porCategoria.map((c) => ({ ...c, solucao: d.solucao.find((s) => s.categoriaId === c.categoriaId || s.nome === c.nome) }));
  for (const s of d.solucao) {
    if (!linhas.some((l) => l.solucao === s)) {
      linhas.push({ categoriaId: s.categoriaId, nome: s.nome, retornos: null, noPrazo: null, porcentagem: null, concluidos: s.concluidos, solucao: s });
    }
  }
  return linhas;
}

function PorCategoria({ d }: { d: Dados }) {
  const como = useComo(COMO_CATEGORIA, "por categoria");
  const linhas = linhasPorCategoria(d);
  const sd = <span className="text-tinta-suave">Sem dados</span>;
  const tipico = (s?: Dados["solucao"][number]) => (s && !nada(s.medianaHoras) ? mostrarDuracao(s.medianaHoras) : null);
  const demorado = (s?: Dados["solucao"][number]) => (s && !nada(s.maisDemoradoHoras) ? mostrarDuracao(s.maisDemoradoHoras) : null);
  const concluidos = (l: (typeof linhas)[number]) => l.solucao?.concluidos ?? l.concluidos;
  return (
    <Cartao id="categoria" titulo="Por categoria" icone="lista" acao={como.botao} tabela>
      <div className="md:px-5">{como.painel}</div>
      {linhas.length ? (
        <>
          <table className="w-full t-texto max-md:hidden">
            <caption className="sr-only">Por categoria, no período</caption>
            <thead className="text-left">
              <tr><th scope="col" className={`${TH} pl-5`}>Categoria</th><th scope="col" className={`${TH} text-right`}>Retornos no prazo</th>
                <th scope="col" className={`${TH} text-right`}>Concluídos</th><th scope="col" className={`${TH} text-right`}>Tempo típico</th>
                <th scope="col" className={`${TH} pr-5 text-right`}>Mais demorado</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.categoriaId}>
                  <th scope="row" className={`${TD} pl-5 text-left font-normal`}>
                    <Link href={`/pedidos?categoria=${l.categoriaId}`} className={ENTRA}>
                      <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={iconeDaCategoria(l.nome)} className="h-4 w-4" /></span>{l.nome}
                    </Link>
                  </th>
                  <td className={`${TD} text-right`}>{nada(l.porcentagem) ? sd : <>{mostrarPorcentagem(l.porcentagem)} <span className="text-tinta-suave">({l.noPrazo} de {l.retornos})</span></>}</td>
                  <td className={`${TD} text-right`}>{concluidos(l)}</td>
                  <td className={`${TD} text-right`}>{tipico(l.solucao) ?? sd}</td>
                  <td className={`${TD} pr-5 text-right`}>{demorado(l.solucao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="md:hidden">
            {linhas.map((l) => (
              <li key={l.categoriaId} className="border-t border-linha">
                <Link href={`/pedidos?categoria=${l.categoriaId}`} className="flex items-center gap-3 py-3 text-tinta no-underline">
                  <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome={iconeDaCategoria(l.nome)} /></span>
                  <span className="grid flex-1">
                    <span className="font-medium">{l.nome}</span>
                    <span className="t-apoio">{nada(l.porcentagem) ? "retornos: sem dados" : `${mostrarPorcentagem(l.porcentagem)} no prazo (${l.noPrazo} de ${l.retornos})`} · {plural(concluidos(l), "concluído", "concluídos")}</span>
                    <span className="t-apoio">{tipico(l.solucao) ? `tempo típico ${tipico(l.solucao)} · o mais demorado ${demorado(l.solucao)}` : "tempo de solução: sem dados"}</span>
                  </span>
                  <Icone nome="dir" className="h-[18px] w-[18px] text-tinta-suave" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="t-apoio border-t border-linha px-5 py-3 max-md:hidden">A linha abre Pedidos da categoria. Tempo típico é a mediana; o mais demorado, o pedido que levou mais tempo.</p>
        </>
      ) : <p className="t-apoio md:px-5 md:pb-5">Nenhuma categoria ativa.</p>}
    </Cartao>
  );
}

/** Onde o problema volta (AT-18): o pedido mais recente abre pela busca de Pedidos. */
function OndeVolta({ r }: { r: NonNullable<Dados["reincidencia"]> }) {
  const como = useComo(COMO_REINCIDENCIA, "reincidência");
  const pedido = (p: string) => <Link href={`/pedidos?busca=${encodeURIComponent(p)}`} className="t-codigo text-violeta-600" aria-label={`Pedido ${p}`}>{p}</Link>;
  return (
    <Cartao id="reincidencia" titulo="Onde o problema volta" icone="trocar" acao={como.botao} tabela>
      <div className="md:px-5">{como.painel}</div>
      {r.ondeVolta.length ? (
        <>
          <table className="w-full t-texto max-md:hidden">
            <caption className="sr-only">Onde o problema volta, no período</caption>
            <thead className="text-left">
              <tr><th scope="col" className={`${TH} pl-5`}>Onde volta</th><th scope="col" className={TH}>Categoria</th>
                <th scope="col" className={`${TH} text-right`}>Vezes</th><th scope="col" className={`${TH} pr-5 text-right`}>Pedido mais recente</th></tr>
            </thead>
            <tbody>
              {r.ondeVolta.map((o, i) => (
                <tr key={i}>
                  <th scope="row" className={`${TD} pl-5 text-left font-medium`}>{o.onde ?? "Sem local"}</th>
                  <td className={TD}><span className="inline-flex items-center gap-2"><span className="ladrilho h-7 w-7 rounded-[9px]" data-tom="atencao" aria-hidden="true"><Icone nome={iconeDaCategoria(o.categoria)} className="h-3.5 w-3.5" /></span>{o.categoria}</span></td>
                  <td className={`${TD} text-right`}>{plural(o.vezes, "vez", "vezes")}</td>
                  <td className={`${TD} pr-5 text-right`}>{pedido(o.ultima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="md:hidden">
            {r.ondeVolta.map((o, i) => (
              <li key={i} className="flex items-center gap-3 border-t border-linha py-3">
                <span className="ladrilho" data-tom="atencao" aria-hidden="true"><Icone nome={iconeDaCategoria(o.categoria)} /></span>
                <span className="grid flex-1">
                  <span className="font-medium">{o.onde ?? "Sem local"}</span>
                  <span className="t-apoio">{o.categoria} · voltou {plural(o.vezes, "vez", "vezes")}</span>
                  <span className="t-apoio">Pedido mais recente: {pedido(o.ultima)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="t-apoio md:px-5 md:pb-5">Nenhum problema voltou no período.</p>}
    </Cartao>
  );
}

function DecisoesPeriodo({ x, podeDecidir }: { x: NonNullable<Dados["decisoes"]>; podeDecidir: boolean }) {
  const como = useComo(COMO_DECISOES, "decisões");
  const linha = (n: ReactNode, texto: string, apoio: string) => (
    <li className="grid gap-0.5 border-t border-linha py-3">
      <span className="flex items-baseline gap-2"><strong className="t-titulo-ficha font-semibold tracking-tight">{n}</strong><span>{texto}</span></span>
      <span className="t-apoio text-tinta-suave">{apoio}</span>
    </li>
  );
  const ver = podeDecidir ? (
    <Link href="/decisoes" className="inline-flex shrink-0 items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">Abrir Decisões<Icone nome="dir" className="h-4 w-4" /></Link>
  ) : undefined;
  return (
    <Cartao id="decisoes" titulo="Decisões no período" icone="decisao" acao={ver} className="md:gap-1">
      <ul className="mt-2">
        {linha(x.decididas, x.decididas === 1 ? "decidida" : "decididas", "no período, contando as devolvidas")}
        {linha(x.aprovadas, x.aprovadas === 1 ? "aprovada" : "aprovadas", `e ${plural(x.devolvidas, "devolvida", "devolvidas")} para o responsável`)}
        {linha(x.decididas ? mostrarDuracao(x.medianaHoras) : "Sem dados", "tempo típico", "do pedido de decisão até a resposta")}
      </ul>
      <div>{como.botao}</div>
      {como.painel}
    </Cartao>
  );
}

function NoPeriodo({ d, periodo, trocar, podeDecidir }: { d: Dados; periodo: PeriodoIndicadores; trocar: (p: PeriodoIndicadores) => void; podeDecidir: boolean }) {
  const como = useComo(COMO_PERIODO, "no período");
  const a = d.atual;
  const r = a.retornos;
  const reinc = d.reincidencia;
  const trilho = (
    <Trilho rotulo="Período">
      {(Object.entries(PERIODOS_INDICADORES) as [PeriodoIndicadores, string][]).map(([valor, texto]) => (
        <button key={valor} type="button" className="chip" aria-pressed={valor === periodo} onClick={() => trocar(valor)}>
          {valor === "TRES_MESES" ? <span><span className="max-sm:hidden">Últimos </span>3 meses</span> : texto}
        </button>
      ))}
    </Trilho>
  );
  return (
    <section aria-labelledby="t-periodo" className="grid gap-4 border-t border-linha pt-6">
      <Parte id="t-periodo" titulo="No período" apoio={textoDoPeriodo(a.de, a.ate)} direita={<>{trilho}{como.botao}</>} />
      {como.painel}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)]">
        <section aria-labelledby="t-prazo" className="grid content-start gap-2.5 rounded-[18px] border border-linha bg-superficie bg-[linear-gradient(160deg,var(--color-superficie)_40%,var(--color-violeta-50))] p-6 shadow-s1 max-md:p-4">
          <TituloCartao id="t-prazo" titulo="Retornos no prazo" icone="relogio" />
          <span className="mt-1 flex flex-wrap items-baseline gap-3">
            <strong className={`font-semibold leading-none tracking-tight ${nada(r.porcentagem) ? "text-[40px]" : "text-[56px] max-md:text-[44px]"}`}>{mostrarPorcentagem(r.porcentagem)}</strong>
            <Diferenca atual={r.porcentagem} anterior={d.porcentagemAnterior} />
          </span>
          <p>{nada(r.porcentagem) ? "Nenhum retorno combinado no período." : `${r.noPrazo} de ${r.total} retornos dados até o prazo combinado.`}</p>
          <p className="t-apoio">{ANTERIOR[periodo]}: {mostrarPorcentagem(d.porcentagemAnterior)}. É a métrica principal do atendimento.</p>
        </section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Numero icone="pedido" titulo="Registrados" n={String(a.registrados)} apoio={a.registrados === 1 ? "pedido no período" : "pedidos no período"} />
          <Numero icone="check" titulo="Concluídos" n={String(a.concluidos)} apoio={a.concluidos === 1 ? "pedido" : "pedidos"} />
          <Numero icone="retorno" titulo="Reabertos" n={String(a.reabertos)} apoio={a.reabertos === 1 ? "pedido" : "pedidos"} />
          <Numero icone="relogio" titulo="Primeiro retorno, em média" n={mostrarHoras(a.primeiroRetornoHoras)} apoio={nada(a.primeiroRetornoHoras) ? undefined : "de atendimento"} />
          {reinc ? (
            <div className="max-md:col-span-2">
              <Numero icone="trocar" titulo="Reincidência" n={mostrarPorcentagem(reinc.porcentagem)}
                apoio={nada(reinc.porcentagem) ? undefined : `${reinc.reincidencias} de ${plural(reinc.pedidos, "pedido", "pedidos")}`} />
            </div>
          ) : null}
        </div>
      </div>
      <PorCategoria d={d} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {reinc ? <OndeVolta r={reinc} /> : null}
        {d.decisoes ? <DecisoesPeriodo x={d.decisoes} podeDecidir={podeDecidir} /> : null}
      </div>
    </section>
  );
}

export function Indicadores() {
  const { pode } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const periodo = (Object.keys(PERIODOS_INDICADORES) as PeriodoIndicadores[]).find((p) => p === busca.get("periodo")) ?? "ESTE_MES";
  const carga = useCarregar<Dados>(pode("pedidos.ver") ? `/v1/condominio/indicadores?periodo=${periodo}` : null);
  const relatorios = useCarregar<ListaRelatorios>(pode("pedidos.ver") ? "/v1/condominio/relatorios" : null);
  const semRelatorio = relatorios.estado === "pronto" && !relatorios.dados.mesFechadoGerado ? relatorios.dados.mesFechado : null;

  const cabecalho = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="t-titulo-tela font-normal tracking-tight">Indicadores</h1>
        <p className="t-apoio">Como o condomínio está respondendo aos moradores. Tudo sai do histórico dos pedidos.</p>
      </div>
      {pode("pedidos.ver") ? <Link href="/indicadores/relatorios" className={classeBotao("contorno")}><Icone nome="documento" />Relatório do mês</Link> : null}
    </div>
  );
  const chamada = semRelatorio ? (
    <section aria-labelledby="t-chamada-relatorio" className="flex flex-wrap items-center gap-4 rounded-[18px] border border-violeta-200 bg-violeta-50 p-5 max-md:p-4">
      <span className="ladrilho h-10 w-10 rounded-xl" data-tom="violeta" aria-hidden="true"><Icone nome="documento" className="h-5 w-5" /></span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <h2 id="t-chamada-relatorio" className="t-titulo-cartao">{tituloDoMes(semRelatorio).split(" ")[0]} fechou e ainda não tem relatório</h2>
        <span className="t-apoio">Os números do mês, o seu texto e os anexos num PDF só, para a assembleia ou o conselho.</span>
      </span>
      <Link href={`/indicadores/relatorios/montar?mes=${semRelatorio}`} className={classeBotao("primario", "", "m")}>Montar o relatório<Icone nome="dir" /></Link>
    </section>
  ) : null;
  if (!pode("pedidos.ver")) return <SemPermissao tela="Indicadores" permissao={PERMISSOES.ACOMPANHAR} />;
  if (carga.estado === "carregando") return <div className="grid gap-4">{cabecalho}<Carregando rotulo="Calculando os indicadores…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{cabecalho}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const podeDecidir = pode("decisoes.aprovar") || pode("pedidos.atualizar");
  return (
    <div className="grid gap-6">
      {cabecalho}
      {chamada}
      <Agora d={carga.dados} podeDecidir={podeDecidir} />
      <NoPeriodo d={carga.dados} periodo={periodo} podeDecidir={podeDecidir}
        trocar={(p) => router.replace(`/indicadores?periodo=${p}`, { scroll: false })} />
    </div>
  );
}
