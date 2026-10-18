# Contexto do projeto — TRÍADE Condo

Resumo para quem continuar o trabalho (pessoa ou nova sessão do Claude). Atualizado em 18/10/2026 (horário de Brasília), com os passos 0 a 4, 4b, 6 e 7, a Agenda, a Manutenção e Comunicados e documentos construídos.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| O que é a TRÍADE Condo (público, ideais, mercado, glossário) | `triade-condo/SOBRE.md` |
| Todas as ideias (311), com código por seção | `triade-condo/IDEIAS.md` |
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

As mesmas decisões estão no painel de execução (DC1 a DC13). Mudar qualquer uma atualiza primeiro este arquivo e o painel.

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
- **DC11 · Paleta e tipografia definidas (Carolina, 16/10/2026).** Substituída pela DC13 em 17/10/2026; saiu do código com a parte A do plano de aplicação.
  - Seguem a interface do produto Lattice nas referências fornecidas: fonte Inter, neutros frios, destaque lilás e cores de status em fundo suave com detalhe forte.
  - Verde-petróleo nas ações da Plataforma do síndico e violeta no Console TRÍADE.
  - A Plataforma usa barra superior com busca e menu branco flutuante. O Console usa lateral contínua com grupos e a identificação "Console TRÍADE · Admin".
  - Os valores estão no `design-frontend.html`, na seção "Base adotada". Não tratar como provisórios.
  - A marca Lattice não faz parte da identidade da TRÍADE. O logo oficial chegou com a DC13.
- **DC12 · Domínio do sistema: `t3condo.trihub.com.br`** (Carolina, 17/10/2026). Vale para todo o sistema. Começa pelos e-mails, que saem pelo Resend como `nao-responda@t3condo.trihub.com.br`; os endereços da Plataforma e do Console vêm depois, com os subdomínios e o DNS.
- **DC13 · Identidade TRÍADE (Carolina, 17/10/2026).** Substitui a DC11.
  - Referência: `docs/identidade/sistema.html` (sistema de design), com as telas-modelo em `docs/identidade/telas-modelo.html` e a ordem de entrada no código em `docs/identidade/plano-aplicacao.html`.
  - Violeta da marca nas ações dos dois sistemas (sai o verde-petróleo da Plataforma); o Console se distingue pelo nome e pelo selo laranja "Admin". Laranja só como acento.
  - Botão principal em degradê com brilho (versão C), selos com faixa lateral e filtros no trilho (versão D com o brilho do C), paleta Brilho (neutros lavanda; jade, âmbar, rubi e petróleo).
  - Sempre claro: o tema escuro sai do código.
  - Manrope, Playfair Display itálico (só destaque) e IBM Plex Mono, servidas pelo próprio sistema; a CSP continua aceitando só fontes do próprio endereço.
  - Logo oficial: o violeta (letras violeta, torre laranja e triângulos violeta) é a assinatura do produto nas duas aplicações; o laranja fica para divulgação. Versão atual enviada pela Carolina em 18/10/2026, em `docs/identidade` (`logo-violeta.png`, `logo-laranja.png`, as versões grandes e o `simbolo.png`, que é o ícone da aba).

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
| E-mail próprio no Supabase Auth (E9): configurar o Resend como SMTP e pôr os modelos de convite e de recuperação em português, com `{{ .RedirectTo }}?token_hash={{ .TokenHash }}`. Sem SMTP próprio o Supabase não deixa editar os modelos; os links do modelo padrão já funcionam | Carolina | E-mails em nome da TRÍADE e sem o limite baixo do Supabase |
| Aprovação do tom das mensagens (o logo oficial já está no código desde 18/10/2026) | TRÍADE | Textos do WhatsApp (passo 5) |
| Dados da empresa para termos e privacidade (EM-01, EM-06) | TRÍADE | Publicação |
| Domínio próprio | TRÍADE | Publicação |
| Condomínio de teste com síndico disposto (NG-09) | TRÍADE | Teste dos passos 4 a 7 |

## Situação

**15/10/2026.** A fase de ideias terminou e a de construção foi liberada.

- O planejamento antigo foi arquivado em `arquivo/` e a pasta `triade-condo/` foi criada como o lugar onde nasce o sistema.
- O `IDEIAS.md` reúne 311 ideias em 22 seções. Elas foram conferidas contra todos os documentos do arquivo e contra as pesquisas brasileira e internacional. A classificação foi revisada duas vezes.
- O `MAPA.md` e o `mapa.html` distribuem as 311 ideias em 35 peças, com o índice de códigos:
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

As migrations 0070 e 0080 foram aplicadas no `triade-condo-dev` em 16/10/2026, em partes (0070_configuracoes_condominio_1 a _5 e 0080_moradores_unidades_1 a _5), porque a ferramenta do Supabase expira em 60 segundos com textos grandes e espera confirmação para SQL com `delete`. A comparação com o banco local deu igual em tabelas, restrições, índices, gatilhos, políticas e funções. As duas funções com `delete` (`plataforma_remover_feriado` e `plataforma_remover_prazo`) foram coladas pela Carolina no SQL Editor e conferidas. As Edge Functions `api-plataforma` e `api-console` foram publicadas no dev pela ferramenta do Supabase, cada uma num pacote só (o domínio e o `_shared` juntos), porque o token pessoal do Supabase não fica no GitHub (repositório público). Os sites estão na Vercel: Plataforma em `https://condominio.trihub.com.br` e Console em `https://t3condo.trihub.com.br` (desde 17/10/2026; antes, `plataforma-omega-five.vercel.app` e `console-hazel-nine.vercel.app`), com `SUPABASE_FUNCTIONS_URL` e `REPASSE_SEGREDO`. O login de ponta a ponta já responde pelas funções. Mudou alguma função? É preciso publicar de novo.

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

As oito telas foram desenhadas no `design-frontend.html`, aprovadas pela Carolina e construídas no mesmo dia, com três decisões:

- o CF-03 ganhou a permissão "Cadastrar moradores": a pessoa autorizada inclui e corrige, e o que ela inclui fica a confirmar pelo síndico;
- a planilha é importada em CSV;
- todo contato importado nasce a confirmar.

No mesmo dia, a pedido da Carolina, o prédio passou a se organizar do jeito dele: por torre, bloco, quadra ou prédio (ou sem divisão), com ou sem andar. A unidade aparece como "Torre A · 3º andar · 302". O síndico cadastra morador ou proprietário (condômino) pela lista, escolhendo torre, andar e unidade, e a planilha aceita a coluna andar. A ideia MU-01 foi atualizada.

Depois, também a pedido da Carolina e para controle: quando a unidade tem inquilino, o proprietário do imóvel fica no cadastro. O inquilino entra junto com o proprietário (pessoa nova ou já cadastrada), que não é o contato principal e não recebe os comunicados do dia a dia. Na mudança, se entra inquilino ou sai o proprietário, o novo proprietário entra junto. A planilha não barra: a unidade com inquilino e sem proprietário vira pendência no Início, no filtro da lista e na ficha. MU-01 atualizada de novo.

**16/10/2026, fim da tarde.** O e-mail próprio (Resend como SMTP, Site URL e modelos em português) ficou como tarefa da Carolina (E9). Começou o passo 4 (pedidos no painel). Ficaram prontos no banco (migration 0090) e na API:

- Registro com protocolo por condomínio e por ano ("2026-0001"), unidade ou local, contato confirmado e como o pedido chegou.
- Fila com filtros por situação, responsável, prioridade e categoria, atalhos do que pede atenção e há quanto tempo cada pedido está aberto.
- Responsável da lista de quem atende, que confirma o aceite e pode repassar; quem sai da lista passa os pedidos ao padrão.
- Próximo retorno separado da previsão de solução, os dois com motivo para mudar; retorno ao morador e nota interna.
- Pendências com tipo, motivo e quem cuida.
- Conclusão explicada, revisão e reabertura configuráveis, cancelamento com motivo.
- Pedido privado e histórico completo.

As permissões Acompanhar, Responder, Atualizar e Concluir passaram a valer. Onze telas foram desenhadas no `design-frontend.html`, com as decisões para aprovar (protocolo, quem faz o quê, privado, pendência na conclusão, anexos no passo 4b). A 0090 ainda não está no `triade-condo-dev`: a Carolina vai colar no SQL Editor, e depois a `api-plataforma` precisa ser publicada de novo.

No mesmo dia, a Carolina aplicou a 0090 no `triade-condo-dev` pelo SQL Editor e aprovou as telas e as decisões. O banco do dev foi conferido igual ao local, a `api-plataforma` foi publicada de novo (versão 2) e as onze telas foram construídas na Plataforma: Pedidos no menu e no Início, fila, registrar, a ficha do pedido com as ações, histórico e as regras nas configurações.

Decisões do passo 4:

- Protocolo por condomínio e por ano: 2026-0001.
- Acompanhar vê; Responder dá retorno; Atualizar registra e muda; Concluir conclui, reabre e cancela; revisar fica com o síndico. O responsável age no próprio pedido.
- Pedido privado: só o síndico, quem registrou e o responsável.
- Concluir pede as pendências resolvidas; cancelar fecha as abertas.
- Fotos e documentos no passo 4b; até lá, evidência em texto.

No fim do dia, dois ajustes pedidos pela Carolina. O link de nova senha (e o de convite) passou a funcionar também com o modelo padrão do Supabase, que manda o acesso depois do `#` no endereço; o servidor só aceita esse acesso se ele nasceu do mesmo tipo de link. E a Plataforma passou a seguir a estrutura de "Dois sistemas, uma família": busca no condomínio na barra superior e faixa lilás no alto. As duas Edge Functions foram publicadas de novo.

Em 17/10/2026 o sistema passou a ter e-mail e endereços próprios (DC12). E-mails pelo Resend, de `nao-responda@t3condo.trihub.com.br`, com os modelos de `supabase/templates`. Plataforma em `https://condominio.trihub.com.br` e Console em `https://t3condo.trihub.com.br`. No Supabase, a Site URL é a da Plataforma, as URLs de redirecionamento são `https://condominio.trihub.com.br/**` e `https://t3condo.trihub.com.br/**`, e os segredos `PLATAFORMA_URL` e `CONSOLE_URL` das funções apontam para os dois endereços. A Carolina conferiu a nova senha e o convite pelos links dos e-mails. As telas seguem sempre o tema claro do design-frontend.html, mesmo com o aparelho no modo escuro; o escuro só entra com `data-theme="dark"`.

Passo 4b (F4.8), fotos e documentos dos pedidos, aprovado e construído em 17/10/2026. A migration 0100 guarda os arquivos (`arquivos_pedido`) e cria o bucket privado `pedidos`, sem nenhuma política de acesso: só a API, com a chave de serviço, lê e grava. O navegador envia direto para o armazenamento por um link de envio que a API gera depois de o banco conferir quem envia, o tipo, o tamanho e o limite (10 MB, 30 por pedido). Depois do envio, a API confere o conteúdo pelos primeiros bytes, tira a localização das fotos (o GPS do EXIF é zerado e a orientação fica; XMP, IPTC e textos saem), recusa PDF com script ou arquivo embutido e só então libera. Abrir e baixar usam link de 5 minutos. Tirar do pedido pede motivo e não apaga. A CSP da Plataforma libera só `https://<projeto>.supabase.co/storage/v1/object/` em `connect-src` e `img-src`. Vídeo e áudio ficam para o WhatsApp (passo 5).

Passos 6 e 7 (F6.1, F6.2, F7.1, F7.2), prazos, avisos e o início do dia, sem WhatsApp, aprovados pela Carolina e construídos em 17/10/2026. A migration 0120 (aplicada pela Carolina no triade-condo-dev; api-plataforma versão 8 publicada) cria os avisos dentro do painel e a conferência de prazos, que o próprio banco roda a cada 5 minutos pelo pg_cron (`verificar_prazos`). Retorno vencido avisa o responsável na hora (sem responsável, o síndico); se continuar vencido, o aviso sobe para o síndico e depois para o substituto escolhido, uma pessoa autorizada (padrão 2 h e 8 h de atendimento, cada condomínio muda em Configurações › Prazos e avisos). Também avisam o pedido sem responsável (4 h) e a pendência parada (3 dias). As horas contam só o horário de atendimento e pulam feriados; etapa que pausa o prazo pausa o aviso; ninguém recebe o mesmo aviso duas vezes; cada aviso vai para o histórico do pedido, sem nome do morador. Ver o aviso não resolve o pedido: o vencimento só acaba com o retorno ao morador. O início mostra o Agora (vencidos, o que vence hoje, para aceitar, sem responsável, pendências paradas) e o mês fechado, fixo. A tela Indicadores mostra a porcentagem de retornos no prazo (registrado antes do retorno combinado vencer; vencido sem retorno conta como fora do prazo), o primeiro retorno, concluídos e reabertos, por categoria; sem caso no período, "sem dados", nunca zero.

Identidade TRÍADE aprovada pela Carolina em 17/10/2026 (DC13): sistema de design em `docs/identidade/sistema.html` (botão C, selos com faixa, paleta Brilho, Manrope e Playfair, sempre claro, violeta nos dois sistemas) e plano de aplicação em três partes. As cinco telas-modelo (`docs/identidade/telas-modelo.html`) foram aprovadas e a parte A entrou no código: `packages/ui/src/tema.css` com a paleta Brilho e sem tema escuro, fontes servidas pelo próprio sistema (Fontsource) e os componentes base no novo desenho, mais `Chip`, `Trilho` e `Icone`. A parte A foi juntada (PR 8). A parte B trouxe a moldura da Plataforma das telas-modelo (lateral clara, barra superior com sino e pessoa), a tela de entrar com a arte da marca nos dois sistemas, o início em degradê, os filtros no trilho e um botão principal por tela. A parte C levou a mesma moldura ao Console e tirou do código os nomes de cor da base antiga; o teste `packages/ui/src/tema.test.ts` impede cor escrita direto nas telas.

Agenda (peça R7; AG-01 a AG-05, AG-07 a AG-09, MP-04) aprovada pela Carolina e construída em 17/10/2026, no desenho de `docs/telas/agenda.html`. A migration 0130 cria as permissões Ver a agenda e Cuidar da agenda (o síndico tem as duas; as pessoas autorizadas recebem do síndico), os compromissos (reunião, visita técnica, atividade programada e lembrete; planejado, a confirmar, confirmado, realizado e cancelado, e os dois últimos não voltam) e as séries de repetição (toda semana, a cada 2 semanas ou a cada N meses, até uma data ou por um número de vezes, no máximo 2 anos; no mês sem o dia, o último dia). Conflito é horário que se sobrepõe no mesmo lugar ou com a mesma pessoa autorizada: aparece ao salvar e no compromisso, e a pessoa pode salvar mesmo assim; quem é de fora, escrito à mão, não entra na conta. Num compromisso que se repete, mudar vale para só esta data ou para esta e as próximas, que viram uma série nova; as datas que já passaram nunca mudam. Reagendar e cancelar pedem motivo e deixam a data anterior no histórico. A agenda fica separada do atendimento: o pedido mostra a visita ligada e avisa quando ela cai depois da previsão de solução, sem mudar nada sozinho. Os feriados das Configurações entram tracejados para quem vê as configurações. Telas: Agenda (lista, semana e mês, filtro por tipo guardado no aparelho), compromisso aberto, Na agenda no pedido (com Marcar visita) e Hoje na agenda no início. A 0130 está no `triade-condo-dev` e a `api-plataforma` versão 9, com as rotas da agenda, foi publicada no mesmo dia; o PR 11 foi juntado ao `main`. Os lembretes no WhatsApp a quem participa (AG-06) ficam para o passo 5.

Manutenção e prestadores (peça R6; MP-01 a MP-05, MP-07, MP-09 em parte e MP-13) aprovada pela Carolina e construída em 17/10/2026, no desenho de `docs/telas/manutencao.html`. A migration 0140 cria as permissões Ver a manutenção e Cuidar da manutenção (o síndico tem as duas), o cadastro de prestadores do condomínio (com contrato e vigência, ou por chamado; reserva indicada; arquivar não apaga; registrar não é contratar), as manutenções (corretiva, preventiva e vistoria; planejada, em andamento, pendente, concluída e cancelada, com etapas por condomínio nas Configurações), as providências com o resultado, a lista de cada vistoria (certo, problema ou não deu; o item com problema vira uma corretiva ligada), as preventivas (a manutenção abre sozinha alguns dias antes, padrão 15; a próxima data conta da data prevista) e as fotos e documentos no bucket privado `manutencoes`, com as regras dos pedidos. A manutenção fica separada do pedido: ligar é opcional, concluir não encerra o pedido e cancelar a visita não apaga a manutenção. O retorno vencido avisa o responsável no sino uma vez por vencimento (a rotina `verificar_manutencao` roda de hora em hora no pg_cron e também abre as preventivas). A visita marcada a partir da manutenção fica ligada a ela, e as preventivas entram na agenda tracejadas. Telas: Manutenção (lista com atalhos), manutenção aberta com vistoria, Preventivas com sugestões da NBR 5674 que só entram se escolhidas, Prestadores e a ficha, Manutenção ligada no pedido, cartão no início e aba Manutenção nas Configurações. A 0140 foi aplicada pela Carolina no `triade-condo-dev` e conferida, e a `api-plataforma` versão 10, com as rotas da manutenção, está publicada; o PR 12 foi juntado ao `main`. Ficam para depois, com o motivo no desenho: avaliação pelos moradores (MP-06), troca automática para a reserva (MP-09), agrupar chamados (MP-10), dano por morador (MP-11), construtora (MP-15, V-13) e plano de longo prazo com gastos (MP-16).

Comunicados e documentos (peça R1; CD-01, CD-02, CD-04, CD-05, CD-06 em parte, CD-07, CD-09, CD-11 e MP-12 em parte) aprovada pela Carolina e construída entre 17 e 18/10/2026, no desenho de `docs/telas/comunicados.html`. A migration 0150 cria as permissões Ver comunicados e documentos e Cuidar dos documentos (a permissão Publicar, que já existia, passa a valer para os comunicados; o síndico tem as três). O comunicado nasce rascunho, pode ser programado e é publicado; publicado não se edita: corrigir pede o que mudou e cria a versão seguinte, e a anterior fica como substituída, com o texto guardado; arquivar pede motivo e nada é apagado. Para quem: todo o condomínio, blocos, unidades ou contatos escolhidos; recebe quem tem vínculo confirmado e "recebe comunicados" ligado, e assembleia e convocação também chega ao proprietário que não recebe o dia a dia. A conta é refeita a cada vez (na publicação fica guardado quantos eram) e a tela mostra as unidades sem ninguém. Sem WhatsApp, o comunicado sai copiado para o grupo do prédio ou impresso para o mural (`/mural`), e os dois ficam no histórico; os publicados antes do passo 5 não são reenviados sozinhos. A rotina `verificar_comunicados` roda a cada 5 minutos no pg_cron: publica os programados e avisa no sino quem cuida dos documentos quando um documento está a 60 dias do fim da validade. Fotos e PDF do comunicado (até 4) ficam no bucket privado `comunicados`; os documentos (convenção, regimento, ata, contrato, laudo e certificado, orçamento anual, outro) têm versões no bucket privado `documentos`, até 20 MB, com a data em que cada uma passa a valer, quem vê (a gestão ou só quem cuida dos documentos) e a marca "pode ir ao morador" guardada para o passo 5; abrir e baixar ficam no histórico do documento. O plano de comunicação (assuntos em uso, o combinado com os moradores, a assinatura e o horário sem envio) fica em Configurações › Comunicados. A 0150 foi aplicada pela Carolina no `triade-condo-dev` em 18/10/2026 e conferida, e a `api-plataforma` versão 11, com as rotas dos comunicados e documentos, está publicada; o PR 13 junta a peça ao `main`. Ficam para depois, com o motivo no desenho: acompanhar recebimento (CD-08) e campanhas, que esperam o WhatsApp; carta de convocação (CD-10); e as funções de IA (IA-05 a IA-07, peça R14).

Mural online e e-mail (R1b; CD-12, CD-13, CD-14) aprovados pela Carolina e construídos em 18/10/2026, no desenho de `docs/telas/mural-email.html`. A migration 0160 cria o mural do prédio: um link sem conta (`/m/<código>`, com 12 caracteres sem os que se confundem) e um cartaz com QR, só com os comunicados publicados para todo o condomínio e marcados no mural (segurança começa fora), sem nomes, telefones ou unidades; trocar o link pede motivo e o antigo para na hora; as aberturas são contadas por dia sem saber quem abriu. O contato ganha um e-mail opcional, que só a própria pessoa confirma por um link de 7 dias; "parar de receber" só ela desfaz. Com o e-mail ligado no condomínio (começa desligado), publicar põe na fila quem recebe e tem e-mail confirmado, respeitando o horário sem envio; corrigir só reenvia se pedirem. A api-plataforma pega lotes da fila, manda pelo Resend (de `nao-responda@t3condo.trihub.com.br`, em nome do condomínio) e devolve o resultado; o aviso do provedor (entregue, devolvido, spam) só vale com assinatura válida e desliga o e-mail que voltou ou virou spam, com aviso no sino. Cada e-mail leva um link pessoal (`/c/<código>`, 90 dias, vale enquanto a pessoa for contato de uma unidade) e o parar de receber em um clique. Documento que pode ir ao morador vai por link de 7 dias que pode ser cancelado (`/d/<código>`); o pedido pelo mural tem resposta neutra, contato confirmado recebe na hora (ou com aprovação) e outro e-mail espera em "Pedidos por e-mail". Os links sem conta guardam só o hash do código. Para ligar: aplicar a 0160; gravar na função `RESEND_API_KEY` e `RESEND_WEBHOOK_SECRET` (e, se quiser outro remetente, `EMAIL_REMETENTE`); gravar no Vault do Supabase `api_plataforma_url` (endereço da função api-plataforma) e `repasse_segredo` (o mesmo segredo de repasse), para a rotina `enviar-emails` chamar a fila a cada 2 minutos; cadastrar no Resend o aviso (webhook) para `.../functions/v1/api-plataforma/v1/email/eventos` com entregue, devolvido e spam. A 0160 foi aplicada pela Carolina no `triade-condo-dev` em 18/10/2026 e conferida, e a `api-plataforma` versão 12 está publicada. Antes de ligar o e-mail num prédio de verdade, trocar o plano gratuito do Resend (100 e-mails por dia). Ficam para depois: mural pessoal permanente, pedir documento pelo WhatsApp (CD-03), saber quem leu (CD-08) e carta formal (CD-10).

Links e QR (peça R13; AT-30, MP-08, V-11) aprovados pela Carolina e construídos em 18/10/2026, no desenho de `docs/telas/links-qr.html`. A migration 0170 cria as etiquetas por local: cada uma é um local com um QR que aponta para o sistema (`/l/<código>`, 12 caracteres sem os que se confundem, guardados para reimprimir como o do mural), não direto para o WhatsApp, e numeradas no condomínio (E01, E02…). A página da etiqueta abre sem conta e mostra só o nome do condomínio, o local, o código curto e o recado do síndico (some sozinho na data escolhida, no máximo 30 dias), com o botão que abre o WhatsApp do condomínio (o número cadastrado na implantação; sem número, não há etiqueta) com a mensagem começada e o local escrito, e o lembrete de ligar 193 em emergência; as aberturas são contadas por dia sem saber quem abriu. Trocar o código e desativar pedem motivo e o código velho para na hora. Os locais das etiquetas viram sugestão no campo Local de pedidos, manutenção e agenda. Configurações › Links e QR mostra tudo o que abre sem conta (mural, etiquetas, links de prestador e documentos por e-mail) e imprime as etiquetas em folha A4 com 6 ou uma por folha (`/etiquetas`). Na manutenção com quem executa escolhido (prestador do cadastro ou nome escrito à mão), "Mandar link" gera um link só para aquele serviço (`/p/<código>`, código longo guardado só embaralhado, que aparece uma vez), válido até a data escolhida (padrão 14 dias, no máximo 60) e enquanto a manutenção estiver aberta; mandar de novo gera link novo e cancelar pede motivo. O link sai pelo WhatsApp ou pelo e-mail de quem manda, com a mensagem pronta. O prestador vê só o que foi escrito para ele (o que fazer, local, quando, como entrar e os arquivos marcados), registra a chegada lendo a etiqueta com a câmera (a etiqueta do local da manutenção confirma; sem etiqueta ou com outra, fica informada; sem GPS; a câmera só é liberada nas páginas `/p/`), conta se não conseguiu fazer e conta o que fez, com até 10 fotos conferidas como as dos pedidos. Isso vai para o histórico da manutenção e avisa o responsável no sino; a situação não muda sozinha. Para ligar: aplicar a 0170 e publicar a `api-plataforma` com as rotas novas. Ficam para depois: proposta do fornecedor por link (OC-03, com Orçamentos e compras), plaquinha de chegada (PA-06) e perfil do visitante (V-12), com a Portaria (R11) e o WhatsApp, e o pedido aberto sozinho pela etiqueta, com o WhatsApp oficial.

**Próximo passo:**

1. Links e QR (R13): a Carolina aplica a 0170 no `triade-condo-dev`; depois, publicar a `api-plataforma` versão 13 e juntar ao `main`.
2. Mural online e e-mail (R1b): a 0160 está aplicada e a `api-plataforma` versão 12 publicada; falta a Carolina gravar os segredos do e-mail (na função e no Vault, como descrito acima) e cadastrar o aviso do Resend (o PR 14 já foi juntado ao `main`). Antes de ligar o e-mail num condomínio de verdade, trocar o plano gratuito do Resend.
3. Com a Carolina: conferir Comunicados e documentos e a Manutenção no `condominio.trihub.com.br` (os PRs 12 e 13 foram juntados ao `main`).
4. Com a Carolina: conferir a Agenda no `condominio.trihub.com.br` e testar com pedidos de verdade no Águas Claras (E8), incluindo um envio de foto (4b) e os avisos de prazo (6 e 7). A produção da Vercel sai do `main`, que já tem tudo até Comunicados e documentos.
5. Com a Carolina, liberar o CI (F0.9).
6. O passo 5 (WhatsApp) espera o provedor (E1); o aviso no WhatsApp do síndico (W-11) e os lembretes da agenda (AG-06) usam as regras que já existem quando o canal chegar.

## Como trabalhar

- A cada entrega, no mesmo commit do código, atualizar o painel de execução:
  1. Mudar o status do item, com a evidência quando ficar "feito".
  2. Atualizar `meta`.
  3. Acrescentar uma linha no topo do histórico, com data e horário de Brasília.
- Este arquivo muda quando uma decisão é tomada ou quando a situação muda de fase.
- Ideia nova, ideia movida ou ideia renumerada: atualizar o `IDEIAS.md`, a contagem dele, o `SOBRE.md`, o `MAPA.md` e o `mapa.html`, como manda o `CLAUDE.md`.
- Textos e documentação em português do Brasil, escritos para quem usa o sistema.
