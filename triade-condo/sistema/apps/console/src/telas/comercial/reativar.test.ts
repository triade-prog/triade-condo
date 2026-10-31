// Desfazer e reativar nas telas (R17.7c, 0318; quadros 487 a 491): os selos e as linhas do
// cancelamento fechado, o que falta para reativar, as duas assinaturas do aditivo pelo gov.br, o
// pedido de Gerar e os campos do modelo de retorno.
import { describe, expect, it } from "vitest";
import {
  ADITIVO_CAMPOS,
} from "@triade/domain";
import {
  assinadasAditivo, CAMPOS_RETORNO, camposErradosModelo, competenciasRetorno, corpoRetorno, detalheCancelamento, detalheRenovacao, estadoParte, faltaParaReativar,
  linhasRetorno, nomeSituacaoCancelamento, passouUltimoDia, podeDesfazer, podeEnviarParte, problemasRetorno, TEXTO_INICIAL_RETORNO, textoConfirmado, textoDesfeito,
  textoFaltam, textoReativado, textoUltimoDiaConfirmado, TOM_CANCELAMENTO,
  type AditivoResumo, type Cancelamento, type DadosRetorno, type EnvioAditivo, type Renovacao,
} from "./renovacoes.ts";

const carolina = { id: "u1", nome: "Carolina" };
const k = (x: Partial<Cancelamento> = {}): Cancelamento => ({
  id: "k1", versao: 3, interessadoId: "i2", condominio: "Edifício Ipiranga", plano: { valor: 12900, ciclo: "MENSAL", inicio: "2025-12-01", tabela: "FUNDADOR" },
  pedidoPor: "Ana Ribeiro", pedidoEm: "2026-10-24T14:20:00Z", avisoDias: 30, ultimoDia: "2026-11-23", situacao: "CONFIRMADO",
  motivo: "SINDICO_NOVO", decididoEm: "2026-10-28T18:40:00Z", decididoPor: carolina, exportacaoPedida: true, ...x,
});
const envio = (x: Partial<EnvioAditivo>): EnvioAditivo => ({ id: "e1", parte: "CONDOMINIO", situacao: "A_CONFERIR", enviadoEm: "2027-03-02T13:00:00Z", enviadoPor: carolina, ...x });
const aditivo = (envios: EnvioAditivo[] = [], x: Partial<AditivoResumo> = {}): AditivoResumo => ({
  id: "a2", numero: 2, situacao: "PRONTO", hash: "ab".repeat(32), envios,
  dados: { campos: { contrato: "nº 17", data_contrato: "01/12/2025", ultimo_dia: "23/11/2026", representante: "Ana Ribeiro", cpf_representante: "***.456.789-**",
    plano: "Faixa até 40 unidades, mensal", valor_mensal: "R$ 199,00 por mês", vale_desde: "competência de 03/2027" } },
  ...x,
});
const conferido = (parte: "CONDOMINIO" | "TRIADE", id = parte) =>
  envio({ id, parte, situacao: "CONFERIDO", conferidoEm: "2027-03-02T15:00:00Z", conferidoPor: carolina });

describe("o cancelamento confirmado e o desfazer (quadro 487)", () => {
  it("as linhas da janela: Confirmado, Último dia e o que falta", () => {
    expect(textoConfirmado(k())).toBe("28/10 15:40 por Carolina · motivo: síndico novo");
    expect(textoConfirmado(k({ motivo: "OUTRO", motivoTexto: "Mudou de administradora" }))).toBe("28/10 15:40 por Carolina · motivo: Mudou de administradora");
    expect(textoUltimoDiaConfirmado(k(), "2026-10-30")).toBe("23/11/2026 · faltam 24 dias · o acesso continua até lá");
    expect(textoUltimoDiaConfirmado(k(), "2026-11-24")).toContain("passou");
    expect(textoFaltam("2026-11-23", "2026-11-22")).toBe("falta 1 dia");
    expect(textoFaltam("2026-11-23", "2026-11-23")).toBe("hoje é o último dia");
  });

  it("desfazer: só a Administração, só o confirmado e até o último dia", () => {
    expect(podeDesfazer(k(), { desfazer: true }, "2026-10-30")).toBe(true);
    expect(podeDesfazer(k(), { desfazer: true }, "2026-11-23")).toBe(true);
    expect(podeDesfazer(k(), { desfazer: true }, "2026-11-24")).toBe(false);
    expect(podeDesfazer(k(), { desfazer: false }, "2026-10-30")).toBe(false);
    expect(podeDesfazer(k({ situacao: "EM_RETENCAO" }), { desfazer: true }, "2026-10-30")).toBe(false);
    expect(passouUltimoDia(k(), "2026-11-24")).toBe(true);
    expect(passouUltimoDia(k({ situacao: "ENCERRADO" }), "2026-11-01")).toBe(true);
    expect(passouUltimoDia(k(), "2026-11-23")).toBe(false);
  });
});

describe("os estados da lista (quadro 491)", () => {
  it("os selos novos: Desfeito e Reativado", () => {
    expect(nomeSituacaoCancelamento("DESFEITO")).toBe("Desfeito");
    expect(nomeSituacaoCancelamento("REATIVADO")).toBe("Reativado");
    expect(TOM_CANCELAMENTO.DESFEITO).toBe("ok");
    expect(TOM_CANCELAMENTO.REATIVADO).toBe("ok");
  });

  it("a linha de cada estado", () => {
    expect(detalheCancelamento(k(), "2026-10-30")).toBe("Pedido em 24/10/2026 · Síndico novo · último dia 23/11/2026 · faltam 24 dias");
    expect(detalheCancelamento(k({ situacao: "ENCERRADO" }))).toBe("Pedido em 24/10/2026 · Síndico novo · saiu em 23/11/2026 · só consulta");
    expect(detalheCancelamento(k({ situacao: "DESFEITO", desfeitoEm: "2026-10-30T13:00:00Z", desfeitoPor: carolina }))).toContain("desfeito em 30/10 por Carolina");
    expect(detalheCancelamento(k({ situacao: "REATIVADO", reativadoEm: "2027-03-05T13:00:00Z", reativadoPor: carolina })))
      .toContain("saiu em 23/11/2026 · reativado em 05/03/2027 por Carolina");
  });

  it("o texto do desfeito e do reativado", () => {
    const d = k({ situacao: "DESFEITO", desfeitoEm: "2026-10-30T13:00:00Z", desfeitoPor: carolina, desfeitoNota: "Ana Ribeiro, síndica, pelo WhatsApp comercial" });
    expect(textoDesfeito(d)).toBe('Desfeito em 30/10 por Carolina: "Ana Ribeiro, síndica, pelo WhatsApp comercial". O contrato de hoje continua.');
    expect(textoDesfeito({ ...d, desfeitoNota: undefined })).toContain("a nota foi apagada (LGPD)");
    const r = k({ situacao: "REATIVADO", reativadoEm: "2027-03-05T13:00:00Z", reativadoPor: carolina, retorno: aditivo() });
    expect(textoReativado(r)).toBe("Reativado em 05/03/2027 por Carolina pelo aditivo nº 2, com a cobrança desde a competência de 03/2027. Se havia reconquista aberta, ela ficou Ganha.");
  });
});

describe("as assinaturas do aditivo pelo gov.br (quadro 488)", () => {
  it("primeiro o condomínio, depois a TRÍADE, sobre o mesmo arquivo", () => {
    const vazio = aditivo();
    expect(podeEnviarParte(vazio, "CONDOMINIO")).toBe(true);
    expect(podeEnviarParte(vazio, "TRIADE")).toBe(false);
    expect(estadoParte(vazio, "CONDOMINIO").texto).toBe("Aguardando");
    expect(estadoParte(vazio, "TRIADE").texto).toBe("Espera o condomínio");

    const aConferir = aditivo([envio({})]);
    expect(podeEnviarParte(aConferir, "CONDOMINIO")).toBe(false);
    expect(estadoParte(aConferir, "CONDOMINIO")).toMatchObject({ texto: "Falta conferir", tom: "atencao" });

    const meio = aditivo([conferido("CONDOMINIO")]);
    expect(assinadasAditivo(meio)).toBe(1);
    expect(estadoParte(meio, "CONDOMINIO")).toMatchObject({ texto: "Conferida", tom: "ok" });
    expect(estadoParte(meio, "CONDOMINIO").apoio).toContain("conferido por Carolina");
    expect(estadoParte(meio, "TRIADE").texto).toBe("Sua vez");
    expect(podeEnviarParte(meio, "TRIADE")).toBe(true);
    expect(assinadasAditivo(aditivo([conferido("CONDOMINIO"), conferido("TRIADE")]))).toBe(2);
  });

  it("os envios que não servem dizem por quê", () => {
    expect(estadoParte(aditivo([envio({ situacao: "RECUSADO_NA_HORA", motivo: "SEM_ASSINATURA" })]), "CONDOMINIO").texto).toBe("Sem assinatura");
    expect(estadoParte(aditivo([envio({ situacao: "NAO_E_O_GERADO" })]), "CONDOMINIO").texto).toBe("Não é o aditivo gerado");
    expect(estadoParte(aditivo([envio({ situacao: "RECUSADO", recusa: { motivo: "CPF de outra pessoa", por: carolina, em: "2027-03-02T14:00:00Z" } })]), "CONDOMINIO").apoio)
      .toBe("Recusada por Carolina: CPF de outra pessoa. Envie de novo.");
    expect(podeEnviarParte(aditivo([], { situacao: "SUBSTITUIDO" }), "CONDOMINIO")).toBe(false);
  });

  it("o aditivo nº N da linha de reajuste diz as assinaturas", () => {
    const r: Renovacao = {
      id: "r1", interessadoId: "i1", condominio: "Residencial Pequi", contrato: 3, aniversario: "2026-11-24", avisarAte: "2026-10-25", tipo: "REAJUSTE", situacao: "AVISO_ENVIADO", aviso: { em: "2026-10-20T13:00:00Z", canal: "EMAIL" },
      aditivo: aditivo([conferido("CONDOMINIO")], { id: "a1", numero: 1 }),
    };
    expect(detalheRenovacao(r)).toContain("aditivo nº 1, 1 de 2 assinaturas");
    expect(detalheRenovacao({ ...r, aditivo: aditivo([conferido("CONDOMINIO"), conferido("TRIADE")], { id: "a1", numero: 1 }) })).toContain("aditivo nº 1 assinado pelos dois");
  });
});

describe("reativar (quadros 488 e 491)", () => {
  const encerrado = (retorno?: AditivoResumo) => k({ situacao: "ENCERRADO", retorno });

  it("o botão Reativar diz o que falta", () => {
    expect(faltaParaReativar(k(), true)).toBe("Reativar é depois do último dia; antes dele, desfaça o cancelamento.");
    expect(faltaParaReativar(encerrado(), true)).toBe("Falta gerar o aditivo de retorno.");
    expect(faltaParaReativar(encerrado(), false)).toBe("Falta pôr em uso o modelo de retorno e gerar o aditivo.");
    expect(faltaParaReativar(encerrado(aditivo()), true)).toBe("Falta: a assinatura do condomínio e a assinatura da TRÍADE.");
    expect(faltaParaReativar(encerrado(aditivo([envio({})])), true)).toBe("Falta: conferir a assinatura do condomínio e a assinatura da TRÍADE.");
    expect(faltaParaReativar(encerrado(aditivo([conferido("CONDOMINIO")])), true)).toBe("Falta: a assinatura da TRÍADE.");
    expect(faltaParaReativar(encerrado(aditivo([conferido("CONDOMINIO"), conferido("TRIADE")])), true)).toBeNull();
    expect(faltaParaReativar(k({ situacao: "REATIVADO" }), true)).toBe("Este cliente já foi reativado.");
  });

  it("as linhas do aditivo gerado e as competências da volta", () => {
    expect(linhasRetorno(aditivo().dados?.campos)).toEqual([
      ["Contrato", "nº 17, de 01/12/2025 · encerrado em 23/11/2026"],
      ["Representante", "Ana Ribeiro · CPF ***.456.789-**"],
      ["Plano", "Faixa até 40 unidades, mensal · R$ 199,00 por mês"],
      ["Volta", "Acesso a partir da reativação · cobrança desde a competência de 03/2027"],
    ]);
    expect(linhasRetorno(undefined)).toEqual([]);
    const c = competenciasRetorno("2027-03-02");
    expect(c).toHaveLength(7);
    expect(c[0]!.valor).toBe("2027-03-01");
    expect(c[6]!.valor).toBe("2027-09-01");
  });

  it("Gerar: confere os campos e manda o valor só sob consulta e o motivo só ao gerar de novo", () => {
    const d: DadosRetorno = { representante: "Ana Ribeiro", cpf: "52998224725", competencia: "2027-03-01", ciclo: "MENSAL", valorCentavos: null, motivo: "" };
    expect(problemasRetorno(d, { deNovo: false, sobConsulta: false })).toEqual([]);
    expect(problemasRetorno({ ...d, cpf: "11111111111", representante: "A" }, { deNovo: false, sobConsulta: false })).toEqual(["representante", "cpf"]);
    expect(problemasRetorno(d, { deNovo: true, sobConsulta: true })).toEqual(["valorCentavos", "motivo"]);
    expect(corpoRetorno(d, { deNovo: false, sobConsulta: false })).toEqual({ representante: "Ana Ribeiro", cpf: "52998224725", competencia: "2027-03-01", ciclo: "MENSAL" });
    expect(corpoRetorno({ ...d, valorCentavos: 89000, motivo: " CPF errado " }, { deNovo: true, sobConsulta: true }))
      .toEqual({ representante: "Ana Ribeiro", cpf: "52998224725", competencia: "2027-03-01", ciclo: "MENSAL", valorCentavos: 89000, motivo: "CPF errado" });
  });
});

describe("Modelos › Aditivo: as duas partes (0318)", () => {
  it("cada parte tem os seus campos", () => {
    const retorno = Object.keys(CAMPOS_RETORNO);
    expect(retorno).toEqual(["condominio", "cnpj", "representante", "cpf_representante", "contrato", "data_contrato", "ultimo_dia", "plano", "valor_mensal", "vale_desde"]);
    expect(camposErradosModelo(TEXTO_INICIAL_RETORNO, retorno)).toEqual([]);
    expect(camposErradosModelo("Vale a partir de «vale_desde» e «valor_novo» «", retorno)).toEqual(["«", "«valor_novo»"]);
    expect(camposErradosModelo("Vale a partir de «vale_desde»", Object.keys(ADITIVO_CAMPOS))).toEqual([]);
  });
});
