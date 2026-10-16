from pathlib import Path
root=Path('outputs/triade-condo')
files={
'docs/produto.md':'''# TRÍADE Condo — documento de produto

Versão inicial • 03/10/2026 • hipóteses para validação, não compromissos comerciais.

## Dor e proposta de valor
O síndico morador acumula reclamações, manutenção e cobranças de fornecedores. A TRÍADE oferece assessoria operacional: recebe, organiza, acompanha e comunica demandas, levando ao síndico decisões e autorizações necessárias. O diferencial a testar é acompanhamento com responsável, prazo de retorno, evidência de providência e revisão de encerramento.

## Personas
- Síndico morador: quer saber o que precisa decidir, o motivo, as alternativas e a consequência de esperar.
- Morador: quer protocolo, previsão de retorno e explicação sobre o que foi feito.
- Operador TRÍADE: coordena triagem, cobrança, atualização e revisão, com fila e histórico.
- Prestador/equipe: recebe escopo e prazo, informa impedimentos e registra evidência.
- Gestor TRÍADE: acompanha vários clientes, capacidade, atrasos e qualidade sem misturar dados.

## Jornada de atendimento
1. Entrada por WhatsApp/BotConversa ou formulário; registrar protocolo, condomínio, local, categoria e descrição.
2. Confirmar recebimento automático e informar horário humano. Emergências devem seguir o canal de emergência do condomínio, ainda a definir.
3. Operador verifica duplicidade, urgência, acesso e dados faltantes; atribui responsável.
4. Definir prazo de próximo retorno e estimativa de resolução separadamente. Estimativa pode mudar, com justificativa registrada.
5. Acompanhar execução e registrar pendência de equipe, fornecedor, morador ou decisão do síndico.
6. Comunicar andamento, inclusive quando não há resolução. Cobrança interna não equivale a atualização ao morador.
7. Solicitar decisão ao síndico com alternativas, custo estimado, evidências e prazo; registrar autoria e resposta.
8. Prestador informa execução; operador revisa evidência e explicação antes de concluir. Morador pode contestar e reabrir.

## Papéis e limites
A TRÍADE realiza triagem, vistorias contratadas, checklists, coleta de fotos, coordenação e acompanhamento de prestadores. O síndico mantém o cargo, representação legal e decisões que lhe competem. A TRÍADE não movimenta recursos, aprova despesas nem aplica multas autonomamente. Aprovação registrada no painel não executa pagamento nem substitui regras internas do condomínio. A TRÍADE responde pelo serviço que presta; contratos, proteção de dados, retenção e responsabilidades precisam de validação profissional futura.

## MVP prioritário
- Clientes/condomínios e permissões com isolamento de dados no servidor na implementação real.
- Protocolo, cadastro de demanda, local, categoria, triagem, responsável e histórico.
- Prazo de retorno separado da previsão de resolução; alerta de atraso de retorno.
- Pendências explícitas, solicitações de decisão e justificativa de aprovação/rejeição.
- Atualização ao morador com registro de envio e falha na integração real.
- Conclusão com evidência, explicação e revisão; reabertura rastreável.
- Visão de atrasos, recorrências e decisões; relatórios por condomínio.

Fora do MVP: contabilidade, pagamentos, multas automáticas, assembleias, representação legal, contratação automática e atendimento de emergência pela TRÍADE.

## Critérios de aceitação
Nenhum chamado sem condomínio/protocolo. Toda mudança relevante entra no histórico. Aprovar exige usuário autorizado no servidor real. Concluir exige evidência e explicação. Retorno enviado recalcula seu próprio prazo, sem alterar resolução. Reabertura conserva histórico. Consultas e anexos não podem expor outro cliente. Falha de envio não pode marcar mensagem como entregue.

## Indicadores
Tempo até triagem; retornos vencidos; demandas por responsável/pendência; tempo de resolução por categoria; taxa de reabertura; reincidências por local/categoria; decisões aguardando síndico. Metas só após medir o piloto. Recorrência indica investigação, não prova de causa comum.

## Questões para Gabriela e síndicos
Quais demandas consomem mais tempo? Quem é autorizado a decidir e quais limites exigem assembleia? Qual volume e horário humano viável? Qual canal de emergência já existe? Quais prestadores e equipes recebem tarefas? Que fotos/checklists comprovam execução? Quem revisa o encerramento? Qual prazo de retorno aceitável por categoria? Como cadastrar e verificar moradores? Que dados podem ser visíveis para cada papel? Qual escopo e preço do serviço humano? Quem substitui operador ausente?

## Evidência disponível
Pesquisa inicial relatou cadastro travado, suporte sem retorno, falhas de notificações e encerramento pouco claro; amostra não representativa e ainda sem base documental local. SindIA e PedeCondo foram citados como concorrentes com entrada simples/WhatsApp e painel. Esses relatos são hipóteses de descoberta, não comparação verificada nem prova de mercado. Fazer entrevistas e registrar fontes antes de usar comercialmente.
''',
'docs/arquitetura.md':'''# Desenho técnico modular

## Pressupostos iniciais
Protótipo: HTML, CSS e JavaScript em módulos nativos, sem dependências. Servidor local Python apenas para arquivos estáticos. Dados fictícios em memória; recarregar reinicia alterações. Nenhuma autenticação, envio de mensagem, upload ou integração real. Seletor de perfil e filtro de condomínio demonstram jornadas, não segurança.

Stack futura proposta, sujeita à equipe e orçamento: frontend TypeScript; API modular Node/TypeScript; PostgreSQL; armazenamento privado de anexos; fila para integrações. Começar monólito modular e separar serviços só quando necessário.

## Módulos
Identidade/permissões → clientes e condomínios → chamados/triagem → tarefas e prazos → decisões → evidências/revisão → comunicação → indicadores/auditoria.

Cada chamado pertence a um condomínio e cliente. A API deriva tenant e permissões da sessão e confere vínculo em toda operação. Identificadores fornecidos pelo cliente não autorizam acesso. RLS pode complementar controles de aplicação. Anexos privados usam URLs temporárias, verificadas pelo vínculo. Perfis: morador limitado às próprias demandas; prestador às tarefas atribuídas; síndico ao condomínio autorizado; operador aos vínculos de atendimento; gestor aos clientes autorizados.

## Entidades
Tenant, Condominium, User, Membership, Ticket, Assignment, DecisionRequest, Evidence, StatusEvent, Communication, Inspection, ChecklistItem. Ticket contém nextResponseAt e estimatedResolutionAt independentes. Eventos têm autor, data, estado anterior e justificativa. DecisionRequest contém alternativas, valor estimado, decisão e justificativa; não inicia transação financeira.

## Estados
Recebido → Em triagem → Em andamento → Aguardando fornecedor/equipe/morador/síndico → Em revisão → Concluído. Contestação leva Concluído a Em andamento preservando os eventos. Pendência exige responsável e motivo. Fechamento exige evidência e explicação revisadas; histórico não pode ser editado pelo usuário comum.

## Contratos de API propostos
POST /tickets; GET /tickets; GET /tickets/:id; POST /tickets/:id/events; POST /tickets/:id/communications; POST /tickets/:id/evidence; POST /tickets/:id/review; POST /tickets/:id/reopen; POST /decisions/:id/respond. Escritas usam validação de estado, autorização e controle de versão contra conflitos.

## WhatsApp/BotConversa — integração futura
Webhook autenticado → identificar condomínio/morador → deduplicar por ID externo → registrar demanda → enfileirar confirmação. Outbox transacional e retries com limite; falhas visíveis ao operador. Respeitar consentimento, políticas e restrições do provedor a validar. Não confiar em número de telefone como único mecanismo de autorização para decisões. Separar recebido, enviado e entregue; confirmação automática não promete atendimento humano imediato.

## Serviço humano
Vistoria associa checklist, local, responsável, data e evidência ao chamado. Registrar quando visita depende de acesso do morador ou prestador. Fotos e custos devem passar por controles de acesso e retenção definidos antes do piloto.

## Validação antes de piloto real
Testar isolamento entre clientes, permissões, anexos, auditoria, concorrência em decisões, webhook duplicado, falha de envio, reabertura e prazos. Definir backups/restauração, observabilidade, retenção, exclusão e revisão profissional de termos e privacidade. Não usar este protótipo com dados reais.
''',
'README.md':'''# TRÍADE Condo

Protótipo inicial e documentação de produto. Todos os nomes, valores e registros são fictícios.

## Abrir
Na pasta `outputs/triade-condo/prototype`, executar `python3 -m http.server 8765 --bind 127.0.0.1` e abrir http://127.0.0.1:8765. Módulos JavaScript precisam desse servidor local.

## Roteiro de revisão
1. Operação: abrir chamado, observar prazos separados e registrar retorno simulado.
2. Síndico: entrar na fila de decisões, aprovar ou devolver com justificativa.
3. Operação: registrar conclusão e evidência textual, revisar e concluir; reabrir se necessário.
4. Nova demanda: preencher condomínio/local/categoria e observar protocolo na fila.
5. Trocar condomínio e conferir filtros de atrasos e reincidências.

Alterações duram somente nesta sessão da página. Evidências são referências textuais fictícias, sem upload. Perfis e filtros são simulações sem autenticação. Nenhuma comunicação sai do navegador. O protótipo não serve para operação real.

Arquivos: `docs/produto.md`, `docs/arquitetura.md`, `prototype/js/data.js`, `prototype/js/domain.js`, `prototype/js/app.js` e `prototype/css/style.css`.

## Próximos passos
Validar o fluxo com Gabriela e 3–5 síndicos; definir horário humano, emergências e critérios de encerramento; priorizar ajustes; implementar autenticação, API e isolamento; testar integração em ambiente de testes; preparar piloto com contrato e privacidade revisados profissionalmente.
'''
}
for name,content in files.items(): (root/name).write_text(content)
