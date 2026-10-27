/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  agendarDemonstracaoSchema,
  bloqueioAgendaSchema,
  calculadoraSiteSchema,
  comissaoDoMes,
  demonstracaoFeitaSchema,
  diaAgendaTexto,
  disponibilidadeSchema,
  encerrarDemonstracaoSchema,
  pagamentoComissaoSchema,
  parceiroSchema,
  quandoDemonstracao,
  regraComissaoSchema,
  SITUACOES_COMISSAO,
  SITUACOES_DEMONSTRACAO,
  SITUACOES_EMAIL_COMERCIAL,
  TIPOS_PARCEIRO,
} from "./parceiros.ts";
import { indicacaoParceiroSchema, novoInteressadoSchema } from "./comercial.ts";

const SQL = readFileSync(new URL("../../../supabase/migrations/0310_comercial_parceiros_agenda.sql", import.meta.url), "utf8");
const ID = "6f1f3a1e-4a55-4c43-9d40-5a2f7e9c1b10";

describe("parceiros e comissão (0310, CM-22)", () => {
  it("as listas são as mesmas do banco", () => {
    for (const t of Object.keys(TIPOS_PARCEIRO)) expect(SQL).toContain(`'${t}'`);
    for (const s of Object.keys(SITUACOES_COMISSAO)) expect(SQL).toContain(`'${s}'`);
    for (const s of Object.keys(SITUACOES_DEMONSTRACAO)) expect(SQL).toContain(`'${s}'`);
    for (const s of Object.keys(SITUACOES_EMAIL_COMERCIAL)) expect(SQL).toContain(`'${s}'`);
  });

  it("o cadastro do parceiro normaliza o contato e confere o tipo", () => {
    const p = parceiroSchema.parse({ tipo: "ADMINISTRADORA", nome: " Marta Lins ", whatsapp: "(61) 98888-7777", email: "MARTA@exemplo.com.br", cnpj: "11.222.333/0001-81" });
    expect(p).toMatchObject({ nome: "Marta Lins", whatsapp: "5561988887777", email: "marta@exemplo.com.br", cnpj: "11222333000181", ativo: true, versao: null });
    expect(parceiroSchema.safeParse({ tipo: "AMIGO", nome: "Marta" }).success).toBe(false);
    expect(parceiroSchema.safeParse({ tipo: "CLIENTE", nome: "M" }).success).toBe(false);
    expect(parceiroSchema.safeParse({ tipo: "CLIENTE", nome: "Marta", observacao: "x" }).success).toBe(false);
  });

  it("a indicação: o parceiro só com a origem Parceiro", () => {
    const base = { condominio: "Edifício Ipê", whatsapp: "61999990501", contatoAceito: true };
    expect(novoInteressadoSchema.parse({ ...base, origem: "PARCEIRO", parceiroId: ID }).parceiroId).toBe(ID);
    expect(novoInteressadoSchema.safeParse({ ...base, origem: "INDICACAO", parceiroId: ID }).error?.issues.map((i) => i.path[0])).toEqual(["parceiroId"]);
    expect(indicacaoParceiroSchema.parse(base)).not.toHaveProperty("origem");
    expect(indicacaoParceiroSchema.safeParse({ condominio: "Edifício Ipê", contatoAceito: true }).success).toBe(false);
  });

  it("a regra, o pagamento e a comissão do mês como o banco", () => {
    expect(regraComissaoSchema.parse({ versao: 1, percentual: 12.5 })).toEqual({ versao: 1, percentual: 12.5, prazoMeses: null });
    expect(regraComissaoSchema.safeParse({ versao: 1, percentual: 0 }).success).toBe(false);
    expect(regraComissaoSchema.safeParse({ versao: 1, percentual: 10.123 }).success).toBe(false);
    expect(regraComissaoSchema.safeParse({ versao: 1, percentual: 10, prazoMeses: 121 }).success).toBe(false);
    expect(pagamentoComissaoSchema.parse({ mes: "2026-10", valor: 2800, pagoEm: "2026-10-30" }).observacao).toBeNull();
    expect(pagamentoComissaoSchema.safeParse({ mes: "2026-10", valor: 2800, pagoEm: "2026-09-30" }).success).toBe(false);
    expect(pagamentoComissaoSchema.safeParse({ mes: "2026-13", valor: 2800, pagoEm: "2026-10-30" }).success).toBe(false);
    // 10% de R$ 286,25 por mês, como no pgTAP 056.
    expect(comissaoDoMes(28625, 10)).toBe(2863);
    expect(comissaoDoMes(34900, 12.5)).toBe(4363);
  });
});

describe("agenda de demonstrações (0310, CM-23)", () => {
  it("a disponibilidade: faixas por dia da semana e os limites do banco", () => {
    const d = disponibilidadeSchema.parse({ faixas: [{ dia: 2, de: "09:00", ate: "12:00" }] });
    expect(d).toMatchObject({ duracaoMinutos: 30, intervaloMinutos: 15, avisoDiasUteis: 1, horizonteDias: 14, salaUrl: null, ativa: true });
    expect(disponibilidadeSchema.safeParse({ faixas: [{ dia: 8, de: "09:00", ate: "12:00" }] }).success).toBe(false);
    expect(disponibilidadeSchema.safeParse({ faixas: [{ dia: 1, de: "12:00", ate: "09:00" }] }).success).toBe(false);
    expect(disponibilidadeSchema.safeParse({ faixas: [], salaUrl: "http://sala.exemplo.com" }).success).toBe(false);
    expect(disponibilidadeSchema.parse({ faixas: [], salaUrl: "https://meet.exemplo.com/abc" }).salaUrl).toBe("https://meet.exemplo.com/abc");
    expect(disponibilidadeSchema.safeParse({ faixas: [], duracaoMinutos: 10 }).success).toBe(false);
    expect(SQL).toContain("duracao_minutos   integer not null default 30 check (duracao_minutos between 15 and 120)");
  });

  it("o bloqueio vai até 60 dias", () => {
    expect(bloqueioAgendaSchema.safeParse({ pessoaId: ID, de: "2026-10-27T09:00:00-03:00", ate: "2026-10-27T12:00:00-03:00" }).success).toBe(true);
    expect(bloqueioAgendaSchema.safeParse({ pessoaId: ID, de: "2026-10-27T09:00:00-03:00", ate: "2026-12-27T12:00:00-03:00" }).success).toBe(false);
    expect(bloqueioAgendaSchema.safeParse({ pessoaId: ID, de: "2026-10-27T09:00:00-03:00", ate: "2026-10-27T08:00:00-03:00" }).success).toBe(false);
  });

  it("o agendamento pelo link pede e-mail e a autorização", () => {
    const base = { inicio: "2026-10-27T14:00:00-03:00", nome: "Rita Dias", whatsapp: "61 99999-0701", email: "Rita@Exemplo.com.br", condominio: "Edifício Sucupira", consentimento: true };
    expect(agendarDemonstracaoSchema.parse(base)).toMatchObject({ whatsapp: "5561999990701", email: "rita@exemplo.com.br", faixa: null });
    expect(agendarDemonstracaoSchema.safeParse({ ...base, email: "" }).success).toBe(false);
    expect(agendarDemonstracaoSchema.safeParse({ ...base, consentimento: false }).success).toBe(false);
    expect(agendarDemonstracaoSchema.safeParse({ ...base, whatsapp: "123" }).success).toBe(false);
  });

  it("registrar como foi pede o resumo e o próximo passo; cancelar pede o motivo", () => {
    expect(demonstracaoFeitaSchema.safeParse({ versao: 1, resumo: "Gostaram", proximoPasso: "Mandar proposta" }).success).toBe(false);
    expect(demonstracaoFeitaSchema.parse({ versao: 1, resumo: "Gostaram", proximoPasso: "Mandar proposta", proximoPassoData: "2026-10-29" }).proximoPassoHora).toBeNull();
    expect(encerrarDemonstracaoSchema.safeParse({ versao: 1, situacao: "CANCELADA" }).success).toBe(false);
    expect(encerrarDemonstracaoSchema.parse({ versao: 1, situacao: "NAO_COMPARECEU" }).avisar).toBe(false);
  });

  it("o quando no horário de Brasília, como o banco", () => {
    expect(quandoDemonstracao("2026-10-27T17:00:00Z")).toBe("terça, 27/10, 14:00");
    expect(quandoDemonstracao("2026-11-01T02:30:00Z")).toBe("sábado, 31/10, 23:30");
    expect(diaAgendaTexto("2026-10-27")).toBe("terça-feira, 27 de outubro");
  });

  it("a calculadora só aceita unidades de 1 a 20.000", () => {
    expect(calculadoraSiteSchema.parse({ unidades: "64" }).unidades).toBe(64);
    expect(calculadoraSiteSchema.safeParse({ unidades: "0" }).success).toBe(false);
    expect(calculadoraSiteSchema.safeParse({ unidades: "6,5" }).success).toBe(false);
  });
});
