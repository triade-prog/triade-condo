"use client";
// Fila de pedidos (AT-02, design "Telas do passo 4", tela 2): filtros por situação,
// responsável, prioridade e categoria, atalhos do que pede atenção e busca. Cada pedido mostra
// o protocolo, onde é, a etapa, quem cuida (e se aceitou), há quanto tempo está aberto e o
// próximo retorno. Os filtros ficam no endereço, para o Início levar direto ao que importa.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FILTROS_ATENCAO, FILTROS_SITUACAO, tempoAberto } from "@triade/domain";
import { Aviso, Botao, Carregando, CampoSelecao, CampoTexto, Chip, ErroCarregar, Selo, Vazio, type NomeIcone } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { FilaPedidos, OpcoesPedidos, PedidoDaFila, Recado } from "../tipos.ts";
import { Escolha } from "../moradores/comum.tsx";
import { diaHora, faltaPara, SeloEstadoPedido } from "./comum.tsx";
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

function Item({ p, agora }: { p: PedidoDaFila; agora: string }) {
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  return (
    <li className="grid gap-2 border-t border-linha px-4 py-3 text-sm first:border-t-0 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_5.5rem_8.5rem] md:items-center md:gap-4">
      <div className="min-w-0">
        <Link href={`/pedidos/pedido?id=${p.id}`} className="font-medium text-tinta hover:text-acao hover:underline">
          <span className="font-mono text-xs text-tinta-suave">{p.protocolo}</span> · {p.assunto}
        </Link>
        <span className="block text-xs text-tinta-suave">
          {[p.unidade ?? p.local, p.categoria, p.prioridade.nome].filter(Boolean).join(" · ")}
        </span>
        {p.privado ? <span className="mt-1 inline-block"><Selo tom="neutro">Privado</Selo></span> : null}
      </div>
      <div>
        <span className="md:hidden text-xs text-tinta-suave">Etapa: </span>
        {p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO" ? p.etapa.nome : <SeloEstadoPedido estado={p.estado} />}
        {p.etapa.pausaPrazo && ativo ? <span className="block text-xs text-tinta-suave">prazo pausado</span> : null}
        {p.pendencias ? <span className="block text-xs text-atencao">{p.pendencias === 1 ? "1 pendência" : `${p.pendencias} pendências`}</span> : null}
      </div>
      <div>
        <span className="md:hidden text-xs text-tinta-suave">Responsável: </span>
        {p.responsavel ? (
          <>
            {p.responsavel.eu ? "Você" : p.responsavel.nome}
            {!p.aceito && p.estado !== "ENCERRADO" && p.estado !== "CANCELADO" ? <span className="block text-xs text-atencao">esperando aceite</span> : null}
          </>
        ) : <Selo tom="atencao">Sem responsável</Selo>}
      </div>
      <div>
        <span className="md:hidden text-xs text-tinta-suave">Aberto há </span>
        {tempoAberto(p.abertoEm, p.encerradoEm ?? agora)}
      </div>
      <div>
        <span className="md:hidden text-xs text-tinta-suave">Próximo retorno: </span>
        {p.retornoVencido && p.proximoRetorno ? <Selo tom="erro">{faltaPara(p.proximoRetorno, agora)}</Selo>
          : p.proximoRetorno ? diaHora(p.proximoRetorno) : <span className="text-tinta-suave">—</span>}
      </div>
    </li>
  );
}

/** Busca por protocolo, assunto, local ou unidade; vale ao apertar Enter. */
function Busca({ inicial, aoBuscar }: { inicial: string; aoBuscar: (b: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); aoBuscar(texto.trim()); }}>
      <CampoTexto id="f-busca" rotulo="Buscar" type="search" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)}
        ajuda="Protocolo, assunto, local ou unidade. Enter para buscar." />
    </form>
  );
}

const ICONE_ATENCAO: Record<string, NomeIcone> = {
  SEM_RESPONSAVEL: "pessoa", AGUARDANDO_ACEITE: "check", RETORNO_VENCIDO: "relogio", COM_PENDENCIA: "alerta",
};

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

  function mudar(m: Partial<Filtros>) {
    const novo = consulta({ ...f, pagina: 1, ...m });
    router.replace(novo ? `/pedidos?${novo}` : "/pedidos", { scroll: false });
  }

  if (opcoes.estado === "carregando") return <Carregando rotulo="Carregando os pedidos…" />;
  if (opcoes.estado === "erro") {
    return <div className="grid gap-3"><h1 className="text-[28px] font-normal tracking-tight">Pedidos</h1><ErroCarregar texto={opcoes.texto} tentarDeNovo={opcoes.recarregar} /></div>;
  }
  const o = opcoes.dados;
  const r = fila.estado === "pronto" ? fila.dados.resumo : null;
  const filtrando = q !== "";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Pedidos</h1>
          <p className="mt-1 text-tinta-suave">O que os moradores pediram e o que a gestão viu no prédio, do registro até a conclusão explicada.</p>
        </div>
        {o.pode.registrar ? <Botao onClick={() => setRegistrando(true)}>+ Registrar pedido</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}

      <div className="grid gap-3">
        <Escolha rotulo="Situação" atual={f.situacao} aoMudar={(v) => mudar({ situacao: v })}
          opcoes={Object.entries(FILTROS_SITUACAO).map(([valor, t]) => ({ valor, texto: t }))} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CampoSelecao id="f-responsavel" rotulo="Responsável" value={f.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })}
            opcoes={[{ valor: "", texto: "Todos" }, { valor: "EU", texto: "Os meus" }, { valor: "NENHUM", texto: "Sem responsável" },
              ...o.responsaveis.map((x) => ({ valor: x.vinculoId, texto: x.nome }))]} />
          <CampoSelecao id="f-prioridade" rotulo="Prioridade" value={f.prioridade} onChange={(e) => mudar({ prioridade: e.target.value })}
            opcoes={[{ valor: "", texto: "Todas" }, ...o.prioridades.map((x) => ({ valor: x.id, texto: x.nome }))]} />
          <CampoSelecao id="f-categoria" rotulo="Categoria" value={f.categoria} onChange={(e) => mudar({ categoria: e.target.value })}
            opcoes={[{ valor: "", texto: "Todas" }, ...o.categorias.map((x) => ({ valor: x.id, texto: x.nome }))]} />
          <Busca key={f.busca} inicial={f.busca} aoBuscar={(b) => mudar({ busca: b })} />
        </div>
        <div role="group" aria-label="O que pede atenção" className="flex flex-wrap gap-2">
          {Object.entries(FILTROS_ATENCAO).map(([codigo, nome]) => {
            const n = r ? { SEM_RESPONSAVEL: r.semResponsavel, AGUARDANDO_ACEITE: r.aguardandoAceite, RETORNO_VENCIDO: r.retornoVencido, COM_PENDENCIA: r.comPendencia }[codigo] : null;
            return (
              <Chip key={codigo} ativo={f.atencao === codigo} icone={n ? ICONE_ATENCAO[codigo] : undefined}
                onClick={() => mudar({ atencao: f.atencao === codigo ? "" : codigo })}>
                {nome}{n !== null ? ` (${n})` : ""}
              </Chip>
            );
          })}
          {filtrando ? <Botao variante="discreto" onClick={() => router.replace("/pedidos", { scroll: false })}>Limpar filtros</Botao> : null}
        </div>
      </div>

      {fila.estado === "carregando" ? <Carregando rotulo="Carregando a fila…" /> : null}
      {fila.estado === "erro" ? <ErroCarregar texto={fila.texto} tentarDeNovo={fila.recarregar} /> : null}
      {fila.estado === "pronto" ? (
        fila.dados.itens.length === 0 ? (
          filtrando ? <Vazio titulo="Nenhum pedido com estes filtros" acao={<Botao variante="contorno" onClick={() => router.replace("/pedidos")}>Limpar filtros</Botao>} />
            : (
              <Vazio titulo="Nenhum pedido ativo" acao={o.pode.registrar ? <Botao onClick={() => setRegistrando(true)}>+ Registrar pedido</Botao> : undefined}>
                Quando alguém pedir algo por telefone ou pessoalmente, registre aqui.
              </Vazio>
            )
        ) : (
          <section aria-labelledby="t-fila" className="grid gap-2">
            <h2 id="t-fila" className="sr-only">Pedidos encontrados</h2>
            <div className="overflow-hidden rounded-2xl border border-linha bg-superficie">
              <div aria-hidden="true" className="hidden border-b border-linha bg-violeta-50/60 px-4 py-2.5 text-[13px] font-medium text-tinta-suave md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_5.5rem_8.5rem] md:gap-4">
                <span>Pedido</span><span>Etapa</span><span>Responsável</span><span>Aberto há</span><span>Próximo retorno</span>
              </div>
              <ul>{fila.dados.itens.map((p) => <Item key={p.id} p={p} agora={fila.dados.agora} />)}</ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-tinta-suave">
              <span>{fila.dados.total === 1 ? "1 pedido" : `${fila.dados.total} pedidos`}</span>
              {fila.dados.total > fila.dados.porPagina ? (
                <span className="flex gap-2">
                  <Botao variante="contorno" disabled={f.pagina <= 1} onClick={() => router.replace(`/pedidos?${consulta({ ...f, pagina: f.pagina - 1 })}`)}>Anteriores</Botao>
                  <Botao variante="contorno" disabled={f.pagina * fila.dados.porPagina >= fila.dados.total}
                    onClick={() => router.replace(`/pedidos?${consulta({ ...f, pagina: f.pagina + 1 })}`)}>Próximos</Botao>
                </span>
              ) : null}
            </div>
          </section>
        )
      ) : null}

      <RegistrarPedido aberto={registrando} opcoes={o} aoFechar={() => setRegistrando(false)}
        registrado={(protocolo, id) => {
          setRegistrando(false);
          setRecado({ tom: "ok", texto: `Pedido ${protocolo} registrado.` });
          fila.recarregar();
          atualizar();
          router.push(`/pedidos/pedido?id=${id}&novo=1`);
        }} />
    </div>
  );
}
