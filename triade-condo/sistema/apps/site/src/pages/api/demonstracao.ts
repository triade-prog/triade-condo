// Recebe o pedido de demonstração. Com JavaScript, o formulário manda JSON e mostra a
// confirmação na própria página; sem JavaScript, o envio normal volta para uma página. O pedido
// vai ao Comercial do Console e por e-mail ao mesmo tempo; basta um dos dois chegar.
import type { APIRoute } from "astro";
import { enviarAoComercial, enviarPedido, lerUtm, mascararWhatsapp, validarPedido } from "../../lib/lead";

export const prerender = false;

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request, redirect }) => {
  const tipo = request.headers.get("content-type") ?? "";
  const viaScript = tipo.includes("application/json");
  let dados: Record<string, unknown> = {};
  try {
    dados = viaScript ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return viaScript ? json({ ok: false, erro: "formato" }, 400) : redirect("/demonstracao?erro=campos", 303);
  }

  // Campo escondido: só robô preenche. Responde como se tivesse dado certo e não envia nada.
  if (typeof dados.site === "string" && dados.site.trim() !== "") {
    return viaScript ? json({ ok: true, horario: "", whatsapp: "" }) : redirect("/demonstracao/recebido", 303);
  }

  const v = validarPedido(dados);
  if (!v.ok) return viaScript ? json({ ok: false, erro: "campos", erros: v.erros }, 422) : redirect("/demonstracao?erro=campos", 303);

  const agora = new Date();
  const [comercial, envio] = await Promise.all([
    enviarAoComercial(v.pedido, { utm: lerUtm(dados), pagina: typeof dados.pagina === "string" ? dados.pagina : null }, {
      SUPABASE_FUNCTIONS_URL: import.meta.env.SUPABASE_FUNCTIONS_URL ?? process.env.SUPABASE_FUNCTIONS_URL,
      SITE_SEGREDO: import.meta.env.SITE_SEGREDO ?? process.env.SITE_SEGREDO,
    }),
    enviarPedido(v.pedido, {
      RESEND_API_KEY: import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY,
      LEADS_EMAIL_DE: import.meta.env.LEADS_EMAIL_DE ?? process.env.LEADS_EMAIL_DE,
      LEADS_EMAIL_PARA: import.meta.env.LEADS_EMAIL_PARA ?? process.env.LEADS_EMAIL_PARA,
    }, agora),
  ]);
  if (!comercial.ok && !envio.ok) return viaScript ? json({ ok: false, erro: "envio" }, 503) : redirect("/demonstracao?erro=envio", 303);

  const horario = agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return viaScript
    ? json({ ok: true, horario, whatsapp: mascararWhatsapp(v.pedido.whatsapp) })
    : redirect("/demonstracao/recebido", 303);
};
