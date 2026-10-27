/// <reference types="node" />
// A proposta como apresentação (R17.8, CM-34; quadros 450 a 457): os textos da capa, da tabela, do
// escopo, da equipe e das condições saem do que a versão guardou (0312), e o PDF tem quatro folhas.
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { ESCOPO_INCLUIDO } from "@triade/domain";
import { EQUIPE_IMPLANTACAO, iniciais, montarApresentacao, whatsTexto, type ApresentacaoGuardada } from "./apresentacao.ts";
import { montarPdfApresentacao } from "./pdfApresentacao.ts";
import { conteudoDaVersao, type VersaoProposta } from "./propostas.ts";

const HASH = "9f2c".padEnd(60, "0") + "41ab";
const FAIXAS: ApresentacaoGuardada["tabela"] = {
  em: "2026-10-26", mesesPagos: 11, parcelas: 3, vagasFundador: 5, faixas: [
    { codigo: "ATE_40", nome: "Até 40 unidades", de: 1, ate: 40, sobConsulta: false, fundador: 12900, cheia: 19900, implantacao: 60000 },
    { codigo: "DE_41_A_100", nome: "41 a 100 unidades", de: 41, ate: 100, sobConsulta: false, fundador: 22900, cheia: 34900, implantacao: 90000 },
    { codigo: "DE_101_A_200", nome: "101 a 200 unidades", de: 101, ate: 200, sobConsulta: false, fundador: 34900, cheia: 54900, implantacao: 140000 },
    { codigo: "DE_201_A_400", nome: "201 a 400 unidades", de: 201, ate: 400, sobConsulta: false, fundador: 54900, cheia: 84900, implantacao: 200000 },
    { codigo: "ACIMA_DE_400", nome: "Acima de 400 unidades", de: 401, sobConsulta: true },
  ],
};
const GUARDADA: ApresentacaoGuardada = {
  tabela: FAIXAS,
  equipe: { comercial: { nome: "Bianca Rocha", email: "bianca@trihub.com.br" }, implantacao: { nome: "Carolina" } },
  escopo: { incluido: ESCOPO_INCLUIDO.map((i) => ({ ...i })), naoIncluido: ["Financeiro, boletos e cobrança condominial.", "Portaria, controle de acesso e câmeras.", "Serviços jurídicos ou contábeis."] },
  condicoes: { cancelamentoDias: 30, avisoReajusteDias: 30 },
};
const V: VersaoProposta = {
  id: "v1", versaoRegistro: 3, numero: 1, situacao: "ENVIADA", condominio: "Residencial Cerrado", cidade: "Brasília", uf: "DF", faixa: "DE_41_A_100", unidades: 72,
  ciclo: "MENSAL", tabela: "FUNDADOR", mensalTabela: 22900, mensal: 22900, depoisFundador: 34900, fundadorMeses: 12, implantacaoSemCusto: true, porApartamento: 318,
  premissas: { estimativa: true, semRoi: true, implantacaoAParte: true, mensal: 22900, unidades: 72, porApartamento: 318, texto: "Estimativa", taxaCondominio: 650 },
  incluido: ["Todo pedido com responsável, prazo e conclusão explicada"], planejado: ["WhatsApp oficial", "Inteligência artificial"],
  validadeDias: 15, validoAte: "2026-11-10", hash: HASH, criadoEm: "2026-10-26T13:00:00-03:00", enviadaEm: "2026-10-26T14:00:00-03:00",
  notaInterna: "NOTA-INTERNA", apresentacao: GUARDADA,
};
const ZAP = "5561999990410";
const ENDERECO = "https://t3condo.trihub.com.br/o/7K2Q-PX9M";

describe("a apresentação da proposta (quadros 450 a 455)", () => {
  const a = montarApresentacao(conteudoDaVersao(V, "Lúcia Prado"), { whatsapp: ZAP, endereco: ENDERECO });

  it("a capa tem o prédio, o preço por apartamento, o peso na taxa e a garantia", () => {
    expect(a.olhoCapa).toBe("Residencial Cerrado / Brasília (DF)");
    expect(a.para).toBe("Aos cuidados de Lúcia Prado · Brasília (DF) · 72 unidades");
    expect(a.rotuloCondicao).toBe("Uma condição pensada para 72 unidades");
    expect(a.preco).toEqual({ rotulo: "Valor mensal de fundador", valor: "R$ 229,00", porAp: "R$ 3,18", taxa: "cerca de 0,5% da taxa média de R$ 650,00",
      implantacao: "Implantação sem custo" });
    expect(a.garantia).toEqual({ titulo: "12 meses de preço garantido", validade: "Válida até 10/11/2026" });
  });

  it("o investimento traz a tabela do dia inteira, com o prédio marcado", () => {
    const t = a.investimento.tabela!;
    expect(t.data).toBe("Valores mensais em R$ · tabela de 26/10/2026");
    expect(t.cabecalho).toEqual(["Unidades", "Fundador", "Tabela cheia", "Implantação"]);
    expect(t.linhas[1]).toEqual({ faixa: "41 a 100", seu: true, valores: ["R$ 229,00", "R$ 349,00", "Sem custo no fundador"] });
    expect(t.linhas[4]).toEqual({ faixa: "Acima de 400", seu: false, valores: ["Sob consulta", "Sob consulta", "Sob consulta"] });
    expect(a.investimento.seu.lado).toEqual({ olho: "Condição especial", titulo: "12 meses", sub: "com preço garantido", depois: "Depois: R$ 349,00 por mês" });
    expect(a.investimento.considerado).toContain("para os 5 primeiros condomínios");
    expect(a.investimento.nota).toBe("Estimativa por apartamento: R$ 229,00 ÷ 72 unidades. Não representa economia prometida.");
  });

  it("o escopo diz o que não está incluído e que nada é cobrado à parte; o planejado sem data", () => {
    expect(a.escopo.incluido.map((i) => i.titulo)).toEqual(["Solicitações organizadas", "Comunicação com moradores", "Agenda e manutenção", "Implantação acompanhada"]);
    expect(a.escopo.naoIncluido).toHaveLength(3);
    expect(a.escopo.planejado).toBe("Em planejamento: WhatsApp oficial e inteligência artificial. Sem data de lançamento prometida.");
  });

  it("os contatos: quem fez, com o WhatsApp comercial e o e-mail, e quem implanta", () => {
    expect(a.contatos[0]).toEqual({ iniciais: "BR", nome: "Bianca Rocha", papel: "Proposta e atendimento comercial",
      linhas: [{ icone: "whats", texto: "(61) 9 9999-0410 · WhatsApp" }, { icone: "email", texto: "bianca@trihub.com.br" }] });
    expect([a.contatos[1].iniciais, a.contatos[1].nome]).toEqual(["CA", "Carolina"]);
    expect(whatsTexto("556133334444")).toBe("(61) 3333-4444");
    expect(iniciais(EQUIPE_IMPLANTACAO)).toBe("TR");
  });

  it("as condições: cancelamento, reajuste sem índice inventado, dados e validade", () => {
    expect(a.condicoes.map((c) => c.texto)).toEqual([
      "Sem prazo mínimo. Cancelamento com 30 dias de aviso, sem multa.",
      "Preço de fundador por 12 meses. Depois, R$ 349,00 por mês. Reajuste anual pelo índice do contrato, com aviso de 30 dias antes.",
      "O condomínio é o dono dos dados. Na saída, a TRÍADE entrega tudo exportado.",
      "Aceite até 10/11/2026 (versão v1). Depois dessa data, os valores são confirmados de novo.",
    ]);
    const comIndice = montarApresentacao(conteudoDaVersao({ ...V, apresentacao: { ...GUARDADA, condicoes: { indice: "IPCA", avisoReajusteDias: 45 } } }));
    expect(comIndice.condicoes[1]!.texto).toContain("Reajuste anual pelo IPCA, com aviso de 45 dias antes.");
  });

  it("nada interno passa e nenhum valor fica por preencher", () => {
    const tudo = JSON.stringify(a);
    expect(tudo).not.toContain("NOTA-INTERNA");
    expect(tudo).not.toMatch(/\[[^\]"]*\]|a definir|R\$ —/);
  });
});

describe("os estados da apresentação (quadro 457)", () => {
  it("sem a taxa média: só o valor por apartamento, sem percentual", () => {
    const a = montarApresentacao(conteudoDaVersao({ ...V, premissas: { ...V.premissas!, taxaCondominio: undefined } }));
    expect([a.preco.porAp, a.preco.taxa]).toEqual(["R$ 3,18", undefined]);
    expect(a.investimento.seu.texto).toBe("Cerca de R$ 3,18 por apartamento.");
  });

  it("tabela cheia no anual: sem a coluna do fundador, com o 12 por 11 e a implantação isenta", () => {
    const a = montarApresentacao(conteudoDaVersao({ ...V, ciclo: "ANUAL", tabela: "CHEIA", mensalTabela: 34900, mensal: 34900, anual: 383900, mesesPagos: 11,
      depoisFundador: undefined, fundadorMeses: undefined, porApartamento: 485 }));
    expect(a.preco).toEqual({ rotulo: "Valor mensal, pago no anual", valor: "R$ 349,00", porAp: "R$ 4,85", taxa: "12 meses pelo preço de 11: R$ 3.839,00 por ano",
      implantacao: "Implantação isenta no anual" });
    expect(a.investimento.tabela!.cabecalho).toEqual(["Unidades", "Tabela cheia", "Implantação"]);
    expect(a.investimento.tabela!.linhas[1]!.valores).toEqual(["R$ 349,00", "Isenta no anual"]);
    expect(a.garantia.titulo).toBe("12 meses pelo preço de 11");
    expect(a.condicoes[1]!.texto).toBe("Reajuste anual pelo índice do contrato, com aviso de 30 dias antes.");
  });

  it("acima de 400 unidades: a linha sob consulta marcada e o valor combinado na capa", () => {
    const a = montarApresentacao(conteudoDaVersao({ ...V, faixa: "ACIMA_DE_400", unidades: 450, tabela: "MANUAL", mensalTabela: 150000, mensal: 150000,
      implantacaoSemCusto: false, implantacao: 300000, implantacaoParcelas: 3, porApartamento: 333 }));
    expect(a.investimento.tabela!.linhas[4]).toEqual({ faixa: "Acima de 400", seu: true, valores: ["Sob consulta", "Sob consulta"] });
    expect(a.preco.rotulo).toBe("Valor mensal combinado");
    expect(a.preco.valor).toBe("R$ 1.500,00");
    expect(a.preco.implantacao).toBe("Implantação de R$ 3.000,00 em até 3 vezes");
  });

  it("ninguém escolhido para implantar: o cartão fala da equipe; sem e-mail, só o WhatsApp", () => {
    const a = montarApresentacao(conteudoDaVersao({ ...V, apresentacao: { ...GUARDADA, equipe: { comercial: { nome: "Bianca Rocha" } } } }), { whatsapp: ZAP });
    expect(a.contatos[1]).toMatchObject({ iniciais: "TR", nome: EQUIPE_IMPLANTACAO });
    expect(a.contatos[0]!.linhas).toEqual([{ icone: "whats", texto: "(61) 9 9999-0410 · WhatsApp" }]);
  });

  it("a versão de antes da 0312: sem a tabela e sem nomes, com o incluído que ela guardou", () => {
    const a = montarApresentacao(conteudoDaVersao({ ...V, apresentacao: undefined }));
    expect(a.investimento.tabela).toBeUndefined();
    expect(a.escopo.incluido).toEqual([{ titulo: "Todo pedido com responsável, prazo e conclusão explicada" }]);
    expect(a.escopo.naoIncluido).toEqual([]);
    expect(a.contatos.map((c) => c.nome)).toEqual(["Equipe comercial da TRÍADE", EQUIPE_IMPLANTACAO]);
  });

  it("o rascunho, antes do envio: a validade contada do envio", () => {
    const a = montarApresentacao(conteudoDaVersao({ ...V, situacao: "RASCUNHO", validoAte: undefined, hash: undefined }));
    expect(a.garantia.validade).toBe("Validade de 15 dias, contada do envio");
    expect(a.condicoes[3]!.texto).toBe("Aceite em até 15 dias depois do envio (versão v1). Depois disso, os valores são confirmados de novo.");
  });
});

describe("o PDF em quatro folhas (quadros 452 a 455)", () => {
  const ler = (u: string) => {
    const b = readFileSync(new URL(u, import.meta.url));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };
  const extras = {
    fontes: { normal: ler("../../../public/fontes/manrope-latin-400-normal.woff"), forte: ler("../../../public/fontes/manrope-latin-600-normal.woff") },
    logo: ler("../../../public/marca/logo.png"),
    cores: { tinta: "#1e1531", suave: "#5e5475", linha: "#e4dcf1", violeta: "#5808cc", violeta50: "#f8f3ff", violeta100: "#f1e9fc", violeta200: "#ddc8f8",
      violeta500: "#7b3bdc", laranja: "#ff8d01", ok: "#0b7558", okFundo: "#edfaf5", okBorda: "#bce8d7" },
    geradoEmTexto: "26/10/2026 às 20:00",
  };

  it("sai com quatro folhas A4 e o título da proposta, com e sem o QR code", async () => {
    for (const endereco of [ENDERECO, undefined]) {
      const bytes = await montarPdfApresentacao(montarApresentacao(conteudoDaVersao(V, "Lúcia Prado"), { whatsapp: ZAP, endereco }), extras);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(4);
      expect(pdf.getTitle()).toBe("Proposta Residencial Cerrado v1");
      expect(Math.round(pdf.getPage(0).getWidth())).toBe(596);
      if (endereco && process.env.PDF_APRESENTACAO) writeFileSync(process.env.PDF_APRESENTACAO, bytes);
    }
  });
});
