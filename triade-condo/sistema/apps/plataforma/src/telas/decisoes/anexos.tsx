"use client";
// Anexos da decisão e da despesa (R5; quadros 419 e 420): fatura, nota, orçamento e, depois de
// aprovada, o comprovante do pagamento feito fora do sistema. O arquivo vai direto ao
// armazenamento privado (o mesmo do pedido) e só abre depois que a API confere o conteúdo; abrir
// usa um link de 5 minutos.

import { useState } from "react";
import { ANEXOS_POR_APROVACAO, mostrarTamanho } from "@triade/domain";
import { Botao, chamarApi, Dialogo, Icone, Selo, textoDoErro } from "@triade/ui";
import { EscolherArquivos, subir, type ItemEnvio, type ResultadoEnvio } from "../pedidos/Arquivos.tsx";
import type { AnexoAprovacao } from "../tipos.ts";

export type ItemAprovacao = { tipo: "decisoes" | "despesas"; id: string };

/** Envia um a um: pede o link, sobe e pede a verificação. Devolve o resultado e o id de cada liberado. */
export async function enviarAnexos(item: ItemAprovacao, parte: AnexoAprovacao["parte"], itens: ItemEnvio[],
  aoProgresso: (chave: string, p: number) => void = () => {}): Promise<(ResultadoEnvio & { id?: string })[]> {
  const resultados: (ResultadoEnvio & { id?: string })[] = [];
  for (const it of itens.filter((i) => !i.problema)) {
    const nome = it.arquivo.name;
    const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(`/v1/condominio/${item.tipo}/${item.id}/anexos`, {
      corpo: { parte, nome, tipo: it.arquivo.type, tamanho: it.arquivo.size },
    });
    if (!inicio.ok) { resultados.push({ nome, liberado: false, motivo: textoDoErro(inicio.erro) }); continue; }
    await subir(inicio.dados.envio.url, it.arquivo, inicio.dados.envio.tipo, (p) => aoProgresso(it.chave, p));
    const fim = await chamarApi<{ situacao: string; motivo?: string }>(`/v1/condominio/aprovacoes/anexos/${inicio.dados.arquivoId}/verificar`, { corpo: {} });
    if (!fim.ok) { resultados.push({ nome, liberado: false, motivo: textoDoErro(fim.erro) }); continue; }
    resultados.push(fim.dados.situacao === "LIBERADO" ? { nome, liberado: true, id: inicio.dados.arquivoId }
      : { nome, liberado: false, motivo: fim.dados.motivo ?? "O arquivo não foi liberado." });
  }
  return resultados;
}

/** Abre o anexo numa aba nova, pelo link de 5 minutos. */
export async function abrirAnexo(id: string): Promise<string | null> {
  const aba = window.open("about:blank", "_blank");
  const r = await chamarApi<{ url: string }>(`/v1/condominio/aprovacoes/anexos/${id}/link`);
  if (!r.ok) { aba?.close(); return textoDoErro(r.erro); }
  if (aba) aba.location.href = r.dados.url;
  return null;
}

/** Os anexos, cada um abrindo numa aba; com Anexar quando ainda dá. */
export function ListaAnexos({ anexos, anexar, rotulo = "Anexos" }: { anexos: AnexoAprovacao[]; anexar?: () => void; rotulo?: string }) {
  const [falha, setFalha] = useState<string | null>(null);
  return (
    <section className="grid gap-2">
      <h3 className="t-rotulo">{rotulo}</h3>
      {anexos.length ? (
        <ul className="grid gap-2">
          {anexos.map((a) => (
            <li key={a.id}>
              {a.situacao && a.situacao !== "LIBERADO" ? (
                <span className="flex items-center gap-2.5 rounded-xl border border-linha bg-fundo px-3 py-2.5 t-texto">
                  <Icone nome="clipe" />{a.nome}<Selo tom="atencao">{a.situacao === "ENVIANDO" ? "Enviando" : "Não liberado"}</Selo>
                </span>
              ) : (
                <Botao variante="discreto" className="w-full justify-start rounded-xl border border-linha bg-fundo text-tinta"
                  onClick={() => void abrirAnexo(a.id).then(setFalha)}>
                  <Icone nome="clipe" /><span className="min-w-0 flex-1 truncate text-left"><span className="sr-only">Abrir </span>{a.nome}</span>
                  <span className="t-apoio">{a.parte === "COMPROVANTE" ? "Comprovante" : a.tipo === "application/pdf" ? "PDF" : "Foto"} · {mostrarTamanho(a.tamanho)}</span>
                </Botao>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio">Nenhum anexo.</p>}
      {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
      {anexar && anexos.length < ANEXOS_POR_APROVACAO ? (
        <Botao variante="secundario" tamanho="m" className="justify-self-start" onClick={anexar}><Icone nome="clipe" />{anexos.length ? "Anexar outro" : "Anexar"}</Botao>
      ) : null}
    </section>
  );
}

/** A janela de anexar: escolher, enviar e dizer o que foi liberado. */
export function JanelaAnexar({ item, parte = "DOCUMENTO", titulo, aberto, aoFechar, enviado }: {
  item: ItemAprovacao; parte?: AnexoAprovacao["parte"]; titulo: string; aberto: boolean; aoFechar: () => void; enviado: (texto: string, ids: string[]) => void;
}) {
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const validos = itens.filter((i) => !i.problema).length;
  const fechar = () => { if (enviando) return; setItens([]); aoFechar(); };
  async function enviar() {
    setEnviando(true);
    const r = await enviarAnexos(item, parte, itens, (chave, p) => setItens((xs) => xs.map((x) => (x.chave === chave ? { ...x, progresso: p } : x))));
    setEnviando(false);
    setItens([]);
    enviado(textoDoEnvio(r), r.filter((x) => x.id).map((x) => x.id!));
  }
  return (
    <Dialogo aberto={aberto} titulo={titulo} aoFechar={fechar}>
      {aberto ? (
        <div className="grid gap-4">
          <EscolherArquivos rotulo={parte === "COMPROVANTE" ? "Comprovante do pagamento" : "Fatura, nota ou orçamento"} itens={itens} aoMudar={setItens} enviando={enviando} />
          <p className="t-apoio">Antes de liberar, o sistema confere o conteúdo e tira a localização das fotos.</p>
          <div className="flex justify-end gap-2">
            <Botao variante="discreto" onClick={fechar} disabled={enviando}>Cancelar</Botao>
            <Botao disabled={!validos || enviando} onClick={() => void enviar()}>{enviando ? "Enviando…" : validos === 1 ? "Enviar 1 arquivo" : `Enviar ${validos} arquivos`}</Botao>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}

/** "2 anexos liberados." e o que não foi, com o motivo. */
export function textoDoEnvio(r: ResultadoEnvio[]): string {
  const ok = r.filter((x) => x.liberado).length;
  const falhas = r.filter((x) => !x.liberado).map((x) => `${x.nome}: ${x.motivo ?? "não foi liberado."}`);
  return [ok === 1 ? "1 anexo liberado." : ok ? `${ok} anexos liberados.` : "", ...falhas].filter(Boolean).join(" ");
}
