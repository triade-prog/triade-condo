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
| V-04 | Cenário 1: prédio simples sem portaria (porta, elevador, apartamentos; visitas e entregas direto com o morador) | [A] |
| V-05 | Cenário 2: portaria remota/virtual (no DF, o STF derrubou em maio/2026 a lei que restringia; mais de 800 condomínios já usam) | [A] [BR] |
| V-06 | Cenário 3: portaria presencial com atendente e troca de turnos | [A] |
| V-07 | **Morador**: usa só o WhatsApp do condomínio, sem app, portal, login ou senha | [A] [BR] |
| V-08 | **Síndico**: painel web de gestão e avisos de novidades no próprio WhatsApp | [A] |
| V-09 | **Secretária e delegados do síndico**: acesso próprio, com permissões individuais por condomínio | [A] |
| V-10 | **Carolina e equipe TRÍADE**: painel interno com todos os clientes, implantação, pagamentos e suporte | [A] |
| V-11 | **Prestador ou executor**: recebe escopo e prazo, informa impedimentos e registra execução, sem conta própria | [A] [INT] |
| V-12 | **Visitante ou entregador**: perfil público via QR na entrada (ver seção 12) | [A] |
| V-13 | **Construtora/incorporadora** como ator: defeitos de obra e canal de venda (Aptner, i-Neighbour) | [INT] |
| V-14 | **Conselho e subsíndico** como níveis de escalonamento e de aprovação | [A] [INT] |
| V-15 | Frase de posicionamento: "Nenhum pedido do seu prédio fica sem resposta — e a história do prédio não vai embora com o síndico" | [INT] |
| V-16 | Ser o meio-termo entre o app barato "faça você mesmo" e o síndico profissional caro: síndico morador + plataforma + especialistas TRÍADE (Matera, França) | [INT] |

---

## 2. Canal WhatsApp

| ID | Ideia | Origem |
|---|---|---|
| W-01 | Número institucional próprio de cada condomínio (não usar o WhatsApp pessoal do síndico) | [A] |
| W-02 | Alternativa: número compartilhado da TRÍADE com roteamento seguro por condomínio | [A] |
| W-03 | **Coexistência**: conectar o número que o condomínio já usa no app WhatsApp Business à API oficial, sem perder o app (Meta) | [BR] |
| W-04 | Usar a API oficial do WhatsApp (direto ou via provedor), nunca conexão por QR Code ou WhatsApp Web; confiabilidade como argumento de venda | [A] [BR] |
| W-05 | Morador envia texto, foto, áudio e documento; tudo fica ligado ao pedido certo | [A] |
| W-06 | Transcrição de áudio | [A] |
| W-07 | **WhatsApp Flows**: formulário dentro da conversa para abrir pedido estruturado (unidade, local, categoria, foto) | [BR] |
| W-08 | Confirmação imediata de recebimento, com número de protocolo e "o que acontece agora" (Fixflo) | [A] [INT] |
| W-09 | Morador consulta o andamento do próprio pedido a qualquer momento pelo WhatsApp | [A] [INT] |
| W-10 | Morador pede revisão ou contesta a conclusão pelo WhatsApp | [A] |
| W-11 | Síndico recebe no WhatsApp: novo pedido, nova reclamação, retorno vencido e novidades relevantes, sem precisar manter o painel aberto | [A] |
| W-12 | Mensagem automática fora do horário, configurável por condomínio, sem prometer prazo | [A] |
| W-13 | Estados da mensagem separados do estado do pedido: recebida, envio pendente, aceita, entregue, lida, falhou, resultado desconhecido | [A] |
| W-14 | Fila durável de envio com novas tentativas limitadas; falha fica visível com responsável | [A] |
| W-15 | Eventos repetidos não duplicam pedido nem aviso (deduplicação) | [A] |
| W-16 | Registro de preferências e de pedido para não receber avisos (opt-out) | [A] |
| W-17 | Planejar custo das mensagens: cobrança por mensagem desde 01/10/2026; comunicados podem cair na categoria marketing, ~9× mais cara; faturamento em reais | [BR] |
| W-18 | Avisos segmentados por torre ou bloco (MeuVizy) | [BR] |
| W-19 | Ler e resumir o grupo de WhatsApp do condomínio, com memória de decisões e resumo diário (Seu Síndico IA) | [BR] |
| W-20 | Responder moradores dentro do grupo quando mencionado (Seu Síndico IA) | [BR] |
| W-21 | Múltiplos contatos autorizados por unidade (titular, cônjuge, inquilino), com preferências e revogação | [A] |
| W-22 | Canal alternativo e conciliação quando o WhatsApp ou o provedor ficar fora do ar | [A] |
| W-23 | Ligação telefônica ou voz como canal complementar (Latchel, Vendoroo, Condo Control) | [A] [INT] |
| W-24 | Respostas em vários idiomas para moradores estrangeiros (Fixflo: 40+ idiomas) | [INT] |

---

## 3. Atendimento (o coração do sistema)

| ID | Ideia | Origem |
|---|---|---|
| AT-01 | Registro do pedido: protocolo, condomínio, unidade, contato, local, categoria, descrição, anexos | [A] |
| AT-02 | Fila de pedidos com filtros por situação, responsável, prioridade e categoria | [A] |
| AT-03 | Responsável real por pedido; quem responde pode ser diferente de quem executa | [A] |
| AT-04 | Prioridades com significado explícito | [A] |
| AT-05 | Etapas configuráveis por condomínio e por tipo de pedido, sempre ligadas a aberto, em andamento ou encerrado | [A] |
| AT-06 | **Próximo retorno**: compromisso de atualizar o morador, separado da previsão de solução (padrão "periodic update" de help desks) | [A] [INT] |
| AT-07 | Previsão de solução só quando conhecida; ausência fica explícita, nunca prazo inventado | [A] |
| AT-08 | Alerta de retorno vencido | [A] |
| AT-09 | **Escalonamento automático**: retorno vencido avisa responsável → síndico → substituto ou conselho (Mygate) | [INT] |
| AT-10 | Prazo-padrão de retorno por categoria, com regras de pausa e feriados | [A] [INT] |
| AT-11 | Pendências e impedimentos explícitos: aguardando fornecedor, morador, decisão do síndico, peça, acesso | [A] [BR] |
| AT-12 | Sem executor disponível: pendência real, nunca pessoa inventada | [A] |
| AT-13 | Conclusão com explicação ao morador e evidência quando fizer sentido (foto, referência), sem exigir foto sempre | [A] |
| AT-14 | Revisão da conclusão pelo síndico ou revisor antes de encerrar | [A] |
| AT-15 | Reabertura com motivo, preservando a conclusão anterior | [A] [INT] |
| AT-16 | **Pergunta de satisfação ao concluir** ("Resolveu? 1 a 5"); nota baixa sugere reabertura (Property Meld) | [INT] |
| AT-17 | Histórico completo com autor, data e antes/depois; nada é apagado | [A] [INT] |
| AT-18 | Relacionar pedidos duplicados e reincidências por local/categoria | [A] [BR] |
| AT-19 | **Autoajuda antes do chamado**: orientação curta por tipo de problema e "resolveu?" (Fixflo) | [INT] |
| AT-20 | **Responsabilidade da unidade × condomínio**: avisar quando o problema é do morador, com base nas regras do prédio | [INT] |
| AT-21 | Videochamada com profissional para orientar o morador (Fixflo "Help me Fix") | [INT] |
| AT-22 | Triagem de urgência e orientação de emergência para o canal do condomínio | [A] [INT] |
| AT-23 | Solicitação de decisão ao síndico: alternativas, custo estimado, prazo, justificativa da aprovação ou devolução | [A] |
| AT-24 | Controle de edição simultânea: duas pessoas não sobrescrevem a mesma alteração sem aviso (Zendesk) | [A] |
| AT-25 | Modelos de resposta prontos por condomínio | [A] |
| AT-26 | Avisar todos os envolvidos ao mesmo tempo quando um problema é registrado: síndico, prestador, moradores afetados (Plusvecinos) | [INT] |
| AT-27 | Classificar o pedido automaticamente a partir da mensagem (gateway de IA, MeuSíndico.IA) | [BR] |
| AT-28 | Kanban de pedidos (MeuSíndico.IA) | [BR] |
| AT-29 | Status visíveis ao morador: novo, em análise, aguardando peça, em andamento, concluído (SindIA) | [BR] |
| AT-30 | Roteamento automático por tipo: manutenção → zelador, acesso → portaria, reclamação → síndico (SindIA) | [BR] |

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
| IA-08 | Assistente jurídico para o síndico com base na lei e na convenção, com aviso de que não substitui advogado (Seu Síndico IA) | [BR] |
| IA-09 | Memória do condomínio: decisões, pendências e combinados recuperados por pergunta (Seu Síndico IA) | [BR] |
| IA-10 | Resumo diário para o síndico | [BR] |
| IA-11 | Agentes especializados: triagem, síndico, operação/manutenção, morador (MeuSíndico.IA) | [BR] |
| IA-12 | Extrair tarefas das conversas, com responsável e prioridade (Seu Síndico IA) | [BR] |
| IA-13 | Diagnóstico de problema por foto (Vendoroo) | [INT] |
| IA-14 | Acordos de inadimplência negociados pelo WhatsApp (wCond) | [BR] |
| IA-15 | Relatórios gerados por IA (MeuSíndico.IA) | [BR] |
| IA-16 | Regra de ouro vista lá fora: todo texto de IA é rascunho até uma pessoa aprovar | [INT] |
| IA-17 | Observar a política da Meta: bot de atendimento da própria empresa é permitido; IA de uso geral no WhatsApp não | [BR] |

---

## 5. Comunicados e documentos

| ID | Ideia | Origem |
|---|---|---|
| CD-01 | Comunicado: rascunho → publicado → substituído/arquivado, com autor, data e versão | [A] |
| CD-02 | Público autorizado: todo o condomínio, bloco, unidade ou contatos escolhidos (uCondo) | [A] [BR] |
| CD-03 | Morador recebe e consulta documentos vigentes (regimento, convenção, regras) pelo WhatsApp, em texto, resumo ou PDF | [A] |
| CD-04 | Arquivos privados com acesso por permissão; nada em pasta pública | [A] |
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
| CF-03 | Permissões individuais: acompanhar, responder, atualizar, concluir, publicar, configurar | [A] |
| CF-04 | Vínculo ativo ou revogado; revogado não age mais, mas a autoria antiga fica | [A] |
| CF-05 | Responsáveis pelo atendimento por condomínio | [A] |
| CF-06 | Dias e horários de funcionamento e de atendimento | [A] |
| CF-07 | Modelo de atendimento humano: equipe do condomínio ou TRÍADE contratada | [A] |
| CF-08 | Categorias, prioridades, etapas e modelos de resposta por condomínio | [A] |
| CF-09 | Identificadores estáveis: renomear ou desativar etapa sem quebrar histórico | [A] |
| CF-10 | Feriados, fuso, múltiplos intervalos de atendimento | [A] |
| CF-11 | Recursos ativados ou desativados por condomínio (Gruvi) | [A] [BR] |
| CF-12 | Health score do condomínio (MeuSíndico.IA) | [BR] |

---

## 7. Moradores e unidades

| ID | Ideia | Origem |
|---|---|---|
| MU-01 | Cadastro breve: nome, telefone, apartamento; CPF só se necessário ao financeiro | [A] |
| MU-02 | Verificação do vínculo contato ↔ unidade; contato desconhecido não acessa nada restrito | [A] |
| MU-03 | Número de telefone sozinho não prova identidade; tratar número reciclado ou compartilhado | [A] |
| MU-04 | Pessoa com vínculo em mais de um condomínio | [A] |
| MU-05 | Orientação de novo morador: regras do prédio, uso do WhatsApp, cadastro (serviço TRÍADE) | [A] |
| MU-06 | Família, veículos e pets no cadastro (Gruvi) | [BR] |
| MU-07 | Mudança de morador: entrada e saída com revogação do vínculo | [A] |

---

## 8. Manutenção e prédio

| ID | Ideia | Origem |
|---|---|---|
| MP-01 | Coordenação de manutenção: necessidade, área/equipamento, responsável, executor, prioridade, previsão, próximo retorno | [A] |
| MP-02 | Tarefas de manutenção com providência, executor e resultado | [A] |
| MP-03 | Manutenção preventiva e corretiva; calendário de preventivas | [A] [BR] |
| MP-04 | Vínculo opcional entre manutenção, pedido do morador e agenda | [A] |
| MP-05 | Cadastro de prestadores, mantido quando o síndico muda (Nextin) | [A] [BR] |
| MP-06 | Indicação de prestadores avaliados pelos moradores (MeuVizy) | [BR] |
| MP-07 | Vistorias e checklists quando necessários (sem checklist universal) | [A] [BR] |
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
| AG-05 | Recorrência simples | [A] |
| AG-06 | Lembretes pelo WhatsApp a quem participa | [A] |
| AG-07 | Morador recebe só o que lhe diz respeito (ex.: visita no apartamento dele) | [A] |

---

## 10. Orçamentos e compras

| ID | Ideia | Origem |
|---|---|---|
| OC-01 | Fluxo: necessidade → convite a fornecedores → propostas e anexos → comparação → decisão justificada → aceite → acompanhamento | [A] [BR] |
| OC-02 | Comparar escopo, não só preço: inclusões, exclusões, frete, prazo, validade, garantia | [A] [BR] |
| OC-03 | Link para o fornecedor enviar proposta sem conta, que expira e pode ser revogado (HabitaOne, Cota Todos) | [A] [BR] |
| OC-04 | Versões de proposta preservadas; cancelamento não apaga | [A] [BR] |
| OC-05 | Mínimo de propostas e alçadas configuráveis pelo condomínio, não universais (Superlógica, HabitaOne) | [A] [BR] |
| OC-06 | Escolha mais cara exige justificativa (HabitaOne) | [BR] |
| OC-07 | Planilha comparativa exportável em PDF para o conselho (CoteiBem) | [BR] |
| OC-08 | Conselho aprova faturas ou despesas no sistema (strata australiano) | [INT] |

---

## 11. Financeiro do condomínio

| ID | Ideia | Origem |
|---|---|---|
| FC-01 | Controle de receitas, despesas, comprovantes e caixa (iSindi) | [A] [BR] |
| FC-02 | Cobrança mensal por boleto e Pix | [A] [BR] |
| FC-03 | Régua de cobrança e lembrete de vencimento pelo WhatsApp (iSindi, MyCond) | [BR] |
| FC-04 | 2ª via de boleto pelo WhatsApp (Superlógica, ConexCondo) | [BR] |
| FC-05 | Começar pelo mês atual, sem migrar todo o histórico (iSindi) | [BR] |
| FC-06 | Relatórios financeiros para os moradores | [BR] |
| FC-07 | Previsão orçamentária anual | [A] |
| FC-08 | Patrimônio do condomínio | [BR] |
| FC-09 | Conta digital e garantia de inadimplência (Superlógica, FIDC) | [BR] |

---

## 12. Portaria, acesso, encomendas e chegada

| ID | Ideia | Origem |
|---|---|---|
| PA-01 | Registro de encomendas com aviso ao morador pelo WhatsApp (MeuVizy, SindIA) | [A] [BR] |
| PA-02 | Lista de convidados enviada à portaria (MeuVizy) | [BR] |
| PA-03 | Pedido de acesso de visitante encaminhado à portaria (SindIA) | [BR] |
| PA-04 | Controle de acesso integrado: reconhecimento facial, QR, biometria, placas (Condomob, Gruvi) | [BR] |
| PA-05 | Repasse entre turnos de portaria com rastreabilidade | [A] |
| PA-06 | **Plaquinha QR de chegada**: visitante informa o apartamento e o sistema avisa os contatos da unidade, sem expor dados nem abrir porta | [A] |
| PA-07 | Avisar a unidade, não só um celular (vários contatos, roteamento simultâneo ou sequencial) | [A] |
| PA-08 | Receptor sonoro local: interfone coletivo, campainha sem fio por unidade, controlador integrável (Intelbras, Shelly) | [A] |
| PA-09 | Armário de encomendas em locação, com sistema, manutenção e aviso no WhatsApp | [A] |
| PA-10 | Coordenação com a empresa de portaria remota (sem controlar o portão) | [A] |

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
| TR-01 | Indicadores: tempo até triagem, retornos vencidos, pendências por responsável, tempo de solução por categoria, reabertura, reincidência, decisões aguardando síndico | [A] |
| TR-02 | **Relatório mensal de prestação de contas para a assembleia** (Property Meld, Mygate) | [A] [INT] |
| TR-03 | % de retornos cumpridos no prazo como métrica principal | [INT] |
| TR-04 | Velocidade de reparo e satisfação média como indicadores (Property Meld) | [INT] |
| TR-05 | Relatório por categoria, bloco/torre e tempo médio de fechamento (Mygate) | [INT] |
| TR-06 | **Índice público anônimo de atendimento condominial no DF**, publicado como conteúdo (benchmarks Property Meld) | [INT] |
| TR-07 | Distinguir "sem dados" de zero | [A] |
| TR-08 | Exportação respeitando permissões | [A] |

---

## 15. Continuidade e troca de síndico

| ID | Ideia | Origem |
|---|---|---|
| CT-01 | Troca de síndico: validar substituição, revogar acessos antigos, preservar autoria | [A] |
| CT-02 | **Dossiê de passagem de bastão**: pendências, prestadores, contratos, documentos e histórico entregues ao novo síndico | [INT] |
| CT-03 | Memória permanente do prédio que não depende de quem é o síndico (golden thread, Reino Unido) | [INT] |
| CT-04 | Exportar todo o histórico do condomínio se ele sair da plataforma | [A] |
| CT-05 | Suspender um recurso sem perder o histórico | [A] |

---

## 16. Painel interno TRÍADE (Carolina e equipe)

| ID | Ideia | Origem |
|---|---|---|
| PI-01 | Carteira de clientes com estágio: em implantação, ativo, situações a tratar | [A] |
| PI-02 | Ficha do cliente: contatos, número institucional, contrato, recursos contratados e liberados | [A] |
| PI-03 | Recurso só disponível se **contratado E liberado**; liberação registrada com autor, data e referência | [A] |
| PI-04 | Implantação com roteiro de 8 etapas: ficha → dados → documentos → configuração → apresentação → moradores → pendências → entrega | [A] |
| PI-05 | Pendências de implantação com responsável e próximo retorno | [A] |
| PI-06 | Notas internas nunca visíveis ao cliente | [A] |
| PI-07 | Pagamentos dos clientes à TRÍADE: obrigação por competência, recebimentos, conferência, ajustes, parcial; valor desconhecido não é zero | [A] |
| PI-08 | Atraso de pagamento não bloqueia o cliente automaticamente | [A] |
| PI-09 | Suporte de acesso: pedido → verificar identidade e vínculo → redefinição segura → registro | [A] |
| PI-10 | Funções internas: administração, implantação, financeiro, suporte; cada uma só com clientes atribuídos | [A] |
| PI-11 | Acesso excepcional de suporte aos dados do cliente, com motivo e registro | [A] |
| PI-12 | Histórico administrativo de todas as mudanças | [A] |
| PI-13 | Acompanhar a adoção por condomínio (Gruvi) | [BR] |
| PI-14 | Ferramenta interna de rascunho de documentos e atas para o apoio documental | [INT] |
| PI-15 | Visão de capacidade da equipe (quantos condomínios cada um atende) | [A] |

---

## 17. Serviços humanos TRÍADE

| ID | Ideia | Origem |
|---|---|---|
| SH-01 | **Implantação presencial**: demonstração e orientação em reunião ou assembleia combinada | [A] |
| SH-02 | **Orientação de novos moradores** em condomínio já cliente | [A] |
| SH-03 | **Apoio documental**: criar ou revisar regimento, regras e atas (atas sempre de reuniões reais) | [A] |
| SH-04 | **Atendimento humano no WhatsApp** contratado pelo condomínio | [A] |
| SH-05 | **Plantão fora do horário**: triagem emergência × pode esperar, orientação e registro (Latchel, Vendoroo) | [INT] |
| SH-06 | Assessoria operacional recorrente: triagem, vistoria, acompanhamento de prestadores | [A] |
| SH-07 | **Rede de especialistas sob demanda**: contador, advogado, engenheiro ("síndico cooperativo", Matera) | [INT] |
| SH-08 | Produção e instalação de etiquetas e plaquinhas QR no prédio | [A] [INT] |
| SH-09 | Pacote de conteúdo de autoajuda adaptado às regras do prédio | [INT] |
| SH-10 | Apoio na transição de síndico | [INT] |
| SH-11 | Sindicatura profissional como serviço distinto (Unique, ABC Síndicos) | [A] [BR] |

---

## 18. Negócio, planos e preço

| ID | Ideia | Origem |
|---|---|---|
| NG-01 | Base completa de atendimento + conjuntos de recursos escolhidos + serviços com escopo separado | [A] |
| NG-02 | Cobrança por condomínio fixo (iSindi R$ 24,90) | [A] [BR] |
| NG-03 | Cobrança por faixa de unidades (SindIA R$ 197 até 50 un.; R$ 397 até 150) | [A] [BR] |
| NG-04 | Cobrança por unidade ativa com mínimo (HabitaOne R$ 4,90/un., mín. R$ 149) | [A] [BR] |
| NG-05 | Plano para síndico profissional com vários condomínios (Seu Síndico IA, MeuSíndico.IA) | [BR] |
| NG-06 | Teste grátis sem cartão (7 a 30 dias) | [BR] |
| NG-07 | Taxa de implantação | [A] [INT] |
| NG-08 | **Venda via construtoras**: prédio entregue com TRÍADE implantada; construtora paga a implantação (Aptner, Coreia) | [INT] |
| NG-09 | Teste assistido com 3–5 síndicos por cerca de 4 semanas | [A] |
| NG-10 | Demonstração curta de um pedido do início ao fim como ferramenta de venda | [A] |
| NG-11 | Conteúdo educativo para síndicos (blog, cursos) como aquisição (uCondo) | [A] [BR] |
| NG-12 | Índice público de atendimento (TR-06) como marketing e imprensa | [INT] |
| NG-13 | Planilha de custo por condomínio: mensagens, provedor, hospedagem, horas de implantação | [BR] |
| NG-14 | White label para administradoras (Gruvi, Winker) | [BR] |

---

## 19. Empresa e marca

| ID | Ideia | Origem |
|---|---|---|
| EM-01 | Nome, razão social, CNPJ, endereço | [A] |
| EM-02 | Logo, paleta e aplicações da marca | [A] |
| EM-03 | Canais: Instagram, Facebook, WhatsApp comercial e de suporte da TRÍADE | [A] |
| EM-04 | Site institucional: início, como funciona, serviços e conjuntos, contato | [A] |
| EM-05 | Mensagem: "Organize os pedidos do seu prédio: saiba quem vai agir, quando dar retorno e como cada problema foi concluído" | [A] |

---

## 20. Princípios técnicos e de qualidade

| ID | Ideia | Origem |
|---|---|---|
| PT-01 | Isolamento total entre condomínios, verificado no servidor em toda leitura, escrita, busca, anexo, fila e notificação | [A] |
| PT-02 | Permissão = pessoa + função + condomínio + ação; negar por padrão (OWASP) | [A] |
| PT-03 | Histórico e auditoria: nada é apagado em silêncio | [A] |
| PT-04 | Banco relacional com transações; alteração e intenção de envio salvas juntas (outbox) e um worker envia | [A] |
| PT-05 | Aplicação modular única (monólito modular) antes de microsserviços; candidatos: TypeScript, Node, PostgreSQL | [A] |
| PT-06 | Row Level Security no banco como defesa extra | [A] [BR] |
| PT-07 | Arquivos privados com validação de tipo e tamanho; links temporários | [A] |
| PT-08 | Login com e-mail verificado, recuperação por token de uso único, MFA para a equipe, sessões revogáveis | [A] |
| PT-09 | Valores monetários exatos (nunca ponto flutuante); moeda explícita | [A] |
| PT-10 | Acessibilidade WCAG 2.2 AA, uso no celular, estados vazio/erro/carregando | [A] |
| PT-11 | LGPD: cadastro mínimo, finalidade por campo, retenção, exclusão; TRÍADE provavelmente operadora dos dados do condomínio | [A] [BR] |
| PT-12 | Cópias de segurança com restauração testada; monitoramento e alertas | [A] |
| PT-13 | Logs sem senhas, tokens nem conteúdo pessoal desnecessário | [A] |
| PT-14 | Ambientes separados; dados fictícios em desenvolvimento | [A] |
| PT-15 | API pública para integrações (HabitaOne, casavi) | [BR] [INT] |
| PT-16 | Servidores no Brasil | [BR] [INT] |

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
| DR-01 | **Recibo do condômino**: cartão mensal no WhatsApp "sua taxa de R$ X virou: limpeza, elevador, fundo…", pela fração da unidade (recibo do contribuinte, EUA) | [INT] |
| DR-02 | Seu dinheiro em coisas concretas: equivalências do dia a dia ("= 30 dias de elevador funcionando") | [INT] |
| DR-03 | **Antes e depois** com fotos, custo e sua parte em toda obra ou reparo relevante (Boston 311, FixMyStreet) | [INT] |
| DR-04 | **Mural de conquistas do prédio**: linha do tempo de obras, economias e marcos, assinada pelo síndico | [INT] |
| DR-05 | **Retrospectiva anual "Seu prédio em 2026"** em cartões compartilháveis (Spotify Wrapped) | [INT] |
| DR-06 | Termômetro de metas coletivas (obra, fundo) com comemoração de marcos (efeito do gradiente de meta, Kivetz) | [INT] |
| DR-07 | **Bateria do prédio**: saúde do fundo de reserva, geral e por componente (percent funded, EUA) | [INT] |
| DR-08 | **O dinheiro que voltou**: placar de economias geradas, total e por apartamento | [INT] |
| DR-09 | O prejuízo evitado pela manutenção preventiva, como estimativa ilustrativa (lei dos cinco, de Sitter) | [INT] |
| DR-10 | Desafio de economia de água e luz das áreas comuns contra o próprio histórico (Opower) | [INT] |
| DR-11 | **Orçamento participativo do prédio**: moradores propõem e votam uma fatia pequena (Porto Alegre, Paris, Toronto) | [INT] |
| DR-12 | Simulador do orçamento antes da assembleia: o morador tenta fechar a conta (Balancing Act, BudgetHero) | [INT] |
| DR-13 | Extrato aberto do condomínio com comprovantes e "para quê", sem dados pessoais (Open Collective, extranet ALUR) | [INT] |
| DR-14 | Pergunte ao caixa: o morador consulta gastos no WhatsApp; dúvida de decisão vira pedido na fila | [INT] |
| DR-15 | "Por que fizemos": cada despesa relevante com motivo e alternativas consideradas (labor illusion, Harvard) | [INT] |
| DR-16 | "Sua parte" em todo valor coletivo (charity: water) | [INT] |
| DR-17 | Calendário do dinheiro: próximos gastos grandes previstos, sem surpresas | [INT] |
| DR-18 | "O que esta obra protege": patrimônio coletivo cuidado, sem prometer valorização | [INT] |
| DR-19 | **Obrigado, síndico**: reações dos moradores + resumo mensal de impacto para o síndico (pesquisa com voluntários) | [INT] |
| DR-20 | Prestação de contas anual pronta para assembleia e conselho fiscal (Código Civil, arts. 1.348 e 1.350) | [INT] |
| DR-21 | Selo opcional de prédio transparente, conquista do síndico que publica o resumo mensal | [INT] |

---

## Contagem

| Seção | Ideias |
|---|---|
| 1. Visão e pessoas | 16 |
| 2. Canal WhatsApp | 24 |
| 3. Atendimento | 30 |
| 4. Inteligência artificial | 17 |
| 5. Comunicados e documentos | 11 |
| 6. Configuração e ficha | 12 |
| 7. Moradores e unidades | 7 |
| 8. Manutenção e prédio | 16 |
| 9. Agenda | 7 |
| 10. Orçamentos e compras | 8 |
| 11. Financeiro do condomínio | 9 |
| 12. Portaria, acesso, encomendas | 10 |
| 13. Áreas comuns e vida em condomínio | 5 |
| 14. Transparência e indicadores | 8 |
| 15. Continuidade e troca de síndico | 5 |
| 16. Painel interno TRÍADE | 15 |
| 17. Serviços humanos | 11 |
| 18. Negócio, planos e preço | 14 |
| 19. Empresa e marca | 5 |
| 20. Princípios técnicos | 16 |
| 21. Ferramentas internas | 3 |
| 22. Transparência do dinheiro | 21 |
| **Total** | **270** |
