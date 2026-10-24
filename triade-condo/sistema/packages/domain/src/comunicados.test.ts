import { describe, expect, it } from "vitest";
import {
  aoMoradorPadrao,
  buscaComunicadosSchema,
  descreverAlcance,
  descreverEventoComunicado,
  descreverEventoDocumento,
  descreverValidade,
  documentoSchema,
  noHorarioSemEnvio,
  planoComunicacaoSchema,
  salvarComunicadoSchema,
  textoParaCopiar,
  versaoDocumentoSchema,
} from "./comunicados.ts";
import { descreverEventoPedido } from "./pedidos.ts";
import { PERMISSOES } from "./plataforma.ts";

const U = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const BASE = { assunto: "OBRAS", titulo: "Falta de água na quinta", texto: "A água será desligada das 9h às 13h.", publico: "TODOS", acao: "RASCUNHO" };

describe("comunicados (peça R1)", () => {
  it("CD-01: assunto, título e texto; o resto é opcional", () => {
    const d = salvarComunicadoSchema.parse(BASE);
    expect(d.blocos).toEqual([]);
    expect(d.pedidoId).toBeNull();
    expect(salvarComunicadoSchema.safeParse({ ...BASE, titulo: "Fa" }).success).toBe(false);
    expect(salvarComunicadoSchema.safeParse({ ...BASE, assunto: "PROPAGANDA" }).success).toBe(false);
  });

  it("CD-02: por bloco, unidade ou contato pede a escolha", () => {
    const r = salvarComunicadoSchema.safeParse({ ...BASE, publico: "BLOCOS" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["blocos"]);
    expect(salvarComunicadoSchema.safeParse({ ...BASE, publico: "BLOCOS", blocos: [U] }).success).toBe(true);
    expect(salvarComunicadoSchema.safeParse({ ...BASE, publico: "CONTATOS", contatos: [] }).success).toBe(false);
  });

  it("CD-06: programar pede o dia e a hora", () => {
    expect(salvarComunicadoSchema.safeParse({ ...BASE, acao: "PROGRAMAR" }).success).toBe(false);
    expect(salvarComunicadoSchema.safeParse({ ...BASE, acao: "PROGRAMAR", programadoPara: "2026-10-21T18:00:00-03:00" }).success).toBe(true);
  });

  it("CD-01: o texto copiado leva título, texto e assinatura", () => {
    expect(textoParaCopiar({ titulo: "Falta de água", texto: "Das 9h às 13h.", assinatura: "Ana, síndica" }))
      .toBe("*Falta de água*\n\nDas 9h às 13h.\n\nAna, síndica");
    expect(textoParaCopiar({ titulo: "Falta de água", texto: "Das 9h às 13h.", assinatura: null })).toBe("*Falta de água*\n\nDas 9h às 13h.");
  });

  it("CD-11: o horário sem envio pode atravessar a meia-noite", () => {
    expect(noHorarioSemEnvio("22:30", "21:00", "08:00")).toBe(true);
    expect(noHorarioSemEnvio("07:59", "21:00", "08:00")).toBe(true);
    expect(noHorarioSemEnvio("08:00", "21:00", "08:00")).toBe(false);
    expect(noHorarioSemEnvio("13:00", "12:00", "14:00")).toBe(true);
    expect(noHorarioSemEnvio("13:00", "08:00", "08:00")).toBe(false);
  });

  it("CD-11: o plano pede ao menos um assunto e a assinatura", () => {
    const base = { versao: 1, assuntos: ["AVISO"], plano: null, assinatura: "Ana, síndica", silencioInicio: "21:00", silencioFim: "08:00" };
    expect(planoComunicacaoSchema.safeParse(base).success).toBe(true);
    expect(planoComunicacaoSchema.safeParse({ ...base, assuntos: [] }).success).toBe(false);
    expect(planoComunicacaoSchema.safeParse({ ...base, silencioFim: "24:00" }).success).toBe(false);
  });

  it("CD-02: o alcance diz quantos contatos e de quantas unidades", () => {
    expect(descreverAlcance(61, 44)).toBe("61 contatos de 44 unidades");
    expect(descreverAlcance(1, 1)).toBe("1 contato de 1 unidade");
    expect(descreverAlcance(0, 0)).toBe("Ninguém recebe");
  });

  it("CD-01: o histórico diz o que aconteceu em cada versão", () => {
    expect(descreverEventoComunicado("comunicado.corrigido", { numero: 2, mudanca: "Horário corrigido" }))
      .toBe("Corrigido na versão 2: Horário corrigido");
    expect(descreverEventoComunicado("comunicado.publicado", { numero: 1, programado: true })).toBe("Versão 1 publicada na hora marcada");
    expect(descreverEventoComunicado("estado.mudou", { para: "ARQUIVADO", motivo: "Obra feita" })).toBe("Arquivado: Obra feita");
    expect(descreverEventoPedido("pedido.comunicado_ligado", {})).toBe("Comunicado ligado ao pedido");
  });
});

describe("documentos (peça R1)", () => {
  it("CD-04: documento só da gestão não vai ao morador", () => {
    expect(documentoSchema.safeParse({ tipo: "CONTRATO", titulo: "Contrato do elevador", restrito: true, aoMorador: true }).success).toBe(false);
    expect(documentoSchema.parse({ tipo: "REGIMENTO", titulo: "Regimento interno" }).restrito).toBe(false);
  });

  it("CD-03: pode ir ao morador já ligado para convenção, regimento, atas e orçamento", () => {
    expect(aoMoradorPadrao("REGIMENTO")).toBe(true);
    expect(aoMoradorPadrao("CONTRATO")).toBe(false);
    expect(aoMoradorPadrao("LAUDO")).toBe(false);
  });

  it("CD-07: a versão diz desde quando vale", () => {
    expect(versaoDocumentoSchema.safeParse({ nome: "regimento.pdf", tipo: "application/pdf", tamanho: 10 }).success).toBe(false);
    expect(versaoDocumentoSchema.parse({ nome: "regimento.pdf", tipo: "application/pdf", tamanho: 10, vigenteDesde: "2026-11-01" }).mudanca)
      .toBeNull();
  });

  it("MP-12: a validade aparece a 60 dias do fim", () => {
    expect(descreverValidade("2026-11-29", "2026-10-18")).toBe("vence em 42 dias");
    expect(descreverValidade("2026-10-18", "2026-10-18")).toBe("vence hoje");
    expect(descreverValidade("2026-10-15", "2026-10-18")).toBe("venceu há 3 dias");
    expect(descreverValidade("2027-03-31", "2026-10-18")).toBe("vale até 03/2027");
    expect(descreverValidade(null, "2026-10-18")).toBeNull();
  });

  it("CD-04: abrir e baixar ficam no histórico", () => {
    expect(descreverEventoDocumento("documento.baixado", { numero: 5 })).toBe("Versão 5 baixada");
    expect(descreverEventoDocumento("documento.versao_guardada", { numero: 6, vigenteDesde: "2026-11-01" }))
      .toBe("Versão 6 guardada, vale desde 01/11/2026");
  });

  it("CF-03: as permissões novas aparecem para o síndico dar", () => {
    expect(PERMISSOES.VER_COMUNICADOS).toBe("Ver comunicados e documentos");
    expect(PERMISSOES.DOCUMENTOS).toBe("Cuidar dos documentos");
  });

  it("CD-01 (decisão C.1): o período nos Filtros tem De e Até, e o fim não vem antes do começo", () => {
    expect(buscaComunicadosSchema.parse({ de: "2026-10-01", ate: "2026-10-31" })).toMatchObject({ de: "2026-10-01", ate: "2026-10-31", pagina: 1 });
    expect(buscaComunicadosSchema.safeParse({ de: "2026-10-01" }).success).toBe(true);
    expect(buscaComunicadosSchema.safeParse({ de: "2026-10-31", ate: "2026-10-01" }).error?.issues[0]?.path).toEqual(["ate"]);
    expect(buscaComunicadosSchema.safeParse({ de: "01/10/2026" }).success).toBe(false);
  });
});
