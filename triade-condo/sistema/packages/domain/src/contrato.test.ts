/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAMPOS_CONTRATO,
  camposErradosContrato,
  cnpjValido,
  conferirEnvioSchema,
  documentoAceiteSchema,
  encerrarPilotoSchema,
  envioContratoPublicoSchema,
  envioContratoSchema,
  formatarCnpj,
  gerarContratoSchema,
  iniciarPilotoSchema,
  ITENS_TROCA_PADRAO,
  mascararCpf,
  METAS_PILOTO,
  modeloContratoSchema,
  normalizarOab,
  novaOportunidadeSchema,
  planilhaTrocaCsv,
  PRAZOS_PILOTO,
  recusarEnvioSchema,
  trocaSistemaSchema,
  virarClienteSchema,
} from "./contrato.ts";
import { ESTAGIOS, estagioSchema } from "./console.ts";
import { TEXTOS_MOTIVO } from "./textos.ts";

const SQL = readFileSync(new URL("../../../supabase/migrations/0308_comercial_contrato_cliente.sql", import.meta.url), "utf8");
const TEXTO = "Contrato com o «condominio», CNPJ «cnpj», a partir de «data_inicio», reajustado pelo «indice_reajuste» todo ano.";

describe("contrato pelo gov.br (0308): as listas são as mesmas do banco", () => {
  it("os campos do modelo, na ordem de contrato_campos()", () => {
    const m = SQL.match(/select array\[('[a-z_]+'(?:,\s*'[a-z_]+')*)\]/s)!;
    expect([...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).toEqual(Object.keys(CAMPOS_CONTRATO));
  });

  it("as metas e os prazos do piloto", () => {
    expect(SQL).toContain(`check (meta in (${Object.keys(METAS_PILOTO).map((k) => `'${k}'`).join(", ")}))`);
    expect(SQL).toContain(`check (prazo_dias in (${PRAZOS_PILOTO.join(", ")}))`);
  });

  it("os itens padrão da troca de sistema", () => {
    const padrao = SQL.match(/create function troca_itens_padrao\(\)[\s\S]*?'(\[[\s\S]*?\])'::jsonb/)!;
    expect((JSON.parse(padrao[1]!) as { texto: string }[]).map((x) => x.texto)).toEqual([...ITENS_TROCA_PADRAO]);
  });

  it("os estágios do piloto existem no banco, mas Mudar estágio não usa", () => {
    expect(SQL).toContain("insert into estados_iniciais (tabela, estado) values ('clientes', 'PILOTO');");
    expect(SQL).toContain("('clientes', 'PILOTO', 'PILOTO_ENCERRADO')");
    expect(Object.keys(ESTAGIOS)).toEqual(["IMPLANTACAO", "ATIVO", "PILOTO", "PILOTO_ENCERRADO"]);
    expect(estagioSchema.safeParse({ versao: 1, estagio: "PILOTO" }).success).toBe(false);
    expect(estagioSchema.safeParse({ versao: 1, estagio: "ATIVO" }).success).toBe(true);
  });

  it("todo motivo que a 0308 manda tem texto na tela", () => {
    const motivos = new Set<string>();
    for (const m of SQL.matchAll(/recusar_motivo\('(?:[^']|'')*',\s*'([A-Z_]+)'\)/g)) motivos.add(m[1]!);
    for (const m of SQL.matchAll(/"motivo":"([A-Z_]+)"/g)) motivos.add(m[1]!);
    for (const m of SQL.matchAll(/'motivo', '([A-Z_]+)'/g)) motivos.add(m[1]!);
    // O que impede gerar (comercial_motivo_sem_gerar) também vira recusa.
    const semGerar = SQL.match(/create function comercial_motivo_sem_gerar[\s\S]*?\$\$;/)![0];
    for (const m of semGerar.matchAll(/then '([A-Z_]+)'/g)) motivos.add(m[1]!);
    expect(motivos.size).toBeGreaterThan(25);
    expect([...motivos].filter((m) => !TEXTOS_MOTIVO[m]).sort()).toEqual([]);
  });
});

describe("campos, CNPJ, CPF e OAB", () => {
  it("acha o campo fora da lista e o « sobrando, como o banco", () => {
    expect(camposErradosContrato(TEXTO)).toEqual([]);
    expect(camposErradosContrato(`${TEXTO} Multa: «multa». Foro «cidade.`)).toEqual(["«", "«multa»"]);
    expect(camposErradosContrato("fecha » sozinho")).toEqual(["»"]);
    expect(camposErradosContrato(null)).toEqual([]);
  });

  it("CNPJ com dígitos verificadores", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("o CPF fica só mascarado", () => {
    expect(mascararCpf("529.982.247-25")).toBe("***.982.247-**");
    expect(mascararCpf("123")).toBeNull();
  });

  it("a OAB como DF 12345", () => {
    expect(normalizarOab("OAB/df 12.345")).toBe("DF 12345");
    expect(normalizarOab("12345/DF")).toBe("DF 12345");
    expect(normalizarOab("DF")).toBeNull();
  });
});

describe("entrada das telas e do link (0308)", () => {
  it("o modelo: campo errado não passa; a revisão vem inteira", () => {
    expect(modeloContratoSchema.safeParse({ titulo: "Contrato", texto: TEXTO }).success).toBe(true);
    const errado = modeloContratoSchema.safeParse({ titulo: "Contrato", texto: `${TEXTO} «multa»` });
    expect(errado.success).toBe(false);
    expect(errado.error!.issues.map((i) => i.path.join("."))).toEqual(["texto"]);
    const metade = modeloContratoSchema.safeParse({ titulo: "Contrato", texto: TEXTO, advogadoNome: "Rui Barros" });
    expect(metade.error!.issues.map((i) => i.path.join(".")).sort()).toEqual(["advogadoOab", "revisadoEm"]);
    expect(modeloContratoSchema.safeParse({ titulo: "Contrato", texto: TEXTO, advogadoNome: "Rui Barros", advogadoOab: "DF", revisadoEm: "2026-10-20" })
      .error!.issues.map((i) => i.path.join("."))).toEqual(["advogadoOab"]);
  });

  it("documentos: só PDF até 10 MB, CNPJ válido e o fim do mandato da ata", () => {
    expect(documentoAceiteSchema.parse({ tipo: "CNPJ", nome: "cnpj.pdf", tamanho: 1000, cnpj: "11.222.333/0001-81" }).cnpj).toBe("11222333000181");
    expect(documentoAceiteSchema.safeParse({ tipo: "CNPJ", nome: "cnpj.pdf", tamanho: 1000, cnpj: "11.222.333/0001-82" }).success).toBe(false);
    expect(documentoAceiteSchema.safeParse({ tipo: "ATA_ELEICAO", nome: "ata.pdf", tamanho: 1000 }).success).toBe(false);
    expect(documentoAceiteSchema.safeParse({ tipo: "ATA_APROVACAO", nome: "ata.pdf", tamanho: 10 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(documentoAceiteSchema.safeParse({ tipo: "ATA_APROVACAO", nome: "ata.jpg", tamanho: 10, formato: "image/jpeg" }).success).toBe(false);
  });

  it("gerar, enviar, conferir e recusar", () => {
    expect(gerarContratoSchema.safeParse({ dataInicio: "2026-11-01" }).success).toBe(true);
    expect(envioContratoSchema.parse({ nome: "a.pdf", tamanho: 10 }).parte).toBe("TRIADE");
    expect(envioContratoPublicoSchema.safeParse({ nome: "a.pdf", tamanho: 0 }).success).toBe(false);
    const sem = conferirEnvioSchema.safeParse({ versao: 2, assinaturaValida: true });
    expect(sem.error!.issues.map((i) => i.path.join(".")).sort()).toEqual(["dataConfere", "pessoaConfere"]);
    expect(conferirEnvioSchema.parse({ versao: 2, assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: "111.444.777-35" }).cpf).toBe("11144477735");
    expect(conferirEnvioSchema.safeParse({ versao: 2, assinaturaValida: true, pessoaConfere: true, dataConfere: true, cpf: "111.444.777-36" }).success).toBe(false);
    expect(recusarEnvioSchema.safeParse({ versao: 2, motivo: "x" }).success).toBe(false);
  });

  it("virar cliente e o piloto pedem o responsável, a meta e o motivo da perda", () => {
    expect(virarClienteSchema.safeParse({ versao: 3 }).success).toBe(false);
    expect(iniciarPilotoSchema.safeParse({ versao: 1, prazoDias: 20, comecaEm: "2026-10-26", meta: "RETORNOS_NO_PRAZO", metaPercentual: 80,
      combinadoCom: "Lúcia", responsavelImplantacaoId: "6f1c3c1e-1111-4111-8111-111111111111" }).success).toBe(false);
    expect(iniciarPilotoSchema.safeParse({ versao: 1, prazoDias: 45, comecaEm: "2026-10-26", meta: "RETORNOS_NO_PRAZO", metaPercentual: 80,
      combinadoCom: "Lúcia", responsavelImplantacaoId: "6f1c3c1e-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(encerrarPilotoSchema.safeParse({ versao: 1, resultado: "PERDIDO" }).success).toBe(false);
    expect(encerrarPilotoSchema.safeParse({ versao: 1, resultado: "PROPOSTA" }).success).toBe(true);
  });

  it("troca de sistema, planilha-modelo e oportunidade nova", () => {
    expect(trocaSistemaSchema.parse({ empresaAnterior: "Contábil Norte", dataTroca: "2026-12-01" }).itens).toBeNull();
    expect(trocaSistemaSchema.safeParse({ empresaAnterior: "Contábil Norte", dataTroca: "2026-12-01", itens: [] }).success).toBe(false);
    expect(planilhaTrocaCsv()).toMatch(/^\uFEFFBloco;Unidade;Nome do morador;WhatsApp;E-mail;/);
    expect(novaOportunidadeSchema.safeParse({ condominio: "Edifício Aroeira II", cnpj: "123" }).success).toBe(false);
  });
});
