# TRÍADE Condo — todas as ideias

Arquivo único de partida para construir o sistema. Junta, sem filtro de MVP ou de decisões anteriores:

| Marca | Origem | Onde está o material completo |
|---|---|---|
| **[A]** | Documentos do projeto (03–15/10/2026) | `arquivo/` |
| **[BR]** | Pesquisa de mercado brasileiro | `arquivo/estudo-pre-desenvolvimento/estudo-de-mercado-2026-10-15.md` e `arquivo/outputs/triade-condo/pesquisa/` |
| **[INT]** | Pesquisa de referências internacionais | `arquivo/estudo-pre-desenvolvimento/referencias-internacionais-2026-10-15.md` |
| **[C]** | Pedido da Carolina durante a construção | Seção do dia, no fim deste arquivo |

Quando uma ideia aparece em mais de uma origem, as marcas se somam. Entre parênteses vai a referência de onde a ideia foi vista. Nada aqui está decidido nem priorizado: é o cardápio completo.

---

## 1. Visão e pessoas

| ID | Ideia | Origem |
|---|---|---|
| V-01 | Plataforma que organiza o atendimento e a rotina do condomínio: todo pedido tem responsável, próximo retorno, andamento e conclusão explicada | [A] [INT] |
| V-02 | Público inicial: síndico morador de prédio com pouca estrutura, sem administradora; evolução até condomínio grande, com ou sem portaria | [A] [BR] |
| V-03 | Foco geográfico inicial: Brasília/DF | [A] |
| V-04 | Cenário 1: prédio simples sem portaria (porta, elevador, apartamentos; visitas e entregas direto com o morador). Não presumir porteiro, zelador, administradora ou prestador fixo. Encomendas e Portaria só aparecem no prédio sem portaria se o condomínio indicar uma pessoa cadastrada (zelador ou síndico) com a permissão Cuidar da portaria. Essa pessoa vê só o que ela mesma registra | [A] |
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
| W-06 | Transcrição de áudio. Nunca prometer ao morador uma transcrição que ainda não existe. A transcrição aparece só no painel, marcada como automática; quando não existe, aparece só o áudio | [A] |
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
| W-17 | Canal alternativo e conciliação quando o WhatsApp ou o provedor ficar fora do ar. Um responsável definido registra o incidente e a conciliação depois | [A] |
| W-18 | Ligação telefônica ou voz como canal complementar (Latchel, Vendoroo, Condo Control). Também e-mail e SMS como canais complementares (Nextin, iSindi) | [A] [INT] |
| W-19 | Respostas em vários idiomas para moradores estrangeiros (Fixflo: 40+ idiomas) | [INT] |
| W-20 | Respeitar a janela de 24h e os modelos aprovados nas mensagens iniciadas pelo condomínio; a janela técnica não é prazo de atendimento | [A] |
| W-21 | **Aviso fixo contra golpes**: no painel e nas boas-vindas do WhatsApp, lembrar que o condomínio e a TRÍADE nunca pedem senha, código ou pagamento por mensagem, e dizer como conferir um contato suspeito (SeuCondomínio) | [BR] |
| W-22 | **Nina, a assistente virtual**: as mensagens automáticas do WhatsApp são assinadas pela Nina, assistente virtual do condomínio, com o mesmo nome em todos os condomínios. Ela sempre se apresenta como assistente virtual e nunca se passa por pessoa; só assina o que é automático (retorno, conclusão e resposta à revisão continuam assinados por quem atende); não promete entender mais do que entende; e o nome e a foto do WhatsApp continuam sendo do condomínio (Organize Meu Condomínio: assistente "Manu") | [BR] |

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
| IA-17 | Classificar o pedido automaticamente a partir da mensagem (gateway de IA, MeuSíndico.IA) | [BR] |
| IA-18 | IA conversa com o morador para completar a descrição e pedir foto antes de registrar o pedido (Vendoroo) | [INT] |
| IA-19 | **Ajuda de cada tela**: texto curto sobre o que a tela faz e como usar, aberto por um botão na própria tela. O mesmo texto alimenta o assistente que tira dúvidas do síndico e é atualizado na mesma entrega que muda a tela (SeuCondomínio) | [BR] |
| IA-20 | **Motor de IA com freio**: todas as funções de IA passam por um conector que dá para trocar, como o do WhatsApp. Cada chamada fica registrada por condomínio, com função, modelo, tamanho e custo. Cada condomínio tem um limite por mês para cada função, definido pela TRÍADE. Quando o limite acaba, a função para até o mês virar, sem travar o atendimento. A TRÍADE tem uma chave no Console que desliga a IA do condomínio, e só a Administração muda essa chave. O síndico liga ou desliga cada função em Configurações › Ajuda da IA, onde vê o que vai para a IA e o uso do mês, sem valores. Nome e telefone saem do texto antes do envio | [C] |

---

## 5. Comunicados e documentos

| ID | Ideia | Origem |
|---|---|---|
| CD-01 | Comunicado: rascunho → publicado → substituído/arquivado, com autor, data e versão | [A] |
| CD-02 | Público autorizado: todo o condomínio, torre ou bloco, unidade ou contatos escolhidos (uCondo, MeuVizy). Os destinatários são recalculados antes de cada envio; contato revogado não recebe nova versão | [A] [BR] |
| CD-03 | Morador recebe e consulta documentos vigentes (regimento, convenção, regras) pelo WhatsApp, em texto, resumo ou PDF | [A] |
| CD-04 | Arquivos privados com acesso por permissão; nada em pasta pública. Links que expiram e podem ser revogados, enviados só aos destinatários necessários; depois do download a cópia não é controlável. Conteúdo que precisa de controle depois de compartilhado vai como resumo permitido, não como arquivo | [A] |
| CD-05 | Comunicado ligado a um pedido (ex.: aviso de interrupção por manutenção) | [A] |
| CD-06 | Campanhas e comunicação programada | [A] |
| CD-07 | Arquivo administrativo com versões anteriores e revisões | [A] |
| CD-08 | Acompanhar recebimento dos comunicados quando o canal permitir ("enviado" não é "lido") | [A] |
| CD-09 | Avisos com foto | [BR] |
| CD-10 | Carta física ou eletrônica para convocação formal (casavi ePost) | [INT] |
| CD-11 | **Plano de comunicação do condomínio**: o que o morador recebe, quando, e sobre o que é consultado (estratégia de engajamento, Reino Unido) | [INT] |
| CD-12 | **Mural online do prédio**: um link (e um QR para o elevador e o hall) que qualquer morador abre sem app, conta ou senha e mostra os comunicados em uso para todo o condomínio, do mais novo ao mais antigo, com fotos e a versão corrigida no lugar da antiga. O síndico escolhe, em cada comunicado, se ele aparece no mural (assuntos de segurança começam desligados), troca o link quando ele vazar (o antigo para na hora) ou desliga o mural. A página não mostra nomes, telefones nem unidades, não entra em buscadores e abre os arquivos por links que expiram em minutos (CD-04). Comunicados de bloco ou unidade e documentos não aparecem no link do prédio; a lista de documentos que podem ir ao morador aparece só como "pedir por e-mail" (CD-14). Conta quantas vezes o mural foi aberto, sem saber quem abriu | [C] |
| CD-13 | **Comunicados por e-mail**: o contato pode ter um e-mail, confirmado por ele num link antes do primeiro envio, e escolhe receber os comunicados também por e-mail. Ao publicar, o e-mail vai para os mesmos destinatários da CD-02 que têm e-mail confirmado, respeitando o horário sem envio do plano de comunicação (CD-11); a tela mostra antes quantos recebem por e-mail e quantos ficam só no grupo ou no mural. Cada e-mail traz o texto, as fotos e um link pessoal para o comunicado (com os arquivos), que deixa de funcionar quando o vínculo com a unidade termina; traz também "parar de receber" em um clique. Correção só reenvia se o síndico pedir, dizendo o que mudou. Sai pelo Resend em nome do condomínio, com respostas indo para quem o síndico indicar; devoluções e marcações de spam desligam aquele e-mail e aparecem para o síndico. O histórico guarda quantos e-mails saíram, voltaram ou foram recusados. Em convocação, o e-mail é prova de envio, não de recebimento, e só vale como convocação formal se a convenção aceitar (CD-10) | [C] (W-18) |
| CD-14 | **Documento por e-mail quando pedido**: o morador pede pelo mural (CD-12), e depois pelo WhatsApp (CD-03), um documento marcado "pode ir ao morador", e o síndico também pode enviar pela tela do documento. Vai a versão em vigor, por um link que expira em 7 dias e pode ser revogado (CD-04), nunca como anexo solto. Se o e-mail pedido for de um contato com vínculo confirmado, o envio é automático ou passa pela aprovação do síndico, conforme a configuração; se não for, o pedido fica numa fila para o síndico decidir (comprador, imobiliária, advogado). A resposta na tela é sempre neutra ("se o e-mail estiver cadastrado, o documento chega em instantes"), para não revelar quem mora no prédio, e há limite de pedidos por e-mail e por aparelho. Cada envio e cada abertura ficam no histórico do documento | [C] |
| CD-15 | **Mural visto do painel**: o síndico vê, dentro do painel, o mural como o morador vê pelo link (CD-12), ao vivo. A tela confere de novo sozinha a cada 30 segundos e logo depois de pôr ou tirar um aviso, e ver por ali não conta como abertura do mural. Embaixo de cada aviso, só no painel, ficam abrir a ficha e tirar do mural; ao lado, os comunicados publicados que não aparecem, cada um com o motivo (só para um bloco ou unidade, assunto que começa fora, tirado) e "pôr no mural", e as aberturas do link nos últimos 7 dias. Um cartão no Início mostra as três primeiras coisas do mural. O mural, no link e no painel, é um feed: um cartão por aviso com a foto grande, a enquete aberta fixada no alto e "compartilhar"; os classificados (AC-05) ficam numa vitrine com foto, preço e a página do anúncio. Sem curtidas, comentários nem seguidores, porque o mural não tem conta, e sem nomes ou unidades nos avisos | [C] |

---

## 6. Configuração e ficha por condomínio

| ID | Ideia | Origem |
|---|---|---|
| CF-01 | Ficha do condomínio preenchida na implantação e editável depois | [A] |
| CF-02 | Pessoas autorizadas, cada uma com acesso próprio (sem conta compartilhada) | [A] |
| CF-03 | Permissões individuais: acompanhar, responder, atualizar, concluir, publicar, configurar, cadastrar moradores (o que a pessoa autorizada cadastra fica a confirmar pelo síndico). Cargo ou função não concede permissão automaticamente; portaria, administradora ou fornecedor não ganham acesso só por existirem. Aprovar despesas e decisões fica com o síndico e só passa a um delegado se ele configurar; contratar o serviço humano também não concede permissão | [A] |
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
| MU-01 | Cadastro breve: nome, telefone, apartamento; CPF só se necessário ao financeiro. A unidade fica do jeito que o prédio se organiza: torre, bloco, quadra ou prédio (ou sem divisão), com ou sem andar; vale para morador e para proprietário (condômino); quando a unidade tem inquilino, o proprietário do imóvel fica no cadastro, para controle | [A] |
| MU-02 | Verificação do vínculo contato ↔ unidade; contato desconhecido não acessa nada restrito. O síndico confirma contatos e unidades; informar o número do apartamento não dá acesso a nada; o sistema nunca confirma nomes nem a existência de moradores | [A] |
| MU-03 | Número de telefone sozinho não prova identidade; tratar número reciclado ou compartilhado | [A] |
| MU-04 | Pessoa com vínculo em mais de um condomínio | [A] |
| MU-05 | Boas-vindas do novo morador pelo WhatsApp: regras do prédio, como fazer pedidos e confirmação do cadastro (a orientação feita por pessoas é o serviço de orientação de novos moradores, seção 17) | [A] |
| MU-06 | Família, veículos e pets no cadastro (Gruvi) | [BR] |
| MU-07 | Mudança de morador: entrada e saída com revogação do vínculo | [A] |
| MU-08 | Múltiplos contatos autorizados por unidade (titular, cônjuge, inquilino), com preferências e revogação | [A] |
| MU-09 | **Link de cadastro de morador**: o síndico gera um link com validade, para uma unidade fixa ou para a pessoa escolher a dela, e decide quais campos pedir. O que chega vai para uma fila de cadastros pendentes, onde o síndico aprova, corrige antes de aprovar ou recusa com motivo; nada vale antes da aprovação (MU-02) (SeuCondomínio) | [BR] |
| MU-10 | **Vínculo detalhado**: marcações independentes de proprietário, responsável pela unidade e morador (a mesma pessoa pode ter as três), parentesco e período de ocupação (ocupa desde, ocupou até). Em branco, a pessoa sempre ocupou a unidade; com data de entrada, ela deixa de ver o histórico de quem ocupava antes. Permite contar as unidades em que o proprietário não mora (SeuCondomínio) | [BR] |
| MU-11 | **Lista de unidades com resumo**: contadores no topo (unidades, ocupadas, com inquilino, proprietário não mora, cadastros pendentes), etiquetas à venda e à locação, busca por nome, telefone, placa e etiqueta, e um menu por unidade com garagens, histórico, link de cadastro, pendentes e aniversariantes (SeuCondomínio) | [BR] |

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
| AG-09 | **Agenda que reúne datas de outras telas**: feriados, reservas, votações e vencimentos de contratos e documentos aparecem junto dos compromissos. Cada data respeita a permissão da tela de origem, as fontes sensíveis vêm marcadas e o filtro escolhido fica guardado (SeuCondomínio) | [BR] |

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
| OC-10 | Contratos com prestadores ligados às cotações (HabitaOne) | [BR] |

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
| PA-01 | Registro de encomendas com aviso ao morador pelo WhatsApp (MeuVizy, SindIA). Quem registra é uma pessoa cadastrada com conta própria e a permissão Cuidar da portaria; não existe conta do posto nem vizinho de plantão. O registro tem a unidade, de quem veio, os volumes, onde foi guardada e, se quiser, a foto da etiqueta, que fica só no painel e não vai na mensagem. O aviso sai pelo modelo aprovado "Encomenda guardada", assinado pela Nina e com o aviso contra golpes (W-21). O aviso vai ao mesmo tempo a todas as pessoas confirmadas que moram na unidade e têm WhatsApp; o proprietário que não mora lá não recebe. Quem pediu PARAR não recebe. Quando ninguém da unidade pode receber, porque pediu PARAR, não tem contato confirmado ou o número não está no WhatsApp, a encomenda aparece como "Sem aviso". Só a falha de envio aparece como "Aviso falhou". Nos dois casos dá para avisar de novo ou registrar "Avisei por outro meio" (interfone, bilhete ou pessoalmente). Na retirada, fica registrado quem retirou (alguém da unidade ou outra pessoa, pelo nome), com foto opcional, e quem entregou, sem código por mensagem. Depois de alguns dias guardada (7, de saída, configurável), a encomenda vai para o atalho "Guardadas há mais de N dias" e a unidade recebe um lembrete, uma vez só. Registra quem guardou e quem retirou, para evitar entrega à unidade errada | [A] [BR] |
| PA-02 | Lista de convidados enviada à portaria (MeuVizy) | [BR] |
| PA-03 | Pedido de acesso de visitante encaminhado à portaria (SindIA) | [BR] |
| PA-04 | Controle de acesso integrado: reconhecimento facial, QR, biometria, placas (Condomob, Gruvi) | [BR] |
| PA-05 | Repasse entre turnos de portaria com rastreabilidade | [A] |
| PA-06 | **Plaquinha QR de chegada**: visitante informa o apartamento e o sistema avisa os contatos da unidade, sem expor dados nem abrir porta. Resposta pública neutra (não confirma presença nem identidade), limites contra abuso, validação do apartamento, alternativa quando o aviso falhar e nenhuma promessa de atendimento imediato | [A] |
| PA-07 | Avisar a unidade, não só um celular (vários contatos, roteamento simultâneo ou sequencial). Na Portaria 1, todos os contatos da unidade são avisados ao mesmo tempo. O aviso em sequência entra com os visitantes (Portaria 2) | [A] |
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
| AC-06 | Limite de reservas por unidade e por período (ex.: duas por mês na churrasqueira), com tolerância configurável e aviso claro quando o limite foi atingido (SeuCondomínio) | [BR] |
| AC-07 | **Áreas comuns já cadastradas**: os tipos comuns (salão de festas, churrasqueira, quadra, academia) vêm prontos, com regras sugeridas de aprovação, antecedência, horário, capacidade e limite, para o síndico só ajustar e ativar (SeuCondomínio) | [BR] |

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
| TR-10 | **Dossiê do mês**: PDF montado pelo síndico com os relatórios escolhidos, anexos, texto livre e um resumo, guardado como modelo para os meses seguintes. Serve de base para TR-02, DR-20 e CT-02 (SeuCondomínio) | [BR] |
| TR-11 | **Início com "agora" e "mês fechado" separados**: os cartões do que está acontecendo (pedidos abertos, retornos vencendo) ficam separados dos números do mês anterior. Cada cartão abre a lista de onde veio e só aparece para quem tem permissão nela (SeuCondomínio) | [BR] |

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
| PI-04 | Implantação com roteiro de 8 etapas: ficha → dados → documentos → configuração → apresentação → moradores → pendências → entrega. Começa levantando como o condomínio já se organiza (atas, regras, contratos, responsáveis) e configura a partir disso, sem impor fluxo novo; a entrega ao cliente é um ato explícito, sem notas internas. Cada etapa tem responsável, substituto e situação (preparada, pendente, realizada ou não aplicável com motivo); só fica realizada o que foi feito de fato; inclui um pedido de teste com o síndico, e a entrega acontece quando ele consegue fazer o fluxo sozinho; sem migrar todo o histórico; o roteiro tem versão. A configuração (etapa 4) a TRÍADE monta no Console, parte por parte, marcando cada uma como conferida; depois da entrega o síndico ajusta no app o que é do dia a dia, e os ajustes técnicos (fuso, etapas dos pedidos e da manutenção, janelas técnicas) ficam com a TRÍADE, com motivo e aviso ao síndico | [A] |
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
| PI-20 | **Abrir chamado de suporte** pela plataforma: tipo (dúvida, problema ou sugestão), área do sistema, título, descrição e print ou vídeo, com imagem colada direto (Ctrl+V). A IA revisa o texto antes do envio, para que chegue claro e completo. Segue a separação do PI-17 (SeuCondomínio) | [BR] |
| PI-21 | **Tabela de preços no Console**: a TRÍADE guarda e ajusta no Console a tabela por faixa de unidades ativas (até 40, 41 a 100, 101 a 200, 201 a 400; acima de 400 sob consulta), com o preço de fundador (só no mensal, 12 meses, vagas limitadas), a tabela cheia e a implantação de cada faixa, os meses pagos no anual e as parcelas da implantação. Só Administração e Financeiro mudam, sempre com motivo e histórico; valor vazio fica "Valor a definir", nunca zero. Na mesma tela, o simulador "Quanto custaria para o prédio" (com os preços públicos dos concorrentes, cadastrados à mão com fonte e data) e as faixas com a implantação explicada, prontas para copiar na proposta. No plano do cliente, "Usar a tabela" preenche faixa, valor e implantação sem gravar; mudar a tabela nunca mexe em quem já tem plano. O síndico não vê nada disso (PI-06). Substitui a regra de que nenhum preço ficava no sistema | [C] [BR] |

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
| NG-21 | **Tela "Meu plano"** para o síndico: o que está contratado, quais telas cada conjunto traz e o teste grátis de cada conjunto, sem esconder o que não está liberado (NG-01, NG-06) (SeuCondomínio) | [BR] |

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
| EM-08 | Treinamento da equipe em privacidade e segurança: não expor carteira nem conversas, não compartilhar contas, tratar pedidos de titulares de dados | [A] |

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

## 23. Comercial TRÍADE (interessados, funil, propostas e contrato)

| ID | Ideia | Origem |
|---|---|---|
| CM-01 | **Interessados chegam sozinhos do site**: cada pedido de demonstração (EM-04) entra no Console com data, origem, faixa de unidades e a autorização LGPD que a pessoa marcou. O e-mail continua como aviso e não substitui o registro. O mesmo WhatsApp junta no mesmo interessado, sem duplicar. A junção usa o WhatsApp no formato internacional (+55…), o e-mail e o CNPJ; a origem e a campanha do primeiro contato nunca são sobrescritas | [C] |
| CM-02 | **Outras origens à mão**: WhatsApp comercial, Instagram, indicação (NG-20), construtora (NG-08), evento ou contato direto, com quem trouxe. Captura automática do WhatsApp comercial só quando houver a API oficial. Plataformas de cotação (oHub, CoteiBem) também são origem, com meta de resposta em 24 horas | [C] |
| CM-03 | **Funil com etapas fixas**: Novo, Em contato, Demonstração marcada, Demonstração feita, Proposta enviada, Negociação, e o fim em Ganho, Perdido (motivo obrigatório) ou Sem resposta. Vista em lista e em quadro; mudar de etapa fica no histórico. Entre Proposta enviada e Ganho fica a etapa **Aprovação no condomínio** (conselho ou assembleia, com data). Cada etapa tem uma probabilidade, que a equipe corrige com os números reais | [C] |
| CM-04 | **Próximo passo sempre definido**: todo interessado aberto tem responsável, próximo passo e data. A promessa do site ("até o fim do próximo dia útil") é contada no primeiro retorno; atrasados aparecem primeiro e no Início do Console. Meta interna de primeiro retorno em 1 hora útil, contada no painel, sem mudar a promessa do site. Ordem: atrasado, hoje, sem próximo passo, futuro, numa tela "Meu dia" que funciona no celular | [C] |
| CM-05 | **Histórico de conversas** com o interessado: ligação, mensagem, demonstração e nota interna, com autor e data. Nada se apaga; correção fica como nova anotação | [C] |
| CM-06 | **Gerador de propostas pela Tabela de preços**: escolhe faixa e ciclo e a proposta vem da tabela do Console (fundador se houver vaga, cheia, ou sob consulta acima de 400 unidades), com implantação e validade. Desconto só com motivo e aprovação da Administração. O texto segue a oferta honesta (EM-07). Os simuladores da tabela abrem daqui, já com a faixa do interessado; não há simulador separado | [C] |
| CM-07 | **Proposta com versões, link e aceite**: cada mudança cria uma versão e a versão enviada não muda. Vai por link sem conta, que expira e pode ser revogado, e em PDF. O aceite pelo link registra nome, data e versão. Proposta vencida pede refazer com a tabela do dia (como OC-04). O aceite guarda nome, CPF, cargo, data e IP, e o PDF guarda uma impressão digital (hash) que prova que não mudou. A equipe vê quando e quantas vezes a proposta e o contrato foram abertos | [C] |
| CM-08 | **Ganho vira cliente sem redigitar**: depois do contrato assinado (CM-13), um botão cria o cliente na carteira (PI-01) com os dados do interessado, o plano pela tabela da proposta aceita, ocupa a vaga de fundador se for o caso e abre a implantação (PI-04). A passagem leva também as promessas feitas e quem decide; a primeira cobrança (PI-07) sai da assinatura, não do aceite | [C] |
| CM-09 | **Uma pessoa, vários condomínios**: síndico profissional ou administradora (NG-05, NG-14) é um contato com várias oportunidades, cada uma com o seu condomínio, etapa e proposta. Para quem traz vários prédios, contrato-quadro com adesão por prédio e desconto por volume definido na Tabela de preços (PI-21) | [C] |
| CM-10 | **Painel comercial**: quantos em cada etapa, conversão por etapa e por origem, tempo até o primeiro retorno, propostas vencendo, motivos de perda e vagas de fundador restantes, previsão de MRR (valor × probabilidade da etapa), ciclo médio, novo MRR do mês contra a meta mensal (total e por pessoa), atividades por pessoa, taxa de vitória contra cada concorrente e os contadores de parados e sem resposta | [C] |
| CM-11 | **Função Comercial** nas funções internas (PI-10): vê e trabalha interessados, propostas e contratos. Por padrão não muda plano de cliente ativo, não confirma pagamento, não libera conjunto e não vê pedidos nem dados dos condomínios | [C] |
| CM-12 | **Dados dos interessados com LGPD**: usados só para responder e negociar, sem lista de e-mails. Interessado perdido sem conversa por 12 meses é anonimizado; pedido de exclusão é atendido e registrado. Notas internas nunca vão na proposta. Formulário do site com o consentimento que já tem; registro à mão e lote importado com legítimo interesse documentado e origem guardada. Opt-in do WhatsApp guardado (data, canal, texto) e lista de "não contatar". Exportação dos dados comerciais só pela Administração, com registro | [C] |
| CM-13 | **Contrato gerado da proposta aceita**: sai de um modelo revisado por advogado (EM-06), preenchido com as partes (CNPJ do condomínio, síndico e mandato), plano, valores, implantação, ciclo, vigência e aviso de cancelamento, com o termo de tratamento de dados junto. Serviço humano contratado vai em anexo separado. Assinatura digital pelo gov.br (assinador.iti.br), sem API: primeiro o condomínio assina o PDF gerado, depois a TRÍADE assina sobre o arquivo já assinado; o sistema confere sozinho se o PDF tem assinatura e se o conteúdo assinado é o gerado, e a equipe confere no validador do ITI quem assinou e quando, com registro de quem, quando e qual versão; o contrato assinado fica na ficha do cliente (PI-02), com versões, e mudar plano ou valor gera aditivo, nunca edita o assinado. No aceite pede CNPJ, ata da eleição com o fim do mandato e, se a convenção exigir, a ata que aprovou. Prazo indeterminado, cancelamento com 30 dias de aviso e sem multa, reajuste anual por índice e preço de fundador garantido por 12 meses, a confirmar com o advogado. Assinatura pelo gov.br decidida pela Carolina em 25/10/2026, no lugar do serviço por API (Autentique ou ZapSign) | [C] |
| CM-14 | **Negócio parado**: cada etapa tem um limite de dias sem conversa; passou, o cartão fica âmbar e sobe na lista. Só uma conversa registrada zera o contador; marcar data futura não | [C] |
| CM-15 | **Modelos de mensagem por etapa**: botão que abre o WhatsApp comercial com o texto pronto e registra a conversa num clique. Sem envio automático; a API oficial fica para quando o volume pagar o custo por mensagem | [C] |
| CM-16 | **Ficha do prédio no interessado**: unidades, administradora e o app que ela usa, sistema atual e quando acaba a fidelidade dele, data da próxima assembleia ordinária, fim do mandato do síndico, quem decide (quem trouxe, síndico, conselho, assembleia) e o roteiro da visita ao prédio, que alimenta a proposta | [C] |
| CM-17 | **Objeções e concorrentes**: lista fechada de objeções (vai aumentar a taxa, moradores idosos, já temos app da administradora, a assembleia decide) com resposta pronta para cada uma; cada negócio registra os concorrentes na disputa, o preço deles e quem ganhou | [C] |
| CM-18 | **Janelas do condomínio**: aviso 30 a 60 dias antes da assembleia ordinária (para entrar no orçamento), perto do fim do mandato e do fim da fidelidade do sistema atual ("janela de troca"). Perdido volta a ser lembrado na troca de síndico, por evento e não por calendário | [C] |
| CM-19 | **Custo por apartamento**: na proposta e no kit, o valor mensal dividido pelas unidades (R$ por apartamento por mês), com a implantação à parte. Marcado como estimativa, com as premissas guardadas na versão; sem ROI e sem citar o que ainda não existe (EM-07). Campo opcional da taxa média de condomínio do prédio: quando preenchido, mostra também quanto a TRÍADE pesa nessa taxa (ex.: R$ 3,49 por apartamento, cerca de 0,5% de uma taxa de R$ 650); a mensagem principal é "menos de R$ 5 por apartamento por mês" (DC17) | [C] |
| CM-20 | **Kit para o conselho e a assembleia**: sai dos dados do prédio e da proposta: apresentação curta (problema, como funciona pelo WhatsApp, custo por apartamento, piloto, como cancelar), comparativo TRÍADE × sistema atual × concorrente pelos critérios do síndico, proposta em PDF, minuta de texto para a ata e explicação de privacidade para o morador | [C] |
| CM-21 | **Piloto com critério de sucesso**: prazo de 30 a 60 dias e meta combinada antes (por exemplo, pedidos com prazo cumprido), medida pela própria Plataforma; no fim, vira proposta ou perdido com motivo | [C] |
| CM-22 | **Parceiros e indicação**: síndico profissional, administradora, construtora ou cliente que indica (NG-08, NG-20); comissão recorrente por prédio ativo calculada no Console e extrato para o parceiro. O pagamento da comissão fica fora do sistema no começo | [C] |
| CM-23 | **Agendar demonstração por link**: o interessado escolhe um horário livre da equipe, recebe a confirmação e um lembrete; a demonstração entra no funil sozinha | [C] |
| CM-24 | **Importar planilha e juntar duplicados**: lista de prédios ou contatos entra por planilha-modelo; o Console aponta duplicados por CNPJ, endereço, WhatsApp e e-mail e a pessoa decide juntar. O lote guarda origem e base legal (CM-12) | [C] |
| CM-25 | **Etapa só avança com o que ela pede**: por exemplo, faixa de unidades antes da proposta, decisor e data da assembleia antes da Aprovação no condomínio. O que falta aparece na ficha | [C] |
| CM-26 | **Cadência de contato**: sequência de passos com datas por tipo de interessado (por exemplo, dia 0 mensagem, dia 2 ligação, dia 5 mensagem). Gera tarefas no "Meu dia" e para quando a pessoa responde. Não envia nada sozinha; envio automático só com a API oficial do WhatsApp | [C] |
| CM-27 | **Respostas prontas para questionário e cotação**: LGPD, segurança, suporte, prazo de implantação, como cancelar e como os dados voltam na saída. Revisadas pela Administração e usadas na proposta e no kit | [C] |
| CM-28 | **Referências e casos**: síndicos clientes que aceitaram ser referência, com contato autorizado, e casos com números medidos na Plataforma. Só números reais (EM-07) | [C] |
| CM-29 | **Troca de sistema sem dor**: carta-modelo à administradora ou ao sistema anterior pedindo dados e documentos, lista do que falta, planilha-modelo com o mínimo para começar e linha do tempo da troca. Tudo segue para a implantação (PI-04) | [C] |
| CM-30 | **Renovação e reajuste**: aniversário do contrato, índice e aviso ao síndico antes de aplicar, fim do preço de fundador e aditivo gerado (CM-13). Nada muda sem o aviso enviado | [C] |
| CM-31 | **Cancelamento e retenção**: motivo de cancelamento em lista própria (separada do motivo de perda), uma tentativa de retenção registrada, devolução dos dados e sinais de risco: síndico novo eleito, uso caindo (PI-13), troca de sistema na pauta da assembleia | [C] |
| CM-32 | **Expansão**: oportunidade de mais um prédio do mesmo síndico ou administradora, mudança de faixa e reconquista de quem saiu, num funil próprio ligado ao cliente | [C] |
| CM-33 | **Calculadora de custo por apartamento no site** (EM-04): o síndico digita as unidades e vê o valor por apartamento pela Tabela de preços (CM-19, sem ROI); se digitar também a taxa média de condomínio, que é opcional, vê quanto isso pesa na taxa (DC17). Se quiser a proposta, deixa o contato e vira interessado com a faixa preenchida | [C] |

---

## Contagem

| Seção | Ideias |
|---|---|
| 1. Visão e pessoas | 17 |
| 2. Canal WhatsApp | 22 |
| 3. Atendimento | 33 |
| 4. Inteligência artificial | 20 |
| 5. Comunicados e documentos | 15 |
| 6. Configuração e ficha | 12 |
| 7. Moradores e unidades | 11 |
| 8. Manutenção e prédio | 16 |
| 9. Agenda | 9 |
| 10. Orçamentos e compras | 10 |
| 11. Financeiro do condomínio | 11 |
| 12. Portaria, acesso, encomendas | 11 |
| 13. Áreas comuns e vida em condomínio | 7 |
| 14. Transparência e indicadores | 11 |
| 15. Continuidade e troca de síndico | 4 |
| 16. Painel interno TRÍADE | 21 |
| 17. Serviços humanos | 11 |
| 18. Negócio, planos e preço | 21 |
| 19. Empresa e marca | 8 |
| 20. Princípios técnicos | 18 |
| 21. Ferramentas internas | 3 |
| 22. Transparência do dinheiro | 22 |
| 23. Comercial TRÍADE | 33 |
| **Total** | **346** |

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

---

## Segunda revisão de classificação (16/10/2026)

Conferência das seções depois das 22 ideias novas e dos complementos.

| Antes | Agora | Motivo |
|---|---|---|
| W-17 | CD-02 | Avisos por torre ou bloco repetiam o público autorizado dos comunicados; juntados na CD-02 (referência MeuVizy mantida) |
| MP-17 | OC-10 | Contratos com prestadores nascem das cotações; ficam com orçamentos e compras |
| PI-20 | EM-08 | Treinamento da equipe é prática da empresa, não recurso do painel interno |

Renumeração para manter a sequência sem buracos: W-18→W-17 (canal alternativo), W-19→W-18 (ligação, e-mail e SMS), W-20→W-19 (vários idiomas), W-21→W-20 (janela de 24h).

---

## Ideias vistas no SeuCondomínio (17/10/2026)

Fontes: páginas salvas do sistema SeuCondomínio (menu, ajuda de cada tela, painel, agenda, plano) e prints de telas por dentro. Só as ideias vieram para cá; nada do material foi guardado no repositório.

**12 ideias novas:** W-21 (aviso fixo contra golpes), IA-21 (ajuda de cada tela, que também alimenta o assistente), MU-09 (link de cadastro com fila de pendentes), MU-10 (vínculo detalhado com período de ocupação), MU-11 (lista de unidades com resumo), AG-09 (agenda que reúne datas de outras telas), AC-06 (limite de reservas por unidade), AC-07 (áreas comuns já cadastradas), TR-10 (dossiê do mês), TR-11 (início com agora e mês fechado separados), PI-20 (abrir chamado de suporte), NG-21 (tela Meu plano).

**Ficaram de fora:** cobrança da reserva por Pix e etiqueta de inadimplente na lista de unidades (a TRÍADE não lida com o dinheiro do condomínio nesta fase); hospedagem e TV no elevador (muito específicos); exclusão definitiva de visitantes (aqui o histórico fica, PT-03).

---

## Ideias da Carolina sobre comunicados (18/10/2026)

Pedidas pela Carolina depois de Comunicados e documentos (R1) ir ao ar: um mural online que todo morador consegue acompanhar e o envio dos comunicados por e-mail, assim como dos documentos quando pedidos.

**3 ideias novas:** CD-12 (mural online do prédio), CD-13 (comunicados por e-mail) e CD-14 (documento por e-mail quando pedido).

**Como conversam com o que já está decidido:**

- O morador continua sem app, conta, login ou senha (V-07): o mural é só leitura, por link ou QR, como os acessos sem conta da Plataforma (DC1).
- Nada fica em pasta pública (CD-04): o link do prédio mostra só o que é para todo o condomínio e abre arquivos por links curtos; o que é de bloco ou unidade e os documentos vão pelo link pessoal do e-mail ou por envio pedido.
- Quem recebe é sempre a conta da CD-02, refeita a cada envio; contato que sai da unidade perde o link pessoal e deixa de receber.
- O e-mail é canal complementar (W-18) e não substitui o WhatsApp do passo 5. Usa o Resend que já manda os e-mails do sistema (DC12).

**Ficam para decidir no desenho:** se o mural do prédio mostra também os comunicados de cada bloco (um link por bloco) ou só os gerais; se documentos de contatos confirmados saem sem aprovação; para quem vão as respostas dos e-mails; e o plano do Resend, porque o gratuito manda até 100 e-mails por dia e um comunicado num prédio de 200 unidades já passa disso. O desenho com as propostas está em `docs/telas/mural-email.html`.

---

## Ideia da Carolina sobre a assistente virtual (19/10/2026)

Pedida pela Carolina ao revisar os textos do WhatsApp: uma atendente virtual com nome, para a conversa ficar mais humana, como nas referências estudadas (o Organize Meu Condomínio tem a assistente "Manu").

**1 ideia nova:** W-22 (Nina, a assistente virtual).

**Como conversa com o que já está decidido:** ela não muda a regra de que uma pessoa do condomínio decide (AT-15, W-10), por isso só assina o que é automático; não é IA (as funções de IA ficam para a R14, dentro da política da Meta, IA-16); e o aviso contra golpes (W-21) continua em toda confirmação.

---

## Pedido da Carolina sobre o mural no painel (22/10/2026)

Pedido pela Carolina durante a rodada do novo frontend: ver o mural dentro do painel do síndico, para não precisar sair para ver o mural em tempo real. No desenho, ela pediu também que o mural fosse pensado como um feed do Instagram e os classificados como anúncios da OLX ou do Marketplace.

**1 ideia nova:** CD-15 (mural visto do painel).

**Como conversa com o que já está decidido:**
- Mostra o mesmo conteúdo do link do prédio (CD-12): só o que é para todo o condomínio, sem nomes, telefones ou unidades nos avisos.
- A contagem de aberturas da CD-12 continua contando só quem abre o link; o painel tem leitura própria.
- Os classificados continuam com o aviso de que o condomínio não vende nem garante nada (AC-05). Uma foto por anúncio, como hoje; mais fotos ficam para depois, porque pedem mudança no banco.

---

## Pedido da Carolina sobre o preço no Console (24/10/2026)

Pedido pela Carolina ao fechar a precificação (decisões D1 a D7 da pesquisa de preço): ajustar o preço dentro do Console e levar para lá os simuladores da pesquisa, "Quanto custaria para o seu prédio" e "Faixas de unidades com implantação explicada". Antes de fechar os valores, ela pediu uma busca web atual dos preços dos concorrentes.

**1 ideia nova:** PI-21 (tabela de preços no Console).

**Como conversa com o que já está decidido:**
- Troca a regra da R2 (planos e cobrança) de que nenhum preço ficava no sistema: agora a tabela fica no Console, mas o plano de cada cliente continua com o valor dele e só muda à mão (PI-07).
- Um plano por faixa no lançamento (NG-01 fica para depois): "Usar a tabela" marca todos os conjuntos como contratados.
- As 3 parcelas da implantação são só informação; a cobrança da implantação continua única (PI-07).
- O site (EM-04) ainda repete os valores no código dele; ler da tabela fica para depois.

---

## Plano de IA e portaria (24/10/2026)

Aprovado pela Carolina em 24/10/2026, junto com o plano do motor de IA e da portaria (encomendas). Duas ideias saíram, uma entrou e quatro textos foram ajustados.

**1 ideia nova:** IA-20 (motor de IA com freio: conector que dá para trocar, registro de cada chamada por condomínio, limite por mês para cada função, chave da TRÍADE no Console e escolha do síndico em Configurações › Ajuda da IA).

**Textos ajustados:**

- PA-01 descreve o registro das encomendas: quem registra, o que vai no registro, o aviso pelo modelo "Encomenda guardada" a todas as pessoas confirmadas que moram na unidade, os estados "Sem aviso" e "Aviso falhou", a retirada e o lembrete depois de alguns dias.
- PA-07 diz que, na Portaria 1, todos os contatos da unidade são avisados ao mesmo tempo, e que o aviso em sequência entra com os visitantes (Portaria 2).
- V-04 diz que Encomendas e Portaria só aparecem no prédio sem portaria se o condomínio indicar uma pessoa com a permissão Cuidar da portaria, e que essa pessoa vê só o que ela mesma registra.
- W-06 diz que a transcrição aparece só no painel, marcada como automática, e que sem ela aparece só o áudio.

**Ideias que saíram:**

| Código | Ideia | Motivo |
|---|---|---|
| IA-17 | Ler o grupo de WhatsApp do condomínio para alimentar a memória e o resumo diário | A política da Meta proíbe, desde 15/01/2026, IA de uso geral no WhatsApp (IA-16), e o grupo tem mensagens de quem não é cliente nem aceitou o tratamento dos seus dados (decisão D9 do plano de IA e portaria) |
| IA-18 | Responder moradores dentro do grupo de WhatsApp quando mencionado | Mesmo motivo: a resposta no grupo seria IA de uso geral no WhatsApp e alcançaria pessoas que não são clientes (decisão D9) |

Renumeração para manter a sequência sem buracos: IA-19→IA-17 (classificar o pedido), IA-20→IA-18 (IA completa a descrição), IA-21→IA-19 (ajuda de cada tela). As seções datadas acima são histórico e mantêm os códigos da época.

---

## Pedido da Carolina sobre o comercial no Console (24/10/2026)

Pedido pela Carolina: um painel comercial dentro do Console, com CRM, gerador de propostas e simulador se couber, onde chegam os interessados e futuros clientes e onde a equipe faz todo o processo comercial. Depois, pediu também o contrato entre a TRÍADE e o condomínio. Proposta aprovada em 24/10/2026 (decisões A.1 a I.1): https://claude.ai/artifact/TqFgANRs8F6wt4sn7tFsBe.

**13 ideias novas:** CM-01 a CM-13, na seção nova 23.

**Como conversa com o que já está decidido:**
- Fica num grupo próprio "Comercial" no Console; a carteira (PI-01) continua só com quem contratou.
- O site continua mandando o e-mail (EM-04); passa a gravar também no Console, como combinado na pesquisa do site de 22/10/2026.
- Não há simulador novo: a proposta e os simuladores usam a Tabela de preços do Console, para existir um só cálculo de preço.
- O contrato depende do modelo revisado por advogado (EM-06), que fica fora do software.
- Etapas do funil fixas no começo, sem construtor de fluxos (CF-12).

**Segunda e terceira pesquisas (24/10/2026):** a pedido da Carolina, agentes especialistas pesquisaram CRMs para equipe pequena, propostas e contratos no Brasil, venda para condomínio, CRMs internacionais e CRMs de administradoras (https://claude.ai/artifact/MijZyDZ49LCHwuQdVjSmrc e https://claude.ai/artifact/VHokWAw8uoxkpfsxuApN6W). Aprovadas as decisões J.1 a T.1.

**20 ideias novas:** CM-14 a CM-33. **Ajustes:** CM-01, 02, 03, 04, 07, 08, 09, 10, 12 e 13.

**Decisões que entram nas ideias:**
- Etapa "Aprovação no condomínio" no funil (J.1); meta interna de 1 hora útil no primeiro retorno (K.1); custo por apartamento como estimativa, sem ROI (L.1).
- Assinatura começa por serviço barato por API (M.1); prazo indeterminado com 30 dias de aviso, a confirmar com o advogado (N.1).
- Parceiros com comissão calculada no Console e paga fora dele (O.1); consentimento no site e legítimo interesse documentado no registro à mão (P.1).
- Renovação, cancelamento e expansão ficam no Comercial (Q.1); cadência só cria tarefas (R.1); calculadora pública no site (S.1); contrato-quadro com desconto por volume na Tabela de preços (T.1).
- Fica para depois: pontuação automática, rodízio entre vendedores, automações livres, registro automático de e-mail e WhatsApp, IA que resume antes da ligação e demonstração autoguiada.

---

## Pesquisa da Carolina sobre o preço por apartamento (25/10/2026)

A pedido da Carolina, uma busca web sobre quanto cada morador paga de taxa de condomínio (média no Brasil de R$ 516 a R$ 828 por mês; no Distrito Federal, perto de R$ 494, e em Águas Claras de R$ 650 a R$ 670) mostrou que a TRÍADE custa de R$ 2 a R$ 10 por apartamento por mês na tabela cheia, perto de 0,5% a 1,5% da taxa. Página da pesquisa: https://claude.ai/artifact/8J8LcjjrSxuFAezurF71jA. As decisões A a D foram aprovadas pela Carolina em 25/10/2026 (DC17).

**Nenhuma ideia nova.** **Ajustes:** CM-19 e CM-33 ganham o campo opcional da taxa média do prédio, que mostra quanto a TRÍADE pesa nessa taxa, sem ROI (EM-07).
