# Relatório de revisão de desenvolvimento — TRÍADE Condo

## Esclarecimento posterior aprovado

Atendimento humano WhatsApp é opcional: equipe do condomínio ou TRÍADE contratada separadamente da plataforma; ficha guarda modelo/responsáveis/horários/histórico. Número exclusivo por condomínio permanece proposta, não requisito confirmado. Este esclarecimento prevalece sobre descrições anteriores; não aprova provedor, preços, cobertura ou demais recomendações.


08/10/2026 • análise técnica assistida • sem implementação de produto.

## Prontidão e limite da análise

O projeto está utilizável para revisar escopo e preparar avaliação técnica do desenvolvedor. Não está pronto para operação com dados reais, nem há autorização nesta auditoria para iniciar produto. Não existe backend, autenticação, isolamento real, WhatsApp conectado ou pagamento processado. Os artefatos utilizáveis são documentação, pesquisa, mapas e simulações locais.

Há decisões bloqueadoras da fundação (D01) e decisões a fechar antes de cada módulo (D02–D07). Elas não impedem revisar documentos, estimar alternativas explicitadas ou preparar tarefas. Dez grupos de correções reversíveis foram aplicados; riscos de colaboração local e validação visual permanecem explícitos.

Esta é análise técnica assistida, não credencial profissional, certificação de segurança ou revisão externa independente. Fontes públicas mostram práticas documentadas; não foram testados os SaaS nem provada adequação à TRÍADE.

## O que foi examinado e como

Inspecionados produto/arquitetura/plano e guia; catálogo e scripts store/app; painel informativo e seus geradores; mapa; visão/painéis/manual; especificação MVP e próximas etapas em Markdown/HTML; planejamento ampliado, protótipo atual e protótipo operacional anterior. Verificados dados de pesquisa incorporados, limites comerciais e links de materiais relacionados. Workbook preservado como pesquisa histórica; não foi feita nova auditoria de fórmulas/recalculo Excel e ele não é especificação vigente.

A revisão incluiu reproduções novas em JavaScript isolado, entradas inválidas, importação repetida/conflitos, estado corrompido, texto potencialmente injetável, filtro cruzado de dependências, sessões e horários. Os testes usam armazenamento simulado; nenhum dado real do navegador foi lido ou apagado.

Backup anterior: ../outputs/entregas/revisao-2026-10-08/backup-antes-auditoria.zip. Correções em ferramentas/HTML/documentos, sem código de produto. Os 80 IDs legados ficaram preservados; novo REV-01 evita colisão com AUD-01 histórico. Não houve contato, publicação ou uso de clientes reais.

## Achados comprovados e corrigidos

### C01 · Filtro alterava cálculo de dependências e ocultava novas tarefas

**Corrigido · prioridade alta.** A lista filtrada era usada para calcular bloqueios; uma dependência concluída fora da aplicação selecionada aparecia pendente. Nova tarefa não oferecia MVP e o painel voltava ao filtro MVP após salvar. Agora bloqueios usam lista total, opções incluem aplicações atuais e a aplicação criada permanece visível.

Evidência atual: [app.js — linha 17](../outputs/triade-condo/construcao/js/app.js). Reprodução antes/correção depois registradas nos resultados de validação.

### C02 · Mesma importação duplicava conflitos indefinidamente

**Corrigido · prioridade alta.** Reprodução antes: primeira mesclagem tinha 3 registros, repetição passava a 4. Conflitos agora são deduplicados por tarefa/tipo/conteúdo; reaplicar a mesma cópia não cresce o histórico. Estado local continua preservado; alternativa fica para revisão.

Evidência atual: [store.js — linha 57](../outputs/triade-condo/construcao/js/store.js). Reprodução antes/correção depois registradas nos resultados de validação.

### C03 · Recuperação de estado local inválido podia perder o original

**Corrigido · prioridade alta.** Execução retornava estado vazio sem expor conteúdo bruto; confirmar importação substituía o original inválido. Agora load retorna raw; exportação em erro baixa o original, botão específico disponível, recuperação exige backup verificado em chave separada antes de substituir. Falha no backup cancela recuperação. Não li armazenamento real da Carolina.

Evidência atual: [store.js — linha 71](../outputs/triade-condo/construcao/js/store.js); [app.js — linha 54](../outputs/triade-condo/construcao/js/app.js). Reprodução antes/correção depois registradas nos resultados de validação.

### C04 · Protótipo e mapa podiam sobrescrever revisão inválida

**Corrigido · prioridade alta.** Protótipo aceitava carteira incompleta ou iniciava exemplos e salvava sobre JSON quebrado. Agora verifica formato mínimo, preserva original, bloqueia gravação sobre ele e permite exportar original/restaurar só com backup confirmado. Mapa também preserva original inválido antes de salvar revisão. Isto protege materiais locais, não cria banco/auth.

Evidência atual: [prototipo-paineis.html — linha 4](prototipo-paineis.html); [mapa-da-empresa.html — linha 5](../mapa-da-empresa.html). Reprodução antes/correção depois registradas nos resultados de validação.

### C05 · Sessões malformadas eram descartadas silenciosamente

**Corrigido · prioridade média.** sessions:false era convertido em [] e aceito. Agora só ausência é compatibilidade de export antigo; null/false/tipo inválido recusados. Sessões exigem fim textual, identificador único, início/fim com fuso e ordenação; histórico exige tarefa conhecida/data válida. Alteração passa pela mesma validação antes de salvar.

Evidência atual: [store.js — linha 32](../outputs/triade-condo/construcao/js/store.js). Reprodução antes/correção depois registradas nos resultados de validação.

### C06 · Erro de resposta modificava atendimento antes de validar

**Corrigido · prioridade média.** Responder/concluir sem texto chamava saveTicket primeiro, alterando estado/histórico em memória antes do erro. Agora valida resposta antes da mutação. Lista de responsáveis composta só de vírgulas/espaços é recusada. IDs de novos exemplos incluem sufixo para evitar colisão por cliques no mesmo milissegundo.

Evidência atual: [prototipo-paineis.html — linha 31](prototipo-paineis.html). Reprodução antes/correção depois registradas nos resultados de validação.

### C07 · Materiais amplos podiam parecer MVP vigente

**Corrigido documental · prioridade alta.** Visão/painéis/manual e simulação antiga permitiam agenda/manutenção sem aviso suficiente do recorte confirmado. Adicionado escopo vigente e aviso de simulação ampliada histórica; protótipo atual e especificação prevalecem. Histórico não apagado. Complemento técnico é proposta/decisão aberta, sem escolha de stack ou alteração do MVP.

Evidência atual: [visao-do-sistema.md — linha 3](visao-do-sistema.md); [planejamento-paineis.html — linha 3](planejamento-paineis.html). Reprodução antes/correção depois registradas nos resultados de validação.

### C08 · Datas de material exibidas como horário do dia anterior

**Corrigido · prioridade média.** updatedAt YYYY-MM-DD era convertido para instante UTC e mostrado em Bahia com dia anterior. Agora data sem horário é mostrada literalmente e marcada como data do material; registros com instante mantêm data/hora. Criação de tarefa adicional agora também produz histórico.

Evidência atual: [app.js — linha 38](../outputs/triade-condo/construcao/js/app.js); [store.js — linha 55](../outputs/triade-condo/construcao/js/store.js). Reprodução antes/correção depois registradas nos resultados de validação.

### C09 · Colisão de ID novo com catálogo legado detectada pelo teste

**Corrigido durante auditoria.** O catálogo antigo já continha AUD-01. Ao cadastrar a auditoria atual, o teste de unicidade detectou colisão antes da entrega. O antigo ficou intacto; auditoria atual passou a REV-01. Validação agora recusa IDs-base duplicados, evitando ambiguidade dos registros antigos.

Evidência atual: [store.js — linha 14](../outputs/triade-condo/construcao/js/store.js). Reprodução antes/correção depois registradas nos resultados de validação.

### C10 · Seletor síndico revelava nomes de outros clientes fictícios

**Corrigido · prioridade média.** O seletor estava desabilitado no perfil síndico, mas ainda continha opções com nomes da carteira. Agora nesse perfil só renderiza o condomínio selecionado. A troca de cliente fica na visão Carolina da demonstração. Isso corrige exposição visual fictícia; não prova isolamento no servidor.

Evidência atual: [prototipo-paineis.html — linha 9](prototipo-paineis.html). Reprodução antes/correção depois registradas nos resultados de validação.



## Riscos, decisões abertas e limites

### D01 · Identidade, autorização e arquitetura

**Bloqueia início da fundação do produto.** Confirmar matriz função/cliente/ação, vínculo síndico/morador/unidade, troca e revogação, suporte excepcional; escolher com desenvolvedor stack/ambientes/mecanismo de autenticação. Isolamento deve incluir buscas, filas, anexos, tarefas assíncronas e notificações, não seletor no navegador.

Acompanhamento: AUD-02 → MVP-03. Evidência: [especificacao-mvp.md — linha 159](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D02 · Contato e consentimentos técnicos

**Decidir antes da integração WhatsApp.** Número institucional determina destino, não prova identidade. Definir contato desconhecido, número reciclado/compartilhado, várias unidades/vínculos, preferências/opt-out exigidas pelo provedor, consentimentos técnicos e onboarding do número. Não acrescentar login do morador.

Acompanhamento: AUD-03 → MVP-14. Evidência: [especificacao-mvp.md — linha 185](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D03 · Estado da comunicação e atendimento humano

**Decidir antes da integração WhatsApp.** Definir responsável/horários/falha/retorno, tentativas finitas, tratamento manual e callbacks duplicados/fora de ordem; aceite de envio não é entrega/leitura. Definir resposta humana sem presumir IA ou equipe 24h. Falha de aviso não deve apagar pedido salvo.

Acompanhamento: AUD-03 → MVP-14. Evidência: [especificacao-mvp.md — linha 186](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D04 · Público de documentos e privacidade

**Decidir antes de conteúdos reais.** Determinar quem recebe qual versão e como consulta pelo WhatsApp; autorizar downloads/links e revogar vínculo. Documento encaminhado/baixado não pode ser recuperado por promessa do sistema. Protótipo atual demonstra texto/resumo e público fixo, não arquivos privados ou revogação comprovada.

Acompanhamento: AUD-04 → MVP-10. Evidência: [especificacao-mvp.md — linha 188](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D05 · Migração, histórico e concorrência

**Decidir antes de configuração persistente.** IDs estáveis, mapeamento de etapas, substituição de responsáveis e regras de conclusão/reabertura. Dois operadores não podem sobrescrever alteração silenciosamente; política de versão/conflito proposta a avaliar. Sem fluxo universal ou checklists compulsórios.

Acompanhamento: AUD-05 → MVP-08. Evidência: [especificacao-mvp.md — linha 189](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D06 · Reset não resolve todo ciclo de acesso

**Decidir antes da recuperação real.** Canal verificado, proteção tentativas, expiração/uso único; política de sessões/tokens anteriores e mudança de síndico. Recuperação da própria Carolina/equipe e perda do único administrador não especificadas definitivamente. Não escolher MFA/IdP como obrigação automática.

Acompanhamento: AUD-06 → MVP-13. Evidência: [especificacao-mvp.md — linha 191](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D07 · Múltiplas competências e correções

**Decidir antes de pagamentos reais registrados.** Uma única ficha no protótipo não preserva meses/transações reais. Definir registro por obrigação/competência e evento de confirmação/correção, moeda/precisão e papéis; ausência de valor não vira zero. Não gateway/cobrança/financeiro condomínio.

Acompanhamento: AUD-07 → MVP-12. Evidência: [especificacao-mvp.md — linha 190](especificacao-mvp.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D08 · Edição simultânea, evidência e portabilidade

**Limite operacional do acompanhamento local.** localStorage não fornece equipe/sincronia/trava. Outra aba pode substituir edição; uma pessoa/aba por vez e backup exportado. Histórico é registro editável e relógio local, não auditoria inviolável/prova de trabalho. Importação com custom ID em conflito é recusada sem perda; reconciliação manual pendente. Evidências não são verificadas automaticamente.

Acompanhamento: AUD-08. Evidência: [guia-painel-construcao.md — linha 15](../outputs/triade-condo/docs/guia-painel-construcao.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.

### D09 · Visual, anexos, operação e recuperação

**Requer validar antes de piloto.** Não foi possível revisar aparência em navegador por restrição file:// previamente registrada; não contornei por servidor/browser alternativo. Ainda faltam teste visual/teclado real, integração/isolamento backend, restauração de banco/anexos e parâmetros de capacidade. Manual possui etapas mas equipe/prazos/inclusão/preço são abertos.

Acompanhamento: AUD-08 e MVP-16/17. Evidência: [manual-implantacao.md — linha 66](manual-implantacao.md). Classificação: decisão aberta ou limite conhecido, não vulnerabilidade comprovada do backend inexistente.



## Comparação com SaaS existentes

Consulta: **08/10/2026**, fontes primárias oficiais. Não foram usados relatos de terceiros como comprovação. Preços comerciais não orientaram desenvolvimento nesta auditoria; pesquisas anteriores continuam datadas e com ressalvas. Não houve recomendação de compra/stack.

| Padrão / fonte oficial | Observado na fonte | Cobertura TRÍADE | Lacuna / recomendação ou fora de escopo |
|---|---|---|---|
| [uCondo — chamados privados e roteamento](https://suporte.ucondo.com.br/o-que-%C3%A9-o-recurso/funcionalidade-chamados) | Documentação anuncia chamados privados entre autor/gestão, registro de ações e roteamento. | Atendimento, responsável e histórico previstos; falta fechar quem pode receber resumo além do autor. | Propor matriz de visibilidade; não copiar app morador, foto compulsória ou proibição universal de edição. |
| [uCondo — documentos](https://suporte.ucondo.com.br/o-que-%C3%A9-o-recurso/funcionalidade-documentos) | Documento pode ser direcionado a condomínio, bloco, apartamento ou pessoa; consulta/baixar em web/app. | TRÍADE prevê publicação e consulta autorizada WhatsApp, mas público/mecanismo ainda aberto. | Escolher destinatário mínimo e versão; web/app do morador permanecem fora do escopo. |
| [uCondo — perfis e permissões](https://suporte.ucondo.com.br/funcionalidades-e-permiss%C3%B5es-web-x-app) | Central apresenta perfis e permissões diferentes por função/interface. | TRÍADE tem direções Carolina/síndico/equipe, ainda sem matriz fechada. | Descrever ações permitidas e clientes atribuídos; não adicionar porteiro ou financeiro por semelhança. |
| [Intercom — envio WhatsApp](https://www.intercom.com/help/en/articles/8632040-outbound-whatsapp-messages) | Documenta número de origem, templates, atribuição de respostas e estatísticas de envio/problemas. | Número institucional e avisos previstos, detalhes de retorno/falha e destinatários em aberto. | Separar status da mensagem do atendimento; definir responsável pelas respostas. Campanhas/Series não entram no MVP. |
| [Intercom — onboarding WhatsApp](https://www.intercom.com/help/en/articles/9067468-whatsapp-faqs) | Central descreve dados/controle do número necessários ao onboarding e restrições da integração. | Manual exige número próprio; viabilidade/provedor não definidos. | Adicionar conferência técnica de titularidade/controle do número e plano de migração, sem criar conta agora. |
| [Twilio — WhatsApp e callbacks](https://www.twilio.com/docs/whatsapp/api) | Documenta opt-in/opt-out, janela de conversa/templates, webhook e callback de status/erro. | Especificação cita janela/provedor/deduplicação, precisa política concreta de permissão e falha. | Validar regras do provedor escolhido na implementação; não escolher Twilio nem preços. 24h nesta fonte é janela técnica, não SLA de atendimento. |
| [Zendesk — colisão de agentes](https://support.zendesk.com/hc/en-us/articles/9186264597146-Avoiding-agent-collision) | Documenta indicação de outro agente editando e aviso de ticket atualizado. | Histórico previsto; concorrência não tinha critério explícito no MVP atual. | Propor controle de versão/aviso de alteração; presença em tempo real não é módulo obrigatório. |
| [Auth0 — escopo por organização](https://auth0.com/docs/manage-users/organizations/organizations-for-m2m-applications) | Documenta vínculo organizacional e aplicação do escopo pela API em chamadas máquina a máquina. | TRÍADE prevê isolamento no servidor; ainda sem implementação. | Aplicar isolamento também nos processos automáticos; não selecionar Auth0/SSO como stack. |
| [Auth0 — reset e sessões](https://support.auth0.com/center/s/article/Users-Do-Not-Appear-to-be-Logged-Out-After-Password-Reset) | Trecho oficial indexado informa que reset não implica saída imediata de todas as sessões/tokens em toda situação. Página aberta retorna shell; evidência limitada ao trecho indexado. | Revogação citada, política específica ainda pendente. | Testar mecanismo escolhido e revogação; não afirmar logout garantido. Não extrapolar detalhes não acessíveis. |
| [Jira — registros de trabalho](https://support.atlassian.com/jira-software-cloud/docs/log-time-on-an-issue/) | Documenta log de trabalho e permissões para editar registros. | Painel local tem sessões/resumo/histórico, sem controle real de identidade/permissão. | Manter fim de sessão separado de aceitação; esclarecer limites do relógio e edição local, sem impor sprint/estimativa. |


## Conferência transversal de escopo e arquitetura

O núcleo aprovado permanece íntegro: atendimento inseparável (pedido/unidade/contato, fila/responsável/prioridade, andamento, próximo retorno, estimativa conhecida, conclusão/histórico), conteúdo básico e dois painéis. Carolina carteira/contratação/liberação/implantação/pagamentos internos/reset; síndico próprio condomínio; morador WhatsApp sem conta. Conjuntos contratados E liberados são fronteira comercial; direitos por função/cliente/ação são fronteira de acesso, não devem ser confundidos.

Datas e retornos não dependem de agenda. Cenários sem porteiro e com estrutura maior são testes com responsáveis reais; lâmpada/foto/checklist não viram procedimento universal. Próximas etapas detalham agenda/manutenção sem integrá-las ao MVP, sem obrigar orçamento ou TRÍADE executar reparo.

Pagamento cliente→TRÍADE é registro/conferência, não boleto/gateway do condomínio; sem bloqueio automático. Recuperação síndico é futuro mecanismo validado, sem senha de funcionário. Manual separa preparação, execução e entregas internas/aprovadas, mas capacidade/pessoas/modalidade ainda exigem decisão operacional.

Orçamentos continuam fora do desenvolvimento inicial. QR/receptor é estudo sem porta aberta ou integração comprovada. Financeiro condomínio, armários, campanhas/arquivo ampliado e assessoria recorrente não são escopo autorizado por esta análise. Pesquisa/diagramas históricos têm precedência inferior à especificação atual.

O complemento adicionado à especificação é proposta técnica para revisão: identidade/contato, falhas/retornos humanos, público documental, migração/concorrência, competência financeira e revogação. Não fecha decisão de negócio por conta própria.

## Verificações novas e regressão

Passaram: 12 verificações novas orientadas a risco; 10 de catálogo/persistência/mesclagem; 9 de sessões; interface execução (lista de 21 MVP, detalhe, início/fim); 12 do protótipo; 11 do mapa; 15 da simulação de planejamento; 23 do painel informativo. Catálogo atual: 109 IDs únicos = 80 históricos + 21 MVP (3 materiais, 18 não iniciadas) + 8 auditoria (revisão e 7 pendências). Dependências sem ciclos; JSON/JS da base iguais.

Casos específicos: reimportação não duplica conflito; sessões false/null/tipo inválido recusadas; arquivo bruto corrompido preservado em backup e exportável; erro de resumo/resposta não conclui/muta registro; edição de sessão mantém anterior; reset é simulado sem segredo; pagamento pendente não altera liberação; texto de usuário é escapado nos campos renderizados.

Também conferidos sintaxe, IDs/âncoras/links locais e integridade/estrutura do pacote. Cópia anterior preservada; pacote atualizado mantém caminhos relativos. Registros do navegador não fazem parte do ZIP. Importar registro da auditoria é opcional e usa validação/mesclagem do painel.

Limites: teste em DOM simulado não verifica layout real, leitores de tela, toda interação física, concorrência real de navegadores, quotas reais ou backend inexistente. A abertura visual permanece não verificada por restrição anterior; nenhum contorno. Não reivindico segurança do produto a partir desses testes.

## Decisões concretas e próxima ação

1. Carolina e desenvolvedor: fechar matriz de acesso, vínculo/identificação e ambiente/mecanismo de autenticação (AUD-02), antes da fundação.
2. Antes do WhatsApp: escolher provedor com viabilidade do número e definir verificação de contato, preferências, horários/responsável por falhas e retomada (AUD-03).
3. Antes de conteúdo real: decidir público, consulta/download, versão e revogação (AUD-04).
4. Antes de configuração persistente: decidir estados/reabertura e migração/conflitos (AUD-05).
5. Antes do reset: decidir canal/mecanismo e revogação/recuperação da administração (AUD-06).
6. Antes do registro financeiro real: fechar competências/conferência/correções, sem gateway (AUD-07).
7. Antes de usar os painéis em acompanhamento compartilhado: validar visual em ambiente permitido e definir uma pessoa/aba editora, backup e revisão dos conflitos (AUD-08).

Fluxo recomendado: relatório → tarefa de decisão → evidência da decisão → revisão da especificação → avaliação de esforço → autorização específica para código. Não iniciar produto por este relatório. Nenhum preço ou prazo sugerido como aprovado.

## Registro da auditoria e transferência

A sessão atual da análise está em ../outputs/entregas/revisao-2026-10-08/registro-auditoria.json, com primeiro horário efetivamente consultado e finalização ao concluir esta auditoria. A janela inclui interrupções e retomadas; não mede horas ativas. Não foram inventados tempos anteriores. REV-01 registra apenas auditoria/material; não conclui tarefa de produto.

O painel inclui sete decisões/validações pendentes reais, ligadas às tarefas MVP pertinentes. Na base, ficam planejadas; o JSON separado registra a auditoria realizada. Importar o JSON mescla com seus registros; versões conflitantes permanecem para revisão. Sem acesso ao armazenamento existente da Carolina.

Pacote completo atualizado: ../outputs/entregas/triade-paineis-revisados-2026-10-08.zip. Inclui mapa, estruturação, outputs/triade-condo, relatório e registro da auditoria; não inclui memória, work ou dados do navegador. O backup anterior fica separado para não inflar/confundir o pacote vigente.

