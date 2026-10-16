# Visão e fronteiras do sistema

## Decisão mais recente — atendimento humano opcional e número em proposta

Atendimento humano pelo WhatsApp é opcional: condomínio pode assumir com equipe própria ou contratar TRÍADE para atender. A contratação do serviço humano é separada da plataforma. Ficha guarda modelo escolhido, referência de contratação quando TRÍADE, pessoas autorizadas e horários por condomínio. Não presumir contratação, equipe, capacidade ou suporte 24h; troca de equipe/revogação mantém histórico e autoria. Produto continua com responsáveis/andamento/retornos essenciais, sem inventar pessoa disponível ou assumir IA/automação para substituir atendimento.

A sugestão de um número institucional exclusivo/próprio por condomínio não recebeu aprovação explícita, conforme esclarecimento mais recente de Carolina; permanece PROPOSTA. Isso prevalece sobre textos anteriores que o descreviam como pré-requisito de adesão. WhatsApp permanece canal do morador; topologia dos números e roteamento seguro por condomínio continuam a decidir, sem conta real ou integração.


## Escopo vigente confirmado em 08/10/2026

MVP aprovado: atendimento completo WhatsApp institucional, comunicados/documentos básicos, painel síndico e painel Carolina com clientes/contratação/liberação, implantação/manual, registro pagamentos à TRÍADE e recuperação segura de acesso síndico. Agenda e coordenação de manutenção ficam depois; orçamentos fora do inicial. O texto abaixo preserva visão anterior/ampliada; não torna conjuntos adicionais parte do MVP. [Especificação vigente](especificacao-mvp.md) prevalece. Propostas de estados, telas e mecanismos continuam sujeitas à revisão. Nenhum backend/autenticação/WhatsApp real implementado.


## Direção confirmada

Carolina administra a carteira de TODOS os condomínios clientes da TRÍADE em um painel interno. Cada condomínio/cliente mantém contratação, recursos liberados, dados e responsáveis próprios. O síndico vê apenas o condomínio ao qual está autorizado e os conjuntos contratados/liberados para ele. A simulação desta pasta não implementa essas barreiras; elas são requisitos do produto futuro.

Morador exclusivamente WhatsApp institucional próprio do condomínio, requisito de adesão; nenhum painel/login do morador. O síndico usa painel e recebe avisos relevantes em seu WhatsApp. Brasília/DF permanece cobertura inicial. Provedor, conta/API, custos e integração continuam a definir.

## Dois painéis e um canal

| Perfil | Acesso planejado | Limite |
|---|---|---|
| Carolina / equipe TRÍADE autorizada | Carteira, contratação, liberações, contatos responsáveis, implantação e entregas internas | Acesso administrativo não implica leitura indiscriminada de conversas ou poder de decidir manutenção/compras pelo cliente. Alcance de suporte a validar. |
| Síndico autorizado | Recursos liberados e dados de seu condomínio; configuração dentro de limites | Sem carteira de clientes, contratação de outros prédios, notas internas TRÍADE ou autoativação de conjunto não liberado. |
| Morador | Pedidos, retorno, andamento, avisos e conteúdo autorizado pelo WhatsApp | Sem app/portal/login próprio; não acessa fila geral ou documentos administrativos restritos. |

## Contratação e liberação

Distinguir o que foi contratado do que foi liberado. Regra proposta: conjunto disponível ao síndico somente quando contratado E liberado para aquele condomínio. Carolina registra referência do acordo, conjunto e responsável pela mudança. Teste/exceção temporária, se necessário, exige política explícita a validar, sem liberar silenciosamente recursos não contratados. Não definir cobrança/preços aqui.

Conjunto é uma capacidade coerente; seus componentes internos necessários permanecem juntos:

- Atendimento completo e comunicação/documentos essenciais: receber/registrar, fila, responsável, prioridade, etapas/andamento, próximo retorno, estimativa quando disponível, conclusão, histórico, avisos e documentos vigentes. Não remover fila/responsável/prioridade/retorno ou vendê-los como upgrade. É base proposta comum, cuja composição será revisada.
- Agenda/compromissos: escolha adicional em revisão; calendário administrativo e compromissos. Próximo retorno do atendimento não depende de agenda.
- Coordenação de manutenção: escolha adicional em revisão; planejar e acompanhar executor real. Não significa TRÍADE executar reparos; mantém acompanhamento próprio se agenda não contratada.
- Comunicação/documentos ampliados: escolha adicional em revisão; campanhas e arquivo administrativo/revisões além da publicação/consulta essencial. Separar os dois ampliados ainda a decidir.

Orçamentos/propostas NÃO desenvolver agora; eventual necessidade pode usar tarefa simples existente, sem módulo disfarçado. Financeiro/boletos futuros opcionais. QR, múltiplos contatos e receptor sonoro são ideias em avaliação; armários só após primeiros clientes. Nenhum desses recursos está na simulação como conjunto inicial liberável.

## Funcional e editável sem fluxo único

Processo adequado a X não precisa ser o de Y. Troca de lâmpada, pedido de regra e limpeza são exemplos para testar a organização, nunca fluxos obrigatórios. O síndico pode ajustar responsáveis, prioridades, nomes/etapas, próximos retornos, modelos de resposta e categorias de maneira proporcional. Começar com configuração simples; detalhamento adicional somente quando necessário.

Limites propostos para revisão: responsável vinculado/autorizado; prioridades com significado explícito; etapas mantendo possibilidade de saber se está aberto, em andamento ou encerrado; retorno acompanhado mesmo sem estimativa de resolução; mudanças preservam histórico e mapeamento de registros antigos. Não exigir foto, ata, orçamento ou checklist universal. Não autorizar edição de histórico para esconder mudanças, acesso a outro condomínio ou remoção de comunicação/histórico/permissões essenciais.

A configuração altera opções dentro do recurso existente. Novo tipo de integração, novo conjunto, nova regra complexa de autorização ou nova tela é desenvolvimento futuro a avaliar. Configurabilidade não significa um construtor ilimitado de sistemas.

## Decisões para revisão conjunta

Quais pessoas da equipe TRÍADE podem ver/alterar contratação, implantação e suporte? Carolina terá acesso excepcional ao painel cliente para suporte mediante autorização e registro? Quem substitui síndico e como revogar vínculo? Quais ajustes podem ser feitos sem afetar atendimentos em andamento? Como suspender conjunto e preservar/exportar histórico? Quando separar comunicação/documentos ampliados? Autenticação dos dois painéis será planejada depois; esta pasta não cria login.


## Implantação com manual para a equipe

[Manual de implantação](manual-implantacao.md) orienta funcionário autorizado: abrir ficha/escopo; levantar dados; organizar documentos e aprovações; preparar configuração futura; orientar/reunir; orientar moradores; acompanhar pendências; conferir conclusão/entregas. É checklist interno flexível e revisável, diferente do fluxo de atendimento do condomínio. Responsável e substituto designados; configuração/teste real só marcado realizado após execução. Rascunhos/notas internos não aparecem ao cliente.

## Pagamentos de clientes à TRÍADE — financeiro interno

Planejar ficha por condomínio com referência da contratação/serviço, competência/período, vencimento, valor contratado/a registrar (sem valor inventado), situação, confirmação/comprovante pertinente e responsável pela conferência. Distinguir a vencer, aguardando conferência, confirmado, vencido/pendente, em revisão e problema de identificação/divergência como estados propostos, não cobrança real.

Débito/pendência precisa identificar valor quando conhecido, origem, data e providência; ausência de valor não vira zero. Registrar pagamento parcial e saldo somente se valores e regras reais forem confirmados. Status não confirma recebimento sem evidência/conferência autorizada. Histórico de ajuste/correção e referência da confirmação devem permanecer.

Este é acompanhamento de clientes que pagam à TRÍADE, separado do financeiro do condomínio/moradores (futuro opcional). Não emitir cobrança, contatar cliente, escolher gateway, processar pagamento, guardar credenciais bancárias ou criar bloqueio automático por atraso. Carolina avalia qualquer ação contratual conforme autorização; a situação financeira não altera liberações automaticamente nesta proposta.

## Recuperação/redefinição de acesso e mudança de responsável

Somente síndico/usuário autorizado dos dois painéis; morador não tem conta/senha. Procedimento futuro: registrar solicitação → conferir identidade, vínculo ativo ao condomínio e permissão → encaminhar para decisão de suporte/Carolina em dúvida → disponibilizar mecanismo seguro de redefinição ao canal previamente verificado → registrar resultado e revisar/revogar acesso quando necessário.

Funcionário não vê senha atual, não recebe nova senha e não a armazena em texto puro. Nunca registrar senha/token/link secreto no histórico. Mecanismo futuro deve ter prazo, uso único, confirmação e proteção contra tentativas indevidas; forma e canal a definir na construção, sem envio real agora. Solicitação pública não deve revelar existência de conta/cadastro.

Esquecimento: restabelecer só o mesmo vínculo validado. Mudança de síndico/responsável: confirmar substituição e autorização antes de conceder novo acesso, revisar funções e revogar vínculos/sessões antigos quando apropriado, preservando autoria/histórico. Não transferir acesso com base apenas no pedido de alguém; não compartilhar conta. Permissões de funcionários também revisadas quando mudam responsabilidades.

## Permissões internas propostas — para revisão

| Função | Pode acompanhar/executar dentro da autorização | Não recebe automaticamente |
|---|---|---|
| Carolina / administração | Gestão total da carteira, contratação/liberação, atribuição de funções, revisão de pagamentos e acessos | Leitura de senhas, posse de tokens ou autorização para comprar/reparar pelo cliente |
| Implantação/documentação | Clientes atribuídos, manual, pendências, documentos de trabalho e entregas aprovadas | Alterar contrato/preço, confirmar pagamento, recuperar conta ou ampliar permissões |
| Financeiro interno | Contratação necessária à conferência, vencimentos/valores confirmados, situação/problemas e registros financeiros | Conversas de moradores, rascunhos/documentos internos sem necessidade, senhas ou liberação automática |
| Suporte/acessos | Solicitações atribuídas, checagem de vínculo, mecanismo futuro autorizado e registro/revogação conforme política | Ver senha, mudar contratação/preço ou acessar carteira/dados sem finalidade |

A autorização combina função, cliente atribuído e ação permitida; Carolina pode acumular funções. Só conceder o necessário, registrar responsável e revisar/revogar quando mudar função. Matriz é proposta; autenticação e isolamento ainda não implementados.

## Ajuste aprovado — ficha por condomínio e acessos próprios

Carolina aprovou uma ficha de cadastro/configuração no painel interno, preenchida durante implantação e editável depois. Cada condomínio tem pessoas autorizadas, função e permissões individuais, responsáveis pelo atendimento, dias/horários de funcionamento, dias/horários de atendimento e mensagem fora do expediente. Não impor o mesmo expediente ou equipe a todos.

Síndico pode ter secretária ou outros delegados com acesso próprio; não compartilhar conta. A secretária acompanha chamados e responde moradores somente com permissões concedidas naquele condomínio. Função escrita não concede poderes automaticamente. Aprovação de despesas permanece com o síndico conforme configuração autorizada; isso registra fronteira para recurso futuro, não inclui despesas/orçamentos no MVP.

Ações da ficha: cadastrar pessoa/vínculo, definir função e permissões, ativar/desativar vínculo, designar responsáveis e editar dias/horários/mensagem. Histórico registra autor, instante e valores anteriores/novos; alterações não apagam registros anteriores. Mudanças aplicam-se somente ao condomínio selecionado. No produto futuro, a autorização deve ser conferida no servidor e vínculo revogado deve impedir novas ações.

Dados mínimos propostos para implementação: ficha ligada ao condomínio; pessoa/identificação individual; vínculo ativo e permissões por ação; responsáveis de acompanhamento vinculados; regras de funcionamento/atendimento e mensagem; eventos de alteração com autoria/data/antes/depois. Identificação/login/canal de recuperação, fuso, feriados, múltiplos intervalos, notificações e método seguro de verificar vínculo continuam a decidir. Não presumir aprovação dessas outras recomendações.

No protótipo, exemplos são fictícios, ficha salva neste navegador e prévia fora do expediente é acionada manualmente. Não há conta, relógio automático de expediente, autenticação, revogação real ou envio de mensagem. Mensagem fora do expediente não fecha pedido nem inventa prazo de resolução; próximo retorno continua acompanhado. Registro recebido e responsabilidade humana não são promessa de atendimento 24h.

Critérios adicionais: alterar A não muda B; secretária autorizada responde e autoria aparece no histórico/prévia sem alterar campos que não pode editar; retirar permissão impede nova ação na simulação; cada pessoa tem identificação própria; alterações de horário/vínculo preservam histórico; novo pedido fora do expediente mostra mensagem de A; recarregar mantém revisão válida; dados anteriores sem ficha recebem somente campos novos de exemplo sem apagar atendimentos/configuração/financeiro. Testes da autorização real ficam para backend.

[Experimentar ficha e delegados no protótipo](prototipo-paineis.html). Cadastro básico morador segue WhatsApp, sem painel/login; carteira interna não aparece aos delegados.
