// A conta da calculadora (CM-33, DC17) para o script da página: as unidades e a taxa opcional
// voltam com os textos prontos, os mesmos que o servidor desenha sem JavaScript. Cada IP tem um
// limite (r9); acima dele, 429, e o Console não é chamado.
import type { APIRoute } from "astro";
import { buscarPreco, dentroDoLimiteDaCalculadora, envServidor, ipDoPedido, lerEntrada, montarResultado } from "../../lib/calculadora";

export const prerender = false;

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export const GET: APIRoute = async (contexto) => {
  const { url, request } = contexto;
  const e = lerEntrada(url.searchParams.get("unidades"), url.searchParams.get("taxa"));
  if (e.erros.unidades || e.unidades === null) return json({ ok: !e.erros.unidades, erros: e.erros, resultado: null }, e.erros.unidades ? 422 : 200);
  const ip = ipDoPedido(request, () => contexto.clientAddress);
  if (!dentroDoLimiteDaCalculadora(ip)) return json({ ok: false, erro: "limite", erros: {}, resultado: null }, 429);
  const resultado = montarResultado(await buscarPreco(e.unidades, envServidor(), fetch, { cliente: ip }), e.taxa);
  return json({ ok: !e.erros.taxa, erros: e.erros, resultado }, e.erros.taxa ? 422 : 200);
};
