"use client";
// Avisos dentro do painel (passo 6; F6.1, F6.2, AT-08, AT-09): o sino na barra superior com
// quantos estão sem ver e a lista dos últimos 30 dias. Cada aviso leva ao pedido. Marcar como
// visto não resolve o pedido: ele só sai dos vencidos quando o morador recebe um retorno. Também
// chegam aqui o retorno vencido da manutenção (R6), o documento perto de vencer (R1), o pedido de
// documento pelo mural e o e-mail que voltou ou foi marcado como spam (CD-13, CD-14).

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
            if (a.tipo === "MANUTENCAO_RETORNO_VENCIDO" || a.tipo === "PRESTADOR_IMPEDIMENTO" || a.tipo === "PRESTADOR_TERMINOU") {
              return (
                <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Selo tom="atencao">{a.tipo === "MANUTENCAO_RETORNO_VENCIDO" ? "Manutenção" : "Prestador"}</Selo>
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
