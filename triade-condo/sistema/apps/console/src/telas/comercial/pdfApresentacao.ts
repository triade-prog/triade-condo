// O PDF da proposta como apresentação (R17.8, CM-34; quadros 452 a 455): quatro folhas A4 fixas,
// como o PDF de redesign da Carolina. Capa, investimento, escopo e equipe, condições e aceite com o
// QR code do link. Montado no navegador com pdf-lib, na fonte do sistema (Manrope) e nas cores do
// tema; o QR code é desenhado aqui mesmo (qrcode-generator), sem serviço de fora. As medidas seguem
// o desenho (794 × 1123 px por folha) e viram pontos na hora de desenhar.

import fontkit from "@pdf-lib/fontkit";
import qrcode from "qrcode-generator";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { enderecoCurto, NADA_A_PARTE, PARTES, PASSOS, SUB_CAPA, SUB_ESCOPO, TEXTO_ETAPAS, TITULO_CAPA, ACOMPANHAMENTO, type Apresentacao } from "./apresentacao.ts";
import { baixarArquivo } from "./pdf.ts";
import { slug } from "./propostas.ts";

const PX = 0.75;
const L = 794;
const A = 1123;
const MX = 56;
const LARG = L - 2 * MX;

/** As cores da folha: os tokens do tema, lidos da tela por quem chama. */
export interface CoresApresentacao {
  tinta: string; suave: string; linha: string; violeta: string; violeta50: string; violeta100: string; violeta200: string; violeta500: string;
  laranja: string; ok: string; okFundo: string; okBorda: string;
}
type Cor = ReturnType<typeof rgb>;
const cor = (h: string): Cor => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const BRANCO = rgb(1, 1, 1);

interface Fontes { normal: PDFFont; forte: PDFFont }
interface OpTexto { tam?: number; forte?: boolean; cor?: Cor; larg?: number; entre?: number; maiusculas?: boolean; espaco?: number; direita?: boolean }

/** Uma folha com medidas do desenho (px, de cima para baixo). */
class Folha {
  constructor(public p: PDFPage, public f: Fontes, public tinta: Cor) {}
  private y(t: number) { return (A - t) * PX; }
  caixa(x: number, t: number, w: number, h: number, o: { fundo?: Cor; borda?: Cor; raio?: number; opacidade?: number; bordaOpacidade?: number } = {}) {
    const r = Math.min(o.raio ?? 0, w / 2, h / 2) * PX;
    const W = w * PX;
    const H = h * PX;
    const d = `M ${r} 0 H ${W - r} Q ${W} 0 ${W} ${r} V ${H - r} Q ${W} ${H} ${W - r} ${H} H ${r} Q 0 ${H} 0 ${H - r} V ${r} Q 0 0 ${r} 0 Z`;
    this.p.drawSvgPath(d, {
      x: x * PX, y: this.y(t), color: o.fundo, opacity: o.opacidade, borderColor: o.borda, borderWidth: o.borda ? 0.75 : 0, borderOpacity: o.bordaOpacidade,
    });
  }
  linha(x: number, t: number, w: number, c: Cor, espessura = 1) {
    this.p.drawLine({ start: { x: x * PX, y: this.y(t) }, end: { x: (x + w) * PX, y: this.y(t) }, thickness: espessura * PX, color: c });
  }
  vertical(x: number, t: number, h: number, c: Cor) {
    this.p.drawLine({ start: { x: x * PX, y: this.y(t) }, end: { x: x * PX, y: this.y(t + h) }, thickness: PX, color: c });
  }
  circulo(x: number, t: number, r: number, c: Cor, opacidade: number) {
    this.p.drawCircle({ x: x * PX, y: this.y(t), size: r * PX, borderColor: c, borderWidth: 1.5 * PX, borderOpacity: opacidade, opacity: 0 });
  }
  quebrar(texto: string, tam: number, larg: number, forte = false, espaco = 0): string[] {
    const fonte = forte ? this.f.forte : this.f.normal;
    const mede = (s: string) => (fonte.widthOfTextAtSize(s, tam * PX) + espaco * PX * s.length) / PX;
    const saida: string[] = [];
    for (const paragrafo of texto.split(/\n/)) {
      let atual = "";
      // "R$" nunca fica sozinho no fim da linha.
      for (const palavra of paragrafo.replace(/R\$ /g, "R$\u0000").split(/\s+/).filter(Boolean).map((w) => w.replace("\u0000", " "))) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (mede(teste) <= larg || !atual) atual = teste;
        else { saida.push(atual); atual = palavra; }
      }
      saida.push(atual);
    }
    return saida;
  }
  largura(texto: string, tam: number, forte = false) {
    return (forte ? this.f.forte : this.f.normal).widthOfTextAtSize(texto, tam * PX) / PX;
  }
  /** Escreve a partir do topo `t` e devolve onde o texto acabou. */
  texto(s: string, x: number, t: number, o: OpTexto = {}): number {
    const tam = o.tam ?? 13;
    const entre = o.entre ?? 1.45;
    const texto = o.maiusculas ? s.toUpperCase() : s;
    const linhas = this.quebrar(texto, tam, o.larg ?? LARG, o.forte, o.espaco);
    const fonte = o.forte ? this.f.forte : this.f.normal;
    linhas.forEach((l, i) => {
      const w = this.largura(l, tam, o.forte) + (o.espaco ?? 0) * l.length;
      const base = { y: this.y(t + tam * (0.98 + i * entre)), size: tam * PX, font: fonte, color: o.cor ?? this.tinta };
      let xi = o.direita ? x - w : x;
      if (!o.espaco) return void this.p.drawText(l, { ...base, x: xi * PX });
      // Rótulos com espaço entre as letras: uma letra de cada vez.
      for (const ch of l) {
        this.p.drawText(ch, { ...base, x: xi * PX });
        xi += this.largura(ch, tam, o.forte) + o.espaco;
      }
    });
    return t + tam * (1 + (linhas.length - 1) * entre) + tam * (entre - 1);
  }
  altura(s: string, o: OpTexto = {}) {
    const tam = o.tam ?? 13;
    const entre = o.entre ?? 1.45;
    const n = this.quebrar(o.maiusculas ? s.toUpperCase() : s, tam, o.larg ?? LARG, o.forte, o.espaco).length;
    return tam * (1 + (n - 1) * entre) + tam * (entre - 1);
  }
  imagem(img: PDFImage, x: number, t: number, h: number) {
    const w = (img.width / img.height) * h;
    this.p.drawImage(img, { x: x * PX, y: this.y(t + h), width: w * PX, height: h * PX });
    return w;
  }
  /** O QR code do link, em módulos quadrados, com a margem branca. */
  qr(texto: string, x: number, t: number, tam: number, c: Cor) {
    const q = qrcode(0, "M");
    q.addData(texto);
    q.make();
    const n = q.getModuleCount();
    const m = tam / (n + 4);
    this.caixa(x, t, tam, tam, { fundo: BRANCO, raio: 8 });
    for (let l = 0; l < n; l++) {
      for (let k = 0; k < n; k++) {
        if (q.isDark(l, k)) this.p.drawRectangle({ x: (x + (k + 2) * m) * PX, y: this.y(t + (l + 3) * m), width: m * PX + 0.05, height: m * PX + 0.05, color: c });
      }
    }
  }
}

const ROT = { tam: 10, forte: true, maiusculas: true, espaco: 1.2 } as const;

/** Monta as quatro folhas. */
export async function montarPdfApresentacao(a: Apresentacao, extras: {
  fontes: { normal: ArrayBuffer; forte: ArrayBuffer }; logo?: ArrayBuffer; cores: CoresApresentacao; geradoEmTexto: string;
}): Promise<Uint8Array> {
  const c = Object.fromEntries(Object.entries(extras.cores).map(([k, v]) => [k, cor(v.trim())])) as Record<keyof CoresApresentacao, Cor>;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Proposta ${a.condominio} v${a.numero}`);
  doc.setLanguage("pt-BR");
  doc.setCreator("TRÍADE Condo");
  const f = { normal: await doc.embedFont(extras.fontes.normal, { subset: true }), forte: await doc.embedFont(extras.fontes.forte, { subset: true }) };
  const logo = extras.logo ? await doc.embedPng(extras.logo) : null;
  const folha = () => new Folha(doc.addPage([L * PX, A * PX]), f, c.tinta);

  const marca = (p: Folha, x: number, t: number, h: number) => (logo ? p.imagem(logo, x, t, h) : (p.texto("TRÍADE Condo", x, t + h * 0.15, { tam: h * 0.55, forte: true, cor: c.violeta }), 0));
  const olho = (p: Folha, s: string, x: number, t: number, cr = c.violeta, larg?: number) => p.texto(s, x, t, { ...ROT, cor: cr, larg });
  const titulo = (p: Folha, i: 0 | 1 | 2, t: number, sub?: string) => {
    let y = olho(p, PARTES[i].olho, MX, t) + 8;
    y = p.texto(PARTES[i].titulo, MX, y, { tam: 34, forte: true, entre: 1.12, larg: 560 }) + 8;
    return sub ? p.texto(sub, MX, y, { tam: 14, cor: c.suave, larg: 560 }) : y;
  };
  const topo = (p: Folha, parte: string) => {
    p.caixa(MX, 54, 28, 4, { fundo: c.laranja, raio: 2 });
    marca(p, MX + 40, 40, 30);
    p.texto(parte, L - MX, 50, { ...ROT, cor: c.suave, direita: true });
    p.linha(MX, 86, LARG, c.linha);
  };
  const pe = (p: Folha, n: number, branco = false) => {
    p.linha(MX, A - 52, LARG, branco ? c.violeta200 : c.linha);
    p.texto(branco ? "TRÍADE Condo / Proposta comercial" : `TRÍADE Condo / ${a.condominio}`, MX, A - 42, { ...ROT, tam: 9, cor: branco ? BRANCO : c.suave, larg: 520 });
    p.texto(`${String(n).padStart(2, "0")} / 04`, L - MX, A - 42, { ...ROT, tam: 9, cor: branco ? BRANCO : c.violeta, direita: true });
  };

  // ---- Folha 1 · capa (quadro 452)
  {
    const p = folha();
    p.caixa(0, 0, L, A, { fundo: c.violeta });
    for (const r of [270, 200, 130]) p.circulo(L - 100, 160, r, BRANCO, 0.16);
    p.caixa(MX, 48, 190, 54, { fundo: BRANCO, raio: 14 });
    marca(p, MX + 14, 58, 34);
    p.texto("Proposta comercial", L - MX, 68, { ...ROT, cor: BRANCO, direita: true });
    const colE = 360;
    let y = olho(p, a.olhoCapa, MX, 150, c.violeta100, colE);
    y = p.texto(TITULO_CAPA, MX, y + 12, { tam: 38, forte: true, entre: 1.1, cor: BRANCO, larg: colE }) + 14;
    p.texto(SUB_CAPA, MX, y, { tam: 15, cor: c.violeta50, larg: colE });
    // O exemplo de um pedido, à direita.
    const xD = MX + colE + 28;
    const wD = LARG - colE - 28;
    p.caixa(xD, 150, wD, 330, { fundo: BRANCO, raio: 18 });
    olho(p, "Exemplo de acompanhamento", xD + 20, 172, c.violeta);
    p.linha(xD + 20, 196, wD - 40, c.linha);
    ACOMPANHAMENTO.forEach((e, i) => {
      const t = 212 + i * 66;
      const fim = i === ACOMPANHAMENTO.length - 1;
      p.caixa(xD + 20, t, 30, 30, { fundo: fim ? c.okFundo : c.violeta100, raio: 9 });
      p.texto(String(i + 1).padStart(2, "0"), xD + 35, t + 9, { tam: 11, forte: true, cor: fim ? c.ok : c.violeta, direita: false, larg: 30 });
      p.texto(e.titulo, xD + 62, t + 2, { tam: 14, forte: true, larg: wD - 82 });
      p.texto(e.texto, xD + 62, t + 22, { tam: 12, cor: c.suave, larg: wD - 82 });
    });
    // O preço, embaixo.
    const tP = 560;
    olho(p, a.rotuloCondicao, MX, tP, c.violeta100);
    p.caixa(MX, tP + 26, LARG, 170, { fundo: BRANCO, raio: 18 });
    olho(p, a.preco.rotulo, MX + 24, tP + 52);
    p.texto(a.preco.valor, MX + 24, tP + 76, { tam: 48, forte: true, entre: 1 });
    p.texto("/ mês", MX + 24 + p.largura(a.preco.valor, 48, true) + 8, tP + 104, { tam: 14, cor: c.suave });
    const xR = MX + 380;
    p.vertical(xR - 24, tP + 50, 120, c.linha);
    let yR = tP + 50;
    if (a.preco.porAp) {
      yR = p.texto(a.preco.porAp, xR, yR, { tam: 28, forte: true, cor: c.violeta });
      yR = p.texto("por apartamento / mês", xR, yR + 2, { tam: 12, cor: c.suave, larg: LARG - 404 });
    }
    if (a.preco.taxa) yR = p.texto(a.preco.taxa, xR, yR + 4, { tam: 12, cor: c.suave, larg: LARG - 404 });
    if (a.preco.implantacao) p.texto(a.preco.implantacao, xR, yR + 4, { tam: 12, forte: true, cor: c.ok, larg: LARG - 404 });
    const tG = tP + 214;
    p.caixa(MX, tG, LARG, 50, { fundo: c.violeta500, borda: BRANCO, bordaOpacidade: 0.4, raio: 14 });
    p.texto(a.garantia.titulo, MX + 20, tG + 19, { ...ROT, tam: 11, cor: BRANCO, larg: 400 });
    p.texto(a.garantia.validade, L - MX - 20, tG + 17, { tam: 13, forte: true, cor: BRANCO, direita: true });
    p.texto(`Proposta apresentada ao ${a.condominio}${a.para ? ` · ${a.para}` : ""}.`, MX, tG + 74, { tam: 12, cor: c.violeta50 });
    pe(p, 1, true);
  }

  // ---- Folha 2 · investimento (quadro 453)
  {
    const p = folha();
    topo(p, "Investimento");
    let y = titulo(p, 0, 116, a.investimento.sub) + 18;
    const inv = a.investimento;
    const hSeu = 150;
    p.caixa(MX, y, LARG, hSeu, { fundo: c.violeta50, raio: 18 });
    olho(p, inv.seu.rotulo, MX + 24, y + 22);
    p.texto(inv.seu.valor, MX + 24, y + 44, { tam: 42, forte: true, entre: 1 });
    p.texto("por mês", MX + 24 + p.largura(inv.seu.valor, 42, true) + 8, y + 68, { tam: 14, cor: c.suave });
    if (inv.seu.texto) p.texto(inv.seu.texto, MX + 24, y + 98, { tam: 13, cor: c.suave, larg: 380 });
    if (inv.seu.lado) {
      const xL = MX + 440;
      p.vertical(xL - 20, y + 22, hSeu - 44, c.violeta200);
      olho(p, inv.seu.lado.olho, xL, y + 22, c.violeta, LARG - 460);
      let yl = p.texto(inv.seu.lado.titulo, xL, y + 44, { tam: 26, forte: true, cor: c.violeta, larg: LARG - 460 });
      yl = p.texto(inv.seu.lado.sub, xL, yl + 2, { tam: 13, larg: LARG - 460 });
      if (inv.seu.lado.depois) p.texto(inv.seu.lado.depois, xL, yl + 6, { tam: 13, forte: true, larg: LARG - 460 });
    }
    y += hSeu + 26;
    if (inv.tabela) {
      olho(p, "Tabela de investimento", MX, y);
      p.texto(inv.tabela.data, L - MX, y, { tam: 11, cor: c.suave, direita: true });
      y += 24;
      // A borda direita de cada coluna de valores: a da implantação é mais larga ("Sem custo no fundador").
      const n = inv.tabela.cabecalho.length;
      const direita = (i: number) => MX + LARG - 16 - (n - 1 - i) * 150 - (i < n - 1 ? 50 : 0);
      const hCab = 38;
      const hLin = 42;
      const hTab = hCab + hLin * inv.tabela.linhas.length;
      p.caixa(MX, y, LARG, hTab, { fundo: BRANCO, borda: c.linha, raio: 16 });
      p.caixa(MX + 1, y + 1, LARG - 2, hCab - 1, { fundo: c.violeta50, raio: 15 });
      p.caixa(MX + 1, y + hCab - 14, LARG - 2, 14, { fundo: c.violeta50 });
      inv.tabela.cabecalho.forEach((h, i) => (i === 0
        ? p.texto(h, MX + 16, y + 14, { ...ROT, cor: c.suave })
        : p.texto(h, direita(i), y + 14, { ...ROT, cor: c.suave, direita: true })));
      inv.tabela.linhas.forEach((l, k) => {
        const t = y + hCab + hLin * k;
        p.linha(MX, t, LARG, c.linha);
        if (l.seu) {
          p.caixa(MX + 1, t + 0.5, LARG - 2, hLin - 1, { fundo: c.violeta50, raio: k === inv.tabela!.linhas.length - 1 ? 15 : 0 });
          p.caixa(MX + 1, t + 0.5, 4, hLin - 1, { fundo: c.violeta });
        }
        p.texto(l.faixa, MX + 16, t + 14, { tam: 13, forte: l.seu });
        if (l.seu) {
          const x = MX + 24 + p.largura(l.faixa, 13, true);
          p.caixa(x, t + 10, 84, 22, { fundo: c.violeta100, raio: 11 });
          p.texto("Seu prédio", x + 12, t + 15, { tam: 11, forte: true, cor: c.violeta });
        }
        l.valores.forEach((v, i) => p.texto(v, direita(i + 1), t + 14, { tam: 13, forte: l.seu, direita: true }));
      });
      y += hTab + 22;
    }
    const hC = p.altura(inv.considerado, { tam: 13, larg: LARG - 40 }) + (inv.nota ? 30 : 0) + 60;
    p.caixa(MX, y, LARG, hC, { fundo: c.violeta50, raio: 16 });
    olho(p, "O que está considerado neste valor", MX + 20, y + 18);
    const yc = p.texto(inv.considerado, MX + 20, y + 40, { tam: 13, larg: LARG - 40 });
    if (inv.nota) p.texto(inv.nota, MX + 20, yc + 8, { tam: 11, cor: c.suave, larg: LARG - 40 });
    pe(p, 2);
  }

  // ---- Folha 3 · escopo e equipe (quadro 454)
  {
    const p = folha();
    topo(p, "Escopo e equipe");
    let y = titulo(p, 1, 116, SUB_ESCOPO) + 18;
    const wI = a.escopo.naoIncluido.length ? 400 : LARG;
    const hI = 58 + a.escopo.incluido.reduce((s, i) => s + (i.texto ? 46 : 26), 0);
    p.caixa(MX, y, wI, hI, { fundo: c.okFundo, borda: c.okBorda, raio: 18 });
    olho(p, "Incluído na mensalidade", MX + 22, y + 22, c.ok);
    let yi = y + 50;
    for (const i of a.escopo.incluido) {
      p.p.drawSvgPath("M 0 5.5 L 4.5 10 L 13 1.5", { x: (MX + 22) * PX, y: (A - yi - 3) * PX, borderColor: c.ok, borderWidth: 1.6, scale: PX });
      p.texto(i.titulo, MX + 44, yi, { tam: 14, forte: true, larg: wI - 66 });
      if (i.texto) p.texto(i.texto, MX + 44, yi + 20, { tam: 12, cor: c.suave, larg: wI - 66 });
      yi += i.texto ? 46 : 26;
    }
    if (a.escopo.naoIncluido.length) {
      const xN = MX + wI + 16;
      const wN = LARG - wI - 16;
      p.caixa(xN, y, wN, hI, { fundo: c.violeta50, borda: c.linha, raio: 18 });
      olho(p, "Não incluído", xN + 22, y + 22);
      let yn = y + 50;
      for (const t of a.escopo.naoIncluido) {
        p.caixa(xN + 22, yn + 6, 6, 6, { fundo: c.violeta, raio: 3 });
        yn = p.texto(t, xN + 38, yn, { tam: 13, larg: wN - 60 }) + 12;
      }
    }
    y += hI + 16;
    p.caixa(MX, y, LARG, 48, { fundo: BRANCO, borda: c.linha, raio: 14 });
    p.texto(NADA_A_PARTE[0], MX + 20, y + 16, { tam: 13, forte: true });
    p.texto(NADA_A_PARTE[1], L - MX - 20, y + 17, { tam: 12, cor: c.suave, direita: true });
    y += 64;
    const hP = p.altura(a.escopo.planejado, { tam: 12, larg: LARG - 40 }) + 28;
    p.caixa(MX, y, LARG, hP, { fundo: c.violeta50, raio: 14 });
    p.texto(a.escopo.planejado, MX + 20, y + 14, { tam: 12, larg: LARG - 40 });
    // As pessoas de contato, no pé da folha.
    const tC = A - 52 - 30 - 150;
    olho(p, "Pessoas de contato", MX, tC);
    const wC = (LARG - 14) / 2;
    a.contatos.forEach((k, i) => {
      const x = MX + i * (wC + 14);
      p.caixa(x, tC + 24, wC, 126, { fundo: BRANCO, borda: c.linha, raio: 16 });
      p.caixa(x + 18, tC + 42, 44, 44, { fundo: c.violeta100, raio: 12 });
      p.texto(k.iniciais, x + 40 - p.largura(k.iniciais, 14, true) / 2, tC + 56, { tam: 14, forte: true, cor: c.violeta });
      let yk = p.texto(k.nome, x + 76, tC + 42, { tam: 14, forte: true, maiusculas: true, espaco: 0.5, larg: wC - 94 });
      yk = p.texto(k.papel, x + 76, yk + 2, { tam: 12, cor: c.suave, larg: wC - 94 });
      for (const l of k.linhas) yk = p.texto(l.texto, x + 76, yk + 4, { tam: 12, cor: c.suave, larg: wC - 94 });
    });
    pe(p, 3);
  }

  // ---- Folha 4 · condições e aceite (quadro 455)
  {
    const p = folha();
    topo(p, "Condições e aceite");
    let y = titulo(p, 2, 116) + 22;
    const w2 = (LARG - 14) / 2;
    const hCond = Math.max(...a.condicoes.map((k) => p.altura(k.texto, { tam: 13, larg: w2 - 40 }))) + 74;
    a.condicoes.forEach((k, i) => {
      const x = MX + (i % 2) * (w2 + 14);
      const t = y + Math.floor(i / 2) * (hCond + 14);
      p.caixa(x, t, w2, hCond, { fundo: c.violeta50, borda: c.linha, raio: 16 });
      p.caixa(x + 20, t + 20, 28, 4, { fundo: c.laranja, raio: 2 });
      olho(p, k.titulo, x + 20, t + 34);
      p.texto(k.texto, x + 20, t + 56, { tam: 13, larg: w2 - 40 });
    });
    y += 2 * hCond + 14 + 24;
    olho(p, "Como começamos", MX, y);
    y += 24;
    const hPasso = Math.max(...PASSOS.map((k) => p.altura(k.texto, { tam: 12, larg: w2 - 36 }))) + 62;
    PASSOS.forEach((k, i) => {
      const x = MX + (i % 2) * (w2 + 14);
      const t = y + Math.floor(i / 2) * (hPasso + 14);
      p.caixa(x, t, w2, hPasso, { fundo: BRANCO, borda: c.linha, raio: 16 });
      p.caixa(x + 18, t + 16, 30, 30, { fundo: c.violeta100, raio: 9 });
      p.texto(String(i + 1).padStart(2, "0"), x + 33 - p.largura(String(i + 1).padStart(2, "0"), 11, true) / 2, t + 26, { tam: 11, forte: true, cor: c.violeta });
      p.texto(k.titulo, x + 60, t + 23, { tam: 14, forte: true, larg: w2 - 78 });
      p.texto(k.texto, x + 18, t + 56, { tam: 12, cor: c.suave, larg: w2 - 36 });
    });
    // O convite com o link e o QR code.
    const tCta = A - 52 - 36 - 136;
    p.caixa(MX, tCta, LARG, 120, { fundo: c.violeta, raio: 18 });
    const temQr = !!a.endereco;
    const wTexto = LARG - 48 - (temQr ? 110 : 0);
    let yc = p.texto("Pronto para começar?", MX + 24, tCta + 22, { ...ROT, cor: c.violeta100, larg: wTexto });
    yc = p.texto(temQr ? "Acesse a proposta e aceite on-line." : "Aceite on-line pelo link que você recebeu.", MX + 24, yc + 6,
      { tam: 20, forte: true, cor: BRANCO, larg: wTexto });
    if (a.endereco) {
      p.texto(enderecoCurto(a.endereco), MX + 24, yc + 6, { tam: 12, cor: c.violeta50, larg: wTexto });
      p.qr(a.endereco, L - MX - 24 - 92, tCta + 14, 92, c.tinta);
    }
    p.texto(`${TEXTO_ETAPAS} Gerado em ${extras.geradoEmTexto}. ${a.impressao}`, MX, tCta + 132, { tam: 9, cor: c.suave });
    pe(p, 4);
  }
  return doc.save();
}

/** Monta e baixa: lê as fontes, a marca e as cores do tema na própria tela. */
export async function baixarApresentacao(a: Apresentacao): Promise<void> {
  const ler = (u: string) => fetch(u).then((x) => {
    if (!x.ok) throw new Error(u);
    return x.arrayBuffer();
  });
  const [normal, forte] = await Promise.all(["400", "600"].map((p) => ler(`/fontes/manrope-latin-${p}-normal.woff`)));
  const logo = await ler("/marca/logo.png").catch(() => undefined);
  const tema = getComputedStyle(document.documentElement);
  const t = (n: string) => tema.getPropertyValue(`--color-${n}`);
  const cores: CoresApresentacao = {
    tinta: t("tinta"), suave: t("tinta-suave"), linha: t("linha"), violeta: t("violeta-600"), violeta50: t("violeta-50"), violeta100: t("violeta-100"),
    violeta200: t("violeta-200"), violeta500: t("violeta-500"), laranja: t("laranja-500"), ok: t("ok"), okFundo: t("ok-fundo"), okBorda: t("ok-borda"),
  };
  const agora = new Date();
  const geradoEmTexto = `${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(agora)} às ${
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(agora)}`;
  const bytes = await montarPdfApresentacao(a, { fontes: { normal: normal!, forte: forte! }, logo, cores, geradoEmTexto });
  baixarArquivo(bytes as BlobPart, `proposta-${slug(a.condominio)}-v${a.numero}.pdf`, "application/pdf");
}
