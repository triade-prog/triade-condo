# Painel Carolina / administradora TRÍADE

## Decisão mais recente — atendimento humano opcional e número em proposta

Atendimento humano pelo WhatsApp é opcional: condomínio pode assumir com equipe própria ou contratar TRÍADE para atender. A contratação do serviço humano é separada da plataforma. Ficha guarda modelo escolhido, referência de contratação quando TRÍADE, pessoas autorizadas e horários por condomínio. Não presumir contratação, equipe, capacidade ou suporte 24h; troca de equipe/revogação mantém histórico e autoria. Produto continua com responsáveis/andamento/retornos essenciais, sem inventar pessoa disponível ou assumir IA/automação para substituir atendimento.

A sugestão de um número institucional exclusivo/próprio por condomínio não recebeu aprovação explícita, conforme esclarecimento mais recente de Carolina; permanece PROPOSTA. Isso prevalece sobre textos anteriores que o descreviam como pré-requisito de adesão. WhatsApp permanece canal do morador; topologia dos números e roteamento seguro por condomínio continuam a decidir, sem conta real ou integração.


## Escopo vigente confirmado em 08/10/2026

MVP aprovado: atendimento completo WhatsApp institucional, comunicados/documentos básicos, painel síndico e painel Carolina com clientes/contratação/liberação, implantação/manual, registro pagamentos à TRÍADE e recuperação segura de acesso síndico. Agenda e coordenação de manutenção ficam depois; orçamentos fora do inicial. O texto abaixo preserva visão anterior/ampliada; não torna conjuntos adicionais parte do MVP. [Especificação vigente](especificacao-mvp.md) prevalece. Propostas de estados, telas e mecanismos continuam sujeitas à revisão. Nenhum backend/autenticação/WhatsApp real implementado.


## Objetivo

Gerenciar todos os condomínios clientes, suas contratações e conjuntos liberados, com visão da implantação e serviços internos. Área exclusiva Carolina/equipe TRÍADE autorizada, separada do painel cliente.

## Organização proposta

1. Carteira: identificar condomínio, contato responsável, estágio do cliente, contratação e implantação. Distinguir ativo, em implantação e situações a tratar; acompanhamento financeiro interno em área própria, sem cobrança automática.
2. Ficha do cliente: informações acordadas e responsáveis, número institucional, contrato/escopo de serviço, conjuntos contratados e liberados. Não usar dados reais na revisão.
3. Liberação: escolher condomínio → conferir contratação → liberar conjunto inteiro → registrar data/responsável/referência → verificar projeção do que o síndico acessará. Não fracionar etapas essenciais do atendimento. Mudanças aplicam-se somente ao condomínio selecionado.
4. Implantação e apoio documental: tarefas internas, responsáveis, pendências, rascunhos, revisão e entregas. Síndico fornece dados/valida/aprova conteúdo; recebe resumo e documentos finais compartilhados. Notas e carteira internas não são expostas.
5. Orientação de novos moradores: organização interna do serviço, usando regras existentes aprovadas, cadastro breve nome/telefone/apartamento; CPF apenas se necessário a financeiro futuro. Frequência/modalidade/inclusão/preço a definir.
6. Histórico administrativo: quem alterou contratação/liberação, motivo, data e referência. Auditabilidade futura a implementar; registro local do HTML é apenas revisão.

## Responsabilidades

Carolina registra contratação e controla liberações. Equipe de implantação executa serviços acordados, conforme responsáveis a designar. Condomínio aprova regras/conteúdo e decide suas próprias ações. Gestão da carteira não dá à TRÍADE autorização para selecionar prestador, comprar ou executar manutenção pelo cliente.

## Fronteiras de acesso

Síndico não vê esta área, outros clientes, rascunhos/notas internas, configurações administrativas ou dados da equipe. Acesso de suporte aos dados do cliente precisa de finalidade e permissões definidas; não presumir que toda a equipe pode ler toda conversa. Não compartilhar senha do síndico. Futuro produto deve separar carteira e dados por condomínio, além de registrar acessos/mudanças relevantes.

## Configuração versus construção

Configurável no produto futuro: cadastro e vínculo dos clientes, conjuntos segundo contratação, referência/andamento da implantação e responsáveis permitidos. Exige construção futura: autenticação, permissões, persistência, barreiras entre condomínios, liberação real e auditoria. O HTML apenas demonstra a relação contratado/liberado e a projeção do painel síndico.

## Revisar antes de construir

Confirmar pessoas autorizadas por função, aprovação de mudanças de contratação, regras de suspensão/retirada sem perder histórico, acesso de suporte e aceite das entregas. Base de atendimento não pode ser reduzida em subfunções. Nenhum preço ou procedimento de cobrança definido; acompanhamento interno de pagamentos é planejado separadamente.


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
