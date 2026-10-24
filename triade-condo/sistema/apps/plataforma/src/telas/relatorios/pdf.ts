// O PDF do relatório do mês (TR-10, decisão D.1): um arquivo só, com a folha do relatório, as
// fotos dentro da folha e, depois dela, as páginas de cada PDF anexado. É montado no navegador
// com as mesmas linhas da folha da tela (tabelasDoRelatorio) e a fonte do sistema (Manrope).

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  letraDoAnexo, periodoDoMes, PARTES_RELATORIO, rodapeDoRelatorio, tabelasDoRelatorio, tituloDoMes, type RelatorioGerado, type Tabela,
} from "@triade/domain";

const A4 = { l: 595.28, a: 841.89 };
const M = 48;
const LARGURA = A4.l - 2 * M;
const cor = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** As cores da folha são os tokens do tema (DC13), lidos da tela por quem chama. */
export interface CoresPdf { tinta: string; suave: string; linha: string; violeta: string; violeta7: string }
type Cores = Record<keyof CoresPdf, ReturnType<typeof rgb>>;
let C: Cores;

/** Um anexo já baixado: a foto entra na folha; o PDF segue depois dela. */
export interface AnexoBaixado { titulo: string; tipo: string; bytes: Uint8Array | null }


class Folha {
  doc: PDFDocument;
  pagina!: PDFPage;
  y = 0;
  paginas: PDFPage[] = [];
  constructor(doc: PDFDocument, public f: { normal: PDFFont; forte: PDFFont }) {
    this.doc = doc;
    this.nova();
  }
  nova() {
    this.pagina = this.doc.addPage([A4.l, A4.a]);
    this.paginas.push(this.pagina);
    this.y = A4.a - M;
  }
  /** Garante espaço; sem espaço, começa outra página. */
  caber(altura: number) {
    if (this.y - altura < M + 24) this.nova();
  }
  linhas(texto: string, tamanho: number, largura: number, forte = false): string[] {
    const fonte = forte ? this.f.forte : this.f.normal;
    const saida: string[] = [];
    for (const paragrafo of texto.split(/\r?\n/)) {
      let atual = "";
      for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(teste, tamanho) <= largura || !atual) atual = teste;
        else { saida.push(atual); atual = palavra; }
      }
      saida.push(atual);
    }
    return saida;
  }
  texto(t: string, { tamanho = 10.5, forte = false, cor: c = C.tinta, largura = LARGURA, x = M, entre = 1.45 } = {}) {
    for (const l of this.linhas(t, tamanho, largura, forte)) {
      this.caber(tamanho * entre);
      this.y -= tamanho * entre;
      this.pagina.drawText(l, { x, y: this.y + tamanho * 0.3, size: tamanho, font: forte ? this.f.forte : this.f.normal, color: c });
    }
  }
  traco(espessura = 0.6, c = C.linha) {
    this.pagina.drawLine({ start: { x: M, y: this.y }, end: { x: A4.l - M, y: this.y }, thickness: espessura, color: c });
  }
  titulo(n: number, t: string) {
    this.caber(60);
    this.y -= 16;
    this.texto(`${n} · ${t}`.toUpperCase(), { tamanho: 9.5, forte: true, cor: C.violeta7 });
    this.y -= 4;
  }
  tabela(t: Tabela) {
    const n = t.cabecalho.length;
    const primeira = n <= 3 ? LARGURA * 0.5 : LARGURA * 0.3;
    const resto = (LARGURA - primeira) / (n - 1);
    const xs = [M, ...Array.from({ length: n - 1 }, (_, i) => M + primeira + resto * i)];
    const larguras = [primeira, ...Array.from({ length: n - 1 }, () => resto)];
    const linha = (cel: string[], cabecalho: boolean) => {
      const tam = cabecalho ? 8.5 : 9.5;
      const quebras = cel.map((c, i) => this.linhas(c, tam, larguras[i]! - 8, cabecalho || i === 0));
      const altura = Math.max(...quebras.map((q) => q.length)) * tam * 1.35 + 8;
      this.caber(altura);
      const topo = this.y;
      quebras.forEach((q, i) => {
        q.forEach((l, k) => {
          const fonte = cabecalho || i === 0 ? this.f.forte : this.f.normal;
          const w = fonte.widthOfTextAtSize(l, tam);
          const x = i === 0 ? xs[i]! : xs[i]! + larguras[i]! - 4 - w;
          const c = cabecalho ? C.suave : l === "sem dados" ? C.suave : C.tinta;
          this.pagina.drawText(l, { x, y: topo - 4 - tam - k * tam * 1.35 + 1, size: tam, font: fonte, color: c });
        });
      });
      this.y = topo - altura;
      this.traco();
    };
    linha(t.cabecalho, true);
    for (const l of t.linhas) linha(l, false);
  }
  imagem(img: PDFImage, legenda: string) {
    const escala = Math.min(LARGURA / img.width, 300 / img.height, 1);
    const w = img.width * escala;
    const h = img.height * escala;
    this.caber(h + 30);
    this.y -= h + 6;
    this.pagina.drawImage(img, { x: M, y: this.y, width: w, height: h });
    this.texto(legenda, { tamanho: 9, cor: C.suave });
  }
}

/**
 * Monta o PDF: cabeçalho, as partes na ordem do relatório, os anexos e o rodapé com de quando são
 * os números; depois as páginas dos PDFs anexados. Anexo que não baixou vira uma linha avisando.
 */
export async function montarPdf(r: RelatorioGerado,
  extras: { condominio: string; geradoEmTexto: string; fontes: { normal: ArrayBuffer; forte: ArrayBuffer }; cores: CoresPdf },
  anexos: AnexoBaixado[]): Promise<Uint8Array> {
  C = Object.fromEntries(Object.entries(extras.cores).map(([k, v]) => [k, cor(v.trim())])) as Cores;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Relatório de ${tituloDoMes(r.mes).toLowerCase()} · ${extras.condominio}`);
  doc.setLanguage("pt-BR");
  doc.setCreator("TRÍADE Condo");
  const f = { normal: await doc.embedFont(extras.fontes.normal, { subset: true }), forte: await doc.embedFont(extras.fontes.forte, { subset: true }) };
  const folha = new Folha(doc, f);
  const autor = r.conteudo.autor;

  // Cabeçalho.
  folha.texto(`${extras.condominio} · Relatório do atendimento`.toUpperCase(), { tamanho: 8.5, forte: true, cor: C.suave, largura: LARGURA - 70 });
  folha.pagina.drawText("TRÍADE", { x: A4.l - M - f.forte.widthOfTextAtSize("TRÍADE", 9), y: A4.a - M - 10, size: 9, font: f.forte, color: C.violeta });
  folha.y -= 4;
  folha.texto(`${tituloDoMes(r.mes)}${r.numero > 1 ? ` · versão ${r.numero}` : ""}`, { tamanho: 22, entre: 1.3 });
  folha.texto(`${periodoDoMes(r.conteudo)} · gerado em ${extras.geradoEmTexto}${autor ? `, por ${autor.nome}${autor.cargo ? `, ${autor.cargo.toLowerCase()}` : ""}` : ""}`,
    { tamanho: 9.5, cor: C.suave });
  folha.y -= 10;
  folha.traco(1.5, C.violeta);

  // As partes.
  const tabelas = new Map(tabelasDoRelatorio(r).map((t) => [t.parte, t.tabela]));
  let n = 0;
  for (const p of r.partes) {
    const t = tabelas.get(p);
    if (p === "RESUMO" && r.resumo) { folha.titulo(++n, PARTES_RELATORIO.RESUMO.titulo); folha.texto(r.resumo); }
    else if (p === "PALAVRA" && r.palavra) { folha.titulo(++n, PARTES_RELATORIO.PALAVRA.titulo); folha.texto(r.palavra); }
    else if (t) { folha.titulo(++n, PARTES_RELATORIO[p].titulo); folha.tabela(t); }
  }

  // Anexos: as fotos entram aqui; os PDFs seguem depois da folha.
  const pdfs: { titulo: string; doc: PDFDocument }[] = [];
  if (anexos.length) {
    folha.titulo(++n, "Anexos");
    for (const [i, a] of anexos.entries()) {
      const nome = `Anexo ${letraDoAnexo(i)} · ${a.titulo}`;
      if (!a.bytes) { folha.texto(`${nome}: não deu para juntar ao PDF. Baixe pela tela do relatório.`, { tamanho: 9.5, cor: C.suave }); continue; }
      try {
        if (a.tipo === "application/pdf") {
          const outro = await PDFDocument.load(a.bytes, { ignoreEncryption: true });
          pdfs.push({ titulo: nome, doc: outro });
          const paginas = outro.getPageCount();
          folha.texto(`${nome}: PDF de ${paginas} ${paginas === 1 ? "página" : "páginas"}, segue depois desta folha.`, { tamanho: 9.5 });
        } else {
          const img = a.tipo === "image/png" ? await doc.embedPng(a.bytes) : await doc.embedJpg(a.bytes);
          folha.imagem(img, nome);
        }
      } catch {
        folha.texto(`${nome}: o arquivo não abriu para juntar ao PDF.`, { tamanho: 9.5, cor: C.suave });
      }
    }
  }

  folha.y -= 12;
  folha.traco();
  folha.y -= 2;
  folha.texto(rodapeDoRelatorio(r, extras.geradoEmTexto), { tamanho: 8.5, cor: C.suave });

  // Número de página na folha.
  const total = folha.paginas.length;
  folha.paginas.forEach((pg, i) => {
    const t = `${extras.condominio} · Relatório de ${tituloDoMes(r.mes).toLowerCase()} · folha ${i + 1} de ${total}`;
    pg.drawText(t, { x: M, y: M - 18, size: 8, font: f.normal, color: C.suave });
  });

  for (const p of pdfs) {
    const copiadas = await doc.copyPages(p.doc, p.doc.getPageIndices());
    for (const c of copiadas) doc.addPage(c);
  }
  return doc.save();
}
