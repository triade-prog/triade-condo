// Recebe o pedido de proposta da calculadora (CM-33, DC17). Vira interessado no Comercial do
// Console com a faixa, as unidades e a taxa informada já preenchidas, pelo mesmo caminho do pedido
// de demonstração (SITE_SEGREDO); o e-mail para a equipe continua como aviso. Basta um dos dois.
import type { APIRoute } from "astro";
import { lerUtm } from "../../lib/lead";
import { avisarProposta, enviarProposta, envServidor, taxaParaCampo, validarProposta } from "../../lib/calculadora";

export const prerender = false;

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/** Sem JavaScript, volta para a calculadora com a mesma conta na tela. */
function voltar(dados: Record<string, unknown>, estado: string) {
  const q = new URLSearchParams();
  for (const k of ["unidades", "taxa"]) {
    const v = dados[k];
    if (typeof v === "string" && v) q.set(k, v.slice(0, 20));
  }
  q.set("pedido", estado);
  return new Response(null, { status: 303, headers: { Location: `/calculadora?${q}#pedir-proposta` } });
}

export const POST: APIRoute = async ({ request }) => {
  const viaScript = (request.headers.get("content-type") ?? "").includes("application/json");
  let dados: Record<string, unknown> = {};
  try {
    dados = viaScript ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return viaScript ? json({ ok: false, erro: "formato" }, 400) : voltar({}, "erro-campos");
  }

  // Campo escondido: só robô preenche. Responde como se tivesse dado certo e não envia nada.
  if (typeof dados.site === "string" && dados.site.trim() !== "") return viaScript ? json({ ok: true }) : voltar(dados, "recebido");

  const v = validarProposta(dados);
  if (!v.ok) return viaScript ? json({ ok: false, erro: "campos", erros: v.erros }, 422) : voltar(dados, "erro-campos");

  const env = envServidor();
  const [comercial, aviso] = await Promise.all([
    enviarProposta(v.pedido, { utm: lerUtm(dados), pagina: typeof dados.pagina === "string" ? dados.pagina : null }, env),
    avisarProposta(v.pedido, env),
  ]);
  if (!comercial.ok && !aviso.ok) return viaScript ? json({ ok: false, erro: "envio" }, 503) : voltar(dados, "erro-envio");
  return viaScript ? json({ ok: true }) : voltar({ unidades: String(v.pedido.unidades), taxa: taxaParaCampo(v.pedido.taxa) }, "recebido");
};
