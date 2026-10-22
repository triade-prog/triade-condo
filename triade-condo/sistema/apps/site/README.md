# Site da TRÍADE Condo

Site institucional e de vendas (ideia EM-04, item R16 do painel). Astro com páginas estáticas;
só o envio do pedido de demonstração roda no servidor (`src/pages/api/demonstracao.ts`).

- Desenho aprovado em 22/10/2026 (2ª rodada).
- Cores e fontes iguais às da Plataforma (`packages/ui/src/tema.css`); um teste confere.
- Preços em `src/dados/oferta.ts` (provisórios até a decisão da precificação).
- WhatsApp comercial, razão social e CNPJ vêm das variáveis (`.env.example`); sem elas, o site esconde o que depende delas.

## Rodar

```bash
pnpm dev:site            # http://localhost:4321
pnpm --filter @triade/site build
pnpm e2e:site            # Playwright no celular e no computador
```

## Publicar na Vercel

Projeto próprio com raiz `triade-condo/sistema/apps/site`, framework Astro, e as variáveis do `.env.example`.
Os pedidos de demonstração chegam por e-mail em `LEADS_EMAIL_PARA`, enviados pelo Resend.
