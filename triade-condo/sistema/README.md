# Sistema TRÍADE Condo

Código dos dois sistemas da TRÍADE Condo (DC1): a **Plataforma do síndico** e o **Console TRÍADE**. As decisões estão em [`../docs/CONTEXTO.md`](../docs/CONTEXTO.md). O andamento está em [`../docs/painel-execucao.html`](../docs/painel-execucao.html). As ideias que cada parte atende estão no [`../IDEIAS.md`](../IDEIAS.md) e no [`../MAPA.md`](../MAPA.md).

A tecnologia é a mesma do T-shirt Club (DC5). Do T-shirt vieram só as peças genéricas (DC6), adaptadas a vários condomínios.

## Estrutura

```
apps/plataforma     Plataforma do síndico (Next.js 16, porta 3000)
apps/console        Console TRÍADE (Next.js 16, porta 3001)
packages/domain     regras puras em TypeScript: dinheiro, erros, textos, esquemas, logs limpos
                    (roda no Node e no Deno)
packages/ui         tema (DC13) e componentes React
packages/servidor   cabeçalhos de segurança, CSP com nonce e o repasse /api
packages/configuracoes  as abas das Configurações, usadas pelo app e pela aba Configuração do Console
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
- **As telas** seguem o desenho aprovado no antigo `docs/design-frontend.html` (saiu em 21/10/2026; está no histórico do git) ("Telas do passo 1"):
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
  - Todas ficam em `/v1/condominio/...` (painel, configuracoes, horarios, feriados, categorias, prioridades, modelos, prazos, pessoas, atendimento).
  - Pessoa e condomínio vêm sempre da sessão.
- **Configuração na implantação (PI-04, migration 0283).**
  - A TRÍADE monta as Configurações pela aba Configuração da ficha no Console, com as mesmas rotas do app em `/v1/clientes/:id/condominio/...` (`supabase/functions/_shared/rotas_configuracao.ts`). Cada uma das 11 partes é marcada como conferida e volta a pedir conferência quando muda; a etapa 4 do roteiro só fica realizada com todas conferidas.
  - Fuso, etapas dos pedidos e da manutenção, janela dos parecidos e tempo de anexar do WhatsApp são só da TRÍADE: mudam só pelo Console (`console_definir_fuso`, `console_salvar_etapa_pedido`, `console_salvar_etapa_manutencao`, `console_definir_parecidos`, `console_definir_anexar`). Com o cliente ativo, pedem motivo e avisam cada síndico no sino. No app ficam em leitura, com Pedir mudança, que abre um chamado.
  - Termo do piloto, os próprios avisos, revisar e reabrir e trocar o link do mural são só do síndico.
- **Telas.** Seguem o desenho aprovado no antigo `docs/design-frontend.html` (saiu em 21/10/2026; está no histórico do git) ("Telas do passo 2").
  - Ficam em `apps/plataforma/src/telas`, e as rotas em `apps/plataforma/src/app`.
  - Abas, aviso de conflito e selos com forma em SVG ficam em `packages/ui`.
  - Nenhuma tela usa emoji nem emoticon; o teste ponta a ponta confere.
  - Os testes ponta a ponta usam `tests/e2e/api-falsa-plataforma.ts`.

## Moradores e unidades (passo 3)

- **Estrutura, blocos e unidades.**
  - `configuracao_condominio.agrupamento` diz como chamar a divisão maior: `TORRE`, `BLOCO`, `QUADRA`, `PREDIO` ou `NENHUM`. `usa_andar` diz se as unidades ficam em andares. Muda por `plataforma_definir_estrutura`.
  - A tabela `blocos` guarda as divisões, seja qual for o nome. A unidade tem `andar` opcional ("3", "Térreo", "Cobertura").
  - A identificação da unidade é livre ("101", "Casa 12") e única entre as ativas do mesmo bloco e andar.
  - `chave_andar` (banco) e `chaveAndar` (domínio) ordenam do subsolo à cobertura. `nome_da_unidade` e `nomeDaUnidade` montam "Torre A · 3º andar · 302".
  - Nada se apaga. Bloco e unidade só são desativados quando não têm nada ativo dentro.
  - `chave_unidade` (banco) e `chaveUnidade` (domínio) dão a mesma ordem natural. `gerarUnidades` monta a numeração por andar e já põe cada unidade no andar dela.
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
- **Permissão (CF-03).**
  - O síndico tem `moradores.ver`, `moradores.editar` e `moradores.confirmar`.
  - A permissão `CADASTRAR` dá à pessoa autorizada ver e editar. O que ela inclui nasce pendente, e confirmar ou recusar fica com o síndico.
- **Rotas.** `/v1/condominio/unidades`, `blocos`, `unidades/:id/contatos`, `unidades/:id/mudanca`, `moradores`, `contatos/:id`, `vinculos-unidade/...` e `importacoes`.
- **Telas.** Seguem o desenho aprovado no antigo `docs/design-frontend.html` (saiu em 21/10/2026; está no histórico do git) ("Telas do passo 3").
  - Ficam em `apps/plataforma/src/telas/moradores`, com as rotas `/moradores`, `/moradores/unidade?id=` e `/moradores/importar`.
  - Os testes ponta a ponta usam `tests/e2e/api-falsa-moradores.ts`.

## Pedidos no painel (passo 4)

- **Pedido (AT-01).** A tabela `pedidos` guarda o protocolo por condomínio e por ano (`protocolos_pedido`: "2026-0001"), a unidade ou o local, o contato (só se confirmado na unidade), como chegou, categoria, prioridade, etapa, assunto e relato. O registro não muda depois: o que vier a mais vira nota.
- **Situação (AT-05).** O pedido passa pelo guardião: `ABERTO`, `EM_ANDAMENTO`, `EM_REVISAO`, `ENCERRADO` ou `CANCELADO`. A etapa configurada sempre combina com a situação e com a categoria (`pedidos_regras`).
- **Responsável (AT-03, AT-12, CF-05).** Vem da lista de quem atende: o escolhido ou o padrão da fila, se disponível. Confirma o aceite (`aceito_em`); repassar pede o aceite de novo. Quem sai da lista passa os pedidos ao padrão ou os deixa sem responsável, à vista na fila (`pedidos_do_responsavel_retirado`).
- **Próximo retorno e previsão (AT-06, AT-07).** `calcular_proximo_retorno` usa o prazo do passo 2. Registrar retorno ao morador (`andamentos_pedido`, tipo `RETORNO`) recalcula; nota interna (`NOTA`) não. Mudar o próximo retorno ou a previsão pede motivo. Etapa que pausa o prazo não deixa o retorno vencer.
- **Pendências (AT-11).** `pendencias_pedido` com tipo, motivo e quem cuida. Concluir pede todas resolvidas; cancelar fecha as abertas.
- **Conclusão (AT-13, AT-14, AT-15, AT-31).** `conclusoes_pedido` guarda cada conclusão, com a revisão e a reabertura. `configuracao_condominio.revisao_conclusao` (desligada) e `reabertura` (ligada) são as regras do condomínio.
- **Privado (AT-32).** `pedido_visivel`: o síndico, quem registrou e o responsável. Para os outros, o pedido não existe (404).
- **Histórico (AT-17).** Tudo vai para `historico` com `entidade = 'pedidos'`; `descreverEventoPedido` (domínio) transforma em frase.
- **Permissão (CF-03).** O síndico tem `pedidos.ver`, `responder`, `atualizar`, `concluir` e `revisar`. As permissões `ACOMPANHAR`, `RESPONDER`, `ATUALIZAR` e `CONCLUIR` passam a valer. O responsável de um pedido responde, atualiza e repassa aquele pedido (`pode_no_pedido`).
- **Rotas.** `/v1/condominio/pedidos` (fila e registro), `pedidos/opcoes`, `pedidos/contatos/:unidade`, `pedidos/:id` e as ações `etapa`, `responsavel`, `aceitar`, `retornos`, `notas`, `proximo-retorno`, `previsao`, `pendencias`, `concluir`, `revisar`, `reabrir`, `cancelar`; `regras-pedidos`.
- **Telas.** Seguem o desenho aprovado no antigo `docs/design-frontend.html` (saiu em 21/10/2026; está no histórico do git) ("Telas do passo 4").
  - Ficam em `apps/plataforma/src/telas/pedidos`, com as rotas `/pedidos` (filtros no endereço: `situacao`, `responsavel`, `prioridade`, `categoria`, `atencao`, `busca`) e `/pedidos/pedido?id=`. As regras ficam na aba Regras dos pedidos das configurações.
  - Os testes ponta a ponta usam `tests/e2e/api-falsa-pedidos.ts`.
- **Publicar.** Mudou a `api-plataforma`? Ela precisa ser publicada de novo no Supabase, num pacote só (o domínio e o `_shared` juntos).

## Manutenção e prestadores (peça R6)

- **Permissão (CF-03).** `manutencao.ver` e `manutencao.editar`, pelas permissões Ver a manutenção e Cuidar da manutenção; o síndico tem as duas. O cadastro de prestadores fica em Cuidar da manutenção.
- **Prestadores (MP-05, MP-09).** `prestadores` é do condomínio: com contrato (`contrato_ate`) ou por chamado, com uma reserva (`reserva_id`). Nome ativo não se repete. Arquivar não apaga.
- **Manutenção (MP-01, MP-02).** `manutencoes` passa pelo guardião: `PLANEJADA`, `EM_ANDAMENTO`, `PENDENTE` (com `pendencia_tipo` e `pendencia_motivo`), `CONCLUIDA` e `CANCELADA`; as duas últimas só voltam por `plataforma_reabrir_manutencao`, com motivo. A etapa (`etapas_manutencao`) combina sempre com a situação. Próximo retorno e previsão mudam com motivo. Quem executa é um prestador, uma pessoa com acesso ou um nome (`exigir_executor`).
- **Separada do pedido (MP-04).** `pedido_id` é opcional; concluir grava `pedido.manutencao_concluida` no histórico do pedido e não muda o pedido. A visita marcada por `plataforma_marcar_visita_manutencao` fica com `compromissos.manutencao_id`.
- **Vistoria (MP-07).** `itens_vistoria` é a lista de cada vistoria; `plataforma_item_virar_manutencao` abre a corretiva com `origem_id`.
- **Preventivas (MP-03, MP-13).** `preventivas` guarda a frequência e a próxima data. `abrir_preventivas` abre a manutenção `antecedencia_dias` antes (uma por data prevista); concluir ou cancelar faz a preventiva andar a partir da data prevista (`proxima_da_preventiva`). As sugestões da NBR 5674 estão no domínio (`SUGESTOES_PREVENTIVAS`) e só entram se escolhidas.
- **Rotina.** `verificar_manutencao` roda de hora em hora no pg_cron: abre as preventivas e avisa o retorno vencido em `avisos_manutencao`, uma vez por vencimento.
- **Arquivos.** `arquivos_manutencao`, com as regras de 0100, no bucket privado `manutencoes` (`armazenamentoManutencao` na `api-plataforma`).
- **Rotas.** `/v1/condominio/manutencao` (lista e registro), `manutencao/opcoes`, `manutencao/:id` e as ações `proximo-retorno`, `previsao`, `situacao`, `concluir`, `cancelar`, `reabrir`, `providencias`, `providencias/:id/fazer`, `itens`, `itens/:id/responder`, `itens/:id/manutencao`, `visita`, `arquivos`; `manutencao/preventivas`, `manutencao/prestadores`, `etapas-manutencao` e `pedidos/:id/manutencao`.
- **Telas.** Em `apps/plataforma/src/telas/manutencao`, com as rotas `/manutencao`, `/manutencao/manutencao?id=`, `/manutencao/preventivas`, `/manutencao/prestadores` e `/manutencao/prestador?id=`. Os testes ponta a ponta usam `tests/e2e/api-falsa-manutencao.ts`.

## Comunicados e documentos (peça R1)

- **Permissão (CF-03).** `comunicados.ver` e `documentos.ver` pela permissão Ver comunicados e documentos; `comunicados.publicar` pela permissão Publicar; `documentos.editar` e `documentos.restritos` pela permissão Cuidar dos documentos. O síndico tem todas.
- **Comunicado (CD-01).** `comunicados` passa pelo guardião: `RASCUNHO`, `PROGRAMADO`, `PUBLICADO`, `SUBSTITUIDO` e `ARQUIVADO`. Cada versão é uma linha da mesma família (`familia_id`, `numero`, `anterior_id`); só uma fica em uso. Publicado não muda (`comunicados_regras`): `plataforma_corrigir_comunicado` cria a versão seguinte com `mudanca`. Arquivar pede motivo.
- **Para quem (CD-02).** `publico` é `TODOS`, `BLOCOS`, `UNIDADES` ou `CONTATOS`. `destinatarios_comunicado` calcula quem recebe (vínculo confirmado e `recebe_comunicados`; em `ASSEMBLEIA`, também o proprietário). `publico_json` mostra a conta, as unidades sem ninguém e, a quem vê os moradores, os nomes. Na publicação ficam guardados `destinatarios` e `assinatura`.
- **Programar (CD-06).** `verificar_comunicados` roda a cada 5 minutos no pg_cron: publica os programados em nome de quem programou e avisa os documentos perto de vencer.
- **Ligações (CD-05).** `pedido_id` e `manutencao_id` opcionais; ligar grava `pedido.comunicado_ligado` ou `manutencao.comunicado_ligado` e não conta como retorno ao morador. Copiar e mural gravam `comunicado.copiado` e `comunicado.mural`.
- **Arquivos (CD-09).** `arquivos_comunicado`, até 4 por família, com as regras de 0100, no bucket privado `comunicados` (`armazenamentoComunicados`).
- **Documentos (CD-07, CD-04, MP-12).** `documentos` (tipo, restrito, `ao_morador`, `vale_ate`) e `versoes_documento`, uma por arquivo, no bucket privado `documentos` até 20 MB (`armazenamentoDocumentos`). O número da versão nasce quando o arquivo é liberado; a em vigor é a liberada de maior número com `vigente_desde` já passado (`versao_em_vigor`). Abrir e baixar gravam no histórico. A 60 dias do fim, `avisos_documento` avisa quem cuida dos documentos, uma vez por data.
- **Plano de comunicação (CD-11).** Colunas `comunicados_*` em `configuracao_condominio`: assuntos em uso, plano, assinatura e horário sem envio.
- **Rotas.** `/v1/condominio/comunicados` (lista e escrever), `comunicados/opcoes`, `comunicados/publico`, `comunicados/:id` e as ações `corrigir`, `arquivar`, `uso`, `arquivos`; `pedidos/:id/comunicados`, `manutencao/:id/comunicados`, `plano-comunicacao`; `documentos`, `documentos/:id`, `documentos/:id/arquivar` e `documentos/:id/versoes` (com `verificar` e `link`).
- **Telas.** Em `apps/plataforma/src/telas/comunicados`, com as rotas `/comunicados`, `/comunicados/escrever`, `/comunicados/comunicado?id=`, `/comunicados/documentos`, `/comunicados/documento?id=` e `/mural?id=` (fora da moldura, para imprimir). Os testes ponta a ponta usam `tests/e2e/api-falsa-comunicados.ts`.
## Mural online e e-mail (R1b)

- **Mural (CD-12).** `configuracao_condominio.mural_*` guarda se está ligado, o código público e os assuntos que aparecem por padrão. `comunicados.no_mural` só vale para todo o condomínio. A página `/m/<código>` chama `GET /v1/publico/mural/:codigo` (sem sessão, com limite por aparelho); trocar o link revoga o código antigo em `links_publicos`.
- **Links sem conta.** `links_publicos` é global e guarda só o sha256 do código (mural, comunicado, confirmar e parar o e-mail, documento). `entrar_por_link` acha o link e entra só no condomínio dele; `entrar_como_sistema` é a única função nova que grava o contexto.
- **E-mail (CD-13).** `contatos.email` com `email_situacao` (PENDENTE, CONFIRMADO, DEVOLVIDO, PAROU). `envios_email` é a fila: `email_pegar_lote` monta as mensagens com os códigos, `email_resultado` grava o que o Resend respondeu e `email_evento` o que o aviso dele contou. A API manda em lote (`_shared/email.ts`) logo depois de publicar e quando o banco chama `POST /v1/interno/fila-email` (rotina `enviar-emails`, pg_net, com `api_plataforma_url` e `repasse_segredo` no Vault). `POST /v1/email/eventos` e `POST /v1/email/parar/:codigo` não passam pelo repasse: o primeiro confere a assinatura do Resend, o segundo só aceita o código.
- **Documentos (CD-14).** `pedidos_documento` guarda os pedidos pelo mural; o envio vai como link de 7 dias (`/d/<código>`), cancelável.
- **Segredos da função.** `RESEND_API_KEY` (sem ela a fila só espera), `RESEND_WEBHOOK_SECRET` e, opcional, `EMAIL_REMETENTE`.
- **Testes.** pgTAP `017_mural_email_test.sql`, Deno `api-plataforma/mural_email_test.ts`, Vitest `mural_email.test.ts` e Playwright `plataforma-mural-email.spec.ts`.

## Portaria 1 · Encomendas (0299)

- **Permissão (CF-03, V-04 a V-06).** `portaria.ver` e `portaria.cuidar`, pelas permissões Ver a portaria e Cuidar da portaria. O síndico tem as duas, mas a Portaria só aparece para ele no prédio com portaria presencial ou quando ele se indica (`configuracao_condominio.portaria_sindico`); quem tem a permissão vê sempre (`portaria_aberta`, que também tira `portaria.%` de `acoes_da_pessoa`). No prédio sem portaria, quem foi indicado vê só o que ele mesmo registrou (`portaria_so_minhas`). Quem cuida da portaria vê as unidades e o nome das pessoas, sem telefone (`pessoas_encomenda`).
- **Encomenda (PA-01).** `encomendas` passa pelo guardião: `GUARDADA` e `ENTREGUE`; entregue não muda (`encomendas_regras`). Guarda a unidade, de quem veio, os volumes, o lugar (`lugares_encomenda`, configuráveis), quem guardou e quando, quem entregou e quem retirou (alguém da unidade, pelo contato, ou outra pessoa, pelo nome e a ligação). Fotos da etiqueta e da retirada em `fotos_encomenda`, só imagens, no bucket privado `portaria` (`armazenamentoPortaria`); não vão na mensagem.
- **Aviso (W-20, W-21).** Registrar já põe na fila de `envios_whatsapp` (finalidade `ENCOMENDA`) um aviso por telefone para cada pessoa confirmada que mora na unidade e tem WhatsApp, ao mesmo tempo, pelo modelo `encomenda_guardada` (aprovado no piloto, assinado pela Nina, com o aviso contra golpes). Quem pediu PARAR não recebe. `aviso` é `AVISADA`, `SEM_AVISO` (ninguém pode receber: `PAROU`, `SEM_CONTATO`, `SEM_WHATSAPP` ou `WHATSAPP_DESLIGADO`), `AVISO_FALHOU` (só a falha de envio) ou `OUTRO_MEIO`; o gatilho `envios_whatsapp_aviso_encomenda` recalcula. O número que o provedor diz não estar no WhatsApp fica marcado em `contatos.whatsapp_inexistente_em` até o telefone mudar ou chegar mensagem dele. A falha da encomenda se resolve pela Portaria (Avisar de novo ou Avisei por outro meio), não pelo Reenviar do WhatsApp.
- **Lembrete (PA-07).** `lembrar_encomendas` manda um lembrete, uma vez só, depois de `portaria_lembrete_dias` (7 de saída, de 1 a 60), pelo mesmo modelo, respeitando o horário sem envio; desliga em `portaria_lembrete_ligado`. `verificar_encomendas` roda de hora em hora no pg_cron.
- **Rotas.** `/v1/condominio/encomendas` (lista com `aba`, `atalho` e `busca`; registrar), `encomendas/opcoes`, `encomendas/unidades/:id` e `encomendas/unidades/:id/quem`, `encomendas/:id` (corrigir) e as ações `entregar`, `avisar`, `outro-meio` e `fotos` (com `verificar` e `link`); `portaria`, `portaria/lugares` e `portaria/lugares/:id` (Configurações › Prédio › Portaria).
- **Telas.** Em `apps/plataforma/src/telas/portaria`, com as rotas `/portaria` e `/portaria/unidade?id=`, o cartão Encomendas na ficha da unidade e a página `portaria` em `packages/configuracoes`. Os testes ponta a ponta usam `tests/e2e/api-falsa-portaria.ts`.
- **Testes.** pgTAP `042_encomendas_test.sql`, Deno `api-plataforma/encomendas_test.ts`, Vitest `encomendas.test.ts` e `menu.test.ts` e Playwright `plataforma-portaria.spec.ts`.

## Privacidade e dados · retenção (0301)

- **Catálogo (PT-11).** `retencao_tipos` guarda os 32 tipos de dado pessoal (28 da Plataforma, 4 do Console) com o que guarda, para que, base legal, quem trata, prazo, o que acontece no fim e a situação (`NA_ROTINA`, `FICA` ou `A_FAZER`). O inventário em `../docs/inventario-dados.md` sai dele. Os prazos são da TRÍADE, iguais para todos; mudar um prazo é migration nova.
- **Rotina.** `aplicar_retencao()` roda às 03:10 de Brasília (pg_cron `aplicar-retencao`), condomínio por condomínio: `retencao_candidatos(data)` acha o que passou do prazo e `retencao_aplicar_item` apaga o dado e mantém a linha, com a data em que apagou. Nasce `CONTANDO` (`retencao_estado`): só conta, até a Administração ligar `APAGANDO` no Console. Cada rodada grava `retencao.rodada` no histórico do condomínio (só totais por tipo, PT-03) e uma linha em `retencao_rodadas`. Dentro da rotina, as travas de imutabilidade de cada tabela não valem (`retencao_ativa()`, que exige `app.retencao` e o papel `dominio`); fora dela, valem como antes.
- **Arquivos.** O que tem arquivo deixa de ser servido na hora e o caminho vai para `arquivos_a_apagar`; `chamar_retencao_arquivos` (pg_cron `apagar-arquivos-retencao`, de 15 em 15 minutos entre 03:00 e 05:45) chama `/v1/interno/retencao-arquivos`, que apaga do bucket e marca o resultado (até 5 tentativas).
- **Guardar por obrigação legal.** `guardas_legais` (pedido, manutenção, encomenda ou pessoa; motivo `PROCESSO`, `SINISTRO`, `AUTORIDADE` ou `OUTRO` com detalhe). O que está guardado a rotina pula; tirar a guarda pede motivo.
- **Dados de uma pessoa (LGPD art. 18).** Busca pelo telefone (com ou sem o nono dígito) ou pelo e-mail, onde a pessoa aparece, a planilha com tudo e a remoção, recusada para quem mora (`CONTATO_COM_UNIDADE`), tem pedido aberto (`CONTATO_COM_PEDIDO_ABERTO`) ou está guardado (`CONTATO_GUARDADO`). Busca, planilha e remoção vão para o histórico sem o telefone e o e-mail. Permissões `privacidade.ver` e `privacidade.cuidar` (síndico); no Console, `console.retencao.ver` e `console.retencao.ligar` (Administração).
- **Rotas.** `/v1/condominio/privacidade`, `privacidade/dados-pessoa` (POST, para o telefone não ir na URL), `privacidade/dados-pessoa/:id/planilha` e `.../remover`, `privacidade/guardas`, `privacidade/guardas/:id/tirar` e `privacidade/guardas/:entidade/:id`; `/v1/interno/retencao-arquivos`; no Console, `/v1/retencao` e `/v1/retencao/modo`.
- **Fica para a F0.12.** Arquivos de pedido, manutenção e prestador com 5 anos, prestadores arquivados, a entrada da equipe que saiu, as sessões, os dados do Console e a exclusão do condomínio no fim do contrato.
- **Testes.** pgTAP `044_retencao_dados_test.sql`, Deno `api-plataforma/privacidade_test.ts` e `api-console/retencao_test.ts`, Vitest `privacidade.test.ts`.

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
