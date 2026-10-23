"use client";
// Chamados (PI-20, PI-17; DC15, tela-modelo console-chamados-computador, rodada Console de
// 23/10/2026): suporte técnico da plataforma, dos condomínios atribuídos a quem vê. Os filtros
// viram abas com o número, como em Ajuda e suporte da Plataforma; Sem responsável vira selo âmbar
// ao lado da situação; a linha inteira abre o chamado. Novos primeiro. O filtro de tipo, Mudanças
// (0286, decisão C.1), junta os pedidos de mudança de configuração e fica no endereço (?tipo=MUDANCA).

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AREAS_CHAMADO, FILTROS_CHAMADO, SITUACOES_CHAMADO, TIPOS_CHAMADO } from "@triade/domain";
import { Carregando, ErroCarregar, Icone, Vazio, type Tom } from "@triade/ui";
import { AbasLista, CabecaPagina, CaixaLista, CLASSE_LINHA, CLASSE_LINK_LINHA, diaHora, plural } from "../comum.tsx";
import { useCarregar } from "../sessao.tsx";

export interface ResumoChamado {
  id: string;
  condominioId: string;
  condominio?: string;
  numero: number;
  tipo: keyof typeof TIPOS_CHAMADO;
  area: keyof typeof AREAS_CHAMADO;
  titulo: string;
  situacao: keyof typeof SITUACOES_CHAMADO;
  abertoPor: string;
  responsavelId?: string;
  responsavel?: string;
  imagens: number;
  /** Só no chamado de mudança (0286): a parte e como estava quando foi pedido. */
  parte?: string;
  hoje?: string;
  ultima?: { lado: "CLIENTE" | "TRIADE"; autor: string; em: string };
  atualizadoEm: string;
  versao: number;
}

export const TOM_CHAMADO: Record<string, Tom> = { NOVO: "atencao", ANDAMENTO: "andamento", ESPERANDO_CLIENTE: "info", RESOLVIDO: "ok" };

type Filtro = keyof typeof FILTROS_CHAMADO;
const ACEITA: Record<Filtro, (c: ResumoChamado) => boolean> = {
  ABERTOS: (c) => c.situacao === "NOVO" || c.situacao === "ANDAMENTO",
  ESPERANDO_CLIENTE: (c) => c.situacao === "ESPERANDO_CLIENTE",
  RESOLVIDOS: (c) => c.situacao === "RESOLVIDO",
  TODOS: () => true,
};

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_20px]";

export function Chamados() {
  const [filtro, setFiltro] = useState<Filtro>("ABERTOS");
  const busca = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const soMudancas = busca.get("tipo") === "MUDANCA";
  const mudarTipo = (mudancas: boolean) => router.replace(mudancas ? `${caminho}?tipo=MUDANCA` : caminho, { scroll: false });
  // Todos de uma vez (os resolvidos dos últimos 60 dias): as abas contam e filtram aqui.
  const carga = useCarregar<{ chamados: ResumoChamado[] }>("/v1/chamados?filtro=TODOS");
  const recebidos = carga.estado === "pronto" ? carga.dados.chamados : [];
  const todos = soMudancas ? recebidos.filter((c) => c.tipo === "MUDANCA") : recebidos;
  const visiveis = todos.filter(ACEITA[filtro]);
  const abertos = todos.filter(ACEITA.ABERTOS).length;
  const mudancasAbertas = recebidos.filter((c) => c.tipo === "MUDANCA" && ACEITA.ABERTOS(c)).length;
  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Chamados" apoio="Suporte técnico da plataforma, dos condomínios atribuídos a você." />
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? (
        <CaixaLista titulo="Chamados dos seus clientes" colunas={COLUNAS} cabecalho={visiveis.length ? ["", "Chamado", "Última mensagem", "Situação", ""] : undefined}
          abas={<AbasLista rotulo="Filtrar os chamados" atual={filtro} aoMudar={setFiltro}
            abas={(Object.keys(FILTROS_CHAMADO) as Filtro[]).map((f) => ({ valor: f, texto: FILTROS_CHAMADO[f], n: f === "TODOS" ? undefined : todos.filter(ACEITA[f]).length }))} />}
          filtros={
            <div className="flex flex-wrap items-center gap-3 border-b border-linha px-5 py-3 max-md:px-0">
              <span className="t-apoio font-medium">Tipo</span>
              <div role="group" aria-label="Tipo de chamado" className="trilho">
                <button type="button" className="chip" aria-pressed={!soMudancas} onClick={() => mudarTipo(false)}>Todos os tipos</button>
                <button type="button" className="chip" aria-pressed={soMudancas} onClick={() => mudarTipo(true)}><Icone nome="trocar" />Mudanças</button>
              </div>
              <span className="t-apoio">{plural(mudancasAbertas, "pedido de mudança aberto", "pedidos de mudança abertos")}</span>
            </div>
          }
          rodape={visiveis.length ? (
            <>
              <span className="t-apoio">{soMudancas
                ? plural(abertos, "pedido de mudança aberto nos seus clientes", "pedidos de mudança abertos nos seus clientes")
                : plural(abertos, "chamado aberto nos seus clientes", "chamados abertos nos seus clientes")}</span>
              <span className="t-apoio">{soMudancas ? "O filtro vale para todas as abas." : "Resolvido reabre se o cliente responder em até 7 dias."}</span>
            </>
          ) : undefined}>
          {visiveis.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={soMudancas ? "Nenhum pedido de mudança aqui" : "Nenhum chamado aqui"} icone={soMudancas ? "trocar" : "balao"}>
                {soMudancas ? "Quando um síndico pedir mudança numa configuração, o pedido aparece aqui." : "Quando um cliente abrir um chamado, ele aparece nesta fila."}
              </Vazio>
            </div>
          ) : (
            <ul className="grid max-md:gap-3 max-md:pt-3">
              {visiveis.map((c) => (
                <li key={c.id} className={`${CLASSE_LINHA} ${COLUNAS}`}>
                  <span className="ladrilho self-start md:self-center" data-tom={c.situacao === "NOVO" ? "atencao" : "violeta"} aria-hidden="true"><Icone nome={c.tipo === "MUDANCA" ? "trocar" : "balao"} /></span>
                  <span className="grid min-w-0 justify-items-start gap-1">
                    <Link href={`/chamados/${c.condominioId}/${c.id}`} className={CLASSE_LINK_LINHA}>{c.titulo}</Link>
                    <span className="t-apoio">
                      {[c.condominio, TIPOS_CHAMADO[c.tipo], AREAS_CHAMADO[c.area], c.imagens ? plural(c.imagens, "imagem", "imagens") : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="t-apoio min-w-0 max-md:col-span-2 max-md:col-start-2">
                    {c.ultima ? `${c.ultima.autor} escreveu ${diaHora(c.ultima.em)}` : `Aberto por ${c.abertoPor}`}
                  </span>
                  <span className="flex flex-wrap gap-1.5 max-md:col-span-2 max-md:col-start-2">
                    <span className="selo" data-tom={TOM_CHAMADO[c.situacao]}>{SITUACOES_CHAMADO[c.situacao]}</span>
                    {c.situacao !== "RESOLVIDO" ? (c.responsavel ? <span className="selo" data-tom="neutro">{c.responsavel}</span> : <span className="selo" data-tom="atencao">Sem responsável</span>) : null}
                  </span>
                  <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
                </li>
              ))}
            </ul>
          )}
        </CaixaLista>
      ) : null}
    </div>
  );
}
