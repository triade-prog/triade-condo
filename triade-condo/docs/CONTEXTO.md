# Contexto do projeto — TRÍADE Condo

Resumo para quem continuar o trabalho (pessoa ou nova sessão do Claude). Atualizado em 15/10/2026 (horário de Brasília), com a aprovação da tecnologia e antes do primeiro código.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| O que é a TRÍADE Condo (público, ideais, mercado, glossário) | `triade-condo/SOBRE.md` |
| Todas as ideias (296), com código por seção | `triade-condo/IDEIAS.md` |
| Onde cada ideia entra no sistema real (sistema, peça e forma) | `triade-condo/MAPA.md` e a versão visual `triade-condo/mapa.html` |
| Transparência do dinheiro (pesquisa e regras de tom) | `triade-condo/transparencia-do-dinheiro.md` |
| Painel de execução (fases, entregas, testes, publicação, dependências, decisões, histórico) | `triade-condo/docs/painel-execucao.html` |
| Design do frontend (princípios, design system, textos, telas a desenhar) | `triade-condo/docs/design-frontend.html` |
| Instruções para toda sessão do Claude | `CLAUDE.md` (raiz do repositório) |
| Planejamento, protótipos e pesquisas antigos (só consulta) | `arquivo/` |
| Código do sistema | `triade-condo/sistema/` (nasce no passo 0) |

O `arquivo/` **não é base de construção**: o que for útil de lá entra primeiro no `IDEIAS.md`.

## Decisões fechadas

As mesmas decisões estão no painel de execução (DC1 a DC10). Mudar qualquer uma atualiza primeiro este arquivo e o painel.

- **DC1 · Dois sistemas.** Plataforma do síndico (painel web do síndico, WhatsApp do morador e acessos por link ou QR) e Console TRÍADE (sistema interno da equipe). A Base comum são as regras que os dois seguem por baixo; não é um terceiro sistema.
- **DC2 · O cliente é o condomínio.** É a unidade que contrata e a unidade de separação dos dados: toda informação pertence a um condomínio e nunca aparece em outro (PT-01). Uma pessoa pode ter vínculo com mais de um condomínio (MU-04), o que atende o síndico profissional.
- **DC3 · Cada condomínio tem o seu número de WhatsApp** (W-01). O número compartilhado da TRÍADE (W-02) sai do caminho principal.
- **DC4 · Só a API oficial do WhatsApp** (W-04). Nada de conexão por QR Code ou WhatsApp Web. O provedor oficial ainda está em análise (ver "Em aberto").
- **DC5 · Tecnologia igual à do T-shirt Club** (`triade-prog/T-shirtclub.br`, pasta `sistema/`): TypeScript em tudo; Next.js 16 + React 19 + Tailwind 4 nas telas; Supabase (PostgreSQL 17, região São Paulo `sa-east-1`) com Edge Functions (Deno + Hono) como servidor; monorepo pnpm com `apps/` e `packages/` (`domain`, `ui`, `servidor`); testes com Vitest, pgTAP, Playwright com axe; publicação na Vercel. Atende PT-05, PT-06 e PT-16.
- **DC6 · Do T-shirt Club vêm só as peças genéricas**, revisadas e adaptadas a vários condomínios: fila de mensagens com estados, auditoria só de inserção, gatilho guardião de transições, relógio da aplicação (`app_now()`), proteção do servidor (CSP com nonce, repasse `/api`), configuração de testes e CI. Loja, reserva, estoque e pagamento não vêm.
- **DC7 · Ordem de construção por dependência**, sem cortar ideias (não existe MVP): passo 0 Fundação → 1 Cadastrar condomínio (Console) → 2 Configurações → 3 Moradores e unidades → 4 Pedidos no painel → 5 WhatsApp do morador → 6 Prazos e avisos → 7 Início. As outras peças entram depois, cada uma quando fizer sentido.
- **DC8 · Quadro de permissões e fluxos detalhados só quando houver funcionalidade pronta para eles.** A fundação traz o mecanismo de permissão (pessoa + função + condomínio + ação, negar por padrão), não a tabela completa de quem pode o quê.
- **DC9 · Rastreio até a ideia.** O `IDEIAS.md` é a fonte única. Cada entrega do painel cita em `refs` os códigos das ideias que atende; cada regra vira teste automático com o código da ideia no nome (ex.: `AT-06: próximo retorno não altera a previsão`).
- **DC10 · Pedidos funcionam primeiro pelo painel.** O WhatsApp entra no passo 5 como mais uma entrada para o mesmo pedido, quando o provedor oficial estiver escolhido.

## Como as ideias viram código

A forma de cada ideia no `MAPA.md` diz o que ela vira:

| Forma | Vira |
|---|---|
| Regra | regra do domínio + teste automático com o código da ideia |
| Função | ação que alguém executa (caso de uso na API) |
| Aviso | evento que dispara mensagem ou alerta |
| Configuração | campo da ficha do condomínio, com valor padrão |
| Indicador | cálculo sobre o histórico |
| Integração | conector trocável com um parceiro |
| Aba | tela (construída depois das regras) |
| Serviço | registro no Console, não é programação |
| Negócio / Referência | não vira código |

## Em aberto

| O quê | Quem | Trava |
|---|---|---|
| Provedor oficial do WhatsApp (Cloud API direta ou parceiro da Meta) | Carolina (em análise) | Passo 5 |
| Conta Meta Business da TRÍADE verificada e o primeiro número de condomínio | TRÍADE | Passo 5 |
| Projeto Supabase de desenvolvimento e projetos na Vercel | TRÍADE | Publicar o passo 1 (o passo 0 roda com Postgres local) |
| Identidade visual (logo, paleta, tipografia) | TRÍADE | Telas do passo 1 em diante; até lá vale a proposta do `design-frontend.html` |
| Dados da empresa para termos e privacidade (EM-01, EM-06) | TRÍADE | Publicação |
| Domínio próprio | TRÍADE | Publicação |
| Condomínio de teste com síndico disposto (NG-09) | TRÍADE | Teste dos passos 4 a 7 |

## Situação

**15/10/2026.** A fase de ideias terminou e a de construção foi liberada.

- O planejamento antigo foi arquivado em `arquivo/` e a pasta `triade-condo/` foi criada como o lugar onde nasce o sistema.
- O `IDEIAS.md` reúne 296 ideias em 22 seções. Elas foram conferidas contra todos os documentos do arquivo e contra as pesquisas brasileira e internacional. A classificação foi revisada duas vezes.
- O `MAPA.md` e o `mapa.html` distribuem as 296 ideias em 35 peças, com o índice de códigos:
  - Plataforma do síndico: 189 ideias.
  - Console TRÍADE: 37.
  - Base comum: 36.
  - Fora do software: 34.
- A tecnologia foi aprovada (DC5) depois da leitura do sistema do T-shirt Club.
- Foram criados este arquivo, o painel de execução e o design do frontend.

**Próximo passo:** passo 0 (Fundação) em `triade-condo/sistema/`. Ver as entregas F0 no painel.

## Como trabalhar

- A cada entrega, no mesmo commit do código, atualizar o painel de execução:
  1. Mudar o status do item, com a evidência quando ficar "feito".
  2. Atualizar `meta`.
  3. Acrescentar uma linha no topo do histórico, com data e horário de Brasília.
- Este arquivo muda quando uma decisão é tomada ou quando a situação muda de fase.
- Ideia nova, ideia movida ou ideia renumerada: atualizar o `IDEIAS.md`, a contagem dele, o `SOBRE.md`, o `MAPA.md` e o `mapa.html`, como manda o `CLAUDE.md`.
- Textos e documentação em português do Brasil, escritos para quem usa o sistema.
