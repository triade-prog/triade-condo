import { describe, expect, it } from "vitest";
import {
  agruparMural, type AvisoDoMural, blocoDeData, contar, dataHumana, diaDaVisita, eventoFuturo, faltaParaOEvento, haQuanto, icsDoEvento,
  MOTIVOS_FORA_DO_MURAL, nomeDoIcs, novosDesde, precoDoAnuncio, textoAtualizado, textoConferido,
} from "./mural.ts";

describe("mural visto do painel (CD-15)", () => {
  it("diz por que um publicado não está no link", () => {
    expect(Object.keys(MOTIVOS_FORA_DO_MURAL)).toEqual(["SO_PARA_ALGUNS", "ASSUNTO_FORA", "TIRADO"]);
  });

  it("a vitrine mostra o valor, Grátis na doação ou o tipo", () => {
    expect(precoDoAnuncio({ tipo: "VENDO", valorCentavos: 90000 })).toBe("R$ 900,00");
    expect(precoDoAnuncio({ tipo: "DOO" })).toBe("Grátis");
    expect(precoDoAnuncio({ tipo: "SERVICO" })).toBe("Serviço de morador");
    expect(precoDoAnuncio({ tipo: "PROCURO", valorCentavos: null })).toBe("Procuro");
  });

  it("conta há quanto tempo em dias de Brasília", () => {
    const agora = new Date("2026-10-22T02:30:00Z"); // 23:30 de 21/10 em Brasília
    expect(haQuanto("2026-10-21T13:00:00Z", agora)).toBe("hoje");
    expect(haQuanto("2026-10-20T20:00:00Z", agora)).toBe("ontem");
    expect(haQuanto("2026-10-18T12:00:00Z", agora)).toBe("há 3 dias");
    expect(haQuanto("2026-10-13T12:00:00Z", agora)).toBe("há 1 semana");
    expect(haQuanto("2026-10-01T12:00:00Z", agora)).toBe("há 2 semanas");
    expect(haQuanto("2026-09-15T12:00:00Z", agora)).toBe("há 1 mês");
    expect(haQuanto("2026-11-01T12:00:00Z", agora)).toBe("hoje");
  });

  it("diz quando a prévia conferiu", () => {
    expect(textoConferido(1000, 3000)).toBe("Conferido agora");
    expect(textoConferido(1000, 13000)).toBe("Conferido há 12 s");
    expect(textoConferido(0, 200_000)).toBe("Conferido há 3 min");
  });
});

describe("mural do morador, conceito Janela acesa (D4.40)", () => {
  const agora = new Date("2026-10-26T12:10:00Z"); // segunda 26/10, 09:10 em Brasília
  const aviso = (id: string, publicadoEm: string, extra: Partial<AvisoDoMural> = {}): AvisoDoMural => ({ id, assunto: "AVISO", titulo: id, publicadoEm, ...extra });

  it("CD-12: a data fala a língua da pessoa, em Brasília", () => {
    expect(dataHumana("2026-10-26T12:10:00Z", agora)).toBe("hoje, 09:10");
    expect(dataHumana("2026-10-25T21:40:00Z", agora)).toBe("ontem, 18:40");
    expect(dataHumana("2026-10-24T19:20:00Z", agora)).toBe("sáb 24/10, 16:20");
    expect(dataHumana("2025-10-24T19:20:00Z", agora)).toBe("sex 24/10/2025, 16:20");
    expect(textoAtualizado("2026-10-26T12:10:00Z", agora)).toBe("Atualizado hoje às 09:10");
    expect(textoAtualizado("2026-10-24T19:20:00Z", agora)).toBe("Atualizado sáb 24/10, às 16:20");
    expect(diaDaVisita("2026-10-23T15:00:00Z")).toBe("sexta 23/10");
    expect(contar(1, "aviso", "avisos")).toBe("1 aviso");
    expect(contar(3, "aviso", "avisos")).toBe("3 avisos");
  });

  it("CD-17: o bloco de data mostra dia, mês, dia da semana, horas e local", () => {
    expect(blocoDeData({ dia: "2026-10-28", inicio: "08:00", fim: "14:00" })).toEqual({ dia: "28", mes: "OUT", semana: "qua", semanaLonga: "quarta", detalhe: "qua · 8h às 14h" });
    expect(blocoDeData({ dia: "2026-10-31", inicio: "16:30", local: "Salão de festas" }).detalhe).toBe("sáb · 16h30 · Salão de festas");
    expect(blocoDeData({ dia: "2026-11-06" }).detalhe).toBe("sex");
    expect(faltaParaOEvento("2026-11-06", agora)).toBe("faltam 11 dias");
    expect(faltaParaOEvento("2026-10-26", agora)).toBe("hoje");
    expect(faltaParaOEvento("2026-10-27", agora)).toBe("amanhã");
    expect(faltaParaOEvento("2026-10-25", agora)).toBe("foi ontem");
    expect(faltaParaOEvento("2026-10-20", agora)).toBe("foi há 6 dias");
    expect(eventoFuturo({ dia: "2026-10-26" }, agora)).toBe(true);
    expect(eventoFuturo({ dia: "2026-10-25" }, agora)).toBe(false);
    expect(eventoFuturo(null, agora)).toBe(false);
  });

  it("CD-17: um só destaque, a assembleia na frente; Esta semana são os 7 dias até hoje", () => {
    const avisos = [
      aviso("agua", "2026-10-26T12:10:00Z", { assunto: "OBRAS", evento: { dia: "2026-10-28", inicio: "08:00", fim: "14:00" } }),
      aviso("portao", "2026-10-25T21:40:00Z", { assunto: "SEGURANCA" }),
      aviso("edital", "2026-10-24T13:00:00Z", { assunto: "ASSEMBLEIA", evento: { dia: "2026-11-06", inicio: "19:00", fim: "19:30", local: "Salão" } }),
      aviso("coleta", "2026-10-23T11:00:00Z", { assunto: "LEMBRETE" }),
      aviso("elevador", "2026-10-17T14:30:00Z", { assunto: "OBRAS", evento: { dia: "2026-10-20" } }),
      aviso("boleto", "2026-10-15T12:00:00Z"),
    ];
    const g = agruparMural(avisos, agora);
    expect(g.destaque?.id).toBe("edital");
    expect(g.estaSemana.map((a) => a.id)).toEqual(["agua", "portao", "coleta"]);
    expect(g.antes.map((a) => a.id)).toEqual(["elevador", "boleto"]);
    // Sem assembleia, o destaque é o próximo evento futuro; evento passado não destaca.
    const semEdital = agruparMural(avisos.filter((a) => a.id !== "edital"), agora);
    expect(semEdital.destaque?.id).toBe("agua");
    expect(agruparMural([avisos[4]!, avisos[5]!], agora).destaque).toBeUndefined();
    // A ordem de publicação vale dentro de cada parte, mesmo se a lista vier embaralhada.
    expect(agruparMural([...avisos].reverse(), agora).estaSemana.map((a) => a.id)).toEqual(["agua", "portao", "coleta"]);
  });

  it("CD-16: marca o que foi publicado depois da última visita guardada no aparelho", () => {
    const avisos = [aviso("a", "2026-10-26T12:10:00Z"), aviso("b", "2026-10-23T11:00:00Z"), aviso("c", "2026-10-15T12:00:00Z")];
    expect([...novosDesde(avisos, "2026-10-23T15:00:00Z")]).toEqual(["a"]);
    expect([...novosDesde(avisos, "2026-10-01T15:00:00Z")]).toEqual(["a", "b", "c"]);
    expect(novosDesde(avisos, null).size).toBe(0);
    expect(novosDesde(avisos, "não é data").size).toBe(0);
  });

  it("CD-18: o arquivo de agenda tem o evento em UTC, contado no fuso do condomínio, com local e texto", () => {
    const desdobrar = (ics: string) => ics.replace(/\r\n /g, "");
    const ics = icsDoEvento({ id: "x1", titulo: "Mutirão; geral", texto: "Pauta:\ncontas", evento: { dia: "2026-11-06", inicio: "19:00", fim: "21:30", local: "Salão, térreo" } }, "Condomínio Águas Claras", { agora });
    expect(ics).toContain("DTSTART:20261106T220000Z");
    expect(ics).toContain("DTEND:20261107T003000Z");
    expect(ics).not.toContain("TZID");
    expect(ics).toContain("SUMMARY:Mutirão\\; geral");
    expect(ics).toContain("LOCATION:Salão\\, térreo");
    expect(ics).toContain("DESCRIPTION:Pauta:\\ncontas\\n\\nCondomínio Águas Claras");
    expect(ics).toContain("UID:mural-x1@triade-condo");
    expect(ics.split("\r\n")).toContain("END:VCALENDAR");
    // Sem fim, uma hora, mesmo perto da meia-noite; sem hora, o dia inteiro.
    expect(icsDoEvento({ id: "x2", titulo: "T", texto: "t", evento: { dia: "2026-10-28", inicio: "08:00" } }, "C", { agora })).toContain("DTEND:20261028T120000Z");
    expect(icsDoEvento({ id: "x2", titulo: "T", texto: "t", evento: { dia: "2026-10-28", inicio: "23:30" } }, "C", { agora })).toContain("DTEND:20261029T033000Z");
    const diaTodo = icsDoEvento({ id: "x3", titulo: "T", texto: "t", evento: { dia: "2026-10-31" } }, "C", { agora });
    expect(diaTodo).toContain("DTSTART;VALUE=DATE:20261031");
    expect(diaTodo).toContain("DTEND;VALUE=DATE:20261101");
    // Outro fuso do condomínio (Manaus, -4 h).
    expect(icsDoEvento({ id: "x4", titulo: "T", texto: "t", evento: { dia: "2026-11-06", inicio: "19:00" } }, "C", { agora, fuso: "America/Manaus" })).toContain("DTSTART:20261106T230000Z");
    // Linhas longas dobradas em 75 bytes, sem partir acento; desdobradas, o texto volta inteiro.
    const longo = icsDoEvento({ id: "x5", titulo: "T", texto: "ção ".repeat(60), evento: { dia: "2026-11-06" } }, "C", { agora });
    for (const l of longo.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(desdobrar(longo)).toContain(`DESCRIPTION:${"ção ".repeat(60)}\\n\\nC`);
  });

  it("CD-18: na assembleia, a agenda vai da primeira chamada a duas horas depois da segunda, e a descrição diz as duas", () => {
    const ics = icsDoEvento({ id: "a1", assunto: "ASSEMBLEIA", titulo: "Edital: AGO", texto: "Pauta", evento: { dia: "2026-11-06", inicio: "19:00", fim: "19:30", local: "Salão" } }, "C", { agora });
    expect(ics).toContain("DTSTART:20261106T220000Z");
    expect(ics).toContain("DTEND:20261107T003000Z");
    expect(ics.replace(/\r\n /g, "")).toContain("DESCRIPTION:Primeira chamada às 19h\\; segunda chamada às 19h30.\\n\\nPauta");
    expect(icsDoEvento({ id: "a2", assunto: "ASSEMBLEIA", titulo: "E", texto: "P", evento: { dia: "2026-11-06", inicio: "20:00" } }, "C", { agora })).toContain("DTEND:20261107T010000Z");
  });

  it("CD-18: o nome do arquivo não tem acento nem espaço", () => {
    expect(nomeDoIcs("Assembleia geral ordinária: orçamento de 2027")).toBe("assembleia-geral-ordinaria-orcamento-de-2027.ics");
    expect(nomeDoIcs("???")).toBe("evento.ics");
  });
});
