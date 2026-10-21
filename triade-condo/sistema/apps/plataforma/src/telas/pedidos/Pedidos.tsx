"use client";
// Fila de pedidos (AT-02; DC15, telas-modelo/pedido-lista-*): abas por situação, atalhos do que
// pede atenção, busca e os outros filtros numa janela. Cada pedido mostra o ícone da categoria (em
// cinza), o protocolo, o assunto, a prioridade só quando é Alta ou Urgente, onde é, quem cuida (e
// se aceitou), a situação com a etapa, o próximo retorno e quando foi registrado. Os filtros
// ficam no endereço, para o Início levar direto ao que importa.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FILTROS_ATENCAO, FILTROS_SITUACAO } from "@triade/domain";
import { Aviso, Botao, Carregando, CampoSelecao, Dialogo, ErroCarregar, Icone, Selo, Vazio, type NomeIcone, type Tom } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { FilaPedidos, OpcoesPedidos, PedidoDaFila, Recado, ResumoPedidos } from "../tipos.ts";
import { aHora, diaHora, iconeDaCategoria, seloSituacao, SeloPrioridade } from "./comum.tsx";
import { RegistrarPedido } from "./RegistrarPedido.tsx";

type Filtros = { situacao: string; responsavel: string; prioridade: string; categoria: string; atencao: string; busca: string; pagina: number };
const CHAVES = ["situacao", "responsavel", "prioridade", "categoria", "atencao", "busca"] as const;

function lerFiltros(b: URLSearchParams): Filtros {
  const v = (k: string) => b.get(k) ?? "";
  return {
    situacao: v("situacao") in FILTROS_SITUACAO ? v("situacao") : "ATIVOS",
    responsavel: v("responsavel"), prioridade: v("prioridade"), categoria: v("categoria"),
    atencao: v("atencao") in FILTROS_ATENCAO ? v("atencao") : "", busca: v("busca"),
    pagina: Math.max(1, Number(v("pagina")) || 1),
  };
}

function consulta(f: Filtros): string {
  const q = new URLSearchParams();
  for (const k of CHAVES) if (f[k] && !(k === "situacao" && f[k] === "ATIVOS")) q.set(k, f[k]);
  if (f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

/** O próximo retorno, com o ícone do relógio e o tom de quanto falta. */
function Retorno({ p, agora }: { p: PedidoDaFila; agora: string }) {
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  let texto: string | null = null;
  let tom = "text-tinta-suave";
  if (p.estado === "EM_REVISAO") { texto = "Esperando revisão"; tom = "text-atencao"; }
  else if (ativo && p.etapa.pausaPrazo) texto = "Prazo parado";
  else if (ativo && p.proximoRetorno) {
    const falta = Date.parse(p.proximoRetorno) - Date.parse(agora);
    texto = p.retornoVencido ? `Retorno venceu ${aHora(p.proximoRetorno, agora).replace(/^às /, "")}` : `Retorno ${aHora(p.proximoRetorno, agora)}`;
    tom = p.retornoVencido ? "text-erro" : falta < 4 * 3600_000 ? "text-atencao" : "text-tinta-suave";
  }
  if (!texto) return <span className="t-apoio max-md:hidden">Sem retorno</span>;
  return <span className={`flex items-center gap-1.5 text-[13px] ${tom}`}><Icone nome="relogio" className="h-4 w-4" />{texto}</span>;
}

function Item({ p, agora }: { p: PedidoDaFila; agora: string }) {
  const fechado = p.estado === "ENCERRADO" || p.estado === "CANCELADO";
  const quem = p.responsavel
    ? <span>{p.responsavel.eu ? "Você" : p.responsavel.nome}{!p.aceito && !fechado ? <span className="text-atencao"> · esperando aceite</span> : null}</span>
    : <span className="text-atencao">Sem responsável</span>;
  const situacao = seloSituacao(p.estado, p.etapa.nome);
  return (
    <li className="relative grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_96px_20px] md:border-t md:border-linha md:first:border-t-0">
      <span className="ladrilho self-start md:self-center" aria-hidden="true"><Icone nome={iconeDaCategoria(p.categoria)} /></span>
      <div className="grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/pedidos/pedido?id=${p.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">
            <span className="t-codigo text-tinta-suave">{p.protocolo}</span><span className="max-md:hidden"> </span><span className="md:hidden"><br /></span>{p.assunto}
          </Link>
          <SeloPrioridade nome={p.prioridade.nome} />
          {p.privado ? <Selo tom="neutro">Privado</Selo> : null}
        </span>
        <span className="t-apoio">
          {p.unidade ?? p.local ?? null}{p.unidade ?? p.local ? <span className="max-md:hidden"> · </span> : null}<span className="max-md:hidden">{p.categoria}</span> · {quem}
        </span>
        {p.pendencias ? <span className="text-[13px] text-atencao">{p.pendencias === 1 ? "1 pendência" : `${p.pendencias} pendências`}</span> : null}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 md:hidden">
          <Selo tom={situacao.tom}>{situacao.texto}</Selo>
          <Retorno p={p} agora={agora} />
        </span>
      </div>
      <span className="max-md:hidden"><Selo tom={situacao.tom}>{situacao.texto}</Selo></span>
      <span className="max-md:hidden"><Retorno p={p} agora={agora} /></span>
      <span className="t-codigo text-tinta-suave max-md:hidden">{diaHora(p.abertoEm)}</span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
    </li>
  );
}

/** Os outros filtros (responsável, prioridade e categoria), numa janela. */
function JanelaFiltros({ aberto, f, o, aoFechar, aplicar }: {
  aberto: boolean; f: Filtros; o: OpcoesPedidos; aoFechar: () => void; aplicar: (m: Partial<Filtros>) => void;
}) {
  const [v, setV] = useState({ responsavel: f.responsavel, prioridade: f.prioridade, categoria: f.categoria });
  return (
    <Dialogo aberto={aberto} titulo="Filtrar pedidos" aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); aplicar(v); }}>
        <CampoSelecao id="f-responsavel" rotulo="Responsável" icone="pessoa" value={v.responsavel} onChange={(e) => setV({ ...v, responsavel: e.target.value })}
          opcoes={[{ valor: "", texto: "Todos" }, { valor: "EU", texto: "Os meus" }, { valor: "NENHUM", texto: "Sem responsável" },
            ...o.responsaveis.map((x) => ({ valor: x.vinculoId, texto: x.nome }))]} />
        <CampoSelecao id="f-prioridade" rotulo="Prioridade" icone="alerta" value={v.prioridade} onChange={(e) => setV({ ...v, prioridade: e.target.value })}
          opcoes={[{ valor: "", texto: "Todas" }, ...o.prioridades.map((x) => ({ valor: x.id, texto: x.nome }))]} />
        <CampoSelecao id="f-categoria" rotulo="Categoria" icone="lista" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })}
          opcoes={[{ valor: "", texto: "Todas" }, ...o.categorias.map((x) => ({ valor: x.id, texto: x.nome }))]} />
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={() => aplicar({ responsavel: "", prioridade: "", categoria: "" })}>Tirar filtros</Botao>
          <Botao type="submit">Mostrar pedidos</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Busca por protocolo, assunto, local ou unidade; vale ao apertar Enter. */
function Busca({ inicial, aoBuscar }: { inicial: string; aoBuscar: (b: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <form role="search" aria-label="Buscar pedidos" className="busca min-w-0 flex-1 md:max-w-[520px]" onSubmit={(e) => { e.preventDefault(); aoBuscar(texto.trim()); }}>
      <Icone nome="busca" />
      <label htmlFor="f-busca" className="sr-only">Buscar</label>
      <input id="f-busca" className="campo" type="search" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por número, assunto, unidade ou local" />
    </form>
  );
}

const TOM_ATENCAO: Record<string, Tom> = { RETORNO_VENCIDO: "erro", SEM_RESPONSAVEL: "atencao", AGUARDANDO_ACEITE: "andamento", COM_PENDENCIA: "neutro" };
const ICONE_ATENCAO: Record<string, NomeIcone> = { SEM_RESPONSAVEL: "pessoa", AGUARDANDO_ACEITE: "check", RETORNO_VENCIDO: "relogio", COM_PENDENCIA: "alerta" };
const CONTA_ATENCAO = (r: ResumoPedidos): Record<string, number> => ({
  SEM_RESPONSAVEL: r.semResponsavel, AGUARDANDO_ACEITE: r.aguardandoAceite, RETORNO_VENCIDO: r.retornoVencido, COM_PENDENCIA: r.comPendencia,
});

export function Pedidos() {
  const busca = useSearchParams();
  const router = useRouter();
  const { atualizar } = usePlataforma();
  const f = lerFiltros(busca);
  const opcoes = useCarregar<OpcoesPedidos>("/v1/condominio/pedidos/opcoes");
  const q = consulta(f);
  const fila = useCarregar<FilaPedidos>(`/v1/condominio/pedidos${q ? `?${q}` : ""}`);
  const [registrando, setRegistrando] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);
  const [filtrandoAberto, setFiltrando] = useState(false);

  function mudar(m: Partial<Filtros>) {
    const novo = consulta({ ...f, pagina: 1, ...m });
    router.replace(novo ? `/pedidos?${novo}` : "/pedidos", { scroll: false });
  }

  if (opcoes.estado === "carregando") return <Carregando rotulo="Carregando os pedidos…" />;
  if (opcoes.estado === "erro") {
    return <div className="grid gap-3"><h1 className="t-titulo-tela">Pedidos</h1><ErroCarregar erro={opcoes.erro} texto={opcoes.texto} tentarDeNovo={opcoes.recarregar} oQue="os pedidos" /></div>;
  }
  const o = opcoes.dados;
  const r = fila.estado === "pronto" ? fila.dados.resumo : null;
  const filtrando = q !== "";
  const outros = [f.responsavel, f.prioridade, f.categoria].filter(Boolean).length;
  const contaAba: Partial<Record<string, number>> = r ? { ATIVOS: r.ativos, EM_REVISAO: r.emRevisao } : {};
  const registrar = (
    <Botao onClick={() => setRegistrando(true)}><Icone nome="mais" />Registrar pedido</Botao>
  );

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Pedidos</h1>
          <p className="t-apoio mt-1">O que os moradores pediram e o que a gestão viu no prédio, do registro à conclusão.</p>
        </div>
        {o.pode.registrar ? <div className="max-md:hidden">{registrar}</div> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      <div className="flex items-center gap-3">
        <Busca key={f.busca} inicial={f.busca} aoBuscar={(b) => mudar({ busca: b })} />
        <Botao variante="contorno" aria-label={outros ? `Filtros, ${outros} em uso` : "Filtros"} className="max-md:w-11 max-md:px-0" onClick={() => setFiltrando(true)}>
          <Icone nome="filtro" /><span className="max-md:hidden">Filtros{outros ? ` · ${outros}` : ""}</span>
        </Botao>
        {filtrando ? <Botao variante="discreto" className="max-md:hidden" onClick={() => router.replace("/pedidos", { scroll: false })}>Limpar filtros</Botao> : null}
      </div>

      <section aria-labelledby="t-fila" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-fila" className="sr-only">Pedidos encontrados</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {Object.entries(FILTROS_SITUACAO).map(([valor, texto]) => {
            const atual = f.situacao === valor;
            const n = contaAba[valor];
            return (
              <button key={valor} type="button" aria-pressed={atual} onClick={() => mudar({ situacao: valor })}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {texto}
                {n !== undefined ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span> : null}
              </button>
            );
          })}
        </nav>
        <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
          <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
          {Object.entries(FILTROS_ATENCAO).map(([codigo, nome]) => {
            const n = r ? CONTA_ATENCAO(r)[codigo] : null;
            return (
              <button key={codigo} type="button" aria-pressed={f.atencao === codigo} data-tom={TOM_ATENCAO[codigo]}
                onClick={() => mudar({ atencao: f.atencao === codigo ? "" : codigo })} className="chip-atencao">
                {n ? <Icone nome={ICONE_ATENCAO[codigo]!} className="h-4 w-4" /> : null}
                {nome}{n !== null ? <> <b>{n}</b></> : null}
              </button>
            );
          })}
        </div>

        {fila.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando a fila…" /></div> : null}
        {fila.estado === "erro" ? <div className="p-5"><ErroCarregar erro={fila.erro} texto={fila.texto} tentarDeNovo={fila.recarregar} oQue="a fila" /></div> : null}
        {fila.estado === "pronto" ? (
          fila.dados.itens.length === 0 ? (
            <div className="md:p-5">
              {filtrando ? <Vazio titulo="Nenhum pedido com estes filtros" icone="filtro" acao={<Botao variante="contorno" onClick={() => router.replace("/pedidos")}>Limpar filtros</Botao>} />
                : (
                  <Vazio titulo="Nenhum pedido ativo" icone="pedido" acao={o.pode.registrar ? registrar : undefined}>
                    Quando alguém pedir algo por telefone ou pessoalmente, registre aqui.
                  </Vazio>
                )}
            </div>
          ) : (
            <>
              <div aria-hidden="true" className="hidden grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_96px_20px] gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid">
                <span /><span className="t-rotulo">Pedido</span><span className="t-rotulo">Situação</span><span className="t-rotulo">Retorno</span><span className="t-rotulo">Registrado</span><span />
              </div>
              <ul className="grid max-md:gap-3">{fila.dados.itens.map((p) => <Item key={p.id} p={p} agora={fila.dados.agora} />)}</ul>
              <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
                <span className="t-apoio">
                  {fila.dados.total > fila.dados.itens.length
                    ? `Mostrando ${(f.pagina - 1) * fila.dados.porPagina + 1} a ${(f.pagina - 1) * fila.dados.porPagina + fila.dados.itens.length} de ${fila.dados.total}`
                    : fila.dados.total === 1 ? "1 pedido" : `${fila.dados.total} pedidos`}
                </span>
                {fila.dados.total > fila.dados.porPagina ? (
                  <span className="flex gap-2">
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina <= 1} onClick={() => router.replace(`/pedidos?${consulta({ ...f, pagina: f.pagina - 1 })}`)}><Icone nome="esq" />Anteriores</Botao>
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina * fila.dados.porPagina >= fila.dados.total}
                      onClick={() => router.replace(`/pedidos?${consulta({ ...f, pagina: f.pagina + 1 })}`)}>Próximos<Icone nome="dir" /></Botao>
                  </span>
                ) : null}
              </div>
            </>
          )
        ) : null}
      </section>

      {o.pode.registrar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{registrar}</div> : null}

      <JanelaFiltros key={`${filtrandoAberto}`} aberto={filtrandoAberto} f={f} o={o} aoFechar={() => setFiltrando(false)}
        aplicar={(m) => { setFiltrando(false); mudar(m); }} />
      <RegistrarPedido aberto={registrando} opcoes={o} aoFechar={() => setRegistrando(false)}
        aoRegistrar={() => { fila.recarregar(); atualizar(); }}
        registrado={(protocolo, id) => {
          setRegistrando(false);
          setRecado({ tom: "ok", texto: `Pedido ${protocolo} registrado.` });
          router.push(`/pedidos/pedido?id=${id}&novo=1`);
        }} />
    </div>
  );
}
