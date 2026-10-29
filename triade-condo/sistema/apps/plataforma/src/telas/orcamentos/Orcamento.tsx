"use client";
// A ficha do orçamento (R8, OC-02 a OC-07; quadros 474, 475, 482 e 485): os convites, cada um com
// um link só dele; o que chegou e o que falta para comparar; os dados, a regra e o andamento. Com
// a proposta escolhida, a aba Acompanhamento diz o que falta depois da decisão: o aceite do
// fornecedor, a compra, a entrega e, se quiser, a ordem de serviço e o resumo para os moradores.
// Nada aqui contrata, recebe ou paga: a compra e a entrega são só registro.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CANAIS_CONVITE, resumoParaMoradores, textoRegraMinimo, textoSemAceite } from "@triade/domain";
import { Abas, Aviso, AvisoErro, Botao, CampoAreaTexto, CampoTexto, camposComErro, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi, type Tom } from "@triade/ui";
import { Caixa } from "../moradores/comum.tsx";
import { Cartao, Dado, MaisAcoes } from "../Ficha.tsx";
import { deDataHoraLocal, diaHora, paraDataHoraLocal } from "../pedidos/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import { ddmm, diaCompleto, diaHoraPrazo, enderecoWhatsapp, faixaPorExtenso, ICONE_ORIGEM, linhaDoTotal, ListaInclui, NOTA_RODAPE, reais, seloConvite, seloSituacao, textoValidade } from "./comum.tsx";
import { abrirPdf } from "./Comparar.tsx";
import { JanelaConvidarMais, JanelaConvites } from "./Convite.tsx";
import { enviarArquivosDoOrcamento } from "./NovoOrcamento.tsx";
import type { ConviteDoOrcamento, LinkConvite, OpcoesOrcamento, Orcamento as DadosOrcamento, OrcamentoDetalhe } from "./tipos.ts";

type Recado = { tom: Tom; texto: string } | null;
const DECIDIDO = ["ESCOLHIDA", "COMPRANDO", "ENTREGUE"];
const ABAS = [{ id: "acompanhamento", texto: "Acompanhamento" }, { id: "propostas", texto: "Propostas" }, { id: "comparacao", texto: "Comparação" }, { id: "historico", texto: "Histórico" }] as const;
type IdAba = (typeof ABAS)[number]["id"];
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** "Serviço · Casa de bombas · criado por Ana em 20/10". */
export function subtituloDaFicha(o: DadosOrcamento): string {
  return [o.tipo === "ITENS" ? "Lista de itens" : "Serviço", o.local, `criado por ${o.criadoPor.split(" ")[0]} em ${ddmm(o.criadoEm.slice(0, 10))}`].filter(Boolean).join(" · ");
}

/** "Acima de R$ 3.000: 3 propostas e o conselho aprova". */
export function textoDaRegra(r: DadosOrcamento["regra"]): string {
  if (!r.ligada || !r.faixa) return "Sem mínimo de propostas escrito nas Regras";
  const extenso = faixaPorExtenso(r).trim();
  const faixa = extenso ? `${extenso.charAt(0).toUpperCase()}${extenso.slice(1)}` : "Em qualquer valor";
  const quem = r.faixa.quemAprova === "CONSELHO" ? "o conselho aprova" : "o síndico aprova";
  return `${faixa}: ${r.faixa.minimo === 1 ? "1 proposta" : `${r.faixa.minimo} propostas`} e ${quem}`;
}

export function FichaOrcamento() {
  const { id } = useParams<{ id: string }>();
  const busca = useSearchParams();
  const router = useRouter();
  const { atualizar } = usePlataforma();
  const carga = useCarregar<OrcamentoDetalhe>(`/v1/condominio/orcamentos/${id}`);
  const opcoes = useCarregar<OpcoesOrcamento>("/v1/condominio/orcamentos/opcoes");
  const [recado, setRecado] = useState<Recado>(busca.get("recado") ? { tom: "ok", texto: busca.get("recado")! } : null);
  const [janela, setJanela] = useState<"editar" | "estender" | "fechar" | "cancelar" | "aceite" | "convidar" | "desfazer" | null>(
    busca.get("acao") === "estender" ? "estender" : busca.get("acao") === "convidar" ? "convidar" : null);
  const [revogando, setRevogando] = useState<ConviteDoOrcamento | null>(null);
  const [vendo, setVendo] = useState<ConviteDoOrcamento | null>(null);
  const [links, setLinks] = useState<LinkConvite[] | null>(null);
  const [aba, setAba] = useState<IdAba>((busca.get("aba") as IdAba) ?? "acompanhamento");
  const [tudo, setTudo] = useState(false);
  useEffect(() => { if (busca.get("recado") || busca.get("acao")) router.replace(`/orcamentos/${id}`, { scroll: false }); }, [busca, id, router]);

  const voltar = <Link href="/orcamentos" className="inline-flex items-center gap-1.5 t-apoio font-medium text-violeta-600 hover:underline"><Icone nome="esq" className="h-4 w-4" />Orçamentos</Link>;
  if (carga.estado === "carregando") return <div className="grid gap-4">{voltar}<Carregando rotulo="Carregando o orçamento…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{voltar}{carga.erro?.codigo === "NOT_FOUND" ? <Vazio titulo="Orçamento não encontrado">Abra o orçamento pela lista.</Vazio> : <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />}</div>;

  const d = carga.dados;
  const o = d.orcamento;
  const s = seloSituacao(o);
  const decidido = DECIDIDO.includes(o.estado);
  const depois = (texto: string, tom: Tom = "ok") => { setRecado({ tom, texto }); setJanela(null); carga.recarregar(); atualizar(); };
  const o_ = opcoes.estado === "pronto" ? opcoes.dados : null;
  const escolhido = d.convites.find((c) => c.escolhido) ?? null;
  const arquivosDoPedido = d.arquivos.filter((a) => a.parte !== "NOTA_FISCAL");

  async function reenviar(c: ConviteDoOrcamento) {
    const r = await chamarApi<{ link: LinkConvite }>(`/v1/condominio/orcamentos/${o.id}/convites/${c.id}/reenviar`, { corpo: {} });
    if (!r.ok) return depois(`Não deu para mandar o link novo: ${textoDoErro(r.erro)}`, "atencao");
    depois(`Link novo de ${c.nome} pronto. O anterior parou na hora.`);
    if (r.dados.link.envio === "COPIAR" || r.dados.link.envio === "EMAIL") setLinks([r.dados.link]);
  }
  async function pedirConfirmacao(c: ConviteDoOrcamento) {
    const r = await chamarApi<{ link: LinkConvite }>(`/v1/condominio/orcamentos/${o.id}/convites/${c.id}/pedir-confirmacao`, { corpo: {} });
    if (!r.ok) return depois(`Não deu para pedir a confirmação: ${textoDoErro(r.erro)}`, "atencao");
    depois(`Pedido de confirmação do preço mandado a ${c.nome}, pelo link. Se ele mandar outro valor, entra como versão ${c.versoes + 1}.`);
    if (r.dados.link?.envio === "COPIAR") setLinks([r.dados.link]);
  }
  async function mandar() {
    const r = await chamarApi<{ versao: number; estado: string; links: LinkConvite[] }>(`/v1/condominio/orcamentos/${o.id}/mandar`, { corpo: { versao: o.versao } });
    if (!r.ok) return depois(`Não deu para mandar os convites: ${textoDoErro(r.erro)}`, "atencao");
    depois(r.dados.links.length === 1 ? "1 convite mandado." : `${r.dados.links.length} convites mandados.`);
    if (r.dados.links.length) setLinks(r.dados.links);
  }
  async function desfazer() {
    const r = await chamarApi(`/v1/condominio/orcamentos/${o.id}/desfazer-escolha`, { corpo: { versao: o.versao } });
    if (!r.ok) return depois(`Não deu para desfazer a escolha: ${textoDoErro(r.erro)}`, "atencao");
    atualizar();
    router.push(`/orcamentos/${o.id}/comparar?recado=${encodeURIComponent("Escolha desfeita. As propostas continuam aqui para comparar de novo.")}`);
  }

  const acoes = [
    ...(d.pode.editar ? [{ texto: "Editar o que precisa", icone: "editar" as const, acao: () => setJanela("editar") }] : []),
    ...(d.pode.estender ? [{ texto: "Estender o prazo", icone: "relogio" as const, acao: () => setJanela("estender") }] : []),
    ...(d.pode.fechar ? [{ texto: "Fechar antes do prazo", icone: "check" as const, acao: () => setJanela("fechar") }] : []),
    ...(d.pode.aceiteFora ? [{ texto: "Registrar aceite fora do link", icone: "telefone" as const, acao: () => setJanela("aceite") }] : []),
    ...(d.pode.desfazerEscolha ? [{ texto: "Desfazer a escolha", icone: "retorno" as const, acao: () => setJanela("desfazer") }] : []),
    ...(o.recebidas > 0 ? [{ texto: "Abrir a planilha", icone: "imprimir" as const, acao: () => router.push(`/orcamentos/${o.id}/planilha`) }] : []),
    ...(d.pode.cancelar ? [{ texto: "Cancelar o orçamento", icone: "fechar" as const, acao: () => setJanela("cancelar"), perigo: true }] : []),
  ];
  const semAceite = o.escolha?.semAceiteHaDias !== null && o.escolha?.semAceiteHaDias !== undefined ? textoSemAceite(o.escolha.semAceiteHaDias) : null;
  const lembrar = escolhido && o.escolha ? enderecoWhatsapp(`Olá, ${escolhido.nome}. A proposta de vocês para ${o.titulo.charAt(0).toLowerCase()}${o.titulo.slice(1)} (${reais(o.escolha.total)}) foi a escolhida pelo condomínio. Pode confirmar pelo link que mandamos? Obrigado.`) : null;

  const convites = (
    <Cartao id="t-convites" titulo="Convites" icone="pessoas"
      acao={d.pode.convidar ? <Botao variante="contorno" tamanho="m" onClick={() => setJanela("convidar")}><Icone nome="mais" />Convidar mais</Botao> : undefined}>
      <p className="t-apoio">{o.convidados === 1 ? "1 convidado" : `${o.convidados} convidados`} · cada um com um link só dele</p>
      {d.convites.length ? (
        <ul className="grid divide-y divide-linha" aria-label="Convidados">
          {d.convites.map((c) => {
            const sc = seloConvite(c);
            const p = c.propostaEmUso;
            return (
              <li key={c.id} className="grid gap-2 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="ladrilho h-8 w-8 rounded-[10px] t-apoio font-semibold" data-tom={c.escolhido ? "ok" : c.estado === "REVOGADO" || c.estado === "RECUSOU" ? "neutro" : "violeta"} aria-hidden="true">{c.letra}</span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="t-texto font-medium">{c.nome}</span>
                    <span className="t-apoio">{[c.origem === "PRESTADOR" ? "Prestador" : "Só pelo link", CANAIS_CONVITE[c.canal], c.contatoMascarado, c.aberturas ? `abriu ${c.aberturas === 1 ? "1 vez" : `${c.aberturas} vezes`}` : "ainda não abriu"].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5"><Selo tom={sc.tom}>{sc.texto}</Selo>{p?.vencida ? <Selo tom="atencao">Validade venceu em {ddmm(p.validaAte)}</Selo> : null}</span>
                </div>
                <div className="grid gap-2 md:pl-11">
                  {p ? <p className="t-texto">{linhaDoTotal(p)} · {textoValidade(p)}{p.vencida && p.confirmacaoPedidaEm ? <> · <Selo tom="andamento">Pedido em {ddmm(p.confirmacaoPedidaEm)} · esperando</Selo></> : null}</p> : null}
                  {p?.vencida && !p.confirmacaoPedidaEm && !decidido ? <p className="t-apoio">Para escolher esta, o fornecedor precisa confirmar o preço pelo link. Se ele mandar outro valor, entra como versão {c.versoes + 1}.</p> : null}
                  {c.estado === "RECUSOU" ? <p className="t-texto">Recusou{c.recusaMotivo ? `: ${c.recusaMotivo}` : ""}{c.recusouEm ? ` · ${ddmm(c.recusouEm.slice(0, 10))}` : ""}<span className="block t-apoio">Ele não recebe lembretes. A recusa conta como resposta, mas não como proposta para o mínimo.</span></p> : null}
                  {c.estado === "REVOGADO" ? <p className="t-apoio">O link parou na hora{c.revogado ? ` (${ddmm(c.revogado.em.slice(0, 10))}: ${c.revogado.motivo})` : ""}. {p ? "A proposta que já tinha chegado continua guardada e marcada “link revogado”." : "Nenhuma proposta tinha chegado."}{d.pode.convidar ? " Para chamar de novo, use Convidar mais: sai um convite novo." : ""}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {p ? <Botao variante="contorno" tamanho="m" onClick={() => setVendo(c)} aria-label={`Ver proposta de ${c.nome}`}><Icone nome="olho" />Ver proposta</Botao> : null}
                    {p?.vencida && !p.confirmacaoPedidaEm && d.pode.convidar && !decidido ? <Botao variante="secundario" tamanho="m" onClick={() => void pedirConfirmacao(c)} aria-label={`Pedir confirmação do preço a ${c.nome}`}>Pedir confirmação do preço</Botao> : null}
                    {c.estado !== "REVOGADO" && c.estado !== "RECUSOU" && (o.estado === "PEDINDO" ? d.pode.convidar && !c.escolhido : o.estado === "ESCOLHIDA" && c.escolhido && d.pode.aceiteFora) ? <Botao variante="discreto" tamanho="m" onClick={() => void reenviar(c)} aria-label={`Reenviar link para ${c.nome}`}><Icone nome="link" />Reenviar link</Botao> : null}
                    {c.estado !== "REVOGADO" && c.estado !== "RECUSOU" && d.pode.convidar && !c.escolhido ? <Botao variante="discreto" tamanho="m" onClick={() => setRevogando(c)} aria-label={`Revogar link de ${c.nome}`}><Icone nome="fechar" />Revogar link</Botao> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="t-apoio">Ninguém convidado ainda. O orçamento só começa quando os convites saem.</p>}
      {d.pode.mandar ? (
        <div className="grid gap-1 border-t border-linha pt-3">
          <p className="t-apoio">Guardado sem mandar. Os convites saem quando você mandar; cada convidado recebe um link só dele.</p>
          <Botao className="justify-self-start" onClick={() => void mandar()}><Icone nome="enviar" />Mandar os convites</Botao>
        </div>
      ) : null}
    </Cartao>
  );

  const resumo = !decidido && o.estado !== "CANCELADO" && o.estado !== "RASCUNHO" ? (
    <section aria-label="Propostas recebidas" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      {d.pode.comparar && o.regra.minimoAtendido ? (
        <>
          <h2 className="t-titulo-cartao">{o.recebidas === 1 ? "1 proposta para comparar" : `${o.recebidas} propostas para comparar`}</h2>
          <p className="t-apoio">{o.regra.ligada && o.regra.faixa ? `Mínimo da regra: ${o.regra.minimo} · ` : ""}{o.prazoFechou ? `todas chegaram antes de ${diaHoraCurtaDe(o.prazoPropostas)}` : `o prazo vai até ${diaHoraCurtaDe(o.prazoPropostas)}; dá para comparar o que já chegou`}</p>
          <Link href={`/orcamentos/${o.id}/comparar`} className={classeBotao("primario", "justify-self-start")}><Icone nome="lista" />Comparar propostas</Link>
        </>
      ) : d.pode.comparar ? (
        <>
          <h2 className="t-titulo-cartao">Ainda não chegou o mínimo da regra</h2>
          <p className="t-texto">Chegaram {o.recebidas === 1 ? "1 proposta" : `${o.recebidas} propostas`}; a regra pede {o.regra.minimo}{faixaPorExtenso(o.regra)}.</p>
          <div className="flex flex-wrap gap-2">
            {d.pode.estender ? <Botao variante="contorno" onClick={() => setJanela("estender")}>Estender o prazo</Botao> : null}
            {d.pode.convidar ? <Botao variante="contorno" onClick={() => setJanela("convidar")}>Convidar mais</Botao> : null}
            <Link href={`/orcamentos/${o.id}/comparar`} className={classeBotao("discreto")}>Comparar assim mesmo</Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="t-titulo-cartao">{o.recebidas ? `${o.recebidas === 1 ? "1 proposta chegou" : `${o.recebidas} propostas chegaram`}` : "Nenhuma proposta ainda"}</h2>
          <p className="t-apoio">{o.prazoFechou ? "O prazo fechou sem proposta. Estenda o prazo ou convide mais." : `Esperando as propostas até ${diaHoraPrazo(o.prazoPropostas)}. Depois disso o link fecha sozinho.`}</p>
          {d.pode.fechar && o.recebidas ? <Botao variante="contorno" className="justify-self-start" onClick={() => setJanela("fechar")}>Fechar antes do prazo e comparar</Botao> : null}
        </>
      )}
    </section>
  ) : null;

  const dados = (
    <Cartao id="t-dados" titulo="Dados" icone="info">
      <div className="grid">
        <Dado icone="relogio" nome="Situação">{s.texto}</Dado>
        <Dado icone="pessoa" nome="Quem cuida">{o.cuidador.nome}</Dado>
        <Dado icone={o.origem ? ICONE_ORIGEM[o.origem.tipo] ?? "editar" : "editar"} nome="Nasceu de">
          {o.origem?.tipo === "MANUTENCAO" && o.origem.id ? <Link href={`/manutencao/manutencao?id=${o.origem.id}`} className="font-medium text-violeta-600 hover:underline">{o.origem.texto}</Link>
            : o.origem?.tipo === "PEDIDO" && o.origem.id ? <Link href={`/pedidos/pedido?id=${o.origem.id}`} className="font-medium text-violeta-600 hover:underline">{o.origem.texto}</Link>
              : o.origem?.texto ?? "Escrito à mão"}
        </Dado>
        <Dado icone="calendario" nome="Propostas até">{diaHoraPrazo(o.prazoPropostas)}{o.prazoFechou ? " · fechado" : ""}</Dado>
        <Dado icone="escudo" nome="Regra">{textoDaRegra(o.regra)}</Dado>
        {o.valorEstimado !== null ? <Dado icone="dinheiro" nome="Valor estimado">{reais(o.valorEstimado)}</Dado> : null}
      </div>
      {!decidido && o.regra.ligada ? <p className="t-apoio">{textoRegraMinimo({ ligada: o.regra.ligada, faixa: o.regra.faixa ? { ate: o.regra.faixa.ate ?? null, minimo: o.regra.faixa.minimo } : null, anterior: o.regra.anterior ?? null }, o.convidados)}</p> : null}
    </Cartao>
  );

  const pedido = (
    <Cartao id="t-pedido" titulo="O que foi pedido" icone="documento">
      <p className="t-texto whitespace-pre-line">{o.descricao}</p>
      {o.editadoEm ? <p className="t-apoio">Alterado em {diaHora(o.editadoEm)}. Quem já respondeu foi avisado no link.</p> : null}
      {arquivosDoPedido.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Arquivos para o fornecedor">
          {arquivosDoPedido.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => void abrirPdf(a.id).then((f) => (f ? setRecado({ tom: "atencao", texto: f }) : null))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-linha px-3 py-1.5 t-apoio font-medium text-violeta-600 hover:underline">
                <Icone nome={a.tipo.startsWith("image/") ? "camera" : "documento"} className="h-4 w-4" />{a.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio">Sem fotos nem arquivos. Só o que estiver aqui vai para o link.</p>}
    </Cartao>
  );

  const historico = (completo: boolean) => (
    <Cartao id="t-andamento" titulo={completo ? "Histórico" : "Andamento"} icone="lista">
      {d.historico.length ? (
        <ul className="grid" aria-label={completo || tudo ? "Histórico completo" : "Andamento"}>
          {(completo || tudo ? d.historico : d.historico.slice(0, 4)).map((h, i) => (
            <li key={i} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-linha py-2 first:border-t-0 max-md:grid-cols-1 max-md:gap-0.5">
              <span className="t-codigo text-tinta-suave">{diaHora(h.em)}</span>
              <span className="t-texto">{h.texto}</span>
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio">Nada ainda.</p>}
      {!completo && d.historico.length > 4 && !tudo ? <Botao variante="discreto" tamanho="m" className="justify-self-start" onClick={() => setTudo(true)}>Ver histórico completo</Botao> : null}
    </Cartao>
  );

  return (
    <div className="grid max-w-[1200px] gap-4">
      {voltar}
      <div className="flex flex-wrap items-start gap-3">
        <span className="ladrilho" data-tom={s.tom === "ok" ? "ok" : s.tom === "atencao" ? "atencao" : "violeta"} aria-hidden="true"><Icone nome="carrinho" /></span>
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="t-titulo-ficha">{o.titulo}</h1>
          <p className="t-apoio">{decidido ? `Decidido · o que falta depois da decisão · ${subtituloDaFicha(o)}` : subtituloDaFicha(o)}</p>
        </div>
        <span className="flex items-center gap-2">
          <Selo tom={s.tom}>{s.texto}</Selo>
          <MaisAcoes itens={acoes} />
        </span>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {o.cancelado ? (
        <Aviso tom="neutro" titulo={`Cancelado em ${diaCompleto(o.cancelado.em)}`}>
          {o.cancelado.motivo}. Nada é apagado: as propostas, as versões e o histórico ficam em Cancelados, e os fornecedores são avisados no link.
        </Aviso>
      ) : null}
      {o.recusa && o.estado === "COMPARANDO" ? (
        <Aviso tom="atencao" titulo={o.recusa.estado === "RECUSADA" ? "O conselho recusou a escolha" : "A despesa da escolha foi retirada"}>
          {o.recusa.justificativa ? `${o.recusa.justificativa}. ` : ""}As propostas voltaram para a comparação: escolha de novo, com o motivo.
        </Aviso>
      ) : null}
      {semAceite && o.escolha ? (
        <Aviso tom="atencao" titulo="Sem aceite do fornecedor">
          {semAceite}
          <span className="mt-2 flex flex-wrap gap-2">
            {lembrar ? <a href={lembrar} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "", "m")}><Icone nome="whats" />Lembrar pelo WhatsApp</a> : null}
            {d.pode.aceiteFora ? <Botao variante="contorno" tamanho="m" onClick={() => setJanela("aceite")}>Registrar aceite fora do link</Botao> : null}
            {d.pode.desfazerEscolha ? <Botao variante="discreto" tamanho="m" onClick={() => setJanela("desfazer")}>Escolher outra proposta</Botao> : null}
          </span>
        </Aviso>
      ) : null}

      {decidido ? (
        <Abas abas={ABAS} atual={aba} rotulo="Partes do orçamento" aoMudar={setAba}>
          <div className="grid gap-4 pt-4">
            {aba === "acompanhamento" ? <Acompanhamento d={d} depois={depois} abrir={setJanela} lembrar={lembrar} /> : null}
            {aba === "propostas" ? <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">{convites}<div className="grid gap-5">{pedido}{dados}</div></div> : null}
            {aba === "comparacao" ? (
              <section aria-label="Comparação" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
                <h2 className="t-titulo-cartao">A comparação fica guardada</h2>
                <p className="t-texto">{o.recebidas === 1 ? "1 proposta comparada" : `${o.recebidas} propostas comparadas`}{o.escolha ? ` · escolhida a de ${o.escolha.convite.nome} (${reais(o.escolha.total)})` : ""}.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/orcamentos/${o.id}/comparar`} className={classeBotao("contorno")}><Icone nome="lista" />Ver a comparação</Link>
                  <Link href={`/orcamentos/${o.id}/planilha`} className={classeBotao("contorno")}><Icone nome="imprimir" />Abrir a planilha</Link>
                </div>
              </section>
            ) : null}
            {aba === "historico" ? historico(true) : null}
          </div>
        </Abas>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="grid gap-5">{resumo}{convites}{pedido}</div>
          <div className="grid gap-5">{dados}{historico(false)}</div>
        </div>
      )}
      <p className="t-apoio">{NOTA_RODAPE}</p>

      <JanelaConvidarMais aberto={janela === "convidar"} orcamentoId={o.id} o={o_} jaConvidados={d.convites.filter((c) => c.estado !== "REVOGADO").map((c) => c.prestadorId).filter((x): x is string => !!x)}
        prazoFechado={o.estado === "COMPARANDO" ? () => setJanela("estender") : undefined}
        aoFechar={() => setJanela((j) => (j === "convidar" ? null : j))} convidados={(l, n) => {
          if (o.estado === "RASCUNHO") return depois(n === 1 ? "1 convidado guardado. O convite sai quando você mandar." : `${n} convidados guardados. Os convites saem quando você mandar.`);
          depois(l.length === 1 ? "1 convite mandado." : `${l.length} convites mandados.`); if (l.some((x) => x.envio === "COPIAR" || x.envio === "EMAIL")) setLinks(l);
        }} />
      <JanelaConvites links={links} titulo={o.titulo} prazo={o.prazoPropostas} aoFechar={() => setLinks(null)} />
      <JanelaEditar o={o} aberto={janela === "editar"} aoFechar={() => setJanela(null)} salvo={depois} recarregar={carga.recarregar} />
      <JanelaEstender o={o} aberto={janela === "estender"} aoFechar={() => setJanela(null)} salvo={depois} />
      <JanelaMotivo aberto={janela === "cancelar"} titulo="Cancelar o orçamento" apoio="Nada é apagado" rotulo="Por que cancelar" textoBotao="Cancelar o orçamento" perigo
        texto="As propostas, as versões e o histórico ficam em Cancelados, e os fornecedores são avisados no link."
        enviar={(motivo) => chamarApi(`/v1/condominio/orcamentos/${o.id}/cancelar`, { corpo: { versao: o.versao, motivo } })} aoFechar={() => setJanela(null)} salvo={() => depois("Orçamento cancelado. Os fornecedores são avisados no link.", "neutro")} />
      <JanelaMotivo aberto={revogando !== null} titulo="Revogar um link" apoio={revogando ? `O link de ${revogando.nome}` : undefined} rotulo="Por que revogar" textoBotao="Revogar o link" perigo
        texto="O link para na hora. A proposta que já tinha chegado continua guardada e marcada “link revogado”. Você pode mandar um link novo depois."
        enviar={(motivo) => chamarApi(`/v1/condominio/orcamentos/${o.id}/convites/${revogando?.id}/revogar`, { corpo: { motivo } })} aoFechar={() => setRevogando(null)}
        salvo={() => { const n = revogando?.nome; setRevogando(null); depois(`Link de ${n} revogado. Ele parou na hora.`); }} />
      <JanelaConfirmar aberto={janela === "fechar"} titulo="Fechar antes do prazo" texto={`O link fecha agora para todos os convidados, com ${o.recebidas === 1 ? "1 proposta" : `${o.recebidas} propostas`}. Quem não mandou não manda mais, a não ser que você estenda o prazo.`}
        textoBotao="Fechar e comparar" enviar={() => chamarApi(`/v1/condominio/orcamentos/${o.id}/fechar`, { corpo: { versao: o.versao } })} aoFechar={() => setJanela(null)} salvo={() => depois("Prazo fechado. Agora é comparar.")} />
      <JanelaConfirmar aberto={janela === "desfazer"} titulo="Desfazer a escolha" texto="A proposta deixa de ser a escolhida e todas voltam para a comparação. O fornecedor é avisado no link. Vale só enquanto ele não aceitou e o conselho não aprovou."
        textoBotao="Desfazer e comparar de novo" enviar={async () => { await desfazer(); return { ok: true as const, dados: {} }; }} aoFechar={() => setJanela(null)} salvo={() => setJanela(null)} />
      <JanelaAceiteFora o={o} aberto={janela === "aceite"} aoFechar={() => setJanela(null)} salvo={depois} />
      <JanelaProposta c={vendo} aoFechar={() => setVendo(null)} />
    </div>
  );
}

const diaHoraCurtaDe = (iso: string) => diaHoraPrazo(iso).replace(/\/\d{4},/, ",");

/** Acompanhamento (quadro 482): as cinco etapas depois da decisão e o resumo para os moradores. */
function Acompanhamento({ d, depois, abrir, lembrar }: { d: OrcamentoDetalhe; depois: (t: string, tom?: Tom) => void; abrir: (j: "aceite" | "desfazer") => void; lembrar: string | null }) {
  const o = d.orcamento;
  const e = o.escolha;
  const router = useRouter();
  if (!e) return <p className="t-apoio">Sem escolha registrada.</p>;
  const aprovada = !!e.aprovadaEm;
  const aceitou = !!e.aceiteEm;
  const prestadorId = d.convites.find((c) => c.id === e.convite.id)?.prestadorId ?? null;
  const ordem = `/manutencao?nova=1&titulo=${encodeURIComponent(o.titulo)}&local=${encodeURIComponent(o.local ?? "")}&prestador=${encodeURIComponent(prestadorId ?? "")}`;
  const resumo = resumoParaMoradores({ titulo: o.titulo, propostas: o.recebidas, fornecedor: e.convite.nome, total: e.total, motivo: e.motivo, aprovadoPeloConselhoEm: e.quemAprova === "CONSELHO" && e.aprovadaEm ? e.aprovadaEm.slice(0, 10) : null });
  const comunicado = `/comunicados/escrever?titulo=${encodeURIComponent(o.titulo)}&texto=${encodeURIComponent(resumo)}`;
  const etapa = (n: number, titulo: string, estado: "Feito" | "Agora" | "Depois" | "Opcional", children: ReactNode) => (
    <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-t border-linha py-4 first:border-t-0">
      <span className="ladrilho h-8 w-8 rounded-[10px] t-apoio font-semibold" data-tom={estado === "Feito" ? "ok" : estado === "Agora" ? "violeta" : "neutro"} aria-hidden="true">{estado === "Feito" ? <Icone nome="check" className="h-4 w-4" /> : n}</span>
      <div className="grid gap-2">
        <span className="flex flex-wrap items-center gap-2"><h3 className="t-texto font-medium">{titulo}</h3><Selo tom={estado === "Feito" ? "ok" : estado === "Agora" ? "andamento" : "neutro"}>{estado}</Selo></span>
        {children}
      </div>
    </li>
  );
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <section aria-label="Etapas depois da decisão" className="grid rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        <ol className="grid">
          {etapa(1, "Escolhida e aprovada", aprovada ? "Feito" : "Agora", (
            <p className="t-texto">
              {e.convite.nome} · {reais(e.total)} · escolhida por {e.escolhidaPor.split(" ")[0]} em {ddmm(e.escolhidaEm.slice(0, 10))}
              {e.quemAprova === "CONSELHO" ? (aprovada ? <span className="block t-apoio">{e.despesaJustificativa ?? "O conselho aprovou"}</span>
                : <span className="block t-apoio">Esperando o conselho{e.despesaId ? <> · <Link href={`/decisoes/despesa?id=${e.despesaId}`} className="font-medium text-violeta-600 hover:underline">ver a despesa em Decisões</Link></> : null}</span>)
                : <span className="block t-apoio">Escolha sem o conselho: a alçada só avisa</span>}
              {e.motivo ? <span className="block t-apoio">Por quê: {e.motivo}</span> : null}
            </p>
          ))}
          {etapa(2, "O fornecedor aceitou", aceitou ? "Feito" : aprovada ? "Agora" : "Depois", aceitou ? (
            <p className="t-texto">{e.aceiteNome ?? e.convite.nome} aceitou {e.aceiteForaDoLink ? "fora do link (registrado por você)" : "pelo link"} em {ddmm(e.aceiteEm!.slice(0, 10))}. Aceitar não é contrato nem pagamento.</p>
          ) : (
            <div className="grid gap-2">
              <p className="t-texto">Esperando o aceite pelo link. {e.semAceiteHaDias ? `Faz ${e.semAceiteHaDias === 1 ? "1 dia" : `${e.semAceiteHaDias} dias`}.` : ""}</p>
              <div className="flex flex-wrap gap-2">
                {lembrar ? <a href={lembrar} target="_blank" rel="noopener noreferrer" className={classeBotao("contorno", "", "m")}><Icone nome="whats" />Lembrar pelo WhatsApp</a> : null}
                {d.pode.aceiteFora ? <Botao variante="contorno" tamanho="m" onClick={() => abrir("aceite")}>Registrar aceite fora do link</Botao> : null}
              </div>
            </div>
          ))}
          {etapa(3, "Registrar a compra", o.compra ? "Feito" : d.pode.registrarCompra ? "Agora" : "Depois", o.compra ? (
            <p className="t-texto">Comprada em {diaCompleto(o.compra.compradaEm)} · {reais(o.compra.valorFechado)}{o.compra.valorFechado !== e.total ? ` (a proposta era ${reais(e.total)})` : " · igual à proposta"}
              <span className="block t-apoio">Nota fiscal: {o.compra.notaFiscal ? o.compra.notaFiscal.nome : "anexar quando chegar"}</span>
              {!o.compra.notaFiscal && d.pode.anexar ? <AnexarNotaFiscal orcamentoId={o.id} salvo={depois} /> : null}
              {prestadorId ? <Link href={ordem} className={classeBotao("contorno", "mt-2 justify-self-start", "m")}><Icone nome="ferramenta" />Criar ordem de serviço</Link> : null}
            </p>
          ) : d.pode.registrarCompra ? <FormCompra d={d} ordem={prestadorId ? ordem : null} salvo={(t, criarOrdem) => { depois(t); if (criarOrdem) router.push(ordem); }} /> : <p className="t-apoio">Depois do aceite do fornecedor.</p>)}
          {etapa(4, "Entrega e execução", o.entrega && !o.entrega.parcial ? "Feito" : d.pode.registrarEntrega ? "Agora" : "Depois", (
            <div className="grid gap-2">
              {o.entrega ? <p className="t-texto">{o.entrega.parcial ? "Recebido em parte" : "Recebido inteiro"} em {diaCompleto(o.entrega.entregueEm)}{o.entrega.observacao ? ` · ${o.entrega.observacao}` : ""}</p> : null}
              <p className="t-apoio">Recebido inteiro ou em parte, com foto e a nota fiscal. Se veio de uma manutenção, a conclusão dela continua sendo lá.</p>
              {d.pode.registrarEntrega ? <FormEntrega key={o.versao} d={d} salvo={depois} /> : null}
            </div>
          ))}
          {etapa(5, "Contrato com o prestador (se houver)", "Opcional", (
            <p className="t-apoio">{prestadorId ? <>Fica na ficha do prestador, em Manutenção: <Link href={`/manutencao/prestador?id=${prestadorId}`} className="font-medium text-violeta-600 hover:underline">{e.convite.nome}</Link>.</> : `${e.convite.nome} vira prestador do cadastro quando aceita pelo link; o contrato fica na ficha dele.`}</p>
          ))}
        </ol>
      </section>
      <div className="grid gap-5">
        <Cartao id="t-decisao" titulo="Decisão" icone="decisao">
          <div className="grid">
            <Dado icone="relogio" nome="Situação">{o.situacao}</Dado>
            <Dado icone="check" nome="Escolhida">{e.convite.nome} · {reais(e.total)}</Dado>
            <Dado icone="documento" nome="Por quê">{e.motivo ?? "A de menor total: sem motivo escrito"}</Dado>
            <Dado icone="imprimir" nome="Planilha"><Link href={`/orcamentos/${o.id}/planilha`} className="font-medium text-violeta-600 hover:underline">Abrir a planilha comparativa</Link></Dado>
          </div>
        </Cartao>
        <Cartao id="t-resumo-moradores" titulo="Resumo para os moradores" icone="megafone">
          <p className="t-apoio">Sai só quando você autoriza, pelo mural e pelo WhatsApp do condomínio.</p>
          <p className="t-texto rounded-[14px] border border-linha bg-fundo p-3">{resumo}</p>
          <p className="t-apoio">Não mostra o nome nem o preço de quem não foi escolhido.</p>
          <Link href={comunicado} className={classeBotao("secundario", "justify-self-start")}><Icone nome="editar" />Revisar e autorizar</Link>
          <p className="t-apoio">Também entra no “Por que fizemos” do relatório do mês.</p>
        </Cartao>
      </div>
    </div>
  );
}

function FormCompra({ d, ordem, salvo }: { d: OrcamentoDetalhe; ordem: string | null; salvo: (t: string, criarOrdem: boolean) => void }) {
  const o = d.orcamento;
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState(reais(o.escolha!.total).replace(/^R\$\s?/, ""));
  const [criarOrdem, setCriarOrdem] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [valorErrado, setValorErrado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const centavos = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100);
    if (!centavos || centavos <= 0) { setValorErrado(true); return; }
    setValorErrado(false);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/orcamentos/${o.id}/compra`, { corpo: { versao: o.versao, data, valorFechado: centavos } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(`Compra registrada em ${diaCompleto(data)}.${criarOrdem ? " Agora a ordem de serviço." : ""}`, criarOrdem);
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3" aria-label="Registrar a compra">
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto id="compra-data" rotulo="Data da compra" required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} erro={comErro.includes("data") ? "Confira a data: de hoje para trás." : null} />
        <CampoTexto id="compra-valor" rotulo="Valor fechado" required inputMode="decimal" maxLength={20} value={valor} onChange={(e) => setValor(e.target.value)} ajuda="Igual à proposta" erro={valorErrado || comErro.includes("valorFechado") ? "Escreva o valor em reais, como 6.480,00." : null} />
      </div>
      <p className="t-apoio">Nota fiscal (quando chegar): anexar depois, aqui mesmo.</p>
      {ordem ? <Caixa id="compra-ordem" rotulo={`Criar a ordem de serviço na Manutenção para ${o.escolha!.convite.nome}, com o link do prestador`} marcada={criarOrdem} aoMudar={setCriarOrdem} /> : null}
      <Botao type="submit" className="justify-self-start" disabled={enviando}><Icone nome="check" />{enviando ? "Registrando…" : "Registrar a compra"}</Botao>
    </form>
  );
}

function FormEntrega({ d, salvo }: { d: OrcamentoDetalhe; salvo: (t: string) => void }) {
  const o = d.orcamento;
  const [data, setData] = useState(hoje());
  const [parcial, setParcial] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/orcamentos/${o.id}/entrega`, { corpo: { versao: o.versao, data, parcial, observacao: observacao.trim() || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(parcial ? `Entrega parcial registrada em ${diaCompleto(data)}. Registre a entrega do resto quando chegar.` : `Entrega registrada em ${diaCompleto(data)}. O orçamento está encerrado.`);
  }
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3" aria-label="Registrar a entrega">
      {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      <CampoTexto id="entrega-data" rotulo="Data da entrega" required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} className="sm:max-w-[240px]" erro={comErro.includes("data") ? "Confira a data: de hoje para trás." : null} />
      <Caixa id="entrega-parcial" rotulo="Recebido em parte" ajuda="Marque quando ainda falta alguma coisa; a entrega do resto entra depois." marcada={parcial} aoMudar={setParcial} />
      <CampoAreaTexto id="entrega-obs" rotulo="Observação" opcional rows={2} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      <Botao type="submit" className="justify-self-start" disabled={enviando}><Icone nome="check" />{enviando ? "Registrando…" : "Registrar a entrega"}</Botao>
    </form>
  );
}

function JanelaEditar({ o, aberto, aoFechar, salvo, recarregar }: { o: DadosOrcamento; aberto: boolean; aoFechar: () => void; salvo: (t: string) => void; recarregar: () => void }) {
  const [titulo, setTitulo] = useState(o.titulo);
  const [descricao, setDescricao] = useState(o.descricao);
  const [local, setLocal] = useState(o.local ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/orcamentos/${o.id}`, { metodo: "PUT", corpo: { versao: o.versao, titulo: titulo.trim(), descricao: descricao.trim(), local: local.trim() || null, valorEstimado: o.valorEstimado } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(o.recebidas ? "O pedido foi alterado. Quem já respondeu foi avisado no link e pode mandar uma versão nova." : "O pedido foi alterado.");
  }
  return (
    <Dialogo aberto={aberto} titulo="Editar o que precisa" aoFechar={aoFechar} media apoio="Quem já respondeu é avisado no link">
      <form onSubmit={enviar} noValidate className="grid gap-4">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
        <CampoTexto id="editar-titulo" rotulo="O que é" required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} erro={comErro.includes("titulo") ? "Diga o que é (3 a 120 caracteres)." : null} />
        <CampoAreaTexto id="editar-descricao" rotulo="O que precisa estar na proposta" required rows={4} maxLength={2000} value={descricao} onChange={(e) => setDescricao(e.target.value)} erro={comErro.includes("descricao") ? "Diga o que precisa (3 a 2.000 caracteres)." : null} />
        <CampoTexto id="editar-local" rotulo="Local" opcional maxLength={120} value={local} onChange={(e) => setLocal(e.target.value)} />
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : "Salvar"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaEstender({ o, aberto, aoFechar, salvo }: { o: DadosOrcamento; aberto: boolean; aoFechar: () => void; salvo: (t: string) => void }) {
  // Já vem com mais 7 dias a partir de hoje ou do prazo atual, o que for mais tarde.
  const [prazo, setPrazo] = useState(paraDataHoraLocal(new Date(Math.max(Date.parse(o.prazoPropostas), new Date().getTime()) + 7 * 86_400_000).toISOString()));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const iso = deDataHoraLocal(prazo);
    if (!iso) return setErro({ codigo: "VALIDATION_ERROR", detalhes: { campos: ["prazoPropostas"] } });
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/orcamentos/${o.id}/estender`, { corpo: { versao: o.versao, prazoPropostas: iso } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(`Prazo estendido até ${diaHoraPrazo(iso)}. Os links voltam a aceitar propostas; quem foi convidado é avisado.`);
  }
  return (
    <Dialogo aberto={aberto} titulo="Estender o prazo" aoFechar={aoFechar} apoio="Os links voltam a aceitar propostas até a data nova">
      <form onSubmit={enviar} noValidate className="grid gap-4">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="t-apoio">Hoje o prazo é {diaHoraPrazo(o.prazoPropostas)}.</p>
        <CampoTexto id="estender-prazo" rotulo="Propostas até" required type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} erro={comErro.includes("prazoPropostas") ? "Escolha uma data e hora depois do prazo de hoje." : null} />
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : "Estender"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaAceiteFora({ o, aberto, aoFechar, salvo }: { o: DadosOrcamento; aberto: boolean; aoFechar: () => void; salvo: (t: string) => void }) {
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/orcamentos/${o.id}/aceite-fora`, { corpo: { versao: o.versao, data } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(`Aceite de ${o.escolha?.convite.nome ?? "fornecedor"} registrado fora do link, em ${diaCompleto(data)}.`);
  }
  return (
    <Dialogo aberto={aberto} titulo="Registrar aceite fora do link" aoFechar={aoFechar} apoio="Quando o fornecedor confirmou por telefone ou pessoalmente">
      <form onSubmit={enviar} noValidate className="grid gap-4">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="aceite-data" rotulo="Quando aceitou" required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} erro={comErro.includes("data") ? "Confira a data: de hoje para trás." : null} />
        <p className="t-apoio">Fica no histórico com o seu nome. Aceitar não é contrato nem pagamento.</p>
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Registrando…" : "Registrar o aceite"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Uma janela com um motivo obrigatório (cancelar, revogar). */
function JanelaMotivo({ aberto, titulo, apoio, rotulo, texto, textoBotao, perigo, enviar, aoFechar, salvo }: {
  aberto: boolean; titulo: string; apoio?: string; rotulo: string; texto: string; textoBotao: string; perigo?: boolean;
  enviar: (motivo: string) => Promise<{ ok: boolean; erro?: ErroApi }>; aoFechar: () => void; salvo: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [curto, setCurto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const fechar = () => { setMotivo(""); setErro(null); setCurto(false); aoFechar(); };
  async function mandar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (motivo.trim().length < 3) { setCurto(true); return; }
    setEnviando(true);
    const r = await enviar(motivo.trim());
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? { codigo: "UPSTREAM_UNAVAILABLE" });
    setMotivo("");
    salvo();
  }
  return (
    <Dialogo aberto={aberto} titulo={titulo} aoFechar={fechar} apoio={apoio}>
      <form onSubmit={mandar} noValidate className="grid gap-4">
        {erro && !camposComErro(erro).includes("motivo") ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="t-texto">{texto}</p>
        <CampoAreaTexto id={`motivo-${titulo.replace(/\W+/g, "-").toLowerCase()}`} rotulo={rotulo} required rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setCurto(false); }}
          erro={curto || camposComErro(erro).includes("motivo") ? "Escreva o motivo (3 a 500 caracteres)." : null} />
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={fechar} disabled={enviando}>Voltar</Botao>
          <Botao type="submit" variante={perigo ? "perigo" : "primario"} disabled={enviando}>{enviando ? "Enviando…" : textoBotao}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function JanelaConfirmar({ aberto, titulo, texto, textoBotao, enviar, aoFechar, salvo }: {
  aberto: boolean; titulo: string; texto: string; textoBotao: string; enviar: () => Promise<{ ok: boolean; erro?: ErroApi }>; aoFechar: () => void; salvo: () => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function mandar() {
    setErro(null);
    setEnviando(true);
    const r = await enviar();
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? { codigo: "UPSTREAM_UNAVAILABLE" });
    salvo();
  }
  return (
    <Dialogo aberto={aberto} titulo={titulo} aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="t-texto">{texto}</p>
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={aoFechar} disabled={enviando}>Voltar</Botao>
          <Botao onClick={() => void mandar()} disabled={enviando}><Icone nome="check" />{enviando ? "Enviando…" : textoBotao}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

/** Ver proposta (quadro 474): o que o fornecedor mandou, como ele escreveu. */
function JanelaProposta({ c, aoFechar }: { c: ConviteDoOrcamento | null; aoFechar: () => void }) {
  const [falha, setFalha] = useState<string | null>(null);
  const p = c?.propostaEmUso;
  return (
    <Dialogo aberto={!!c && !!p} titulo={c ? `Proposta de ${c.nome}` : "Proposta"} aoFechar={aoFechar} media fechar apoio={c && p ? `Versão ${p.numero}${c.versoes > 1 ? ` de ${c.versoes}` : ""} · mandada em ${diaHora(p.enviadaEm ?? "")}` : undefined}>
      {c && p ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {([["Total", linhaDoTotal(p)], ["Marca e modelo", p.marcaModelo ?? "—"], ["Prazo para fazer", p.prazoExecucao], ["Garantia", p.garantia ?? "—"],
            ["Preço vale até", `${diaCompleto(p.validaAte)}${p.vencida ? " · venceu" : ""}${p.confirmadaEm ? " · confirmado" : ""}`], ["Pagamento", p.pagamento ?? "—"]] as const).map(([n, t]) => (
            <div key={n} className="grid gap-0.5"><dt className="t-apoio">{n}</dt><dd className="t-texto">{t}</dd></div>
          ))}
          <div className="grid gap-0.5"><dt className="t-apoio">Inclui</dt><dd className="t-texto"><ListaInclui texto={p.inclui ?? null} /></dd></div>
          <div className="grid gap-0.5"><dt className="t-apoio">Não inclui</dt><dd className="t-texto">{p.naoInclui ? <ListaInclui texto={p.naoInclui} tom="atencao" /> : <span className="t-apoio">Nada fora do pedido</span>}</dd></div>
          <div className="grid gap-0.5 sm:col-span-2"><dt className="t-apoio">Arquivo</dt>
            <dd className="t-texto">{p.pdf ? <button type="button" onClick={() => void abrirPdf(p.pdf!.id).then(setFalha)} className="inline-flex items-center gap-1.5 font-medium text-violeta-600 hover:underline"><Icone nome="documento" className="h-4 w-4" />{p.pdf.nome}</button> : <span className="t-apoio">Sem arquivo</span>}</dd></div>
          {falha ? <p className="t-texto text-erro sm:col-span-2" role="alert">{falha}</p> : null}
        </dl>
      ) : null}
    </Dialogo>
  );
}

/** A nota fiscal, quando chegar (quadro 482): o mesmo ciclo dos anexos, com a parte NOTA_FISCAL. */
function AnexarNotaFiscal({ orcamentoId, salvo }: { orcamentoId: string; salvo: (t: string, tom?: Tom) => void }) {
  const [enviando, setEnviando] = useState(false);
  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviando(true);
    const r = await enviarArquivosDoOrcamento(orcamentoId, [{ chave: arquivo.name, arquivo, descricao: "", problema: null, progresso: 0 }], "NOTA_FISCAL");
    setEnviando(false);
    const ok = r[0]?.liberado;
    salvo(ok ? "Nota fiscal anexada." : `A nota fiscal não foi anexada: ${r[0]?.motivo ?? "tente de novo."}`, ok ? "ok" : "atencao");
  }
  return (
    <span className="mt-2 grid gap-1">
      <label htmlFor="nota-fiscal" className="t-apoio font-medium">Anexar a nota fiscal</label>
      <input id="nota-fiscal" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={enviando} className="t-texto" onChange={(ev) => void escolher(ev.target.files?.[0])} />
      {enviando ? <span className="t-apoio" role="status">Enviando…</span> : null}
    </span>
  );
}
