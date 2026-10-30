"use client";
// Manutenções (MP-01 a MP-04; DC15, telas-modelo manutencao-computador e manutencao-celular): o
// que está aberto, com a situação em selo, o tipo, quem executa, o responsável e o próximo
// retorno, em vermelho quando vence. Situação em abas, "Pede atenção" em atalhos, a busca à vista
// e o tipo e o prestador em Filtros. No celular, cartões e o "Nova manutenção" flutuando sobre a
// barra de baixo. Os filtros ficam no endereço.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ATALHOS_MANUTENCAO, FILTROS_MANUTENCAO, TIPOS_MANUTENCAO } from "@triade/domain";
import { Aviso, Botao, Carregando, CampoSelecao, Dialogo, ErroCarregar, Icone, Vazio, type NomeIcone, type Tom } from "@triade/ui";
import { useCarregar, useContagens, usePlataforma } from "../sessao.tsx";
import type { ListaManutencoes, OpcoesManutencao, Recado } from "../tipos.ts";
import { LinhaManutencao, PartesManutencao } from "./comum.tsx";
import { FormManutencao, type InicioManutencao } from "./FormManutencao.tsx";
import { MarcarVisita } from "./MarcarVisita.tsx";

type Filtros = { situacao: string; tipo: string; prestador: string; atencao: string; busca: string; pagina: number };
const ICONE_ATALHO: Record<string, NomeIcone> = { RETORNO_VENCIDO: "relogio", PREVENTIVAS_MES: "calendario", PENDENTES_PARADAS: "alerta" };
const TOM_ATALHO: Record<string, Tom> = { RETORNO_VENCIDO: "erro", PREVENTIVAS_MES: "andamento", PENDENTES_PARADAS: "atencao" };

/** O tipo e o prestador, numa janela. */
function JanelaFiltros({ aberto, f, o, aoFechar, aplicar }: {
  aberto: boolean; f: Filtros; o: OpcoesManutencao | null; aoFechar: () => void; aplicar: (m: Partial<Filtros>) => void;
}) {
  const [v, setV] = useState({ tipo: f.tipo, prestador: f.prestador });
  return (
    <Dialogo aberto={aberto} titulo="Filtrar manutenções" aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); aplicar(v); }}>
        <CampoSelecao id="mn-f-tipo" rotulo="Tipo" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}
          opcoes={[{ valor: "", texto: "Preventiva, corretiva e vistoria" }, ...Object.entries(TIPOS_MANUTENCAO).map(([valor, t]) => ({ valor, texto: t }))]} />
        <CampoSelecao id="mn-f-prestador" rotulo="Prestador" value={v.prestador} onChange={(e) => setV({ ...v, prestador: e.target.value })}
          opcoes={[{ valor: "", texto: "Todos" }, ...(o?.prestadores ?? []).map((p) => ({ valor: p.id, texto: p.nome }))]} />
        <div className="flex justify-end gap-2">
          <Botao variante="discreto" onClick={() => aplicar({ tipo: "", prestador: "" })}>Tirar filtros</Botao>
          <Botao type="submit">Mostrar manutenções</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function consulta(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.situacao && f.situacao !== "ABERTAS") q.set("situacao", f.situacao);
  if (f.tipo) q.set("tipo", f.tipo);
  if (f.prestador) q.set("prestador", f.prestador);
  if (f.atencao) q.set("atencao", f.atencao);
  if (f.busca) q.set("busca", f.busca);
  if (f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

export function Manutencoes() {
  const router = useRouter();
  const busca = useSearchParams();
  const { atualizar } = usePlataforma();
  const f: Filtros = {
    situacao: busca.get("situacao") && busca.get("situacao")! in FILTROS_MANUTENCAO ? busca.get("situacao")! : "ABERTAS",
    tipo: busca.get("tipo") && busca.get("tipo")! in TIPOS_MANUTENCAO ? busca.get("tipo")! : "",
    prestador: busca.get("prestador") ?? "",
    atencao: busca.get("atencao") && busca.get("atencao")! in ATALHOS_MANUTENCAO ? busca.get("atencao")! : "",
    busca: busca.get("busca") ?? "",
    pagina: Math.max(1, Number(busca.get("pagina")) || 1),
  };
  const q = consulta(f);
  const lista = useCarregar<ListaManutencoes>(`/v1/condominio/manutencao${q ? `?${q}` : ""}`);
  const contagens = useContagens("manutencao", q);
  const opcoes = useCarregar<OpcoesManutencao>("/v1/condominio/manutencao/opcoes");
  // R8 (quadro 482): a ordem de serviço nasce do orçamento já preenchida (?nova=1&titulo=&local=&prestador=).
  const [nova, setNova] = useState(busca.get("nova") === "1");
  const inicio: InicioManutencao | undefined = busca.get("nova") === "1"
    ? { titulo: busca.get("titulo") ?? undefined, local: busca.get("local") ?? undefined, prestadorId: busca.get("prestador") ?? undefined } : undefined;
  const [visita, setVisita] = useState<string | null>(null);
  const [recado, setRecado] = useState<Recado>(null);
  const [texto, setTexto] = useState(f.busca);

  const ir = (m: Partial<Filtros>) => {
    const novo = consulta({ ...f, pagina: 1, ...m });
    router.replace(novo ? `/manutencao?${novo}` : "/manutencao", { scroll: false });
  };

  const o = opcoes.estado === "pronto" ? opcoes.dados : null;
  const dados = lista.estado === "pronto" ? lista.dados : null;
  const podeEditar = Boolean(o?.pode.editar);
  const filtrando = q !== "";
  const [filtrandoAberto, setFiltrandoAberto] = useState(false);
  const outros = [f.tipo, f.prestador].filter(Boolean).length;
  const nova_ = <Botao onClick={() => setNova(true)}><Icone nome="mais" />Nova manutenção</Botao>;
  const limpar = () => { setTexto(""); router.replace("/manutencao", { scroll: false }); };

  return (
    <div className="grid gap-5 max-md:pb-16">
      <PartesManutencao />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Manutenção</h1>
          <p className="t-apoio mt-1">O que precisa de cuidado no prédio, quem cuida e quem executa.</p>
        </div>
        {podeEditar ? <div className="max-md:hidden">{nova_}</div> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      <div className="flex items-center gap-3">
        <form role="search" aria-label="Buscar manutenções" className="busca min-w-0 flex-1 md:max-w-[520px]" onSubmit={(e) => { e.preventDefault(); ir({ busca: texto.trim() }); }}>
          <Icone nome="busca" />
          <label htmlFor="mn-busca" className="sr-only">Buscar</label>
          <input id="mn-busca" className="campo" type="search" placeholder="Buscar por nome, local ou prestador" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </form>
        <Botao variante="contorno" className="max-md:w-11 max-md:px-0" onClick={() => setFiltrandoAberto(true)}>
          <Icone nome="filtro" /><span className="max-md:sr-only">Filtros{outros ? ` · ${outros}` : ""}</span>
        </Botao>
        {filtrando ? <Botao variante="discreto" className="max-md:hidden" onClick={limpar}>Limpar filtros</Botao> : null}
      </div>

      <section aria-labelledby="t-lista" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-lista" className="sr-only">Manutenções encontradas</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {Object.entries(FILTROS_MANUTENCAO).map(([valor, nome]) => {
            const atual = f.situacao === valor;
            const n = contagens.n[valor];
            return (
              <button key={valor} type="button" aria-pressed={atual} onClick={() => ir({ situacao: valor })}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {nome}
                {n !== undefined && (n > 0 || atual) ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span> : null}
              </button>
            );
          })}
        </nav>
        <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
          <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
          {Object.entries(ATALHOS_MANUTENCAO).map(([codigo, nome]) => {
            const n = dados ? { RETORNO_VENCIDO: dados.atalhos.retornoVencido, PREVENTIVAS_MES: dados.atalhos.preventivasMes,
              PENDENTES_PARADAS: dados.atalhos.pendentesParadas }[codigo] : null;
            const rotulo = codigo === "PENDENTES_PARADAS" && dados ? `Pendentes há mais de ${dados.pendenciaDias} dias` : nome;
            return (
              <button key={codigo} type="button" aria-pressed={f.atencao === codigo} data-tom={TOM_ATALHO[codigo]} className="chip-atencao"
                onClick={() => ir({ atencao: f.atencao === codigo ? "" : codigo, situacao: "ABERTAS" })}>
                {n ? <Icone nome={ICONE_ATALHO[codigo]!} className="h-4 w-4" /> : null}
                {rotulo}{n !== null && n !== undefined ? <> <b>{n}</b></> : null}
              </button>
            );
          })}
        </div>

        {lista.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando as manutenções…" /></div> : null}
        {lista.estado === "erro" ? <div className="p-5"><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /></div> : null}
        {dados ? (
          dados.itens.length === 0 ? (
            <div className="md:p-5">
              {filtrando ? <Vazio titulo="Nenhuma manutenção com estes filtros" icone="filtro" acao={<Botao variante="contorno" onClick={limpar}>Limpar filtros</Botao>} />
                : <Vazio titulo="Nenhuma manutenção aberta" icone="ferramenta" acao={podeEditar ? nova_ : undefined}>
                    Registre o que precisa de cuidado no prédio. As preventivas abrem sozinhas, perto da data.
                  </Vazio>}
            </div>
          ) : (
            <>
              <div aria-hidden="true" className="hidden grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_20px] gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid">
                <span /><span className="t-rotulo">Manutenção</span><span className="t-rotulo">Quem executa</span><span className="t-rotulo">Situação</span><span className="t-rotulo">Retorno</span><span />
              </div>
              <ul className="grid max-md:gap-3">{dados.itens.map((m) => <LinhaManutencao key={m.id} m={m} />)}</ul>
              <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
                <span className="t-apoio">{dados.total === 1 ? "1 manutenção" : `${dados.total} manutenções`}{f.situacao === "ABERTAS" ? (dados.total === 1 ? " aberta" : " abertas") : ""}</span>
                <span className="t-apoio">As concluídas ficam no histórico do local e do prestador.</span>
                {dados.total > 30 ? (
                  <span className="flex gap-2">
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina <= 1} onClick={() => ir({ pagina: f.pagina - 1 })}><Icone nome="esq" />Anteriores</Botao>
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina * 30 >= dados.total} onClick={() => ir({ pagina: f.pagina + 1 })}>Próximas<Icone nome="dir" /></Botao>
                  </span>
                ) : null}
              </div>
            </>
          )
        ) : null}
      </section>

      {podeEditar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{nova_}</div> : null}
      <JanelaFiltros key={`${filtrandoAberto}`} aberto={filtrandoAberto} f={f} o={o} aoFechar={() => setFiltrandoAberto(false)}
        aplicar={(m) => { setFiltrandoAberto(false); ir(m); }} />

      {o ? (
        <FormManutencao aberto={nova} opcoes={o} inicio={inicio} aoFechar={() => setNova(false)}
          salvo={(id, t, marcar) => {
            setNova(false);
            setRecado({ tom: "ok", texto: t });
            lista.recarregar();
            contagens.recarregar();
            atualizar();
            if (marcar) setVisita(id); else router.push(`/manutencao/manutencao?id=${id}`);
          }} />
      ) : null}
      {visita ? <MarcarVisita manutencaoId={visita} aoFechar={() => router.push(`/manutencao/manutencao?id=${visita}`)}
        salvo={() => router.push(`/manutencao/manutencao?id=${visita}`)} /> : null}
    </div>
  );
}
