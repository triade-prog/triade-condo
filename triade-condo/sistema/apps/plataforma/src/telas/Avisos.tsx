"use client";
// Avisos dentro do painel (passo 6; F6.1, F6.2, AT-08, AT-09): o sino na barra superior com
// quantos estão sem ver e a lista dos últimos 30 dias. Cada aviso leva ao pedido. Marcar como
// visto não resolve o pedido: ele só sai dos vencidos quando o morador recebe um retorno. Também
// chegam aqui o retorno vencido da manutenção (R6), o documento perto de vencer (R1), o pedido de
// documento pelo mural e o e-mail que voltou ou foi marcado como spam (CD-13, CD-14). Da peça R4:
// o recado da entrega da implantação, a resposta da TRÍADE num chamado e o pedido de acesso
// excepcional (PI-04, PI-20, PI-11). Do passo 5: pedido novo e pedido de revisão do morador pelo
// WhatsApp, mensagem a identificar, envio que falhou e número desconectado. Da peça R12: reserva
// esperando aprovação e reserva cancelada pelo morador perto da data. Da F5.9 (MP-09): o prestador
// confirmou ou não pode, e a troca para a reserva. Da F5.10 (W-17): a queda do WhatsApp e a volta do número.
// Da F7.4 (AT-23): decisão pedida a você, decisão com o prazo vencido e a resposta da que você pediu.

import Link from "next/link";
import { useState } from "react";
import { formatarDataHora, mostrarDataCurta, TIPOS_AVISO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { AvisoDoPainel, Avisos as ListaAvisos } from "./tipos.ts";

function detalhe(a: AvisoDoPainel): string {
  switch (a.tipo) {
    case "ESCALADO_SINDICO":
    case "ESCALADO_SUBSTITUTO":
      return a.responsavel ? `Retorno vencido. O responsável, ${a.responsavel}, já foi avisado.` : "Retorno vencido, sem responsável.";
    case "RETORNO_VENCIDO":
      return a.responsavel ? `Retorno vencido. Responsável: ${a.responsavel}.` : "Retorno vencido de pedido sem responsável.";
    case "SEM_RESPONSAVEL":
      return "Sem ninguém cuidando do pedido.";
    case "PENDENCIA_PARADA":
      return "Pendência aberta e parada. Confira se ainda está de pé.";
    case "MANUTENCAO_RETORNO_VENCIDO":
      return "Retorno da manutenção vencido. Combine o próximo ou atualize a situação.";
    case "DOCUMENTO_VENCENDO":
      return `Vale até ${mostrarDataCurta(a.referencia ?? "")}. Guarde a versão renovada quando chegar.`;
    case "DOCUMENTO_PEDIDO":
      return "Pedido pelo mural, esperando você enviar ou recusar.";
    case "EMAIL_DEVOLVIDO":
      return "O e-mail voltou: o endereço não existe. Corrija no cadastro.";
    case "EMAIL_SPAM":
      return "Marcou o e-mail como spam e não recebe mais por e-mail.";
    case "PRESTADOR_IMPEDIMENTO":
      return `${a.nome ?? "O prestador"} não conseguiu fazer o serviço. Veja o motivo e combine o próximo passo.`;
    case "PRESTADOR_TERMINOU":
      return `${a.nome ?? "O prestador"} contou o que fez. Confira e conclua a manutenção.`;
    case "PRONTUARIO_VENCE":
      return `Vale até ${mostrarDataCurta(a.referencia ?? "")}. Guarde o documento renovado e ligue no prontuário.`;
    case "PRONTUARIO_VENCEU":
      return `Venceu em ${mostrarDataCurta(a.referencia ?? "")}. Providencie a renovação.`;
    case "EXPORTACAO_PRONTA":
      return "A exportação ficou pronta. Os links valem 7 dias.";
    case "EXPORTACAO_FALHOU":
      return "A exportação não deu certo. Peça de novo.";
    case "ENTREGA":
      return a.texto ?? "A implantação foi entregue.";
    case "CHAMADO_RESPOSTA":
      return "A TRÍADE respondeu o seu chamado.";
    case "ACESSO_PEDIDO":
      return `${a.nome ?? "A TRÍADE"} pediu para ver dados do condomínio. Aprove ou recuse no Início.`;
    case "CONFIGURACAO":
      return a.texto ?? "A TRÍADE fez um ajuste técnico nas Configurações.";
    case "WHATSAPP_PEDIDO_NOVO":
      return "Pedido novo, aberto pelo morador no WhatsApp.";
    case "WHATSAPP_REVISAO":
      return "O morador pediu revisão pelo WhatsApp. O pedido não reabre sozinho: decida no pedido.";
    case "WHATSAPP_A_IDENTIFICAR":
      return "Mensagem de um número sem vínculo confirmado. Veja em WhatsApp, A identificar.";
    case "WHATSAPP_FALHA_ENVIO":
      return "Uma mensagem do WhatsApp não saiu. Reenvie ou avise por outro meio.";
    case "WHATSAPP_DESCONECTADO":
      return "O WhatsApp do condomínio desconectou: as mensagens não chegam. A TRÍADE foi avisada; atenda por telefone e registre no painel.";
    case "RESERVA_A_APROVAR":
      return "Pedido de reserva esperando aprovação.";
    case "RESERVA_CANCELADA":
      return "O morador cancelou a reserva perto da data.";
    case "PRESTADOR_CONFIRMOU":
      return `${a.nome ?? "O prestador"} confirmou que vai fazer o serviço.`;
    case "PRESTADOR_RECUSOU":
      return `${a.nome ?? "O prestador"} disse que não pode atender.`;
    case "WHATSAPP_QUEDA":
      return "O WhatsApp do condomínio caiu e você cuida da queda. Escreva o canal alternativo para os moradores.";
    case "WHATSAPP_QUEDA_VOLTOU":
      return "O número do WhatsApp voltou. Confira o que ficou parado e encerre a queda.";
    case "TROCA_TROCOU":
      return `O serviço passou para ${a.nome ?? "a reserva"}, a reserva do cadastro, e o link já foi pelo WhatsApp do condomínio.`;
    case "TROCA_MANDAR_LINK":
      return `${a.nome ?? "O prestador"} não respondeu e o serviço passou para a reserva. Mande o link a ela pela manutenção.`;
    case "TROCA_NAO_TROCOU":
      return `${a.nome ?? "O prestador"} não respondeu e a reserva saiu do cadastro: escolha quem executa.`;
    case "TROCA_RESERVA_SEM_RESPOSTA":
      return `${a.nome ?? "A reserva"} também não respondeu. Não há nova troca: combine com outro prestador.`;
    case "TROCA_SEM_RESPOSTA":
      return `${a.nome ?? "O prestador"} não respondeu no prazo e não há reserva para passar: combine com ele ou com outro prestador.`;
    case "DECISAO_PEDIDA":
      return `Pediram a sua decisão${a.prazo ? ` até ${mostrarDataCurta(a.prazo)}` : ""}.`;
    case "DECISAO_VENCIDA":
      return `O prazo para decidir venceu${a.prazo ? ` em ${mostrarDataCurta(a.prazo)}` : ""}.`;
    case "DECISAO_RESPONDIDA":
      return a.estado === "APROVADA" ? "A decisão que você pediu foi aprovada." : a.estado === "DEVOLVIDA" ? "A decisão que você pediu foi devolvida sem decidir." : "A decisão que você pediu foi respondida.";
  }
}

function Lista({ aoFechar }: { aoFechar: () => void }) {
  const { atualizar } = usePlataforma();
  const avisos = useCarregar<ListaAvisos>("/v1/condominio/avisos");
  const [falha, setFalha] = useState<ErroApi | null>(null);

  async function marcar(ids: string[] | null) {
    setFalha(null);
    const r = await chamarApi("/v1/condominio/avisos/vistos", { corpo: { ids } });
    if (!r.ok) return setFalha(r.erro);
    avisos.recarregar();
    atualizar();
  }

  if (avisos.estado === "carregando") return <Carregando linhas={3} rotulo="Carregando os avisos…" />;
  if (avisos.estado === "erro") return <ErroCarregar texto={avisos.texto} tentarDeNovo={avisos.recarregar} />;
  const { itens, naoVistos } = avisos.dados;
  return (
    <div className="grid gap-3">
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} /> : null}
      {naoVistos ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">{naoVistos === 1 ? "1 aviso sem ver" : `${naoVistos} avisos sem ver`}</p>
          <Botao variante="contorno" onClick={() => void marcar(null)}>Marcar todos como vistos</Botao>
        </div>
      ) : null}
      {itens.length === 0 ? (
        <Vazio titulo="Nenhum aviso">Quando um retorno vencer ou um pedido ficar sem responsável, o aviso aparece aqui.</Vazio>
      ) : (
        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {itens.map((a) => {
            const escalado = a.tipo === "ESCALADO_SINDICO" || a.tipo === "ESCALADO_SUBSTITUTO";
            if (a.tipo === "EMAIL_DEVOLVIDO" || a.tipo === "EMAIL_SPAM") {
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom="atencao">E-mail</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  <span className="font-semibold">{a.nome ?? "Contato"}{a.unidades ? ` · ${a.unidades}` : ""}</span>
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    {a.comunicadoId ? (
                      <Link href={`/comunicados/comunicado?id=${a.comunicadoId}`} className="font-medium text-violeta-600 hover:underline"
                        onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                        Ver comunicado
                      </Link>
                    ) : null}
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso do e-mail de ${a.nome ?? "contato"}`}>Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo === "DOCUMENTO_VENCENDO" || a.tipo === "DOCUMENTO_PEDIDO") {
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom="atencao">Documento</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  <span className="font-semibold">{a.titulo}</span>
                  <span className="text-xs text-tinta-suave">{detalhe(a)} Avisado em {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={a.tipo === "DOCUMENTO_PEDIDO" ? "/comunicados/documentos?filtro=PEDIDOS" : `/comunicados/documento?id=${a.documentoId}`}
                      className="font-medium text-violeta-600 hover:underline"
                      onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      {a.tipo === "DOCUMENTO_PEDIDO" ? "Ver pedidos" : "Ver documento"}
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso do documento ${a.titulo}`}>Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo === "PRONTUARIO_VENCE" || a.tipo === "PRONTUARIO_VENCEU" || a.tipo === "EXPORTACAO_PRONTA" || a.tipo === "EXPORTACAO_FALHOU") {
              const prontuario = a.tipo.startsWith("PRONTUARIO");
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom={a.tipo === "EXPORTACAO_PRONTA" ? "ok" : "atencao"}>{prontuario ? "Prontuário" : "Exportação"}</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  {a.titulo ? <span className="font-semibold">{a.titulo}</span> : null}
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={prontuario ? "/memoria" : "/memoria?aba=exportar"} className="font-medium text-violeta-600 hover:underline"
                      onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      {prontuario ? "Ver prontuário" : "Ver exportação"}
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso ${prontuario ? `do prontuário ${a.titulo ?? ""}` : "da exportação"}`}>Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo === "ENTREGA" || a.tipo === "CHAMADO_RESPOSTA" || a.tipo === "ACESSO_PEDIDO" || a.tipo === "CONFIGURACAO") {
              const destino = a.tipo === "CHAMADO_RESPOSTA" ? `/suporte?id=${a.chamadoId}` : a.tipo === "ACESSO_PEDIDO" ? "/"
                : a.tipo === "CONFIGURACAO" ? "/configuracoes" : "/suporte";
              const rotulo = a.tipo === "CHAMADO_RESPOSTA" ? "Ver chamado" : a.tipo === "ACESSO_PEDIDO" ? "Aprovar ou recusar"
                : a.tipo === "CONFIGURACAO" ? "Ver as configurações" : "Ajuda e suporte";
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom={a.tipo === "ACESSO_PEDIDO" ? "atencao" : "info"}>TRÍADE</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  {a.titulo ? <span className="font-semibold">{a.titulo}</span> : null}
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={destino} className="font-medium text-violeta-600 hover:underline" onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      {rotulo}
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label="Marcar como visto o aviso da TRÍADE">Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo.startsWith("WHATSAPP_")) {
              const destino = a.pedidoId ? `/pedidos/pedido?id=${a.pedidoId}` : "/whatsapp";
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom={a.tipo === "WHATSAPP_PEDIDO_NOVO" ? "info" : "atencao"}>WhatsApp</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  {a.protocolo ? <span><strong className="font-semibold">{a.protocolo}</strong> {a.assunto ?? "Pedido privado"}</span> : null}
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={destino} className="font-medium text-violeta-600 hover:underline" onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      {a.pedidoId ? `Ver pedido ${a.protocolo ?? ""}`.trim() : "Abrir o WhatsApp"}
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label="Marcar como visto o aviso do WhatsApp">Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo.startsWith("DECISAO_")) {
              const aguardando = a.estado === "AGUARDANDO" && a.tipo !== "DECISAO_RESPONDIDA";
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom={a.tipo === "DECISAO_VENCIDA" ? "erro" : a.tipo === "DECISAO_RESPONDIDA" ? "ok" : "atencao"}>Decisão</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  <span><strong className="font-semibold">{a.protocolo}</strong> {a.titulo}</span>
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={aguardando ? "/decisoes?filtro=AGUARDANDO" : `/pedidos/pedido?id=${a.pedidoId}`} className="font-medium text-violeta-600 hover:underline"
                      onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      {aguardando ? "Decidir" : `Ver pedido ${a.protocolo ?? ""}`.trim()}
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso da decisão do pedido ${a.protocolo}`}>Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo === "RESERVA_A_APROVAR" || a.tipo === "RESERVA_CANCELADA") {
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom={a.tipo === "RESERVA_A_APROVAR" ? "atencao" : "info"}>Reserva</Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  <span><strong className="font-semibold">{a.protocolo}</strong> {a.titulo}</span>
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href="/vida" className="font-medium text-violeta-600 hover:underline"
                      onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      Ver reservas
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso da reserva ${a.protocolo}`}>Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            if (a.tipo === "MANUTENCAO_RETORNO_VENCIDO" || a.tipo.startsWith("PRESTADOR_") || a.tipo.startsWith("TROCA_")) {
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom={a.tipo === "PRESTADOR_CONFIRMOU" || a.tipo === "TROCA_TROCOU" ? "info" : "atencao"}>
                      {a.tipo === "MANUTENCAO_RETORNO_VENCIDO" ? "Manutenção" : a.tipo.startsWith("TROCA_") && a.tipo !== "TROCA_SEM_RESPOSTA" ? "Troca de prestador" : "Prestador"}
                    </Selo>
                    {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                  </span>
                  <span className="font-semibold">{a.titulo}</span>
                  <span className="text-xs text-tinta-suave">{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={`/manutencao/manutencao?id=${a.manutencaoId}`} className="font-medium text-violeta-600 hover:underline"
                      onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                      Ver manutenção
                    </Link>
                    {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso da manutenção ${a.titulo}`}>Marcar como visto</Botao>}
                  </span>
                </li>
              );
            }
            return (
              <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <Selo tom={a.tipo === "SEM_RESPONSAVEL" || a.tipo === "PENDENCIA_PARADA" ? "info" : "atencao"}>{TIPOS_AVISO[a.tipo as keyof typeof TIPOS_AVISO]}</Selo>
                  {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                </span>
                <span><strong className="font-semibold">{a.protocolo}</strong> {a.assunto ?? "Pedido privado"}</span>
                <span className="text-xs text-tinta-suave">{escalado ? "Escalado a você. " : ""}{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                <span className="flex flex-wrap gap-2">
                  <Link href={`/pedidos/pedido?id=${a.pedidoId}`} className="font-medium text-violeta-600 hover:underline"
                    onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                    Ver pedido {a.protocolo}
                  </Link>
                  {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso do pedido ${a.protocolo}`}>Marcar como visto</Botao>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Aviso tom="neutro">Ver o aviso não resolve o pedido. Avisos com mais de 30 dias saem da lista; o histórico do pedido guarda tudo.</Aviso>
    </div>
  );
}

/** O sino na barra superior. */
export function SinoAvisos({ naoVistos }: { naoVistos: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {/* A contagem vem do CSS (data-contagem): o nome do botão diz a mesma coisa por extenso. */}
      <button type="button" onClick={() => setAberto(true)} className="emblema" data-contagem={naoVistos || undefined}
        aria-label={naoVistos ? `Avisos (${naoVistos}) sem ver` : "Avisos"}>
        <Icone nome="sino" />
      </button>
      <Dialogo aberto={aberto} titulo="Avisos" aoFechar={() => setAberto(false)}>
        {aberto ? <Lista aoFechar={() => setAberto(false)} /> : null}
        <div className="flex justify-end"><Botao variante="discreto" onClick={() => setAberto(false)}>Fechar</Botao></div>
      </Dialogo>
    </>
  );
}
