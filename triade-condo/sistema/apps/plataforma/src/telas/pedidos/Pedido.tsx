"use client";
// Pedido (design "Telas do passo 4", telas 4 e 10): protocolo, situação e etapa; os dois
// compromissos separados, próximo retorno ao morador e previsão de solução (AT-06, AT-07);
// o responsável e o aceite (AT-03); as pendências (AT-11); as ações de quem pode cada uma;
// e, em abas, o andamento, o histórico completo (AT-17), o relato, as conclusões e as fotos e
// documentos (passo 4b, PT-07). Com o retorno vencido, a faixa do aviso (passo 6, AT-09).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CANAIS_PEDIDO, descreverEventoPedido, mostrarDataSemHora, mostrarTelefone, REVISOES_CONCLUSAO, TIPOS_PENDENCIA, tempoAberto } from "@triade/domain";
import { Abas, Aviso, Botao, Carregando, chamarApi, ErroCarregar, IconeMarca, Selo, textoDoErro, Vazio } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { OpcoesPedidos, PedidoDetalhe, PendenciaPedido, Recado } from "../tipos.ts";
import { nomeRelacao } from "../moradores/comum.tsx";
import { AbaArquivos, type ArquivosDoPedido } from "./Arquivos.tsx";
import { JanelasPedido, type AcaoPedido } from "./JanelasPedido.tsx";
import { diaHora, faltaPara, nomeDe, SeloEstadoPedido } from "./comum.tsx";
import { FaixaPrazo } from "./FaixaPrazo.tsx";

const ABAS = [
  { id: "andamento", texto: "Andamento" },
  { id: "historico", texto: "Histórico" },
  { id: "relato", texto: "O que foi relatado" },
  { id: "conclusoes", texto: "Conclusões" },
  { id: "arquivos", texto: "Fotos e documentos" },
] as const;
type IdAba = (typeof ABAS)[number]["id"];

function Compromisso({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="grid content-start gap-1 rounded-xl border border-linha bg-superficie p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
      {acao ? <div className="pt-1">{acao}</div> : null}
    </section>
  );
}

export function Pedido() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const { atualizar } = usePlataforma();
  const carga = useCarregar<PedidoDetalhe>(id ? `/v1/condominio/pedidos/${id}` : null);
  const opcoes = useCarregar<OpcoesPedidos>("/v1/condominio/pedidos/opcoes");
  const arquivos = useCarregar<ArquivosDoPedido>(id ? `/v1/condominio/pedidos/${id}/arquivos` : null);
  const [recado, setRecado] = useState<Recado>(busca.get("novo") ? { tom: "ok", texto: "Pedido registrado." } : null);
  const [falha, setFalha] = useState<string | null>(null);
  const [acao, setAcao] = useState<AcaoPedido | null>(null);
  const [resolver, setResolver] = useState<PendenciaPedido | null>(null);
  const [aba, setAba] = useState<IdAba>("andamento");
  const voltar = <Link href="/pedidos" className="text-sm font-medium text-acao hover:underline">Voltar aos pedidos</Link>;

  if (!id) return <div className="grid gap-3">{voltar}<h1 className="text-2xl font-semibold tracking-tight">Pedido</h1><Vazio titulo="Pedido não encontrado" /></div>;
  if (carga.estado === "carregando" || opcoes.estado === "carregando") return <Carregando rotulo="Carregando o pedido…" />;
  if (carga.estado === "erro" || opcoes.estado === "erro") {
    const e = carga.estado === "erro" ? carga : opcoes.estado === "erro" ? opcoes : null;
    return (
      <div className="grid gap-3">{voltar}<h1 className="text-2xl font-semibold tracking-tight">Pedido</h1>
        <ErroCarregar texto={e?.texto ?? ""} tentarDeNovo={() => { carga.recarregar(); opcoes.recarregar(); }} /></div>
    );
  }

  const d = carga.dados;
  const p = d.pedido;
  const ativo = p.estado === "ABERTO" || p.estado === "EM_ANDAMENTO";
  const fechado = p.estado === "ENCERRADO" || p.estado === "CANCELADO";
  const fechar = () => { setAcao(null); setResolver(null); };
  const salvo = (texto: string, tom: "ok" | "atencao" = "ok") => {
    fechar(); setRecado({ tom, texto }); setFalha(null); carga.recarregar(); arquivos.recarregar(); atualizar();
  };
  const qtdArquivos = arquivos.estado === "pronto" ? arquivos.dados.arquivos.length : 0;
  const abas = ABAS.map((a) => (a.id === "arquivos" && qtdArquivos ? { ...a, texto: `${a.texto} (${qtdArquivos})` } : a));
  const abertas = d.pendencias.filter((x) => !x.resolvidaEm);
  const resolvidas = d.pendencias.filter((x) => x.resolvidaEm);
  const anotar = (d.pode.responder || d.pode.atualizar) && !fechado;

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

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight"><span className="font-mono text-lg text-tinta-suave">{p.protocolo}</span> · {p.assunto}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tinta-suave">
            <SeloEstadoPedido estado={p.estado} />
            {p.privado ? <Selo tom="neutro" marca="interno">Privado</Selo> : null}
            <span>{[ativo ? p.etapa.nome : null, p.categoria.nome, p.prioridade.nome, onde, quem, `por ${nomeDe(CANAIS_PEDIDO, p.canal).toLowerCase()}`].filter(Boolean).join(" · ")}</span>
          </p>
          <p className="mt-1 text-xs text-tinta-suave">Registrado por {p.registradoPor} em {diaHora(p.abertoEm)} · aberto há {tempoAberto(p.abertoEm, p.encerradoEm ?? p.cancelamento?.em ?? d.agora)}</p>
        </div>
        {d.pode.aceitar ? <Botao onClick={() => void aceitar()}>Aceitar o pedido</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
      {p.retornoVencido && ativo ? (
        <FaixaPrazo pedidoId={p.id} agora={d.agora} versao={p.versao} semResponsavel={!p.responsavel}
          aoDarRetorno={d.pode.responder ? () => setAcao("retorno") : undefined} />
      ) : null}
      {p.cancelamento ? <Aviso tom="info" titulo="Pedido cancelado">{p.cancelamento.por} em {diaHora(p.cancelamento.em)}. Motivo: {p.cancelamento.motivo}</Aviso> : null}
      {p.estado === "EM_REVISAO" ? (
        <Aviso tom="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Concluído e esperando a revisão do síndico.</span>
            {d.pode.revisar ? <Botao variante="secundario" onClick={() => setAcao("revisar")}>Revisar conclusão</Botao> : null}
          </span>
        </Aviso>
      ) : null}

      {!fechado ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Compromisso titulo="Próximo retorno ao morador"
            acao={d.pode.responder && ativo ? <Botao variante="texto" onClick={() => setAcao("proximo")}>Mudar</Botao> : undefined}>
            {p.proximoRetorno ? (
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{diaHora(p.proximoRetorno)}</span>
                {p.retornoVencido ? <Selo tom="atencao" marca="atencao">{faltaPara(p.proximoRetorno, d.agora)}</Selo>
                  : <span className="text-sm text-tinta-suave">{faltaPara(p.proximoRetorno, d.agora)}</span>}
              </p>
            ) : <p className="text-sm text-tinta-suave">{p.estado === "EM_REVISAO" ? "Em revisão: sem novo retorno combinado." : "Sem prazo configurado."}</p>}
            {p.etapa.pausaPrazo && ativo ? <p className="flex items-center gap-1 text-xs text-tinta-suave"><IconeMarca marca="pausa" />Prazo pausado nesta etapa.</p> : null}
            <p className="text-xs text-tinta-suave">Compromisso de dar notícia, mesmo sem solução.</p>
          </Compromisso>
          <Compromisso titulo="Previsão de solução"
            acao={d.pode.atualizar && ativo ? <Botao variante="texto" onClick={() => setAcao("previsao")}>{p.previsao ? "Mudar" : "Definir"}</Botao> : undefined}>
            <p className="font-medium">{p.previsao ? mostrarDataSemHora(p.previsao) : "Sem previsão"}</p>
            <p className="text-xs text-tinta-suave">Só quando for conhecida.</p>
          </Compromisso>
        </div>
      ) : null}

      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Responsável:</span>
        {p.responsavel ? (
          <>
            <span>{p.responsavel.eu ? "Você" : p.responsavel.nome}</span>
            {p.responsavel.aceitoEm ? <Selo tom="ok" marca="ok">Aceito</Selo> : !fechado ? <Selo tom="atencao" marca="atencao">Esperando aceite</Selo> : null}
            <span className="text-tinta-suave">desde {diaHora(p.responsavel.desde)}</span>
          </>
        ) : <Selo tom="atencao" marca="atencao">Sem responsável</Selo>}
        {d.pode.repassar && !fechado ? <Botao variante="texto" onClick={() => setAcao("repassar")}>{p.responsavel ? "Repassar" : "Atribuir"}</Botao> : null}
      </p>

      {abertas.length ? (
        <section aria-labelledby="t-pendencias" className="grid gap-2">
          <h2 id="t-pendencias" className="font-semibold">Pendências abertas</h2>
          <ul className="grid gap-2">
            {abertas.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm">
                <span>
                  <span className="flex items-center gap-1.5 font-semibold text-atencao"><IconeMarca marca="atencao" />{nomeDe(TIPOS_PENDENCIA, x.tipo)}</span>
                  <span className="block">{x.motivo}</span>
                  <span className="block text-xs text-tinta-suave">cuida: {x.responsavel.nome}{x.responsavel.ativo ? "" : " (sem acesso)"} · aberta por {x.abertaPor} em {diaHora(x.abertaEm)}</span>
                </span>
                {ativo && (d.pode.atualizar || x.responsavel.vinculoId === opcoes.dados.meuVinculo) ? (
                  <Botao variante="secundario" onClick={() => setResolver(x)}>Resolver</Botao>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resolvidas.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-acao">{resolvidas.length === 1 ? "1 pendência resolvida" : `${resolvidas.length} pendências resolvidas`}</summary>
          <ul className="mt-2 grid gap-1">
            {resolvidas.map((x) => (
              <li key={x.id} className="text-tinta-suave">
                {nomeDe(TIPOS_PENDENCIA, x.tipo)}: {x.motivo} · resolvida por {x.resolvidaPor} em {diaHora(x.resolvidaEm!)}{x.resolucao ? ` · ${x.resolucao}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {d.pode.responder && ativo ? <Botao onClick={() => setAcao("retorno")}>Dar retorno ao morador</Botao>
          : anotar ? <Botao variante="secundario" onClick={() => setAcao("retorno")}>Nota interna</Botao> : null}
        {d.pode.atualizar && ativo ? <Botao variante="secundario" onClick={() => setAcao("etapa")}>Mudar etapa</Botao> : null}
        {d.pode.atualizar && ativo ? <Botao variante="secundario" onClick={() => setAcao("pendencia")}>+ Pendência</Botao> : null}
        {d.pode.concluir && ativo ? <Botao variante="secundario" onClick={() => setAcao("concluir")}>Concluir</Botao> : null}
        {d.pode.atualizar && ativo ? <Botao variante="secundario" onClick={() => setAcao("editar")}>Editar</Botao> : null}
        {d.pode.concluir && ativo ? <Botao variante="secundario" onClick={() => setAcao("cancelar")}>Cancelar pedido</Botao> : null}
        {d.pode.concluir && p.estado === "ENCERRADO" && d.regras.reabertura ? <Botao variante="secundario" onClick={() => setAcao("reabrir")}>Reabrir</Botao> : null}
      </div>
      {d.pode.concluir && p.estado === "ENCERRADO" && !d.regras.reabertura
        ? <p className="text-sm text-tinta-suave">Este condomínio não reabre pedidos. Se o problema voltou, registre um pedido novo.</p> : null}

      <Abas abas={abas} atual={aba} aoMudar={setAba} rotulo="Partes do pedido">
        <div className="pt-4">
          {aba === "andamento" ? (
            d.andamentos.length === 0 ? <Vazio titulo="Nenhum retorno nem nota ainda">O primeiro retorno ao morador fica aqui.</Vazio> : (
              <ul className="divide-y divide-linha rounded-lg border border-linha bg-superficie">
                {d.andamentos.map((a) => (
                  <li key={a.id} className="grid gap-0.5 px-4 py-3 text-sm">
                    <span className="flex flex-wrap items-center gap-2 text-xs text-tinta-suave">
                      {a.tipo === "RETORNO" ? <Selo tom="ok" marca="ok">Retorno {nomeDe({ TELEFONE: "por telefone", PRESENCIAL: "pessoalmente", MENSAGEM: "por mensagem", EMAIL: "por e-mail", OUTRO: "por outro meio" }, a.meio)}</Selo>
                        : <Selo tom="neutro" marca="interno">Nota interna</Selo>}
                      {a.autor} · {diaHora(a.em)}
                    </span>
                    <span className="whitespace-pre-line">{a.texto}</span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {aba === "historico" ? (
            <ol className="divide-y divide-linha rounded-lg border border-linha bg-superficie">
              {d.historico.map((h, i) => (
                <li key={i} className="grid gap-0.5 px-4 py-2.5 text-sm">
                  <span className="text-xs text-tinta-suave">{diaHora(h.em)} · {h.autor ?? "Sistema"}</span>
                  <span>{descreverEventoPedido(h.acao, h.dados)}{h.acao === "pedido.registrado" && h.dados.responsavelNome ? ` · responsável ${String(h.dados.responsavelNome)}` : ""}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {aba === "relato" ? (
            <div className="grid gap-2 rounded-lg border border-linha bg-superficie p-4 text-sm">
              <p className="whitespace-pre-line">{p.descricao}</p>
              <p className="text-xs text-tinta-suave">O relato não muda depois de registrado. O que vier a mais vira nota.</p>
            </div>
          ) : null}
          {aba === "conclusoes" ? (
            d.conclusoes.length === 0 ? <Vazio titulo="Ainda não concluído" /> : (
              <ul className="grid gap-3">
                {d.conclusoes.map((c) => (
                  <li key={c.id} className="grid gap-1 rounded-lg border border-linha bg-superficie p-4 text-sm">
                    <span className="flex flex-wrap items-center gap-2 text-xs text-tinta-suave">
                      <Selo tom={c.revisao === "DEVOLVIDA" ? "atencao" : c.revisao === "AGUARDANDO" ? "info" : "ok"} marca={c.revisao === "DEVOLVIDA" ? "atencao" : c.revisao === "AGUARDANDO" ? "interno" : "ok"}>
                        {c.etapa} · {REVISOES_CONCLUSAO[c.revisao]}
                      </Selo>
                      {c.concluidaPor} · {diaHora(c.concluidaEm)}
                    </span>
                    <span>{c.explicacao}</span>
                    {c.evidencia ? <span className="text-xs text-tinta-suave">Evidência: {c.evidencia}</span> : null}
                    {c.motivoDevolucao ? <span className="text-xs">Devolvido por {c.revisadaPor}: {c.motivoDevolucao}</span> : null}
                    {c.reabertaEm ? <span className="text-xs">Reaberto por {c.reabertaPor} em {diaHora(c.reabertaEm)}: {c.motivoReabertura}</span> : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {aba === "arquivos" ? (
            <AbaArquivos pedidoId={p.id} protocolo={p.protocolo} carga={arquivos}
              avisar={(r, recarregar) => { if (r) { setRecado(r); setFalha(null); } if (recarregar) { arquivos.recarregar(); carga.recarregar(); } }} />
          ) : null}
        </div>
      </Abas>

      <JanelasPedido acao={acao} resolver={resolver} d={d} opcoes={opcoes.dados} aoFechar={fechar} salvo={salvo} recarregar={carga.recarregar} />
    </div>
  );
}
