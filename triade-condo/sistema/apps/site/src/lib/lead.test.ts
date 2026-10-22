import { describe, expect, it, vi } from "vitest";
import { emailDoPedido, enviarPedido, mascararWhatsapp, normalizarWhatsapp, validarPedido } from "./lead";

const valido = { nome: "  Carlos   Lima ", whatsapp: "(61) 99999-0412", condominio: "Residencial Ipê, Brasília", unidades: "41 a 100", consentimento: true };

describe("pedido de demonstração", () => {
  it("normaliza o WhatsApp com o 55 do Brasil", () => {
    expect(normalizarWhatsapp("(61) 99999-0412")).toBe("5561999990412");
    expect(normalizarWhatsapp("061 3333-4444")).toBe("556133334444");
    expect(normalizarWhatsapp("+55 61 99999-0412")).toBe("5561999990412");
    expect(normalizarWhatsapp("9999-0412")).toBeNull();
    expect(normalizarWhatsapp("+1 415 555 0100")).toBeNull();
  });

  it("aceita os quatro campos com a autorização e limpa os espaços", () => {
    const v = validarPedido(valido);
    expect(v).toEqual({ ok: true, pedido: { nome: "Carlos Lima", whatsapp: "5561999990412", condominio: "Residencial Ipê, Brasília", unidades: "41 a 100" } });
  });

  it("recusa sem autorização, faixa desconhecida ou campos vazios, dizendo o que falta", () => {
    const v = validarPedido({ nome: "", whatsapp: "123", condominio: "x", unidades: "mil", consentimento: false });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.erros).sort()).toEqual(["condominio", "consentimento", "nome", "unidades", "whatsapp"]);
  });

  it("aceita a autorização vinda do formulário sem JavaScript", () => {
    expect(validarPedido({ ...valido, consentimento: "on" }).ok).toBe(true);
  });

  it("mascara o WhatsApp na confirmação", () => {
    expect(mascararWhatsapp("5561999990412")).toBe("(61) 9 ••••-0412");
    expect(mascararWhatsapp("556133334444")).toBe("(61) ••••-4444");
  });

  it("o e-mail escapa o que a pessoa escreveu e traz a promessa de retorno", () => {
    const { assunto, html, texto } = emailDoPedido({ nome: "<b>Ana</b>", whatsapp: "5561999990412", condominio: "Ipê", unidades: "Até 40" }, new Date("2026-10-22T12:12:00Z"));
    expect(assunto).toBe("Demonstração: Ipê (Até 40)");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).not.toContain("<b>Ana</b>");
    expect(texto).toContain("22/10/2026, 09:12 (Brasília)");
    expect(texto).toContain("até o fim do próximo dia útil");
  });

  it("sem a configuração do Resend, não finge que enviou", async () => {
    const buscar = vi.fn();
    const r = await enviarPedido({ nome: "Ana", whatsapp: "5561999990412", condominio: "Ipê", unidades: "Até 40" }, {}, new Date(), buscar);
    expect(r).toEqual({ ok: false, motivo: "sem-configuracao" });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("envia pelo Resend para cada endereço da equipe e informa falha", async () => {
    const buscar = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const env = { RESEND_API_KEY: "chave", LEADS_EMAIL_DE: "site@exemplo", LEADS_EMAIL_PARA: "a@exemplo, b@exemplo" };
    const pedido = { nome: "Ana", whatsapp: "5561999990412", condominio: "Ipê", unidades: "Até 40" };
    expect(await enviarPedido(pedido, env, new Date(), buscar)).toEqual({ ok: true });
    const corpo = JSON.parse(buscar.mock.calls[0][1].body);
    expect(corpo.to).toEqual(["a@exemplo", "b@exemplo"]);
    buscar.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect(await enviarPedido(pedido, env, new Date(), buscar)).toEqual({ ok: false, motivo: "falha-envio" });
  });
});
