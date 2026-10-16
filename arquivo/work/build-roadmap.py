from pathlib import Path
import json
r=Path('outputs/triade-condo')
phases=[('0','Base recuperada','Inventariar documentos e protótipo, sem tratar simulação como produto em produção.'),('1','Validar produto e serviço','Definir escopo, responsabilidades, canais e capacidade a partir de hipóteses de fontes públicas; testes com síndicos após o MVP.'),('2','Fundação técnica','Preparar identidade, isolamento, dados e API antes de usar dados reais.'),('3','Operação de chamados','Implementar acompanhamento, prazos, decisões, vistorias e encerramento.'),('4','WhatsApp e indicadores','Integrar o canal do morador e tornar comunicação e qualidade observáveis.'),('5','Qualidade e infraestrutura','Verificar segurança, continuidade, acessibilidade e operação técnica.'),('6','Piloto e preparação da operação','Preparar pessoas, contratos, suporte e critérios de entrada e saída do piloto.')]
rows=[]
def add(id,phase,front,title,criteria,deps='',priority='P1',kind='Implementação',base='Pendente',evidence='',note=''):
 rows.append(dict(id=id,phase=phase,front=front,title=title,criteria=criteria,deps=deps.split() if deps else [],priority=priority,kind=kind,baseline=base,status='Concluída' if base in ['Documentado','Simulado','Implementado localmente'] else 'A fazer',owner='',notes=note,evidence=evidence,updatedAt=''))
add('BASE-01','0','Produto','Recuperar documento de produto','Personas, jornada, limites e MVP disponíveis para revisão.',base='Documentado',evidence='../docs/produto.md',kind='Documento')
add('BASE-02','0','Arquitetura e dados','Recuperar desenho modular','Entidades, API proposta, isolamento e integrações descritos; stack é hipótese.',base='Documentado',evidence='../docs/arquitetura.md',kind='Documento')
add('BASE-03','0','Experiência','Preservar protótipo operacional','Demonstração de demandas, decisões, retorno, revisão e reabertura em dados fictícios.',base='Simulado',evidence='../prototype/index.html',kind='Protótipo',note='Filtros e perfis não implementam autorização; alterações em memória; evidência apenas textual.')
add('BASE-04','0','Qualidade','Registrar verificações iniciais','Sintaxe e regras pontuais verificadas; limites de validação registrados.',base='Documentado',evidence='../docs/validacao.md',kind='Documento')
add('BASE-05','0','Gestão do projeto','Criar plano detalhado da execução','Todo escopo recuperado aparece com tarefas, critérios e dependências.',base='Documentado',evidence='../docs/plano-execucao.md',kind='Documento')
add('BASE-06','0','Gestão do projeto','Criar painel local da construção','Busca, filtros, edição, persistência, exportação e importação disponíveis; testes registrados.',base='Implementado localmente',evidence='index.html',kind='Ferramenta local',note='Sem servidor de dados ou colaboração multiusuário. Conclusões registradas não são certificação independente.')
add('PROD-01','1','Produto','Entrevistar Gabriela e síndicos sobre a rotina','Registrar demandas, volume, gargalos e rotina atual em entrevistas consentidas.','BASE-01','P0','Validação')
add('PROD-02','1','Produto','Priorizar o escopo do piloto','Lista aprovada de categorias, canais, ações atendidas e exclusões; todo novo pedido entra na fila de mudanças.','PROD-01','P0','Decisão')
add('PROD-03','1','Produto','Validar diferenciação e referências de mercado','Fontes datadas e escopos comparáveis registrados; relatos exploratórios não viram afirmações de prevalência.','PROD-01',kind='Validação')
add('PROD-04','1','Experiência','Testar jornada de morador e painel com usuários','Percorrer abertura, atualização, decisão, conclusão e contestação; registrar problemas e ajustes priorizados.','BASE-03 PROD-02','P0','Validação')
add('PROD-05','1','Produto','Definir critérios e métricas de sucesso do piloto','Estabelecer medição inicial, metas acordadas e critérios de suspensão/expansão sem prometer resultados.','PROD-01',kind='Decisão')
add('SERV-01','1','Serviço humano','Definir pacote de assessoria e limites','Escopo de triagem, cobrança, vistorias e prestadores definido; representação, pagamentos e multas fora das ações autônomas.','PROD-02','P0','Decisão')
add('SERV-02','1','Serviço humano','Definir horário humano, cobertura e substituição','Escala, capacidade estimada, responsáveis substitutos e mensagem fora do horário aprovados.','SERV-01','P0','Decisão')
add('SERV-03','1','Serviço humano','Definir emergência e escalonamento','Canal de emergência de cada condomínio documentado; mensagem de orientação e escalonamento testada sem prometer socorro TRÍADE.','SERV-01','P0','Decisão')
add('SERV-04','1','Serviço humano','Definir prazos por categoria e regras de pausa','Matriz distingue retorno de resolução, feriados, pendências e atualização de estimativa com justificativa.','SERV-02 PROD-02','P0','Decisão')
add('SERV-05','1','Serviço humano','Criar procedimentos e checklists de vistoria','Modelos por categoria com acesso ao local, responsável, fotos necessárias e revisão da evidência.','SERV-01')
add('SERV-06','1','Serviço humano','Definir cadastro de prestadores e cobrança','Escopo, contatos, tarefa, prazo e impedimentos registrados; operação coordena prestadores no MVP.','SERV-01',kind='Decisão')
add('SERV-07','1','Serviço humano','Definir encerramento, contestação e incidente técnico','Revisor e critérios definidos; atendimento continua por canal alternativo com dono do incidente e conciliação posterior.','SERV-03 SERV-04','P0','Decisão')
add('DEC-01','1','Identidade e permissões','Aprovar matriz de acesso e autoridades de decisão','Síndico, operador e gestor possuem vínculos explícitos; limites de autorização e assembleia documentados por condomínio; decidir necessidade de acesso de prestador.','PROD-02','P0','Decisão')
add('DEC-02','1','Arquitetura e dados','Escolher stack e ambientes de desenvolvimento','Confirmar ou substituir proposta TypeScript/Node/PostgreSQL; registrar equipe, custos estimados e critérios, sem contratar.','BASE-02','P0','Decisão')
add('DEC-03','1','WhatsApp','Escolher estratégia WhatsApp/BotConversa','Validar funções, webhook, mídia, restrições, custos e ambiente de testes; escolha não conecta contas reais.','PROD-02','P0','Decisão')
add('DEC-04','1','Evidências e privacidade','Definir retenção, áudio e privacidade','Decidir transcrição de áudio, armazenamento, acesso, consentimento quando aplicável, exclusão e tratamento de fotos; revisão profissional planejada.','SERV-05 DEC-03','P0','Decisão')
add('DEC-05','1','Gestão do projeto','Definir equipe, orçamento e cronograma','Nomear responsáveis e capacidade; estimar esforço após decisões; aprovar sequência e datas sem inventar compromissos.','PROD-02 DEC-02 SERV-02','P0','Decisão')
add('TEC-01','2','Arquitetura e dados','Estruturar aplicação e configuração','Separar frontend, API, domínio e adaptadores; configuração por ambiente, segredos fora do código e verificação automática.','DEC-02','P0')
add('DB-01','2','Arquitetura e dados','Modelar banco e migrações','Tenant, condomínio, usuário, vínculo, chamado, decisão, evidência, eventos, comunicação, vistoria e checklist com chaves e índices.','TEC-01 DEC-01','P0')
add('DB-02','2','Arquitetura e dados','Criar dados fictícios e ambientes separados','Múltiplos clientes/condomínios no ambiente de testes; nenhuma cópia de dados reais para desenvolvimento.','DB-01','P0')
add('AUTH-01','2','Identidade e permissões','Implementar login e sessão de síndico/operação','Login, logout, expiração, recuperação e revogação verificados; morador não recebe portal principal.','TEC-01 DEC-01','P0')
add('AUTH-02','2','Identidade e permissões','Implementar permissões e vínculos no servidor','Cada endpoint valida função e condomínio; perfil do navegador não concede acesso; gestão só vê vínculos autorizados.','AUTH-01 DB-01','P0')
add('TEN-01','2','Isolamento','Implementar isolamento de clientes e condomínios','Tenant derivado da sessão; consultas, escritas, buscas, relatórios e anexos validam vínculo; avaliar RLS como complemento.','AUTH-02','P0')
add('API-01','2','Arquitetura e dados','Implementar contratos e validação de API','Rotas de chamados, eventos, comunicação, evidência, revisão, reabertura e decisões com esquema, paginação, erros e controle de versão.','DB-01 TEN-01','P0')
add('AUD-01','2','Arquitetura e dados','Implementar histórico e auditoria','Eventos persistem autor, data, versão e alteração; usuário comum não edita eventos anteriores; evitar dados sensíveis desnecessários nos logs.','API-01','P0')
add('TEN-02','2','Isolamento','Testar acesso cruzado entre clientes','Testes negativos em listagem, detalhe, edição, decisão, anexo e relatório bloqueiam IDs de outro cliente e condomínio.','TEN-01 API-01','P0','Teste')
add('TIC-01','3','Chamados e prazos','Persistir recebimento e protocolo','Todo chamado contém cliente, condomínio, local, categoria, descrição e protocolo único; validação de campos e identificador externo.','API-01 AUD-01','P0')
add('TIC-02','3','Chamados e prazos','Implementar triagem e atribuição','Operador registra urgência, dados faltantes, possível duplicidade, responsável e motivo de encaminhamento.','TIC-01 SERV-04','P0')
add('TIC-03','3','Chamados e prazos','Implementar estados e pendências','Transições válidas; pendência de fornecedor, equipe, morador ou síndico exige responsável e motivo.','TIC-02 SERV-07','P0')
add('TIC-04','3','Chamados e prazos','Implementar dois relógios e alertas de retorno','Próximo retorno independente da estimativa de resolução; mudança exige histórico; regras de horário e pausa implementadas.','TIC-03 SERV-04','P0')
add('TIC-05','3','Experiência','Construir painel real de acompanhamento','Fila, detalhe, filtros, responsável editável, erros e carregamento ligados à API; remover datas fixas de demonstração na aplicação real.','TIC-04 AUTH-02 PROD-04','P0')
add('TIC-06','3','Chamados e prazos','Relacionar duplicidades e reincidências','Relacionar relatos conservando protocolos/histórico; reincidência por local/categoria é sinal de investigação e não causa confirmada.','TIC-02')
add('SYN-01','3','Decisões do síndico','Criar solicitação de autorização','Operação registra alternativas, custo estimado, prazo e evidência; fila do síndico mostra decisões necessárias.','TIC-03 DEC-01','P0')
add('SYN-02','3','Decisões do síndico','Persistir aprovação/devolução autorizada','Autoria e justificativa obrigatórias; versão impede resposta dupla; sem contratação ou transação financeira automática.','SYN-01 AUD-01','P0')
add('EVI-01','3','Evidências e privacidade','Implementar upload privado e controles de mídia','Validar tipo/tamanho/conteúdo, acesso por vínculo e links temporários; definir verificação de arquivos; impedir exposição pública.','TEN-01 API-01 DEC-04','P0')
add('EVI-02','3','Evidências e privacidade','Implementar retenção e exclusão','Rotina e solicitações seguem política validada; testar expiração de links, remoção e preservação legal quando definida.','EVI-01 DEC-04')
add('VIS-01','3','Serviço humano','Implementar vistorias e checklists','Visita associada a chamado/local, responsável, data, acesso e checklist; impedimentos e fotos rastreáveis.','EVI-01 SERV-05')
add('END-01','3','Evidências e privacidade','Implementar revisão e conclusão explicada','Execução vai à revisão; concluir exige evidência válida e explicação revisada; decisão pendente impede conclusão incompatível.','EVI-01 SYN-02 TIC-03 SERV-07','P0')
add('END-02','3','Chamados e prazos','Implementar contestação e reabertura','Motivo e autor preservados; chamado reaberto recebe responsável e próximo retorno sem apagar histórico.','END-01','P0')
add('WA-01','4','WhatsApp','Implementar identificação e cadastro assistido','Relacionar contato ao condomínio/morador; tratar múltiplos vínculos e contato desconhecido; validar identidade antes de divulgar status.','DEC-03 AUTH-02 SERV-07','P0')
add('WA-02','4','WhatsApp','Implementar webhook autenticado e deduplicação','Verificar autenticidade, registrar ID externo, tratar repetição e ordem; confirmação não cria chamados duplicados.','WA-01 TIC-01','P0')
add('WA-03','4','WhatsApp','Implementar outbox e fila de envio','Gravação transacional, retentativas limitadas e falhas visíveis; recebido, enviado e entregue distintos.','WA-02 AUD-01','P0')
add('WA-04','4','WhatsApp','Implementar mensagens e horário humano','Protocolo, andamento sem solução, pendências e conclusão usam textos aprovados; recebimento automático distingue horário humano e emergência.','WA-03 SERV-02 SERV-03','P0')
add('WA-05','4','WhatsApp','Receber fotos e áudios pelo canal','Mídia vinculada ao chamado com controles privados; áudio tratado conforme decisão, sem prometer transcrição não implementada.','WA-02 EVI-01 DEC-04')
add('WA-06','4','WhatsApp','Permitir consulta e pedido de revisão pelo morador','WhatsApp consulta somente demandas autorizadas, oferece retorno e registra contestação/reabertura; nenhum login de morador exigido.','WA-04 END-02 WA-01','P0')
add('WA-07','4','WhatsApp','Testar integração em ambiente de testes','Percorrer texto, mídia, entrega, duplicação, identidade ambígua e falha; documentar limites reais do provedor escolhido.','WA-05 WA-06','P0','Teste')
add('INC-01','4','Serviço humano','Implementar contingência e conciliação de atendimento','Operação registra incidente, dono, canal alternativo e demandas recebidas na falha; reconciliar sem perder/duplicar protocolos.','SERV-07 WA-03','P0')
add('MET-01','4','Indicadores','Definir cálculo e base dos indicadores','Definir tempo até triagem, atrasos, resolução, reabertura, recorrência e pendências; fuso, período e denominadores documentados.','PROD-05 TIC-04 END-02')
add('MET-02','4','Indicadores','Implementar painel e relatório por condomínio','Indicadores reais com filtro por período e vínculo; exportação respeita acesso; distinguir falta de dados de zero.','MET-01 TEN-01')
add('QA-01','5','Qualidade','Testar domínio e transições','Cobrir prazos separados, pendências, duplicidades, justificativa, revisão e reabertura com cenários inválidos.','TIC-04 SYN-02 END-02','P0','Teste')
add('QA-02','5','Qualidade','Testar decisões e eventos concorrentes','Duas respostas simultâneas e retry não sobrescrevem decisão; histórico e outbox consistentes.','SYN-02 WA-03','P0','Teste')
add('QA-03','5','Qualidade','Testar anexos, isolamento e identidade no WhatsApp','Acesso cruzado, mídia inválida, URL vencida, contato não validado e pedido de dado alheio são bloqueados.','TEN-02 EVI-01 WA-06','P0','Teste')
add('QA-04','5','Experiência','Testar navegador, celular e acessibilidade','Jornadas ponta a ponta, teclado, foco, rótulos, contraste, telas pequenas e erros verificadas com usuários.','TIC-05 WA-07 END-02','P0','Teste')
add('QA-05','5','Qualidade','Testar carga e falhas recuperáveis','Volume estimado do piloto, lentidão, queda de provedor e fila com retentativas; incidentes têm responsável e instruções.','WA-07 INC-01 DEC-05','P0','Teste')
add('INF-01','5','Infraestrutura','Preparar ambiente local e integração contínua','Build, migrações e verificações reproduzíveis; segredos protegidos; procedimento para futuras versões.','TEC-01','P0')
add('INF-02','5','Infraestrutura','Planejar hospedagem e aprovar custos','Comparar alternativas, acesso, certificados, banco, armazenamento e custos; decisão revisável, sem contratação/publicação automática.','DEC-05 INF-01','P0','Decisão')
add('INF-03','5','Infraestrutura','Preparar implantação autorizada e reversão','Após autorização específica: ambientes separados, TLS, migrações, reversão e controle de acesso testados.','INF-02 QA-01 QA-03','P0',note='Pendente de autorização futura para contratação, contas e publicação; não executado nesta entrega.')
add('INF-04','5','Infraestrutura','Implementar observabilidade e alertas','Métricas de API/fila, erro de envio e indisponibilidade com logs sem segredos e responsável de resposta.','INF-01 WA-03','P0')
add('INF-05','5','Infraestrutura','Testar backup e restauração','Backup cifrado e restrito conforme política; restaurar em ambiente isolado e medir recuperação com objetivo aprovado.','DB-01 DEC-04 INF-02','P0','Teste')
add('PIL-01','6','Preparação da operação','Preparar termos, privacidade e contrato para revisão','Revisão profissional de responsabilidades, escopo, tratamento de dados, retenção e regras internas; não prometer ausência de responsabilidade.','SERV-01 DEC-04','P0','Validação')
add('PIL-02','6','Preparação da operação','Preparar implantação assistida do condomínio','Confirmar Gabriela como candidata, cadastro de condomínio/moradores, verificação de vínculos, prestadores e canal de emergência.','PIL-01 WA-01 DEC-01','P0')
add('PIL-03','6','Preparação da operação','Treinar síndico e equipe TRÍADE','Treinar triagem, cobrança, decisões, evidências, revisão, incidentes e substituição; simulação completa sem dados reais.','TIC-05 WA-07 VIS-01 INC-01 SERV-02','P0','Validação')
add('PIL-04','6','Preparação da operação','Definir suporte técnico e suporte operacional','Canais, dono, escalonamento e capacidade separados; cadastro assistido e rotina de acompanhamento de incidentes.','SERV-07 INF-04','P0','Decisão')
add('PIL-05','6','Piloto','Revisar prontidão e autorizar entrada do piloto','Escopo/contrato aceitos, treinamento, isolamento, comunicação, restauração e critérios de sucesso verificados; decisão registrada antes de dados reais.','PIL-01 PIL-02 PIL-03 PIL-04 QA-01 QA-02 QA-03 QA-04 QA-05 INF-03 INF-05 MET-02','P0','Decisão')
add('PIL-06','6','Piloto','Executar piloto assistido e medir resultados','Após aprovação: registrar volume, retornos, reaberturas, esforço humano e feedback; reuniões de revisão conforme combinado.','PIL-05','P0','Validação')
add('PIL-07','6','Piloto','Avaliar expansão e sustentabilidade do serviço','Comparar resultado às metas, custo/capacidade, preço, riscos e melhorias; registrar continuar, ajustar ou encerrar sem expansão automática.','PIL-06 PROD-05',kind='Decisão')
add('GOV-01','1','Gestão do projeto','Manter fila de mudanças e evidências de conclusão','Cada alteração de escopo vira tarefa com impacto/dependências; conclusão tem evidência, responsável e verificação; atualizar documentos ao mudar decisão.','BASE-06',kind='Processo')
add('BASE-07','0','Qualidade','Revisar visualmente o painel da construção','Verificar navegação, filtros, formulário, recarga com persistência, exportação/importação, teclado e tela pequena em navegador disponível.','BASE-06','P0','Teste',note='Navegador de automação indisponível nesta sessão; testes de lógica não substituem revisão visual.')
# Definição confirmada em 07/10/2026: adicional humano opcional.
add('DEC-06','1','Produto','Definir responsáveis por atividade nos dois modelos','Matriz pendente para triagem, acompanhamento, evidências, revisão, comunicação e presença local: síndico no modelo plataforma; equipe contratada somente no adicional. Plataforma utilizável sem equipe TRÍADE.','PROD-02','P0','Decisão')
add('ADD-01','1','Serviço humano','Definir composição da equipe do adicional','Definir funções e composição quando contratado; não pressupor equipe obrigatória para clientes da plataforma.','SERV-01','P1','Decisão')
add('ADD-02','1','Serviço humano','Definir demandas cobertas pelo adicional','Registrar categorias, ações incluídas, exclusões e encaminhamentos; sem capacidade ilimitada presumida.','SERV-01','P1','Decisão')
add('ADD-03','1','Serviço humano','Definir quantidade e capacidade de condomínios','Estimar volume, capacidade e quantidade de condomínios atendíveis pela equipe do adicional; registrar limites sem inventar números.','ADD-01 SERV-02','P1','Decisão')
add('ADD-04','1','Serviço humano','Definir atividades que exigem presença local','Mapear tarefas presenciais e remotas, locais, acesso e quem executa; não presumir envio de equipe no modelo plataforma.','DEC-06 ADD-02','P1','Decisão')
add('ADD-05','6','Piloto','Verificar prontidão do adicional humano, se contratado','Antes de iniciar o adicional: pacote/limites/preço acordados, demandas, equipe, cobertura, capacidade, presença local e treinamento revistos. Não bloqueia piloto somente da plataforma.','PIL-05 SERV-01 SERV-02 ADD-01 ADD-02 ADD-03 ADD-04','P1','Validação')
changes={
'PROD-01':dict(title='Descobrir necessidade real e público comprador',criteria='Sem síndico/condomínio inicial disponível, usar ofertas concorrentes e relatos públicos na web para formular hipóteses de necessidade, público, oferta e venda; não declarar demanda ou disposição a pagar validadas.'),
'PROD-04':dict(title='Preparar testes com síndicos posteriores ao MVP',criteria='Roteiro para oferecer MVP focado a alguns síndicos depois de desenvolvido. Não exigir entrevistas ou testes prévios para construir no caminho escolhido.',deps=['PROD-05']),
'TIC-05':dict(deps=['TIC-04','AUTH-02']),
'PIL-02':dict(title='Preparar oferta do MVP a síndicos para teste',criteria='Depois do MVP, buscar alguns síndicos para teste e cadastrar participantes com vínculos e canal de emergência. Não há síndico/condomínio inicial disponível.',deps=['PIL-01','WA-01','DEC-01']),
'PROD-02':dict(title='Estruturar o que vender, a quem e como vender',criteria='Registrar oferta, público e forma de vender apoiados na descoberta; ainda não há oferta comercial definida. Depois disso decidir o que cabe no MVP.'),
'PROD-05':dict(title='Definir MVP e métricas somente após descoberta comercial',criteria='Após estruturar necessidade, público, oferta e venda, selecionar escopo mínimo e métricas. Backlog não equivale a MVP aprovado; evolução fica para depois.',deps=['PROD-02']),
'TEC-01':dict(deps=['DEC-02','PROD-05']),
'SERV-01':dict(title='Definir pacote, limites e preço do adicional humano',criteria='Pacote opcional de assessoria com limites, atividades e preço a definir; sem decisão comercial definitiva ou obrigatoriedade de contratação.',deps=['PROD-02']),
'SERV-02':dict(title='Definir horários, cobertura e substituição do adicional',criteria='Horários, cobertura e substituição da equipe contratada a definir; não prometer atendimento humano TRÍADE aos usuários apenas da plataforma.'),
'SERV-03':dict(front='Operação por modelo',criteria='Canal de emergência e escalonamento documentados para ambos os modelos, com responsáveis definidos; sem prometer socorro ou equipe TRÍADE sem contratação.',deps=['DEC-06']),
'SERV-04':dict(front='Operação por modelo',criteria='Retorno e resolução separados, pausas/feriados e justificativas definidos para a rotina do síndico ou equipe contratada; não depende do pacote humano.',deps=['PROD-02','DEC-06']),
'SERV-05':dict(front='Operação por modelo',criteria='Checklists com local, acesso, responsável e evidência usados pelo síndico ou executor definido; necessidade de presença local identificada, sem exigir equipe TRÍADE.',deps=['DEC-06']),
'SERV-06':dict(front='Operação por modelo',criteria='Escopo, contatos, tarefas, prazo e impedimentos registrados; síndico coordena prestadores no modelo plataforma e equipe autorizada no adicional.',deps=['DEC-06']),
'SERV-07':dict(front='Operação por modelo',criteria='Síndico pode checar evidências e revisar conclusão na plataforma; executor/revisor contratado definido no adicional. Incidentes têm responsável e conciliação em cada modelo.'),
'DEC-01':dict(criteria='Matriz permite síndico triar, atribuir, acompanhar, checar evidências e revisar/concluir, além de decidir. Operador TRÍADE acessa somente vínculos do adicional autorizado; gestão não recebe acesso irrestrito. Autoridades e acesso de prestador a definir.',deps=['PROD-02','DEC-06']),
'DEC-05':dict(deps=['PROD-02','DEC-02','DEC-06']),
'AUTH-01':dict(criteria='Login/sessão de síndico e perfis autorizados; plataforma funciona sem operador TRÍADE. Morador continua no WhatsApp.'),
'AUTH-02':dict(criteria='Servidor valida função/vínculo por endpoint; síndico pode executar rotina operacional. Perfis TRÍADE dependem de autorização e modelo contratado, sem acesso automático.'),
'TIC-02':dict(criteria='Síndico ou responsável autorizado registra urgência, dados faltantes, duplicidade, responsável e motivo; sem exigir operador TRÍADE.'),
'SYN-01':dict(criteria='Síndico ou responsável autorizado registra alternativas, custo estimado, prazo e evidência; atos de decisão têm autoria, sem exigir intermediário TRÍADE.'),
'VIS-01':dict(front='Operação por modelo',criteria='Vistoria/checklist associados a chamado, local, responsável, data e evidência; síndico ou executor definido registra dados, sem obrigação de equipe humana TRÍADE.'),
'END-01':dict(criteria='Conclusão exige evidência e explicação revisadas pelo síndico ou revisor autorizado do adicional. Decisão pendente impede conclusão incompatível; não exige segunda pessoa ou operador TRÍADE no modelo plataforma.'),
'WA-04':dict(title='Implementar mensagens e disponibilidade por modelo',criteria='Mensagens distinguem recebimento automático, disponibilidade do responsável e emergência. Não prometem atendimento humano TRÍADE sem adicional contratado.',deps=['WA-03','DEC-06','SERV-03']),
'INC-01':dict(front='Operação por modelo',criteria='Responsável definido por modelo registra incidente, canal alternativo e conciliação; separar suporte técnico da plataforma do atendimento operacional contratado.'),
'PIL-01':dict(criteria='Revisão profissional dos termos da plataforma e, quando contratado, contrato separado do adicional com responsabilidades, dados e limites; sem preço ou contratação presumidos.',deps=['DEC-06','DEC-04']),
'PIL-03':dict(title='Treinar síndico e responsáveis do modelo escolhido',criteria='Síndico treinado para executar triagem, acompanhamento, checagem de evidências, revisão e comunicação. Equipe adicional treinada somente se contratada; simulação sem dados reais.',deps=['TIC-05','WA-07','VIS-01','INC-01','DEC-06']),
'PIL-04':dict(criteria='Distinguir suporte técnico da plataforma de execução operacional pelo síndico ou equipe adicional; responsáveis e cobertura definidos, sem obrigatoriedade do serviço humano.'),
'PIL-05':dict(criteria='Prontidão da plataforma: termos, treinamento do síndico, isolamento, comunicação, restauração e métricas verificados. Serviço humano não é pré-requisito; se contratado, aplicar ADD-05 antes do início do adicional.'),
'PIL-07':dict(criteria='Avaliar sustentabilidade da plataforma e, separadamente, adicional humano: custo/capacidade, preço ainda a definir, riscos e melhorias; sem expansão automática.')
}
optional={'SERV-01','SERV-02','ADD-01','ADD-02','ADD-03','ADD-04','ADD-05'}
for t in rows:
 t.update(changes.get(t['id'],{}))
 t['scope']='Adicional humano opcional' if t['id'] in optional else 'Plataforma / ambos os modelos'
 if t['id'] in changes:
  t['revisionNote']='Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.'

# Cenários de estrutura operacional: descoberta ampla, MVP a recortar.
scenario_changes={
'PROD-01':dict(criteria='Pesquisar fontes públicas sobre necessidades em edifícios residenciais com portaria presencial/atendente, online/remota e sem portaria, incluindo vários andares/apartamentos com síndico morador e pouca estrutura. Sem cliente inicial; pesquisa gera hipóteses, não valida demanda/pagamento.'),
'PROD-03':dict(title='Comparar dores, fluxos e oferta entre cenários de portaria',criteria='Comparar fontes públicas por cenário: dores, fluxos, responsáveis disponíveis e impacto na oferta/venda. Registrar fontes e lacunas, sem presumir porteiro, zelador, equipe, administradora ou prestador fixo; portaria remota não implica manutenção nem integração técnica.'),
'PROD-02':dict(criteria='Após pesquisa pública, estruturar necessidade, público, oferta e venda e escolher recorte. Os cenários amplos não são todos escopo obrigatório do MVP; não há oferta ou público validados.'),
'DEC-06':dict(criteria='Mapear quem tria, acompanha, viabiliza acesso à manutenção, faz vistoria, coleta/checa evidências, revisa e comunica em cada cenário/modelo. Síndico pode executar/atribuir; não presumir equipe local. Portaria remota não é automaticamente mantenedora/revisora; adicional TRÍADE opcional.'),
'DEC-01':dict(criteria='Permissões por função/vínculo permitem rotina do síndico sem equipe. Não criar direitos automáticos por haver portaria presencial/remota, administradora ou fornecedor; acesso TRÍADE somente autorizado no adicional. Autoridades de decisão preservadas.'),
'TIC-02':dict(criteria='Síndico ou responsável disponível autorizado faz triagem e atribuição com urgência, dados faltantes, duplicidade e acesso ao local. Registrar responsável real e impedimento quando necessário, sem inventar equipe, zelador ou prestador fixo.'),
'SERV-05':dict(criteria='Planejar checklist/vistoria, acesso, responsável e coleta de fotos/evidências para os três cenários; síndico pode executar/atribuir. Se acesso ou executor não estiver disponível, registrar impedimento; não exigir equipe local ou envio TRÍADE.'),
'SERV-06':dict(criteria='Planejar coordenação de prestadores eventuais ou existentes pelo síndico/executor autorizado. Identificar quem combina acesso e acompanha visita, sem presumir prestador fixo, administradora, porteiro ou equipe.'),
'VIS-01':dict(criteria='Se selecionado para MVP, registrar vistoria/checklist, responsável, acesso, impedimentos e evidências por chamado/local. Síndico pode executar/atribuir mesmo sem portaria; nenhuma função automaticamente atribuída a portaria remota.'),
'EVI-01':dict(criteria='Se selecionado para MVP, upload privado com validação e vínculo; evidência pode vir do síndico ou executor autorizado, sem depender de porteiro/zelador/equipe local. Tipos e meios de coleta a definir após pesquisa.'),
'END-01':dict(criteria='Evidência e explicação checadas/revisadas pelo síndico ou revisor autorizado; preservar histórico, decisões pendentes e justificativa. Não exigir equipe local, segunda pessoa TRÍADE ou revisão por portaria remota.'),
'WA-04':dict(criteria='Planejar comunicação por responsável/modelo/cenário, distinguindo automático, disponibilidade e emergência. Não depender de portaria para receber/encaminhar demandas nem presumir conexão técnica com fornecedor de portaria.'),
'PROD-05':dict(criteria='Após necessidade/público/oferta/venda e pesquisa dos cenários, escolher recorte e MVP focado; outros cenários ficam como hipóteses/evolução. Depois desenvolver e oferecer a alguns síndicos para teste, sem entrevistas prévias obrigatórias.'),
'ADD-04':dict(criteria='Pesquisar e definir quais atividades exigem presença local, quem viabiliza acesso e quem executa por cenário. Adicional opcional; ausência de portaria não obriga contratar equipe TRÍADE.')
}
for t in rows:
 if t['id'] in scenario_changes:
  t.update(scenario_changes[t['id']])
  t['revisionNote']='Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.'

catalog=dict(version=1,revisionDate='2026-10-07',baselineDate='2026-10-05',phases=[dict(id=i,name=n,goal=g) for i,n,g in phases],tasks=rows)
(r/'construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(catalog,ensure_ascii=False,indent=2)+';\n')
(r/'construcao/catalogo.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
plan='''# TRÍADE Condo — plano de execução

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
'''
for phase,name,goal in phases:
 plan+=f'\n### Fase {phase} — {name}\n\n{goal}\n'
 for t in [t for t in rows if t['phase']==phase]:
  plan+=f"\n#### {t['id']} — {t['title']}\n\nAplicação: {t['scope']} • Frente: {t['front']} • Tipo: {t['kind']} • Prioridade: {t['priority']} • Base: {t['baseline']} • Status inicial: {t['status']}.\n\nDependências: {', '.join(t['deps']) or 'Nenhuma'}. Responsável: a definir.\n\nConclui quando: {t['criteria']}\n"
  if t['evidence']:plan+=f"\nEvidência da base: `{t['evidence']}` (caminho relativo ao painel).\n"
  if t.get('revisionNote'):plan+=f"\nRevisão: {t['revisionNote']}\n"
  if t['notes']:plan+=f"\nObservação: {t['notes']}\n"
plan+='\n## Pesquisa pública realizada — 07/10/2026\n[Relatório de descoberta](pesquisa-publica-2026-10-07.md) e [síntese comercial](sintese-comercial-2026-10-07.md). Hipóteses a discutir; não validam compradores nem autorizam implementação.\n'
(r/'docs/plano-execucao.md').write_text(plan)
print(f'{len(rows)} tarefas, {len(phases)} fases, {len(set(t["front"] for t in rows))} frentes')
