/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  abaDaSituacao,
  aceitePropostaSchema,
  cpfValido,
  custoPorApartamento,
  dadosVersaoSchema,
  emailDaEquipe,
  ESCOPO_INCLUIDO,
  ESCOPO_NAO_INCLUIDO,
  formatarCpf,
  mensalComDesconto,
  OFERTA_INCLUIDO,
  OFERTA_PLANEJADO,
  referenciaComercialSchema,
  SITUACOES_PROPOSTA,
  TEXTO_ACEITE,
} from "./propostas.ts";
import { TEXTOS_MOTIVO } from "./textos.ts";
import { CRITERIOS_SINDICO, criteriosInteressadoSchema, ESCOPOS_FATO, fatoComparativoSchema, fichaInteressadoSchema } from "./comercial.ts";

const SQL = ["0304_comercial_propostas.sql", "0306_comercial_propostas_ajustes.sql", "0307_comercial_kit_criterios.sql"]
  .map((f) => readFileSync(new URL(`../../../supabase/migrations/${f}`, import.meta.url), "utf8"))
  .join("\n");

describe("propostas do Comercial (0304)", () => {
  it("CPF com os dígitos verificadores, com ou sem pontuação", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("desconto na mensalidade e custo por apartamento como o banco (CM-19, L.1)", () => {
    expect(mensalComDesconto(22900, 10)).toBe(20610);
    expect(mensalComDesconto(22900, 12.5)).toBe(20038);
    expect(mensalComDesconto(22900, null)).toBe(22900);
    expect(custoPorApartamento(20610, 72)).toBe(286);
    expect(custoPorApartamento(22900, 72)).toBe(318);
    expect(custoPorApartamento(100, 1000)).toBe(1);
    expect(custoPorApartamento(22900, 0)).toBeNull();
  });

  it("cada situação da versão em vigor cai na sua aba; a substituída em nenhuma", () => {
    expect(abaDaSituacao("PRONTA")).toBe("EM_ABERTO");
    expect(abaDaSituacao("AGUARDA_DESCONTO")).toBe("AGUARDANDO_APROVACAO");
    expect(abaDaSituacao("VENCIDA")).toBe("VENCIDAS");
    expect(abaDaSituacao("SUBSTITUIDA")).toBeNull();
    for (const s of Object.keys(SITUACOES_PROPOSTA)) expect(SQL).toContain(`'${s}'`);
  });

  it("a versão: desconto pede o motivo; sob consulta pede de onde veio o valor; preço não vem da tela", () => {
    const ok = dadosVersaoSchema.parse({ desconto: 10, descontoMotivo: "Conselho compara", mensal: 1 });
    expect(ok).not.toHaveProperty("mensal");
    expect(ok.ciclo).toBe("MENSAL");
    expect(dadosVersaoSchema.safeParse({ desconto: 10 }).error?.issues.map((i) => i.path[0])).toEqual(["descontoMotivo"]);
    expect(dadosVersaoSchema.safeParse({ valorManual: 150000 }).error?.issues.map((i) => i.path[0])).toEqual(["valorManualMotivo"]);
    expect(dadosVersaoSchema.safeParse({ desconto: 100, descontoMotivo: "x y z" }).success).toBe(false);
    expect(dadosVersaoSchema.safeParse({ tabela: "MANUAL" }).success).toBe(false);
  });

  it("o aviso do aceite fala da impressão digital da versão, não do PDF (0306)", () => {
    expect(TEXTO_ACEITE).toContain("impressão digital dela");
    expect(TEXTO_ACEITE).not.toContain("PDF");
  });

  it("o aceite: nome, CPF validado, cargo e a confirmação", () => {
    expect(aceitePropostaSchema.parse({ nome: "Lúcia Prado", cpf: "529.982.247-25", cargo: "Síndica", concordo: true }).cpf).toBe("52998224725");
    expect(aceitePropostaSchema.safeParse({ nome: "Lúcia Prado", cpf: "529.982.247-24", cargo: "Síndica", concordo: true }).success).toBe(false);
    expect(aceitePropostaSchema.safeParse({ nome: "Lúcia Prado", cpf: "529.982.247-25", cargo: "Síndica", concordo: false }).success).toBe(false);
  });

  it("a referência com contato pede o contato; o caso pede as datas", () => {
    const base = { sindico: "Paulo Dias", condominio: "Edifício Ipê", escopo: "CONTATO", autorizadoEm: "2026-10-20", autorizacaoTexto: "Autorizou por WhatsApp" };
    expect(referenciaComercialSchema.safeParse(base).error?.issues.map((i) => i.path[0])).toEqual(["whatsapp"]);
    expect(referenciaComercialSchema.parse({ ...base, whatsapp: "61 98888-7777" }).whatsapp).toBe("5561988887777");
    expect(referenciaComercialSchema.safeParse({ ...base, escopo: "SO_NOME", casoTexto: "Metade do tempo nos pedidos" }).success).toBe(false);
  });

  it("o escopo da apresentação é o mesmo do banco (0312, CM-34)", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/0312_comercial_proposta_apresentacao.sql", import.meta.url), "utf8");
    const literal = (f: string) => JSON.parse(new RegExp(`function ${f}\\(\\)[\\s\\S]*?select '([^']*)'::jsonb`).exec(sql)![1]!);
    expect(literal("comercial_escopo_incluido")).toEqual(ESCOPO_INCLUIDO);
    expect(literal("comercial_escopo_nao_incluido")).toEqual(ESCOPO_NAO_INCLUIDO);
    expect(sql).toContain("@trihub\\.com\\.br$");
  });

  it("o e-mail de quem é da equipe só vai para o síndico quando é da TRÍADE (0312)", () => {
    expect(emailDaEquipe(" Bianca@TriHub.com.br ")).toBe("bianca@trihub.com.br");
    expect(emailDaEquipe("bianca.rocha@gmail.com")).toBeNull();
    expect(emailDaEquipe("bianca@trihub.com.br.golpe.com")).toBeNull();
    expect(emailDaEquipe(null)).toBeNull();
    expect(dadosVersaoSchema.parse({ implantadorId: "" }).implantadorId).toBeNull();
    expect(dadosVersaoSchema.safeParse({ implantadorId: "Davi" }).success).toBe(false);
  });

  it("o incluído e o planejado são os mesmos do banco (EM-07)", () => {
    expect(SQL).toContain(`'${JSON.stringify(OFERTA_INCLUIDO).replaceAll('","', '", "')}'::jsonb`);
    expect(SQL).toContain(`'${JSON.stringify(OFERTA_PLANEJADO).replaceAll('","', '", "')}'::jsonb`);
  });

  it("todo motivo que a 0304, a 0306 e a 0307 mandam tem texto na tela", () => {
    const motivos = new Set<string>();
    for (const m of SQL.matchAll(/recusar_motivo\('(?:[^']|'')*',\s*'([A-Z_]+)'\)/g)) motivos.add(m[1]!);
    for (const m of SQL.matchAll(/"motivo":"([A-Z_]+)"/g)) motivos.add(m[1]!);
    for (const m of SQL.matchAll(/'motivo', '([A-Z_]+)'/g)) motivos.add(m[1]!);
    expect(motivos.size).toBeGreaterThan(15);
    expect([...motivos].filter((m) => !TEXTOS_MOTIVO[m]).sort()).toEqual([]);
  });
});

describe("kit pelos critérios do síndico (0307)", () => {
  it("a lista fechada dos critérios é a mesma do banco, na mesma ordem", () => {
    const ordem = [...SQL.matchAll(/\{"codigo": "([A-Z_]+)", "titulo": "([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(ordem).toEqual(Object.entries(CRITERIOS_SINDICO));
  });

  it("Escolher critérios: sem repetir, outro pede o texto, problema curto", () => {
    expect(criteriosInteressadoSchema.parse({ versao: 2, criterios: ["COMO_CANCELAR", "COMO_CANCELAR"] }).criterios).toEqual(["COMO_CANCELAR"]);
    expect(criteriosInteressadoSchema.safeParse({ versao: 2, criterios: ["OUTRO"] }).error?.issues.map((i) => i.path[0])).toEqual(["criterioOutro"]);
    expect(criteriosInteressadoSchema.safeParse({ versao: 2, criterios: [], problema: "x".repeat(301) }).success).toBe(false);
    expect(criteriosInteressadoSchema.safeParse({ versao: 2, criterios: ["PRECO_BAIXO"] }).success).toBe(false);
  });

  it("a ficha sem os critérios não manda os campos (o banco não apaga a escolha do kit)", () => {
    const base = { versao: 3, condominio: "Edifício Aroeira", whatsapp: "61 99999-0412" };
    const sem = fichaInteressadoSchema.parse(base);
    expect(["criterios", "criterioOutro", "problema"].filter((k) => k in sem && (sem as Record<string, unknown>)[k] !== undefined)).toEqual([]);
    const com = fichaInteressadoSchema.parse({ ...base, criterios: ["SEM_BAIXAR_APP"], criterioOutro: "", problema: " Vazamentos " });
    expect([com.criterios, com.criterioOutro, com.problema]).toEqual([["SEM_BAIXAR_APP"], null, "Vazamentos"]);
  });

  it("o fato confirmado pede o texto e a fonte", () => {
    const ok = fatoComparativoSchema.parse({ sistema: "HabitaOne", criterio: "COMO_CANCELAR", texto: "Multa de 3 meses", fonte: "Contrato deles" });
    expect([ok.versao, ok.interessadoId, ok.confirmadoEm, ok.escopo]).toEqual([null, null, null, null]);
    expect(fatoComparativoSchema.safeParse({ sistema: "HabitaOne", criterio: "COMO_CANCELAR", texto: "Multa" }).error?.issues.map((i) => i.path[0])).toEqual(["fonte"]);
    expect(fatoComparativoSchema.parse({ texto: "Multa de 3 meses", fonte: "Site deles", escopo: "PUBLICO" }).escopo).toBe("PUBLICO");
    expect(fatoComparativoSchema.safeParse({ texto: "Multa de 3 meses", fonte: "Site deles", escopo: "TODOS" }).error?.issues.map((i) => i.path[0])).toEqual(["escopo"]);
  });

  it("o escopo do fato é o mesmo do banco: só do prédio por padrão, ou informação pública", () => {
    expect(Object.keys(ESCOPOS_FATO)).toEqual(["PREDIO", "PUBLICO"]);
    expect(SQL).toContain("escopo         text not null default 'PREDIO' check (escopo in ('PREDIO', 'PUBLICO'))");
    expect(ESCOPOS_FATO.PREDIO).toBe("Só deste prédio");
  });
});
