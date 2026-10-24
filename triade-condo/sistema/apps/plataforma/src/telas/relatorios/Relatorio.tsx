"use client";
// O relatório gerado (TR-02, TR-05, TR-08, TR-10; canvas do novo frontend, quadros 234 e 235,
// decisões B.1 e D.1 de 23/10/2026): a folha como sai no PDF, com as partes numeradas e o rodapé
// de quando são os números. Baixar o PDF junta a folha, as fotos e as páginas dos PDFs anexados
// num arquivo só, no navegador, pelos links de 5 minutos. Baixar as tabelas dá a planilha com as
// mesmas linhas. Gerar de novo abre o montar com estas escolhas: vira a versão seguinte.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  letraDoAnexo, nomeDoArquivoRelatorio, periodoDoMes, PARTES_RELATORIO, PERMISSOES, planilhaDoRelatorio, rodapeDoRelatorio, tabelasDoRelatorio, tituloDoMes,
  type RelatorioGerado, type Tabela,
} from "@triade/domain";
import { Aviso, Botao, Carregando, chamarApi, classeBotao, ErroCarregar, Icone, SemPermissao, Selo } from "@triade/ui";
import { abrirLink } from "../comunicados/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import { baixarArquivo, quandoGerado, Voltar } from "./comum.tsx";
import type { AnexoBaixado } from "./pdf.ts";

const TH = "px-3 py-2 max-md:px-1.5 t-apoio font-semibold text-tinta-suave";
const TD = "px-3 py-2.5 max-md:px-1.5 border-t border-linha";

function TabelaDaFolha({ t, titulo }: { t: Tabela; titulo: string }) {
  return (
    <table className="w-full t-texto max-md:text-[13px]">
      <caption className="sr-only">{titulo}</caption>
      <thead><tr>{t.cabecalho.map((c, i) => <th key={i} scope="col" className={`${TH} ${i ? "text-right" : "pl-0 text-left"}`}>{c || <span className="sr-only">Item</span>}</th>)}</tr></thead>
      <tbody>
        {t.linhas.map((l, k) => (
          <tr key={k}>
            {l.map((c, i) => (i === 0
              ? <th key={i} scope="row" className={`${TD} pl-0 text-left font-medium`}>{c}</th>
              : <td key={i} className={`${TD} text-right ${c === "sem dados" ? "text-tinta-suave" : ""}`}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A folha do relatório, como sai no PDF. */
function Folha({ r, condominio, gerado, abrir }: { r: RelatorioGerado; condominio: string; gerado: string; abrir: (ordem: number) => void }) {
  const tabelas = new Map(tabelasDoRelatorio(r).map((t) => [t.parte, t]));
  const autor = r.conteudo.autor;
  let n = 0;
  return (
    <article aria-label={`Relatório de ${tituloDoMes(r.mes).toLowerCase()}`}
      className="mx-auto grid w-full max-w-[820px] gap-5 rounded-[6px] border border-linha bg-superficie px-12 py-10 shadow-s2 max-md:px-5 max-md:py-6">
      <header className="grid gap-1.5 border-b-2 border-violeta-600 pb-4">
        <p className="flex items-center justify-between gap-3 t-apoio font-semibold uppercase tracking-wide text-tinta-suave">
          <span>{condominio} · Relatório do atendimento</span><span className="text-violeta-600">TRÍADE</span>
        </p>
        <h2 className="t-titulo-tela font-normal tracking-tight">{tituloDoMes(r.mes)}{r.numero > 1 ? ` · versão ${r.numero}` : ""}</h2>
        <p className="t-apoio">{periodoDoMes(r.conteudo)} · gerado em {gerado}{autor ? `, por ${autor.nome}${autor.cargo ? `, ${autor.cargo.toLowerCase()}` : ""}` : ""}</p>
      </header>
      {r.partes.map((p) => {
        const t = tabelas.get(p);
        const texto = p === "RESUMO" ? r.resumo : p === "PALAVRA" ? r.palavra : null;
        if (!t && !texto) return null;
        n++;
        return (
          <section key={p} aria-labelledby={`folha-${p}`} className="grid gap-2">
            <h3 id={`folha-${p}`} className="t-apoio font-bold uppercase tracking-wide text-violeta-700">{n} · {PARTES_RELATORIO[p].titulo}</h3>
            {t ? <TabelaDaFolha t={t.tabela} titulo={t.titulo} /> : <p className="whitespace-pre-line">{texto}</p>}
          </section>
        );
      })}
      {r.anexos.length ? (
        <section aria-labelledby="folha-anexos" className="grid gap-2">
          <h3 id="folha-anexos" className="t-apoio font-bold uppercase tracking-wide text-violeta-700">{n + 1} · Anexos</h3>
          <ul className="grid gap-1.5">
            {r.anexos.map((a, i) => (
              <li key={a.ordem} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Icone nome={a.tipo === "application/pdf" ? "documento" : "camera"} className="h-4 w-4 text-tinta-suave" />
                <span className="font-medium">Anexo {letraDoAnexo(i)} · {a.titulo}</span>
                <span className="t-apoio">{a.tipo === "application/pdf" ? "PDF, segue depois da folha" : "foto, dentro da folha"}</span>
                <button type="button" className="elo" onClick={() => abrir(a.ordem)} aria-label={`Abrir o anexo ${letraDoAnexo(i)}, ${a.titulo}`}>Abrir</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <footer className="border-t border-linha pt-3 t-apoio text-tinta-suave">{rodapeDoRelatorio(r, gerado)}</footer>
    </article>
  );
}

async function baixarBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url);
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export function Relatorio() {
  const { pode } = usePlataforma();
  const busca = useSearchParams();
  const id = busca.get("id");
  const carga = useCarregar<RelatorioGerado>(id && pode("pedidos.ver") ? `/v1/condominio/relatorios/${id}` : null);
  const [fazendo, setFazendo] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const voltar = <Voltar href="/indicadores/relatorios" texto="Relatórios do mês" />;

  if (!pode("pedidos.ver")) return <SemPermissao tela="Relatórios do mês" permissao={PERMISSOES.ACOMPANHAR} />;
  if (!id) return <div className="grid gap-3">{voltar}<Aviso tom="atencao">Abra o relatório pela lista.</Aviso></div>;
  if (carga.estado === "carregando") return <div className="grid gap-3">{voltar}<Carregando rotulo="Abrindo o relatório…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Relatório do mês</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const r = carga.dados;
  const condominio = r.conteudo.condominio ?? "Condomínio";
  const gerado = quandoGerado(r.geradoEm, r.conteudo.fuso);
  const registrar = (formato: "PDF" | "CSV") => chamarApi(`/v1/condominio/relatorios/${r.id}/baixado`, { corpo: { formato } });

  async function abrir(ordem: number) {
    const e = await abrirLink(`/v1/condominio/relatorios/${r.id}/anexos/${ordem}/link`);
    setProblema(e);
  }

  function planilha() {
    setProblema(null);
    baixarArquivo(planilhaDoRelatorio(r), nomeDoArquivoRelatorio(r, "csv"), "text/csv;charset=utf-8");
    void registrar("CSV");
  }

  async function pdf() {
    setProblema(null);
    setFazendo("Preparando o PDF…");
    try {
      const anexos: AnexoBaixado[] = [];
      for (const [i, a] of r.anexos.entries()) {
        setFazendo(`Juntando o anexo ${letraDoAnexo(i)} de ${r.anexos.length}…`);
        const link = await chamarApi<{ url: string }>(`/v1/condominio/relatorios/${r.id}/anexos/${a.ordem}/link`);
        anexos.push({ titulo: a.titulo, tipo: a.tipo, bytes: link.ok ? await baixarBytes(link.dados.url) : null });
      }
      setFazendo("Montando o PDF…");
      const [normal, forte] = await Promise.all(["400", "600"].map((p) => fetch(`/fontes/manrope-latin-${p}-normal.woff`).then((x) => x.arrayBuffer())));
      const { montarPdf } = await import("./pdf.ts");
      const tema = getComputedStyle(document.documentElement);
      const token = (n: string) => tema.getPropertyValue(`--color-${n}`);
      const cores = { tinta: token("tinta"), suave: token("tinta-suave"), linha: token("linha"), violeta: token("violeta-600"), violeta7: token("violeta-700") };
      const bytes = await montarPdf(r, { condominio, geradoEmTexto: gerado, fontes: { normal: normal!, forte: forte! }, cores }, anexos);
      baixarArquivo(bytes as BlobPart, nomeDoArquivoRelatorio(r, "pdf"), "application/pdf");
      const faltou = anexos.filter((a) => !a.bytes).length;
      if (faltou) setProblema(faltou === 1 ? "Um anexo não baixou e ficou como uma linha na folha. Tente de novo em instantes." : `${faltou} anexos não baixaram e ficaram como linhas na folha. Tente de novo em instantes.`);
      void registrar("PDF");
    } catch {
      setProblema("Não deu para montar o PDF. Tente de novo.");
    } finally {
      setFazendo(null);
    }
  }

  return (
    <div className="grid gap-5">
      {voltar}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela flex flex-wrap items-center gap-3 font-normal tracking-tight">Relatório de {tituloDoMes(r.mes).toLowerCase()}<Selo tom={r.ultimo ? "info" : "neutro"}>versão {r.numero}</Selo></h1>
          <p className="t-apoio">Gerado em {gerado}{r.conteudo.autor ? ` por ${r.conteudo.autor.nome}` : ""}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="contorno" onClick={planilha}><Icone nome="baixar" />Baixar as tabelas</Botao>
          <Link href={`/indicadores/relatorios/montar?mes=${r.mes}&de=${r.id}`} className={classeBotao("contorno")}><Icone nome="trocar" />Gerar de novo</Link>
          <Botao onClick={() => void pdf()} disabled={!!fazendo}><Icone nome="baixar" />{fazendo ? "Preparando…" : "Baixar o PDF"}</Botao>
        </div>
      </div>
      {busca.get("novo") ? (
        <Aviso tom="ok" titulo="Relatório gerado">
          Os números ficaram como estavam agora. Se um pedido do mês mudar depois, este relatório não muda: gere de novo para ter os números novos, que viram a versão {r.numero + 1}.
        </Aviso>
      ) : null}
      {!r.ultimo ? <Aviso tom="atencao" titulo="Há uma versão mais nova">Este é o relatório como estava na versão {r.numero}. A lista mostra a versão mais nova do mês.</Aviso> : null}
      {fazendo ? <p role="status" className="t-apoio">{fazendo}</p> : null}
      {problema ? <Aviso tom="atencao">{problema}</Aviso> : null}
      <Folha r={r} condominio={condominio} gerado={gerado} abrir={(o) => void abrir(o)} />
    </div>
  );
}
