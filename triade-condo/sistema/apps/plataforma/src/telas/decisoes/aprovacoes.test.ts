// R5 · Decisões e aprovações (V-14, FC-10): as frases das telas do conselho, das despesas e do
// link do conselheiro, que saem dos dados da API sem pensar de novo a regra.
import { describe, expect, it } from "vitest";
import type { ConselhoPublico, Despesa } from "../tipos.ts";
import { achadosDaLigacao, ligacaoParaApi, linhaDespesa, situacaoDespesa, textoLigacao } from "./Despesas.tsx";
import { textoVotosDespesa } from "./Despesa.tsx";
import { abreJanelaDoReenvio, recadoDoReenvio, recadoDosLinks, rotuloEnvioWhatsapp, temLinkParaCopiar } from "./votacao.tsx";
import { avisoMandato, votaPor } from "../pessoas/Conselho.tsx";
import { textoResultado } from "../publico/Conselho.tsx";
import { textoDecisoesAguardando } from "../Inicio.tsx";

const despesa = (x: Partial<Despesa>) => ({
  estado: "AGUARDANDO", modo: "PESSOA", fornecedor: { nome: "Elevadores Planalto" }, prazo: "2026-10-23", ...x,
}) as Despesa;

describe("situação da despesa (quadro 418)", () => {
  it("em votação mostra os votos de aprovar sobre os necessários", () => {
    const d = despesa({ modo: "CONSELHO", conselho: { contagem: { APROVAR: 1, RECUSAR: 1 }, necessarios: 3 } as unknown as Despesa["conselho"] });
    expect(situacaoDespesa(d)).toEqual({ texto: "Em votação · 1 de 3", tom: "andamento" });
  });
  it("com recusa na frente, a votação mostra 0 de aprovar", () => {
    const d = despesa({ modo: "CONSELHO", conselho: { contagem: { RECUSAR: 2 }, necessarios: 3 } as unknown as Despesa["conselho"] });
    expect(situacaoDespesa(d).texto).toBe("Em votação · 0 de 3");
  });
  it("de uma pessoa: o primeiro nome, ou você", () => {
    expect(situacaoDespesa(despesa({ decisor: { nome: "Ana Souza" } as Despesa["decisor"] })).texto).toBe("Aguardando Ana");
    expect(situacaoDespesa(despesa({ decisor: { nome: "Ana Souza", eu: true } as Despesa["decisor"] })).texto).toBe("Aguardando você");
  });
  it("que voltou ao síndico deixa de ser votação", () => {
    const d = despesa({ modo: "CONSELHO", voltouAoSindicoEm: "2026-10-20T03:00:00Z", decisor: { nome: "Ana Souza" } as Despesa["decisor"],
      conselho: { contagem: {}, necessarios: 3 } as unknown as Despesa["conselho"] });
    expect(situacaoDespesa(d).texto).toBe("Aguardando Ana");
  });
  it("paga fora do sistema continua aprovada; recusada e retirada", () => {
    expect(situacaoDespesa(despesa({ estado: "PAGA" as Despesa["estado"] }))).toEqual({ texto: "Aprovada", tom: "ok" });
    expect(situacaoDespesa(despesa({ estado: "RECUSADA" }))).toEqual({ texto: "Recusada", tom: "erro" });
    expect(situacaoDespesa(despesa({ estado: "RETIRADA" }))).toEqual({ texto: "Retirada", tom: "neutro" });
  });
  it("a segunda linha leva o fornecedor e o que importa agora", () => {
    expect(linhaDespesa(despesa({}))).toBe("Elevadores Planalto · responder até 23/10");
    expect(linhaDespesa(despesa({ modo: "CONSELHO" }))).toBe("Elevadores Planalto · votar até 23/10");
    expect(linhaDespesa(despesa({ vencimento: "2026-10-30" }))).toBe("Elevadores Planalto · vence 30/10");
    expect(linhaDespesa(despesa({ estado: "APROVADA", pagamento: { pagaEm: "2026-10-15" } as Despesa["pagamento"] })))
      .toBe("Elevadores Planalto · paga fora do sistema em 15/10");
  });
  it("os votos da despesa, por extenso", () => {
    expect(textoVotosDespesa(undefined)).toBe("Nenhum voto ainda");
    expect(textoVotosDespesa({ APROVAR: 3, RECUSAR: 1 })).toBe("3 aprovam · 1 recusa");
    expect(textoVotosDespesa({ RECUSAR: 2 })).toBe("2 recusam");
  });
});

describe("conselho (quadros 410 a 412)", () => {
  it("por onde o membro vota", () => {
    expect(votaPor({ vota: false, painel: false, canal: "WHATSAPP" })).toBe("Não vota (suplente)");
    expect(votaPor({ vota: true, painel: true, canal: "EMAIL" })).toBe("Painel e link");
    expect(votaPor({ vota: true, painel: false, canal: "WHATSAPP" })).toBe("Link pelo WhatsApp");
    expect(votaPor({ vota: true, painel: false, canal: "EMAIL" })).toBe("Link pelo e-mail");
  });
  it("o selo do mandato: vencido, ainda não começou, vence em N dias", () => {
    const hoje = "2026-10-16";
    expect(avisoMandato({ emDia: false, mandatoInicio: "2024-10-10", mandatoFim: "2026-10-10", mandatoVencendo: false }, hoje)).toEqual({ texto: "Mandato vencido", tom: "erro" });
    expect(avisoMandato({ emDia: false, mandatoInicio: "2026-11-01", mandatoFim: "2028-11-01", mandatoVencendo: false }, hoje)?.texto).toBe("Começa em 01/11");
    expect(avisoMandato({ emDia: true, mandatoInicio: "2024-11-14", mandatoFim: "2026-11-14", mandatoVencendo: true }, hoje)?.texto).toBe("Mandato vence em 29 dias");
    expect(avisoMandato({ emDia: true, mandatoInicio: "2024-10-17", mandatoFim: "2026-10-17", mandatoVencendo: true }, hoje)?.texto).toBe("Mandato vence amanhã");
    expect(avisoMandato({ emDia: true, mandatoInicio: "2026-01-01", mandatoFim: "2028-01-01", mandatoVencendo: false }, hoje)).toBeNull();
  });
  it("o recado depois de pedir ao conselho separa o e-mail do WhatsApp", () => {
    expect(recadoDosLinks([{ membroId: "1", nome: "João", envio: "EMAIL" }, { membroId: "2", nome: "Marta", envio: "COPIAR", codigo: "x" }] as never))
      .toBe("Link mandado pelo e-mail para João. Falta mandar pelo WhatsApp para Marta: copie o link na janela.");
  });
});

describe("os links do substituto e de quem não vê o código", () => {
  it("o recado diz de quem o link fica com o síndico", () => {
    expect(recadoDosLinks([{ membroId: "1", nome: "Marta", canal: "WHATSAPP", envio: "COPIAR", aviso: "Peça o link ao síndico" }] as never))
      .toBe("Peça o link ao síndico de Marta pelo WhatsApp.");
  });
  it("o Reenviar: do substituto para copiar, pelo e-mail, ou com o aviso", () => {
    expect(recadoDoReenvio({ membroId: "1", nome: "Bruna", canal: "WHATSAPP", envio: "COPIAR", finalidade: "SUBSTITUTO", codigo: "x" }))
      .toBe("Link do substituto novo para Bruna. O anterior parou de valer. Copie e mande pelo WhatsApp.");
    expect(recadoDoReenvio({ membroId: "1", nome: "João", canal: "EMAIL", envio: "EMAIL", finalidade: "VOTO" }))
      .toBe("Link novo mandado pelo e-mail para João. O anterior parou de valer.");
    expect(recadoDoReenvio({ membroId: "1", nome: "Marta Reis", canal: "WHATSAPP", envio: "COPIAR", aviso: "Peça o link ao síndico" }))
      .toBe("Peça o link ao síndico: o link de Marta Reis pelo WhatsApp só sai com ele. O que Marta já tinha continua valendo.");
  });
});

describe("R5.3: o link pelo WhatsApp do condomínio (envio WHATSAPP)", () => {
  it("V-14: já foi, como o e-mail; a janela abre só no Reenviar, para quem vê o código", () => {
    const zap = { membroId: "2", nome: "Marta", canal: "WHATSAPP", envio: "WHATSAPP", codigo: "x" } as const;
    expect(recadoDosLinks([{ membroId: "1", nome: "João", canal: "EMAIL", envio: "EMAIL" }, zap]))
      .toBe("Link mandado pelo e-mail para João. Link mandado pelo WhatsApp do condomínio para Marta.");
    expect(temLinkParaCopiar([zap])).toBe(false);
    expect(temLinkParaCopiar([{ ...zap, envio: "COPIAR" }])).toBe(true);
    expect(abreJanelaDoReenvio(zap)).toBe(true);
    expect(abreJanelaDoReenvio({ ...zap, codigo: undefined })).toBe(false);
    expect(recadoDoReenvio({ ...zap, finalidade: "SUBSTITUTO" })).toBe("Link do substituto novo mandado pelo WhatsApp do condomínio para Marta. O anterior parou de valer.");
  });
  it("V-14: nas listas, envio é a situação da mensagem no WhatsApp do condomínio (0305)", () => {
    expect(rotuloEnvioWhatsapp("ENTREGUE")).toBe("Entregue");
    expect(rotuloEnvioWhatsapp("LIDA")).toBe("Lida");
    expect(rotuloEnvioWhatsapp("WHATSAPP")).toBe("Na fila");
    expect(rotuloEnvioWhatsapp("DESCONHECIDO")).toBe("Resultado desconhecido");
  });
});

describe("R5.3: Ligada a, uma coisa só (quadro 419)", () => {
  it("FC-10: a ligação vai num campo só e aparece com o tipo na frente", () => {
    expect(ligacaoParaApi(null)).toEqual({ pedidoId: null, manutencaoId: null, decisaoId: null });
    expect(ligacaoParaApi({ tipo: "MANUTENCAO", id: "m1", rotulo: "Elevador social parado · 14/10" })).toEqual({ pedidoId: null, manutencaoId: "m1", decisaoId: null });
    expect(textoLigacao({ tipo: "MANUTENCAO", id: "m1", rotulo: "Elevador social parado · 14/10" })).toBe("Manutenção · Elevador social parado · 14/10");
  });
  it("FC-10: a busca junta pedidos, manutenções e as decisões que batem com o texto", () => {
    const achados = achadosDaLigacao("laje",
      { itens: [{ id: "p1", protocolo: "2026-0001", assunto: "Infiltração na laje", unidade: null, local: "Garagem G2" }] } as never,
      { itens: [{ id: "m1", titulo: "Impermeabilizar a laje", local: "Cobertura", criadoEm: "2026-10-14T13:00:00Z" }] } as never,
      { decisoes: [{ id: "d1", pergunta: "Qual conserto fazer na laje", pedidaEm: "2026-10-15T12:00:00Z", pedido: { protocolo: "2026-0001", assunto: "Infiltração" } },
        { id: "d2", pergunta: "Cor do hall", pedidaEm: "2026-10-15T12:00:00Z" }] } as never);
    expect(achados.map(textoLigacao)).toEqual(["Pedido · 2026-0001 · Infiltração na laje", "Manutenção · Impermeabilizar a laje · 14/10", "Decisão · Qual conserto fazer na laje · 15/10"]);
    expect(achados[0]!.sub).toBe("Garagem G2");
  });
});

describe("link do conselheiro e Início", () => {
  const fechada = (resultado: object, extra: object = {}) => ({ conselho: { necessarios: 3 }, item: { tipo: "DECISAO", resultado,
    alternativas: [{ numero: 1, descricao: "Cinza claro" }], ...extra } }) as unknown as ConselhoPublico;
  it("o resultado da votação fechada numa frase (quadro 417)", () => {
    expect(textoResultado(fechada({ estado: "APROVADA", alternativaAprovada: 1, justificativa: "Aprovada por 3 de 4 titulares" })))
      .toBe("Aprovada a alternativa 1 · Cinza claro. Aprovada por 3 de 4 titulares.");
    expect(textoResultado(fechada({ estado: "AGUARDANDO", voltouAoSindico: true }))).toBe("Sem 3 votos iguais no conselho: a decisão voltou para o síndico.");
    expect(textoResultado(fechada({ estado: "RECUSADA" }, { tipo: "DESPESA" }))).toBe("Despesa recusada.");
  });
  it("Início conta as despesas e os votos dentro de aguardando", () => {
    expect(textoDecisoesAguardando({ aguardando: 2, votos: 1, despesas: 1 })).toBe("2 decisões aguardando você");
    expect(textoDecisoesAguardando({ aguardando: 1, votos: 0, despesas: 1 })).toBe("1 despesa aguardando você");
    expect(textoDecisoesAguardando({ aguardando: 1 })).toBe("1 decisão aguardando você");
  });
});
