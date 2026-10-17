"use client";
// Fotos e documentos da manutenção (MP-07, PT-07): as mesmas regras dos pedidos. O arquivo vai
// direto ao armazenamento privado por um link de envio e só abre depois que a API confere o
// conteúdo; abrir usa um link de 5 minutos. Tirar pede motivo e não apaga.

import { useState } from "react";
import { mostrarTamanho } from "@triade/domain";
import { Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { EscolherArquivos, resumoEnvio, subir, type ItemEnvio, type ResultadoEnvio } from "../pedidos/Arquivos.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ItemVistoria } from "../tipos.ts";

interface ArquivoManutencao {
  id: string;
  itemId?: string;
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

async function enviar(manutencaoId: string, itemId: string | null, itens: ItemEnvio[], aoProgresso: (chave: string, p: number) => void) {
  const base = `/v1/condominio/manutencao/${manutencaoId}/arquivos`;
  const resultados: ResultadoEnvio[] = [];
  for (const item of itens.filter((i) => !i.problema)) {
    const nome = item.arquivo.name;
    const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(base, { corpo: {
      itemId, nome, descricao: item.descricao.trim() || null, tipo: item.arquivo.type, tamanho: item.arquivo.size,
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

export function ArquivosManutencao({ manutencaoId, itens, avisar }: {
  manutencaoId: string;
  itens: ItemVistoria[];
  avisar: (r: { tom: "ok" | "atencao"; texto: string } | null, recarregar?: boolean) => void;
}) {
  const carga = useCarregar<{ arquivos: ArquivoManutencao[]; pode: { enviar: boolean } }>(`/v1/condominio/manutencao/${manutencaoId}/arquivos`);
  const [abrindo, setAbrindo] = useState(false);
  const [escolhidos, setEscolhidos] = useState<ItemEnvio[]>([]);
  const [item, setItem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [tirar, setTirar] = useState<ArquivoManutencao | null>(null);

  if (carga.estado === "carregando") return <Carregando linhas={2} rotulo="Carregando os arquivos…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const { arquivos, pode } = carga.dados;
  const validos = escolhidos.filter((i) => !i.problema).length;
  const nomeItem = (id?: string) => itens.find((i) => i.id === id)?.texto;

  async function abrir(a: ArquivoManutencao) {
    const aba = window.open("about:blank", "_blank");
    const r = await chamarApi<{ url: string }>(`/v1/condominio/manutencao/${manutencaoId}/arquivos/${a.id}/link`);
    if (!r.ok) { aba?.close(); return avisar({ tom: "atencao", texto: textoDoErro(r.erro) }); }
    if (aba) aba.location.href = r.dados.url;
  }

  async function mandar() {
    setEnviando(true);
    const r = await enviar(manutencaoId, item || null, escolhidos,
      (chave, p) => setEscolhidos((xs) => xs.map((x) => (x.chave === chave ? { ...x, progresso: p } : x))));
    setEnviando(false);
    setEscolhidos([]);
    setAbrindo(false);
    avisar(resumoEnvio(r));
    carga.recarregar();
  }

  return (
    <section aria-labelledby="t-arquivos" className="grid content-start gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="t-arquivos" className="text-lg font-medium">Fotos e documentos</h2>
        {pode.enviar ? <Botao variante="contorno" tamanho="m" onClick={() => setAbrindo(true)}>+ Enviar</Botao> : null}
      </div>
      {arquivos.length === 0 ? <Vazio titulo="Nenhum arquivo ainda">Fotos do antes e do depois, orçamentos e laudos ficam aqui.</Vazio> : (
        <ul className="grid gap-2">
          {arquivos.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-linha px-3 py-2 text-sm">
              <span className="grid min-w-0 flex-1 gap-0.5">
                {a.situacao === "LIBERADO"
                  ? <button type="button" className="w-fit text-left font-medium text-violeta-600 [overflow-wrap:anywhere] hover:underline" onClick={() => void abrir(a)}>{a.nome}</button>
                  : <span className="font-medium [overflow-wrap:anywhere]">{a.nome}</span>}
                {a.descricao ? <span className="text-xs">{a.descricao}</span> : null}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tinta-suave">
                  {a.situacao === "ENVIANDO" ? <Selo tom="info">Verificando</Selo> : null}
                  {a.situacao === "NAO_LIBERADO" ? <Selo tom="atencao">Não liberado</Selo> : null}
                  {a.situacao === "NAO_LIBERADO" ? <span className="text-atencao">{a.motivoRecusa}</span>
                    : <span>{a.tipo.startsWith("image/") ? "Foto" : "PDF"} · {mostrarTamanho(a.tamanho)} · {a.enviadoPor} · {diaHora(a.enviadoEm)}{a.tipo.startsWith("image/") ? " · sem localização" : ""}</span>}
                  {a.itemId ? <span>· {nomeItem(a.itemId) ?? "item da vistoria"}</span> : null}
                </span>
              </span>
              {a.podeTirar ? <Botao variante="discreto" aria-label={`Tirar ${a.nome} da manutenção`} onClick={() => setTirar(a)}>Tirar</Botao> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">Privados do condomínio. Cada vez que alguém abre, o link vale por 5 minutos.</p>

      <Dialogo aberto={abrindo} titulo="Enviar fotos e documentos" aoFechar={() => { if (!enviando) { setEscolhidos([]); setAbrindo(false); } }}>
        {abrindo ? (
          <div className="grid gap-4">
            {itens.length ? (
              <label className="grid gap-1 text-sm">
                <span className="text-[13px] font-medium">Do item da vistoria <span className="font-normal text-tinta-suave">(opcional)</span></span>
                <select className="campo" value={item} onChange={(e) => setItem(e.target.value)} disabled={enviando}>
                  <option value="">Da manutenção toda</option>
                  {itens.map((i) => <option key={i.id} value={i.id}>{i.texto}</option>)}
                </select>
              </label>
            ) : null}
            <EscolherArquivos rotulo="Fotos e documentos" itens={escolhidos} aoMudar={setEscolhidos} enviando={enviando} />
            <p className="text-xs text-tinta-suave">Antes de liberar, o sistema confere o conteúdo e tira a localização das fotos.</p>
            <div className="flex justify-end gap-2">
              <Botao variante="discreto" disabled={enviando} onClick={() => { setEscolhidos([]); setAbrindo(false); }}>Cancelar</Botao>
              <Botao disabled={!validos || enviando} onClick={() => void mandar()}>
                {enviando ? "Enviando…" : validos === 1 ? "Enviar 1 arquivo" : `Enviar ${validos} arquivos`}
              </Botao>
            </div>
          </div>
        ) : null}
      </Dialogo>
      <Janela aberto={tirar !== null} titulo={tirar ? `Tirar ${tirar.nome}` : "Tirar arquivo"} aoFechar={() => setTirar(null)}
        campos={[{ id: "motivo", rotulo: "Por que tirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
        iniciais={{ motivo: "" }} textoBotao="Tirar da manutenção"
        explicacao="O arquivo some para todos e a retirada fica no histórico, com o motivo. Ele não é apagado na hora."
        aoSalvar={async (v) => {
          const r = await chamarApi(`/v1/condominio/manutencao/${manutencaoId}/arquivos/${tirar?.id}/tirar`, { corpo: { motivo: String(v.motivo ?? "").trim() } });
          if (r.ok) { setTirar(null); avisar({ tom: "ok", texto: "Arquivo tirado da manutenção." }); carga.recarregar(); }
          return r;
        }} />
    </section>
  );
}
