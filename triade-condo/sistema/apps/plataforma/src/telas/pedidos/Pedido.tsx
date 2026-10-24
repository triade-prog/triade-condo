"use client";
// Pedido (DC15, telas-modelo/pedido-ficha-*; antes "Telas do passo 4", telas 4 e 10). No topo,
// o assunto com o relato, a prioridade (só Alta ou Urgente) e a categoria, e as ações: uma
// principal, Mudar etapa e Concluir; o resto fica em "Mais ações". Embaixo, os dados, as fotos e
// documentos e, ao lado, o andamento numa linha do tempo, com o histórico completo a um toque.
// Protocolo, situação e etapa; os dois
// compromissos separados, próximo retorno ao morador e previsão de solução (AT-06, AT-07);
// o responsável e o aceite (AT-03); as pendências (AT-11); as ações de quem pode cada uma;
// o andamento, o histórico completo (AT-17), as conclusões e as fotos e documentos (passo 4b,
// PT-07). Com o retorno vencido, a faixa do aviso (passo 6, AT-09).
// A visita marcada na agenda, separada dos dois compromissos (peça R7, AG-08, MP-04), e a
// manutenção ligada (peça R6, MP-04). A conversa do WhatsApp do condomínio (passo 5) fica
// logo abaixo do topo, e o pedido de revisão do morador numa faixa no alto (decisão D.1 de
// 22/10/2026); responder pelo WhatsApp é em Dar retorno ao morador (C.1). Quem
// foi avisado no registro e o prestador escolhido (F6.4, AT-26). Da F7.4: os pedidos
// relacionados (AT-18) e a decisão pedida ao síndico, com a pendência que se resolve sozinha
// quando ele responde (AT-23). Da IA 1: a sugestão automática num cartão tracejado, que espera
// quem atende confirmar (IA-17, IA-15), e a transcrição do áudio ao lado dele (W-06).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { descreverEventoPedido, mostrarDataSemHora, mostrarTelefone, ORIGEM_PEDIDO_FRASE, REVISOES_CONCLUSAO, TIPOS_PENDENCIA, tempoAberto } from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar, Icone, IconeMarca, Iniciais, Selo, textoDoErro, Vazio, type NomeIcone } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { OpcoesPedidos, PedidoDetalhe, PendenciaPedido, Recado } from "../tipos.ts";
import { nomeRelacao } from "../moradores/comum.tsx";
import { AbaArquivos, CapaDoPedido, type ArquivosDoPedido } from "./Arquivos.tsx";
import { JanelasPedido, type AcaoPedido } from "./JanelasPedido.tsx";
import { aHora, diaHora, faltaPara, iconeDaCategoria, nomeDe, SeloEstadoPedido, SeloPrioridade } from "./comum.tsx";
import { FaixaPrazo } from "./FaixaPrazo.tsx";
import { NaAgenda } from "../agenda/NaAgenda.tsx";
import { NaManutencao } from "../manutencao/NaManutencao.tsx";
import { NosComunicados } from "../comunicados/NosComunicados.tsx";
import { ConversaWhatsapp, FaixaRevisao, type ConversaDoPedido } from "../whatsapp/ConversaWhatsapp.tsx";
import { DecisoesNoPedido, PedirDecisao, pendenciaDaDecisao } from "../decisoes/NoPedido.tsx";
import { PedidosRelacionados } from "./Relacionados.tsx";
import { CartaoAvisosRegistro } from "./AvisosDoRegistro.tsx";
import { Cartao, Dado, MaisAcoes } from "../Ficha.tsx";
import { CartaoSugestao, useIaDoPedido } from "./SugestaoIa.tsx";

const MEIO_RETORNO: Record<string, string> = { TELEFONE: "por telefone", PRESENCIAL: "pessoalmente", MENSAGEM: "por mensagem", EMAIL: "por e-mail", OUTRO: "por outro meio", WHATSAPP: "pelo WhatsApp" };

/** Próximo retorno ao morador: o horário grande, quanto falta e a barra do prazo que corre. */
function CartaoRetorno({ d, mudar, comIa }: { d: PedidoDetalhe; mudar?: () => void; comIa?: boolean }) {
  const p = d.pedido;
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  const ultimo = d.andamentos.filter((a) => a.tipo === "RETORNO").map((a) => a.em).sort().pop();
  const inicio = ultimo && ultimo > p.abertoEm ? ultimo : p.abertoEm;
  const parte = p.proximoRetorno
    ? Math.min(100, Math.max(0, ((Date.parse(d.agora) - Date.parse(inicio)) / Math.max(1, Date.parse(p.proximoRetorno) - Date.parse(inicio))) * 100)) : 0;
  const tom = p.retornoVencido ? "erro" : parte > 60 ? "atencao" : "andamento";
  return (
    <section aria-label="Próximo retorno ao morador" data-tom={tom}
      className="relative grid gap-2 overflow-hidden rounded-[18px] border border-linha bg-superficie p-5 pl-6 shadow-s1 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-laranja-500 data-[tom=andamento]:before:bg-violeta-500 data-[tom=erro]:before:bg-erro">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-rotulo">Próximo retorno ao morador</h2>
        {mudar ? <Botao variante="discreto" tamanho="m" onClick={mudar}>Mudar</Botao> : <Icone nome="relogio" className="h-5 w-5 text-tinta-suave" />}
      </div>
      {p.proximoRetorno ? (
        <>
          <p className="flex flex-wrap items-center gap-3">
            <span className="t-titulo-ficha">{aHora(p.proximoRetorno, d.agora).replace(/^às /, "Hoje, ").replace(/^em /, "")}</span>
            <Selo tom={tom === "andamento" ? "andamento" : tom}>{faltaPara(p.proximoRetorno, d.agora)}</Selo>
          </p>
          {ativo && !p.etapa.pausaPrazo ? (
            <div className="grid gap-1">
              <div className="h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden="true">
                <div className={`h-full rounded-full ${tom === "erro" ? "bg-erro" : tom === "atencao" ? "bg-laranja-500" : "bg-violeta-500"}`} style={{ width: `${parte}%` }} />
              </div>
              <p className="t-apoio flex justify-between gap-2"><span>{ultimo ? `Último retorno ${diaHora(ultimo)}` : `Registrado ${diaHora(p.abertoEm)}`}</span><span>Prazo da prioridade {p.prioridade.nome}</span></p>
            </div>
          ) : null}
        </>
      ) : <p className="t-apoio">{p.estado === "EM_REVISAO" ? "Em revisão: sem novo retorno combinado." : "Sem prazo configurado."}</p>}
      {p.etapa.pausaPrazo && ativo ? <p className="t-apoio flex items-center gap-1"><IconeMarca marca="pausa" />Prazo pausado nesta etapa.</p> : null}
      <p className="t-apoio">Compromisso de dar notícia, mesmo sem solução.{comIa ? " A sugestão e a transcrição não contam como retorno." : ""}</p>
    </section>
  );
}

/** O andamento numa linha do tempo: retornos e notas, e o próximo retorno previsto no fim. */
function LinhaDoTempo({ d }: { d: PedidoDetalhe }) {
  const [completo, setCompleto] = useState(false);
  const p = d.pedido;
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  const itens = [...d.andamentos].sort((a, b) => a.em.localeCompare(b.em));
  return (
    <Cartao id="t-andamento" titulo="Andamento" icone="relogio">
      {itens.length === 0 && !(ativo && p.proximoRetorno) ? <p className="t-apoio">Nenhum retorno nem nota ainda. O primeiro retorno ao morador fica aqui.</p> : (
        <ol className="grid">
          {itens.map((a) => (
            <li key={a.id} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 pb-4 before:absolute before:top-9 before:bottom-0 before:left-4 before:w-px before:bg-linha">
              <span className={`ladrilho h-8 w-8 rounded-full ${a.tipo === "RETORNO" ? "" : ""}`} data-tom={a.tipo === "RETORNO" ? "ok" : "violeta"} aria-hidden="true">
                <Icone nome={a.tipo === "RETORNO" ? "retorno" : "editar"} className="h-4 w-4" />
              </span>
              <div className="grid gap-1">
                <p className="font-medium">{a.tipo === "RETORNO" ? `Retorno ${nomeDe(MEIO_RETORNO, a.meio)}` : "Nota interna"}</p>
                <p className="t-apoio">{diaHora(a.em)} · {a.autor}</p>
                <p className="rounded-[14px] border border-linha bg-fundo px-3 py-2 whitespace-pre-line">{a.texto}</p>
              </div>
            </li>
          ))}
          {ativo && p.proximoRetorno ? (
            <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-laranja-500 text-atencao" aria-hidden="true"><Icone nome="relogio" className="h-4 w-4" /></span>
              <div>
                <p className="font-medium text-atencao">Retorno ao morador</p>
                <p className="t-apoio">previsto {aHora(p.proximoRetorno, d.agora)}</p>
              </div>
            </li>
          ) : null}
        </ol>
      )}
      <button type="button" className="elo flex gap-1 justify-self-start t-texto" aria-expanded={completo}
        aria-controls="historico-completo" onClick={() => setCompleto(!completo)}>
        {completo ? "Esconder o histórico completo" : `Ver histórico completo · ${d.historico.length === 1 ? "1 registro" : `${d.historico.length} registros`}`}
        <Icone nome={completo ? "baixo" : "dir"} className="h-4 w-4" />
      </button>
      {completo ? (
        <ol id="historico-completo" aria-label="Histórico completo" className="divide-y divide-linha rounded-[14px] border border-linha">
          {d.historico.map((h, i) => (
            <li key={i} className="grid gap-0.5 px-3 py-2.5 t-texto">
              <span className="t-apoio">{diaHora(h.em)} · {h.autor ?? "Sistema"}</span>
              <span>{descreverEventoPedido(h.acao, h.dados)}{h.acao === "pedido.registrado" && h.dados.responsavelNome ? ` · responsável ${String(h.dados.responsavelNome)}` : ""}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Cartao>
  );
}

export function Pedido() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const { atualizar } = usePlataforma();
  const carga = useCarregar<PedidoDetalhe>(id ? `/v1/condominio/pedidos/${id}` : null);
  const opcoes = useCarregar<OpcoesPedidos>("/v1/condominio/pedidos/opcoes");
  const arquivos = useCarregar<ArquivosDoPedido>(id ? `/v1/condominio/pedidos/${id}/arquivos` : null);
  const conversa = useCarregar<ConversaDoPedido>(id ? `/v1/condominio/pedidos/${id}/whatsapp` : null);
  const ia = useIaDoPedido(id);
  const [recado, setRecado] = useState<Recado>(busca.get("novo") ? { tom: "ok", texto: "Pedido registrado." } : null);
  const [falha, setFalha] = useState<string | null>(null);
  const [acao, setAcao] = useState<AcaoPedido | null>(null);
  const [resolver, setResolver] = useState<PendenciaPedido | null>(null);
  const [pedirDecisao, setPedirDecisao] = useState(false);
  const voltar = (
    <Link href="/pedidos" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
      <Icone nome="esq" className="h-4 w-4" />Voltar aos pedidos
    </Link>
  );

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Pedido</h1><Vazio titulo="Pedido não encontrado" /></div>;
  if (carga.estado === "carregando" || opcoes.estado === "carregando") return <Carregando rotulo="Carregando o pedido…" />;
  if (carga.estado === "erro" || opcoes.estado === "erro") {
    const e = carga.estado === "erro" ? carga : opcoes.estado === "erro" ? opcoes : null;
    return (
      <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Pedido</h1>
        <ErroCarregar erro={e?.erro} texto={e?.texto ?? ""} oQue="o pedido" tentarDeNovo={() => { carga.recarregar(); opcoes.recarregar(); }} /></div>
    );
  }

  const d = carga.dados;
  const p = d.pedido;
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  const fechado = p.estado === "ENCERRADO" || p.estado === "CANCELADO";
  const fechar = () => { setAcao(null); setResolver(null); setPedirDecisao(false); };
  const salvo = (texto: string, tom: "ok" | "atencao" = "ok") => {
    fechar(); setRecado({ tom, texto }); setFalha(null); carga.recarregar(); arquivos.recarregar(); conversa.recarregar(); ia.recarregar(); atualizar();
  };
  const qtdArquivos = arquivos.estado === "pronto" ? arquivos.dados.arquivos.length : 0;
  const abertas = d.pendencias.filter((x) => !x.resolvidaEm);
  const resolvidas = d.pendencias.filter((x) => x.resolvidaEm);
  const anotar = (d.pode.responder || d.pode.atualizar) && !fechado;
  const reabrir = d.pode.concluir && p.estado === "ENCERRADO" && d.regras.reabertura;
  const zap = conversa.estado === "pronto" ? conversa.dados : null;

  async function aceitar() {
    const r = await chamarApi(`/v1/condominio/pedidos/${p.id}/aceitar`, { corpo: { versao: p.versao } });
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    salvo("Você aceitou o pedido.");
  }

  const onde = [p.unidade?.nome, p.local].filter(Boolean).join(" · ");
  const quem = p.contato
    ? p.contato.dadosRemovidos ? "contato com dados removidos"
      : [p.contato.nome, p.contato.relacao ? nomeRelacao(p.contato.relacao).toLowerCase() : null, p.contato.telefone ? mostrarTelefone(p.contato.telefone) : null].filter(Boolean).join(" · ")
    : null;

  // Uma ação principal por tela: aceitar, se for a vez; senão dar retorno.
  const principal = d.pode.aceitar
    ? { texto: "Aceitar o pedido", icone: "check" as NomeIcone, acao: () => void aceitar() }
    : d.pode.responder && ativo ? { texto: "Dar retorno ao morador", icone: "retorno" as NomeIcone, acao: () => setAcao("retorno") } : null;
  const secundarias: { texto: string; icone: NomeIcone; acao: () => void }[] = [
    ...(d.pode.aceitar && d.pode.responder && ativo ? [{ texto: "Dar retorno ao morador", icone: "retorno" as NomeIcone, acao: () => setAcao("retorno") }] : []),
    ...(!d.pode.responder && anotar ? [{ texto: "Nota interna", icone: "editar" as NomeIcone, acao: () => setAcao("retorno") }] : []),
    ...(d.pode.atualizar && ativo ? [{ texto: "Mudar etapa", icone: "trocar" as NomeIcone, acao: () => setAcao("etapa") }] : []),
    ...(d.pode.concluir && ativo ? [{ texto: "Concluir", icone: "check" as NomeIcone, acao: () => setAcao("concluir") }] : []),
    ...(reabrir ? [{ texto: "Reabrir", icone: "retorno" as NomeIcone, acao: () => setAcao("reabrir") }] : []),
  ];
  const mais = [
    ...(d.pode.atualizar && ativo ? [{ texto: "Abrir pendência", icone: "alerta" as NomeIcone, acao: () => setAcao("pendencia") }] : []),
    ...(d.pode.pedirDecisao && ativo ? [{ texto: "Pedir decisão", icone: "decisao" as NomeIcone, acao: () => setPedirDecisao(true) }] : []),
    ...(d.pode.atualizar && ativo ? [{ texto: "Editar", icone: "editar" as NomeIcone, acao: () => setAcao("editar") }] : []),
    ...(d.pode.concluir && ativo ? [{ texto: "Cancelar pedido", icone: "fechar" as NomeIcone, acao: () => setAcao("cancelar"), perigo: true }] : []),
  ];

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${principal || secundarias.length ? "max-md:pb-32" : ""}`}>
      <header className="grid gap-5 rounded-[24px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-5">
        <div className="flex items-center justify-between gap-3">
          {voltar}
          <span className="flex items-center gap-3">
            <span className="t-codigo text-tinta-suave">{p.protocolo}</span>
            <MaisAcoes itens={mais} />
          </span>
        </div>
        <div className="flex gap-6 max-md:gap-4">
          {qtdArquivos ? (
            <a href="#t-arquivos" className="relative grid h-36 w-44 shrink-0 place-items-center overflow-hidden rounded-[18px] border border-linha bg-violeta-50 text-violeta-400 max-md:h-24 max-md:w-24">
              <Icone nome="camera" className="h-10 w-10" />
              {arquivos.estado === "pronto" ? <CapaDoPedido pedidoId={p.id} arquivos={arquivos.dados.arquivos} /> : null}
              <span className="sr-only">Ver </span>
              <span className="absolute bottom-2 left-2 rounded-full bg-tinta/70 px-2 py-0.5 t-apoio font-medium text-superficie">{qtdArquivos === 1 ? "1 arquivo" : `${qtdArquivos} arquivos`}</span>
            </a>
          ) : null}
          <div className="grid min-w-0 flex-1 content-start gap-2">
            <p className="flex flex-wrap items-center gap-2">
              <SeloPrioridade nome={p.prioridade.nome} />
              <span className="selo inline-flex items-center gap-1" data-tom="neutro"><Icone nome={iconeDaCategoria(p.categoria.nome)} className="h-3.5 w-3.5" />{p.categoria.nome}</span>
              <SeloEstadoPedido estado={p.estado} etapa={ativo ? p.etapa.nome : null} />
              {p.privado ? <Selo tom="neutro">Privado</Selo> : null}
            </p>
            <h1 className="t-titulo-ficha [overflow-wrap:anywhere]"><span className="sr-only">{p.protocolo} · </span>{p.assunto}</h1>
            <p className="t-texto whitespace-pre-line text-tinta-suave">{p.descricao}</p>
            <p className="t-apoio">{p.registradoPor ? `Registrado por ${p.registradoPor}` : "Aberto pelo morador no WhatsApp"} em {diaHora(p.abertoEm)} · {nomeDe(ORIGEM_PEDIDO_FRASE, p.canal)} · aberto há {tempoAberto(p.abertoEm, p.encerradoEm ?? p.cancelamento?.em ?? d.agora)}</p>
          </div>
        </div>
        {principal || secundarias.length ? (
          <div className="flex flex-wrap items-center gap-2.5 max-md:hidden">
            {principal ? <Botao onClick={principal.acao}><Icone nome={principal.icone} />{principal.texto}</Botao> : null}
            {secundarias.map((x) => <Botao key={x.texto} variante="contorno" onClick={x.acao}><Icone nome={x.icone} />{x.texto}</Botao>)}
          </div>
        ) : null}
      </header>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      <FaixaRevisao conversa={zap} aoReabrir={reabrir ? () => setAcao("reabrir") : undefined} salvo={(texto) => salvo(texto)} />
      {p.retornoVencido && ativo ? (
        <FaixaPrazo pedidoId={p.id} agora={d.agora} versao={p.versao} semResponsavel={!p.responsavel}
          aoDarRetorno={d.pode.responder ? () => setAcao("retorno") : undefined} />
      ) : null}
      {p.cancelamento ? <Aviso tom="info" titulo="Pedido cancelado">{p.cancelamento.por} em {diaHora(p.cancelamento.em)}. Motivo: {p.cancelamento.motivo}</Aviso> : null}
      {p.estado === "EM_REVISAO" ? (
        <Aviso tom="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Concluído e esperando a revisão do síndico.</span>
            {d.pode.revisar ? <Botao variante="contorno" onClick={() => setAcao("revisar")}>Revisar conclusão</Botao> : null}
          </span>
        </Aviso>
      ) : null}
      {d.pode.concluir && p.estado === "ENCERRADO" && !d.regras.reabertura
        ? <p className="t-apoio">Este condomínio não reabre pedidos. Se o problema voltou, registre um pedido novo.</p> : null}
      <DecisoesNoPedido d={d} salvo={(t) => salvo(t)} recarregar={carga.recarregar} />
      {ativo ? (
        <CartaoSugestao d={d} opcoes={opcoes.dados} ia={ia.dados} preparando={ia.preparando} tentarDeNovo={ia.tentarDeNovo}
          salvo={(t) => salvo(t)} falhou={(t) => setFalha(t)} />
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <ConversaWhatsapp pedidoId={p.id} conversa={zap} transcricoes={ia.dados?.transcricoes} recarregarIa={ia.recarregar} />
          {!fechado ? <CartaoRetorno d={d} mudar={d.pode.responder && ativo ? () => setAcao("proximo") : undefined}
            comIa={Boolean(ia.dados?.sugestao || Object.keys(ia.dados?.transcricoes ?? {}).length)} /> : null}

          {abertas.length ? (
            <section aria-labelledby="t-pendencias" className="grid gap-2">
              <h2 id="t-pendencias" className="t-titulo-secao">Pendências abertas</h2>
              <ul className="grid gap-2">
                {abertas.map((x) => {
                  const daDecisao = pendenciaDaDecisao(d, x.id);
                  return (
                    <li key={x.id} data-tom="atencao" className="aviso flex-wrap items-center justify-between">
                      <span className="quadro"><Icone nome={daDecisao ? "decisao" : "ferramenta"} /></span>
                      <span className="texto">
                        <span className="block font-semibold">{nomeDe(TIPOS_PENDENCIA, x.tipo)}</span>
                        <span className="block">{x.motivo}</span>
                        <span className="t-apoio block">
                          cuida: {x.responsavel.nome}{x.responsavel.ativo ? "" : " (sem acesso)"} · aberta por {x.abertaPor} em {diaHora(x.abertaEm)}{daDecisao ? ` · ${daDecisao}` : ""}
                        </span>
                      </span>
                      {ativo && !daDecisao && (d.pode.atualizar || x.responsavel.vinculoId === opcoes.dados.meuVinculo) ? (
                        <Botao variante="contorno" onClick={() => setResolver(x)}>Resolver</Botao>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {resolvidas.length ? (
            <details className="t-texto">
              <summary className="cursor-pointer font-medium text-violeta-600">{resolvidas.length === 1 ? "1 pendência resolvida" : `${resolvidas.length} pendências resolvidas`}</summary>
              <ul className="mt-2 grid gap-1">
                {resolvidas.map((x) => (
                  <li key={x.id} className="text-tinta-suave">
                    {nomeDe(TIPOS_PENDENCIA, x.tipo)}: {x.motivo} · resolvida por {x.resolvidaPor} em {diaHora(x.resolvidaEm!)}{x.resolucao ? ` · ${x.resolucao}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <Cartao id="t-dados" titulo="Dados do pedido" icone="lista"
            acao={d.pode.atualizar && ativo ? <Botao variante="discreto" tamanho="m" onClick={() => setAcao("editar")}><Icone nome="editar" />Editar dados</Botao> : undefined}>
            <div>
              <Dado icone="trocar" nome="Situação"><SeloEstadoPedido estado={p.estado} etapa={ativo ? p.etapa.nome : null} /></Dado>
              <Dado icone="pessoa" nome="Responsável"
                acao={d.pode.repassar && !fechado ? <Botao variante="discreto" tamanho="m" onClick={() => setAcao("repassar")}>{p.responsavel ? "Repassar" : "Atribuir"}</Botao> : undefined}>
                {p.responsavel ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Iniciais nome={p.responsavel.nome} />
                    <span className="grid">
                      <span>{p.responsavel.eu ? "Você" : p.responsavel.nome}</span>
                      <span className="t-apoio">desde {diaHora(p.responsavel.desde)}</span>
                    </span>
                    {p.responsavel.aceitoEm ? <Selo tom="ok">Aceito</Selo> : !fechado ? <Selo tom="atencao">Esperando aceite</Selo> : null}
                  </span>
                ) : <Selo tom="atencao">Sem responsável</Selo>}
              </Dado>
              <Dado icone={iconeDaCategoria(p.categoria.nome)} nome="Categoria">{p.categoria.nome}</Dado>
              <Dado icone="alerta" nome="Prioridade">
                <span className="flex flex-wrap items-center gap-2">
                  {/^(alta|urgente)/i.test(p.prioridade.nome) ? <SeloPrioridade nome={p.prioridade.nome} /> : <span>{p.prioridade.nome}</span>}
                  <span className="t-apoio">{p.prioridade.significado}</span>
                </span>
              </Dado>
              {!fechado ? (
                <Dado icone="calendario" nome="Previsão de solução" regiao
                  acao={d.pode.atualizar && ativo ? <Botao variante="discreto" tamanho="m" onClick={() => setAcao("previsao")}>{p.previsao ? "Mudar" : "Definir"}</Botao> : undefined}>
                  <span className="grid">
                    <span>{p.previsao ? mostrarDataSemHora(p.previsao) : "Sem previsão"}</span>
                    <span className="t-apoio">Só quando for conhecida.</span>
                  </span>
                </Dado>
              ) : null}
              <Dado icone="relogio" nome="Registrado em">
                <span className="t-codigo">{diaHora(p.abertoEm)}</span>
              </Dado>
              {onde ? <Dado icone="predio" nome="Onde">{onde}</Dado> : null}
              <Dado icone="pessoas" nome="Quem pediu">{quem ?? <span className="t-apoio">Visto pela gestão, sem contato</span>}</Dado>
              {p.prestador ? <Dado icone="ferramenta" nome="Prestador">{p.prestador.nome}</Dado> : null}
            </div>
          </Cartao>

          <NaAgenda key={`${p.id}-${p.previsao ?? ""}`} pedido={p} ativo={!fechado} avisar={(texto) => { setRecado({ tom: "ok", texto }); setFalha(null); }} />
          <NaManutencao pedido={p} ativo={!fechado} avisar={(texto) => { setRecado({ tom: "ok", texto }); setFalha(null); }} />
          <CartaoAvisosRegistro avisos={d.avisosRegistro ?? []} />
          <NosComunicados pedidoId={p.id} ativo={!fechado} />
          <PedidosRelacionados d={d} podeConcluir={d.pode.concluir} salvo={(t) => salvo(t)} recarregar={carga.recarregar} />

          <Cartao id="t-arquivos" icone="clipe" titulo={<>Fotos e documentos{qtdArquivos ? <span aria-hidden="true" className="t-apoio font-normal">{qtdArquivos}</span> : null}</>}>
            <AbaArquivos pedidoId={p.id} protocolo={p.protocolo} carga={arquivos}
              avisar={(r, recarregar) => { if (r) { setRecado(r); setFalha(null); } if (recarregar) { arquivos.recarregar(); carga.recarregar(); } }} />
          </Cartao>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <LinhaDoTempo d={d} />
          {d.conclusoes.length ? (
            <Cartao id="t-conclusoes" titulo="Conclusões" icone="check">
              <ul className="grid gap-3">
                {d.conclusoes.map((c) => (
                  <li key={c.id} className="grid gap-1 rounded-[14px] border border-linha p-3 t-texto">
                    <span className="flex flex-wrap items-center gap-2">
                      <Selo tom={c.revisao === "DEVOLVIDA" ? "atencao" : c.revisao === "AGUARDANDO" ? "info" : "ok"}>
                        {c.etapa} · {REVISOES_CONCLUSAO[c.revisao]}
                      </Selo>
                      <span className="t-apoio">{c.concluidaPor} · {diaHora(c.concluidaEm)}</span>
                    </span>
                    <span>{c.explicacao}</span>
                    {c.evidencia ? <span className="t-apoio">Evidência: {c.evidencia}</span> : null}
                    {c.motivoDevolucao ? <span className="t-apoio">Devolvido por {c.revisadaPor}: {c.motivoDevolucao}</span> : null}
                    {c.reabertaEm ? <span className="t-apoio">Reaberto por {c.reabertaPor} em {diaHora(c.reabertaEm)}: {c.motivoReabertura}</span> : null}
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </div>
      </div>

      {principal || secundarias.length ? (
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 grid gap-1 border-t border-linha bg-superficie px-4 pt-3 pb-2 shadow-s2 md:hidden">
          {principal ? <Botao className="w-full" onClick={principal.acao}><Icone nome={principal.icone} />{principal.texto}</Botao> : null}
          {secundarias.length ? (
            <div className="flex flex-wrap justify-center gap-1">
              {secundarias.map((x) => <Botao key={x.texto} variante="discreto" tamanho="m" onClick={x.acao}><Icone nome={x.icone} />{x.texto}</Botao>)}
            </div>
          ) : null}
        </div>
      ) : null}

      <JanelasPedido acao={acao} resolver={resolver} d={d} opcoes={opcoes.dados} whatsapp={zap} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} />
      <PedirDecisao aberto={pedirDecisao} d={d} aoFechar={() => setPedirDecisao(false)} salvo={(t) => salvo(t)} recarregar={carga.recarregar} />
    </div>
  );
}
