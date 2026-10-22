// Site institucional e de vendas da TRÍADE Condo (EM-04).
// Páginas estáticas; só o envio do pedido de demonstração roda no servidor (Vercel).
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://www.triadecondo.com.br",
  output: "static",
  adapter: vercel(),
  trailingSlash: "never",
  build: { inlineStylesheets: "never" },
  vite: { build: { assetsInlineLimit: 0 } },
});
