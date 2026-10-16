# Atualização vigente dos painéis

## Decisão mais recente — atendimento humano opcional e número em proposta

Atendimento humano pelo WhatsApp é opcional: condomínio pode assumir com equipe própria ou contratar TRÍADE para atender. A contratação do serviço humano é separada da plataforma. Ficha guarda modelo escolhido, referência de contratação quando TRÍADE, pessoas autorizadas e horários por condomínio. Não presumir contratação, equipe, capacidade ou suporte 24h; troca de equipe/revogação mantém histórico e autoria. Produto continua com responsáveis/andamento/retornos essenciais, sem inventar pessoa disponível ou assumir IA/automação para substituir atendimento.

A sugestão de um número institucional exclusivo/próprio por condomínio não recebeu aprovação explícita, conforme esclarecimento mais recente de Carolina; permanece PROPOSTA. Isso prevalece sobre textos anteriores que o descreviam como pré-requisito de adesão. WhatsApp permanece canal do morador; topologia dos números e roteamento seguro por condomínio continuam a decidir, sem conta real ou integração.


O fluxo abaixo prevalece sobre instruções históricas (inclusive substituição de importação e escopo não aprovado).

## Fluxo vigente dos dois painéis — 08/10/2026

- [Painel informativo](../pesquisa/comparativo-cenarios-saas-2026-10-07.html): direção atual na abertura; demais seções preservam pesquisa histórica.
- [Painel execução](../construcao/index.html): filtrar “MVP aprovado” para 21 tarefas atuais (3 entregas de planejamento e 18 tarefas ainda não iniciadas). 80 tarefas anteriores preservadas no filtro histórico; registros locais com os mesmos IDs continuam recuperáveis.
- [Especificação atual](../../../estruturação%20do%20sistema/especificacao-mvp.md) orienta critérios; [próximas etapas](../../../estruturação%20do%20sistema/proximas-etapas.md) não amplia MVP.

Protocolo proposto ao desenvolvedor: abrir tarefa e conferir pré-requisitos → registrar responsável/data e início → atualizar notas/bloqueios e trabalho feito → indicar evidências reais (caminho, commit, teste/resultado) → Em revisão → Concluída somente com evidência e dependências concluídas. “A fazer” equivale a planejado; não afirmar implementação a partir de plano ou protótipo. O painel não verifica a existência/veracidade da evidência, não executa trabalho e não impõe a rotina a ferramentas externas.

Fonte base versionável: construcao/catalogo.json e construcao/js/catalog.js precisam permanecer iguais. Registros de trabalho: JSON exportado do painel, separado da base. Compartilhar/versionar essa cópia no repositório pelo responsável, após revisão, por exemplo em registros-execucao/ com data no nome (pasta não criada com evidência fictícia). Notas do navegador não atualizam arquivos automaticamente.

Exportar backup antes de importar e ao final de cada sessão. Importação valida antes de salvar e MESCLA: preserva registros locais, soma tarefas novas e histórico; conflitos em uma tarefa mantêm estado local e alternativa importada no histórico. IDs de tarefas adicionais diferentes com mesmo ID recusam importação inteira sem alterar dados; reconciliar na cópia mantendo backup. Não há sincronia de equipe, trava colaborativa ou comparação automática de commits. Usar uma pessoa/aba para edição e revisar conflitos antes de redistribuir exportação. Histórico anterior à atualização não pode ser reconstruído; painel guarda apenas alterações registradas daqui em diante.

Estados: A fazer/planejado, Em andamento, Bloqueada (anotar impedimento/decisão), Em revisão e Concluída. Data desejada não é compromisso; última alteração é data de registro. Dados antigos/exports versão 1 continuam aceitos sem histórico, preservando chave triade-construcao-v1. A aparência no navegador não foi verificada devido restrição de arquivos locais; não houve contorno por servidor.

---

## Material anterior preservado

# TRÍADE Condo — plano de execução

## Decisão vigente — orçamentos/propostas fora do desenvolvimento inicial (08/10/2026)

A usuária decidiu não desenvolver propostas/orçamentos agora. Retirados dos conjuntos e exemplos de plano inicial no HTML. A pesquisa e o fluxo anteriormente proposto permanecem apenas como referência futura, sob necessidade surgida e validada nos primeiros clientes, sem compromisso de construção. Esta decisão prevalece sobre sugestões anteriores de incluir registro/comparação de propostas no recorte inicial.

Se necessário, acompanhar uma pendência por tarefa simples existente ou processo acordado, sem construir comparação, aprovação de cotações, portal do fornecedor ou módulo próprio disfarçado. Isso não atribui à TRÍADE seleção de fornecedores, contratação ou compra pelo condomínio. Atendimento completo, agenda/manutenção e fronteiras de comunicação/documentos continuam em revisão; perfis e operação interna permanecem separados.


## Assessoria atual e terminologia confirmadas — 08/10/2026
Este esclarecimento prevalece sobre o enquadramento anterior: a assessoria da oferta atual concentra-se na **implantação de novo condomínio cliente** (prédio/condomínio que contrata o sistema), com demonstração e orientação passo a passo em reunião/assembleia acordada, e na **integração/orientação de novo morador em condomínio já cliente**, reduzindo trabalho do síndico. “Novo cliente” significa condomínio, não morador. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade.

Na orientação do novo morador, explicar regras existentes aprovadas/fornecidas pelo cliente, mostrar uso do WhatsApp e funcionamento do sistema e realizar cadastro breve com nome, telefone e apartamento. Não inventar regras nem substituir documentos do prédio. CPF é possibilidade condicional à necessidade do módulo financeiro, não obrigatório para funções básicas; sem coleta real agora ou interpretação de regra legal. Preço/pacote, frequência, capacidade, responsáveis e presencial versus remoto para novos moradores continuam a definir.

Assessoria operacional recorrente (triagem, vistoria, acompanhamento/manutenção) permanece apenas hipótese opcional futura, claramente distinta, sem inclusão automática na oferta atual. Descrições anteriores desse modelo não significam serviço vigente ou obrigação de execução. Preservar Brasília/DF, morador exclusivamente WhatsApp, número institucional próprio como pré-requisito, síndico painel web e avisos no WhatsApp dele, módulos independentes e MVP focado. Apenas materiais atualizados; sem pesquisa, contato, contratação ou implementação.


Base inicial de 05/10/2026; escopo revisado em 07/10/2026. Este plano acompanha a construção do produto e do serviço. Não representa entrega de software operacional em produção.

## Estado real e objetivo
Existe um documento de produto, arquitetura proposta e protótipo operacional modular com dados fictícios. O protótipo demonstra chamados, retorno, decisão, revisão e reabertura em memória. Não implementa login, API, banco, isolamento, upload ou WhatsApp real. Verificações iniciais são pontuais; revisão visual ainda não foi realizada. O painel de construção é uma ferramenta local separada e não altera o protótipo.

A plataforma organiza e registra a rotina; o síndico pode executar triagem, acompanhamento, checagem de evidências e revisão de conclusão. O serviço humano TRÍADE é adicional opcional, sem obrigação de enviar equipe para usuários apenas da plataforma. Não assume cargo ou representação legal, não movimenta dinheiro, aprova despesas ou aplica multas autonomamente. Responde pelo serviço que presta; contratos e privacidade exigem revisão profissional. Moradores interagem por WhatsApp dentro do escopo. Painel do produto: síndico e responsáveis autorizados; operação TRÍADE somente nos vínculos do adicional contratado. Acesso direto de prestadores é decisão pendente; inicialmente podem ser coordenados pela operação.

## Prioridade atual: descoberta comercial
Primeiro estruturar o que será vendido, a quem, como vender e qual necessidade real atender. Ainda não existe público validado nem oferta comercial definida. Só depois selecionar o MVP e codificar; evolução futura fica para depois. O catálogo é um backlog de hipóteses/possibilidades, não escopo aprovado do MVP nem autorização para iniciar implementação. Não há síndico/condomínio inicial disponível. Descoberta inicial por ofertas concorrentes e relatos públicos na web, sem presumir demanda ou disposição a pagar validadas. Entrevistas prévias não são requisito obrigatório. Depois desenvolver MVP focado e oferecê-lo a alguns síndicos para teste. O protótipo é apoio à descoberta. Esta atualização apenas registra definições; não executa pesquisa extensa nem implementação.

## Como executar
As fases são portas de validação, não datas prometidas. Prioridade P0 indica pré-requisito essencial, P1 escopo subsequente. Responsáveis, orçamento, esforço e calendário estão a definir em DEC-05. Os IDs permitem cruzar plano e painel. Dependências representam ordem de preparação; tarefas independentes podem avançar em paralelo quando houver capacidade. O painel impede conclusão com dependências não concluídas e exige evidência, mas não executa nem verifica automaticamente o trabalho.

1. Priorizar PROD-01/02: necessidade real, público, oferta e forma de vender. Depois revisar DEC-06: quem executa cada atividade nos dois modelos. SERV-01/02 e ADD-01/02/03/04 são pendências do adicional, não requisitos de contratação para usar a plataforma.
2. Resolver DEC-01/02/03/04: autoridades, stack, WhatsApp e tratamento de mídia/dados.
3. Implementar fundação e verificar isolamento antes de conectar dados reais.
4. Implementar chamados, prazos, decisões e revisão com API persistente.
5. Integrar WhatsApp em ambiente de testes, sem contas reais nesta etapa de planejamento.
6. Passar por qualidade e preparação da operação; implantação/contas/contratação exigem autorização futura específica.
7. Decidir prontidão do piloto, executar acompanhamento assistido e avaliar resultados antes da expansão.

## Portas de passagem
- Plataforma: escopo, emergência, responsáveis da rotina do síndico e autoridades definidos.
- Adicional humano, somente quando contratado: pacote/preço/limites, equipe, demandas, horários/cobertura/substituição, capacidade de condomínios e presença local definidos; ADD-05 é a porta adicional.
- Fundação: sessões e isolamento comprovados por testes negativos entre clientes.
- Fluxo operacional: histórico persistente, dois prazos, autorização com autoria e encerramento revisado.
- Canal: identificação, mídia, status/revisão, deduplicação e falhas de envio verificados em testes.
- Piloto: revisão profissional, pessoas treinadas, infraestrutura aprovada, restauração testada e indicadores disponíveis. PIL-05 reúne os pré-requisitos.

## Pendências e pressupostos
Stack proposta: TypeScript, Node e PostgreSQL, sujeita à decisão. Não há provedor WhatsApp selecionado, transcrição de áudio garantida, horário humano, canal de emergência, preço, equipe ou SLA contratados. Não há síndico ou condomínio inicial disponível; Gabriela não é implantação confirmada. A pesquisa de mercado é exploratória, não representativa; não garante exclusividade. Escopo adicional deve entrar em GOV-01, sem transformar pedidos genéricos em compromisso ilimitado.

## Dois modelos e pendências expressas
A escolha comercial de pacote e preço permanece em aberto. DEC-06 registra quem executa cada atividade em cada modelo. SERV-01/02 e ADD-01/02/03/04 registram pacote/limites/preço, horários/cobertura/substituição, equipe contratada, demandas cobertas, quantidade/capacidade de condomínios e atividades presenciais. Nenhuma tarefa comum depende dessas definições opcionais; apenas a prontidão do adicional usa ADD-05. Chamados, responsáveis, dois prazos, decisões, histórico, evidências, revisão, reabertura e comunicação permanecem na plataforma.

Os 74 IDs anteriores foram preservados; seis novas pendências foram adicionadas. O armazenamento versão 1 e sua chave permanecem iguais: status, prioridade, responsável, datas, notas, evidências e tarefas locais não são reescritos. Conclusões antigas de tarefas revisadas exigem conferência manual; não são certificadas nem apagadas.

## Cenários para pesquisa, sem ampliar automaticamente o MVP
Pesquisar edifícios residenciais com portaria presencial/atendente, online/remota e sem qualquer portaria, inclusive vários andares e apartamentos com síndico morador e pouca estrutura. Não presumir porteiro, zelador, equipe local, administradora ou prestador fixo. “Nem é condomínio, é um prédio” descreve pouca estrutura operacional, não classificação jurídica.

PROD-01/03 registram pesquisa das diferenças de dores, fluxos, responsáveis e impacto na oferta. DEC-06 e SERV-05/06 tratam triagem, atribuição, acesso à manutenção, vistoria, evidências, revisão e comunicação. O síndico pode executar/atribuir; adicional humano permanece opcional. Portaria remota não assume manutenção/revisão automaticamente e não se presume integração técnica com seu fornecedor. Escolher recorte após pesquisa pública; só depois MVP e testes com síndicos. Nenhuma pesquisa ou funcionalidade nova executada nesta revisão.

## Catálogo completo
O estado de base abaixo é imutável no painel. O status de acompanhamento pode mudar localmente e não atualiza este Markdown automaticamente. Exportar registros periodicamente; catálogo.json guarda a versão inicial.

### Fase 0 — Base recuperada

Inventariar documentos e protótipo, sem tratar simulação como produto em produção.

#### BASE-01 — Recuperar documento de produto

Aplicação: Plataforma / ambos os modelos • Frente: Produto • Tipo: Documento • Prioridade: P1 • Base: Documentado • Status inicial: Concluída.

Dependências: Nenhuma. Responsável: a definir.

Conclui quando: Personas, jornada, limites e MVP disponíveis para revisão.

Evidência da base: `../docs/produto.md` (caminho relativo ao painel).

#### BASE-02 — Recuperar desenho modular

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Documento • Prioridade: P1 • Base: Documentado • Status inicial: Concluída.

Dependências: Nenhuma. Responsável: a definir.

Conclui quando: Entidades, API proposta, isolamento e integrações descritos; stack é hipótese.

Evidência da base: `../docs/arquitetura.md` (caminho relativo ao painel).

#### BASE-03 — Preservar protótipo operacional

Aplicação: Plataforma / ambos os modelos • Frente: Experiência • Tipo: Protótipo • Prioridade: P1 • Base: Simulado • Status inicial: Concluída.

Dependências: Nenhuma. Responsável: a definir.

Conclui quando: Demonstração de demandas, decisões, retorno, revisão e reabertura em dados fictícios.

Evidência da base: `../prototype/index.html` (caminho relativo ao painel).

Observação: Filtros e perfis não implementam autorização; alterações em memória; evidência apenas textual.

#### BASE-04 — Registrar verificações iniciais

Aplicação: Plataforma / ambos os modelos • Frente: Qualidade • Tipo: Documento • Prioridade: P1 • Base: Documentado • Status inicial: Concluída.

Dependências: Nenhuma. Responsável: a definir.

Conclui quando: Sintaxe e regras pontuais verificadas; limites de validação registrados.

Evidência da base: `../docs/validacao.md` (caminho relativo ao painel).

#### BASE-05 — Criar plano detalhado da execução

Aplicação: Plataforma / ambos os modelos • Frente: Gestão do projeto • Tipo: Documento • Prioridade: P1 • Base: Documentado • Status inicial: Concluída.

Dependências: Nenhuma. Responsável: a definir.

Conclui quando: Todo escopo recuperado aparece com tarefas, critérios e dependências.

Evidência da base: `../docs/plano-execucao.md` (caminho relativo ao painel).

#### BASE-06 — Criar painel local da construção

Aplicação: Plataforma / ambos os modelos • Frente: Gestão do projeto • Tipo: Ferramenta local • Prioridade: P1 • Base: Implementado localmente • Status inicial: Concluída.

Dependências: Nenhuma. Responsável: a definir.

Conclui quando: Busca, filtros, edição, persistência, exportação e importação disponíveis; testes registrados.

Evidência da base: `index.html` (caminho relativo ao painel).

Observação: Sem servidor de dados ou colaboração multiusuário. Conclusões registradas não são certificação independente.

#### BASE-07 — Revisar visualmente o painel da construção

Aplicação: Plataforma / ambos os modelos • Frente: Qualidade • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: BASE-06. Responsável: a definir.

Conclui quando: Verificar navegação, filtros, formulário, recarga com persistência, exportação/importação, teclado e tela pequena em navegador disponível.

Observação: Navegador de automação indisponível nesta sessão; testes de lógica não substituem revisão visual.

### Fase 1 — Validar produto e serviço

Definir escopo, responsabilidades, canais e capacidade a partir de hipóteses de fontes públicas; testes com síndicos após o MVP.

#### PROD-01 — Descobrir necessidade real e público comprador

Aplicação: Plataforma / ambos os modelos • Frente: Produto • Tipo: Validação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: BASE-01. Responsável: a definir.

Conclui quando: Pesquisar fontes públicas sobre necessidades em edifícios residenciais com portaria presencial/atendente, online/remota e sem portaria, incluindo vários andares/apartamentos com síndico morador e pouca estrutura. Sem cliente inicial; pesquisa gera hipóteses, não valida demanda/pagamento.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### PROD-02 — Estruturar o que vender, a quem e como vender

Aplicação: Plataforma / ambos os modelos • Frente: Produto • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-01. Responsável: a definir.

Conclui quando: Direção vigente em 08/10: organizar conjuntos coerentes antes de níveis/nomes/preços. Atendimento completo inclui fila, responsável, prioridade, andamento, próximo retorno, estimativa quando disponível, conclusão, histórico, comunicados e documentos essenciais, sem subfunções vendidas como extras. Síndico painel/morador WhatsApp em cada conjunto. Separar produto, operação interna TRÍADE (gestão de clientes exclusiva da equipe) e desenvolvimento futuro; serviços de implantação/orientação/apoio documental com inclusão/preço a definir. A divisão básico/ampliação citada abaixo é histórica e foi substituída. Oferta atual em Brasília/DF: assessoria para implantação de novo condomínio cliente (prédio/condomínio que contrata o sistema), com demonstração/orientação em reunião/assembleia acordada, e integração/orientação de novo morador em condomínio já cliente. Não é requisito jurídico nem exclusividade. Assessoria operacional recorrente só hipótese opcional futura. Preço/pacote, frequência, capacidade, responsáveis e presencial/remoto da orientação a definir. Implantação de novo condomínio cliente também oferece apoio documental a atas, regras e documentos pertinentes: desenvolver se inexistentes; revisar/propor ajustes quando necessário. Condomínio aprova regras; atas refletem reuniões/decisões reais, sem fabricação retroativa. Sem regularização automática ou jurídico já contratado. Documentos abrangidos, responsáveis/revisão profissional quando aplicável e preço/pacote a definir. Não exigir documentação para todos os módulos/chamados; nenhum documento real criado agora. Estrutura inicial de planos decidida: básico com atendimento/controle; ampliação com coordenação/agenda, adquirindo mais recursos conforme plano. Nomes, preços e composição final não aprovados; inclusão de implantação/orientação/apoio documental por plano a definir. Plano regula acesso comercial, sem dependência artificial: orçamento sem pagamento, chamados sem financeiro. Coordenação não implica execução de manutenção pela TRÍADE; financeiro/boleto evolução a decidir e armário após primeiros clientes. Sem contratação, divulgação ou implementação agora.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### PROD-03 — Comparar dores, fluxos e oferta entre cenários de portaria

Aplicação: Plataforma / ambos os modelos • Frente: Produto • Tipo: Validação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-01. Responsável: a definir.

Conclui quando: Comparar fontes públicas por cenário: dores, fluxos, responsáveis disponíveis e impacto na oferta/venda. Registrar fontes e lacunas, sem presumir porteiro, zelador, equipe, administradora ou prestador fixo; portaria remota não implica manutenção nem integração técnica.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### PROD-04 — Preparar testes com síndicos posteriores ao MVP

Aplicação: Plataforma / ambos os modelos • Frente: Experiência • Tipo: Validação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-05. Responsável: a definir.

Conclui quando: Roteiro para oferecer MVP focado a alguns síndicos depois de desenvolvido. Não exigir entrevistas ou testes prévios para construir no caminho escolhido.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### PROD-05 — Definir MVP e métricas somente após descoberta comercial

Aplicação: Plataforma / ambos os modelos • Frente: Produto • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02. Responsável: a definir.

Conclui quando: Direção vigente em 08/10: organizar conjuntos coerentes antes de níveis/nomes/preços. Atendimento completo inclui fila, responsável, prioridade, andamento, próximo retorno, estimativa quando disponível, conclusão, histórico, comunicados e documentos essenciais, sem subfunções vendidas como extras. Síndico painel/morador WhatsApp em cada conjunto. Separar produto, operação interna TRÍADE (gestão de clientes exclusiva da equipe) e desenvolvimento futuro; serviços de implantação/orientação/apoio documental com inclusão/preço a definir. A divisão básico/ampliação citada abaixo é histórica e foi substituída. Após descoberta comercial, definir MVP focado na rotina candidata. Visão de evolução: do prédio simples ao condomínio grande com muitos apartamentos, com ou sem portaria, com funções adequadas a cada contexto. Forma de disponibilizar recursos pendente; sem pacote, preço ou arquitetura definitivos. Morador 100% WhatsApp e síndico com painel web/avisos WhatsApp em todos os cenários. Construção e testes futuros. Atividades/módulos opcionais e independentes. Financeiro e boleto mensal são evolução possível, não aprovados para MVP. Orçamento não exige pagamento; chamados/evidências/checagem/reabertura não exigem financeiro/cobrança. Preservar vínculos essenciais sem percurso compulsório. Ativação, provedor/fluxo e integrações a definir futuramente. Estrutura inicial de planos decidida: básico com atendimento/controle; ampliação com coordenação/agenda, adquirindo mais recursos conforme plano. Nomes, preços e composição final não aprovados; inclusão de implantação/orientação/apoio documental por plano a definir. Plano regula acesso comercial, sem dependência artificial: orçamento sem pagamento, chamados sem financeiro. Coordenação não implica execução de manutenção pela TRÍADE; financeiro/boleto evolução a decidir e armário após primeiros clientes. Sem contratação, divulgação ou implementação agora.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### SERV-01 — Definir pacote, limites e preço do adicional humano

Aplicação: Adicional humano opcional • Frente: Serviço humano • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Pacote opcional de assessoria com limites, atividades e preço a definir; sem decisão comercial definitiva ou obrigatoriedade de contratação.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### SERV-02 — Definir horários, cobertura e substituição do adicional

Aplicação: Adicional humano opcional • Frente: Serviço humano • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-01. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Horários, cobertura e substituição da equipe contratada a definir; não prometer atendimento humano TRÍADE aos usuários apenas da plataforma.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### SERV-03 — Definir emergência e escalonamento

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-06. Responsável: a definir.

Conclui quando: Canal de emergência e escalonamento documentados para ambos os modelos, com responsáveis definidos; sem prometer socorro ou equipe TRÍADE sem contratação.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### SERV-04 — Definir prazos por categoria e regras de pausa

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02, DEC-06. Responsável: a definir.

Conclui quando: Retorno e resolução separados, pausas/feriados e justificativas definidos para a rotina do síndico ou equipe contratada; não depende do pacote humano.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### SERV-05 — Criar procedimentos e checklists de vistoria

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-06. Responsável: a definir.

Conclui quando: Planejar checklist/vistoria, acesso, responsável e coleta de fotos/evidências para os três cenários; síndico pode executar/atribuir. Se acesso ou executor não estiver disponível, registrar impedimento; não exigir equipe local ou envio TRÍADE.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### SERV-06 — Definir cadastro de prestadores e cobrança

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-06. Responsável: a definir.

Conclui quando: Identificar contratos, acordos, prestadores e modo de atendimento existentes; coordenar providências conforme necessidades reais. Não presumir cadastro novo, prestador fixo, autorização de entrada ou acompanhamento obrigatório no prédio simples sem operação de portaria.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### SERV-07 — Definir encerramento, contestação e incidente técnico

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-03, SERV-04. Responsável: a definir.

Conclui quando: Síndico pode checar evidências e revisar conclusão na plataforma; executor/revisor contratado definido no adicional. Incidentes têm responsável e conciliação em cada modelo.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### DEC-01 — Aprovar matriz de acesso e autoridades de decisão

Aplicação: Plataforma / ambos os modelos • Frente: Identidade e permissões • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02, DEC-06. Responsável: a definir.

Conclui quando: Permissões por função/vínculo permitem rotina do síndico sem equipe. Não criar direitos automáticos por haver portaria presencial/remota, administradora ou fornecedor; acesso TRÍADE somente autorizado no adicional. Autoridades de decisão preservadas.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### DEC-02 — Escolher stack e ambientes de desenvolvimento

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: BASE-02. Responsável: a definir.

Conclui quando: Confirmar ou substituir proposta TypeScript/Node/PostgreSQL; registrar equipe, custos estimados e critérios, sem contratar.

#### DEC-03 — Escolher estratégia WhatsApp/BotConversa

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02. Responsável: a definir.

Conclui quando: Validar funções, webhook, mídia, restrições, custos e ambiente de testes; escolha não conecta contas reais.

#### DEC-04 — Definir retenção, áudio e privacidade

Aplicação: Plataforma / ambos os modelos • Frente: Evidências e privacidade • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-05, DEC-03. Responsável: a definir.

Conclui quando: Decidir transcrição de áudio, armazenamento, acesso, consentimento quando aplicável, exclusão e tratamento de fotos; revisão profissional planejada.

#### DEC-05 — Definir equipe, orçamento e cronograma

Aplicação: Plataforma / ambos os modelos • Frente: Gestão do projeto • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02, DEC-02, DEC-06. Responsável: a definir.

Conclui quando: Nomear responsáveis e capacidade; estimar esforço após decisões; aprovar sequência e datas sem inventar compromissos.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### GOV-01 — Manter fila de mudanças e evidências de conclusão

Aplicação: Plataforma / ambos os modelos • Frente: Gestão do projeto • Tipo: Processo • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: BASE-06. Responsável: a definir.

Conclui quando: Cada alteração de escopo vira tarefa com impacto/dependências; conclusão tem evidência, responsável e verificação; atualizar documentos ao mudar decisão.

#### DEC-06 — Identificar organização existente e responsáveis por atividade

Aplicação: Plataforma / ambos os modelos • Frente: Produto • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-02. Responsável: a definir.

Conclui quando: Identificar atores e procedimentos já adotados por cenário/modelo. Manutenção pode estar organizada em atas, regras, acordos ou contratos; referência/decisão/responsável registrados se útil, sem regra de ata ou novo fluxo obrigatório. C01: rotina compartilhada sem operação de portaria; visitas/entregas diretamente com moradores. Humano opcional.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### ADD-01 — Definir composição da equipe do adicional

Aplicação: Adicional humano opcional • Frente: Serviço humano • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-01. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Definir funções e composição quando contratado; não pressupor equipe obrigatória para clientes da plataforma.

#### ADD-02 — Definir demandas cobertas pelo adicional

Aplicação: Adicional humano opcional • Frente: Serviço humano • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-01. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Registrar categorias, ações incluídas, exclusões e encaminhamentos; sem capacidade ilimitada presumida.

#### ADD-03 — Definir quantidade e capacidade de condomínios

Aplicação: Adicional humano opcional • Frente: Serviço humano • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: ADD-01, SERV-02. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Estimar volume, capacidade e quantidade de condomínios atendíveis pela equipe do adicional; registrar limites sem inventar números.

#### ADD-04 — Definir atividades que exigem presença local

Aplicação: Adicional humano opcional • Frente: Serviço humano • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-06, ADD-02. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Pesquisar e definir quais atividades exigem presença local, quem viabiliza acesso e quem executa por cenário. Adicional opcional; ausência de portaria não obriga contratar equipe TRÍADE.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

### Fase 2 — Fundação técnica

Preparar identidade, isolamento, dados e API antes de usar dados reais.

#### TEC-01 — Estruturar aplicação e configuração

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-02, PROD-05. Responsável: a definir.

Conclui quando: Separar frontend, API, domínio e adaptadores; configuração por ambiente, segredos fora do código e verificação automática.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### DB-01 — Modelar banco e migrações

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TEC-01, DEC-01. Responsável: a definir.

Conclui quando: Tenant, condomínio, usuário, vínculo, chamado, decisão, evidência, eventos, comunicação, vistoria e checklist com chaves e índices.

#### DB-02 — Criar dados fictícios e ambientes separados

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DB-01. Responsável: a definir.

Conclui quando: Múltiplos clientes/condomínios no ambiente de testes; nenhuma cópia de dados reais para desenvolvimento.

#### AUTH-01 — Implementar login e sessão de síndico/operação

Aplicação: Plataforma / ambos os modelos • Frente: Identidade e permissões • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TEC-01, DEC-01. Responsável: a definir.

Conclui quando: Login/sessão de síndico e perfis autorizados; plataforma funciona sem operador TRÍADE. Morador continua no WhatsApp.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### AUTH-02 — Implementar permissões e vínculos no servidor

Aplicação: Plataforma / ambos os modelos • Frente: Identidade e permissões • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: AUTH-01, DB-01. Responsável: a definir.

Conclui quando: Servidor valida função/vínculo por endpoint; síndico pode executar rotina operacional. Perfis TRÍADE dependem de autorização e modelo contratado, sem acesso automático.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### TEN-01 — Implementar isolamento de clientes e condomínios

Aplicação: Plataforma / ambos os modelos • Frente: Isolamento • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: AUTH-02. Responsável: a definir.

Conclui quando: Tenant derivado da sessão; consultas, escritas, buscas, relatórios e anexos validam vínculo; avaliar RLS como complemento.

#### API-01 — Implementar contratos e validação de API

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DB-01, TEN-01. Responsável: a definir.

Conclui quando: Rotas de chamados, eventos, comunicação, evidência, revisão, reabertura e decisões com esquema, paginação, erros e controle de versão.

#### AUD-01 — Implementar histórico e auditoria

Aplicação: Plataforma / ambos os modelos • Frente: Arquitetura e dados • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: API-01. Responsável: a definir.

Conclui quando: Eventos persistem autor, data, versão e alteração; usuário comum não edita eventos anteriores; evitar dados sensíveis desnecessários nos logs.

#### TEN-02 — Testar acesso cruzado entre clientes

Aplicação: Plataforma / ambos os modelos • Frente: Isolamento • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TEN-01, API-01. Responsável: a definir.

Conclui quando: Testes negativos em listagem, detalhe, edição, decisão, anexo e relatório bloqueiam IDs de outro cliente e condomínio.

### Fase 3 — Operação de chamados

Implementar acompanhamento, prazos, decisões, vistorias e encerramento.

#### TIC-01 — Persistir recebimento e protocolo

Aplicação: Plataforma / ambos os modelos • Frente: Chamados e prazos • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: API-01, AUD-01. Responsável: a definir.

Conclui quando: Todo chamado contém cliente, condomínio, local, categoria, descrição e protocolo único; validação de campos e identificador externo.

#### TIC-02 — Implementar triagem e atribuição

Aplicação: Plataforma / ambos os modelos • Frente: Chamados e prazos • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-01, SERV-04. Responsável: a definir.

Conclui quando: Identificar organização existente e responsável real para pedido, providência, andamento e conclusão. Sem equipe inventada ou fluxo burocrático obrigatório. Acesso/autorizações só se necessários ao caso; não presumir operação de portaria em C01.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### TIC-03 — Implementar estados e pendências

Aplicação: Plataforma / ambos os modelos • Frente: Chamados e prazos • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-02, SERV-07. Responsável: a definir.

Conclui quando: Transições válidas; pendência de fornecedor, equipe, morador ou síndico exige responsável e motivo.

#### TIC-04 — Implementar dois relógios e alertas de retorno

Aplicação: Plataforma / ambos os modelos • Frente: Chamados e prazos • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-03, SERV-04. Responsável: a definir.

Conclui quando: Próximo retorno independente da estimativa de resolução; mudança exige histórico; regras de horário e pausa implementadas.

#### TIC-05 — Construir painel real de acompanhamento

Aplicação: Plataforma / ambos os modelos • Frente: Experiência • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-04, AUTH-02. Responsável: a definir.

Conclui quando: Fila, detalhe, filtros, responsável editável, erros e carregamento ligados à API; remover datas fixas de demonstração na aplicação real.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### TIC-06 — Relacionar duplicidades e reincidências

Aplicação: Plataforma / ambos os modelos • Frente: Chamados e prazos • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-02. Responsável: a definir.

Conclui quando: Relacionar relatos conservando protocolos/histórico; reincidência por local/categoria é sinal de investigação e não causa confirmada.

#### SYN-01 — Criar solicitação de autorização

Aplicação: Plataforma / ambos os modelos • Frente: Decisões do síndico • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-03, DEC-01. Responsável: a definir.

Conclui quando: Se selecionado para um caso que exige decisão, registrar alternativas, custo e autoria conforme organização existente. Orçamento também pode ser usado como atividade independente/opcional, sem financeiro, pagamento, chamado, evidência ou checagem obrigatórios. Não criar fluxo burocrático universal; preservar identidade, autorização e coerência quando necessárias.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### SYN-02 — Persistir aprovação/devolução autorizada

Aplicação: Plataforma / ambos os modelos • Frente: Decisões do síndico • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SYN-01, AUD-01. Responsável: a definir.

Conclui quando: Autoria e justificativa obrigatórias; versão impede resposta dupla; sem contratação ou transação financeira automática.

#### EVI-01 — Implementar upload privado e controles de mídia

Aplicação: Plataforma / ambos os modelos • Frente: Evidências e privacidade • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TEN-01, API-01, DEC-04. Responsável: a definir.

Conclui quando: Se selecionado para MVP, upload privado com validação e vínculo; evidência pode vir do síndico ou executor autorizado, sem depender de porteiro/zelador/equipe local. Tipos e meios de coleta a definir após pesquisa.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### EVI-02 — Implementar retenção e exclusão

Aplicação: Plataforma / ambos os modelos • Frente: Evidências e privacidade • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: EVI-01, DEC-04. Responsável: a definir.

Conclui quando: Rotina e solicitações seguem política validada; testar expiração de links, remoção e preservação legal quando definida.

#### VIS-01 — Implementar vistorias e checklists

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: EVI-01, SERV-05. Responsável: a definir.

Conclui quando: Se selecionado para MVP, registrar vistoria/checklist, responsável, acesso, impedimentos e evidências por chamado/local. Síndico pode executar/atribuir mesmo sem portaria; nenhuma função automaticamente atribuída a portaria remota.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### END-01 — Implementar revisão e conclusão explicada

Aplicação: Plataforma / ambos os modelos • Frente: Evidências e privacidade • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: EVI-01, SYN-02, TIC-03, SERV-07. Responsável: a definir.

Conclui quando: Evidência e explicação checadas/revisadas pelo síndico ou revisor autorizado; preservar histórico, decisões pendentes e justificativa. Não exigir equipe local, segunda pessoa TRÍADE ou revisão por portaria remota.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### END-02 — Implementar contestação e reabertura

Aplicação: Plataforma / ambos os modelos • Frente: Chamados e prazos • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: END-01. Responsável: a definir.

Conclui quando: Motivo e autor preservados; chamado reaberto recebe responsável e próximo retorno sem apagar histórico.

### Fase 4 — WhatsApp e indicadores

Integrar o canal do morador e tornar comunicação e qualidade observáveis.

#### WA-01 — Implementar identificação e cadastro assistido

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-03, AUTH-02, SERV-07. Responsável: a definir.

Conclui quando: Requisito futuro: número institucional próprio de WhatsApp do prédio/condomínio como pré-requisito de adesão; providenciar se inexistente, sem usar automaticamente WhatsApp pessoal do síndico como canal institucional. Morador 100% WhatsApp, síndico painel web e avisos no WhatsApp dele. Integração/orientação de novo morador em condomínio já cliente explica regras existentes fornecidas/aprovadas pelo cliente e uso WhatsApp/sistema; cadastro breve nome, telefone, apartamento. CPF só se necessário ao financeiro, não obrigatório para funções básicas. Viabilidade técnica, provedor, conta/API, custos e migração não definidos; sem coleta ou implementação agora.

#### WA-02 — Implementar webhook autenticado e deduplicação

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-01, TIC-01. Responsável: a definir.

Conclui quando: Verificar autenticidade, registrar ID externo, tratar repetição e ordem; confirmação não cria chamados duplicados.

#### WA-03 — Implementar outbox e fila de envio

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-02, AUD-01. Responsável: a definir.

Conclui quando: Gravação transacional, retentativas limitadas e falhas visíveis; recebido, enviado e entregue distintos.

#### WA-04 — Implementar mensagens e disponibilidade por modelo

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-03, DEC-06, SERV-03. Responsável: a definir.

Conclui quando: Planejar/implementar futuramente retornos ao morador no WhatsApp e avisos ao síndico no WhatsApp sobre novo chamado/reclamação, nova solicitação e eventos relevantes a detalhar. Mapear evento/destinatário por vínculo, entrega/falha, tentativas e prevenção de duplicidade. Painel web é gestão; não presumir decisões pelo WhatsApp nem avisos de cada alteração técnica.

Revisão: Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.

#### WA-05 — Receber fotos e áudios pelo canal

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-02, EVI-01, DEC-04. Responsável: a definir.

Conclui quando: Mídia vinculada ao chamado com controles privados; áudio tratado conforme decisão, sem prometer transcrição não implementada.

#### WA-06 — Permitir consulta e pedido de revisão pelo morador

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-04, END-02, WA-01. Responsável: a definir.

Conclui quando: Jornada do morador 100% WhatsApp em todos os cenários, sem aplicativo/portal externo. Consultar só demandas autorizadas, retornar andamento e registrar revisão quando necessária. Síndico gere no painel web e recebe novidades relevantes no WhatsApp. Requisito futuro, sem integração entregue.

#### WA-07 — Testar integração em ambiente de testes

Aplicação: Plataforma / ambos os modelos • Frente: WhatsApp • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-05, WA-06. Responsável: a definir.

Conclui quando: Futuramente testar jornada 100% WhatsApp do morador, painel web do síndico e avisos WhatsApp de novo chamado/reclamação e solicitação. Verificar destinatários por vínculo, entrega/falha e duplicidade; outros eventos a detalhar. Não implementar nem contratar integração nesta revisão de materiais.

#### INC-01 — Implementar contingência e conciliação de atendimento

Aplicação: Plataforma / ambos os modelos • Frente: Operação por modelo • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-07, WA-03. Responsável: a definir.

Conclui quando: Responsável definido por modelo registra incidente, canal alternativo e conciliação; separar suporte técnico da plataforma do atendimento operacional contratado.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### MET-01 — Definir cálculo e base dos indicadores

Aplicação: Plataforma / ambos os modelos • Frente: Indicadores • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: PROD-05, TIC-04, END-02. Responsável: a definir.

Conclui quando: Definir tempo até triagem, atrasos, resolução, reabertura, recorrência e pendências; fuso, período e denominadores documentados.

#### MET-02 — Implementar painel e relatório por condomínio

Aplicação: Plataforma / ambos os modelos • Frente: Indicadores • Tipo: Implementação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: MET-01, TEN-01. Responsável: a definir.

Conclui quando: Indicadores reais com filtro por período e vínculo; exportação respeita acesso; distinguir falta de dados de zero.

### Fase 5 — Qualidade e infraestrutura

Verificar segurança, continuidade, acessibilidade e operação técnica.

#### QA-01 — Testar domínio e transições

Aplicação: Plataforma / ambos os modelos • Frente: Qualidade • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-04, SYN-02, END-02. Responsável: a definir.

Conclui quando: Cobrir prazos separados, pendências, duplicidades, justificativa, revisão e reabertura com cenários inválidos.

#### QA-02 — Testar decisões e eventos concorrentes

Aplicação: Plataforma / ambos os modelos • Frente: Qualidade • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SYN-02, WA-03. Responsável: a definir.

Conclui quando: Duas respostas simultâneas e retry não sobrescrevem decisão; histórico e outbox consistentes.

#### QA-03 — Testar anexos, isolamento e identidade no WhatsApp

Aplicação: Plataforma / ambos os modelos • Frente: Qualidade • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TEN-02, EVI-01, WA-06. Responsável: a definir.

Conclui quando: Acesso cruzado, mídia inválida, URL vencida, contato não validado e pedido de dado alheio são bloqueados.

#### QA-04 — Testar navegador, celular e acessibilidade

Aplicação: Plataforma / ambos os modelos • Frente: Experiência • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-05, WA-07, END-02. Responsável: a definir.

Conclui quando: Jornadas ponta a ponta, teclado, foco, rótulos, contraste, telas pequenas e erros verificadas com usuários.

#### QA-05 — Testar carga e falhas recuperáveis

Aplicação: Plataforma / ambos os modelos • Frente: Qualidade • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: WA-07, INC-01, DEC-05. Responsável: a definir.

Conclui quando: Volume estimado do piloto, lentidão, queda de provedor e fila com retentativas; incidentes têm responsável e instruções.

#### INF-01 — Preparar ambiente local e integração contínua

Aplicação: Plataforma / ambos os modelos • Frente: Infraestrutura • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TEC-01. Responsável: a definir.

Conclui quando: Build, migrações e verificações reproduzíveis; segredos protegidos; procedimento para futuras versões.

#### INF-02 — Planejar hospedagem e aprovar custos

Aplicação: Plataforma / ambos os modelos • Frente: Infraestrutura • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-05, INF-01. Responsável: a definir.

Conclui quando: Comparar alternativas, acesso, certificados, banco, armazenamento e custos; decisão revisável, sem contratação/publicação automática.

#### INF-03 — Preparar implantação autorizada e reversão

Aplicação: Plataforma / ambos os modelos • Frente: Infraestrutura • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: INF-02, QA-01, QA-03. Responsável: a definir.

Conclui quando: Após autorização específica: ambientes separados, TLS, migrações, reversão e controle de acesso testados.

Observação: Pendente de autorização futura para contratação, contas e publicação; não executado nesta entrega.

#### INF-04 — Implementar observabilidade e alertas

Aplicação: Plataforma / ambos os modelos • Frente: Infraestrutura • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: INF-01, WA-03. Responsável: a definir.

Conclui quando: Métricas de API/fila, erro de envio e indisponibilidade com logs sem segredos e responsável de resposta.

#### INF-05 — Testar backup e restauração

Aplicação: Plataforma / ambos os modelos • Frente: Infraestrutura • Tipo: Teste • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DB-01, DEC-04, INF-02. Responsável: a definir.

Conclui quando: Backup cifrado e restrito conforme política; restaurar em ambiente isolado e medir recuperação com objetivo aprovado.

### Fase 6 — Piloto e preparação da operação

Preparar pessoas, contratos, suporte e critérios de entrada e saída do piloto.

#### PIL-01 — Preparar termos, privacidade e contrato para revisão

Aplicação: Plataforma / ambos os modelos • Frente: Preparação da operação • Tipo: Validação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: DEC-06, DEC-04. Responsável: a definir.

Conclui quando: Revisão profissional dos termos da plataforma e, quando contratado, contrato separado do adicional com responsabilidades, dados e limites; sem preço ou contratação presumidos.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### PIL-02 — Preparar oferta do MVP a síndicos para teste

Aplicação: Plataforma / ambos os modelos • Frente: Preparação da operação • Tipo: Implementação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PIL-01, WA-01, DEC-01. Responsável: a definir.

Conclui quando: Depois do MVP, buscar alguns síndicos para teste e cadastrar participantes com vínculos e canal de emergência. Não há síndico/condomínio inicial disponível.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### PIL-03 — Treinar síndico e responsáveis do modelo escolhido

Aplicação: Plataforma / ambos os modelos • Frente: Preparação da operação • Tipo: Validação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: TIC-05, WA-07, VIS-01, INC-01, DEC-06. Responsável: a definir.

Conclui quando: Planejar assessoria atual: implantação de novo condomínio cliente, com equipe demonstrando e orientando passo a passo em reunião/assembleia acordada, em Brasília/DF. Integração/orientação de novo morador em condomínio já cliente explica regras existentes aprovadas/fornecidas, WhatsApp e sistema; cadastro breve nome, telefone, apartamento; CPF condicional ao financeiro. Sem requisito jurídico de assembleia, regra inventada ou exclusividade. Preço/pacote, frequência, capacidade, responsáveis e presencial/remoto da orientação a definir; sem contato/agenda/execução agora. Implantação de novo condomínio cliente também oferece apoio documental a atas, regras e documentos pertinentes: desenvolver se inexistentes; revisar/propor ajustes quando necessário. Condomínio aprova regras; atas refletem reuniões/decisões reais, sem fabricação retroativa. Sem regularização automática ou jurídico já contratado. Documentos abrangidos, responsáveis/revisão profissional quando aplicável e preço/pacote a definir. Não exigir documentação para todos os módulos/chamados; nenhum documento real criado agora.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### PIL-04 — Definir suporte técnico e suporte operacional

Aplicação: Plataforma / ambos os modelos • Frente: Preparação da operação • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: SERV-07, INF-04. Responsável: a definir.

Conclui quando: Distinguir suporte técnico da plataforma de execução operacional pelo síndico ou equipe adicional; responsáveis e cobertura definidos, sem obrigatoriedade do serviço humano.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### PIL-05 — Revisar prontidão e autorizar entrada do piloto

Aplicação: Plataforma / ambos os modelos • Frente: Piloto • Tipo: Decisão • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PIL-01, PIL-02, PIL-03, PIL-04, QA-01, QA-02, QA-03, QA-04, QA-05, INF-03, INF-05, MET-02. Responsável: a definir.

Conclui quando: Prontidão da plataforma: termos, treinamento do síndico, isolamento, comunicação, restauração e métricas verificados. Serviço humano não é pré-requisito; se contratado, aplicar ADD-05 antes do início do adicional.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### PIL-06 — Executar piloto assistido e medir resultados

Aplicação: Plataforma / ambos os modelos • Frente: Piloto • Tipo: Validação • Prioridade: P0 • Base: Pendente • Status inicial: A fazer.

Dependências: PIL-05. Responsável: a definir.

Conclui quando: Após aprovação: registrar volume, retornos, reaberturas, esforço humano e feedback; reuniões de revisão conforme combinado.

#### PIL-07 — Avaliar expansão e sustentabilidade do serviço

Aplicação: Plataforma / ambos os modelos • Frente: Piloto • Tipo: Decisão • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: PIL-06, PROD-05. Responsável: a definir.

Conclui quando: Avaliar sustentabilidade da plataforma e, separadamente, adicional humano: custo/capacidade, preço ainda a definir, riscos e melhorias; sem expansão automática.

Revisão: Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.

#### ADD-05 — Verificar prontidão do adicional humano, se contratado

Aplicação: Adicional humano opcional • Frente: Piloto • Tipo: Validação • Prioridade: P1 • Base: Pendente • Status inicial: A fazer.

Dependências: PIL-05, SERV-01, SERV-02, ADD-01, ADD-02, ADD-03, ADD-04. Responsável: a definir.

Conclui quando: Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. Antes de iniciar o adicional: pacote/limites/preço acordados, demandas, equipe, cobertura, capacidade, presença local e treinamento revistos. Não bloqueia piloto somente da plataforma.

## Pesquisa pública realizada — 07/10/2026
[Relatório de descoberta](pesquisa-publica-2026-10-07.md) e [síntese comercial](sintese-comercial-2026-10-07.md). Hipóteses a discutir antes de definir MVP; pesquisa não valida compradores nem autoriza implementação.

## Ajuste de contexto e visão de evolução — 07/10/2026
O cenário C01 confirmado pela usuária é um prédio simples, sem porteiro e sem operação de portaria, com porta de entrada, elevador e apartamentos. Visitas e entregas são tratadas diretamente pelo morador, como já acontece. Não presumir autorização de entrada, registro de visitantes, aviso automático de chegada ou controle de encomendas. Esses recursos ficam fora do recorte inicial desse caso e só são reavaliados diante de necessidade concreta. Sem porteiro com operação remota/equipamentos específicos é contexto distinto; isso não amplia automaticamente C01.

Núcleo candidato: rotina compartilhada — porta/elevador, iluminação, limpeza, manutenção e comunicação síndico-moradores — com pedido, responsável real, providência, andamento e conclusão. Identificar a organização existente em todos os cenários: atores, procedimentos adotados e necessidades reais. Manutenção pode já estar organizada em atas, regras internas, acordos ou contratos; verificar por prédio, sem regra jurídica ou presunção de ata obrigatória. Registro de referência existente, decisão ou responsável é opcional quando útil; não criar papel, equipe ou fluxo burocrático obrigatório. Critérios gerais de acesso/autorizações do backlog só se aplicam a necessidades efetivas do recorte, não são exigência de portaria para C01.

Visão de evolução: servir diferentes realidades, do prédio simples ao condomínio grande com muitos apartamentos, com ou sem portaria, disponibilizando funcionalidades adequadas a cada contexto, sem exigir todas de todos. A forma de disponibilizar os recursos permanece pendente de desenho; não foram escolhidos pacotes, preços ou arquitetura definitivos. MVP continua focado como etapa. Assessoria humana segue opcional; pesquisa precede MVP, sem oferta ou comprador validados. Este ajuste preserva IDs e decisões anteriores e não implementa produto, realiza nova pesquisa, publica ou contata terceiros.

## Jornada e notificações confirmadas — 07/10/2026
Em todos os cenários, o morador interage 100% pelo WhatsApp, sem aplicativo ou portal externo. O síndico tem painel web para gestão e recebe no próprio WhatsApp notificações de novidades relevantes, incluindo novo chamado/reclamação e nova solicitação de morador, evitando precisar manter o painel aberto. É requisito do produto para implementação futura, não integração entregue. Não presumir decisões/aprovações pelo WhatsApp nem notificações para cada alteração técnica. Detalhar eventos pertinentes, destinatários por vínculo, falha/entrega e prevenção de duplicidade, preservando a simplicidade da rotina. Outros tipos e regras de aviso continuam a detalhar.

## Atividades e módulos opcionais — 07/10/2026
Decisão de produto: atividades/módulos devem poder ser usados de forma independente, com pouca burocracia e ativação opcional pelo síndico. Compartilhar dados e relacionar atividades quando útil não cria dependência comercial nem percurso compulsório entre funções. Orçamento não exige pagamento/financeiro; chamados, evidências, checagem e reabertura não exigem financeiro ou cobrança. Usar orçamento ou outro módulo independente não obriga criar chamado, evidência ou checagem. Preservar vínculos essenciais de registro, identidade, autorização e coerência quando necessários, como uma evidência pertencente ao caso correto.

Controle financeiro e cobrança mensal do condomínio por boleto entram como possibilidades opcionais de evolução, que o síndico pode usar ou não. Não estão aprovados para MVP nem implementados. Provedor, fluxo de boleto, ativação e eventuais integrações serão pesquisados/desenhados futuramente; nenhuma pesquisa extra ou movimentação financeira nesta revisão. Não interpretar a visão ampla como suíte obrigatória ou escolher pacotes, preços ou arquitetura definitivos. Morador permanece exclusivamente WhatsApp; síndico com painel web e avisos WhatsApp. MVP focado e assessoria humana opcional permanecem.

## Armário de encomendas: hipótese após os primeiros clientes — 07/10/2026
A usuária decidiu adiar a idealização detalhada e a implantação de armário de encomendas para uma fase de ampliação futura, após os primeiros clientes. Fica fora do MVP, sem escopo aprovado. Hipótese discutida: locação a prédios/condomínios com sistema, manutenção/suporte e notificações ao morador via WhatsApp; viabilidade comercial ainda não confirmada.

Somente depois de haver clientes, avaliar no local necessidade, espaço e acesso do entregador, possibilidade externa/área separada/hall com integração, depósito, guarda, retirada individual e rastreabilidade, exceções e suporte, custos e responsabilidades. Não prometer ausência de extravio nem integração disponível. Não iniciar desenvolvimento, compra, parceria ou instalação. Esta decisão não cria operação de portaria no prédio simples, não torna o módulo obrigatório e preserva morador exclusivamente WhatsApp, síndico com painel/avisos WhatsApp, módulos opcionais e assessoria humana opcional. Registro apenas; sem pesquisa nova.

## WhatsApp institucional como pré-requisito de adesão — 08/10/2026
Para adquirir/usar a TRÍADE, o prédio ou condomínio deve ter WhatsApp próprio, com número institucional do prédio/condomínio. Se ainda não houver, providenciar esse número é pré-requisito da adesão. Não usar automaticamente WhatsApp pessoal do síndico como canal institucional e não inventar exceções ou burocracia adicional. Morador continua 100% WhatsApp, pelo canal institucional; síndico mantém painel web de gestão e recebe notificações no WhatsApp dele.

É requisito comercial e de jornada confirmado, não integração entregue. Viabilidade técnica do número para futura integração permanece a verificar. Provedor, tipo de conta/API, custos e migração não foram escolhidos. Não criar número/conta, pesquisar ou implementar nesta atualização. As demais decisões permanecem.

## Foco inicial Brasília/DF e entrada assistida — 08/10/2026
Foco inicial de atendimento escolhido pela usuária: Brasília/Distrito Federal. É definição comercial de atuação, sem demanda ou comprador validados. Ofertar implantação assistida como diferencial proposto: equipe vai a reunião/assembleia acordada com o cliente, demonstra o sistema e orienta passo a passo. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade competitiva.

Ofertar suporte de entrada de novos moradores, orientando uso do WhatsApp e funcionamento do serviço, com preparação/cadastro assistido conforme requisitos a detalhar. Não é registro de visitante ou aviso automático de chegada. Implantação/treinamento e suporte de entrada são distintos de assessoria operacional humana opcional, como triagem/vistoria. Preço/pacote, frequência, capacidade e responsáveis continuam a definir; presencial versus remoto para novos moradores também permanece aberto. Sem assumir contratação ou serviços ilimitados.

Preservar morador 100% WhatsApp, número institucional próprio do prédio como pré-requisito de adesão, síndico com painel web e notificações no WhatsApp dele. Esta revisão só registra materiais: sem pesquisa adicional, contratação, contato, agenda ou implementação.

## Apoio documental na implantação — 08/10/2026
A consultoria/assessoria de implantação de novo condomínio cliente inclui como diferencial proposto apoio à documentação do condomínio: atas, regras e documentos pertinentes. Se inexistentes, ajudar a desenvolver; se existentes, revisar e propor ajustes quando necessários. Não afirmar exclusividade de mercado. Apoio de redação/organização e propostas de ajuste são distintos da aprovação das regras pelo condomínio. Atas devem refletir reuniões e decisões efetivamente ocorridas, sem fabricar atas retroativas ou decisões. Não apresentar o apoio como regularização automática ou assessoria jurídica já contratada.

Documentos abrangidos, responsáveis, revisão profissional quando aplicável e preço/pacote continuam a definir. Documentação não se torna requisito compulsório para todos os módulos nem burocracia obrigatória por chamado. Orientar moradores pelas regras fornecidas/aprovadas pelo cliente, sem substituir documentos. Preservar implantação de novo condomínio cliente versus integração/orientação de novo morador em condomínio já cliente, cadastro breve nome/telefone/apartamento e CPF condicional à necessidade financeira, Brasília/DF, WhatsApp institucional e síndico painel/avisos. Apenas registro; nenhum documento real criado para cliente inexistente, pesquisa, contato ou implementação.

## Estrutura inicial de disponibilização por planos — 08/10/2026
A usuária decidiu criar níveis/planos de disponibilização de funcionalidades. A tabela descreve a estrutura inicial da oferta, sem nomes comerciais, preços ou composição final aprovados.

| Nível proposto (descrição, não nome comercial) | Direção de recursos | Fronteiras a definir |
| --- | --- | --- |
| Básico | Atendimento e controle | Recursos exatos, limites, nome e preço |
| Ampliação | Nível que inclua coordenação e agenda; adquirir mais funcionalidades conforme plano | Composição e limites; coordenação não implica equipe TRÍADE executar manutenção |
| Serviços associados e evolução | Implantação de novo condomínio cliente, integração/orientação de novo morador em condomínio já cliente e apoio documental | Inclusão em cada plano, preço/pacote, frequência e capacidade ainda a definir; financeiro/boleto seguem evolução a decidir, armário após primeiros clientes |

Plano define acesso comercial aos recursos, não dependências artificiais no fluxo. Funções continuam opcionais/autônomas dentro dos recursos disponibilizados: orçamento não exige pagamento e chamados não exigem financeiro. Compartilhar dados quando útil preserva vínculos essenciais de identidade, autorização e coerência, sem percurso compulsório. A decisão atual esclarece a pendência anterior de como disponibilizar recursos; composição final e arquitetura seguem abertas. Preservar cenários variados, Brasília/DF, número institucional próprio de WhatsApp como pré-requisito, morador 100% WhatsApp, síndico painel/avisos WhatsApp e assessoria atual de implantação/orientação. Apenas registros, sem pesquisa, preços inventados, MVP, divulgação ou contratação.


## Organização funcional para revisão — 08/10/2026

Esta direção substitui a apresentação anterior em básico/ampliação: primeiro organizar conjuntos coerentes, depois decidir nomes, níveis e preços. O síndico compõe seu plano por conjuntos de ferramentas. A proposta concreta está na seção “Conjuntos de ferramentas” do HTML comparativo. A planilha mantém o levantamento anterior como pesquisa, não como catálogo de subfunções contratáveis.

Atendimento completo inclui receber pelo WhatsApp, registrar, fila, responsável, prioridade, andamento, próximo retorno, estimativa de resolução quando disponível, conclusão e histórico. São componentes internos indispensáveis, sem remoção ou upgrade separado. Sem estimativa disponível, informar e combinar atualização; não prometer prazo inventado. Comunicados e documentos essenciais integram atendimento: morador recebe/consulta pelo WhatsApp; síndico prepara, publica e organiza no painel.

Proposta de conjuntos adicionais de controle: agenda/compromissos; coordenação de manutenção; gestão ampliada de comunicação e documentos. A fronteira ampliada pode incluir campanhas, arquivo administrativo, versões e revisão, preservando publicação/consulta essencial na base. Separar comunicação ampliada e documentos ampliados e separar agenda/manutenção são pontos a validar. Retorno de atendimento não depende de agenda; orçamento não depende de pagamento; coordenação não implica TRÍADE executar reparos. Cenários ilustram a mesma estrutura, com atores e necessidades distintos.

Morador exclusivamente WhatsApp institucional próprio (requisito); síndico painel e notificações. Brasília/DF mantido. Implantação, orientação de moradores e apoio documental são serviços com inclusão/preço a definir, distintos de disponibilizar documentos no sistema. Financeiro/boletos continuam futuros opcionais; armário somente após primeiros clientes. Sem implementação, publicação ou preços definidos.


### Separação de produto, operação TRÍADE e desenvolvimento — 08/10/2026

O HTML agora distingue três áreas: produto do condomínio (ações síndico/painel e morador/WhatsApp em cada conjunto e composição); operação interna TRÍADE (execução humana e controles de clientes restritos à equipe); desenvolvimento (planejamento ainda não executado). Implantação é onboarding do cliente TRÍADE, não módulo de gestão de clientes para síndico/morador. Equipe organiza/elabora/revisa documentos conforme escopo; condomínio fornece/valida/aprova; versão final disponibilizada no produto conforme permissões, sem expor notas internas. Software futuro apoia execução humana, não a substitui. Apoio a novos moradores preservado. Acesso interno da equipe e compartilhamento explícito de entregas exigem validação e futura implementação; não há área interna já disponível.


### Ideia em avaliação: plaquinha QR para aviso de chegada — 08/10/2026

Sugestão da usuária para prédio sem porteiro, uma porta e eventualmente sem campainha: visitante/entregador escaneia QR, informa apartamento e sistema futuro tenta avisar o morador de alguém aguardando na entrada. Perfil público visitante/entregador separado; morador mantém WhatsApp, sem app/portal. WhatsApp ou ligação, viabilidade, custos/provedor a avaliar; ligação não altera canal-base. Contato não autoriza entrada nem abre porta. Não expor telefone, cadastro, lista de moradores ou confirmar publicamente identidade/presença; roteamento interno e resposta pública neutra. Avaliar privacidade, abuso/limites, validação de apartamento, falhas e alternativa de contato; sem promessa de entrega imediata. Serviço físico de produção/instalação/manutenção da plaquinha separado do desenvolvimento futuro do formulário, roteamento e aviso; responsabilidades/preço a definir. Não aprovado para MVP nem implementado; independente de armários, que continuam futuros após primeiros clientes. A restrição anterior a presumir aviso de chegada no C01 permanece para o recorte inicial; esta é uma nova hipótese explícita de evolução para avaliar.


### Avaliação de chamada local e contatos múltiplos — 08/10/2026

Razão: um titular pode estar fora enquanto outra pessoa está na unidade. QR continua hipótese; não presumir presença nem depender de um único WhatsApp. Avaliar vários contatos autorizados por unidade, preferências/roteamento, horários, revogação e limites. Ligação/receptor local complementam aviso de chegada; rotina mantém WhatsApp.

Alternativas delimitadas, com fatos oficiais e inferências separadas no HTML: interfone coletivo cabeado com terminal local (chamada sem QR/internet; energia/fiação/terminal); campainha por rádio com receptor sonoro (tomada, pareamento/alcance real a testar); QR/WhatsApp com múltiplos contatos (rede/provedor/custos); QR/backend integrado a sinal sonoro via controlador compatível (hipótese com engenharia, energia/rede/API/permissões e testes). Campainha comum não aceita acionamento por software automaticamente; compatibilidade TRÍADE/CIK/Collective/Shelly não demonstrada. Shelly Pro 1 v.1 tem restrições AC/DC específicas: não presumir aptidão a circuito de baixa tensão. Avaliação presencial/instalador necessário antes de escolha/custo/instalação. Sem abrir porta, identificar presença, comprar ou implementar.

Fontes: [Manual Collective](https://backend.intelbras.com/sites/default/files/2026-01/Manual_Collective_16i_20i_24i_01-26_site%20%281%29.pdf), [CIK 102](https://loja.intelbras.com.br/campainha-sem-fio-sembateria-cik102branca-intelbras/p), [Shelly Pro 1](https://us.shelly.com/products/shelly-pro-1?variant=49666062942549), [API Switch](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/). Conferência 08/10/2026; exemplos técnicos, não recomendação de compra.


Planejamento dos dois painéis detalhado na pasta da raiz [estruturação do sistema](../../../estruturação%20do%20sistema/README.md): Carolina gerencia todos os clientes e libera conjuntos inteiros por contratação; síndico usa somente dados/recursos do próprio condomínio. Morador exclusivamente WhatsApp, sem painel/login. Configuração proporcional de responsáveis, prioridades, etapas e retornos, preservando histórico/permissões; processos distintos não exigem fluxo universal. HTML da pasta é simulação revisável, sem produto/autenticação/integração implementados.

## Sessões de execução por tarefa

Iniciar sessão registra data/horário atual do navegador. Finalizar exige breve resumo do executor; não conclui nem aceita tarefa. Retomada cria nova sessão. Histórico mostra início/fim/resumo em horário local legível; tarefas antigas sem registro continuam sem horário. Ajuste manual exige motivo e mantém versão anterior no histórico. Esses horários não comprovam trabalho e dependem do relógio local.

Sessões integram o JSON de exportação, validação e mesclagem. Mesmo ID com versões diferentes mantém local e guarda alternativa no histórico; duas sessões abertas distintas em conflito guardam a importada no histórico para reconciliação, sem criar duas sessões abertas na tarefa. Manter backup e revisar antes de compartilhar.

## Pendências da auditoria

[Revisão técnica](../../../estruturação%20do%20sistema/relatorio-revisao-desenvolvimento.md) e tarefas AUD-02 a AUD-08 no painel orientam decisões antes dos módulos. Produto não iniciado; início/fim de sessão não equivale a aceite. Contagem atual: 109 tarefas, mantendo 80 históricas e 21 MVP.

## Ajuste aprovado: ficha e delegados por condomínio

Carolina mantém ficha editável na implantação e depois: pessoas autorizadas/acesso próprio, função/permissões individuais, responsáveis e dias/horários de funcionamento/atendimento/mensagem fora do expediente. Secretária pode acompanhar/responder conforme permissão; regras por cliente e histórico de autor/instante/antes/depois. Aprovação despesas reservada síndico como limite futuro, sem incluir módulo no MVP. Ver [especificação](../../../estruturação%20do%20sistema/especificacao-mvp.md) e [protótipo](../../../estruturação%20do%20sistema/prototipo-paineis.html). Demais recomendações não aprovadas automaticamente; backend/auth não implementados.
