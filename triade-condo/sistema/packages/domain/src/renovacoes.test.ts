/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADITIVO_CAMPOS,
  ADITIVO_CAMPOS_RETORNO,
  aditivoRetornoSchema,
  avisarAte,
  avisoReajusteSchema,
  CANAIS_AVISO,
  camposErradosAditivo,
  clienteFicouSchema,
  competenciaDesde,
  confirmarCancelamentoSchema,
  desfazerCancelamentoSchema,
  dispensarRenovacaoSchema,
  editarExpansaoSchema,
  encerrarExpansaoSchema,
  ETAPAS_EXPANSAO,
  marcarRiscoSchema,
  modeloAditivoSchema,
  MOTIVOS_CANCELAMENTO,
  novaExpansaoSchema,
  ORIGENS_RISCO,
  pedirCancelamentoSchema,
  reativarClienteSchema,
  regraReajusteSchema,
  retencaoCancelamentoSchema,
  SITUACOES_CANCELAMENTO,
  SITUACOES_VOLTA_CANCELAMENTO,
  SITUACOES_RENOVACAO,
  textoAvisoReajuste,
  TIPOS_ADITIVO,
  TIPOS_EXPANSAO,
  TIPOS_RENOVACAO,
  TIPOS_RISCO,
  tratarRiscoSchema,
  ultimoDiaCancelamento,
  valeDesde,
  valorComReajuste,
} from "./renovacoes.ts";
import { MOTIVOS_INICIO_COMERCIAL } from "./comercial.ts";
import { TEXTOS_MOTIVO } from "./textos.ts";

const SQL = readFileSync(new URL("../../../supabase/migrations/0311_comercial_renovacao_cancelamento.sql", import.meta.url), "utf8");
const SQL_0318 = readFileSync(new URL("../../../supabase/migrations/0318_comercial_reativar_fechar_entrada.sql", import.meta.url), "utf8");
const ID = "6f1f3a1e-4a55-4c43-9d40-5a2f7e9c1b10";
const listaDoBanco = (re: RegExp) => {
  const m = SQL.match(re);
  expect(m).not.toBeNull();
  return [...m![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
};

describe("listas iguais às do banco (0311)", () => {
  it("renovação: tipo, situação registrada e canal do aviso", () => {
    expect(listaDoBanco(/tipo\s+text not null check \(tipo in \(('REAJUSTE'[^)]*)\)\)/)).toEqual(Object.keys(TIPOS_RENOVACAO));
    expect(listaDoBanco(/situacao\s+text not null check \(situacao in \(('AVISO_ENVIADO'[^)]*)\)\)/)).toEqual(
      Object.keys(SITUACOES_RENOVACAO).filter((s) => s !== "ATRASADO" && s !== "AVISAR"),
    );
    expect(listaDoBanco(/aviso_canal\s+text check \(aviso_canal in \(([^)]*)\)\)/)).toEqual(Object.keys(CANAIS_AVISO));
    // As duas calculadas saem da leitura da tela.
    expect(SQL).toContain("then 'ATRASADO' else 'AVISAR' end");
  });

  it("os campos do aditivo são os mesmos", () => {
    const m = SQL.match(/create function aditivo_campos\(\)[\s\S]*?select array\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    expect([...m![1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).toEqual(Object.keys(ADITIVO_CAMPOS));
  });

  it("risco: tipo e origem", () => {
    expect(listaDoBanco(/tipo\s+text not null check \(tipo in \(('SINDICO_NOVO'[^)]*)\)\)/)).toEqual(Object.keys(TIPOS_RISCO));
    expect(listaDoBanco(/origem\s+text not null check \(origem in \(([^)]*)\)\)/)).toEqual(Object.keys(ORIGENS_RISCO));
  });

  it("cancelamento: os motivos do quadro 347 e as situações (mais o encerrado, calculado)", () => {
    expect(listaDoBanco(/motivo\s+text check \(motivo in \(([^)]*)\)\)/)).toEqual(Object.keys(MOTIVOS_CANCELAMENTO));
    expect(Object.values(MOTIVOS_CANCELAMENTO)).toEqual([
      "Síndico novo", "Preço", "Pouco uso", "Foi para outro sistema", "Administradora oferece", "Fechou o condomínio", "Outro",
    ]);
    expect(listaDoBanco(/situacao\s+text not null default 'PEDIDO' check \(situacao in \(([^)]*)\)\)/)).toEqual(
      Object.keys(SITUACOES_CANCELAMENTO).filter((s) => s !== "ENCERRADO"),
    );
    expect(SQL).toContain("then 'ENCERRADO' else k.situacao end");
  });

  it("0318: o cancelamento desfeito e o reativado; as duas partes do aditivo e os campos do retorno", () => {
    const m = SQL_0318.match(/add constraint cancelamentos_cliente_situacao_check\s+check \(situacao in \(([^)]*)\)\)/);
    expect(m).not.toBeNull();
    expect([...m![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1])).toEqual([
      ...Object.keys(SITUACOES_CANCELAMENTO).filter((s) => s !== "ENCERRADO"), ...Object.keys(SITUACOES_VOLTA_CANCELAMENTO),
    ]);
    expect(SQL_0318).toContain("then 'ENCERRADO' else k.situacao end");
    const t = SQL_0318.match(/alter table modelos_aditivo add column tipo text not null default 'REAJUSTE' check \(tipo in \(([^)]*)\)\)/);
    expect(t).not.toBeNull();
    expect([...t![1]!.matchAll(/'([A-Z_]+)'/g)].map((x) => x[1])).toEqual(Object.keys(TIPOS_ADITIVO));
    const c = SQL_0318.match(/when 'RETORNO' then array\[([^\]]*)\]/);
    expect(c).not.toBeNull();
    expect([...c![1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).toEqual(Object.keys(ADITIVO_CAMPOS_RETORNO));
  });

  it("0318: cada motivo de recusa tem texto (também os que saem por variável)", () => {
    const motivos = [...SQL_0318.matchAll(/recusar_motivo\('(?:[^']|'')*',\s*'([A-Z_]+)'\)/g)].map((x) => x[1]!);
    expect(motivos.length).toBeGreaterThan(10);
    for (const x of [...motivos, "ADITIVO_SUBSTITUIDO", "ADITIVO_ASSINADO", "ADITIVO_GERANDO", "CONDOMINIO_JA_CONFERIDO", "ORDEM_DAS_ASSINATURAS"]) {
      expect(TEXTOS_MOTIVO[x], x).toBeTruthy();
    }
  });

  it("expansão: tipo e etapa", () => {
    expect(listaDoBanco(/tipo\s+text not null check \(tipo in \(('MAIS_UM_PREDIO'[^)]*)\)\)/)).toEqual(Object.keys(TIPOS_EXPANSAO));
    expect(listaDoBanco(/etapa\s+text not null default 'ABERTA' check \(etapa in \(([^)]*)\)\)/)).toEqual(Object.keys(ETAPAS_EXPANSAO));
  });

  it("os motivos do Início ganham a renovação e o risco, na ordem do banco", () => {
    expect(SQL).toContain(
      "case it.motivo when 'PRIMEIRO_RETORNO' then 1 when 'ATRASADO' then 2 when 'PARADO' then 3 when 'JANELA' then 4 when 'RENOVACAO' then 5 else 6 end",
    );
    expect(Object.keys(MOTIVOS_INICIO_COMERCIAL)).toEqual(["PRIMEIRO_RETORNO", "ATRASADO", "PARADO", "JANELA", "RENOVACAO", "RISCO"]);
  });

  it("cada motivo de recusa da 0311 tem texto", () => {
    const motivos = [...SQL.matchAll(/recusar_motivo\('[^']*', '([A-Z_]+)'\)/g)].map((m) => m[1]!);
    expect(motivos.length).toBeGreaterThan(10);
    for (const m of motivos) expect(TEXTOS_MOTIVO[m], m).toBeTruthy();
    expect(TEXTOS_MOTIVO.CONTRATO_ENCERRADO).toBeTruthy();
  });
});

describe("as contas da renovação e do cancelamento", () => {
  it("reajuste: 229,00 com IPCA de 4,8% dá 239,99 (como o banco, ao centavo)", () => {
    expect(valorComReajuste(22900, 4.8)).toBe(23999);
    expect(valorComReajuste(10000, 4.5)).toBe(10450);
    expect(valorComReajuste(1, 50)).toBe(2); // 1,5 centavo sobe
    expect(valorComReajuste(34900, 0)).toBe(34900);
    expect(valorComReajuste(20000, -2.25)).toBe(19550);
  });

  it("avisar até e vale desde (decisões 6 e d)", () => {
    expect(avisarAte("2026-12-15", 30)).toBe("2026-11-15");
    expect(competenciaDesde("2026-12-15", 10)).toBe("2027-01-01");
    expect(competenciaDesde("2026-12-05", 10)).toBe("2026-12-01");
    // Aviso em 20/11 com 30 dias: o prazo acaba em 20/12, depois do aniversário de 15/12.
    expect(valeDesde("2026-12-15", "2026-11-20", 30, 10)).toBe("2027-01-01");
    expect(valeDesde("2026-12-15", "2026-10-01", 30, 20)).toBe("2026-12-01");
  });

  it("o último dia é o pedido mais 30 dias (24/10 dá 23/11)", () => {
    expect(ultimoDiaCancelamento("2026-10-24")).toBe("2026-11-23");
    expect(ultimoDiaCancelamento("2027-01-24T10:00:00-03:00")).toBe("2027-02-23");
  });

  it("o texto do aviso traz os valores, o índice e a competência", () => {
    const t = textoAvisoReajuste({
      contato: "Marta", condominio: "Residencial Pequi", aniversario: "2026-12-01", tipo: "REAJUSTE", valorAtual: 22900, valorNovo: 23999,
      ciclo: "MENSAL", indice: "IPCA", percentual: 4.8, referencia: "12 meses até outubro", valeDesde: "2027-01-01",
    });
    expect(t).toContain("Olá, Marta.");
    expect(t).toContain("01/12/2026");
    expect(t).toContain("IPCA de 4,8% (12 meses até outubro)");
    expect(t).toContain("de R$ 229,00 para R$ 239,99 por mês, a partir da competência 01/2027");
    expect(t.length).toBeLessThanOrEqual(2000);
    const f = textoAvisoReajuste({
      condominio: "Edifício Ipê", aniversario: "2026-12-01", tipo: "FIM_FUNDADOR", valorAtual: 24900, valorNovo: 134900, ciclo: "MENSAL",
      valeDesde: "2027-01-01",
    });
    expect(f).toContain("preço de fundador");
    expect(f).toContain("R$ 1.349,00");
  });

  it("os campos do aditivo: errado, inexistente e aspas soltas", () => {
    expect(camposErradosAditivo("O valor passa de «valor_atual» para «valor_novo».")).toEqual([]);
    expect(camposErradosAditivo("«valor» e «sindico» e « solta")).toEqual(["«", "«sindico»", "«valor»"]);
  });

  it("cada parte do aditivo tem os seus campos (0318)", () => {
    const retorno = "O «condominio», por «representante» (CPF «cpf_representante»), volta a partir da «vale_desde».";
    expect(camposErradosAditivo(retorno, "RETORNO")).toEqual([]);
    expect(camposErradosAditivo(retorno)).toEqual(["«cpf_representante»", "«representante»"]);
    expect(camposErradosAditivo("Reajuste em «aniversario».", "RETORNO")).toEqual(["«aniversario»"]);
    expect(camposErradosAditivo("«constructor» e «toString»", "RETORNO")).toEqual(["«constructor»", "«toString»"]);
  });
});

describe("o que a tela manda", () => {
  it("a regra: índice e percentual juntos, até duas casas, prazo de 30 a 120", () => {
    expect(regraReajusteSchema.parse({ versao: 1, indice: "IPCA", percentual: 4.8, prazoAvisoDias: 30 })).toEqual({
      versao: 1, indice: "IPCA", percentual: 4.8, referencia: null, prazoAvisoDias: 30,
    });
    expect(regraReajusteSchema.safeParse({ versao: 1, indice: "", percentual: null, prazoAvisoDias: 30 }).success).toBe(true);
    expect(regraReajusteSchema.safeParse({ versao: 1, indice: "IPCA", prazoAvisoDias: 30 }).success).toBe(false);
    expect(regraReajusteSchema.safeParse({ versao: 1, indice: "IPCA", percentual: 4.825, prazoAvisoDias: 30 }).success).toBe(false);
    expect(regraReajusteSchema.safeParse({ versao: 1, indice: "IPCA", percentual: 60, prazoAvisoDias: 30 }).success).toBe(false);
    expect(regraReajusteSchema.safeParse({ versao: 1, prazoAvisoDias: 20 }).success).toBe(false);
    expect(regraReajusteSchema.safeParse({ versao: 1, referencia: "out/2026", prazoAvisoDias: 30 }).success).toBe(false);
  });

  it("o aviso e a dispensa", () => {
    const aviso = { interessadoId: ID, aniversario: "2026-12-01", valorNovo: 23999, canal: "WHATSAPP", para: "Marta (síndica)", texto: "Olá, Marta. O reajuste..." };
    expect(avisoReajusteSchema.parse(aviso).avisoEm).toBeNull();
    // r4: o valor que a tela mostrou vai junto; r17: a data tem de existir.
    expect(avisoReajusteSchema.safeParse({ ...aviso, valorNovo: undefined }).success).toBe(false);
    expect(avisoReajusteSchema.safeParse({ ...aviso, aniversario: "2027-02-30" }).success).toBe(false);
    expect(dispensarRenovacaoSchema.safeParse({ interessadoId: ID, aniversario: "2027-02-29", motivo: "Combinado na proposta" }).success).toBe(false);
    expect(dispensarRenovacaoSchema.safeParse({ interessadoId: ID, aniversario: "2028-02-29", motivo: "Combinado na proposta" }).success).toBe(true);
    expect(avisoReajusteSchema.safeParse({ ...aviso, canal: "SMS" }).success).toBe(false);
    expect(avisoReajusteSchema.safeParse({ ...aviso, texto: "curto" }).success).toBe(false);
    expect(dispensarRenovacaoSchema.safeParse({ interessadoId: ID, aniversario: "2026-12-01", motivo: "ok" }).success).toBe(false);
    expect(dispensarRenovacaoSchema.safeParse({ interessadoId: ID, aniversario: "2026-12-01", motivo: "Combinado na proposta" }).success).toBe(true);
  });

  it("o modelo de aditivo recusa campo errado", () => {
    const texto = "Aditivo ao contrato «contrato» do «condominio». O valor passa a «valor_novo» desde a «vale_desde».";
    expect(modeloAditivoSchema.safeParse({ titulo: "Aditivo de reajuste", texto }).success).toBe(true);
    expect(modeloAditivoSchema.safeParse({ titulo: "Aditivo de reajuste", texto: texto.replace("«valor_novo»", "«valor»") }).success).toBe(false);
  });

  it("o modelo de aditivo de retorno confere os campos do retorno; o tipo é Reajuste ou Retorno", () => {
    const texto = "O «condominio» (CNPJ «cnpj»), por «representante», volta ao contrato «contrato» no plano «plano», por «valor_mensal».";
    expect(modeloAditivoSchema.parse({ tipo: "RETORNO", titulo: "Aditivo de retorno", texto }).tipo).toBe("RETORNO");
    expect(modeloAditivoSchema.parse({ titulo: "Aditivo de reajuste", texto: "Aditivo ao contrato «contrato» do «condominio» com o valor «valor_novo»." }).tipo).toBeNull();
    expect(modeloAditivoSchema.safeParse({ tipo: "RETORNO", titulo: "Aditivo de retorno", texto: `${texto} Reajuste em «aniversario».` }).success).toBe(false);
    expect(modeloAditivoSchema.safeParse({ tipo: "OUTRO", titulo: "Aditivo de retorno", texto }).success).toBe(false);
  });

  it("desfazer pede a nota; reativar, a versão", () => {
    expect(desfazerCancelamentoSchema.safeParse({ versao: 3 }).success).toBe(false);
    expect(desfazerCancelamentoSchema.safeParse({ versao: 3, nota: "  " }).success).toBe(false);
    expect(desfazerCancelamentoSchema.parse({ versao: 3, nota: " A síndica desistiu " })).toEqual({ versao: 3, nota: "A síndica desistiu" });
    expect(reativarClienteSchema.safeParse({}).success).toBe(false);
    expect(reativarClienteSchema.parse({ versao: 4 })).toEqual({ versao: 4 });
  });

  it("o aditivo de retorno: quem assina, CPF válido, competência no dia 1 e o ciclo", () => {
    const base = { representante: "Lúcia Prado", cpf: "529.982.247-25", competencia: "2027-03-01", ciclo: "MENSAL" };
    expect(aditivoRetornoSchema.parse(base)).toEqual({ ...base, cpf: "52998224725", valorCentavos: null, motivo: null });
    expect(aditivoRetornoSchema.safeParse({ ...base, cpf: "529.982.247-24" }).success).toBe(false);
    expect(aditivoRetornoSchema.safeParse({ ...base, cpf: undefined }).success).toBe(false);
    expect(aditivoRetornoSchema.safeParse({ ...base, competencia: "2027-03-15" }).success).toBe(false);
    expect(aditivoRetornoSchema.safeParse({ ...base, ciclo: "SEMESTRAL" }).success).toBe(false);
    expect(aditivoRetornoSchema.safeParse({ ...base, representante: "L" }).success).toBe(false);
    expect(aditivoRetornoSchema.safeParse({ ...base, valorCentavos: 0 }).success).toBe(false);
    expect(aditivoRetornoSchema.parse({ ...base, valorCentavos: 159900, motivo: "Prefere o anual" })).toMatchObject({ valorCentavos: 159900, motivo: "Prefere o anual" });
  });

  it("o sinal à mão é síndico novo ou troca na pauta; uso caindo vem dos pedidos", () => {
    expect(marcarRiscoSchema.safeParse({ interessadoId: ID, tipo: "TROCA_NA_PAUTA", data: "2026-12-10" }).success).toBe(true);
    expect(marcarRiscoSchema.safeParse({ interessadoId: ID, tipo: "USO_CAINDO", data: "2026-12-10" }).success).toBe(false);
    expect(marcarRiscoSchema.safeParse({ interessadoId: ID, tipo: "SINDICO_NOVO", data: "2026-12-10", detalhe: "ab" }).success).toBe(false);
    expect(tratarRiscoSchema.parse({ versao: 1, nota: "" })).toEqual({ versao: 1, nota: null });
  });

  it("o cancelamento: quem pediu, a tentativa (o outro motivo pede o texto) e a confirmação", () => {
    expect(pedirCancelamentoSchema.parse({ interessadoId: ID, pedidoPor: "Síndica Marta" }).pedidoEm).toBeNull();
    expect(pedirCancelamentoSchema.safeParse({ interessadoId: ID, pedidoPor: "M" }).success).toBe(false);
    expect(retencaoCancelamentoSchema.safeParse({ versao: 1, motivo: "PRECO", retencao: "Ofereci dois meses com 20%" }).success).toBe(true);
    expect(retencaoCancelamentoSchema.safeParse({ versao: 1, motivo: "OUTRO", retencao: "Ofereci dois meses com 20%" }).success).toBe(false);
    expect(retencaoCancelamentoSchema.safeParse({ versao: 1, motivo: "OUTRO", motivoTexto: "Mudou de prédio", retencao: "Ofereci desconto" }).success).toBe(true);
    expect(retencaoCancelamentoSchema.safeParse({ versao: 1, motivo: "PRECO", retencao: "" }).success).toBe(false);
    expect(confirmarCancelamentoSchema.safeParse({ versao: 2 }).success).toBe(false);
    expect(confirmarCancelamentoSchema.parse({ versao: 2, motivo: "POUCO_USO", lembrarEm: "" })).toEqual({
      versao: 2, motivo: "POUCO_USO", motivoTexto: null, lembrarEm: null,
    });
    expect(clienteFicouSchema.safeParse({ versao: 2 }).success).toBe(true);
  });

  it("a expansão: o mais um prédio traz o condomínio novo; perdida pede o que aconteceu", () => {
    const base = { interessadoId: ID, motivo: "Tem outro prédio no bairro", responsavelId: ID, proximoPasso: "Ligar na segunda" };
    expect(novaExpansaoSchema.safeParse({ ...base, tipo: "MAIS_UM_PREDIO" }).success).toBe(false);
    const ok = novaExpansaoSchema.parse({ ...base, tipo: "MAIS_UM_PREDIO", oportunidade: { condominio: "Edifício Pequi II", uf: "df" } });
    expect(ok.etapa).toBe("ABERTA");
    expect(ok.oportunidade?.uf).toBe("DF");
    expect(novaExpansaoSchema.safeParse({ ...base, tipo: "MUDAR_FAIXA", oportunidade: { condominio: "Outro" } }).success).toBe(false);
    expect(novaExpansaoSchema.safeParse({ ...base, tipo: "RECONQUISTA", etapa: "GANHA" }).success).toBe(false);
    expect(editarExpansaoSchema.safeParse({ ...base, versao: 1, etapa: "PROPOSTA" }).success).toBe(true);
    expect(encerrarExpansaoSchema.safeParse({ versao: 1, etapa: "PERDIDA" }).success).toBe(false);
    expect(encerrarExpansaoSchema.safeParse({ versao: 1, etapa: "GANHA" }).success).toBe(true);
  });
});
