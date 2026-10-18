import { describe, expect, it } from "vitest";
import {
  codigoDaEtiquetaLida,
  descreverEventoEtiqueta,
  descreverEventoManutencao,
  etiquetaSchema,
  impedimentoSchema,
  linkPrestadorSchema,
  linkWhatsapp,
  mensagemEtiqueta,
  mensagemPrestador,
  rotuloEtiqueta,
  termineiSchema,
} from "./index.ts";

describe("etiquetas por local (AT-30)", () => {
  it("o código curto vai com dois dígitos", () => {
    expect(rotuloEtiqueta(4)).toBe("E04");
    expect(rotuloEtiqueta(112)).toBe("E112");
  });

  it("a mensagem já vem com o local e a etiqueta, e abre o WhatsApp do número dado", () => {
    const msg = mensagemEtiqueta("Garagem · subsolo 1", "E04");
    expect(msg).toBe("Olá! Quero avisar um problema em: Garagem · subsolo 1 (etiqueta E04). O que eu vi: ");
    expect(linkWhatsapp("+55 61 99000-1234", "Oi & tchau")).toBe("https://wa.me/5561990001234?text=Oi%20%26%20tchau");
  });

  it("recado precisa da data em que some", () => {
    expect(etiquetaSchema.safeParse({ local: "Garagem", recado: "Já sabemos", recadoAte: null }).success).toBe(false);
    expect(etiquetaSchema.parse({ local: " Garagem ", onde: "", recado: "  ", recadoAte: null }))
      .toEqual({ local: "Garagem", onde: null, recado: null, recadoAte: null });
  });

  it("lê o código da etiqueta no endereço inteiro ou sozinho, e recusa o resto (MP-08)", () => {
    expect(codigoDaEtiquetaLida("https://condominio.trihub.com.br/l/r7tw-2khm-9qxf")).toBe("R7TW-2KHM-9QXF");
    expect(codigoDaEtiquetaLida("R7TW-2KHM-9QXF")).toBe("R7TW-2KHM-9QXF");
    expect(codigoDaEtiquetaLida("https://condominio.trihub.com.br/m/R7TW-2KHM-9QXF")).toBeNull();
    expect(codigoDaEtiquetaLida("https://exemplo.com/qualquer")).toBeNull();
    expect(codigoDaEtiquetaLida("R7TW-2KHM-9QX0")).toBeNull();
  });

  it("descreve o histórico da etiqueta", () => {
    expect(descreverEventoEtiqueta("etiqueta.codigo_trocado", { motivo: "Cópia no vizinho" })).toBe("Código trocado. Motivo: Cópia no vizinho");
    expect(descreverEventoEtiqueta("etiqueta.recado", { recado: "Já sabemos", ate: "2026-10-20" })).toBe("Recado: Já sabemos · some em 20/10/2026");
  });
});

describe("link do prestador (V-11, MP-08)", () => {
  it("o que fazer tem pelo menos 10 caracteres e a data é obrigatória", () => {
    expect(linkPrestadorSchema.safeParse({ versao: 1, oQueFazer: "Trocar", valeAte: "2026-10-31" }).success).toBe(false);
    expect(linkPrestadorSchema.safeParse({ versao: 1, oQueFazer: "Trocar o rolamento da bomba 2" }).success).toBe(false);
    expect(linkPrestadorSchema.parse({ versao: 1, oQueFazer: "Trocar o rolamento da bomba 2", valeAte: "2026-10-31", quando: "" }))
      .toEqual({ versao: 1, oQueFazer: "Trocar o rolamento da bomba 2", valeAte: "2026-10-31", quando: null, comoEntrar: null, arquivos: [] });
  });

  it("a mensagem leva o serviço, o quando e o link", () => {
    expect(mensagemPrestador({ condominio: "Residencial Ipê", titulo: "Bomba com ruído", quando: "Hoje, 14h", link: "https://x/p/abc" }))
      .toBe("Olá! O Residencial Ipê mandou um serviço para você: Bomba com ruído.\nQuando: Hoje, 14h.\nVeja o que fazer, registre a chegada e conte o que fez por este link: https://x/p/abc");
  });

  it("não consegui fazer e terminei pedem o essencial", () => {
    expect(impedimentoSchema.safeParse({ impedimento: "SEM_ACESSO", texto: "ok" }).success).toBe(false);
    expect(termineiSchema.safeParse({ texto: "Troquei o rolamento", ficouPendente: true, pendenteTexto: "", quemFez: "Márcio" }).success).toBe(false);
    expect(termineiSchema.safeParse({ texto: "Troquei o rolamento", ficouPendente: false, quemFez: "Márcio" }).success).toBe(true);
  });

  it("o histórico da manutenção conta o que o prestador fez", () => {
    expect(descreverEventoManutencao("manutencao.prestador_chegou", { confirmado: true, etiqueta: "E03" })).toBe("Chegou, confirmado pela etiqueta E03");
    expect(descreverEventoManutencao("manutencao.prestador_chegou", { confirmado: false })).toBe("Chegou, informado pelo prestador");
    expect(descreverEventoManutencao("manutencao.link_prestador_enviado", { canal: "WHATSAPP" })).toBe("Link enviado por WhatsApp");
    expect(descreverEventoManutencao("manutencao.algo_novo", {})).toBe("Alteração");
  });
});
