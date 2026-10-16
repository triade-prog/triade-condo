# Especificação de desenvolvimento do MVP — TRÍADE Condo

## Decisão mais recente — atendimento humano opcional e número em proposta

Atendimento humano pelo WhatsApp é opcional: condomínio pode assumir com equipe própria ou contratar TRÍADE para atender. A contratação do serviço humano é separada da plataforma. Ficha guarda modelo escolhido, referência de contratação quando TRÍADE, pessoas autorizadas e horários por condomínio. Não presumir contratação, equipe, capacidade ou suporte 24h; troca de equipe/revogação mantém histórico e autoria. Produto continua com responsáveis/andamento/retornos essenciais, sem inventar pessoa disponível ou assumir IA/automação para substituir atendimento.

A sugestão de um número institucional exclusivo/próprio por condomínio não recebeu aprovação explícita, conforme esclarecimento mais recente de Carolina; permanece PROPOSTA. Isso prevalece sobre textos anteriores que o descreviam como pré-requisito de adesão. WhatsApp permanece canal do morador; topologia dos números e roteamento seguro por condomínio continuam a decidir, sem conta real ou integração.


Versão para avaliação • 08/10/2026 • Documento, sem implementação de produto.

## Escopo aprovado e fronteiras

Documento de desenvolvimento para avaliação do MVP, aprovado por Carolina em 08/10/2026. Aprovação de escopo não significa produto implementado. Telas, dados e mecanismos detalhados abaixo são propostas quando não houver decisão expressa.

DENTRO: atendimento completo via WhatsApp institucional do condomínio; comunicados/documentos básicos; painel síndico; painel interno Carolina com cadastro/gestão de clientes condomínios, contratação/liberação de funções, implantação/manual para funcionários, registro de pagamentos dos clientes à TRÍADE e recuperação segura do acesso do síndico.

DEPOIS: agenda e coordenação de manutenção; comunicação/documentos ampliados; financeiro/boletos do condomínio; QR de chegada/receptor sonoro e outros módulos. Armários somente após primeiros clientes. Propostas/orçamentos expressamente fora do desenvolvimento inicial; pesquisa preservada só para referência futura.

Não construir site institucional nesta etapa. Não incluir execução de reparos pela TRÍADE, compras, autorização de entrada, conta do morador ou operação de portaria. Preços, prazo, stack e provedor não foram escolhidos. Brasília/DF é cobertura inicial, não endereço empresarial.

## Papéis, permissões e isolamento

APROVADO: Carolina administra todos os clientes. Síndico acessa somente seu próprio condomínio e capacidades contratadas E liberadas. Morador utiliza exclusivamente WhatsApp institucional, sem painel/login/senha. Operação interna fica restrita à equipe autorizada; notas internas e carteira não aparecem ao cliente.

PROPOSTA de autorização: combinar pessoa, função, condomínio atribuído e ação. Carolina gerencia carteira/contratação/liberação/equipe; implantação trabalha nos clientes atribuídos e entregas; financeiro interno acompanha dados necessários dos pagamentos; suporte verifica solicitações de acesso. Funcionário não recebe todos esses poderes automaticamente. Matriz detalhada precisa de aprovação antes da implementação das permissões.

REQUISITOS: aplicar autorização no servidor em cada leitura/alteração/download, não apenas esconder botões. Toda entidade de cliente deve ter vínculo inequívoco ao condomínio. Consultas, anexos, buscas, eventos e notificações respeitam esse vínculo. Identificadores manipulados não permitem acesso a outro cliente. Sem compartilhamento de contas. Registrar autoria de mudanças relevantes e preservar histórico.

ABERTO: Carolina acumula funções; definir delegados, acesso excepcional de suporte, substituição do síndico, elegibilidade de moradores/contatos e política de revogação. Acesso global administrativo exige finalidade e não leitura indiscriminada de conversas.

## Telas e ações propostas

PAINEL CAROLINA: lista/ficha de condomínios; identificação e contato responsável; WhatsApp institucional e situação de preparação; referência da contratação; capacidades contratadas/liberadas; atribuições da equipe; implantação/pendências/documentos internos; pagamentos; solicitações de acesso; histórico administrativo.

Ações propostas: cadastrar/editar cliente, designar responsáveis, registrar contratação, liberar/revogar capacidade dentro do acordo, registrar pendência/entrega e conferir pagamentos. Registrar autor/data/motivo/referência. Não apagar histórico silenciosamente. Política de arquivamento/suspensão e preservação de dados é decisão aberta.

PAINEL SÍNDICO: fila de atendimentos; filtros por situação/responsável/prioridade; detalhe com conversa pertinente e histórico; atribuir responsável, atualizar andamento, próximo retorno e estimativa conhecida; concluir; preparar/publicar comunicados e documentos básicos; configuração mínima autorizada.

O síndico não vê carteira TRÍADE, cobranças internas, rascunhos da equipe nem autoativa recurso. Morador não recebe tela. Login/recuperação são interfaces futuras dos usuários autorizados dos painéis, mecanismo ainda a decidir.

Estados visuais propostos: carregando, vazio, erro com nova tentativa, acesso negado e confirmação de ação. Erro de envio deve ser distinguido de falha de salvamento. Estados de implantação e pagamento não indicam disponibilidade técnica da integração.

## Atendimento completo e configuração

APROVADO: receber pedido, identificar unidade/morador, registrar, organizar fila/responsável real/prioridade, acompanhar etapas/providência, informar próximo retorno, estimativa quando conhecida, concluir e preservar histórico. Esses componentes são indivisíveis; não remover/vender fila, responsável, prioridade ou retorno como extras.

PROPOSTA de estados canônicos: aberto, em andamento e encerrado, com etapas configuráveis mapeadas a esses estados. Pendência/aguardando informação pode ser etapa/atributo, sem esconder responsável ou próximo retorno. Definir condições de conclusão, reabertura e cancelamento com Carolina; reabrir preserva conclusão anterior e autoria.

PROPOSTA de configuração mínima por condomínio: categorias opcionais, responsáveis vinculados/autorizados, prioridades com significado, etapas mapeadas, modelos de resposta e regra simples de acompanhamento do próximo retorno. Mudança preserva histórico e correspondência dos registros existentes. Não criar construtor ilimitado de fluxos.

Próximo retorno é compromisso de atualização, distinto da resolução e de agenda futura. Se estimativa de resolução não for conhecida, manter ausência explícita; não transformar vazio em prazo prometido. Quando não existir executor disponível, registrar pendência real e responsável por acompanhamento, sem atribuição fictícia.

Processo de lâmpada não é procedimento universal. Não exigir foto, checklist, ata ou orçamento em todos os casos. Coordenação de manutenção adicional fica depois: o atendimento inicial pode registrar problema/providência/executor conhecido sem implementar módulo de manutenção.

## Jornada WhatsApp e integração pendente

APROVADO: canal institucional próprio do condomínio é requisito de adesão; não usar automaticamente o telefone pessoal do síndico. Morador envia pedido, recebe retorno/andamento e recebe/consulta conteúdos autorizados pelo WhatsApp. Síndico recebe avisos relevantes no próprio WhatsApp além do painel. Não presumir aprovação de decisões pelo WhatsApp.

PROPOSTA de jornada: evento recebido → identificar canal/condomínio → localizar vínculo autorizado do contato/unidade → resolver ambiguidade sem divulgar cadastro → registrar pedido/evento uma única vez → disponibilizar à fila → responder com referência/compreensão e próximo passo conforme regra aprovada. Contato desconhecido segue verificação definida, não ganha acesso por informar apartamento. Moradores múltiplos por unidade e mudanças de vínculo precisam de política.

Requisitos para integração futura: validação de eventos do provedor, deduplicação, vinculação ao condomínio correto, fila/repetição controlada de envios, registro de tentativa/erro/entrega conforme sinais realmente disponíveis e prevenção de notificações duplicadas. Nunca confundir envio aceito com leitura ou solução. Não prometer resposta imediata ou disponibilidade contínua sem capacidade aprovada.

ABERTO antes de conectar: provedor/API/tipo de conta e viabilidade de cada número; custos; migração; regras e modelos exigidos pelo provedor; janela de conversa; identificação/verificação de contatos; consulta de documentos; gatilhos/destinatários/horários; falha e atendimento alternativo; retenção e uso de anexos. Avaliar regras atuais do provedor quando escolhido. Nada disso está pronto neste documento.

Desenvolvimento pode usar interface de integração e eventos fictícios locais, claramente simulados. Conexão com números/contatos reais requer etapa autorizada e ambiente definido, sem envio real por esta especificação.

## Comunicados e documentos básicos

APROVADO: síndico prepara, publica e organiza conteúdo no painel; morador recebe/consulta somente conteúdo autorizado no WhatsApp. Comunicação/documentos essenciais integram a base, não ampliado pago separado.

PROPOSTA: rascunho → publicado → substituído/arquivado, mantendo autoria/data/versão e referência do vigente. Definir público autorizado (por condomínio e, quando necessário, unidade/grupo explicitamente permitido). Rascunho não é enviado. Corrigir conteúdo publicado preserva versão anterior em histórico restrito e identifica qual versão está vigente.

Anexos privados precisam de autorização a cada acesso ou mecanismo seguro temporário a validar; não publicar pasta pública de todos os clientes. Definir limites de formato/tamanho, inspeção e expiração/revogação de acesso conforme arquitetura escolhida. Não incluir arquivo administrativo ampliado/campanhas/revisão complexa agora.

Serviço humano de elaboração/organização documental é distinto da publicação no produto. Condomínio fornece/valida/aprova regras; atas refletem reuniões reais, sem fabricação ou regularização automática.

## Implantação e manual da equipe

Material existente: manual-implantacao.md. Usá-lo como referência interna: ficha/escopo → dados necessários → documentos/aprovações → preparação/configuração → apresentação acordada → orientação de moradores → pendências → conferência e entregas.

PROPOSTA de registro: etapa, responsável/substituto, situação (preparada, pendente, realizada ou não aplicável com motivo), pendência, próximo passo/retorno e referência de entrega. Não marcar configuração real pronta a partir de preparação de documento. Rascunhos/notas internos permanecem restritos; cliente recebe somente entregas finais explicitamente compartilhadas.

Novo condomínio cliente é diferente de novo morador em cliente existente. Orientar pelas regras aprovadas e uso do WhatsApp. Dados básicos previstos para morador: nome, telefone e apartamento; CPF não integra o cadastro básico. Modalidade/frequência/capacidade/preço e responsáveis do serviço continuam abertos.

Reunião/assembleia presencial acordada é proposta de entrada assistida, não requisito jurídico universal. Checklist interno não impõe procedimento universal a chamados de moradores.

## Pagamentos dos clientes à TRÍADE

APROVADO: registrar/acompanhamento de contratação/serviço, vencimentos, valores conhecidos, pagamentos, débitos e problemas. É financeiro interno TRÍADE, não financeiro do condomínio ou morador.

PROPOSTA de dados e estados: referência do contrato/serviço, período/competência, vencimento, valor acordado quando confirmado; a vencer, aguardando conferência, confirmado, vencido/pendente, em revisão ou problema/divergência. Responsável e referência de conferência são necessários para confirmar recebimento; status sozinho não comprova pagamento.

Não interpretar valor ausente como zero. Parcial/saldo somente quando valores e regras confirmados; correção com histórico. Débito/problema registra origem, valor conhecido, responsável e próxima providência, sem envio automático.

FORA: gateway, emissão de boleto, cobrança automática, contato real, movimentação bancária e armazenamento de credenciais bancárias. Nenhum bloqueio automático de funções por atraso. Definir quem pode registrar/conferir/corrigir e como guardar evidências pertinentes com acesso limitado.

## Recuperação segura de acesso

APROVADO: recuperar acesso do síndico somente após verificar identidade, vínculo e permissão. Funcionário não vê senha atual/nova e nunca guarda senha em texto puro. Morador não tem conta a recuperar.

PROPOSTA de fluxo: registrar solicitação → validar vínculo/canal verificado → encaminhar dúvidas a Carolina/suporte autorizado → mecanismo seguro de redefinição → registrar resultado → revisar/revogar vínculos/sessões quando apropriado. Proposta de mecanismo: token de uso único com expiração, protegido e enviado ao canal verificado; implementação e canal dependem de decisão técnica. Não registrar token/link secreto no histórico.

Requisitos: resposta pública neutra sem revelar existência de conta, proteção contra tentativas repetidas, impossibilidade de reutilizar mecanismo expirado/usado, armazenamento seguro de credenciais e autorização em mudanças de vínculo. Mudança de síndico exige validar substituição antes de conceder acesso, preservar autoria anterior e revogar acessos antigos conforme política.

ABERTO: login/identificador, canal, verificação de identidade, expiração, limites, confirmação extra, revogação de sessões e contas da equipe. Nenhum reset ou envio real está implementado.

## Dados mínimos e relações propostos

Modelo conceitual para avaliação, não esquema de banco escolhido. Campos de auditoria: identificador, data/criador e alterações relevantes. Dados pessoais e anexos precisam de finalidade, acesso e retenção definidos.

Condomínio/cliente: identificação, cobertura/endereço quando informado pelo cliente, responsáveis, canal institucional, situação de implantação. Não preencher dados fictícios como reais.

Usuário interno/síndico + vínculo: função, condomínio atribuído, ações permitidas, ativo/revogado. Carolina pode ter alcance global explícito. Contato de morador + unidade + vínculo: nome, telefone, unidade e autorização/situação a validar; não gera conta de painel.

Contratação + liberação: cliente, capacidades, referência do acordo, autoria/data/motivo; disponibilidade exige contratado E liberado. Base como capacidade coerente, sem subfunções essenciais removíveis. Adicionais posteriores não aparecem como disponíveis no MVP.

Atendimento: condomínio, contato/unidade identificados, origem/evento deduplicável, descrição, responsável de acompanhamento, prioridade, etapa/estado, próxima atualização, estimativa opcional, conclusão. Eventos de histórico e anexos pertencem ao atendimento/condomínio; autoria e datas preservadas.

Conteúdo/documento: condomínio, título, corpo/arquivo, público autorizado, estado, versão e publicação. Implantação: cliente, etapa, responsável, situação, pendência e entrega. Registro de pagamento: cliente, referência serviço/período, vencimento, valor opcional confirmado, situação, conferência/ajustes. Solicitação de acesso: usuário/vínculo pertinente, verificação, responsável e resultado, sem segredo.

Mensagem/evento de integração: canal/cliente, identificador externo quando disponível, vínculo com atendimento/conteúdo, direção, tentativas e resultado conhecido. Auditoria não deve copiar senhas ou conteúdo pessoal desnecessário. Exclusão/retificação/retenção e exportação de dados precisam de política antes de operação real.

## Critérios de aceitação e cenários

1. Dois condomínios: síndico A não lê/altera registros, anexos ou conteúdos de B, inclusive tentando identificadores diretamente. Funcionário atribuído a A não ganha B. Carolina vê carteira conforme autorização global explícita.

2. Contratação/liberação: capacidade não contratada ou não liberada não está disponível ao síndico. Mudança em A não altera B. Registro financeiro vencido não bloqueia acesso. Base mantém todos os componentes essenciais.

3. Prédio simples sem porteiro: pedido de lâmpada recebe responsável real, prioridade, andamento, próximo retorno e histórico; sem foto/ata/checklist/orçamento compulsório. Não existe executor? Pendência explícita, sem pessoa inventada. Sem estimativa? Nenhum prazo de resolução prometido.

4. Outra demanda/condomínio: dúvida sobre regras e problema de elevador podem ter responsáveis/etapas diferentes, sem impor fluxo da lâmpada. Alterar configuração não apaga histórico nem torna registros anteriores ilegíveis.

5. WhatsApp simulado e futura integração: evento repetido não duplica pedido/aviso; canal incorreto não cruza condomínio; contato desconhecido não recebe conteúdo restrito; falha de envio permanece visível e não é registrada como leitura. Morador usa somente WhatsApp, sem criação de conta.

6. Conteúdo: rascunho não chega ao morador; publicado chega/é consultado somente pelos autorizados; versão substituída não aparece como vigente. Link/anexo não dá acesso a outro condomínio.

7. Implantação: funcionário autorizado registra pendência/entrega nos clientes atribuídos; síndico não vê notas internas. Etapa apenas preparada não é marcada executada.

8. Pagamentos: valor ausente permanece desconhecido; confirmação exige conferência autorizada; correção preserva histórico; pagamento parcial não calcula saldo a partir de valor desconhecido; nenhuma cobrança ou bloqueio automático.

9. Acesso: solicitante não validado não redefine conta; funcionário não visualiza senha; mecanismo proposto expirado/usado não funciona; mudança de síndico mantém autoria anterior e revoga conforme política aprovada. Testes definitivos dependem do mecanismo escolhido.

10. Usabilidade: painéis acessíveis por teclado, foco visível, rótulos e mensagens compreensíveis, leitura em celular, estados vazio/erro e recuperação de falhas. Volumes, navegadores alvo, desempenho e disponibilidade precisam de parâmetros acordados; não inventar metas.

## Sequência proposta de desenvolvimento

Etapa 1 — revisar esta especificação, resolver decisões bloqueadoras e confirmar oferta/recorte; estimar esforço com desenvolvedor. Escolher stack/ambientes somente por decisão conjunta.

Etapa 2 — fundação: modelo de vínculo/isolamento, autenticação/permissões, auditoria e armazenamento privado. Testar tentativas de acesso entre condomínios antes de ampliar telas.

Etapa 3 — Carolina: cadastro cliente, contratação/liberação e atribuições; síndico e configuração mínima. Não carregar módulos posteriores como escopo obrigatório.

Etapa 4 — atendimento completo com eventos simulados, incluindo fila/responsável/prioridade/retorno/estimativa/histórico. Validar cenários distintos sem fluxo universal.

Etapa 5 — conteúdos básicos e autorização; implantação/manual, pagamentos internos e recuperação segura escolhida. Todos integram a entrega inicial, ordem interna ajustável pelo desenvolvedor.

Etapa 6 — integrar WhatsApp no ambiente/provedor aprovado, validar números, regras, falhas, deduplicação e destinatários; testes reais somente com autorização específica.

Etapa 7 — validação de segurança/usabilidade, pendências e piloto autorizado após conferência. Preparar operação, suporte, cópias/recuperação e observação de falhas antes de dados reais.

Sem compromisso de prazo, preço ou escolha tecnológica. Agenda/manutenção e demais módulos ficam fora dessas etapas do MVP. Esta sequência é proposta para orçamento/avaliação, não execução automática.

## Decisões abertas e bloqueadoras

Antes da fundação: matriz final de permissões, identificação/login e mecanismo de autenticação; vínculo/substituição de síndico; método de verificação de moradores/unidades; modelo mínimo de contratação/base e suspensão/arquivamento; stack, ambientes e responsável técnico.

Antes da integração: provedor, viabilidade e autorização dos números, regras/custos/API, canais de recuperação, consulta de conteúdo pelo WhatsApp, gatilhos/horários de avisos e alternativa em falha.

Antes da operação real: políticas de privacidade/retenção/exclusão, segurança de anexos, responsáveis por suporte e conferência financeira, cópias/recuperação, métricas/volumes e resposta a problemas; escopo/capacidade dos serviços humanos. Definir essas políticas com responsáveis apropriados, sem afirmação jurídica inventada.

Revisão funcional: nomes/prioridades/etapas, conclusão/reabertura/cancelamento, destino de conteúdo e identificação de contato ambíguo. Não bloquear leitura/estimativa desta especificação por pendências: desenvolvedor pode apontar alternativas e estimar por hipóteses explicitadas, sem tratá-las como aprovadas.

FONTE DE VERDADE desta entrega: escopo MVP confirmado neste documento prevalece sobre desenhos anteriores que incluíam agenda/manutenção ou cotações no inicial. Materiais históricos permanecem para consulta, não são autorização de implementação.

## Materiais reais de referência

- [Visão e fronteiras](visao-do-sistema.md)
- [Painel Carolina](painel-carolina.md)
- [Painel síndico](painel-sindico.md)
- [Manual de implantação](manual-implantacao.md)
- [Simulação dos painéis](planejamento-paineis.html)
- [Arquitetura histórica: proposta, não stack aprovada](../outputs/triade-condo/docs/arquitetura.md)
- [Mapa da empresa](../mapa-da-empresa.html)

Esses materiais foram reutilizados, não substituídos. A simulação e o protótipo não implementam as garantias descritas.

## Complemento técnico da auditoria — propostas e decisões abertas

Não altera escopo aprovado; detalha cuidados para revisão antes de implementar cada módulo. Nada implementado.

- Identidade e isolamento: decidir como provar vínculo morador/unidade e validar substituição de síndico, telefone compartilhado/reciclado e pessoa ligada a mais de um condomínio. Canal institucional identifica destino, não comprova sozinho identidade. Conteúdo do pedido não pode escolher livremente o condomínio de autorização.
- WhatsApp: propor registro de autorização/preferência de comunicação exigida pelo provedor, pedido de não receber avisos e mudança de contato; mecanismo exato a decidir sem criar portal morador. Distinguir mensagem recebida, envio pendente/aceito/entregue/falhou e resultado desconhecido. Callbacks atrasados/duplicados não podem regredir estado confirmado nem recriar pedido. Limite de tentativas, intervenção manual e quem acompanha falha precisam ser definidos.
- Resposta humana: definir quem acompanha cada fila/pendência e como assume o atendimento, inclusive fora do horário e sem executor. Não é autorização para IA, distribuição automática ou suporte 24h. Próximo retorno continua obrigatório e não promete resolução. Proposta de impedir resposta concorrente silenciosa por versão de registro.
- Documentos: escolher público mínimo (condomínio, unidade ou contato autorizado), revogação de vínculo e acesso a arquivos já enviados. Arquivo baixado/encaminhado fora do sistema não pode ser revogado por promessa do produto. Consulta autenticada/temporária precisa ser decidida; não inventar garantia de confidencialidade após download.
- Configuração: propor IDs estáveis das etapas e responsáveis, mapeamento ao estado canônico, versão de configuração e regra para remover/renomear item já usado. Preservar valor/autoria/histórico anterior; excluir item de opções futuras não apaga histórico. Concluir/reabrir e substituir responsável precisam de regra explícita.
- Pagamentos internos: propor registros separados por competência/obrigação e eventos de conferência/correção, para não substituir um mês por outro. Valores monetários com moeda/precisão a definir na arquitetura; não calcular saldo com valor desconhecido. O protótipo atual só demonstra uma ficha, não implementa razão financeiro.
- Recuperação: decidir revogação de sessões/credenciais e mudança de responsável além do reset; recuperação de Carolina/equipe e ausência do único administrador requer política própria, não regra inventada. Segredo nunca em evidência/histórico.
- Aceitação adicional proposta: dois operadores alteram o mesmo atendimento; callback chega fora de ordem; contato muda unidade ou é revogado; documento é substituído e link antigo usado; etapa usada é removida; pagamento antigo é corrigido e nova competência criada. Executar no futuro backend com dados de teste, sem atribuir resultado às simulações locais.

Ver [relatório de revisão](relatorio-revisao-desenvolvimento.md) para achados comprovados, fontes e prioridades.

## Ajuste aprovado — ficha por condomínio e acessos próprios

Carolina aprovou uma ficha de cadastro/configuração no painel interno, preenchida durante implantação e editável depois. Cada condomínio tem pessoas autorizadas, função e permissões individuais, responsáveis pelo atendimento, dias/horários de funcionamento, dias/horários de atendimento e mensagem fora do expediente. Não impor o mesmo expediente ou equipe a todos.

Síndico pode ter secretária ou outros delegados com acesso próprio; não compartilhar conta. A secretária acompanha chamados e responde moradores somente com permissões concedidas naquele condomínio. Função escrita não concede poderes automaticamente. Aprovação de despesas permanece com o síndico conforme configuração autorizada; isso registra fronteira para recurso futuro, não inclui despesas/orçamentos no MVP.

Ações da ficha: cadastrar pessoa/vínculo, definir função e permissões, ativar/desativar vínculo, designar responsáveis e editar dias/horários/mensagem. Histórico registra autor, instante e valores anteriores/novos; alterações não apagam registros anteriores. Mudanças aplicam-se somente ao condomínio selecionado. No produto futuro, a autorização deve ser conferida no servidor e vínculo revogado deve impedir novas ações.

Dados mínimos propostos para implementação: ficha ligada ao condomínio; pessoa/identificação individual; vínculo ativo e permissões por ação; responsáveis de acompanhamento vinculados; regras de funcionamento/atendimento e mensagem; eventos de alteração com autoria/data/antes/depois. Identificação/login/canal de recuperação, fuso, feriados, múltiplos intervalos, notificações e método seguro de verificar vínculo continuam a decidir. Não presumir aprovação dessas outras recomendações.

No protótipo, exemplos são fictícios, ficha salva neste navegador e prévia fora do expediente é acionada manualmente. Não há conta, relógio automático de expediente, autenticação, revogação real ou envio de mensagem. Mensagem fora do expediente não fecha pedido nem inventa prazo de resolução; próximo retorno continua acompanhado. Registro recebido e responsabilidade humana não são promessa de atendimento 24h.

Critérios adicionais: alterar A não muda B; secretária autorizada responde e autoria aparece no histórico/prévia sem alterar campos que não pode editar; retirar permissão impede nova ação na simulação; cada pessoa tem identificação própria; alterações de horário/vínculo preservam histórico; novo pedido fora do expediente mostra mensagem de A; recarregar mantém revisão válida; dados anteriores sem ficha recebem somente campos novos de exemplo sem apagar atendimentos/configuração/financeiro. Testes da autorização real ficam para backend.

[Experimentar ficha e delegados no protótipo](prototipo-paineis.html). Cadastro básico morador segue WhatsApp, sem painel/login; carteira interna não aparece aos delegados.
