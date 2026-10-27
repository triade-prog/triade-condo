// Parceiros e agenda nas telas (R17.6; CM-22 e CM-23): as abas, a regra em texto, o extrato em
// PDF com o "—" do perdido, os horários livres em texto e de volta, o selo de cada demonstração e o
// horário de Brasília.
import { describe, expect, it } from "vitest";
import { agendarDemonstracaoSchema, CAMPO_LINK_AGENDA, preencherMensagem } from "@triade/domain";
import {
  apoioDisponibilidade, campoBrasilia, chipDia, faixasParaCampo, instanteBrasilia, lerFaixasDoDia, linhasHorarios, primeiroDiaLivre, quandoCurtoDemo, seloDemonstracao,
  textoConfirmar, textoEmails, urlAgenda, type Demonstracao,
} from "./agenda.ts";
import {
  contarAbas, documentoExtrato, filtrarParceiros, linhasRegra, mesCurto, textoComissaoLinha, textoPagamento, textoPercentual, tituloColunaComissao, type ExtratoParceiro,
  type LinhaExtrato, type ParceiroLinha,
} from "./parceiros.ts";

const parceiro = (p: Partial<ParceiroLinha>): ParceiroLinha => ({
  id: "p1", versao: 1, tipo: "SINDICO_PROFISSIONAL", nome: "Marta Lins", ativo: true, anonimizado: false, criadoEm: "2026-08-01T12:00:00Z",
  indicacoes: 3, indicacoesMes: 1, prediosAtivos: 2, comissaoMes: 4580, ...p,
});
const linha = (l: Partial<LinhaExtrato>): LinhaExtrato => ({
  comissaoId: "c1", versao: 1, interessadoId: "i1", condominio: "Residencial Pequi", desde: "2026-08-01", mensalidade: 22900, comissao: 2290, situacao: "ATIVA",
  percentual: 10, ...l,
});
const extrato = (e: Partial<ExtratoParceiro>): ExtratoParceiro => ({
  parceiro: parceiro({}), mes: "2026-10", mesTexto: "outubro de 2026",
  linhas: [linha({}), linha({ comissaoId: "c2", condominio: "Condomínio Parque das Flores", desde: "2026-10-01" }),
    linha({ comissaoId: "c3", condominio: "Edifício Mangaba", comissao: null, situacao: "ENCERRADA" })],
  total: 4580, regra: { percentual: 10, prazoMeses: null, versao: 1 }, indicacoes: [], podeComissao: true, ...e,
});
const demo = (d: Partial<Demonstracao>): Demonstracao => ({
  id: "d1", versao: 1, inicio: "2026-10-28T17:00:00Z", fim: "2026-10-28T17:30:00Z", quando: "terça, 28/10, 14:00", situacao: "MARCADA", origem: "LINK", remarcacoes: 0,
  interessado: { id: "i1", versao: 1, condominio: "Edifício Jatobá", etapa: "DEMO_MARCADA", temEmail: true }, com: { id: "u1", nome: "Carolina" },
  confirmacao: "ENVIADO", lembrete: "NA_FILA", ...d,
});

describe("parceiros (CM-22)", () => {
  it("as abas: ativos, indicações do mês, sem indicação há 90 dias e inativos", () => {
    const lista = [
      parceiro({}), parceiro({ id: "p2", indicacoesMes: 0, semIndicacao90: true }), parceiro({ id: "p3", ativo: false, indicacoesMes: 0 }),
    ];
    expect(contarAbas(lista)).toEqual({ ATIVOS: 2, MES: 1, SEM_INDICACAO: 1, INATIVOS: 1 });
    expect(filtrarParceiros(lista, "INATIVOS").map((p) => p.id)).toEqual(["p3"]);
  });

  it("a regra em texto, com e sem prazo", () => {
    expect(linhasRegra({ percentual: 10, versao: 1 })).toEqual([
      ["Quanto", "10% da mensalidade de cada prédio ativo"], ["Por quanto tempo", "Enquanto o prédio for cliente"],
      ["Pagamento", "Fora do sistema; marcar como pago guarda quem e quando"],
    ]);
    expect(linhasRegra({ percentual: 12.5, prazoMeses: 12, versao: 2 })[1]).toEqual(["Por quanto tempo", "Os primeiros 12 meses de cada prédio"]);
    expect(textoPercentual(12.5)).toBe("12,5%");
  });

  it("o extrato: desde em mês/ano, o perdido com traço e a coluna do percentual", () => {
    const e = extrato({});
    expect(mesCurto("2026-08-01")).toBe("08/2026");
    expect(textoComissaoLinha(e.linhas[0]!)).toBe("R$ 22,90");
    expect(textoComissaoLinha(e.linhas[2]!)).toBe("— (deixou de ser cliente)");
    expect(tituloColunaComissao(e)).toBe("10% no mês");
    expect(tituloColunaComissao(extrato({ linhas: [linha({}), linha({ percentual: 8 })] }))).toBe("Comissão no mês");
  });

  it("o pagamento: não registrado, pago igual, falta ou pago a mais", () => {
    expect(textoPagamento({})).toBe("Ainda não registrado como pago.");
    const pago = { valor: 4580, calculado: 4580, pagoEm: "2026-11-05", registradoEm: "2026-11-05T12:00:00Z", registradoPor: "Ana" };
    expect(textoPagamento({ pago, diferenca: 0 })).toBe("Pago R$ 45,80 em 05/11/2026, registrado por Ana.");
    expect(textoPagamento({ pago: { ...pago, valor: 4000 }, diferenca: 580 })).toContain("Falta R$ 5,80");
    expect(textoPagamento({ pago: { ...pago, valor: 5000 }, diferenca: -420 })).toContain("Pago a mais: R$ 4,20");
  });

  it("o PDF do extrato tem a tabela, o total, a regra e o pagamento por fora", () => {
    const d = documentoExtrato(extrato({}));
    expect(d.principal).toBe("Extrato de outubro de 2026");
    expect(d.nomeArquivo).toBe("extrato-marta-lins-2026-10.pdf");
    const tabela = d.blocos.find((b) => b.tipo === "tabela");
    expect(tabela).toMatchObject({ cabecalho: ["Prédio", "Desde", "Mensalidade", "10% no mês"] });
    expect(tabela && tabela.tipo === "tabela" ? tabela.linhas[2] : null).toEqual(["Edifício Mangaba", "08/2026", "R$ 229,00", "— (deixou de ser cliente)"]);
    expect(d.blocos).toContainEqual({ tipo: "destaque", rotulo: "Total do mês", valor: "R$ 45,80" });
    expect(JSON.stringify(d.blocos)).toContain("fora do sistema");
    expect(documentoExtrato(extrato({ linhas: [], total: 0 })).blocos[0]).toMatchObject({ linhas: [["Nenhum prédio cliente neste mês", "", "", ""]] });
  });
});

describe("agenda de demonstrações (CM-23)", () => {
  const faixas = [{ dia: 1, de: "14:00", ate: "17:00" }, { dia: 1, de: "10:00", ate: "12:00" }, { dia: 4, de: "14:00", ate: "17:00" }];

  it("os horários livres em texto, como o quadro 341", () => {
    expect(linhasHorarios(faixas).map((l) => `${l.nome}: ${l.texto}`)).toEqual([
      "Segunda: 10:00 a 12:00 · 14:00 a 17:00", "Terça: sem demonstração", "Quarta: sem demonstração", "Quinta: 14:00 a 17:00", "Sexta: sem demonstração",
    ]);
    expect(linhasHorarios([{ dia: 6, de: "09:00", ate: "11:00" }]).at(-1)).toEqual({ dia: 6, nome: "Sábado", texto: "09:00 a 11:00" });
    expect(apoioDisponibilidade({ duracaoMinutos: 30, intervaloMinutos: 15, avisoDiasUteis: 1, horizonteDias: 14 }))
      .toBe("Duração de 30 minutos, intervalo de 15. Aviso mínimo de 1 dia útil, até 14 dias à frente.");
  });

  it("os horários do dia como se digita, e de volta", () => {
    expect(faixasParaCampo(faixas, 1)).toBe("10:00-12:00, 14:00-17:00");
    expect(lerFaixasDoDia(2, "10-12, 14h-17h30")).toEqual({ faixas: [{ dia: 2, de: "10:00", ate: "12:00" }, { dia: 2, de: "14:00", ate: "17:30" }] });
    expect(lerFaixasDoDia(2, "")).toEqual({ faixas: [] });
    expect(lerFaixasDoDia(2, "12:00-10:00")).toHaveProperty("erro");
    expect(lerFaixasDoDia(2, "10:00-12:00, 11:00-13:00")).toEqual({ erro: "Os horários do dia se cruzam" });
    expect(lerFaixasDoDia(2, "manhã")).toHaveProperty("erro");
  });

  it("o selo de cada demonstração", () => {
    expect(seloDemonstracao(demo({}))).toEqual({ texto: "Agendou pelo link", tom: "info" });
    expect(seloDemonstracao(demo({ lembrete: "ENVIADO" }))).toEqual({ texto: "Lembrete enviado", tom: "ok" });
    expect(seloDemonstracao(demo({ remarcacoes: 1 }))).toEqual({ texto: "Remarcou 1 vez", tom: "atencao" });
    expect(seloDemonstracao(demo({ confirmacao: "FALHOU" }))).toEqual({ texto: "E-mail não saiu", tom: "atencao" });
    expect(seloDemonstracao(demo({ origem: "MAO" }))).toEqual({ texto: "Marcada pela equipe", tom: "neutro" });
    expect(seloDemonstracao(demo({ situacao: "FEITA" }))).toEqual({ texto: "Feita", tom: "ok" });
  });

  it("os e-mails por extenso; sem e-mail, diz para combinar pelo WhatsApp", () => {
    expect(textoEmails(demo({}))).toBe("Confirmação: enviado; lembrete: na fila.");
    expect(textoEmails(demo({ confirmacao: "SEM_CHAVE", lembrete: "SEM_CHAVE" }))).toBe("Confirmação: sem e-mail configurado; lembrete: sem e-mail configurado.");
    expect(textoEmails(demo({ confirmacao: undefined, lembrete: undefined, interessado: { ...demo({}).interessado, temEmail: false } }))).toBe("Sem e-mail: combine pelo WhatsApp.");
  });

  it("o horário de Brasília: a coluna Quando, o botão de confirmar e os campos", () => {
    expect(quandoCurtoDemo("2026-10-27T17:00:00Z")).toBe("ter 27/10 · 14:00");
    expect(textoConfirmar("2026-10-27T17:00:00Z")).toBe("Confirmar terça, 27/10, 14:00");
    expect(instanteBrasilia("2026-10-28", "14:00")).toBe("2026-10-28T14:00:00-03:00");
    expect(instanteBrasilia("2026-10-28", "")).toBeNull();
    expect(campoBrasilia("2026-10-28T02:30:00Z")).toEqual({ data: "2026-10-27", hora: "23:30" });
    expect(chipDia("2026-10-28")).toMatchObject({ semana: "qua", numero: "28" });
  });

  it("o primeiro dia com horário livre e o endereço do link", () => {
    const dias = [
      { data: "2026-10-27", horarios: [{ inicio: "2026-10-27T13:00:00Z", hora: "10:00", livre: false }] },
      { data: "2026-10-28", horarios: [{ inicio: "2026-10-28T17:00:00Z", hora: "14:00", livre: true }] },
    ];
    expect(primeiroDiaLivre(dias)).toBe("2026-10-28");
    expect(primeiroDiaLivre([])).toBeNull();
    expect(urlAgenda("https://console.triadecondo.com.br/", "abcdefgh2345")).toBe("https://console.triadecondo.com.br/a/abcdefgh2345");
  });

  it("R17.6b: o [link de agendamento] da mensagem pronta vira o link de quem atende; sem link, fica o campo", () => {
    const texto = "Oi, [nome]! Escolha o horário da demonstração do [condominio]: [link de agendamento]";
    expect(preencherMensagem(texto, { nome: "João Reis", condominio: "Edifício Ipê", linkAgenda: urlAgenda("https://console.triadecondo.com.br", "abcdefgh2345") }))
      .toBe("Oi, João! Escolha o horário da demonstração do Edifício Ipê: https://console.triadecondo.com.br/a/abcdefgh2345");
    expect(preencherMensagem(texto, { nome: "João", condominio: "Edifício Ipê" })).toBe(`Oi, João! Escolha o horário da demonstração do Edifício Ipê: ${CAMPO_LINK_AGENDA}`);
  });

  it("0310 A: o link da mensagem leva o convite da ficha no ?c=; o convite do agendamento só vale no formato", () => {
    expect(urlAgenda("https://console.triadecondo.com.br", "abcdefgh2345", "0123456789abcdef0123456789abcdef"))
      .toBe("https://console.triadecondo.com.br/a/abcdefgh2345?c=0123456789abcdef0123456789abcdef");
    expect(urlAgenda("https://console.triadecondo.com.br", "abcdefgh2345", null)).toBe("https://console.triadecondo.com.br/a/abcdefgh2345");
    const pedido = { inicio: "2026-10-27T14:00:00-03:00", nome: "Rita Dias", whatsapp: "61999990701", email: "rita@exemplo.com.br", condominio: "Edifício Sucupira", consentimento: true };
    expect(agendarDemonstracaoSchema.parse({ ...pedido, convite: "0123456789ABCDEF0123456789ABCDEF" }).convite).toBe("0123456789abcdef0123456789abcdef");
    expect(agendarDemonstracaoSchema.parse({ ...pedido, convite: "curto" }).convite).toBeNull();
    expect(agendarDemonstracaoSchema.parse(pedido).convite).toBeNull();
  });
});
