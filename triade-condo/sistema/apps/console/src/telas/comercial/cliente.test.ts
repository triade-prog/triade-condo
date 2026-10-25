// Piloto, virar cliente e troca de sistema nas telas (R17.4): o fim do piloto sai do prazo, a meta e
// a medida viram texto, o kit leva o piloto sem com quem foi combinado (CM-20), a carta troca só a
// lista do que falta e o Virar cliente diz o que vai criar (CM-08).
import { describe, expect, it } from "vitest";
import {
  atualizarListaDaCarta, criadoAoVirarCliente, daImplantacao, linhasPilotoKit, terminaEm, textoMedida, textoMeta, textoPassoTroca, textoRecebidos, type Piloto, type Troca,
} from "./cliente.ts";
import { documentoKit, type Kit, type VersaoProposta } from "./propostas.ts";

const PILOTO: Piloto = {
  id: "p1", versao: 1, prazoDias: 45, comecaEm: "2026-11-04", terminaEm: "2026-12-19", meta: "RETORNOS_NO_PRAZO", metaPercentual: 80, situacao: "EM_ANDAMENTO",
  combinadoCom: "Sérgio Alves, síndico",
};

const CARTA = "À Contábil Norte,\n\nO Residencial Cerrado, representado por Lúcia Prado, passa a usar a TRÍADE Condo a partir de 04/12/2026 e pede, até 19/11/2026, a entrega dos itens abaixo:\n- Lista de unidades e moradores\n- Atas e convenção\n\nAtenciosamente,\n\nLúcia Prado\n[assinatura]";

describe("Piloto", () => {
  it("termina no começo mais o prazo, como o banco", () => {
    expect(terminaEm("2026-11-04", 45)).toBe("2026-12-19");
    expect(terminaEm("2026-12-15", 30)).toBe("2027-01-14");
    expect(terminaEm("", 30)).toBe("");
  });

  it("diz a meta e a medida", () => {
    expect(textoMeta("RETORNOS_NO_PRAZO", 80)).toBe("80% dos retornos no prazo");
    expect(textoMeta("MORADORES_WHATSAPP", 60)).toBe("60% dos moradores usando o WhatsApp");
    expect(textoMedida({ medido: true, de: "2026-11-04", ate: "2026-11-20", retornos: 40, noPrazo: 34, porcentagem: 85, meta: 80, atingiu: true }))
      .toBe("34 de 40 retornos no prazo (85%), de 04/11 a 20/11: meta de 80% atingida");
    expect(textoMedida({ medido: true, de: "2026-11-04", ate: "2026-11-20", retornos: 10, noPrazo: 5, porcentagem: 50, meta: 80, atingiu: false })).toContain("ainda abaixo da meta de 80%");
    expect(textoMedida({ medido: false, ondeVer: "INDICADORES_PLATAFORMA" })).toContain("Indicadores");
    expect(textoMedida({ medido: false, motivo: "NAO_COMECOU" })).toContain("ainda não começou");
  });

  it("vai para o kit com prazo, meta e resultado, nunca com quem foi combinado (CM-20)", () => {
    const l = linhasPilotoKit(PILOTO);
    expect(l[0]).toEqual(["Piloto", "45 dias, de 04/11/2026 a 19/12/2026, sem cobrança. Meta combinada antes: 80% dos retornos no prazo, medida pela própria Plataforma."]);
    expect(JSON.stringify(l)).not.toContain("Sérgio");
    const fim = linhasPilotoKit({ ...PILOTO, situacao: "VIROU_PROPOSTA", resultado: { medido: true, de: "2026-11-04", ate: "2026-12-19", retornos: 40, noPrazo: 36, porcentagem: 90, meta: 80, atingiu: true } });
    expect(fim[1]).toEqual(["Resultado do piloto", "36 de 40 retornos no prazo (90%), de 04/11 a 19/12: meta de 80% atingida"]);
  });

  it("entra na apresentação curta do PDF do kit", () => {
    const k = {
      proposta: { versao: 1, numero: 1, situacao: "ENVIADA", condominio: "Edifício Ipê Amarelo", ciclo: "MENSAL", mensal: 12900, podeAceitar: true },
      predio: { condominio: "Edifício Ipê Amarelo" }, comparativo: { triade: { ciclo: "MENSAL" }, concorrentes: [] }, respostas: [], referencias: [],
      piloto: { ...PILOTO, combinadoCom: undefined },
    } as unknown as Kit;
    const pares = documentoKit(k, ["APRESENTACAO"]).blocos.find((b) => b.tipo === "pares");
    expect(pares && pares.tipo === "pares" ? pares.linhas.map(([r]) => r) : []).toContain("Piloto");
    const sem = documentoKit({ ...k, piloto: undefined }, ["APRESENTACAO"]).blocos.find((b) => b.tipo === "pares");
    expect(sem && sem.tipo === "pares" ? sem.linhas.map(([r]) => r) : []).not.toContain("Piloto");
  });
});

describe("Troca de sistema", () => {
  const troca = { faltam: 2, cartaEnviadaEm: "2026-11-01T13:00:00Z" } as Pick<Troca, "faltam" | "cartaEnviadaEm">;

  it("escreve cada passo da linha do tempo", () => {
    expect(textoPassoTroca({ chave: "CARTA", quando: "30 dias antes", data: "2026-11-04", texto: "", situacao: "FEITO" }, troca)).toEqual({ texto: "Enviada 01/11", tom: "ok" });
    expect(textoPassoTroca({ chave: "PLANILHA", quando: "15 dias antes", data: "2026-11-19", texto: "", situacao: "FALTAM", faltam: 2 }, troca)).toEqual({ texto: "Faltam 2 itens", tom: "atencao" });
    expect(textoPassoTroca({ chave: "PLANILHA", quando: "", data: "", texto: "", situacao: "FALTAM", faltam: 1 }, troca).texto).toBe("Falta 1 item");
    expect(textoPassoTroca({ chave: "TROCA", quando: "Dia da troca", data: "2026-12-04", texto: "", situacao: "PREVISTO" }, troca)).toEqual({ texto: "04/12/2026", tom: "neutro" });
    expect(textoPassoTroca({ chave: "PRIMEIRA_SEMANA", quando: "", data: "", texto: "", situacao: "NA_IMPLANTACAO" }, troca).texto).toBe("Na implantação");
  });

  it("conta o que chegou", () => {
    expect(textoRecebidos([{ texto: "A", recebido: true }, { texto: "B", recebido: false }, { texto: "C", recebido: true }, { texto: "D", recebido: false }])).toBe("2 de 4 recebidos");
  });

  it("troca só a lista do que falta na carta, mesmo editada", () => {
    const itens = [{ texto: "Lista de unidades e moradores", recebido: true }, { texto: "Atas e convenção", recebido: false }, { texto: "Contratos e prestadores", recebido: false }];
    const nova = atualizarListaDaCarta(CARTA.replace("Atenciosamente", "Obrigada desde já"), itens);
    expect(nova).toContain("itens abaixo:\n- Atas e convenção\n- Contratos e prestadores\n\nObrigada desde já");
    expect(nova).not.toContain("- Lista de unidades");
    expect(atualizarListaDaCarta(CARTA, itens.map((x) => ({ ...x, recebido: true })))).toContain("itens abaixo:\n- (nada pendente)\n");
    expect(atualizarListaDaCarta("Carta escrita à mão, sem a lista.", itens)).toBe("Carta escrita à mão, sem a lista.");
  });
});

describe("Virar cliente", () => {
  const V = { id: "v", versaoRegistro: 1, numero: 1, situacao: "ACEITA", condominio: "Residencial Cerrado", ciclo: "MENSAL", tabela: "FUNDADOR", mensal: 22900,
    implantacaoSemCusto: true, criadoEm: "2026-10-30" } as VersaoProposta;

  it("diz o que vai ser criado, com a proposta aceita, a troca e quem decide", () => {
    const l = Object.fromEntries(criadoAoVirarCliente({
      condominio: "Residencial Cerrado", cidade: "Brasília", uf: "DF", pessoa: "Lúcia Prado", decisor: "Lúcia", versao: V, doPiloto: false,
      troca: { empresaAnterior: "Contábil Norte", faltam: 2 } as Troca,
    }));
    expect(l["Cliente na carteira"]).toBe("Residencial Cerrado · Brasília, DF · Em implantação");
    expect(l.Plano).toBe("Pela tabela da proposta aceita: mensal, fundador, R$ 229,00 por mês");
    expect(l["Vaga de fundador"]).toContain("vagas de fundador");
    expect(l["Implantação"]).toBe("Roteiro de implantação aberto, sem custo");
    expect(l["Troca de sistema"]).toBe("Carta para a Contábil Norte e 2 itens que faltam receber viram pendências da implantação (CM-29)");
    expect(l["Promessas e quem decide"]).toContain("Lúcia decide");
    expect(l.Interessado).toBe("Vai para Ganho, com o histórico guardado");
  });

  it("do piloto: o mesmo condomínio, sem vaga de fundador na tabela cheia", () => {
    const l = Object.fromEntries(criadoAoVirarCliente({ condominio: "Ipê", versao: { ...V, tabela: "CHEIA", implantacaoSemCusto: false, implantacao: 60000 }, doPiloto: true }));
    expect(l["Cliente na carteira"]).toContain("sai do piloto");
    expect(l["Vaga de fundador"]).toBeUndefined();
    expect(l["Implantação"]).toContain("A do piloto continua");
    expect(l["Troca de sistema"]).toBe("Nenhuma troca de sistema registrada");
  });

  it("só oferece quem tem a função Implantação, ativo", () => {
    expect(daImplantacao([
      { id: "a", nome: "Carolina", ativa: true, funcoes: ["ADMINISTRACAO"] }, { id: "b", nome: "Inês", ativa: true, funcoes: ["IMPLANTACAO"] },
      { id: "c", nome: "Rafael", ativa: false, funcoes: ["IMPLANTACAO"] },
    ]).map((p) => p.nome)).toEqual(["Inês"]);
  });
});
