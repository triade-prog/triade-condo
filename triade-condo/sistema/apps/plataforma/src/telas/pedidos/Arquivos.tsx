"use client";
// Fotos e documentos do pedido (design "Telas do passo 4b"; F4.8, PT-07): a aba com os arquivos
// por parte do pedido, a janela de enviar, o visualizador e tirar do pedido. O arquivo vai
// direto para o armazenamento privado por um link de envio, e só abre depois que a API confere
// o conteúdo; abrir e baixar usam um link de 5 minutos.

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ARQUIVOS_POR_ENVIO, conferirAntesDeEnviar, mostrarTamanho, PARTES_ARQUIVO, type ParteArquivo,
} from "@triade/domain";
import { Botao, CampoTexto, chamarApi, Dialogo, ErroCarregar, Carregando, Selo, textoDoErro, Vazio, type Resposta } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { diaHora } from "./comum.tsx";

export interface ArquivoPedido {
  id: string;
  parte: ParteArquivo;
  nome: string;
  descricao?: string;
  tipo: string;
  tamanho: number;
  situacao: "ENVIANDO" | "LIBERADO" | "NAO_LIBERADO";
  motivoRecusa?: string;
  enviadoEm: string;
  enviadoPor: string;
  podeTirar: boolean;
}

export interface ArquivosDoPedido {
  arquivos: ArquivoPedido[];
  pode: { enviar: boolean; enviarConclusao: boolean };
}

/** Arquivo escolhido na tela, antes e durante o envio. */
export interface ItemEnvio {
  chave: string;
  arquivo: File;
  descricao: string;
  problema: string | null;
  progresso: number;
}

export interface ResultadoEnvio {
  nome: string;
  liberado: boolean;
  motivo?: string;
}

const ehFoto = (tipo: string) => tipo.startsWith("image/");
const ACEITOS = "image/jpeg,image/png,image/webp,application/pdf";

/** Envia ao armazenamento com PUT, mostrando o progresso. */
function subir(url: string, arquivo: File, tipo: string, aoProgresso: (p: number) => void): Promise<boolean> {
  return new Promise((resolver) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("content-type", tipo);
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgresso(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => resolver(x.status >= 200 && x.status < 300);
    x.onerror = () => resolver(false);
    x.send(arquivo);
  });
}

/** Envia os arquivos um a um: pede o link, sobe o arquivo e pede a verificação. */
export async function enviarArquivos(pedidoId: string, parte: ParteArquivo, itens: ItemEnvio[],
  aoProgresso: (chave: string, p: number) => void = () => {}): Promise<ResultadoEnvio[]> {
  const base = `/v1/condominio/pedidos/${pedidoId}/arquivos`;
  const resultados: ResultadoEnvio[] = [];
  for (const item of itens.filter((i) => !i.problema)) {
    const nome = item.arquivo.name;
    const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(base, { corpo: {
      parte, nome, descricao: item.descricao.trim() || null, tipo: item.arquivo.type, tamanho: item.arquivo.size,
    } });
    if (!inicio.ok) { resultados.push({ nome, liberado: false, motivo: textoDoErro(inicio.erro) }); continue; }
    const subiu = await subir(inicio.dados.envio.url, item.arquivo, inicio.dados.envio.tipo, (p) => aoProgresso(item.chave, p));
    const fim = await chamarApi<{ situacao: string; motivo?: string }>(`${base}/${inicio.dados.arquivoId}/verificar`, { corpo: {} });
    if (!fim.ok) { resultados.push({ nome, liberado: false, motivo: textoDoErro(fim.erro) }); continue; }
    resultados.push(fim.dados.situacao === "LIBERADO" ? { nome, liberado: true }
      : { nome, liberado: false, motivo: fim.dados.motivo ?? (subiu ? "O arquivo não foi liberado." : "O envio não terminou. Envie de novo.") });
  }
  return resultados;
}

/** Frase curta do resultado, para o aviso da tela. */
export function resumoEnvio(r: ResultadoEnvio[]): { tom: "ok" | "atencao"; texto: string } | null {
  if (!r.length) return null;
  const ok = r.filter((x) => x.liberado).length;
  const falhas = r.filter((x) => !x.liberado);
  const inicio = ok === 1 ? "1 arquivo enviado e liberado." : ok > 1 ? `${ok} arquivos enviados e liberados.` : "";
  if (!falhas.length) return { tom: "ok", texto: inicio };
  return { tom: "atencao", texto: [inicio, ...falhas.map((f) => `${f.nome}: ${f.motivo ?? "não foi liberado."}`)].filter(Boolean).join(" ") };
}

/**
 * Escolher arquivos: do computador, arrastando ou, no celular, tirando foto na hora. Cada um
 * tem descrição opcional; o que não pode ir diz o motivo e não impede os outros.
 */
export function EscolherArquivos({ itens, aoMudar, rotulo, enviando }: {
  itens: ItemEnvio[];
  aoMudar: (itens: ItemEnvio[]) => void;
  rotulo: string;
  enviando?: boolean;
}) {
  const escolher = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function incluir(lista: FileList | null) {
    if (!lista?.length) return;
    const novos = [...lista].map((arquivo, i) => ({
      chave: `${Date.now()}-${i}-${arquivo.name}`, arquivo, descricao: "", progresso: 0, problema: conferirAntesDeEnviar(arquivo),
    }));
    const todos = [...itens, ...novos];
    setAviso(todos.length > ARQUIVOS_POR_ENVIO ? `Até ${ARQUIVOS_POR_ENVIO} de uma vez; os outros ficaram de fora.` : null);
    aoMudar(todos.slice(0, ARQUIVOS_POR_ENVIO));
    if (escolher.current) escolher.current.value = "";
    if (camera.current) camera.current.value = "";
  }
  const soltar = (e: DragEvent) => { e.preventDefault(); if (!enviando) incluir(e.dataTransfer.files); };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{rotulo}</legend>
      <div onDragOver={(e) => e.preventDefault()} onDrop={soltar}
        className="grid justify-items-center gap-2 rounded-lg border border-dashed border-contorno bg-superficie-2 p-3 text-center text-sm">
        <div className="flex flex-wrap justify-center gap-2">
          <Botao variante="secundario" disabled={enviando} onClick={() => escolher.current?.click()}>Escolher arquivos</Botao>
          <Botao variante="secundario" disabled={enviando} onClick={() => camera.current?.click()}>Tirar foto</Botao>
        </div>
        <span className="text-xs text-tinta-suave">Ou arraste aqui. Fotos (JPG, PNG, WEBP) e PDF, até 10 MB cada e {ARQUIVOS_POR_ENVIO} de uma vez.</span>
        <input ref={escolher} type="file" multiple accept={ACEITOS} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => incluir(e.target.files)} />
        <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => incluir(e.target.files)} />
      </div>
      {aviso ? <p className="text-xs text-atencao">{aviso}</p> : null}
      {itens.length ? (
        <ul className="grid gap-2" aria-label="Arquivos escolhidos">
          {itens.map((it) => (
            <li key={it.chave} className={`grid gap-1.5 rounded-lg border px-3 py-2 text-sm ${it.problema ? "border-atencao-borda bg-atencao-fundo" : "border-linha bg-superficie"}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="font-medium">{it.arquivo.name}</span>
                  {it.problema ? <span className="text-atencao"> {it.problema}</span>
                    : <span className="text-xs text-tinta-suave"> · {mostrarTamanho(it.arquivo.size)}{enviando ? ` · ${it.progresso}%` : ""}</span>}
                </span>
                {!enviando ? <Botao variante="texto" aria-label={`Tirar ${it.arquivo.name} da lista`}
                  onClick={() => aoMudar(itens.filter((x) => x.chave !== it.chave))}>Tirar</Botao> : null}
              </span>
              {!it.problema ? (
                <CampoTexto id={`desc-${it.chave}`} rotulo={`Descrição de ${it.arquivo.name}`} opcional maxLength={300} value={it.descricao} disabled={enviando}
                  onChange={(e) => aoMudar(itens.map((x) => (x.chave === it.chave ? { ...x, descricao: e.target.value } : x)))} />
              ) : null}
              {enviando && !it.problema ? <progress className="h-1.5 w-full accent-[var(--color-acao)]" max={100} value={it.progresso} aria-label={`Envio de ${it.arquivo.name}`} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

/** Janela "Enviar arquivos" do pedido. */
export function JanelaEnviarArquivos({ aberto, pedidoId, protocolo, parte, aoFechar, enviado }: {
  aberto: boolean;
  pedidoId: string;
  protocolo: string;
  parte: ParteArquivo;
  aoFechar: () => void;
  enviado: (r: ResultadoEnvio[]) => void;
}) {
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const validos = itens.filter((i) => !i.problema).length;
  const fechar = () => { if (enviando) return; setItens([]); aoFechar(); };

  async function enviar() {
    setEnviando(true);
    const r = await enviarArquivos(pedidoId, parte, itens, (chave, p) => setItens((xs) => xs.map((x) => (x.chave === chave ? { ...x, progresso: p } : x))));
    setEnviando(false);
    setItens([]);
    enviado(r);
  }

  return (
    <Dialogo aberto={aberto} titulo={`Enviar arquivos · ${protocolo}`} aoFechar={fechar}>
      {aberto ? (
        <div className="grid gap-4">
          <EscolherArquivos rotulo={`Fotos e documentos · ${PARTES_ARQUIVO[parte].toLowerCase()}`} itens={itens} aoMudar={setItens} enviando={enviando} />
          <p className="text-xs text-tinta-suave">O nome do arquivo é só para mostrar. Antes de liberar, o sistema confere o conteúdo e tira a localização das fotos.</p>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={fechar} disabled={enviando}>Cancelar</Botao>
            <Botao disabled={!validos || enviando} onClick={() => void enviar()}>
              {enviando ? "Enviando…" : validos === 1 ? "Enviar 1 arquivo" : `Enviar ${validos} arquivos`}
            </Botao>
          </div>
        </div>
      ) : null}
    </Dialogo>
  );
}

/** Link de 5 minutos para abrir ou baixar um arquivo liberado. */
async function linkDo(pedidoId: string, arquivoId: string, baixar = false): Promise<Resposta<{ url: string }>> {
  return chamarApi<{ url: string }>(`/v1/condominio/pedidos/${pedidoId}/arquivos/${arquivoId}/link${baixar ? "?baixar=1" : ""}`);
}

function Miniatura({ pedidoId, a }: { pedidoId: string; a: ArquivoPedido }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ehFoto(a.tipo) || a.situacao !== "LIBERADO") return;
    let vivo = true;
    void linkDo(pedidoId, a.id).then((r) => { if (vivo && r.ok) setUrl(r.dados.url); });
    return () => { vivo = false; };
  }, [pedidoId, a.id, a.tipo, a.situacao]);
  const base = "grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md text-[10px] font-bold";
  if (!ehFoto(a.tipo)) return <span aria-hidden="true" className={`${base} bg-erro-fundo text-erro`}>PDF</span>;
  return (
    <span aria-hidden="true" className={`${base} bg-superficie-2`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de 5 min do armazenamento privado: não passa pelo otimizador nem por cache */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  );
}

/** Aba "Fotos e documentos" do pedido. */
export function AbaArquivos({ pedidoId, protocolo, carga, avisar }: {
  pedidoId: string;
  protocolo: string;
  carga: { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: ArquivosDoPedido };
  avisar: (r: { tom: "ok" | "atencao"; texto: string } | null, recarregar?: boolean) => void;
}) {
  const [enviar, setEnviar] = useState(false);
  const [vendo, setVendo] = useState<number | null>(null);
  const [tirar, setTirar] = useState<ArquivoPedido | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando os arquivos…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={() => avisar(null, true)} />;
  const { arquivos, pode } = carga.dados;
  const parte: ParteArquivo = pode.enviar ? "ANDAMENTO" : "CONCLUSAO";
  const podeEnviar = pode.enviar || pode.enviarConclusao;
  const liberadas = arquivos.filter((a) => a.situacao === "LIBERADO" && ehFoto(a.tipo));

  async function abrir(a: ArquivoPedido) {
    if (ehFoto(a.tipo)) return setVendo(liberadas.findIndex((x) => x.id === a.id));
    // O PDF abre em outra aba: a aba nasce no clique, para o navegador não bloquear.
    const aba = window.open("about:blank", "_blank");
    const r = await linkDo(pedidoId, a.id);
    if (!r.ok) { aba?.close(); return avisar({ tom: "atencao", texto: textoDoErro(r.erro) }); }
    if (aba) aba.location.href = r.dados.url;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-tinta-suave">Os arquivos são privados do condomínio. Cada vez que alguém abre, o link vale por 5 minutos.</p>
        {podeEnviar ? <Botao variante="secundario" onClick={() => setEnviar(true)}>+ Enviar arquivos</Botao> : null}
      </div>
      {arquivos.length === 0 ? <Vazio titulo="Nenhuma foto ou documento ainda.">Fotos do problema, orçamentos e notas ficam aqui, só para quem vê o pedido.</Vazio> : (
        (Object.keys(PARTES_ARQUIVO) as ParteArquivo[]).map((p) => {
          const daParte = arquivos.filter((a) => a.parte === p);
          if (!daParte.length) return null;
          return (
            <section key={p} aria-labelledby={`arq-${p}`} className="grid gap-2">
              <h3 id={`arq-${p}`} className="text-sm font-semibold">{PARTES_ARQUIVO[p]}</h3>
              <ul className="grid gap-2">
                {daParte.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-linha bg-superficie px-3 py-2 text-sm">
                    <Miniatura pedidoId={pedidoId} a={a} />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      {a.situacao === "LIBERADO"
                        ? <button type="button" className="w-fit [overflow-wrap:anywhere] text-left font-medium text-acao hover:underline" onClick={() => void abrir(a)}>{a.nome}</button>
                        : <span className="font-medium [overflow-wrap:anywhere]">{a.nome}</span>}
                      {a.descricao ? <span className="text-xs">{a.descricao}</span> : null}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tinta-suave">
                        {a.situacao === "ENVIANDO" ? <Selo tom="info" marca="pausa">Verificando</Selo> : null}
                        {a.situacao === "NAO_LIBERADO" ? <Selo tom="atencao" marca="atencao">Não liberado</Selo> : null}
                        {a.situacao === "NAO_LIBERADO" ? <span className="text-atencao">{a.motivoRecusa}</span>
                          : <span>{ehFoto(a.tipo) ? "Foto" : "PDF"} · {mostrarTamanho(a.tamanho)} · {a.enviadoPor} · {diaHora(a.enviadoEm)}</span>}
                      </span>
                    </span>
                    {a.podeTirar ? <Botao variante="texto" aria-label={`Tirar ${a.nome} do pedido`} onClick={() => setTirar(a)}>Tirar</Botao> : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <JanelaEnviarArquivos aberto={enviar} pedidoId={pedidoId} protocolo={protocolo} parte={parte} aoFechar={() => setEnviar(false)}
        enviado={(r) => { setEnviar(false); avisar(resumoEnvio(r), true); }} />
      <Visualizador pedidoId={pedidoId} fotos={liberadas} indice={vendo} aoMudar={setVendo}
        aoTirar={(a) => { setVendo(null); setTirar(a); }} />
      <Janela aberto={tirar !== null} titulo={tirar ? `Tirar ${tirar.nome} do pedido` : "Tirar do pedido"} aoFechar={() => setTirar(null)}
        campos={[{ id: "motivo", rotulo: "Por que tirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Tirar do pedido"
        explicacao="O arquivo some do pedido para todos e a retirada fica no histórico, com o motivo. Ele não é apagado na hora."
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/pedidos/${pedidoId}/arquivos/${tirar?.id}/tirar`, { corpo: { motivo: String(v.motivo ?? "").trim() } });
          if (r.ok) { setTirar(null); avisar({ tom: "ok", texto: "Arquivo tirado do pedido." }, true); }
          return r;
        }} />
    </div>
  );
}

/** Foto grande, com setas para as outras, baixar e tirar do pedido. */
function Visualizador({ pedidoId, fotos, indice, aoMudar, aoTirar }: {
  pedidoId: string;
  fotos: ArquivoPedido[];
  indice: number | null;
  aoMudar: (i: number | null) => void;
  aoTirar: (a: ArquivoPedido) => void;
}) {
  const a = indice !== null ? fotos[indice] : undefined;
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  useEffect(() => {
    if (!a) return;
    let vivo = true;
    void linkDo(pedidoId, a.id).then((r) => {
      if (!vivo) return;
      if (r.ok) { setUrl({ id: a.id, url: r.dados.url }); setFalha(null); } else setFalha(textoDoErro(r.erro));
    });
    return () => { vivo = false; };
  }, [pedidoId, a]);

  async function baixar() {
    if (!a) return;
    const r = await linkDo(pedidoId, a.id, true);
    if (!r.ok) return setFalha(textoDoErro(r.erro));
    window.location.href = r.dados.url;
  }

  return (
    <Dialogo aberto={!!a} titulo={a ? `${a.nome} · ${indice! + 1} de ${fotos.length}` : "Foto"} aoFechar={() => aoMudar(null)}>
      {a ? (
        <div className="grid gap-3">
          {falha ? <p className="text-sm text-atencao">{falha}</p> : null}
          <div className="grid min-h-48 place-items-center overflow-hidden rounded-lg bg-superficie-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de 5 min do armazenamento privado: não passa pelo otimizador nem por cache */}
            {url?.id === a.id ? <img src={url.url} alt={a.descricao ?? a.nome} className="max-h-[60vh] w-full object-contain" /> : <span className="text-sm text-tinta-suave">Carregando a foto…</span>}
          </div>
          <p className="text-sm">{a.descricao ? `${a.descricao} · ` : ""}<span className="text-tinta-suave">{PARTES_ARQUIVO[a.parte]} · {a.enviadoPor} · {diaHora(a.enviadoEm)} · {mostrarTamanho(a.tamanho)}</span></p>
          <div className="flex flex-wrap justify-between gap-2">
            <Botao variante="secundario" disabled={indice === 0} onClick={() => aoMudar(indice! - 1)}>Anterior</Botao>
            {a.podeTirar ? <Botao variante="secundario" onClick={() => aoTirar(a)}>Tirar do pedido</Botao> : null}
            <Botao variante="secundario" onClick={() => void baixar()}>Baixar</Botao>
            <Botao variante="secundario" disabled={indice === fotos.length - 1} onClick={() => aoMudar(indice! + 1)}>Próxima</Botao>
          </div>
          <div className="flex justify-end"><Botao onClick={() => aoMudar(null)}>Fechar</Botao></div>
        </div>
      ) : null}
    </Dialogo>
  );
}
