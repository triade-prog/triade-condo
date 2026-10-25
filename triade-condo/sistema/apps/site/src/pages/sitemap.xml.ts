import type { APIRoute } from "astro";
const paginas = ["/", "/plataforma", "/solucoes", "/como-funciona", "/precos", "/demonstracao", "/calculadora", "/guia", "/guia/organizar-pedidos", "/privacidade"];
export const GET: APIRoute = ({ site }) => {
  const urls = paginas.map((p) => `<url><loc>${new URL(p, site)}</loc></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
