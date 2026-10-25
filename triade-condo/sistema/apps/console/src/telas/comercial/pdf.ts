// O PDF da proposta e do kit para o conselho (CM-07, CM-20), montado no navegador com pdf-lib,
// como o relatório do mês da Plataforma: a fonte do sistema (Manrope) e as cores do tema. A folha
// desenha os blocos de um Documento (propostas.ts) sem saber de onde vieram; no pé de cada folha
// vai a impressão digital da versão.

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { TEXTO_A_CONFIRMAR } from "@triade/domain";
import type { Bloco, Documento } from "./propostas.ts";

const A4 = { l: 595.28, a: 841.89 };
const M = 48;
const LARGURA = A4.l - 2 * M;
const cor = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** As cores da folha são os tokens do tema, lidos da tela por quem chama. */
export interface CoresPdf { tinta: string; suave: string; linha: string; violeta: string; violeta7: string }
type Cores = Record<keyof CoresPdf, ReturnType<typeof rgb>>;

class Folha {
  pagina!: PDFPage;
  y = 0;
  paginas: PDFPage[] = [];
  constructor(public doc: PDFDocument, public f: { normal: PDFFont; forte: PDFFont }, public c: Cores) {
    this.nova();
  }
  nova() {
    this.pagina = this.doc.addPage([A4.l, A4.a]);
    this.paginas.push(this.pagina);
    this.y = A4.a - M;
  }
  caber(altura: number) {
    if (this.y - altura < M + 30) this.nova();
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
  texto(t: string, { tamanho = 10.5, forte = false, cor: c = this.c.tinta, largura = LARGURA, x = M, entre = 1.45 } = {}) {
    for (const l of this.linhas(t, tamanho, largura, forte)) {
      this.caber(tamanho * entre);
      this.y -= tamanho * entre;
      this.pagina.drawText(l, { x, y: this.y + tamanho * 0.3, size: tamanho, font: forte ? this.f.forte : this.f.normal, color: c });
    }
  }
  traco(espessura = 0.6, c = this.c.linha) {
    this.pagina.drawLine({ start: { x: M, y: this.y }, end: { x: A4.l - M, y: this.y }, thickness: espessura, color: c });
  }
  /** Linhas de rótulo e valor, como as do link. */
  pares(linhas: [string, string][]) {
    const col = LARGURA * 0.32;
    for (const [r, v] of linhas) {
      const quebras = this.linhas(v, 10, LARGURA - col - 8);
      const altura = quebras.length * 10 * 1.4 + 8;
      this.caber(altura);
      const topo = this.y;
      this.pagina.drawText(r, { x: M, y: topo - 14, size: 10, font: this.f.normal, color: this.c.suave });
      quebras.forEach((l, k) => this.pagina.drawText(l, { x: M + col, y: topo - 14 - k * 14, size: 10, font: this.f.normal, color: this.c.tinta }));
      this.y = topo - altura;
      this.traco();
    }
  }
  tabela(cabecalho: string[], linhas: string[][]) {
    const n = cabecalho.length;
    const primeira = n <= 2 ? LARGURA * 0.45 : LARGURA * 0.26;
    const resto = (LARGURA - primeira) / Math.max(n - 1, 1);
    const xs = [M, ...Array.from({ length: n - 1 }, (_, i) => M + primeira + resto * i)];
    const larguras = [primeira, ...Array.from({ length: n - 1 }, () => resto)];
    const linha = (cel: string[], cab: boolean) => {
      const tam = cab ? 8.5 : 9;
      const quebras = cel.map((c, i) => this.linhas(c, tam, larguras[i]! - 8, cab || i === 0));
      const altura = Math.max(...quebras.map((q) => q.length)) * tam * 1.35 + 8;
      this.caber(altura);
      const topo = this.y;
      quebras.forEach((q, i) => q.forEach((l, k) => {
        const fonte = cab || i === 0 ? this.f.forte : this.f.normal;
        const c = cab || cel[i] === TEXTO_A_CONFIRMAR ? this.c.suave : this.c.tinta;
        this.pagina.drawText(l, { x: xs[i]!, y: topo - 4 - tam - k * tam * 1.35 + 1, size: tam, font: fonte, color: c });
      }));
      this.y = topo - altura;
      this.traco();
    };
    linha(cabecalho, true);
    for (const l of linhas) linha(l, false);
  }
  bloco(b: Bloco) {
    if (b.tipo === "pagina") return this.nova();
    if (b.tipo === "secao") {
      this.caber(60);
      this.y -= 14;
      this.texto(b.texto.toUpperCase(), { tamanho: 9.5, forte: true, cor: this.c.violeta7 });
      this.y -= 4;
      return;
    }
    if (b.tipo === "paragrafo") return this.texto(b.texto, { tamanho: b.suave ? 9.5 : 10.5, cor: b.suave ? this.c.suave : this.c.tinta });
    if (b.tipo === "destaque") {
      this.y -= 6;
      this.texto(b.rotulo, { tamanho: 10, cor: this.c.suave });
      this.texto(b.valor, { tamanho: 24, forte: true, entre: 1.3 });
      if (b.apoio) this.texto(b.apoio, { tamanho: 9.5, cor: this.c.suave });
      this.y -= 4;
      return;
    }
    if (b.tipo === "pares") return this.pares(b.linhas);
    if (b.tipo === "lista") {
      for (const i of b.itens) this.texto(`•  ${i}`, { tamanho: 10.5, x: M + 4, largura: LARGURA - 4 });
      return;
    }
    this.tabela(b.cabecalho, b.linhas);
  }
}

/** Monta o PDF de um documento: a faixa de cima, o título, os blocos e o pé com a impressão digital. */
export async function montarPdf(d: Documento, extras: { fontes: { normal: ArrayBuffer; forte: ArrayBuffer }; cores: CoresPdf; geradoEmTexto: string }): Promise<Uint8Array> {
  const c = Object.fromEntries(Object.entries(extras.cores).map(([k, v]) => [k, cor(v.trim())])) as Cores;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(d.titulo);
  doc.setLanguage("pt-BR");
  doc.setCreator("TRÍADE Condo");
  const f = { normal: await doc.embedFont(extras.fontes.normal, { subset: true }), forte: await doc.embedFont(extras.fontes.forte, { subset: true }) };
  const folha = new Folha(doc, f, c);

  folha.texto(d.cabecalho.toUpperCase(), { tamanho: 8.5, forte: true, cor: c.suave, largura: LARGURA - 70 });
  folha.pagina.drawText("TRÍADE", { x: A4.l - M - f.forte.widthOfTextAtSize("TRÍADE", 9), y: A4.a - M - 10, size: 9, font: f.forte, color: c.violeta });
  folha.y -= 4;
  folha.texto(d.principal, { tamanho: 20, entre: 1.3 });
  folha.texto(d.apoio, { tamanho: 9.5, cor: c.suave });
  folha.y -= 10;
  folha.traco(1.5, c.violeta);
  for (const b of d.blocos) folha.bloco(b);

  folha.y -= 12;
  folha.traco();
  folha.y -= 2;
  folha.texto(`Gerado em ${extras.geradoEmTexto}. ${d.pe ?? ""}`.trim(), { tamanho: 8, cor: c.suave });

  const total = folha.paginas.length;
  folha.paginas.forEach((pg, i) => {
    pg.drawText(`${d.cabecalho} · folha ${i + 1} de ${total}`, { x: M, y: M - 14, size: 7.5, font: f.normal, color: c.suave });
    if (d.pe) {
      for (const [k, l] of folha.linhas(d.pe, 7, LARGURA, false).entries()) pg.drawText(l, { x: M, y: M - 24 - k * 9, size: 7, font: f.normal, color: c.suave });
    }
  });
  return doc.save();
}

/** Entrega ao navegador o arquivo montado aqui. */
export function baixarArquivo(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Monta e baixa: lê as fontes e as cores do tema na própria tela. */
export async function baixarPdf(d: Documento): Promise<void> {
  const [normal, forte] = await Promise.all(["400", "600"].map((p) => fetch(`/fontes/manrope-latin-${p}-normal.woff`).then((x) => {
    if (!x.ok) throw new Error("fonte");
    return x.arrayBuffer();
  })));
  const tema = getComputedStyle(document.documentElement);
  const token = (n: string) => tema.getPropertyValue(`--color-${n}`);
  const cores = { tinta: token("tinta"), suave: token("tinta-suave"), linha: token("linha"), violeta: token("violeta-600"), violeta7: token("violeta-700") };
  const agora = new Date();
  const geradoEmTexto = `${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(agora)} às ${
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(agora)}`;
  const bytes = await montarPdf(d, { fontes: { normal: normal!, forte: forte! }, cores, geradoEmTexto });
  baixarArquivo(bytes as BlobPart, d.nomeArquivo, "application/pdf");
}
