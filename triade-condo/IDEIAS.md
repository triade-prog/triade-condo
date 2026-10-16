# TRÍADE Condo — todas as ideias

Arquivo único de partida para construir o sistema. Junta, sem filtro de MVP ou de decisões anteriores:

| Marca | Origem | Onde está o material completo |
|---|---|---|
| **[A]** | Documentos do projeto (03–15/10/2026) | `arquivo/` |
| **[BR]** | Pesquisa de mercado brasileiro | `arquivo/estudo-pre-desenvolvimento/estudo-de-mercado-2026-10-15.md` e `arquivo/outputs/triade-condo/pesquisa/` |
| **[INT]** | Pesquisa de referências internacionais | `arquivo/estudo-pre-desenvolvimento/referencias-internacionais-2026-10-15.md` |

Quando uma ideia aparece em mais de uma origem, as marcas se somam. Entre parênteses vai a referência de onde a ideia foi vista. Nada aqui está decidido nem priorizado: é o cardápio completo.

---

## 1. Visão e pessoas

| ID | Ideia | Origem |
|---|---|---|
| V-01 | Plataforma que organiza o atendimento e a rotina do condomínio: todo pedido tem responsável, próximo retorno, andamento e conclusão explicada | [A] [INT] |
| V-02 | Público inicial: síndico morador de prédio com pouca estrutura, sem administradora; evolução até condomínio grande, com ou sem portaria | [A] [BR] |
| V-03 | Foco geográfico inicial: Brasília/DF | [A] |
| V-04 | Cenário 1: prédio simples sem portaria (porta, elevador, apartamentos; visitas e entregas direto com o morador). Não presumir porteiro, zelador, administradora ou prestador fixo | [A] |
| V-05 | Cenário 2: portaria remota/virtual (no DF, o STF derrubou em maio/2026 a lei que restringia; mais de 800 condomínios já usam). Portaria remota não implica manutenção nem integração técnica com o sistema | [A] [BR] |
| V-06 | Cenário 3: portaria presencial com atendente e troca de turnos. Ter portaria não garante zelador, equipe nem revisão; os responsáveis vêm das pessoas cadastradas, não do tipo de portaria | [A] |
| V-07 | **Morador**: usa só o WhatsApp do condomínio, sem app, portal, login ou senha | [A] [BR] |
| V-08 | **Síndico**: painel web de gestão e avisos de novidades no próprio WhatsApp. O sistema funciona por completo sem operador TRÍADE | [A] |
| V-09 | **Secretária e delegados do síndico**: acesso próprio, com permissões individuais por condomínio | [A] |
| V-10 | **Carolina e equipe TRÍADE**: painel interno com todos os clientes, implantação, pagamentos e suporte | [A] |
| V-11 | **Prestador ou executor**: recebe escopo e prazo, informa impedimentos e registra execução, sem conta própria | [A] [INT] |
| V-12 | **Visitante ou entregador**: perfil público via QR na entrada (ver seção 12) | [A] |
| V-13 | **Construtora/incorporadora** como ator: defeitos de obra e canal de venda (Aptner, i-Neighbour) | [INT] |
| V-14 | **Conselho e subsíndico** como níveis de escalonamento e de aprovação | [A] [INT] |
| V-15 | Frase de posicionamento: "Nenhum pedido do seu prédio fica sem resposta — e a história do prédio não vai embora com o síndico" | [INT] |
| V-16 | Ser o meio-termo entre o app barato "faça você mesmo" e o síndico profissional caro: síndico morador + plataforma + especialistas TRÍADE (Matera, França) | [INT] |
| V-17 | **O que a TRÍADE não faz**: o síndico mantém o cargo, a representação legal e as decisões que lhe cabem; a TRÍADE, inclusive no serviço humano, não movimenta dinheiro, não aprova despesas nem aplica multas por conta própria, e responde só pelo serviço que presta | [A] |

---

## 2. Canal WhatsApp

| ID | Ideia | Origem |
|---|---|---|
| W-01 | Número institucional próprio de cada condomínio (não usar o WhatsApp pessoal do síndico). Ainda é proposta, não condição de adesão (a alternativa é a W-02); na implantação, conferir quem é dono e quem controla o número e planejar a migração antes de integrar | [A] |
| W-02 | Alternativa: número compartilhado da TRÍADE com roteamento seguro por condomínio | [A] |
| W-03 | **Coexistência**: conectar o número que o condomínio já usa no app WhatsApp Business à API oficial, sem perder o app (Meta). Vale só para número do WhatsApp Business, não para número pessoal comum; sincroniza até 6 meses de histórico | [BR] |
| W-04 | Usar a API oficial do WhatsApp (direto ou via provedor), nunca conexão por QR Code ou WhatsApp Web; confiabilidade como argumento de venda | [A] [BR] |
| W-05 | Morador envia texto, foto, áudio e documento; tudo fica ligado ao pedido certo | [A] |
| W-06 | Transcrição de áudio. Nunca prometer ao morador uma transcrição que ainda não existe | [A] |
| W-07 | **WhatsApp Flows**: formulário dentro da conversa para abrir pedido estruturado (unidade, local, categoria, foto) | [BR] |
| W-08 | Confirmação imediata de recebimento, com número de protocolo e "o que acontece agora" (Fixflo). Diz só que o pedido foi registrado e como funciona o atendimento naquele horário, sem afirmar que alguém já está trabalhando nele; nunca promete atendimento imediato, equipe TRÍADE, socorro ou cobertura ilimitada | [A] [INT] |
| W-09 | Morador consulta o andamento do próprio pedido a qualquer momento pelo WhatsApp | [A] [INT] |
| W-10 | Morador pede revisão ou contesta a conclusão pelo WhatsApp | [A] |
| W-11 | Síndico recebe no WhatsApp: novo pedido, nova reclamação, retorno vencido e novidades relevantes, sem precisar manter o painel aberto. Decisões são tomadas no painel; não avisar cada alteração técnica | [A] |
| W-12 | Mensagem automática fora do horário, configurável por condomínio, sem prometer prazo. Não fecha o pedido, e o próximo retorno continua valendo | [A] |
| W-13 | Estados da mensagem separados do estado do pedido: recebida, envio pendente, aceita, entregue, lida, falhou, resultado desconhecido | [A] |
| W-14 | Fila durável de envio com novas tentativas limitadas; falha fica visível com responsável. Repetir só em falha passageira, com intervalo crescente; erro permanente vai direto para a lista de falhas; reenvio manual registra o motivo; falha de envio é separada de falha ao salvar a alteração | [A] |
| W-15 | Eventos repetidos não duplicam pedido nem aviso (deduplicação). Eventos recebidos têm autenticidade verificada; repetições e eventos fora de ordem são tratados | [A] |
| W-16 | Registro de preferências e de pedido para não receber avisos (opt-out) | [A] |
| W-17 | Avisos segmentados por torre ou bloco (MeuVizy) | [BR] |
| W-18 | Canal alternativo e conciliação quando o WhatsApp ou o provedor ficar fora do ar. Um responsável definido registra o incidente e a conciliação depois | [A] |
| W-19 | Ligação telefônica ou voz como canal complementar (Latchel, Vendoroo, Condo Control). Também e-mail e SMS como canais complementares (Nextin, iSindi) | [A] [INT] |
| W-20 | Respostas em vários idiomas para moradores estrangeiros (Fixflo: 40+ idiomas) | [INT] |
| W-21 | Respeitar a janela de 24h e os modelos aprovados nas mensagens iniciadas pelo condomínio; a janela técnica não é prazo de atendimento | [A] |

---

## 3. Atendimento (o coração do sistema)

| ID | Ideia | Origem |
|---|---|---|
| AT-01 | Registro do pedido: protocolo, condomínio, unidade, contato, local, categoria, descrição, anexos | [A] |
| AT-02 | Fila de pedidos com filtros por situação, responsável, prioridade e categoria. Mostra há quanto tempo cada pedido está aberto (Mygate) | [A] |
| AT-03 | Responsável real por pedido; quem responde pode ser diferente de quem executa. O responsável é sempre uma pessoa autorizada naquele condomínio e confirma que aceitou o pedido, inclusive no repasse entre turnos | [A] |
| AT-04 | Prioridades com significado explícito | [A] |
| AT-05 | Etapas configuráveis por condomínio e por tipo de pedido, sempre ligadas a aberto, em andamento ou encerrado | [A] |
| AT-06 | **Próximo retorno**: compromisso de atualizar o morador, separado da previsão de solução (padrão "periodic update" de help desks). Toda mudança do próximo retorno fica no histórico, com motivo. Enviar um retorno ao morador recalcula o próximo retorno sem mudar a previsão de solução; cobrar fornecedor internamente não conta como retorno; o andamento é comunicado mesmo quando ainda não há solução | [A] [INT] |
| AT-07 | Previsão de solução só quando conhecida; ausência fica explícita, nunca prazo inventado. A previsão pode mudar, sempre com justificativa no histórico | [A] |
| AT-08 | Alerta de retorno vencido | [A] |
| AT-09 | **Escalonamento automático**: retorno vencido avisa responsável → síndico → substituto ou conselho (Mygate) | [INT] |
| AT-10 | Prazo-padrão de retorno por categoria, com regras de pausa e feriados. Prazo também por prioridade (Condo Control) e prazo de solução definido pelo conselho (Mygate) | [A] [INT] |
| AT-11 | Pendências e impedimentos explícitos: aguardando fornecedor, morador, decisão do síndico, peça, acesso. Cada pendência tem responsável e motivo | [A] [BR] |
| AT-12 | Sem executor disponível: pendência real, nunca pessoa inventada | [A] |
| AT-13 | Conclusão com explicação ao morador e evidência quando fizer sentido (foto, referência), sem exigir foto sempre. A evidência pode vir do síndico ou de um executor autorizado, sem depender de porteiro ou zelador. Foto não substitui laudo: serviço especializado exige avaliação técnica competente | [A] |
| AT-14 | Revisão da conclusão pelo síndico ou revisor antes de encerrar. Sem exigir equipe local, segunda pessoa da TRÍADE ou portaria. A revisão por outra pessoa é opcional e configurável; o síndico pode executar e revisar o mesmo pedido; concluir não depende de foto nem de aceite do morador | [A] |
| AT-15 | Reabertura com motivo, preservando a conclusão anterior. O pedido reaberto ganha responsável e próximo retorno. Reabertura configurável por condomínio (Mygate); nunca reabrir automaticamente por qualquer mensagem: uma pessoa autorizada decide entre reabrir e abrir pedido novo | [A] [INT] |
| AT-16 | **Pergunta de satisfação ao concluir** ("Resolveu? 1 a 5"); nota baixa sugere reabertura (Property Meld) | [INT] |
| AT-17 | Histórico completo com autor, data e antes/depois; nada é apagado | [A] [INT] |
| AT-18 | Relacionar pedidos duplicados e reincidências por local/categoria, mantendo o protocolo e o histórico de cada relato. Reincidência é sinal para investigar, não causa confirmada. Fica mais precisa com o QR por local (AT-30) | [A] [BR] |
| AT-19 | **Autoajuda antes do chamado**: orientação curta por tipo de problema e "resolveu?" (Fixflo) | [INT] |
| AT-20 | **Responsabilidade da unidade × condomínio**: avisar quando o problema é do morador, com base nas regras do prédio | [INT] |
| AT-21 | Videochamada com profissional para orientar o morador (Fixflo "Help me Fix") | [INT] |
| AT-22 | Triagem de urgência e orientação de emergência para o canal do condomínio, com responsáveis definidos por condomínio. Nunca prometer socorro nem equipe TRÍADE sem o serviço contratado (SH-05) | [A] [INT] |
| AT-23 | Solicitação de decisão ao síndico: alternativas, custo estimado, prazo, justificativa da aprovação ou devolução. Autoria e justificativa obrigatórias; a aprovação não contrata nem paga nada automaticamente. Usada só quando o caso exige, seguindo a organização que o condomínio já tem; não substitui as regras internas do condomínio | [A] |
| AT-24 | Controle de edição simultânea: duas pessoas não sobrescrevem a mesma alteração sem aviso (Zendesk). Cada alteração leva a versão que a pessoa leu; no conflito, mostra a versão nova sem perder o que a pessoa escreveu; dados e histórico gravados juntos | [A] |
| AT-25 | Modelos de resposta prontos por condomínio | [A] |
| AT-26 | Avisar todos os envolvidos ao mesmo tempo quando um problema é registrado: síndico, prestador, moradores afetados (Plusvecinos) | [INT] |
| AT-27 | Kanban de pedidos (MeuSíndico.IA) | [BR] |
| AT-28 | Status visíveis ao morador: novo, em análise, aguardando peça, em andamento, concluído (SindIA) | [BR] |
| AT-29 | Roteamento automático por tipo: manutenção → zelador, acesso → portaria, reclamação → síndico (SindIA) | [BR] |
| AT-30 | **Etiquetas QR por local**: QR fixado no elevador, garagem ou hall abre o WhatsApp do condomínio com o local já escrito ("Problema em: elevador social, bloco A"); a produção e a colagem são um serviço (seção 17) (ComtyLink, Arcsite) | [INT] |
| AT-31 | Cancelamento do pedido com motivo e autor; o pedido cancelado continua no histórico | [A] |
| AT-32 | **Pedido privado**: reclamação visível só a quem abriu e à gestão autorizada; outros moradores recebem no máximo um resumo autorizado (Nextin, uCondo) | [A] [BR] |
| AT-33 | Pedido fora do que cabe ao condomínio vira encaminhamento registrado, com resposta ao morador, sem prometer resolver | [A] |

---

## 4. Inteligência artificial

| ID | Ideia | Origem |
|---|---|---|
| IA-01 | Responder dúvidas do morador com base **só** no regimento e nos documentos aprovados, citando documento e versão (Móra, Gruvi, Condo Control) | [BR] [INT] |
| IA-02 | Quando a IA não souber: encaminhar a humano com próximo retorno | [INT] |
| IA-03 | **Rascunho de resposta** ao morador para o síndico aprovar com um toque (Condo Control, AppFolio, Buildium) | [INT] |
| IA-04 | Resumo do caso e do histórico para quem assume o pedido | [INT] |
| IA-05 | Redação de comunicados e avisos | [BR] [INT] |
| IA-06 | Rascunho de ata a partir de anotações de reunião real (Superlógica, SMPLR) | [BR] [INT] |
| IA-07 | Resumo de documentos longos: orçamento anual, laudos, contratos (Condo Control) | [INT] |
| IA-08 | Assistente jurídico para o síndico com base na lei e na convenção, com aviso de que não substitui advogado (Seu Síndico IA). Inclui orientação sobre ações, riscos e documentos necessários para cada decisão (PedeCondo) | [BR] |
| IA-09 | Memória do condomínio: decisões, pendências e combinados recuperados por pergunta (Seu Síndico IA) | [BR] |
| IA-10 | Resumo diário para o síndico | [BR] |
| IA-11 | Agentes especializados: triagem, síndico, operação/manutenção, morador (MeuSíndico.IA) | [BR] |
| IA-12 | Extrair tarefas das conversas, com responsável e prioridade (Seu Síndico IA) | [BR] |
| IA-13 | Diagnóstico de problema por foto (Vendoroo) | [INT] |
| IA-14 | Relatórios gerados por IA (MeuSíndico.IA) | [BR] |
| IA-15 | Regra de ouro vista lá fora: todo texto de IA é rascunho até uma pessoa aprovar. A IA não substitui o responsável humano nem conta como atendimento; nunca prometer "atendimento 24h por IA" | [INT] |
| IA-16 | Observar a política da Meta: bot de atendimento da própria empresa é permitido; IA de uso geral no WhatsApp não | [BR] |
| IA-17 | Ler o grupo de WhatsApp do condomínio para alimentar a memória e o resumo diário (Seu Síndico IA) | [BR] |
| IA-18 | Responder moradores dentro do grupo de WhatsApp quando mencionado, segundo regras do síndico (Seu Síndico IA) | [BR] |
| IA-19 | Classificar o pedido automaticamente a partir da mensagem (gateway de IA, MeuSíndico.IA) | [BR] |
| IA-20 | IA conversa com o morador para completar a descrição e pedir foto antes de registrar o pedido (Vendoroo) | [INT] |

---

## 5. Comunicados e documentos

| ID | Ideia | Origem |
|---|---|---|
| CD-01 | Comunicado: rascunho → publicado → substituído/arquivado, com autor, data e versão | [A] |
| CD-02 | Público autorizado: todo o condomínio, bloco, unidade ou contatos escolhidos (uCondo). Os destinatários são recalculados antes de cada envio; contato revogado não recebe nova versão | [A] [BR] |
| CD-03 | Morador recebe e consulta documentos vigentes (regimento, convenção, regras) pelo WhatsApp, em texto, resumo ou PDF | [A] |
| CD-04 | Arquivos privados com acesso por permissão; nada em pasta pública. Links que expiram e podem ser revogados, enviados só aos destinatários necessários; depois do download a cópia não é controlável. Conteúdo que precisa de controle depois de compartilhado vai como resumo permitido, não como arquivo | [A] |
| CD-05 | Comunicado ligado a um pedido (ex.: aviso de interrupção por manutenção) | [A] |
| CD-06 | Campanhas e comunicação programada | [A] |
| CD-07 | Arquivo administrativo com versões anteriores e revisões | [A] |
| CD-08 | Acompanhar recebimento dos comunicados quando o canal permitir ("enviado" não é "lido") | [A] |
| CD-09 | Avisos com foto | [BR] |
| CD-10 | Carta física ou eletrônica para convocação formal (casavi ePost) | [INT] |
| CD-11 | **Plano de comunicação do condomínio**: o que o morador recebe, quando, e sobre o que é consultado (estratégia de engajamento, Reino Unido) | [INT] |

---

## 6. Configuração e ficha por condomínio

| ID | Ideia | Origem |
|---|---|---|
| CF-01 | Ficha do condomínio preenchida na implantação e editável depois | [A] |
| CF-02 | Pessoas autorizadas, cada uma com acesso próprio (sem conta compartilhada) | [A] |
| CF-03 | Permissões individuais: acompanhar, responder, atualizar, concluir, publicar, configurar. Cargo ou função não concede permissão automaticamente; portaria, administradora ou fornecedor não ganham acesso só por existirem. Aprovar despesas e decisões fica com o síndico e só passa a um delegado se ele configurar; contratar o serviço humano também não concede permissão | [A] |
| CF-04 | Vínculo ativo ou revogado; revogado não age mais, mas a autoria antiga fica | [A] |
| CF-05 | Responsáveis pelo atendimento por condomínio. O responsável padrão da fila é o síndico ou uma pessoa autorizada por ele, de fato disponível; desativar quem tem pedidos em andamento exige substituto ou pendência explícita | [A] |
| CF-06 | Dias e horários de funcionamento e de atendimento | [A] |
| CF-07 | Modelo de atendimento humano: equipe do condomínio ou TRÍADE contratada. A ficha guarda a referência do contrato quando o atendimento é da TRÍADE; trocar de equipe preserva histórico e autoria; nunca presumir cobertura 24h | [A] |
| CF-08 | Categorias, prioridades, etapas e modelos de resposta por condomínio | [A] |
| CF-09 | Identificadores estáveis: renomear ou desativar etapa sem quebrar histórico. Etapa já usada só pode ser desativada para novos registros; mover pedidos abertos exige escolher o destino e registrar a decisão | [A] |
| CF-10 | Feriados, fuso, múltiplos intervalos de atendimento. Data sem horário aparece como foi escrita, sem conversão de fuso (evita mostrar o dia anterior) | [A] |
| CF-11 | Recursos ativados ou desativados por condomínio (Gruvi) | [A] [BR] |
| CF-12 | **Configuração proporcional**: começa simples e só ajusta opções dos recursos que existem; não é construtor de fluxos; nada obrigatório em todos os casos (foto, ata, orçamento, checklist); regra complexa nova é desenvolvimento; configurar nunca esconde histórico nem remove permissões essenciais | [A] |

---

## 7. Moradores e unidades

| ID | Ideia | Origem |
|---|---|---|
| MU-01 | Cadastro breve: nome, telefone, apartamento; CPF só se necessário ao financeiro | [A] |
| MU-02 | Verificação do vínculo contato ↔ unidade; contato desconhecido não acessa nada restrito. O síndico confirma contatos e unidades; informar o número do apartamento não dá acesso a nada; o sistema nunca confirma nomes nem a existência de moradores | [A] |
| MU-03 | Número de telefone sozinho não prova identidade; tratar número reciclado ou compartilhado | [A] |
| MU-04 | Pessoa com vínculo em mais de um condomínio | [A] |
| MU-05 | Boas-vindas do novo morador pelo WhatsApp: regras do prédio, como fazer pedidos e confirmação do cadastro (a orientação feita por pessoas é o serviço de orientação de novos moradores, seção 17) | [A] |
| MU-06 | Família, veículos e pets no cadastro (Gruvi) | [BR] |
| MU-07 | Mudança de morador: entrada e saída com revogação do vínculo | [A] |
| MU-08 | Múltiplos contatos autorizados por unidade (titular, cônjuge, inquilino), com preferências e revogação | [A] |

---

## 8. Manutenção e prédio

| ID | Ideia | Origem |
|---|---|---|
| MP-01 | Coordenação de manutenção: necessidade, área/equipamento, responsável, executor, prioridade, previsão, próximo retorno. Coordenar não significa que a TRÍADE executa a manutenção | [A] |
| MP-02 | Tarefas de manutenção com providência, executor e resultado. Situações fixas (planejada, em andamento, pendente, concluída), com etapas ajustáveis ligadas a elas | [A] |
| MP-03 | Manutenção preventiva e corretiva; calendário de preventivas | [A] [BR] |
| MP-04 | Vínculo opcional entre manutenção, pedido do morador e agenda. Concluir a manutenção não encerra o pedido automaticamente; cancelar uma visita não apaga a manutenção; vínculos só dentro do mesmo condomínio | [A] |
| MP-05 | Cadastro de prestadores, mantido quando o síndico muda (Nextin). Começar pelos contratos e acordos que já existem; não presumir prestador fixo, autorização de entrada nem acompanhamento obrigatório. Cada condomínio tem o seu cadastro, nunca compartilhado entre clientes; registrar um prestador não é contratá-lo | [A] [BR] |
| MP-06 | Indicação de prestadores avaliados pelos moradores (MeuVizy) | [BR] |
| MP-07 | Vistorias e checklists quando necessários (sem checklist universal), registrando responsável, acesso, impedimentos e evidências por pedido e por local. O síndico pode fazer ou atribuir; nada é atribuído automaticamente à portaria remota | [A] [BR] |
| MP-08 | **Check-in e check-out do prestador por QR no local** (Arcsite) | [INT] |
| MP-09 | Fornecedor reserva automático quando o principal não responde (Latchel) | [INT] |
| MP-10 | Agrupar chamados próximos para reduzir deslocamento do prestador (Fixflo) | [INT] |
| MP-11 | Identificar dano causado por morador e cobrar ressarcimento (Latchel) | [INT] |
| MP-12 | **Prontuário digital do prédio**: seguros, garantias, laudos, contratos, plantas, programa de manutenção (França, UE, Reino Unido) | [INT] |
| MP-13 | Programa de manutenção alinhado à ABNT NBR 5674 (atividades, periodicidade, responsáveis, registros, inspeções) | [INT] |
| MP-14 | Manual de uso e manutenção do prédio acessível | [INT] |
| MP-15 | **Canal de defeitos construtivos com a construtora**, separado da manutenção do condomínio (i-Neighbour) | [INT] |
| MP-16 | Plano de manutenção de longo prazo com previsão orçamentária (strata australiano) | [INT] |
| MP-17 | Contratos com prestadores ligados às cotações (HabitaOne) | [BR] |

---

## 9. Agenda

| ID | Ideia | Origem |
|---|---|---|
| AG-01 | Compromissos: reunião, visita técnica, atividade programada, lembrete administrativo | [A] |
| AG-02 | Estados: planejado, a confirmar, confirmado, realizado, cancelado; reagendar guarda o anterior | [A] |
| AG-03 | Lista cronológica e calendário mensal/semanal | [A] |
| AG-04 | Aviso de conflito de horário (sem bloqueio rígido) | [A] |
| AG-05 | Recorrência simples. Separar alterar uma ocorrência de alterar a série inteira | [A] |
| AG-06 | Lembretes pelo WhatsApp a quem participa. Só para destinatários autorizados; cancelar ou reagendar atualiza o lembrete sem duplicar mensagem; falha de envio fica visível | [A] |
| AG-07 | Morador recebe só o que lhe diz respeito (ex.: visita no apartamento dele). Aviso de visita não autoriza entrada; o morador não vê a agenda geral; compromissos internos da TRÍADE não aparecem ao condomínio | [A] |
| AG-08 | Agenda independente do atendimento: o próximo retorno não depende dela, a previsão de solução não vira evento sozinha, pendência sem data nunca aparece como compromisso; separar data pretendida, combinada e realizada; datas divergentes entre agenda e pedido são sinalizadas | [A] |

---

## 10. Orçamentos e compras

| ID | Ideia | Origem |
|---|---|---|
| OC-01 | Fluxo: necessidade → convite a fornecedores → propostas e anexos → comparação → decisão justificada → aceite → acompanhamento. A TRÍADE não escolhe fornecedor nem compra pelo condomínio; orçamento funciona sem financeiro e sem pagamento. Aprovar não é contratar, receber nem pagar; depois da decisão, registrar compra e entrega, com despesa em rascunho ou ordem de serviço opcionais; o morador recebe pelo WhatsApp um resumo autorizado | [A] [BR] |
| OC-02 | Comparar escopo, não só preço: inclusões, exclusões, frete, prazo, validade, garantia | [A] [BR] |
| OC-03 | Link para o fornecedor enviar proposta sem conta, que expira e pode ser revogado (HabitaOne, Cota Todos). O fornecedor pode recusar o convite e vê só a própria proposta, nunca preços concorrentes | [A] [BR] |
| OC-04 | Versões de proposta preservadas; cancelamento não apaga. Proposta vencida exige confirmar o preço (HabitaOne) | [A] [BR] |
| OC-05 | Mínimo de propostas e alçadas configuráveis pelo condomínio, não universais (Superlógica, HabitaOne) | [A] [BR] |
| OC-06 | Escolha mais cara exige justificativa (HabitaOne) | [BR] |
| OC-07 | Planilha comparativa exportável em PDF para o conselho (CoteiBem). Documento final com a proposta escolhida, as recusadas e a nota fiscal (Cotato) | [BR] |
| OC-08 | Compra por itens: lista com quantidade e foto, preço por item, marca e frete; dividir itens entre fornecedores (Cota Todos) | [BR] |
| OC-09 | Cotação com sugestão de fornecedores da rede, além da cotação direta (CoteiBem) | [BR] |

---

## 11. Financeiro do condomínio

| ID | Ideia | Origem |
|---|---|---|
| FC-01 | Controle de receitas, despesas, comprovantes e caixa (iSindi) | [A] [BR] |
| FC-02 | Cobrança mensal por boleto e Pix | [A] [BR] |
| FC-03 | Régua de cobrança e lembrete de vencimento pelo WhatsApp (iSindi, MyCond) | [BR] |
| FC-04 | 2ª via de boleto pelo WhatsApp (Superlógica, ConexCondo) | [BR] |
| FC-05 | Começar pelo mês atual, sem migrar todo o histórico (iSindi) | [BR] |
| FC-06 | Previsão orçamentária anual | [A] |
| FC-07 | Patrimônio do condomínio | [BR] |
| FC-08 | Conta digital e garantia de inadimplência (Superlógica, FIDC) | [BR] |
| FC-09 | Acordos de inadimplência negociados pelo WhatsApp (wCond) | [BR] |
| FC-10 | Conselho aprova faturas ou despesas no sistema (strata australiano) | [INT] |
| FC-11 | Folha de pagamento dos funcionários do condomínio (Group Software) | [BR] |

---

## 12. Portaria, acesso, encomendas e chegada

| ID | Ideia | Origem |
|---|---|---|
| PA-01 | Registro de encomendas com aviso ao morador pelo WhatsApp (MeuVizy, SindIA). Registra quem guardou e quem retirou, para evitar entrega à unidade errada | [A] [BR] |
| PA-02 | Lista de convidados enviada à portaria (MeuVizy) | [BR] |
| PA-03 | Pedido de acesso de visitante encaminhado à portaria (SindIA) | [BR] |
| PA-04 | Controle de acesso integrado: reconhecimento facial, QR, biometria, placas (Condomob, Gruvi) | [BR] |
| PA-05 | Repasse entre turnos de portaria com rastreabilidade | [A] |
| PA-06 | **Plaquinha QR de chegada**: visitante informa o apartamento e o sistema avisa os contatos da unidade, sem expor dados nem abrir porta. Resposta pública neutra (não confirma presença nem identidade), limites contra abuso, validação do apartamento, alternativa quando o aviso falhar e nenhuma promessa de atendimento imediato | [A] |
| PA-07 | Avisar a unidade, não só um celular (vários contatos, roteamento simultâneo ou sequencial) | [A] |
| PA-08 | Receptor sonoro local: interfone coletivo, campainha sem fio por unidade, controlador integrável (Intelbras, Shelly). Avaliação no local antes de escolher; campainha comum não aceita acionamento por software | [A] |
| PA-09 | Armário de encomendas em locação, com sistema, manutenção e aviso no WhatsApp. Avaliar no local espaço, acesso do entregador, retirada individual, rastreabilidade e exceções; nunca prometer ausência de extravio nem integração que não existe | [A] |
| PA-10 | Coordenação com a empresa de portaria remota (sem controlar o portão) | [A] |
| PA-11 | Controle de chaves na recepção (BuildingLink) | [INT] |

---

## 13. Áreas comuns e vida em condomínio

| ID | Ideia | Origem |
|---|---|---|
| AC-01 | Reserva de áreas comuns com agenda em tempo real (MeuVizy, SindIA) | [A] [BR] |
| AC-02 | Assembleias digitais e votação online (uCondo, iSindi, Aptner) | [A] [BR] [INT] |
| AC-03 | Enquetes e pesquisas com moradores | [BR] [INT] |
| AC-04 | Marketplace de serviços para o morador: internet, energia, serviços residenciais (Gruvi, Aptner) | [BR] [INT] |
| AC-05 | Classificados entre moradores (SindIA) | [BR] |

---

## 14. Transparência, indicadores e relatórios

| ID | Ideia | Origem |
|---|---|---|
| TR-01 | Indicadores: tempo até triagem, retornos vencidos, pendências por responsável, tempo de solução por categoria, reabertura, reincidência, decisões aguardando síndico. Cada indicador tem fuso, período e base de cálculo documentados | [A] |
| TR-02 | **Relatório mensal do atendimento para a assembleia**: pedidos, retornos no prazo, concluídos e reabertos (Property Meld, Mygate); a parte financeira está na seção 22 | [A] [INT] |
| TR-03 | % de retornos cumpridos no prazo como métrica principal | [INT] |
| TR-04 | Velocidade de reparo e satisfação média como indicadores (Property Meld) | [INT] |
| TR-05 | Relatório por categoria, bloco/torre e tempo médio de fechamento (Mygate) | [INT] |
| TR-06 | **Índice público anônimo de atendimento condominial no DF**, publicado como conteúdo (benchmarks Property Meld) | [INT] |
| TR-07 | Distinguir "sem dados" de zero | [A] |
| TR-08 | Exportação respeitando permissões | [A] |
| TR-09 | Health score do condomínio (MeuSíndico.IA) | [BR] |

---

## 15. Continuidade e troca de síndico

| ID | Ideia | Origem |
|---|---|---|
| CT-01 | Troca de síndico: validar substituição, revogar acessos antigos, preservar autoria. Encerra as sessões abertas de quem saiu. A troca é comprovada com documentação conferida, sem exigir ata em todo caso; nunca transferir acesso só porque alguém pediu; o novo síndico ganha conta própria | [A] |
| CT-02 | **Dossiê de passagem de bastão**: pendências, prestadores, contratos, documentos e histórico entregues ao novo síndico | [INT] |
| CT-03 | Memória permanente do prédio que não depende de quem é o síndico (golden thread, Reino Unido) | [INT] |
| CT-04 | Exportar todo o histórico do condomínio se ele sair da plataforma | [A] |

---

## 16. Painel interno TRÍADE (Carolina e equipe)

| ID | Ideia | Origem |
|---|---|---|
| PI-01 | Carteira de clientes com estágio: em implantação, ativo, situações a tratar | [A] |
| PI-02 | Ficha do cliente: contatos, número institucional, contrato, recursos contratados e liberados | [A] |
| PI-03 | Recurso só disponível se **contratado E liberado**; liberação registrada com autor, data e referência. A liberação registra também o motivo; teste ou exceção temporária só com regra explícita, nunca em silêncio | [A] |
| PI-04 | Implantação com roteiro de 8 etapas: ficha → dados → documentos → configuração → apresentação → moradores → pendências → entrega. Começa levantando como o condomínio já se organiza (atas, regras, contratos, responsáveis) e configura a partir disso, sem impor fluxo novo; a entrega ao cliente é um ato explícito, sem notas internas. Cada etapa tem responsável, substituto e situação (preparada, pendente, realizada ou não aplicável com motivo); só fica realizada o que foi feito de fato; inclui um pedido de teste com o síndico, e a entrega acontece quando ele consegue fazer o fluxo sozinho; sem migrar todo o histórico; o roteiro tem versão | [A] |
| PI-05 | Pendências de implantação com responsável e próximo retorno | [A] |
| PI-06 | Notas internas nunca visíveis ao cliente. O cliente também não vê a carteira, os rascunhos da equipe nem os pagamentos internos | [A] |
| PI-07 | Pagamentos dos clientes à TRÍADE: obrigação por competência, recebimentos, conferência, ajustes, parcial; valor desconhecido não é zero. Confirmado só após conferência de pessoa autorizada; implantação registrada pela referência do serviço; recebimento não identificado fica pendente; confirmação duplicada é bloqueada; correção por ajuste com motivo; sem cobrança ou contato automático e sem guardar dados bancários | [A] |
| PI-08 | Atraso de pagamento não bloqueia o cliente automaticamente | [A] |
| PI-09 | Suporte de acesso: pedido → verificar identidade e vínculo → redefinição segura → registro. O funcionário nunca vê nem escolhe a senha; a redefinição vai só para o canal já verificado e restabelece o mesmo acesso, nunca transfere; casos duvidosos vão para a Carolina | [A] |
| PI-10 | Funções internas: administração, implantação, financeiro, suporte; cada uma só com clientes atribuídos. Cada função tem a lista do que não faz por padrão (implantação não confirma pagamento nem muda contrato; financeiro não vê conversas de moradores); uma pessoa pode acumular funções, revistas quando a responsabilidade muda | [A] |
| PI-11 | Acesso excepcional de suporte aos dados do cliente, com motivo e registro. Só para cliente atribuído e com aprovação do síndico | [A] |
| PI-12 | Histórico administrativo de todas as mudanças | [A] |
| PI-13 | Acompanhar a adoção por condomínio (Gruvi) | [BR] |
| PI-14 | Ferramenta interna de rascunho de documentos e atas para o apoio documental | [INT] |
| PI-15 | Visão de capacidade da equipe (quantos condomínios cada um atende). Mostra também atrasos e qualidade do atendimento de cada cliente | [A] |
| PI-16 | Suspender um recurso sem perder o histórico. O histórico continua consultável e exportável; um vínculo existente nunca reativa recurso não liberado | [A] |
| PI-17 | Suporte técnico da plataforma separado do atendimento operacional (do síndico ou da equipe contratada), cada um com responsáveis e cobertura. Suporte técnico não é reparo nem canal de emergência; o morador sabe com clareza quem responde, sem "empurra-empurra" entre sistema e administração (Condomob) | [A] |
| PI-18 | Recuperação administrativa de emergência: suplente designado e códigos de recuperação guardados fora do painel, com uso registrado; cobre a perda do único administrador | [A] |
| PI-19 | Ao liberar um conjunto, prévia do que o síndico daquele condomínio passará a ter | [A] |
| PI-20 | Treinamento da equipe em privacidade e segurança: não expor carteira nem conversas, não compartilhar contas, tratar pedidos de titulares de dados | [A] |

---

## 17. Serviços humanos TRÍADE

| ID | Ideia | Origem |
|---|---|---|
| SH-01 | **Implantação presencial**: demonstração e orientação em reunião ou assembleia combinada. Em Brasília/DF; não é requisito jurídico nem exclusividade | [A] |
| SH-02 | **Orientação de novos moradores** em condomínio já cliente. Explica só as regras fornecidas e aprovadas pelo condomínio, sem inventar nem substituir documentos | [A] |
| SH-03 | **Apoio documental**: criar ou revisar regimento, regras e atas (atas sempre de reuniões reais). O condomínio aprova as regras; não é serviço jurídico, com revisão profissional quando aplicável; nunca exigir documentação para usar o sistema | [A] |
| SH-04 | **Atendimento humano no WhatsApp** contratado pelo condomínio. Com horários, cobertura e substituição definidos no contrato; nunca prometer atendimento humano a quem contratou só a plataforma. A equipe TRÍADE só age no painel do condomínio com o serviço contratado e autorizado; encerrar o serviço revoga esses acessos sem perder histórico nem interromper a plataforma | [A] |
| SH-05 | **Plantão fora do horário**: triagem emergência × pode esperar, orientação e registro (Latchel, Vendoroo) | [INT] |
| SH-06 | Assessoria operacional recorrente: triagem, vistoria, acompanhamento de prestadores. Com escopo, exclusões, capacidade e atividades que exigem presença local definidos; ausência de portaria não obriga contratar a TRÍADE | [A] |
| SH-07 | **Rede de especialistas sob demanda**: contador, advogado, engenheiro ("síndico cooperativo", Matera). Fácil de contatar (lição da reputação da Matera) | [INT] |
| SH-08 | Produção e instalação de etiquetas e plaquinhas QR no prédio. Inclui a manutenção das etiquetas; o serviço físico é separado do recurso do sistema (AT-30, PA-06) | [A] [INT] |
| SH-09 | Pacote de conteúdo de autoajuda adaptado às regras do prédio | [INT] |
| SH-10 | Apoio na transição de síndico | [INT] |
| SH-11 | Sindicatura profissional como serviço distinto (Unique, ABC Síndicos) | [A] [BR] |

---

## 18. Negócio, planos e preço

| ID | Ideia | Origem |
|---|---|---|
| NG-01 | Base completa de atendimento + conjuntos de recursos escolhidos + serviços com escopo separado. Nenhuma parte do atendimento é vendida como extra; módulos opcionais não dependem uns dos outros (pedidos sem financeiro, orçamento sem pagamento). A base traz receber pelo WhatsApp, registro, fila, responsável, prioridade, andamento, próximo retorno, previsão, conclusão, histórico e comunicados e documentos essenciais; conjuntos adicionais seriam agenda, coordenação de manutenção e comunicação ampliada (campanhas, arquivo com versões); libera-se o conjunto inteiro, nunca subfunção avulsa | [A] |
| NG-02 | Cobrança por condomínio fixo (iSindi R$ 24,90) | [A] [BR] |
| NG-03 | Cobrança por faixa de unidades (SindIA R$ 197 até 50 un.; R$ 397 até 150) | [A] [BR] |
| NG-04 | Cobrança por unidade ativa com mínimo (HabitaOne R$ 4,90/un., mín. R$ 149) | [A] [BR] |
| NG-05 | Plano para síndico profissional com vários condomínios (Seu Síndico IA, MeuSíndico.IA). Valor por condomínio extra (Seu Síndico IA R$ 29,99; MeuSíndico.IA R$ 49–79) | [BR] |
| NG-06 | Teste grátis sem cartão (7 a 30 dias) | [BR] |
| NG-07 | Taxa de implantação | [A] [INT] |
| NG-08 | **Venda via construtoras**: prédio entregue com TRÍADE implantada; construtora paga a implantação (Aptner, Coreia) | [INT] |
| NG-09 | Teste assistido com 3–5 síndicos por cerca de 4 semanas. Medindo volume, retornos, reaberturas, esforço humano e opinião dos participantes | [A] |
| NG-10 | Demonstração curta de um pedido do início ao fim como ferramenta de venda | [A] |
| NG-11 | Conteúdo educativo para síndicos (blog, cursos) como aquisição (uCondo) | [A] [BR] |
| NG-12 | Índice público de atendimento (TR-06) como marketing e imprensa | [INT] |
| NG-13 | Planilha de custo por condomínio: mensagens, provedor, hospedagem, horas de implantação | [BR] |
| NG-14 | White label para administradoras (Gruvi, Winker) | [BR] |
| NG-15 | Planejar custo das mensagens: cobrança por mensagem desde 01/10/2026; comunicados podem cair na categoria marketing, ~9× mais cara; faturamento em reais. Nunca prometer mensagens ou uso ilimitado antes de conhecer o custo (contraste com MeuVizy) | [BR] |
| NG-16 | O preço não muda com o número de moradores, usuários ou prestadores cadastrados; limite de equipe por plano não é cobrança por usuário (iSindi, SindIA, HabitaOne) | [BR] |
| NG-17 | Plano anual com desconto (HabitaOne: 2 meses grátis); preço fixo e cancelamento sem fidelidade (Seu Síndico IA, iSindi) | [BR] |
| NG-18 | Nível de suporte conforme o plano: e-mail, chat, gerente dedicado; suporte prioritário para administradoras (HabitaOne, Seu Síndico IA) | [BR] |
| NG-19 | Modelo misto: mensalidade fixa + valor por unidade (Fixflo £0,40/unidade + £50/mês); plantão cobrado por porta (Vendoroo) | [INT] |
| NG-20 | Indicação por morador como canal de aquisição (uCondo) | [BR] |

---

## 19. Empresa e marca

| ID | Ideia | Origem |
|---|---|---|
| EM-01 | Nome, razão social, CNPJ, endereço | [A] |
| EM-02 | Logo, paleta e aplicações da marca | [A] |
| EM-03 | Canais: Instagram, Facebook, WhatsApp comercial e de suporte da TRÍADE | [A] |
| EM-04 | Site institucional: início, como funciona, serviços e conjuntos, contato | [A] |
| EM-05 | Mensagem: "Organize os pedidos do seu prédio: saiba quem vai agir, quando dar retorno e como cada problema foi concluído" | [A] |
| EM-06 | Termos de uso e política de privacidade da plataforma, e contrato separado para serviços humanos, com responsabilidades, dados e limites, revisados por profissional. Termo de tratamento de dados: TRÍADE operadora dos dados do condomínio e controladora dos dados dos próprios clientes | [A] |
| EM-07 | Oferta honesta: dizer o que já existe, o que é planejado e o que é serviço humano; não afirmar exclusividade de mercado nem vender pedido por WhatsApp como novidade exclusiva | [A] [BR] |

---

## 20. Princípios técnicos e de qualidade

| ID | Ideia | Origem |
|---|---|---|
| PT-01 | Isolamento total entre condomínios, verificado no servidor em toda leitura, escrita, busca, anexo, fila e notificação. O condomínio vem da sessão, nunca do que o navegador envia; testes negativos de acesso cruzado. No WhatsApp, o condomínio vem do número que recebeu a mensagem e do vínculo do contato, nunca do texto do pedido | [A] |
| PT-02 | Permissão = pessoa + função + condomínio + ação; negar por padrão (OWASP). Cada perfil vê o mínimo: morador os próprios pedidos, prestador as tarefas dele, síndico o próprio condomínio, equipe TRÍADE só os clientes autorizados | [A] |
| PT-03 | Histórico e auditoria: nada é apagado em silêncio | [A] |
| PT-04 | Banco relacional com transações; alteração e intenção de envio salvas juntas (outbox) e um worker envia | [A] |
| PT-05 | Aplicação modular única (monólito modular) antes de microsserviços; candidatos: TypeScript, Node, PostgreSQL. Camadas separadas (interface, API, domínio, adaptadores); configuração por ambiente e segredos fora do código | [A] |
| PT-06 | Row Level Security no banco como defesa extra | [A] [BR] |
| PT-07 | Arquivos privados com validação de tipo e tamanho; links temporários. Conteúdo inspecionado antes de publicar; arquivo não verificado fica indisponível; o nome dado pelo usuário não define onde o arquivo é guardado | [A] |
| PT-08 | Login com e-mail verificado, recuperação por token de uso único, MFA para a equipe, sessões revogáveis. Resposta neutra na recuperação (não revela se a conta existe); senha e token nunca aparecem no histórico. Serviço de identidade mantido, nunca autenticação feita em casa; limite de tentativas; token vencido ou usado não funciona e novo pedido invalida os anteriores; após redefinir, sessões antigas revogadas; troca do e-mail de recuperação avisa o endereço anterior; senha nunca guardada em texto puro | [A] |
| PT-09 | Valores monetários exatos (nunca ponto flutuante); moeda explícita | [A] |
| PT-10 | Acessibilidade WCAG 2.2 AA, uso no celular, estados vazio/erro/carregando | [A] |
| PT-11 | LGPD: cadastro mínimo, finalidade por campo, retenção, exclusão; TRÍADE provavelmente operadora dos dados do condomínio. Inclui fotos e áudios, com links que expiram e preservação legal quando exigida. Inventário por tipo de dado (finalidade, quem opera, retenção, correção, exclusão); não usar consentimento como única base legal; não copiar conversas inteiras sem necessidade | [A] [BR] |
| PT-12 | Cópias de segurança com restauração testada; monitoramento e alertas. Cópias cifradas e restritas, restauração testada em ambiente isolado; alertas de fila e de falha de envio com responsável de resposta. Não prometer disponibilidade antes de definir o objetivo de recuperação | [A] |
| PT-13 | Logs sem senhas, tokens nem conteúdo pessoal desnecessário | [A] |
| PT-14 | Ambientes separados; dados fictícios em desenvolvimento | [A] |
| PT-15 | API pública para integrações (HabitaOne, casavi) | [BR] [INT] |
| PT-16 | Servidores no Brasil | [BR] [INT] |
| PT-17 | Contratos de API com validação de esquema, paginação, erros padronizados e versão | [A] |
| PT-18 | Testes automáticos de domínio, concorrência, isolamento, mídia inválida e queda de provedor, rodando em integração contínua; publicação com reversão testada | [A] |

---

## 21. Ferramentas internas de construção (já existentes no arquivo)

| ID | Ideia | Origem |
|---|---|---|
| FI-01 | Painel de execução de tarefas com dependências, sessões de trabalho, evidências e importação/exportação (`arquivo/outputs/triade-condo/construcao/`) | [A] |
| FI-02 | Mapa da empresa clicável (`arquivo/mapa-da-empresa.html`) | [A] |
| FI-03 | Protótipo navegável dos painéis Carolina e síndico, com prévia do WhatsApp (`arquivo/estruturação do sistema/prototipo-paineis.html`) | [A] |

---

## 22. Transparência do dinheiro e retorno (lúdico, sem controlar o síndico)

Detalhes, pesquisa e regras de tom em [`transparencia-do-dinheiro.md`](transparencia-do-dinheiro.md). Princípio: o síndico é o autor e o recurso é a vitrine do trabalho dele, nunca fiscalização.

| ID | Ideia | Origem |
|---|---|---|
| DR-01 | **Recibo do condômino.** Todo mês, o morador recebe no WhatsApp um cartão "Sua taxa de R$ 650 de outubro virou: R$ 230 limpeza e portaria · R$ 120 elevador · R$ 95 água e luz das áreas comuns · R$ 80 fundo de reserva…". Os valores são calculados pela **fração** da unidade. *Por que é lúdico:* Troca "boleto" por "o que você comprou". *Inspiração:* Recibo do contribuinte (EUA, 2011). | [INT] |
| DR-02 | **Seu dinheiro em coisas concretas.** Traduzir valores em equivalências do dia a dia, por exemplo "sua parte da manutenção do elevador = 30 dias de elevador funcionando" ou "sua parte da pintura = 2 m² da fachada nova". *Por que é lúdico:* Número abstrato vira imagem. *Inspiração:* Recibo do contribuinte e charity: water. | [INT] |
| DR-03 | **Antes e depois.** Toda obra ou reparo relevante termina com par de fotos antes/depois, quanto custou e **sua parte**. Vai junto da conclusão do atendimento (AT-13). *Por que é lúdico:* Prova visível, compartilhável. *Inspiração:* Boston 311 (+60% de engajamento com fotos), FixMyStreet. | [INT] |
| DR-04 | **Mural de conquistas do prédio.** Linha do tempo pública aos moradores com obras feitas, economias, problemas resolvidos e marcos. Assinada pelo síndico. *Por que é lúdico:* O prédio tem uma "história de evolução"; o síndico tem reconhecimento. *Inspiração:* *labor illusion*, vitrine. | [INT] |
| DR-05 | **Retrospectiva anual "Seu prédio em 2026".** Sequência de cartões no WhatsApp, no fim do ano ou antes da assembleia: "142 pedidos resolvidos · categoria campeã: iluminação 💡 · 3 obras · R$ 18 mil economizados · fundo de reserva subiu de 40% para 62% · tempo médio de retorno: 1 dia". *Por que é lúdico:* Compartilhável e divertido; vira o "abre-alas" da prestação de contas anual. *Inspiração:* Spotify Wrapped. | [INT] |
| DR-06 | **Termômetro de metas coletivas.** Barra de progresso para cada objetivo, como "Pintura da fachada: 68% juntado", com comemoração a 25%, 50%, 75% e 100%. *Por que é lúdico:* Progresso visível motiva e reduz a resistência a taxas extras. *Inspiração:* Gradiente de meta (Kivetz), vaquinhas. | [INT] |
| DR-07 | **Bateria do prédio (saúde do fundo de reserva).** Ícone de bateria 🔋 mostrando quanto o fundo de reserva cobre do que o prédio deveria ter guardado. Se houver dados, por componente: elevador, telhado, bombas. *Por que é lúdico:* Metáfora que todo mundo entende. *Inspiração:* *percent funded* (EUA). | [INT] |
| DR-08 | **O dinheiro que voltou (economias geradas).** Placar de economias com renegociação de contrato, cotação mais barata e redução de consumo, por exemplo "Este ano o prédio economizou R$ 18.400 — R$ 460 por apartamento". *Por que é lúdico:* É literalmente o **retorno** que o morador sente falta. *Inspiração:* Relatórios de impacto. | [INT] |
| DR-09 | **O prejuízo que foi evitado.** Na manutenção preventiva, explicar "este reparo de R$ 2 mil evitou um problema que costuma custar várias vezes mais". Sempre como estimativa ilustrativa, com fonte, nunca como promessa. *Por que é lúdico:* Torna visível o valor do que **não** aconteceu. *Inspiração:* Lei dos cinco (de Sitter). | [INT] |
| DR-10 | **Desafio de economia das áreas comuns.** Meta mensal de água e luz comuns comparada **com o próprio prédio** no ano anterior, com 😀/😐 e dicas. Atingindo a meta, a economia pode ir para DR-11. *Por que é lúdico:* Competição contra si mesmo, conquista coletiva. *Inspiração:* Opower. | [INT] |
| DR-11 | **Orçamento participativo do prédio.** Uma fatia pequena (por exemplo, a economia do DR-08 ou uma verba de melhorias) é decidida pelos moradores: propostas pelo WhatsApp → o síndico confere viabilidade e custo → enquete → resultado e obra com antes e depois. *Por que é lúdico:* O morador vira coautor. A decisão continua dentro das regras do condomínio e da assembleia. *Inspiração:* Porto Alegre, Paris, Toronto. | [INT] |
| DR-12 | **Simulador do orçamento.** Antes da assembleia, link para um mini-jogo em que o morador monta o orçamento do ano: "quer mais limpeza? de onde tira?". O resultado agregado ajuda o síndico a entender as prioridades. *Por que é lúdico:* Jogo educativo que gera **empatia com o síndico** ("não é fácil fechar a conta"). *Inspiração:* Balancing Act, BudgetHero. | [INT] |
| DR-13 | **Extrato aberto do condomínio.** Lista de entradas e saídas por categoria, com comprovante e "para quê", acessível ao morador verificado (resumo no WhatsApp ou link seguro e temporário). Dados pessoais escondidos. *Por que é lúdico:* Menos lúdico e mais confiável. É a base de tudo, o "caixa de vidro". *Inspiração:* Open Collective, extranet francês (ALUR). | [INT] |
| DR-14 | **Pergunte ao caixa.** O morador pergunta no WhatsApp "quanto gastamos com elevador este ano?" e recebe a resposta a partir do extrato aprovado. Se for dúvida de decisão, vira pedido na fila do síndico com próximo retorno. *Por que é lúdico:* Autoatendimento; tira a cobrança do grupo. *Inspiração:* Ideias IA-01/IA-02. | [INT] |
| DR-15 | **Por que fizemos.** Cada despesa relevante tem uma frase "por quê" e, se houve, "comparamos 3 orçamentos; escolhemos o B porque incluía garantia". Liga com orçamentos (OC-01). *Por que é lúdico:* Conta a história, mostra o esforço. *Inspiração:* *labor illusion*. | [INT] |
| DR-16 | **Sua parte.** Todo valor coletivo vem acompanhado de "sua parte", como "a impermeabilização custou R$ 40 mil; sua parte: R$ 1.000". *Por que é lúdico:* Personaliza, gera pertencimento. *Inspiração:* charity: water ("seu poço"). | [INT] |
| DR-17 | **Calendário do dinheiro.** "próximos gastos grandes previstos": seguro anual em março, revisão do elevador em junho, sem surpresas. Ligado à previsão orçamentária (FC-06). *Por que é lúdico:* Tira o susto da taxa extra. *Inspiração:* Previsibilidade. | [INT] |
| DR-18 | **O que esta obra protege.** Explicar o patrimônio coletivo protegido, por exemplo "a impermeabilização protege a estrutura e as unidades do último andar". Sem prometer valorização do imóvel. *Por que é lúdico:* Liga gasto a cuidado com o que é de todos. *Inspiração:* Relatórios de patrimônio. | [INT] |
| DR-19 | **Obrigado, síndico.** Reação 👏 nos cartões de conquista; o síndico recebe um resumo mensal: "23 moradores agradeceram; 3 obras concluídas; seu prédio está com o fundo em 62%". *Por que é lúdico:* Reconhecimento + mostra **ao síndico** o impacto do trabalho, que é o que reduz o desgaste. *Inspiração:* Pesquisa com voluntários (senso de eficácia). | [INT] |
| DR-20 | **Prestação de contas pronta para a assembleia.** O relatório anual sai praticamente pronto, a partir de tudo acima, para a assembleia e o conselho fiscal. *Por que é lúdico:* O síndico ganha tempo; a obrigação legal vira algo de que ele se orgulha de mostrar. *Inspiração:* Código Civil, arts. 1.348 e 1.350; extranet francês. | [INT] |
| DR-21 | **Selo de prédio transparente (opcional, do síndico).** O síndico que publica o resumo mensal por N meses ganha um selo para exibir aos moradores (e, com autorização, no índice público TR-06). *Por que é lúdico:* Conquista **do síndico**, nunca imposição. Ele escolhe participar. *Inspiração:* Selos de confiança. | [INT] |
| DR-22 | **Relatórios financeiros para os moradores.** Balancete e relatórios do mês acessíveis aos moradores; são a base numérica dos cartões lúdicos desta seção. *Por que é lúdico:* Sozinho não é; vira lúdico quando alimenta o recibo do condômino, a retrospectiva e o placar de economias. *Inspiração:* iSindi e sistemas de autogestão. | [BR] |

---

## Contagem

| Seção | Ideias |
|---|---|
| 1. Visão e pessoas | 17 |
| 2. Canal WhatsApp | 21 |
| 3. Atendimento | 33 |
| 4. Inteligência artificial | 20 |
| 5. Comunicados e documentos | 11 |
| 6. Configuração e ficha | 12 |
| 7. Moradores e unidades | 8 |
| 8. Manutenção e prédio | 17 |
| 9. Agenda | 8 |
| 10. Orçamentos e compras | 9 |
| 11. Financeiro do condomínio | 11 |
| 12. Portaria, acesso, encomendas | 11 |
| 13. Áreas comuns e vida em condomínio | 5 |
| 14. Transparência e indicadores | 9 |
| 15. Continuidade e troca de síndico | 4 |
| 16. Painel interno TRÍADE | 20 |
| 17. Serviços humanos | 11 |
| 18. Negócio, planos e preço | 20 |
| 19. Empresa e marca | 7 |
| 20. Princípios técnicos | 18 |
| 21. Ferramentas internas | 3 |
| 22. Transparência do dinheiro | 22 |
| **Total** | **297** |

---

## Revisão de classificação (16/10/2026)

Ideias que mudaram de seção ou de código. Os códigos antigos não existem mais.

| Antes | Agora | Motivo |
|---|---|---|
| W-17 | NG-15 | É planejamento de custo do negócio |
| W-19 | IA-17 | É recurso de IA (leitura e resumo do grupo) |
| W-20 | IA-18 | É recurso de IA (resposta automática no grupo) |
| W-21 | MU-08 | Trata de quem pode falar pela unidade |
| AT-27 | IA-19 | É recurso de IA |
| IA-14 | FC-09 | É cobrança, do domínio financeiro |
| CF-12 | TR-09 | É indicador |
| OC-08 | FC-10 | É aprovação de despesa, do domínio financeiro |
| FC-06 | DR-22 | É transparência do dinheiro para o morador |
| CT-05 | PI-16 | É gestão de contratação e liberação da equipe TRÍADE |
| — | AT-30 | **Nova:** QR por local como recurso do sistema; antes só existia o serviço de colar as etiquetas |

Textos ajustados: MU-05 passou a descrever o recurso no WhatsApp (a orientação humana é SH-02, que já existia); TR-02 virou "relatório mensal do atendimento" para não se confundir com a prestação de contas financeira da seção 22.

Renumeração para manter a sequência sem buracos: W-18→W-17, W-22→W-18, W-23→W-19, W-24→W-20, AT-28→AT-27, AT-29→AT-28, AT-30→AT-29, IA-15→IA-14, IA-16→IA-15, IA-17→IA-16, FC-07→FC-06, FC-08→FC-07, FC-09→FC-08.

---

## Comparação com o catálogo antigo (16/10/2026)

Os 109 itens do catálogo do plano antigo (`arquivo/outputs/triade-condo/construcao/catalogo.json`) foram comparados com este arquivo. Itens que eram só gestão do projeto (documentos, decisões pendentes, piloto, auditoria) não viram ideia; as regras de produto que estavam neles foram trazidas para cá.

| Ideia | O que veio do catálogo | Item de origem |
|---|---|---|
| V-04, V-05 | Não presumir equipe; portaria remota não implica manutenção nem integração | PROD-03, DEC-06 |
| V-08 | Sistema funciona sem operador TRÍADE | AUTH-01 |
| W-01 | Implantação ajuda com o número institucional (redação revista depois: é proposta, não condição de adesão) | WA-01 |
| W-06 | Não prometer transcrição inexistente | WA-05 |
| W-11 | Decisões no painel; sem aviso de cada alteração técnica | WA-04 |
| W-15 | Autenticidade dos eventos; eventos fora de ordem | WA-02, AUD-03 |
| W-18 | Responsável pelo incidente e conciliação | INC-01, SERV-07 |
| AT-06 | Mudança do próximo retorno fica no histórico com motivo | TIC-04, SERV-04 |
| AT-11 | Pendência com responsável e motivo | TIC-03 |
| AT-13 | Evidência do síndico ou executor autorizado | EVI-01 |
| AT-14 | Revisão sem exigir equipe local, segunda pessoa ou portaria | END-01 |
| AT-15 | Reaberto ganha responsável e próximo retorno | END-02 |
| AT-18 | Reincidência é sinal, não causa; protocolos preservados | TIC-06 |
| AT-22 | Responsáveis de emergência; não prometer socorro | SERV-03 |
| AT-23 | Autoria e justificativa; aprovação não contrata nem paga | SYN-01, SYN-02 |
| CD-04 | Links que expiram e são revogáveis; limite após download | AUD-04 |
| CF-03 | Cargo não concede permissão automaticamente | DEC-01, MVP-08 |
| CF-05 | Pedidos de responsável desativado | AUD-05 |
| MP-01 | Coordenar não é executar manutenção | PROD-02 |
| MP-05 | Partir dos contratos existentes; sem prestador fixo presumido | SERV-06 |
| MP-07 | Vistoria com responsável, acesso, impedimentos e evidências | VIS-01, SERV-05 |
| OC-01 | TRÍADE não escolhe fornecedor nem compra | PROD-02, SYN-01 |
| TR-01 | Fuso, período e base de cálculo dos indicadores | MET-01 |
| CT-01 | Encerrar sessões de quem saiu | AUD-06 |
| PI-04 | Partir da organização existente; entrega explícita sem notas internas | DEC-06, MVP-11 |
| **PI-17** | **Nova:** suporte técnico separado do atendimento operacional | INC-01, PIL-04 |
| SH-01, SH-03 | Limites da implantação e do apoio documental | PROD-02, PIL-03 |
| SH-04, SH-06 | Cobertura definida; não prometer humano a quem só tem a plataforma | SERV-01, SERV-02, ADD-01 a ADD-05 |
| NG-01 | Nada do atendimento vendido como extra; módulos independentes | PROD-02, PROD-05 |
| NG-09 | O que medir no teste assistido | PIL-06 |
| **EM-06** | **Nova:** termos, privacidade e contrato dos serviços humanos | PIL-01 |
| PT-01 | Condomínio vem da sessão; testes negativos | TEN-01, TEN-02 |
| PT-05 | Camadas separadas; segredos fora do código | TEC-01 |
| PT-08 | Recuperação com resposta neutra; nada secreto no histórico | MVP-13, AUD-06 |
| PT-11 | Fotos e áudios na política de retenção | DEC-04, EVI-02 |
| PT-12 | Cópias cifradas; alertas com responsável | INF-04, INF-05 |
| **PT-17** | **Nova:** contratos de API | API-01 |
| **PT-18** | **Nova:** testes automáticos e integração contínua | QA-01 a QA-05, INF-01, INF-03 |

---

## Conferência com os demais documentos do arquivo (16/10/2026)

Foram conferidos, só para checar ideias (sem telas, fases, MVP nem decisões pendentes): `estruturação do sistema/` (visão, especificação, manual de implantação, painéis, proposta de decisões, próximas etapas, relatório de revisão, planejamento dos painéis), `outputs/triade-condo/docs/` (produto, arquitetura, plano de execução, revisão de modelos, síntese comercial, pesquisa pública), `outputs/triade-condo/pesquisa/` (síntese de cenários, cotações, comparativo), `work/analise-planos`, `mapa-da-empresa.html`, os LEIA-ME de entregas e `estudo-pre-desenvolvimento/`.

**Correção:** W-01 dizia que o número próprio era pré-requisito de adesão. Os documentos mais recentes dizem que isso ainda é proposta; o texto foi corrigido.

**22 ideias novas:** V-17 (o que a TRÍADE não faz), W-21 (janela de 24h e modelos aprovados), AT-31 (cancelamento), AT-32 (pedido privado), AT-33 (pedido fora do escopo vira encaminhamento), IA-20 (IA completa a descrição), CF-12 (configuração proporcional), MP-17 (contratos com prestadores), AG-08 (agenda independente do atendimento), OC-08 (compra por itens), OC-09 (sugestão de fornecedores), FC-11 (folha de pagamento), PA-11 (controle de chaves), PI-18 (recuperação administrativa de emergência), PI-19 (prévia ao liberar conjunto), PI-20 (treinamento da equipe em privacidade), NG-16 a NG-20 (preço sem cobrança por usuário, plano anual, suporte por plano, modelo misto, indicação), EM-07 (oferta honesta).

**Regras acrescentadas em ideias existentes:** V-06; W-03, W-08, W-12, W-14, W-19; AT-02, AT-03, AT-06, AT-07, AT-10, AT-13, AT-14, AT-15, AT-23, AT-24; IA-08, IA-15; CD-02, CD-04; CF-03, CF-05, CF-07, CF-09, CF-10; MU-02; MP-02, MP-04, MP-05; AG-05, AG-06, AG-07; OC-01, OC-03, OC-04, OC-07; PA-01, PA-06, PA-08, PA-09; CT-01; PI-03, PI-04, PI-06, PI-07, PI-09, PI-10, PI-11, PI-15, PI-16, PI-17; SH-02, SH-04, SH-07, SH-08; NG-01, NG-05, NG-15; EM-06; PT-01, PT-02, PT-07, PT-08, PT-11, PT-12.

Ficaram de fora valores que eram só propostas de decisão (ex.: tempo de expiração do token, número de tentativas, tamanho máximo de arquivo).

