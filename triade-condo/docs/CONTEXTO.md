# Contexto do projeto — TRÍADE Condo

Resumo para quem continuar o trabalho (pessoa ou nova sessão do Claude). Atualizado em 16/10/2026 (horário de Brasília), com os passos 0 a 3 construídos.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| O que é a TRÍADE Condo (público, ideais, mercado, glossário) | `triade-condo/SOBRE.md` |
| Todas as ideias (296), com código por seção | `triade-condo/IDEIAS.md` |
| Onde cada ideia entra no sistema real (sistema, peça e forma) | `triade-condo/MAPA.md` e a versão visual `triade-condo/mapa.html` |
| Transparência do dinheiro (pesquisa e regras de tom) | `triade-condo/transparencia-do-dinheiro.md` |
| Painel de execução (fases, entregas, testes, publicação, dependências, decisões, histórico) | `triade-condo/docs/painel-execucao.html` |
| Design do frontend (base visual adotada, princípios, componentes, textos, telas a desenhar) | `triade-condo/docs/design-frontend.html` |
| Tema e navegação reutilizáveis dos documentos HTML | `triade-condo/docs/tema-triade.css` e `triade-condo/docs/navegacao-triade.js` |
| Notas e prévias da base visual (valores extraídos da referência) | `triade-condo/docs/design/` |
| Instruções para toda sessão do Claude | `CLAUDE.md` (raiz do repositório) |
| Planejamento, protótipos e pesquisas antigos (só consulta) | `arquivo/` |
| Código do sistema (como rodar, como a base funciona, tabela nova passo a passo) | `triade-condo/sistema/` e o `README.md` dele |
| CI (lint, tipos, testes, banco, ponta a ponta, segredos) | `.github/workflows/ci.yml` (raiz do repositório) |

O `arquivo/` **não é base de construção**: o que for útil de lá entra primeiro no `IDEIAS.md`.

## Decisões fechadas

As mesmas decisões estão no painel de execução (DC1 a DC11). Mudar qualquer uma atualiza primeiro este arquivo e o painel.

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
- **DC11 · Paleta e tipografia definidas (Carolina, 16/10/2026).**
  - Seguem a interface do produto Lattice nas referências fornecidas: fonte Inter, neutros frios, destaque lilás e cores de status em fundo suave com detalhe forte.
  - Verde-petróleo nas ações da Plataforma do síndico e violeta no Console TRÍADE.
  - A Plataforma usa barra superior com busca e menu branco flutuante. O Console usa lateral contínua com grupos e a identificação "Console TRÍADE · Admin".
  - Os valores estão no `design-frontend.html`, na seção "Base adotada". Não tratar como provisórios.
  - A marca Lattice não faz parte da identidade da TRÍADE. O logo oficial continua pendente.

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
| Ligar as configurações de login no painel do Supabase (triade-condo-dev), ajustar os modelos de e-mail de recuperação e convite, cadastrar a primeira administração e criar os projetos na Vercel | TRÍADE | Conferir o login e o convite de verdade (F0.6, F1.5) e publicar o passo 1 |
| Logo oficial (a paleta e a tipografia já estão definidas, DC11) e aprovação do tom das mensagens | TRÍADE | Nada no código; o símbolo triangular atual é provisório |
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

**16/10/2026.** A Carolina entregou a nova base visual. A paleta e a tipografia foram adotadas (DC11). O design do frontend e o painel de execução ganharam navegação lateral, busca e tema claro ou escuro, sem mudar os dados do painel.

**16/10/2026, madrugada.** O passo 0 (Fundação) foi construído em `triade-condo/sistema/`.

- Monorepo com a Plataforma do síndico e o Console TRÍADE.
- Banco com RLS forçado, privilégios fechados e cada condomínio separado pelo contexto da sessão.
- Histórico só de inserção, guardião de transições, controle de versão, relógio da aplicação, vínculos e permissão.
- Login com autenticador obrigatório para a equipe e recuperação neutra; proteção do servidor; CI.
- Testes T1 a T5 passando localmente.
- Ainda abertos: a primeira execução verde do CI no GitHub (F0.9) e a conferência do login com um Supabase de verdade (F0.6, depende do E3).

No mesmo dia foi criado o projeto Supabase de desenvolvimento `triade-condo-dev` (São Paulo, plano gratuito, ref `dzwkxiimwprftgulhoqn`), com todas as migrations aplicadas e sem avisos do verificador de segurança.

**16/10/2026, madrugada.** Começou o passo 1 (Console TRÍADE). Ficaram prontos no banco e na API:

- Funções internas (administração, implantação, financeiro, suporte), cada uma só nos clientes atribuídos.
- Carteira com estágio e situações a tratar.
- Ficha do condomínio, com número institucional único.
- Cenário do prédio.
- Convite do síndico pelo Supabase Auth.
- Notas internas que o síndico nunca lê.
- Histórico administrativo.

A migration 0060 foi aplicada no `triade-condo-dev`. As telas foram desenhadas no `design-frontend.html` e esperam aprovação antes do código, como manda a regra de design.

No mesmo dia, com o desenho aprovado pela Carolina, as telas do passo 1 foram construídas no Console:

- entrar com o autenticador;
- carteira;
- cadastro com cenário;
- ficha com abas;
- convite do síndico;
- equipe;
- notas internas;
- histórico;
- pessoas e funções.

A Plataforma ganhou a página onde o síndico convidado cria a senha. Os testes ponta a ponta rodam com axe no celular e no computador.

**16/10/2026, manhã.** Começou o passo 2 (configurações na Plataforma do síndico). Ficaram prontos no banco e na API:

- Painel só do próprio condomínio, com o que falta configurar.
- Fuso, horários de funcionamento e de atendimento com vários intervalos por dia, e feriados.
- Categorias, prioridades com significado, etapas e modelos de resposta. Todos nascem pelo cenário e têm identificador estável.
- Prazos de retorno em horas de atendimento, pulando feriados.
- Pessoas autorizadas com permissões individuais. O cargo não dá permissão.
- Quem atende os pedidos, com o responsável padrão da fila.

A migration 0070 ainda não está no `triade-condo-dev`. A aplicação pela ferramenta do Supabase passou do limite de 60 segundos e nada foi gravado; falta aplicá-la de outro jeito (por exemplo, `supabase db push`).

Decisões deste passo:

- Autorizar pessoas e escolher quem atende ficam só com o síndico.
- Só se dá permissão de recurso que já existe.
- Sem horário de atendimento, o prazo conta em horas corridas e o painel avisa.

As nove telas foram desenhadas no `design-frontend.html`, aprovadas pela Carolina e construídas na Plataforma no mesmo dia. Decisão de design: nenhuma tela usa emoji nem emoticon. Os selos mostram palavra e uma forma desenhada em SVG, e o teste ponta a ponta confere que não aparece emoji.

**16/10/2026, tarde.** Começou o passo 3 (moradores e unidades). Ficaram prontos no banco e na API:

- Blocos opcionais e unidades, que não se apagam: são desativados.
- Contato com cadastro breve (nome e telefone, sem CPF). Cada unidade tem vários contatos, um deles o principal, com relação e preferência de comunicados. O mesmo contato pode estar em mais de uma unidade.
- Vínculo do contato com a unidade, pendente ou confirmado. Só o confirmado pelo síndico vale; o pendente não acessa nada.
- O telefone sozinho não prova quem é: número repetido só gera aviso, e a busca pelo telefone devolve todas as unidades.
- Mudança numa operação: quem sai e quem entra.
- Importação de planilha CSV, tudo ou nada, com os contatos a confirmar.
- Remoção de nome e telefone de quem não está mais em nenhuma unidade.

A migration 0080 também ainda não está no `triade-condo-dev`. As oito telas foram desenhadas no `design-frontend.html`, aprovadas pela Carolina e construídas no mesmo dia, com três decisões:

- o CF-03 ganhou a permissão "Cadastrar moradores": a pessoa autorizada inclui e corrige, e o que ela inclui fica a confirmar pelo síndico;
- a planilha é importada em CSV;
- todo contato importado nasce a confirmar.

No mesmo dia, a pedido da Carolina, o prédio passou a se organizar do jeito dele: por torre, bloco, quadra ou prédio (ou sem divisão), com ou sem andar. A unidade aparece como "Torre A · 3º andar · 302". O síndico cadastra morador ou proprietário (condômino) pela lista, escolhendo torre, andar e unidade, e a planilha aceita a coluna andar. A ideia MU-01 foi atualizada.

Depois, também a pedido da Carolina e para controle: quando a unidade tem inquilino, o proprietário do imóvel fica no cadastro. O inquilino entra junto com o proprietário (pessoa nova ou já cadastrada), que não é o contato principal e não recebe os comunicados do dia a dia. Na mudança, se entra inquilino ou sai o proprietário, o novo proprietário entra junto. A planilha não barra: a unidade com inquilino e sem proprietário vira pendência no Início, no filtro da lista e na ficha. MU-01 atualizada de novo.

**Próximo passo:**

1. Aplicar as migrations 0070 e 0080 no `triade-condo-dev`.
2. Conferir login e convite com o Supabase Auth de verdade (F0.6, F1.5).
3. Publicar na Vercel (E4).
4. Liberar o CI (F0.9).
5. Começar o passo 4 (pedidos no painel) pelo desenho das telas.

## Como trabalhar

- A cada entrega, no mesmo commit do código, atualizar o painel de execução:
  1. Mudar o status do item, com a evidência quando ficar "feito".
  2. Atualizar `meta`.
  3. Acrescentar uma linha no topo do histórico, com data e horário de Brasília.
- Este arquivo muda quando uma decisão é tomada ou quando a situação muda de fase.
- Ideia nova, ideia movida ou ideia renumerada: atualizar o `IDEIAS.md`, a contagem dele, o `SOBRE.md`, o `MAPA.md` e o `mapa.html`, como manda o `CLAUDE.md`.
- Textos e documentação em português do Brasil, escritos para quem usa o sistema.
