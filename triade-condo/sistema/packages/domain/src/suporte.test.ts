import { describe, expect, it } from "vitest";
import {
  abrirChamadoSchema,
  decidirAcessoExcepcionalSchema,
  decidirSuporteAcessoSchema,
  descreverAcessoExcepcional,
  descreverEvento,
  etapaImplantacaoSchema,
  mascararEmail,
  pedirAcessoExcepcionalSchema,
  rotuloSituacaoChamadoCliente,
  trocaSindicoSchema,
} from "./index.ts";

const ID = "4b9c1f7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OUTRO = "5c0d2e8f-2b3c-4d4e-9f0a-1b2c3d4e5f60";

describe("implantação (PI-04, SH-01)", () => {
  it("realizada só com o que foi feito; não se aplica só com motivo", () => {
    expect(etapaImplantacaoSchema.safeParse({ versao: 1, situacao: "REALIZADA", feito: "  " }).success).toBe(false);
    expect(etapaImplantacaoSchema.safeParse({ versao: 1, situacao: "NAO_SE_APLICA" }).success).toBe(false);
    expect(etapaImplantacaoSchema.parse({ versao: 1, situacao: "REALIZADA", feito: " Ficha completa. ", modalidade: "VIDEO" })).toMatchObject({
      feito: "Ficha completa.",
      modalidade: "VIDEO",
      responsavelId: null,
    });
  });

  it("substituto diferente do responsável", () => {
    expect(etapaImplantacaoSchema.safeParse({ versao: 1, situacao: "PENDENTE", responsavelId: ID, substitutoId: ID }).success).toBe(false);
    expect(etapaImplantacaoSchema.safeParse({ versao: 1, situacao: "PENDENTE", responsavelId: ID, substitutoId: OUTRO }).success).toBe(true);
  });
});

describe("troca de síndico (CT-01)", () => {
  it("registra quem pediu, o canal e o que foi conferido", () => {
    const base = { vinculoId: ID, versao: 1, pedidoPor: "Conselheira Rita", canal: "WHATSAPP", nome: "Marcos", email: "MARCOS@exemplo.com.br" };
    expect(trocaSindicoSchema.safeParse({ ...base, conferido: [] }).success).toBe(false);
    expect(trocaSindicoSchema.parse({ ...base, conferido: ["Ata da AGE"] }).email).toBe("marcos@exemplo.com.br");
  });
});

describe("suporte de acesso (PI-09)", () => {
  it("o e-mail aparece mascarado para a equipe", () => {
    expect(mascararEmail("bruna@exemplo.com.br")).toBe("b••••@exemplo.com.br");
    expect(mascararEmail("al@x.com")).toBe("a•••@x.com");
  });
  it("recusar e passar à administração pedem motivo", () => {
    expect(decidirSuporteAcessoSchema.safeParse({ versao: 1, decisao: "RECUSAR" }).success).toBe(false);
    expect(decidirSuporteAcessoSchema.safeParse({ versao: 1, decisao: "ENVIAR" }).success).toBe(true);
  });
});

describe("acesso excepcional (PI-11)", () => {
  it("até 72 horas, só áreas previstas", () => {
    const base = { motivo: "A fila some depois de filtrar", areas: ["PEDIDOS"] };
    expect(pedirAcessoExcepcionalSchema.safeParse({ ...base, horas: 73 }).success).toBe(false);
    expect(pedirAcessoExcepcionalSchema.safeParse({ ...base, areas: ["FINANCEIRO"], horas: 2 }).success).toBe(false);
    expect(pedirAcessoExcepcionalSchema.parse({ ...base, horas: 24 }).chamadoId).toBeNull();
  });
  it("recusar pede motivo; a frase diz o que e por quanto tempo", () => {
    expect(decidirAcessoExcepcionalSchema.safeParse({ aprovar: false }).success).toBe(false);
    expect(descreverAcessoExcepcional(["PEDIDOS", "MORADORES", "MANUTENCAO"], 24)).toBe("Pedidos, Moradores e Manutenção por 24 horas");
    expect(descreverAcessoExcepcional(["PEDIDOS"], 1)).toBe("Pedidos por 1 hora");
  });
});

describe("chamados (PI-17, PI-20)", () => {
  it("tipo, área, título e o que aconteceu", () => {
    expect(abrirChamadoSchema.safeParse({ tipo: "RECLAMACAO", area: "PEDIDOS", titulo: "Fila", texto: "Some" }).success).toBe(false);
    expect(abrirChamadoSchema.parse({ tipo: "PROBLEMA", area: "PEDIDOS", titulo: " Fila some ", texto: "Some ao filtrar" }).titulo).toBe("Fila some");
  });
  it("o cliente vê com quem está o chamado", () => {
    expect(rotuloSituacaoChamadoCliente("NOVO")).toBe("Com a TRÍADE");
    expect(rotuloSituacaoChamadoCliente("ESPERANDO_CLIENTE")).toBe("Esperando você");
  });
  it("o histórico descreve os eventos novos", () => {
    expect(descreverEvento({ acao: "acesso_excepcional.leitura", entidade: "acesso_excepcional", dados: { area: "PEDIDOS" } })).toBe(
      "A TRÍADE abriu Pedidos pelo acesso excepcional",
    );
    expect(descreverEvento({ acao: "implantacao.etapa", entidade: "implantacao", dados: { etapa: 4, para: "REALIZADA" } })).toBe("Etapa 4: Realizada");
  });
});
