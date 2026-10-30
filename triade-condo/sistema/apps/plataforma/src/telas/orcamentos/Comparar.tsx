"use client";
// Comparar propostas (R8, OC-04; quadros 479 e 486): o que cada uma inclui, não só o preço. As
// diferenças em relação ao que foi pedido aparecem marcadas; "Mostrar só o que é diferente"
// esconde as linhas iguais. No celular, cartões lado a lado ou só as diferenças. O sistema não
// escolhe por ninguém: só mostra a diferença. Daqui sai o Escolher esta (quadro 481).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Aviso, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, Vazio } from "@triade/ui";
import { useCelular } from "../celular.ts";
import { Escolha } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import { ddmm, faixaPorExtenso, linhaDaOrigem, ListaInclui, reais, textoValidade } from "./comum.tsx";
import { LinksMandados, temLinkParaCopiar } from "../decisoes/votacao.tsx";
import type { LinkMandado } from "../tipos.ts";
import { EscolherProposta } from "./Escolher.tsx";
import { JanelaConvites } from "./Convite.tsx";
import type { Comparacao, LinkConvite, OpcoesOrcamento, OrcamentoDetalhe, PropostaComparada } from "./tipos.ts";

type Linha = { id: string; nome: string; valor: (p: PropostaComparada) => string; mostrar?: (p: PropostaComparada) => ReactNode; sempre?: boolean };

/** As linhas da tabela, na ordem do quadro 479. O "valor" é o que se compara; o "mostrar", o que aparece. */
const LINHAS: Linha[] = [
  { id: "total", nome: "Total", valor: (p) => String(p.total), sempre: true, mostrar: (p) => <span className="grid"><span className="t-codigo font-semibold">{reais(p.total)}</span>{p.freteIncluso ? null : <span className="t-apoio">{reais(p.valor)} + frete {reais(p.frete)}</span>}</span> },
  { id: "frete", nome: "Frete", valor: (p) => (p.freteIncluso ? "Incluso" : reais(p.frete)) },
  { id: "marca", nome: "Marca e modelo", valor: (p) => p.marcaModelo ?? "—" },
  { id: "prazo", nome: "Prazo para fazer", valor: (p) => p.prazoExecucao },
  { id: "garantia", nome: "Garantia", valor: (p) => p.garantia ?? "—" },
  { id: "inclui", nome: "Inclui", valor: (p) => p.inclui, mostrar: (p) => <ListaInclui texto={p.inclui} /> },
  { id: "nao-inclui", nome: "Não inclui", valor: (p) => p.naoInclui ?? "", mostrar: (p) => (p.naoInclui ? <ListaInclui texto={p.naoInclui} tom="atencao" /> : <span className="t-apoio">Nada fora do pedido</span>) },
  { id: "vale", nome: "Preço vale até", valor: (p) => p.validaAte, sempre: true },
  { id: "pagamento", nome: "Pagamento", valor: (p) => p.pagamento ?? "—" },
  { id: "arquivos", nome: "Arquivos", valor: (p) => p.pdf?.nome ?? "—" },
  { id: "versoes", nome: "Versões", valor: (p) => String(p.versoes) },
];

/** Abre o PDF da proposta numa aba, pelo link curto. */
export async function abrirPdf(arquivoId: string): Promise<string | null> {
  const aba = window.open("about:blank", "_blank");
  const r = await chamarApi<{ url: string }>(`/v1/condominio/orcamentos/anexos/${arquivoId}/link`);
  if (!r.ok) { aba?.close(); return textoDoErro(r.erro); }
  if (aba) aba.location.href = r.dados.url;
  return null;
}

/** A nota do menor total que não inclui algo pedido (quadro 479). */
export function notaDoMenor(c: Comparacao): string | null {
  const menor = c.propostas.find((p) => p.conviteId === c.menorTotal);
  if (!menor || !menor.faltaAlgo || !menor.naoInclui) return null;
  const falta = menor.naoInclui.split("\n")[0]!.split(":")[0]!.trim();
  const completa = c.propostas.filter((p) => p !== menor && !p.faltaAlgo).sort((a, b) => a.total - b.total)[0];
  const diferenca = completa ? ` ${completa.nome} custa ${reais(completa.total - menor.total)} a mais e inclui tudo.` : "";
  return `${menor.nome} tem o menor total, mas não inclui ${falta.charAt(0).toLowerCase()}${falta.slice(1)}, que foi pedido.${diferenca} O sistema não escolhe por você: só mostra a diferença.`;
}

export function Comparar() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const celular = useCelular();
  const { atualizar } = usePlataforma();
  const ficha = useCarregar<OrcamentoDetalhe>(`/v1/condominio/orcamentos/${id}`);
  const comp = useCarregar<Comparacao>(`/v1/condominio/orcamentos/${id}/comparacao`);
  const opcoes = useCarregar<OpcoesOrcamento>("/v1/condominio/orcamentos/opcoes");
  const [soDiferente, setSoDiferente] = useState(false);
  const [escolhendo, setEscolhendo] = useState<PropostaComparada | null>(null);
  const [linkConvite, setLinkConvite] = useState<LinkConvite[] | null>(null);
  const [linksConselho, setLinksConselho] = useState<LinkMandado[] | null>(null);
  const [depoisDosLinks, setDepois] = useState<(() => void) | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<string[]>([]);
  const [falha, setFalha] = useState<string | null>(null);
  const [assimMesmo, setAssimMesmo] = useState(false);
  const [recado, setRecado] = useState<{ tom: "ok" | "atencao"; texto: string } | null>(null);

  const voltar = <Link href={`/orcamentos/${id}`} className="inline-flex items-center gap-1.5 t-apoio font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Ficha do orçamento</Link>;
  if (ficha.estado === "carregando" || comp.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Carregando as propostas…" /></div>;
  if (ficha.estado === "erro") return <div className="grid gap-4">{voltar}<ErroCarregar erro={ficha.erro} texto={ficha.texto} tentarDeNovo={ficha.recarregar} /></div>;
  if (comp.estado === "erro") return <div className="grid gap-4">{voltar}<ErroCarregar erro={comp.erro} texto={comp.texto} tentarDeNovo={comp.recarregar} /></div>;
  const o = ficha.dados.orcamento;
  const c = comp.dados;
  const propostas = c.propostas;
  const diferentes = (l: Linha) => l.sempre || new Set(propostas.map(l.valor)).size > 1;
  const linhas = soDiferente ? LINHAS.filter(diferentes) : LINHAS;
  const nota = notaDoMenor(c);
  const podeDecidir = c.pode.decidir;
  const semMinimo = !c.minimo.atendido && !assimMesmo;

  async function pedirConfirmacao(p: PropostaComparada) {
    const r = await chamarApi<{ link: LinkConvite }>(`/v1/condominio/orcamentos/${o.id}/convites/${p.conviteId}/pedir-confirmacao`, { corpo: {} });
    if (!r.ok) return setRecado({ tom: "atencao", texto: `Não deu para pedir a confirmação: ${textoDoErro(r.erro)}` });
    setRecado({ tom: "ok", texto: `Pedido de confirmação do preço mandado a ${p.nome}, pelo link. Se ele mandar outro valor, entra como versão ${p.versoes + 1}.` });
    if (r.dados.link?.envio === "COPIAR") setLinkConvite([r.dados.link]);
    comp.recarregar();
  }

  const Pilulas = ({ p }: { p: PropostaComparada }) => (
    <span className="flex flex-wrap gap-1.5">
      {p.menorTotal ? <Selo tom="ok">Menor total</Selo> : null}
      {p.vencida ? <Selo tom="atencao">Validade venceu</Selo> : null}
      {p.faltaAlgo ? <Selo tom="atencao">Falta algo pedido</Selo> : null}
      {p.confirmada ? <Selo tom="ok">Preço confirmado</Selo> : null}
    </span>
  );
  const Validade = ({ p }: { p: PropostaComparada }) => (
    <span className="grid gap-1">
      <span className={p.vencida ? "text-atencao" : ""}>{ddmm(p.validaAte)}{p.vencida ? " · venceu" : ""}</span>
      {p.vencida && !p.confirmacaoPedidaEm && (c.pode.pedirConfirmacao ?? podeDecidir) ? <Botao variante="contorno" tamanho="p" className="justify-self-start" onClick={() => void pedirConfirmacao(p)}>Pedir confirmação</Botao> : null}
      {p.vencida && p.confirmacaoPedidaEm ? <Selo tom="andamento">Pedido em {ddmm(p.confirmacaoPedidaEm)} · esperando</Selo> : null}
    </span>
  );
  const Arquivos = ({ p }: { p: PropostaComparada }) => (p.pdf ? (
    <button type="button" onClick={() => void abrirPdf(p.pdf!.id).then(setFalha)} className="inline-flex items-center gap-1.5 text-left t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="documento" className="h-4 w-4 shrink-0" />{p.pdf.nome}
    </button>
  ) : <span className="t-apoio">Sem arquivo</span>);
  const Versoes = ({ p }: { p: PropostaComparada }) => (p.anteriores.length ? (
    <span className="grid gap-1">
      <span>Versão {p.numero} · {reais(p.total)} · vale até {ddmm(p.validaAte)}</span>
      {versoes.includes(p.conviteId) ? p.anteriores.map((a) => <span key={a.numero} className="t-apoio">Versão {a.numero} · {reais(a.total)} · vale até {ddmm(a.validaAte)} · guardada</span>) : null}
      <Botao variante="discreto" tamanho="p" className="justify-self-start" aria-expanded={versoes.includes(p.conviteId)}
        onClick={() => setVersoes(versoes.includes(p.conviteId) ? versoes.filter((x) => x !== p.conviteId) : [...versoes, p.conviteId])}>
        {versoes.includes(p.conviteId) ? "Esconder as versões" : `Ver versão ${p.anteriores[p.anteriores.length - 1]!.numero}`}
      </Botao>
    </span>
  ) : <span>Versão {p.numero}</span>);
  const celula = (l: Linha, p: PropostaComparada) => l.id === "vale" ? <Validade p={p} /> : l.id === "arquivos" ? <Arquivos p={p} /> : l.id === "versoes" ? <Versoes p={p} /> : l.mostrar ? l.mostrar(p) : l.valor(p);
  const escolher = (p: PropostaComparada) => (podeDecidir ? (
    <Botao variante={p.vencida ? "contorno" : "primario"} tamanho="m" className="w-full" disabled={p.vencida && !p.confirmada} onClick={() => setEscolhendo(p)}
      aria-label={`${p.vencida && !p.confirmada ? "Confirme o preço antes" : "Escolher esta"}: ${p.nome}`}>{p.vencida && !p.confirmada ? "Confirme o preço antes" : "Escolher esta"}</Botao>
  ) : null);

  return (
    <div className="grid max-w-[1200px] gap-4">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela">Comparar propostas</h1>
          <p className="t-apoio">{o.titulo} · O que cada uma inclui, não só o preço. Diferenças em relação ao que foi pedido aparecem marcadas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/orcamentos/${o.id}/planilha`} className={classeBotao("contorno")}><Icone nome="baixar" />Baixar planilha em PDF</Link>
          {!celular ? <Botao variante={soDiferente ? "secundario" : "contorno"} aria-pressed={soDiferente} onClick={() => setSoDiferente(!soDiferente)}><Icone nome="filtro" />Mostrar só o que é diferente</Botao> : null}
        </div>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <Aviso tom="atencao">{falha}</Aviso> : null}
      {semMinimo ? (
        <Aviso tom="atencao" titulo="Ainda não chegou o mínimo da regra">
          {`Chegaram ${c.minimo.recebidas === 1 ? "1 proposta" : `${c.minimo.recebidas} propostas`}; a regra pede ${c.minimo.pedido}${faixaPorExtenso(c.regra ?? o.regra)}.`}
          <span className="mt-2 flex flex-wrap gap-2">
            <Link href={`/orcamentos/${o.id}?acao=estender`} className={classeBotao("contorno", "", "m")}>Estender o prazo</Link>
            <Link href={`/orcamentos/${o.id}?acao=convidar`} className={classeBotao("contorno", "", "m")}>Convidar mais</Link>
            <Botao variante="discreto" tamanho="m" onClick={() => setAssimMesmo(true)}>Comparar assim mesmo</Botao>
          </span>
        </Aviso>
      ) : null}
      {propostas.length === 0 ? (
        <Vazio titulo="Nenhuma proposta para comparar" icone="carrinho">Quando as propostas chegarem pelo link, elas aparecem aqui lado a lado.</Vazio>
      ) : celular ? (
        <div className="grid gap-3">
          <Escolha rotulo="Como comparar" atual={soDiferente ? "DIFERENCAS" : "LADO"} aoMudar={(v) => setSoDiferente(v === "DIFERENCAS")}
            opcoes={[{ valor: "LADO", texto: "Lado a lado" }, { valor: "DIFERENCAS", texto: "Só as diferenças" }]} />
          <ul className="grid gap-3" aria-label="Propostas">
            {propostas.map((p) => (
              <li key={p.conviteId} className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="t-texto font-medium">{p.letra} · {p.nome}</span>
                    <span className="t-apoio">{linhaDaOrigem(p)}</span>
                  </span>
                  <span className="t-codigo font-semibold">{reais(p.total)}</span>
                </div>
                <Pilulas p={p} />
                {aberta === p.conviteId ? (
                  <dl className="grid gap-2 border-t border-linha pt-2">
                    {linhas.filter((l) => l.id !== "total").map((l) => (
                      <div key={l.id} className="grid gap-0.5"><dt className="t-apoio">{l.nome}</dt><dd className="t-texto">{celula(l, p)}</dd></div>
                    ))}
                  </dl>
                ) : (
                  <dl className="grid grid-cols-3 gap-2 border-t border-linha pt-2">
                    {([["Garantia", p.garantia ?? "—"], ["Prazo", p.prazoExecucao], ["Vale até", textoValidade(p).replace(/^vale até |^venceu em /, "")]] as const)
                      .filter(([n]) => !soDiferente || LINHAS.some((l) => l.nome.startsWith(n) && diferentes(l)) || n === "Vale até")
                      .map(([n, t]) => <div key={n} className="grid gap-0.5"><dt className="t-apoio">{n}</dt><dd className="t-texto">{t}</dd></div>)}
                  </dl>
                )}
                <div className="grid gap-2">
                  {aberta === p.conviteId ? escolher(p) : null}
                  <Botao variante="discreto" tamanho="m" aria-expanded={aberta === p.conviteId} onClick={() => setAberta(aberta === p.conviteId ? null : p.conviteId)}>
                    {aberta === p.conviteId ? "Fechar" : podeDecidir ? "Ver tudo e escolher" : "Ver tudo"}
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-linha bg-superficie shadow-s1">
          <table className="w-full border-collapse text-left t-texto">
            <caption className="sr-only">Propostas lado a lado</caption>
            <thead>
              <tr className="bg-superficie-2 align-top">
                <th scope="col" className="w-40 px-4 py-3 t-rotulo">Proposta</th>
                {propostas.map((p) => (
                  <th key={p.conviteId} scope="col" className="min-w-[200px] px-4 py-3 font-normal">
                    <span className="grid gap-1">
                      <span className="t-texto font-medium">{p.letra} · {p.nome}</span>
                      <span className="t-apoio">{linhaDaOrigem(p)}</span>
                      <Pilulas p={p} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t border-linha align-top">
                  <th scope="row" className="px-4 py-3 t-apoio font-medium text-tinta-suave">{l.nome}</th>
                  {propostas.map((p) => <td key={p.conviteId} className={`px-4 py-3 ${!l.sempre && diferentes(l) ? "bg-violeta-50/40" : ""}`}>{celula(l, p)}</td>)}
                </tr>
              ))}
              {podeDecidir ? (
                <tr className="border-t border-linha">
                  <th scope="row" className="px-4 py-3 t-apoio font-medium text-tinta-suave">Decidir</th>
                  {propostas.map((p) => <td key={p.conviteId} className="px-4 py-3">{escolher(p)}</td>)}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {nota ? <Aviso tom="info">{nota}</Aviso> : null}
      {!podeDecidir && propostas.length ? <p className="t-apoio">{o.estado === "ESCOLHIDA" || o.estado === "COMPRANDO" || o.estado === "ENTREGUE" ? "A escolha já foi feita: a comparação fica guardada." : "Só quem pode decidir escolhe a proposta."}</p> : null}
      <EscolherProposta o={o} c={c} p={escolhendo} opcoes={opcoes.estado === "pronto" ? opcoes.dados : null} aoFechar={() => setEscolhendo(null)}
        escolhida={(texto, _despesa, links) => {
          setEscolhendo(null);
          atualizar();
          const ir = () => router.push(`/orcamentos/${o.id}?recado=${encodeURIComponent(texto)}`);
          if (temLinkParaCopiar(links)) { setLinksConselho(links); setDepois(() => ir); } else ir();
        }} />
      <JanelaConvites links={linkConvite} titulo={o.titulo} prazo={o.prazoPropostas} aoFechar={() => setLinkConvite(null)} />
      <LinksMandados links={linksConselho} aoFechar={() => { setLinksConselho(null); depoisDosLinks?.(); }} />
    </div>
  );
}
