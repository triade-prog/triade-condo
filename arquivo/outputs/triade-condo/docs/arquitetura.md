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

# Desenho técnico modular

## Decisão vigente — orçamentos/propostas fora do desenvolvimento inicial (08/10/2026)

A usuária decidiu não desenvolver propostas/orçamentos agora. Retirados dos conjuntos e exemplos de plano inicial no HTML. A pesquisa e o fluxo anteriormente proposto permanecem apenas como referência futura, sob necessidade surgida e validada nos primeiros clientes, sem compromisso de construção. Esta decisão prevalece sobre sugestões anteriores de incluir registro/comparação de propostas no recorte inicial.

Se necessário, acompanhar uma pendência por tarefa simples existente ou processo acordado, sem construir comparação, aprovação de cotações, portal do fornecedor ou módulo próprio disfarçado. Isso não atribui à TRÍADE seleção de fornecedores, contratação ou compra pelo condomínio. Atendimento completo, agenda/manutenção e fronteiras de comunicação/documentos continuam em revisão; perfis e operação interna permanecem separados.


## Assessoria atual e terminologia confirmadas — 08/10/2026
Este esclarecimento prevalece sobre o enquadramento anterior: a assessoria da oferta atual concentra-se na **implantação de novo condomínio cliente** (prédio/condomínio que contrata o sistema), com demonstração e orientação passo a passo em reunião/assembleia acordada, e na **integração/orientação de novo morador em condomínio já cliente**, reduzindo trabalho do síndico. “Novo cliente” significa condomínio, não morador. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade.

Na orientação do novo morador, explicar regras existentes aprovadas/fornecidas pelo cliente, mostrar uso do WhatsApp e funcionamento do sistema e realizar cadastro breve com nome, telefone e apartamento. Não inventar regras nem substituir documentos do prédio. CPF é possibilidade condicional à necessidade do módulo financeiro, não obrigatório para funções básicas; sem coleta real agora ou interpretação de regra legal. Preço/pacote, frequência, capacidade, responsáveis e presencial versus remoto para novos moradores continuam a definir.

Assessoria operacional recorrente (triagem, vistoria, acompanhamento/manutenção) permanece apenas hipótese opcional futura, claramente distinta, sem inclusão automática na oferta atual. Descrições anteriores desse modelo não significam serviço vigente ou obrigação de execução. Preservar Brasília/DF, morador exclusivamente WhatsApp, número institucional próprio como pré-requisito, síndico painel web e avisos no WhatsApp dele, módulos independentes e MVP focado. Apenas materiais atualizados; sem pesquisa, contato, contratação ou implementação.


## Pressupostos iniciais
Protótipo: HTML, CSS e JavaScript em módulos nativos, sem dependências. Servidor local Python apenas para arquivos estáticos. Dados fictícios em memória; recarregar reinicia alterações. Nenhuma autenticação, envio de mensagem, upload ou integração real. Seletor de perfil e filtro de condomínio demonstram jornadas, não segurança.

Stack futura proposta, sujeita à equipe e orçamento: frontend TypeScript; API modular Node/TypeScript; PostgreSQL; armazenamento privado de anexos; fila para integrações. Começar monólito modular e separar serviços só quando necessário.

## Módulos
Identidade/permissões → clientes e condomínios → chamados/triagem → tarefas e prazos → decisões → evidências/revisão → comunicação → indicadores/auditoria.

Cada chamado pertence a um condomínio e cliente. A API deriva tenant e permissões da sessão e confere vínculo em toda operação. Identificadores fornecidos pelo cliente não autorizam acesso. RLS pode complementar controles de aplicação. Anexos privados usam URLs temporárias, verificadas pelo vínculo. Perfis: morador identificado no canal WhatsApp e limitado às próprias demandas, sem portal; prestador às tarefas atribuídas; síndico ao condomínio autorizado com capacidades de triagem, atribuição, acompanhamento, checagem e revisão/conclusão; operador TRÍADE somente aos vínculos autorizados do adicional contratado; gestor somente aos vínculos autorizados, sem acesso automático a toda a base.

## Entidades
Tenant, Condominium, User, Membership, Ticket, Assignment, DecisionRequest, Evidence, StatusEvent, Communication, Inspection, ChecklistItem. Ticket contém nextResponseAt e estimatedResolutionAt independentes. Eventos têm autor, data, estado anterior e justificativa. DecisionRequest contém alternativas, valor estimado, decisão e justificativa; não inicia transação financeira.

## Estados
Recebido → Em triagem → Em andamento → Aguardando fornecedor/equipe/morador/síndico → Em revisão → Concluído. Contestação leva Concluído a Em andamento preservando os eventos. Pendência exige responsável e motivo. Fechamento exige evidência e explicação revisadas; histórico não pode ser editado pelo usuário comum.

## Contratos de API propostos
POST /tickets; GET /tickets; GET /tickets/:id; POST /tickets/:id/events; POST /tickets/:id/communications; POST /tickets/:id/evidence; POST /tickets/:id/review; POST /tickets/:id/reopen; POST /decisions/:id/respond. Escritas usam validação de estado, autorização e controle de versão contra conflitos.

## WhatsApp/BotConversa — integração futura
Webhook autenticado → identificar condomínio/morador → deduplicar por ID externo → registrar demanda → enfileirar confirmação. Outbox transacional e retries com limite; falhas visíveis ao síndico ou responsável autorizado da rotina. Respeitar consentimento, políticas e restrições do provedor a validar. Não confiar em número de telefone como único mecanismo de autorização para decisões. Separar recebido, enviado e entregue; confirmação automática não promete atendimento humano imediato.

## Serviço humano opcional
Vistoria associa checklist, local, responsável, data e evidência ao chamado. Registrar quando visita depende de acesso do morador ou prestador. Fotos e custos devem passar por controles de acesso e retenção definidos antes do piloto.

## Validação antes de piloto real
Testar isolamento entre clientes, permissões, anexos, auditoria, concorrência em decisões, webhook duplicado, falha de envio, reabertura e prazos. Definir backups/restauração, observabilidade, retenção, exclusão e revisão profissional de termos e privacidade. Não usar este protótipo com dados reais.

O painel web permite ao síndico operar a jornada completa sem equipe TRÍADE. Gestão/operação TRÍADE são opcionais e dependem de vínculos autorizados e adicional contratado. Prestadores podem ser coordenados pelo síndico ou executor autorizado; acesso próprio de prestador continua pendente. O adaptador WhatsApp deve suportar mídia, consulta de status e revisão, validando identidade e vínculo antes de divulgar informações. Áudios exigem decisão futura sobre tratamento/transcrição e retenção.

## Dois modelos — requisito registrado em 07/10/2026
A futura configuração por condomínio deve distinguir plataforma conduzida pelo síndico de plataforma com adicional humano contratado. Modelo comercial e vínculo de atendimento não concedem permissão automaticamente; autorização continua no servidor. Nenhuma etapa de triagem, acompanhamento, checagem de evidências, revisão ou conclusão pode exigir usuário operador TRÍADE no modelo plataforma. O síndico pode acumular execução da rotina e revisão, preservando autoria e histórico; separação obrigatória entre duas pessoas não foi definida. Decisões continuam sujeitas à autoridade do condomínio.

Banco/API/permissões futuros precisam representar responsáveis por atividade e modelo, disponibilidade, equipe adicional e alterações de vínculo. Encerramento ou mudança do adicional deve revogar acessos apropriados sem perder histórico nem impedir uso da plataforma. Testar ambas as jornadas, inclusive condomínio sem qualquer operador TRÍADE. Não implementado nesta atualização.

Disponibilidade humana e mensagens dependem do responsável/modelo configurado. Recebimento automático não promete equipe TRÍADE, nem socorro ou cobertura ilimitada. Pendências: matriz de execução por modelo; composição da equipe; demandas cobertas; horários/cobertura/substituição; quantidade/capacidade de condomínios; atividades presenciais; pacote, limites e preço. O desenho não define valores comerciais.

O protótipo operacional antigo representa uma simulação de assessoria com visão Operação e visão Síndico restrita a decisões; ainda não demonstra a jornada completa do síndico sozinho. Ajustá-lo/testá-lo é trabalho futuro, não entregue por este registro de definição.

## Prioridade de descoberta comercial — 07/10/2026
Primeiro estruturar o que será vendido, a quem, como vender e qual necessidade real será atendida. Ainda não existe público validado nem oferta comercial definida. Personas e escopo técnico são hipóteses. Só depois definir e codificar o MVP; evolução futura fica para depois. O plano/catalogo é backlog de possibilidades, não MVP aprovado nem autorização para implementar agora. O protótipo permanece como apoio à descoberta; esta atualização apenas registra a direção e as pendências.

## Caminho de descoberta escolhido — 07/10/2026
Não há síndico/condomínio inicial disponível. A descoberta inicial usa ofertas concorrentes e relatos públicos na web para formular hipóteses de necessidade, público, oferta e venda. Isso não valida demanda ou disposição a pagar. Não exigir entrevistas prévias. Depois definir e desenvolver MVP focado e oferecê-lo a alguns síndicos para teste. Testes com síndicos vêm após o MVP. Nenhuma pesquisa extensa ou implementação foi executada nesta atualização.

## Cenários de descoberta — definição de 07/10/2026
Pesquisar edifícios residenciais com portaria presencial/atendente, portaria online/remota e sem qualquer portaria. Incluir prédios de vários andares e apartamentos com gestão por síndico morador e pouca estrutura operacional. A expressão “nem é condomínio, é um prédio” descreve essa pouca estrutura; não permite inferir classificação jurídica.

| Cenário a pesquisar | Questões de fluxo e oferta |
| --- | --- |
| Portaria presencial/atendente | Quais tarefas esse responsável realmente executa? Quem faz triagem, combina acesso, acompanha manutenção e coleta evidências? Ter portaria não garante zelador, equipe ou revisão. |
| Portaria online/remota | Quem está disponível presencialmente para manutenção/vistoria? Como combinar acesso? O serviço de portaria não é automaticamente responsável por manutenção ou revisão; integração técnica com fornecedor não é presumida. |
| Prédio simples sem operação de portaria | Identificar organização existente da rotina comum e da manutenção. Visitas/entregas diretamente com moradores; sem autorização de entrada, visitante ou aviso de chegada presumidos. |

Não presumir porteiro, zelador, equipe local, administradora ou prestador fixo em nenhum cenário. Na plataforma conduzida pelo síndico, ele pode executar ou atribuir triagem, acompanhamento, acesso à manutenção, vistoria, coleta/checagem de evidências, revisão e comunicação a responsáveis efetivamente disponíveis/autorizados. A ausência de equipe não obriga contratar assessoria humana TRÍADE. Quando necessária, presença local e seus executores/limites são questões a definir, não promessas de envio.

Questões a pesquisar: diferenças das dores, fluxos, responsáveis disponíveis e impacto na oferta entre cenários; quem pode viabilizar acesso e em quais horários; quem pode coletar evidência e acompanhar visita; como tratar ausência de executor e comunicar pendências; quais limites cabem na plataforma e no adicional opcional.

São cenários amplos da descoberta, não escopo obrigatório de um MVP para todos. Pesquisa pública formula hipóteses; depois escolher recorte, estruturar oferta e definir/desenvolver MVP focado para oferecer a alguns síndicos em teste. Nenhuma pesquisa extensa, integração com portaria ou funcionalidade foi implementada nesta atualização.

No desenho futuro, papéis e responsáveis dependem dos vínculos disponíveis, não do tipo de portaria. Representar ausência de executor/acesso como pendência, sem atribuição fictícia. Perfil operacional e rótulo técnico condomínio não determinam classificação jurídica. Configuração de cenários, controles específicos ou integração de portaria só serão considerados após escolha do recorte; nenhum conector de portaria é exigência atual.

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


Aprofundamento de cotações registrado em 08/10/2026: nova seção HTML e pesquisa aprofundamento-cotacoes-propostas-2026-10-08.md. Fluxo proposto simples de necessidade, propostas/anexos, comparação, decisão, aceite/resultado e histórico, autônomo de financeiro/pagamento e vínculo opcional com manutenção. Perfis síndico painel, morador WhatsApp com resumo autorizado, fornecedor canal combinado/link futuro, equipe TRÍADE separada. Revisão preserva versão; regras de aprovação conforme organização real, sem três/ata universais. Proposta para revisão, sem implantação do produto.


Planejamento dos dois painéis detalhado na pasta da raiz [estruturação do sistema](../../../estruturação%20do%20sistema/README.md): Carolina gerencia todos os clientes e libera conjuntos inteiros por contratação; síndico usa somente dados/recursos do próprio condomínio. Morador exclusivamente WhatsApp, sem painel/login. Configuração proporcional de responsáveis, prioridades, etapas e retornos, preservando histórico/permissões; processos distintos não exigem fluxo universal. HTML da pasta é simulação revisável, sem produto/autenticação/integração implementados.

## Ajuste aprovado: ficha e delegados por condomínio

Carolina mantém ficha editável na implantação e depois: pessoas autorizadas/acesso próprio, função/permissões individuais, responsáveis e dias/horários de funcionamento/atendimento/mensagem fora do expediente. Secretária pode acompanhar/responder conforme permissão; regras por cliente e histórico de autor/instante/antes/depois. Aprovação despesas reservada síndico como limite futuro, sem incluir módulo no MVP. Ver [especificação](../../../estruturação%20do%20sistema/especificacao-mvp.md) e [protótipo](../../../estruturação%20do%20sistema/prototipo-paineis.html). Demais recomendações não aprovadas automaticamente; backend/auth não implementados.
