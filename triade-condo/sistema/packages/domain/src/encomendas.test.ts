import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AVISOS_ENCOMENDA, MEIOS_AVISO, corrigirEncomendaSchema, detalheAviso, entregarEncomendaSchema, nomeAtalho, outroMeioSchema,
  previaEncomenda, registrarEncomendaSchema, buscaEncomendasSchema, portariaSchema, textoVolumes,
} from "./encomendas.ts";
import { FINALIDADES_ENVIO } from "./whatsapp.ts";
import { PERMISSOES } from "./plataforma.ts";

const sql = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/0299_encomendas.sql", import.meta.url)), "utf8");
const U = "8b0a1c4e-1f2a-4b3c-9d4e-5f6a7b8c9d0e";

describe("Portaria 1 · Encomendas (PA-01, PA-07, V-04, CF-12, W-20, W-21)", () => {
  it("os valores são os mesmos do banco", () => {
    for (const a of Object.keys(AVISOS_ENCOMENDA)) expect(sql).toContain(`'${a}'`);
    for (const m of Object.keys(MEIOS_AVISO)) expect(sql).toContain(`'${m}'`);
    expect(sql).toContain("'ENCOMENDA'");
    expect(FINALIDADES_ENVIO.ENCOMENDA).toBe("Encomenda guardada");
    expect(PERMISSOES.PORTARIA).toBe("Cuidar da portaria");
    expect(PERMISSOES.VER_PORTARIA).toBe("Ver a portaria");
  });

  it("registrar limpa os espaços e pede unidade, de quem veio, volumes e lugar", () => {
    const d = registrarEncomendaSchema.parse({ unidadeId: U, remetente: "  Mercado   Livre ", volumes: 2, lugarId: U, observacao: "  " });
    expect(d).toEqual({ unidadeId: U, remetente: "Mercado Livre", volumes: 2, lugarId: U, observacao: null });
    expect(registrarEncomendaSchema.safeParse({ unidadeId: U, remetente: "X", volumes: 1, lugarId: U }).success).toBe(false);
    expect(registrarEncomendaSchema.safeParse({ unidadeId: U, remetente: "Amazon", volumes: 51, lugarId: U }).success).toBe(false);
    expect(corrigirEncomendaSchema.safeParse({ unidadeId: U, remetente: "Amazon", volumes: 1, lugarId: U }).success).toBe(false);
  });

  it("entregar: alguém da unidade ou outra pessoa pelo nome, sem código (W-21)", () => {
    expect(entregarEncomendaSchema.parse({ contatoId: U })).toEqual({ contatoId: U, nome: null, ligacao: null });
    expect(entregarEncomendaSchema.parse({ nome: " Carlos  Dias ", ligacao: "Motorista" })).toEqual({ contatoId: null, nome: "Carlos Dias", ligacao: "Motorista" });
    expect(entregarEncomendaSchema.safeParse({}).success).toBe(false);
    expect(entregarEncomendaSchema.safeParse({ contatoId: U, nome: "Carlos" }).success).toBe(false);
    expect(entregarEncomendaSchema.safeParse({ contatoId: U, ligacao: "Primo" }).success).toBe(false);
    expect(Object.keys(entregarEncomendaSchema.parse({ contatoId: U }))).not.toContain("codigo");
  });

  it("avisei por outro meio: interfone, bilhete ou pessoalmente", () => {
    expect(outroMeioSchema.parse({ meio: "INTERFONE", com: "" })).toEqual({ meio: "INTERFONE", com: null });
    expect(outroMeioSchema.safeParse({ meio: "TELEFONE" }).success).toBe(false);
  });

  it("os atalhos são das guardadas e o lembrete vai de 1 a 60 dias (CF-12)", () => {
    expect(buscaEncomendasSchema.safeParse({ aba: "ENTREGUES", atalho: "SEM_AVISO" }).success).toBe(false);
    expect(buscaEncomendasSchema.parse({}).aba).toBe("GUARDADAS");
    expect(nomeAtalho("ANTIGAS", 7)).toBe("Guardadas há mais de 7 dias");
    expect(portariaSchema.safeParse({ versao: 1, lembreteLigado: true, lembreteDias: 61, sindicoIndicado: false }).success).toBe(false);
  });

  it("a linha do aviso diz quem recebeu, quem pediu PARAR e o que não chegou", () => {
    const base = { moradores: 2 };
    expect(detalheAviso({ ...base, aviso: "AVISADA", avisados: ["Marina Lopes"] })).toBe("Marina Lopes · 1 de 2 recebe");
    expect(detalheAviso({ ...base, aviso: "SEM_AVISO", avisoMotivo: "PAROU", pararam: ["Lúcia Ramos"] })).toBe("Lúcia Ramos pediu PARAR");
    expect(detalheAviso({ ...base, aviso: "SEM_AVISO", avisoMotivo: "SEM_WHATSAPP", semWhatsapp: ["Caio Nunes"] }))
      .toBe("O número de Caio Nunes não está no WhatsApp");
    expect(detalheAviso({ ...base, aviso: "AVISO_FALHOU", naoChegou: ["Rui Alves"] })).toBe("O envio a Rui Alves não chegou");
    expect(detalheAviso({ ...base, aviso: "OUTRO_MEIO", outroMeio: { meio: "INTERFONE", com: "Lúcia Ramos", em: "x", por: "João Ribeiro" } }, () => "hoje 15:40"))
      .toBe("Pelo interfone, com Lúcia Ramos · João Ribeiro, hoje 15:40");
  });

  it("a prévia é o modelo do banco preenchido, com o aviso contra golpes (W-20, W-21)", () => {
    const corpo = /E'(Encomenda guardada\\n[^']*)'/.exec(sql)![1]!.replace(/\\n/g, "\n");
    const t = previaEncomenda({ corpo, rodape: "Para não receber estes avisos, responda PARAR." }, {
      unidade: "Torre A · 101", remetente: "Mercado Livre", volumes: 1, lugar: "Sala da portaria", quando: "24/10 às 14:32",
      recebidaPor: "João Ribeiro", condominio: "Residencial Águas Claras",
    });
    expect(t).toContain("De: Mercado Livre · 1 volume");
    expect(t).toContain("O condomínio nunca pede senha, código ou pagamento por mensagem.");
    expect(t).toContain("Nina, assistente virtual do Residencial Águas Claras.");
    expect(t.endsWith("Para não receber estes avisos, responda PARAR.")).toBe(true);
    expect(textoVolumes(3)).toBe("3 volumes");
  });
});
