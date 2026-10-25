// Calculadora do site (CM-33, DC17; quadros 448 e 449): com e sem a taxa, o "menos de R$ 5" só
// quando é verdade, o preço da Tabela de preços guardado por unidades, o último preço dela e a
// tabela cheia do site como reserva (nunca o fundador sem a vaga), o limite por IP, e o pedido de
// proposta que vira interessado com a faixa e a taxa.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  avisoTabelaCheia,
  buscarPreco,
  corpoDaProposta,
  criarLimite,
  esquecerPrecos,
  ipDoPedido,
  enviarProposta,
  faixaDasUnidades,
  lerEntrada,
  montarResultado,
  precoDoSite,
  TEXTO_CONSENTIMENTO_PROPOSTA,
  validarProposta,
  type Preco,
} from "./calculadora";

const TABELA_64: Preco = {
  unidades: 64,
  faixa: { codigo: "DE_41_A_100", nome: "41 a 100 unidades", sobConsulta: false },
  tabela: "FUNDADOR",
  mensal: 22900,
  porApartamento: 358,
  depoisFundador: 34900,
  fundadorMeses: 12,
};

describe("calculadora: a conta", () => {
  it("quadro 448: 64 unidades e taxa de R$ 650 dão R$ 3,58, o destaque e cerca de 0,6%", () => {
    const r = montarResultado(TABELA_64, 650);
    expect(r).toEqual({
      unidades: 64,
      faixa: "DE_41_A_100",
      faixaTexto: "Faixa: 41 a 100 unidades",
      sobConsulta: false,
      porApartamento: "R$ 3,58",
      mensalidade: "R$ 229,00 · preço de fundador",
      destaque: { titulo: "Menos de R$ 5 por apartamento por mês", frase: "R$ 3,58 por apartamento, cerca de 0,6% da taxa de R$ 650,00." },
      naTaxa: "cerca de 0,6% de R$ 650,00",
      aviso: null,
    });
  });

  it("sem a taxa: o destaque fica (é verdade), a linha do peso some", () => {
    const r = montarResultado(TABELA_64, null);
    expect(r.destaque).toEqual({ titulo: "Menos de R$ 5 por apartamento por mês", frase: "R$ 3,58 por apartamento." });
    expect(r.naTaxa).toBeNull();
  });

  const TABELA_20: Preco = { unidades: 20, faixa: { codigo: "ATE_40", nome: "Até 40 unidades", sobConsulta: false }, tabela: "FUNDADOR", mensal: 12900,
                              porApartamento: 645, depoisFundador: 19900, fundadorMeses: 12 };

  it("quadro 449: 20 unidades, sem taxa, R$ 6,45 e nada de 'menos de R$ 5'", () => {
    const r = montarResultado(TABELA_20, null);
    expect(r.faixaTexto).toBe("Faixa: até 40 unidades");
    expect(r.porApartamento).toBe("R$ 6,45");
    expect(r.mensalidade).toBe("R$ 129,00 · preço de fundador");
    expect(r.destaque).toBeNull();
    expect(r.naTaxa).toBeNull();
    expect(r.aviso).toBeNull();
  });

  it("com taxa e valor acima de R$ 5: mostra o peso, sem o destaque", () => {
    const r = montarResultado(TABELA_20, 480);
    expect(r.destaque).toBeNull();
    expect(r.naTaxa).toBe("cerca de 1,3% de R$ 480,00");
  });

  it("R$ 5,00 exatos não ganham o destaque (precisa ser menos)", () => {
    const r = montarResultado({ ...TABELA_64, porApartamento: 500 }, null);
    expect(r.destaque).toBeNull();
  });

  it("acima de 400 unidades: sob consulta, sem valor nem peso", () => {
    const r = montarResultado(precoDoSite(450), 650);
    expect(r).toMatchObject({ faixa: "ACIMA_DE_400", faixaTexto: "Faixa: acima de 400 unidades", sobConsulta: true, porApartamento: null, mensalidade: null, destaque: null, naTaxa: null });
  });

  it("sem a Tabela, a oferta do site usa a tabela cheia e nunca o fundador (r9), com o 'a partir de' do /precos", () => {
    expect(precoDoSite(64)).toEqual({ unidades: 64, faixa: TABELA_64.faixa, tabela: "CHEIA", mensal: 34900, porApartamento: 545, origem: "SITE" });
    expect(precoDoSite(150)).toMatchObject({ faixa: { codigo: "DE_101_A_200" }, tabela: "CHEIA" });
    expect(precoDoSite(1)).toMatchObject({ tabela: "CHEIA", porApartamento: 19900 });
    const r = montarResultado(precoDoSite(64), null);
    expect([r.porApartamento, r.mensalidade, r.destaque]).toEqual(["R$ 5,45", "R$ 349,00", null]);
    expect(r.aviso).toBe(avisoTabelaCheia());
    expect(r.aviso).toBe("Valor da tabela cheia. Condomínios fundadores: a partir de R$ 129,00/mês, só no mensal, vagas limitadas; a proposta confirma.");
    expect(JSON.stringify(r)).not.toMatch(/preço de fundador|R\$ 3,58/);
    expect([40, 41, 100, 101, 200, 201, 400, 401].map((u) => faixaDasUnidades(u).codigo)).toEqual([
      "ATE_40", "DE_41_A_100", "DE_41_A_100", "DE_101_A_200", "DE_101_A_200", "DE_201_A_400", "DE_201_A_400", "ACIMA_DE_400",
    ]);
  });
});

describe("calculadora: o que a pessoa digita", () => {
  it("unidades de 1 a 20.000; vazio não é erro, só não calcula", () => {
    expect(lerEntrada("64", "")).toMatchObject({ unidades: 64, taxa: null, erros: {} });
    expect(lerEntrada("1.200", null)).toMatchObject({ unidades: 1200 });
    expect(lerEntrada("", "")).toMatchObject({ unidades: null, erros: {} });
    expect(lerEntrada(null, null)).toMatchObject({ unidades: null, erros: {} });
    for (const u of ["0", "20001", "abc", "-3", "6,5"]) expect(lerEntrada(u, "").erros.unidades).toBe("Digite as unidades do prédio, de 1 a 20.000.");
  });

  it("a taxa é opcional, maior que zero e até R$ 20.000", () => {
    expect(lerEntrada("64", "650").taxa).toBe(650);
    expect(lerEntrada("64", "650,50").taxa).toBe(650.5);
    expect(lerEntrada("64", "R$ 1.250,00").taxa).toBe(1250);
    expect(lerEntrada("64", "650.5").taxa).toBe(650.5);
    expect(lerEntrada("64", "0").erros.taxa).toBe("A taxa vai de R$ 0,01 a R$ 20.000");
    expect(lerEntrada("64", "20000,01").erros.taxa).toBe("A taxa vai de R$ 0,01 a R$ 20.000");
    expect(lerEntrada("64", "20.000").taxa).toBe(20000);
    expect(lerEntrada("64", "seiscentos").erros.taxa).toBe("Digite a taxa em reais, por exemplo 650,00");
  });
});

describe("calculadora: o preço da Tabela de preços", () => {
  const env = { SUPABASE_FUNCTIONS_URL: "https://x.functions.supabase.co/", SITE_SEGREDO: "s" };
  beforeEach(() => esquecerPrecos());

  it("pede à rota do Console com o segredo do site, o IP de quem usa e só as unidades", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify(TABELA_64), { status: 200 }));
    expect(await buscarPreco(64, env, buscar as unknown as typeof fetch, { cliente: "200.1.2.3" })).toEqual({ ...TABELA_64, origem: "TABELA" });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.functions.supabase.co/api-console/v1/site/calculadora");
    expect((init.headers as Record<string, string>)["x-site-segredo"]).toBe("s");
    expect((init.headers as Record<string, string>)["x-site-cliente"]).toBe("200.1.2.3");
    expect(JSON.parse(String(init.body))).toEqual({ unidades: 64 });
  });

  it("guarda o preço por 10 minutos por unidades: a mesma conta não chama o Console de novo (r9)", async () => {
    const buscar = vi.fn(async () => new Response(JSON.stringify(TABELA_64), { status: 200 }));
    const t = 1_000_000;
    await buscarPreco(64, env, buscar as unknown as typeof fetch, { agora: t });
    await buscarPreco(64, env, buscar as unknown as typeof fetch, { agora: t + 9 * 60_000 });
    expect(buscar).toHaveBeenCalledTimes(1);
    await buscarPreco(64, env, buscar as unknown as typeof fetch, { agora: t + 11 * 60_000 });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("com o Console fora do ar, vale o último preço da Tabela para a faixa, até 24 horas (r9)", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(TABELA_64), { status: 200 }));
    const fora = vi.fn(async () => new Response("{}", { status: 503 }));
    const t = 5_000_000;
    await buscarPreco(64, env, ok as unknown as typeof fetch, { agora: t });
    expect(await buscarPreco(80, env, fora as unknown as typeof fetch, { agora: t + 60_000 }))
      .toEqual({ ...TABELA_64, unidades: 80, porApartamento: 286, origem: "ULTIMO" });
    expect(montarResultado(await buscarPreco(80, env, fora as unknown as typeof fetch, { agora: t + 60_000 }), null).aviso).toBeNull();
    expect(await buscarPreco(80, env, fora as unknown as typeof fetch, { agora: t + 25 * 60 * 60_000 })).toEqual(precoDoSite(80));
    // Acima do limite do site, nem chama o Console.
    const nunca = vi.fn();
    expect((await buscarPreco(90, env, nunca as unknown as typeof fetch, { agora: t + 60_000, semConsultar: true })).origem).toBe("ULTIMO");
    expect(nunca).not.toHaveBeenCalled();
  });

  it("sem configuração, com erro ou resposta estranha, e sem preço guardado, usa a tabela cheia do site", async () => {
    const nunca = vi.fn();
    expect(await buscarPreco(64, {}, nunca as unknown as typeof fetch)).toEqual(precoDoSite(64));
    expect(nunca).not.toHaveBeenCalled();
    const falha = vi.fn(async () => new Response("{}", { status: 503 }));
    expect(await buscarPreco(64, env, falha as unknown as typeof fetch)).toEqual(precoDoSite(64));
    const estranha = vi.fn(async () => new Response(JSON.stringify({ ...TABELA_64, unidades: 65 }), { status: 200 }));
    expect(await buscarPreco(64, env, estranha as unknown as typeof fetch)).toEqual(precoDoSite(64));
    const fora = vi.fn(async () => {
      throw new Error("rede");
    });
    expect(await buscarPreco(64, env, fora as unknown as typeof fetch)).toEqual(precoDoSite(64));
  });
});

describe("calculadora: o limite por IP (r9)", () => {
  it("conta por chave numa janela", () => {
    const dentro = criarLimite(2, 60_000);
    expect([dentro("a", 0), dentro("a", 1), dentro("a", 2), dentro("b", 2), dentro("a", 60_001)]).toEqual([true, true, false, true, true]);
  });

  it("o IP vem do x-forwarded-for ou da conexão", () => {
    const comCabecalho = new Request("https://site/api", { headers: { "x-forwarded-for": "200.1.2.3, 10.0.0.1" } });
    expect(ipDoPedido(comCabecalho, () => "10.9.9.9")).toBe("200.1.2.3");
    expect(ipDoPedido(new Request("https://site/api"), () => "10.9.9.9")).toBe("10.9.9.9");
    expect(ipDoPedido(new Request("https://site/api"), () => {
      throw new Error("sem endereço");
    })).toBe("sem-ip");
  });
});

describe("calculadora: o pedido de proposta", () => {
  const dados = { nome: " Renata  Moura ", whatsapp: "(61) 99876-1230", consentimento: "on", unidades: "64", taxa: "650,00" };

  it("valida nome, WhatsApp, autorização e unidades; a taxa é opcional", () => {
    expect(validarProposta(dados)).toEqual({ ok: true, pedido: { nome: "Renata Moura", whatsapp: "5561998761230", unidades: 64, taxa: 650 } });
    expect(validarProposta({ ...dados, taxa: "" })).toMatchObject({ ok: true, pedido: { taxa: null } });
    const r = validarProposta({ nome: "R", whatsapp: "123", unidades: "", taxa: "0" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(["consentimento", "nome", "taxa", "unidades", "whatsapp"]);
  });

  it("vira interessado com pedido PROPOSTA, a faixa, as unidades e a taxa já preenchidas", () => {
    const v = validarProposta(dados);
    if (!v.ok) throw new Error("devia validar");
    expect(corpoDaProposta(v.pedido, { utm: { utm_source: "google" }, pagina: "/calculadora" })).toEqual({
      nome: "Renata Moura",
      whatsapp: "5561998761230",
      condominio: "Condomínio a informar (calculadora do site, 64 unidades)",
      faixa: "DE_41_A_100",
      pedido: "PROPOSTA",
      unidades: 64,
      taxaCondominio: 650,
      consentimento: true,
      consentimentoTexto: TEXTO_CONSENTIMENTO_PROPOSTA,
      pagina: "/calculadora",
      utm: { utm_source: "google" },
    });
  });

  it("sem a taxa, vai nula; sem configuração, não envia", async () => {
    const v = validarProposta({ ...dados, taxa: "" });
    if (!v.ok) throw new Error("devia validar");
    expect(corpoDaProposta(v.pedido, { utm: null }).taxaCondominio).toBeNull();
    const nunca = vi.fn();
    expect(await enviarProposta(v.pedido, { utm: null }, {}, nunca as unknown as typeof fetch)).toEqual({ ok: false, motivo: "sem-configuracao" });
    const ok = vi.fn(async () => new Response("{}", { status: 201 }));
    expect(await enviarProposta(v.pedido, { utm: null }, { SUPABASE_FUNCTIONS_URL: "https://x", SITE_SEGREDO: "s" }, ok as unknown as typeof fetch)).toEqual({ ok: true });
    expect((ok.mock.calls[0] as unknown as [string])[0]).toBe("https://x/api-console/v1/site/interessados");
  });
});
