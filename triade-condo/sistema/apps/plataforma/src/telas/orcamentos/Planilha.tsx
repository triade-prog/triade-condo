"use client";
// A planilha comparativa (R8, OC-05; quadro 483): uma folha A4 com o que foi pedido, as propostas
// lado a lado, a decisão e o motivo, e os anexos. É o que vai para o conselho, para a assembleia
// ou para a pasta. "Baixar em PDF" é a impressão do navegador: nada sai da máquina de quem imprime.
// Fora da moldura do painel, para a folha sair limpa.

import { mostrarCusto, mostrarTotal } from "@triade/domain";
import { Botao, Carregando, ErroCarregar, FolhaA4, Icone, Logo, PreviaImpressao } from "@triade/ui";
import { useParams } from "next/navigation";
import { useCarregar } from "../sessao.tsx";
import { ddmm, diaCompleto, diaHoraPrazo } from "./comum.tsx";
import type { Comparacao, OrcamentoDetalhe } from "./tipos.ts";

const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function Planilha() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<OrcamentoDetalhe>(`/v1/condominio/orcamentos/${id}`);
  const comp = useCarregar<Comparacao>(`/v1/condominio/orcamentos/${id}/comparacao`);
  const cond = useCarregar<{ nome: string }>("/v1/condominio");
  if (ficha.estado === "carregando" || comp.estado === "carregando" || cond.estado === "carregando") return <main className="mx-auto max-w-3xl p-8"><Carregando rotulo="Preparando a planilha…" /></main>;
  if (ficha.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><ErroCarregar erro={ficha.erro} texto={ficha.texto} tentarDeNovo={ficha.recarregar} /></main>;
  if (comp.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><ErroCarregar erro={comp.erro} texto={comp.texto} tentarDeNovo={comp.recarregar} /></main>;
  const d = ficha.dados;
  const o = d.orcamento;
  const c = comp.dados;
  const nome = cond.estado === "pronto" ? cond.dados.nome : "Condomínio";
  const escolhida = o.escolha?.propostaId ?? null;
  const propostas = [...c.propostas].sort((a, b) => (a.propostaId === escolhida ? -1 : b.propostaId === escolhida ? 1 : a.letra.localeCompare(b.letra)));
  const linhas: [string, (p: Comparacao["propostas"][number]) => string][] = [
    ["Total", (p) => mostrarCusto(p.total)],
    ["Frete", (p) => (p.freteIncluso ? "Incluso" : mostrarCusto(p.frete))],
    ["Marca e modelo", (p) => p.marcaModelo ?? "—"],
    ["Prazo", (p) => p.prazoExecucao],
    ["Garantia", (p) => p.garantia ?? "—"],
    ["Não inclui", (p) => p.naoInclui?.replace(/\n/g, "; ") ?? "Nada fora do pedido"],
    ["Vale até", (p) => `${ddmm(p.validaAte)}${p.vencida ? " (venceu)" : ""}${p.confirmada ? " (confirmado)" : ""}`],
    ["Pagamento", (p) => p.pagamento ?? "—"],
    ["Versões", (p) => (p.versoes > 1 ? `${p.versoes} · em uso a ${p.numero}` : "1")],
  ];
  const recusas = d.convites.filter((x) => x.estado === "RECUSOU");
  const anexos = [...d.arquivos.map((a) => a.nome), ...c.propostas.filter((p) => p.pdf).map((p) => `${p.pdf!.nome} (${p.nome})`)];
  const geradaEm = HORA.format(new Date()).replace(",", " às");

  return (
    <PreviaImpressao titulo="Planilha comparativa" apoio={`${o.titulo} · folha A4 em pé`} voltar={`/orcamentos/${o.id}`} podeImprimir={false}
      opcoes={<Botao className="max-md:w-full" onClick={() => window.print()}><Icone nome="baixar" />Baixar em PDF</Botao>}
      legenda="Como sai na impressão. No PDF, escolha “Salvar como PDF” na janela de impressão."
      nota="A planilha não sai do condomínio sozinha: vai para o conselho pela despesa, ou para onde você mandar.">
      <FolhaA4 rotulo="Planilha comparativa" className="p-[1.4cm]">
        <div className="flex flex-1 flex-col gap-5 text-[12px] leading-snug">
          <header className="flex items-start justify-between gap-4 border-b border-linha pb-3">
            <div className="grid gap-1">
              <small className="text-[10px] font-semibold tracking-[.16em] text-tinta-suave uppercase">{nome} · planilha comparativa</small>
              <h2 className="t-destaque text-[26px] leading-tight">{o.titulo}</h2>
              <p className="text-tinta-suave">
                Pedido em {diaCompleto(o.criadoEm)} · {o.convidados === 1 ? "1 convidado" : `${o.convidados} convidados`} · {o.recebidas === 1 ? "1 proposta" : `${o.recebidas} propostas`}
                {recusas.length ? ` · ${recusas.length === 1 ? "1 recusa" : `${recusas.length} recusas`}` : ""} · propostas até {diaHoraPrazo(o.prazoPropostas)}
              </p>
            </div>
            <Logo className="h-8 w-auto shrink-0" />
          </header>

          <section className="grid gap-1">
            <h3 className="text-[10px] font-semibold tracking-[.14em] text-tinta-suave uppercase">O que foi pedido</h3>
            <p className="whitespace-pre-line">{o.descricao}</p>
            {o.local ? <p className="text-tinta-suave">Local: {o.local}</p> : null}
          </section>

          <section className="grid gap-1">
            <h3 className="text-[10px] font-semibold tracking-[.14em] text-tinta-suave uppercase">As propostas</h3>
            {propostas.length ? (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-linha py-1.5 pr-2 font-semibold"> </th>
                    {propostas.map((p) => (
                      <th key={p.conviteId} scope="col" className="border-b border-linha px-2 py-1.5 align-top font-semibold">
                        {p.letra} · {p.nome}
                        {p.propostaId === escolhida ? <span className="block text-[10px] font-semibold tracking-[.1em] text-violeta-700 uppercase">Escolhida</span> : null}
                        {p.conviteId === c.menorTotal ? <span className="block text-[10px] font-normal text-tinta-suave">Menor total</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(([n, f]) => (
                    <tr key={n}>
                      <th scope="row" className="border-b border-linha py-1.5 pr-2 align-top font-medium text-tinta-suave">{n}</th>
                      {propostas.map((p) => <td key={p.conviteId} className={`border-b border-linha px-2 py-1.5 align-top ${p.propostaId === escolhida ? "bg-violeta-50" : ""}`}>{f(p)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-tinta-suave">Nenhuma proposta chegou.</p>}
            {recusas.length ? <p className="text-tinta-suave">Recusaram: {recusas.map((r) => `${r.nome}${r.recusaMotivo ? ` (${r.recusaMotivo})` : ""}`).join("; ")}.</p> : null}
          </section>

          <section className="grid gap-1">
            <h3 className="text-[10px] font-semibold tracking-[.14em] text-tinta-suave uppercase">Decisão e motivo</h3>
            {o.escolha ? (
              <p>
                Escolhida a proposta de <b className="font-semibold">{o.escolha.convite.nome}</b>, {mostrarCusto(o.escolha.total)}, por {o.escolha.escolhidaPor} em {diaCompleto(o.escolha.escolhidaEm)}.
                {o.escolha.motivo ? ` Motivo: ${o.escolha.motivo}` : " A de menor total."}
                {o.escolha.quemAprova === "CONSELHO" ? (o.escolha.aprovadaEm ? ` ${o.escolha.aprovadaTexto ?? "O conselho aprovou"} em ${diaCompleto(o.escolha.aprovadaEm)}.` : " Esperando a aprovação do conselho.") : ""}
                {o.escolha.aceiteEm ? ` O fornecedor aceitou em ${diaCompleto(o.escolha.aceiteEm)}.` : ""}
              </p>
            ) : <p className="text-tinta-suave">Ainda sem decisão.{c.minimo.pedido > 1 ? ` A regra pede ${c.minimo.pedido} propostas; chegaram ${c.minimo.recebidas}.` : ""}{c.alcadaConselho !== null ? ` Alçada do conselho: ${mostrarTotal(c.alcadaConselho, false)}.` : ""}</p>}
          </section>

          <section className="grid gap-1">
            <h3 className="text-[10px] font-semibold tracking-[.14em] text-tinta-suave uppercase">Anexos</h3>
            <p className="text-tinta-suave">{anexos.length ? anexos.join(" · ") : "Nenhum anexo."}</p>
          </section>

          <footer className="mt-auto border-t border-linha pt-3 text-[10px] text-tinta-suave">
            Gerado pela Plataforma TRÍADE em {geradaEm}. A TRÍADE não escolheu nem comprou: a decisão é do condomínio.
          </footer>
        </div>
      </FolhaA4>
    </PreviaImpressao>
  );
}
