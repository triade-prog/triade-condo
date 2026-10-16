# Sistema TRÍADE Condo

Código dos dois sistemas da TRÍADE Condo (DC1): a **Plataforma do síndico** e o **Console TRÍADE**. As decisões estão em [`../docs/CONTEXTO.md`](../docs/CONTEXTO.md). O andamento está em [`../docs/painel-execucao.html`](../docs/painel-execucao.html). As ideias que cada parte atende estão no [`../IDEIAS.md`](../IDEIAS.md) e no [`../MAPA.md`](../MAPA.md).

A tecnologia é a mesma do T-shirt Club (DC5). Do T-shirt vieram só as peças genéricas (DC6), adaptadas a vários condomínios.

## Estrutura

```
apps/plataforma     Plataforma do síndico (Next.js 16, porta 3000)
apps/console        Console TRÍADE (Next.js 16, porta 3001)
packages/domain     regras puras em TypeScript: dinheiro, erros, textos, esquemas, logs limpos
                    (roda no Node e no Deno)
packages/ui         tema (DC11) e componentes React
packages/servidor   cabeçalhos de segurança, CSP com nonce e o repasse /api
supabase/           migrations, Edge Functions (Deno + Hono) e testes pgTAP
tests/e2e           Playwright com axe, no celular e no computador
scripts/            banco de teste e Deno
```

## Como a base funciona (passo 0)

- **Só o servidor acessa o banco.**
  - O navegador fala só com o próprio app.
  - O app repassa `/api` para a Edge Function do sistema, com um segredo que só o servidor conhece.
  - A Edge Function só chama funções do banco. Nem a chave de serviço lê as tabelas direto.
- **O condomínio é o dono de todo dado (PT-01).**
  - Toda tabela de dado de condomínio tem `condominio_id` e a política `isolamento_condominio`. Só aparece o que é do condomínio que está no contexto da transação.
  - O contexto é gravado por `entrar_condominio`, e só depois de conferir o vínculo e a permissão.
  - Na Plataforma, o condomínio vem da sessão no servidor (`escolher_condominio`), nunca do que o navegador manda.
- **A permissão é dada por pessoa + função + condomínio + ação, e nega por padrão (PT-02).**
  - Quem pode o quê fica em `funcao_acoes`.
  - Cada linha entra junto com a funcionalidade que a usa (DC8).
- **O histórico é só de inserção (PT-03).**
  - O autor vem do contexto.
  - Senha, token e dado pessoal são recusados.
- **Mudança de estado passa pelo guardião.**
  - Só valem as transições cadastradas.
  - Cada mudança precisa de um evento e de um autor, e vai para o histórico na mesma transação.
- **Edição simultânea (AT-24).**
  - Cada tabela com `versao` filtra pela versão que a pessoa leu.
  - No conflito, a resposta traz a versão nova sem perder o que foi escrito.
- **Relógio da aplicação.** Toda hora vem de `app_now()`. Os testes adiantam o relógio para conferir prazos.
- **Dinheiro (PT-09).** Os valores ficam em centavos inteiros (`centavos`) com a moeda (`moeda`). No TypeScript, use `packages/domain/src/dinheiro.ts`.
- **Login (PT-08).**
  - O login usa o Supabase Auth, com e-mail verificado.
  - O autenticador é obrigatório para a equipe no Console e opcional para o síndico.
  - Há limite de tentativas.
  - A recuperação de senha responde sempre a mesma coisa, exista a conta ou não.
  - Depois de redefinir a senha, todas as sessões caem.

### Tabela nova, passo a passo

1. Crie a tabela com `condominio_id uuid not null references condominios (id)`. Se a pessoa edita o registro, inclua `versao integer not null default 1`. Se ele tem estado, inclua `estado`.
2. Chame `call proteger_tabela_condominio('<tabela>')`. Ela liga o RLS, cria a política de isolamento e o controle de versão. Se houver `estado`, chame também `call ligar_guardiao('<tabela>')` e cadastre `estados_iniciais` e `transicoes_permitidas`.
3. Escreva as funções da API como `security definer`. Cada uma recebe `p_pessoa` e `p_condominio` validados pela sessão e começa com `perform entrar_condominio(p_pessoa, p_condominio, '<recurso.acao>')`.
4. Termine a migration com `call fechar_acesso();`.
5. Nomeie os testes de cada regra com o código da ideia (DC9).

Se a tabela não tiver condomínio, ela precisa de um motivo em `tabelas_sem_condominio`. Sem o motivo, o teste `001_acesso_rls_test.sql` falha.

## Console TRÍADE (passo 1)

- **Funções internas (PI-10).**
  - Há quatro: administração, implantação, financeiro e suporte. Uma pessoa pode acumular funções (`equipe_funcoes`).
  - Em cada cliente atribuído, a pessoa tem um vínculo com uma das funções que tem. Ela só age nesse cliente.
  - Tirar a função faz as atribuições dela pararem na hora, sem apagar nada.
  - O que cada função faz está em `funcao_acoes`, com ações `console.*`. Por exemplo, implantação não muda contrato, e financeiro e suporte só consultam a ficha e escrevem notas.
- **O que o cliente nunca vê (PI-06).**
  - A carteira (`clientes`) e as notas internas (`notas_internas`) são tabelas internas, criadas com `proteger_tabela_interna`.
  - A política delas exige o condomínio do contexto e alguém da equipe ativa.
  - Eventos dessas tabelas entram no histórico com `interno = true`, que o síndico não lê.
- **A ficha é do condomínio (CF-01).** Endereço, contatos, número institucional (único por condomínio, W-01) e cenário ficam em `condominios`.
- **Convite (CF-02).**
  - A Edge Function convida pelo Supabase Auth. O banco confere a permissão antes de o convite sair.
  - Quem já tem conta (síndico profissional, MU-04) não recebe e-mail: o acesso aparece no próximo login.
  - O convidado cria a senha em `/convite` do app (`POST /v1/auth/criar-senha`).
- **As telas** seguem o desenho aprovado em `../docs/design-frontend.html` ("Telas do passo 1"):
  - Ficam em `apps/console/src/telas`, e as rotas em `apps/console/src/app`.
  - Os componentes base (campos, selos, avisos, vazio, erro, carregando, janela e o cliente da API) ficam em `packages/ui`.
  - Os testes ponta a ponta usam uma API falsa no navegador (`tests/e2e/api-falsa.ts`).

### Primeira pessoa da equipe

A primeira pessoa com administração entra uma vez, pelo SQL do Supabase. Depois disso, a equipe cresce pelo Console.

1. Crie a conta em Authentication → Users → Invite user.
2. Rode o SQL abaixo com o id da conta criada:

```sql
call iniciar_equipe('<id da conta no Auth>', 'Nome da pessoa');
```

## Plataforma do síndico (passo 2)

- **Pessoas autorizadas (V-09, CF-03).**
  - A secretária, o subsíndico ou o conselho têm um vínculo `AUTORIZADO`. Com ele, só veem o painel e as configurações.
  - O cargo é só um rótulo. O resto vem de permissões individuais (`vinculo_permissoes`), que valem pelas ações de `permissao_acoes`.
  - Só se dá permissão de recurso que já existe. Hoje é só `CONFIGURAR`; as outras ganham ação com os passos seguintes.
  - Retirar uma permissão grava a retirada e não apaga a linha. O efeito é imediato.
- **Configuração pronta (CF-12).**
  - Todo condomínio nasce configurado. O gatilho `condominios_modelo_configuracao` chama `aplicar_modelo_configuracao`.
  - Trocar o cenário só acrescenta o que falta.
  - Nada é obrigatório. `pendencias_configuracao` diz ao painel o que ainda falta.
- **Identificador estável (CF-09).** Categoria, prioridade, etapa e modelo de resposta não se apagam: mudam de nome ou são desativados. A situação e a categoria de uma etapa não mudam depois de criadas.
- **Prazos (AT-10).**
  - `horas_de_prazo` escolhe a regra mais específica: prioridade e categoria juntas, depois só a prioridade, depois só a categoria, depois a regra geral.
  - `vencimento_do_prazo` conta só as horas de atendimento, no fuso do condomínio, pulando os feriados.
- **Feriado (CF-10).** O banco guarda só a data e a API devolve `aaaa-mm-dd`. A tela mostra a data como foi escrita, sem fuso.
- **Rotas.**
  - Todas ficam em `/v1/condominio/...` (painel, configuracoes, fuso, horarios, feriados, categorias, prioridades, etapas, modelos, prazos, pessoas, atendimento).
  - Pessoa e condomínio vêm sempre da sessão.
- **Telas.** Seguem o desenho aprovado em `../docs/design-frontend.html` ("Telas do passo 2").
  - Ficam em `apps/plataforma/src/telas`, e as rotas em `apps/plataforma/src/app`.
  - Abas, aviso de conflito e selos com forma em SVG ficam em `packages/ui`.
  - Nenhuma tela usa emoji nem emoticon; o teste ponta a ponta confere.
  - Os testes ponta a ponta usam `tests/e2e/api-falsa-plataforma.ts`.

## Moradores e unidades (passo 3)

- **Blocos e unidades.**
  - Blocos (torre, quadra) são opcionais. A identificação da unidade é livre ("101", "Casa 12") e única entre as ativas do bloco.
  - Nada se apaga. Bloco e unidade só são desativados quando não têm nada ativo dentro.
  - `chave_unidade` (banco) e `chaveUnidade` (domínio) dão a mesma ordem natural. `gerarUnidades` monta a numeração por andar.
- **Contatos (MU-01, MU-08).**
  - O contato não tem login. O cadastro é breve: nome e telefone (`+55...`), sem CPF.
  - `contatos_unidade` liga o contato à unidade, com relação, principal (um por unidade) e preferência de comunicados. O mesmo contato pode estar em mais de uma unidade.
- **Confirmação (MU-02, MU-03).**
  - O vínculo passa pelo guardião: `PENDENTE`, `CONFIRMADO` ou `ENCERRADO`. Só o confirmado vale.
  - Quem pode confirmar inclui já confirmado. O que vem da planilha nasce pendente.
  - `unidades_do_telefone` devolve só vínculos confirmados, todos eles. O WhatsApp (passo 5) pergunta qual unidade quando houver mais de uma.
  - Telefone repetido em outro contato só gera aviso (`TELEFONE_COMPARTILHADO`).
- **Mudança (MU-07).** `plataforma_registrar_mudanca` encerra quem sai e cria quem entra numa só transação. Vínculo encerrado não volta nem muda.
- **Planilha (F3.3).**
  - `lerPlanilhaMoradores` lê o CSV no navegador e aponta a linha de cada erro.
  - `plataforma_importar_moradores` grava tudo ou nada.
- **Dados pessoais (PT-11, PT-13).**
  - Quem não está em nenhuma unidade pode ter nome e telefone removidos; o registro fica.
  - O histórico nunca guarda nome nem telefone.
- **Permissão.** As ações `moradores.ver`, `moradores.editar` e `moradores.confirmar` ficam só com o síndico até o CF-03 ganhar uma permissão para isso.
- **Rotas.** `/v1/condominio/unidades`, `blocos`, `unidades/:id/contatos`, `unidades/:id/mudanca`, `moradores`, `contatos/:id`, `vinculos-unidade/...` e `importacoes`.
- **Telas.** Desenhadas em `../docs/design-frontend.html` ("Telas do passo 3"); o código delas espera a aprovação.

## Rodar

Requisitos: Node 22, pnpm 10 e PostgreSQL 16 ou 17 com pgTAP (`postgresql-17-pgtap`).

```bash
pnpm install
cp .env.example apps/plataforma/.env.local   # e apps/console/.env.local
pnpm dev:plataforma   # http://localhost:3000
pnpm dev:console      # http://localhost:3001
```

## Verificar (o mesmo que o CI faz)

```bash
pnpm lint && pnpm typecheck && pnpm test   # ESLint, TypeScript e Vitest
pnpm test:deno                             # Edge Functions no Deno
pnpm test:db                               # migrations, pgTAP e edição simultânea num Postgres temporário
pnpm build && pnpm e2e                     # Playwright com axe (PW_CHROMIUM_PATH para outro Chromium)
```

## Ainda não ligado

O projeto Supabase de desenvolvimento é o `triade-condo-dev` (São Paulo, ref `dzwkxiimwprftgulhoqn`), já com todas as migrations. As configurações de login do `supabase/config.toml` não sobem sozinhas para o projeto hospedado: ligue-as no painel do Supabase, em Authentication. Faltam os projetos na Vercel (E4). Os segredos das funções e os modelos de e-mail (recuperação e convite) estão no fim do `supabase/config.toml`. O login foi testado com um Auth falso; a conferência com o Supabase Auth de verdade é o próximo passo.

Nas migrations, não use comandos de remoção (`drop`) nem `update` ou `delete` sem `where`: a ferramenta do Supabase segura esses comandos pedindo confirmação. Para recriar algo, crie só se não existir.
