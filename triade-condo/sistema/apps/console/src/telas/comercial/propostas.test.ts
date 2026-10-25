// Propostas do Comercial nas telas (R17.3): o que vai para o síndico nunca leva o que é interno
// (CM-12), os textos do preço, das aberturas e do comparativo saem dos dados (EM-07) e o PDF da
// proposta e do kit é montado com a impressão digital da versão.
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { montarPdf } from "./pdf.ts";
import {
  conteudoDaVersao, conteudoDoLink, depoisDoEnvio, documentoKit, documentoProposta, enderecoDoLink, linhasDoPreco, pecasDisponiveis, resumoVersao, slug,
  tabelaComparativo, textoAberturas, textoAta, textoDesconto, textoImpressao, textoNoAno, textoSituacao, type ItemListaProposta, type Kit, type PropostaPublica,
  type VersaoProposta,
} from "./propostas.ts";

const HASH = "9f2c".padEnd(64, "a");

const V: VersaoProposta = {
  id: "v1", versaoRegistro: 5, numero: 1, situacao: "ENVIADA", condominio: "Residencial Cerrado", cidade: "Brasília", uf: "DF", faixa: "DE_41_A_100", unidades: 72,
  ciclo: "MENSAL", tabela: "FUNDADOR", mensalTabela: 22900, mensal: 20610, depoisFundador: 32900, fundadorMeses: 12, implantacaoSemCusto: true, desconto: 10, porApartamento: 286,
  premissas: { estimativa: true, semRoi: true, implantacaoAParte: true, mensal: 20610, unidades: 72, porApartamento: 286, texto: "Estimativa: R$ 206,10 por mês divididos por 72 unidades." },
  incluido: ["Todo pedido com responsável, prazo e conclusão explicada"], planejado: ["WhatsApp oficial", "Inteligência artificial"],
  respostas: [{ id: "r1", tema: "LGPD", titulo: "LGPD", texto: "O condomínio controla os dados." }, { id: "r2", tema: "CANCELAMENTO", titulo: "Como cancelar", texto: "Aviso com 30 dias." }],
  referencias: [
    { id: "f1", sindico: "Paulo Dias", condominio: "Edifício Ipê", unidades: 48, escopo: "CONTATO", whatsapp: "5561988887777" },
    { id: "f2", sindico: "Ana Lima", condominio: "Ed. Buriti", escopo: "SO_NOME", whatsapp: "5561900000000" },
    { id: "f3", sindico: "Retirado", condominio: "Ed. Velho", retirada: true },
  ],
  validadeDias: 15, validoAte: "2026-11-08", hash: HASH,
  descontoSituacao: "APROVADO",
  descontoPedido: { percentual: 10, motivo: "MOTIVO-SECRETO do desconto", situacao: "APROVADO", pedidoEm: "2026-10-24T13:00:00-03:00", resposta: "RESPOSTA-INTERNA" },
  notaInterna: "NOTA-INTERNA: síndica quer fechar antes da AGO",
  enviadaEm: "2026-10-24T14:02:11-03:00", criadoEm: "2026-10-24T13:00:00-03:00",
  aceite: { nome: "Lúcia Prado", cargo: "Síndica", em: "2026-10-25T10:12:00-03:00", ip: "177.10.20.30", cpfMascarado: "•••.982.247-••" },
};

const KIT: Kit = {
  propostaId: "p1", versaoId: "v1",
  proposta: { ...conteudoParaLink(), podeAceitar: false },
  predio: { condominio: "Residencial Cerrado", cidade: "Brasília", uf: "DF", unidades: 72, sistemaAtual: "Planilha e WhatsApp", fidelidadeAte: "2027-03-01", decisaoEm: "2026-12-10" },
  comparativo: {
    triade: { ciclo: "MENSAL", mensal: 20610, porApartamento: 286, implantacaoSemCusto: true, estimativa: true },
    sistemaAtual: { nome: "Planilha e WhatsApp", fidelidadeAte: "2027-03-01" },
    concorrentes: [
      { nome: "CondoApp", confirmado: true, planos: [{ plano: "Básico", modelo: "POR_UNIDADE", preco: 28800, porApartamento: 400, fonte: "site", lidoEm: "2026-10-01" }] },
      { nome: "Outro App", confirmado: false, planos: [] },
    ],
  },
  respostas: [{ tema: "LGPD", titulo: "LGPD", texto: "O condomínio controla os dados." }],
  referencias: [{ id: "f1", sindico: "Paulo Dias", condominio: "Edifício Ipê", unidades: 48, escopo: "CONTATO", whatsapp: "5561988887777" }],
};

function conteudoParaLink(): Omit<PropostaPublica, "podeAceitar"> {
  return {
    versao: 1, numero: 1, situacao: "ENVIADA", condominio: "Residencial Cerrado", cidade: "Brasília", uf: "DF", unidades: 72, ciclo: "MENSAL", tabela: "FUNDADOR",
    mensalTabela: 22900, mensal: 20610, depoisFundador: 32900, fundadorMeses: 12, implantacaoSemCusto: true, desconto: 10, porApartamento: 286,
    incluido: ["Todo pedido com responsável, prazo e conclusão explicada"], planejado: ["WhatsApp oficial"], validoAte: "2026-11-08", hash: HASH,
    aosCuidados: "Lúcia Prado",
  };
}

describe("o que vai para o síndico (CM-12)", () => {
  it("a versão vira conteúdo sem nota interna, sem o pedido de desconto e sem o IP do aceite", () => {
    const c = conteudoDaVersao(V, "Lúcia Prado");
    const texto = JSON.stringify(c);
    expect(texto).not.toContain("NOTA-INTERNA");
    expect(texto).not.toContain("MOTIVO-SECRETO");
    expect(texto).not.toContain("RESPOSTA-INTERNA");
    expect(texto).not.toContain("177.10.20.30");
    expect(texto).not.toContain("982.247");
    expect(c.aceite).toEqual({ nome: "Lúcia Prado", cargo: "Síndica", em: V.aceite!.em });
    expect(c.aosCuidados).toBe("Lúcia Prado");
  });

  it("referência retirada some; o contato só sai com a autorização de contato", () => {
    const c = conteudoDaVersao(V);
    expect(c.referencias.map((r) => r.sindico)).toEqual(["Paulo Dias", "Ana Lima"]);
    expect(c.referencias[0]!.contato).toBe("(61) 98888-7777");
    expect(c.referencias[1]!.contato).toBeUndefined();
  });

  it("o PDF da proposta e o do kit não levam nada interno", () => {
    const d = JSON.stringify([documentoProposta(conteudoDaVersao(V)), documentoKit({ ...KIT, proposta: { ...KIT.proposta } }, ["APRESENTACAO", "COMPARATIVO", "PROPOSTA", "ATA", "PRIVACIDADE", "RESPOSTAS", "REFERENCIAS"])]);
    for (const s of ["NOTA-INTERNA", "MOTIVO-SECRETO", "RESPOSTA-INTERNA", "177.10.20.30"]) expect(d).not.toContain(s);
  });

  it("o link e a versão dão o mesmo conteúdo", () => {
    const a = conteudoDoLink({ ...conteudoParaLink(), podeAceitar: true });
    expect(a.mensal).toBe(20610);
    expect(a.planejado).toEqual(["WhatsApp oficial"]);
    expect(a.aosCuidados).toBe("Lúcia Prado");
  });
});

describe("os textos da proposta", () => {
  it("as linhas do preço: por apartamento como estimativa, desconto aprovado, implantação, preço garantido e validade", () => {
    expect(linhasDoPreco(conteudoDaVersao(V))).toEqual([
      ["Por apartamento", "R$ 2,86 por mês (estimativa, 72 unidades)"],
      ["Desconto", "10%, aprovado"],
      ["Implantação", "sem custo"],
      ["Preço garantido", "12 meses; depois, R$ 329,00 por mês"],
      ["Vale até", "08/11/2026"],
    ]);
    const anual = linhasDoPreco({ ciclo: "ANUAL", tabela: "CHEIA", unidades: 72, mensal: 32900, anual: 361900, mesesPagos: 11, porApartamento: 457, implantacaoSemCusto: true });
    expect(anual).toContainEqual(["No ano", "R$ 3.619,00 (12 por 11)"]);
    expect(linhasDoPreco({ ciclo: "MENSAL", tabela: "CHEIA", implantacao: 90000, implantacaoParcelas: 3 })).toEqual([["Implantação", "R$ 900,00, em até 3 vezes"]]);
  });

  it("a linha da versão, o selo e as aberturas sem identificar quem abriu (CM-07)", () => {
    expect(resumoVersao(V)).toBe("Mensal · fundador · R$ 206,10 · validade 08/11");
    expect(resumoVersao({ ciclo: "MENSAL", tabela: "CHEIA", mensal: 34900, implantacao: 90000 })).toBe("Mensal · cheia · R$ 349,00 · implantação R$ 900,00");
    expect(textoSituacao(2, "AGUARDA_DESCONTO")).toBe("v2 · aguarda aprovação do desconto");
    expect(textoAberturas({ total: 0, aparelhos: 0 })).toBe("Ainda não aberta");
    expect(textoAberturas({ total: 4, aparelhos: 3, ultima: "2026-10-23T18:05:00-03:00" })).toBe("Aberta 4 vezes em 3 aparelhos · última 23/10 18:05");
    expect(textoAberturas({ total: 1, aparelhos: 1 })).toBe("Aberta 1 vez em 1 aparelho");
  });

  it("depois do envio: vencida pede a tabela do dia; aceita diz quando", () => {
    const base: ItemListaProposta = { id: "p", versao: 1, aba: "VENCIDAS", interessado: { id: "i", condominio: "X", etapa: "PROPOSTA_ENVIADA" },
      atual: { id: "v", numero: 3, situacao: "VENCIDA", ciclo: "MENSAL", tabela: "CHEIA" }, aberturas: { total: 0, aparelhos: 0 } };
    expect(depoisDoEnvio(base)).toBe("Refazer com a tabela do dia");
    expect(depoisDoEnvio({ ...base, atual: { ...base.atual, situacao: "ACEITA" }, aceite: { em: "2026-10-30T14:32:00-03:00", cargo: "Síndica" } })).toBe("Aceita em 30/10 (Síndica)");
  });

  it("o desconto na janela da Administração (quadro 327)", () => {
    expect(textoDesconto(10, 22900, 20610)).toBe("10% na mensalidade: R$ 229,00 → R$ 206,10 por mês");
    expect(textoDesconto(12.5)).toBe("12,5% na mensalidade");
    expect(textoNoAno({ ciclo: "ANUAL", mensalTabela: 22900, mesesPagos: 11 }, 20610)).toBe("R$ 2.519,00 → R$ 2.267,10 (12 por 11)");
    expect(textoNoAno({ ciclo: "MENSAL", mensalTabela: 22900 }, 20610)).toBeNull();
  });

  it("o endereço do link, o nome do arquivo e a impressão digital", () => {
    expect(enderecoDoLink("https://console.exemplo/", "Xr4_abc")).toBe("https://console.exemplo/o/Xr4_abc");
    expect(slug("Edifício Ipê Amarelo")).toBe("edificio-ipe-amarelo");
    expect(documentoProposta(conteudoDaVersao(V)).nomeArquivo).toBe("proposta-residencial-cerrado-v1.pdf");
    expect(textoImpressao(1, HASH)).toContain(HASH);
    expect(textoImpressao(2)).toBe("Versão v2, ainda não enviada: sem impressão digital.");
  });
});

describe("kit para o conselho (CM-20)", () => {
  it("o comparativo só mostra o preço do concorrente conferido; o resto fica a confirmar", () => {
    const t = tabelaComparativo(KIT);
    expect(t.cabecalho).toEqual(["Critério", "TRÍADE", "Planilha e WhatsApp", "CondoApp", "Outro App"]);
    expect(t.linhas[0]).toEqual(["Mensalidade", "R$ 206,10 por mês", "a confirmar", "Básico: R$ 288,00 por mês", "a confirmar"]);
    expect(t.linhas[1]).toEqual(["Custo por apartamento por mês", "R$ 2,86 (estimativa)", "a confirmar", "R$ 4,00", "a confirmar"]);
    expect(t.linhas.find((l) => l[0] === "Fidelidade do contrato atual")).toEqual(["Fidelidade do contrato atual", "—", "até 01/03/2027", "—", "—"]);
    expect(JSON.stringify(t)).not.toMatch(/retorno|ROI/i);
  });

  it("as peças que dependem de resposta ou referência ficam de fora quando faltam", () => {
    expect(Object.values(pecasDisponiveis(KIT)).every((x) => x === null)).toBe(true);
    const sem = pecasDisponiveis({ ...KIT, respostas: [], referencias: [] });
    expect(sem.PRIVACIDADE).toMatch(/LGPD/);
    expect(sem.RESPOSTAS).not.toBeNull();
    expect(sem.REFERENCIAS).not.toBeNull();
    const d = documentoKit({ ...KIT, respostas: [] }, ["PRIVACIDADE", "ATA"]);
    expect(d.blocos.filter((b) => b.tipo === "secao").map((b) => (b as { texto: string }).texto)).toEqual(["Minuta de texto para a ata"]);
  });

  it("a minuta para a ata usa os valores e a data da decisão", () => {
    const a = textoAta(KIT);
    expect(a.texto).toContain("proposta v1");
    expect(a.texto).toContain("R$ 206,10 por mês");
    expect(a.reuniao).toBe("Reunião prevista para 10/12/2026.");
  });
});

describe("o PDF montado no navegador", () => {
  const fonte = (p: string) => {
    const b = readFileSync(new URL(`../../../public/fontes/manrope-latin-${p}-normal.woff`, import.meta.url));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };
  const extras = { fontes: { normal: fonte("400"), forte: fonte("600") }, cores: { tinta: "#1e1531", suave: "#5e5475", linha: "#e4dcf1", violeta: "#5808cc", violeta7: "#4706a6" },
    geradoEmTexto: "25/10/2026 às 10:00" };

  it("a proposta sai com o título e abre", async () => {
    const pdf = await PDFDocument.load(await montarPdf(documentoProposta(conteudoDaVersao(V, "Lúcia Prado")), extras));
    expect(pdf.getTitle()).toBe("Proposta Residencial Cerrado v1");
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("o kit inteiro sai com a proposta numa folha à parte", async () => {
    const d = documentoKit(KIT, ["APRESENTACAO", "COMPARATIVO", "PROPOSTA", "ATA", "PRIVACIDADE", "RESPOSTAS", "REFERENCIAS"]);
    const pdf = await PDFDocument.load(await montarPdf(d, extras));
    expect(pdf.getTitle()).toBe("Kit para o conselho · Residencial Cerrado");
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(d.pe).toContain(HASH);
  });
});
