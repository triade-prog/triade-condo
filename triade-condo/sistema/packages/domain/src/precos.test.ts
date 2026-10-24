import { describe, expect, it } from "vitest";
import {
  calcularSugestao,
  concorrenteSchema,
  faixaDasUnidades,
  faixaPrecoSchema,
  fundadorAte,
  parametrosPrecoSchema,
  precoConcorrente,
  sugestaoPlanoSchema,
} from "./precos.ts";
import { planoSchema } from "./planos.ts";
import { TEXTOS_MOTIVO } from "./textos.ts";

// A semente da 0295.
const faixas = [
  { codigo: "ATE_40", sobConsulta: false, fundador: 12900, cheia: 19900, implantacao: 60000 },
  { codigo: "DE_41_A_100", sobConsulta: false, fundador: 22900, cheia: 34900, implantacao: 90000 },
  { codigo: "DE_101_A_200", sobConsulta: false, fundador: 34900, cheia: 54900, implantacao: 140000 },
  { codigo: "DE_201_A_400", sobConsulta: false, fundador: 54900, cheia: 84900, implantacao: 200000 },
  { codigo: "ACIMA_DE_400", sobConsulta: true },
] as const;
const parametros = { mesesPagosAnual: 11, tabelaEmUso: "FUNDADOR" } as const;
const sugestao = (unidades: number, ciclo: "MENSAL" | "ANUAL" = "MENSAL", temVagaFundador = true) =>
  calcularSugestao({ faixas: [...faixas], parametros, unidades, ciclo, temVagaFundador });

describe("tabela de preços (0295)", () => {
  it("cada quantidade de unidades cai na sua faixa; sem unidade, em nenhuma", () => {
    expect(faixaDasUnidades(1)).toBe("ATE_40");
    expect(faixaDasUnidades(40)).toBe("ATE_40");
    expect(faixaDasUnidades(41)).toBe("DE_41_A_100");
    expect(faixaDasUnidades(400)).toBe("DE_201_A_400");
    expect(faixaDasUnidades(401)).toBe("ACIMA_DE_400");
    expect(faixaDasUnidades(0)).toBeNull();
  });

  it("o fundador vale 12 meses desde a competência em que o plano começa", () => {
    expect(fundadorAte("2026-11-01")).toBe("2027-10-01");
    expect(fundadorAte("2026-01-01")).toBe("2026-12-01");
  });

  it("mensal com vaga: o fundador, sem implantação", () => {
    expect(sugestao(32)).toEqual({ faixa: "ATE_40", tabela: "FUNDADOR", valor: 12900, implantacao: null, implantacaoSemCobranca: true, avisos: [] });
    expect(sugestao(64).valor).toBe(22900);
  });

  it("fundador é só no mensal: o anual vale a cheia, 11 × o mensal, implantação isenta", () => {
    expect(sugestao(32, "ANUAL")).toEqual({
      faixa: "ATE_40", tabela: "CHEIA", valor: 218900, implantacao: null, implantacaoSemCobranca: true, avisos: ["FUNDADOR_SO_MENSAL"],
    });
  });

  it("sem vaga de fundador, a cheia com a implantação", () => {
    expect(sugestao(64, "MENSAL", false)).toEqual({
      faixa: "DE_41_A_100", tabela: "CHEIA", valor: 34900, implantacao: 90000, implantacaoSemCobranca: false, avisos: ["SEM_VAGA_FUNDADOR"],
    });
  });

  it("acima de 400 é sob consulta; sem unidades, não há sugestão", () => {
    expect(sugestao(450)).toMatchObject({ faixa: "ACIMA_DE_400", tabela: "MANUAL", valor: null, avisos: ["SOB_CONSULTA"] });
    expect(sugestao(0)).toMatchObject({ faixa: null, tabela: null, avisos: ["SEM_UNIDADES"] });
  });

  it("valor vazio na tabela fica a definir, nunca zero", () => {
    const r = calcularSugestao({ faixas: [{ codigo: "ATE_40", sobConsulta: false }], parametros: { mesesPagosAnual: 11, tabelaEmUso: "CHEIA" },
                                 unidades: 10, ciclo: "MENSAL", temVagaFundador: true });
    expect(r).toMatchObject({ tabela: "CHEIA", valor: null, implantacao: null, avisos: ["VALOR_A_DEFINIR"] });
    expect(faixaPrecoSchema.parse({ versao: 1, motivo: "Reajuste" }).fundador).toBeNull();
    expect(faixaPrecoSchema.safeParse({ versao: 1, fundador: 0, motivo: "Reajuste" }).success).toBe(false);
    expect(faixaPrecoSchema.safeParse({ versao: 1, cheia: 199.9, motivo: "Reajuste" }).success).toBe(false);
  });

  it("toda mudança na tabela pede motivo", () => {
    expect(faixaPrecoSchema.safeParse({ versao: 1, cheia: 19900 }).success).toBe(false);
    expect(parametrosPrecoSchema.safeParse({ versao: 1, mesesPagosAnual: 11, parcelasImplantacao: 3, vagasFundador: 5, tabelaEmUso: "FUNDADOR", motivo: "" }).success)
      .toBe(false);
    expect(parametrosPrecoSchema.safeParse({ versao: 1, mesesPagosAnual: 13, parcelasImplantacao: 3, vagasFundador: 5, tabelaEmUso: "FUNDADOR", motivo: "Teste" }).success)
      .toBe(false);
  });

  it("concorrentes: fixo, por faixa e por unidade com mínimo", () => {
    expect(precoConcorrente({ modelo: "FIXO", valor: 2490 }, 300)).toBe(2490);
    const sindia = { modelo: "FAIXA" as const, faixas: [{ ate: 50, valor: 19700 }, { ate: 150, valor: 39700 }] };
    expect(precoConcorrente(sindia, 32)).toBe(19700);
    expect(precoConcorrente(sindia, 64)).toBe(39700);
    expect(precoConcorrente(sindia, 450)).toBeNull();
    expect(precoConcorrente({ modelo: "POR_UNIDADE", porUnidade: 490, minimo: 14900 }, 20)).toBe(14900);
    expect(precoConcorrente({ modelo: "POR_UNIDADE", porUnidade: 490, minimo: 14900 }, 64)).toBe(31360);
    const base = { nome: "SindIA", modelo: "FAIXA", fonte: "Site oficial", lidoEm: "2026-10-24", motivo: "Novo concorrente" };
    expect(concorrenteSchema.safeParse({ ...base, faixas: sindia.faixas }).success).toBe(true);
    expect(concorrenteSchema.safeParse({ ...base, faixas: [{ ate: 150, valor: 39700 }, { ate: 50, valor: 19700 }] }).success).toBe(false);
    expect(concorrenteSchema.safeParse({ ...base, modelo: "FIXO" }).success).toBe(false);
  });

  it("o plano diz de qual tabela veio; fundador no anual é recusado", () => {
    const plano = { nome: "Fundador", ciclo: "MENSAL", diaVencimento: 10, implantacaoSemCobranca: true, inicioCompetencia: "2026-11-01" };
    expect(planoSchema.parse(plano).tabela).toBeNull();
    expect(planoSchema.parse({ ...plano, tabela: "FUNDADOR" }).tabela).toBe("FUNDADOR");
    expect(planoSchema.safeParse({ ...plano, tabela: "FUNDADOR", ciclo: "ANUAL" }).success).toBe(false);
    expect(planoSchema.safeParse({ ...plano, tabela: "PROMOCAO" }).success).toBe(false);
  });

  it("a sugestão aceita o ciclo e a competência; os motivos novos têm texto", () => {
    expect(sugestaoPlanoSchema.parse({})).toEqual({ ciclo: "MENSAL", inicio: null });
    expect(sugestaoPlanoSchema.parse({ ciclo: "ANUAL", inicio: "2026-11" })).toEqual({ ciclo: "ANUAL", inicio: "2026-11-01" });
    expect(sugestaoPlanoSchema.safeParse({ ciclo: "SEMANAL" }).success).toBe(false);
    for (const m of ["FAIXA_SOB_CONSULTA", "FUNDADOR_SO_MENSAL", "SEM_VAGA_FUNDADOR", "VAGAS_OCUPADAS", "CONCORRENTE_ARQUIVADO"]) {
      expect(TEXTOS_MOTIVO[m], m).toBeTruthy();
    }
  });
});
