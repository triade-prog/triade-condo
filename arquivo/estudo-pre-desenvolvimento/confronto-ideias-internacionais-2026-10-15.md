# Confronto: o que já idealizamos × as 15 referências internacionais

15/10/2026. Compara cada ideia de [referências internacionais](referencias-internacionais-2026-10-15.md) (as 15 e mais a variante "plantão") com o que já existe nos documentos do projeto. Ao final está a **lista do que é novo**.

**Onde foi procurado:**
- escopo vigente: `estruturação do sistema/`, com `especificacao-mvp.md` como fonte de verdade;
- propostas R1–R7, próximas etapas e painéis;
- material histórico: `outputs/triade-condo/docs/produto.md`, `pesquisa/`;
- catálogo de 109 tarefas: `outputs/triade-condo/construcao/catalogo.json`.

**Classificação usada**

| Símbolo | Significado |
|---|---|
| ✅ | Já idealizado e **dentro do MVP aprovado** como está |
| 🟡 | **Parcialmente** idealizado: existe uma parte; a referência internacional acrescenta algo que não está em nenhum documento |
| 🔁 | **Já foi idealizado no plano antigo** (catálogo histórico ou `produto.md`), mas **ficou fora** do MVP aprovado em 08/10 |
| 🆕 | **Não aparece** em nenhum documento do repositório |

---

## 1. Tabela de confronto

| # | Ideia internacional | O que já existe no repositório | O que é novo | Classe |
|---|---|---|---|---|
| 1 | **Escalonamento automático do prazo de retorno** (Mygate, Condo Control) | MVP: "regra simples de acompanhamento do próximo retorno" (`especificacao-mvp.md`, configuração mínima); MVP-09 separa retorno de resolução. Histórico: "alerta de atraso de retorno" (`produto.md`), TIC-04 "alertas de retorno", SERV-04 "prazos por categoria" | **Cadeia de escalonamento**: responsável → síndico → substituto ou conselho, usando as pessoas da ficha aprovada. Hoje existe só "acompanhar" o retorno; ninguém é avisado em níveis quando ele vence | 🟡 |
| 2 | **Relatório mensal para assembleia** (Property Meld, Mygate) | Histórico: seção "Indicadores" de `produto.md` (retornos vencidos, reabertura, reincidência); tarefas MET-01 e MET-02 "painel e relatório por condomínio". **Não estão no MVP aprovado** | Formato de **prestação de contas aos moradores** (documento para assembleia), não só painel interno; usado como proteção do síndico | 🔁 |
| 3 | **Satisfação de 1 pergunta ao concluir** (Property Meld) | Nada no produto. PIL-06 fala em "feedback" só como medição do piloto | Pergunta "Resolveu? 1 a 5" no WhatsApp; nota baixa **sugere** reabertura ao responsável (sem reabrir sozinho, coerente com R4) | 🆕 |
| 4 | **Índice público anônimo de atendimento no DF** (benchmarks Property Meld) | Nada | Publicação trimestral de dados agregados, com autorização dos clientes, como marketing | 🆕 |
| 5 | **Autoajuda e "de quem é a responsabilidade"** (Fixflo) | MVP tem "modelos de resposta" na configuração, mas são respostas do síndico, não orientação prévia ao morador. Nenhuma menção a responsabilidade unidade × condomínio | Orientação curta por tipo de problema **antes** de abrir o chamado; aviso quando o problema é da unidade; conteúdo-padrão feito na implantação | 🆕 |
| 6 | **QR Code por local** fixado no prédio (ComtyLink, Arcsite) | Existe o "QR de chegada" para visitantes, fora do MVP (`proximas-etapas.md`, `visao-do-sistema.md`). É outro assunto | Etiqueta com link `wa.me` que abre o WhatsApp do condomínio com o local já escrito (para manutenção, não para visitante); produção e colagem na implantação | 🆕 |
| 7 | **Check-in do prestador por QR** (Arcsite) | Histórico: VIS-01 e EVI-01 (vistorias e evidências). Próximas etapas: manutenção com "executor conhecido" e "fotos quando pertinentes" | Registro de chegada e saída do prestador como evidência leve, sem checklist obrigatório | 🆕 |
| 8 | **Prontuário digital do prédio** (França, UE, Reino Unido + NBR 5674) | MVP: documentos vigentes com versão. Futuro: "arquivo administrativo, versões" no conjunto ampliado; `ReferenciaPrestador` em próximas etapas; "referência existente" (atas, contratos) na pesquisa | Visão única do prédio com **seguros, garantias, laudos, contratos e programa de manutenção** (NBR 5674), como memória permanente do condomínio | 🟡 |
| 9 | **Dossiê de troca de síndico** (Nextin, golden thread) | MVP e R5: na troca de síndico, validar substituição, revogar acessos antigos, preservar autoria (critério 9). Em aberto: "como preservar/exportar histórico?" (`visao-do-sistema.md`) | **Pacote de passagem de bastão** entregue ao novo síndico: pendências, prestadores, contratos, documentos, histórico. Hoje só se trata de **acesso**, não de **transferência de conhecimento** | 🟡 |
| 10 | **Canal de defeitos com a construtora** (i-Neighbour) | Nada (nenhuma menção a construtora ou incorporadora) | Separar defeito construtivo (assistência da construtora, com prazo) de manutenção do condomínio em prédios novos | 🆕 |
| 11 | **Rascunho de resposta por IA com aprovação humana** (Condo Control, AppFolio, Buildium) | MVP: "modelos de resposta" fixos. Regra vigente: "**Não é autorização para IA**" (complemento técnico da especificação); "sem assumir IA para substituir atendimento" | IA como **assistente de redação**, sempre aprovada por pessoa. **Conflita com a regra atual: precisa de decisão explícita de Carolina** | 🟡 |
| 12 | **Respostas automáticas só com documentos aprovados** (Condo Control, PropMIS, Gruvi) | MVP: morador consulta documento autorizado pelo WhatsApp (R3). Histórico: "dúvidas respondidas com base aprovada; IA pode errar… biblioteca/IA depois" (proposta P10) | **Governança da resposta**: cita documento e versão; quando não sabe, encaminha a humano **com próximo retorno** | 🟡 |
| 13 | **Rascunho de ata e resumo por IA** (SMPLR, Superlógica) | Serviço de apoio documental aprovado; regra "atas refletem reuniões reais" | Ferramenta interna (painel Carolina) para a equipe montar rascunho a partir de anotações | 🟡 |
| 14 | **Plataforma + especialistas sob demanda** ("síndico cooperativo", Matera) | Apoio documental; "revisão profissional quando aplicável, a definir"; assessoria operacional recorrente como hipótese futura | **Rede de especialistas** (contador, advogado, engenheiro) vendida por demanda ou pacote, posicionando a TRÍADE entre app barato e síndico profissional | 🟡 |
| 15 | **Vender pela construtora no prédio novo** (Aptner) | Nada sobre construtoras. Aquisição citada só como "demonstração + teste", "canal não validado" (`sintese-comercial`) | Canal B2B: prédio entregue com TRÍADE implantada | 🆕 |
| + | **Plantão fora do horário** (Latchel, Vendoroo) | Aprovado: atendimento humano opcional (equipe do condomínio ou TRÍADE contratada), horários e **mensagem fora do expediente** na ficha. Regras: "sem suporte 24h", "emergência pelo canal do condomínio". Histórico: SERV-03 "emergência e escalonamento" | **Triagem fora do horário** (emergência × pode esperar) como forma concreta do serviço humano TRÍADE, sem prometer socorro | 🟡 |

**Placar:**
- ✅ já no MVP como está: **0**
- 🟡 parcial: **8** (1, 8, 9, 11, 12, 13, 14 e plantão)
- 🔁 idealizado antes e fora do MVP: **1** (2)
- 🆕 totalmente novo: **7** (3, 4, 5, 6, 7, 10, 15)

Leitura: nenhuma ideia está pronta como está, mas **9 se apoiam em algo já idealizado** (as 8 parciais e a resgatada). A base (próximo retorno, reabertura, histórico, ficha, documentos com versão, humano opcional) torna a maioria das novidades um **acréscimo pequeno**, não uma mudança de rumo.

---

## 2. O que as referências confirmam (já idealizado, não muda)

Pontos do projeto que os líderes internacionais validam. **Não precisam de decisão nova**; servem de argumento.

- Próximo retorno separado da previsão de solução (padrão de *help desk*; Mygate e Condo Control usam prazos).
- Reabertura com motivo e histórico (MVP-09; Mygate tem reabertura configurável).
- Histórico com autoria e "rascunho só vale depois de aprovado" (Condo Control aplica a mesma regra à IA).
- Ficha com pessoas, permissões individuais, horários e mensagem fora do expediente (aprovada em 08/10).
- Documentos vigentes com versão e público autorizado (R3).
- Atendimento humano opcional separado da plataforma (Latchel, Vendoroo e Matera vendem humano + software).
- Implantação presencial e apoio documental (lá fora o onboarding "faça você mesmo" é a crítica mais comum, ex.: PayHOA).
- WhatsApp oficial e falha visível (R2).

---

## 3. A LISTA: o que ainda não está idealizado e chegou agora

Cada item traz o que é, onde encaixa, do que depende e o que Carolina precisa decidir. IDs `NOV-xx` são só para referência. Nada foi incluído na especificação.

### A. Candidatos ao MVP (pequenos, reforçam a promessa central)

**NOV-01 — Cadeia de escalonamento do retorno vencido** *(ideia 1)*
- O quê: quando o próximo retorno vence sem atualização, avisar o responsável; depois de um intervalo, o síndico; depois, o substituto ou conselho indicado na ficha. Tudo registrado no histórico.
- Encaixe: MVP-09 (andamento e retorno), MVP-15 (avisos), ficha aprovada.
- Decidir: níveis (2 ou 3?), intervalos, quem pode ser último nível, se vale fora do horário de atendimento.

**NOV-02 — Pergunta de satisfação ao concluir** *(ideia 3)*
- O quê: uma mensagem após a conclusão ("Resolveu? 1 a 5"). Nota baixa gera **sugestão** de reabertura para decisão humana.
- Encaixe: MVP-09 (conclusão e reabertura), MVP-14 (envio WhatsApp).
- Decidir: texto, se é opcional por condomínio, custo de mensagem (utilidade).

**NOV-03 — Etiquetas QR por local** *(ideia 6)*
- O quê: links `wa.me` com o local pré-escrito ("Problema em: elevador social, bloco A"), impressos e colados na implantação.
- Encaixe: produto quase sem desenvolvimento (só ler o local no texto recebido). O serviço entra no manual de implantação, etapa 4.
- Decidir: incluir no serviço de implantação? quem produz e cola? Confirmar que **não se confunde** com o QR de chegada de visitante (que continua futuro).

### B. Primeira evolução depois do MVP

**NOV-04 — Relatório mensal de prestação de contas para a assembleia** *(ideia 2)*
- O quê: documento simples por condomínio com pedidos, % de retornos no prazo, tempo até o primeiro retorno, concluídos, reabertos e pendências por motivo.
- Encaixe: **resgata** MET-01/MET-02 e os "Indicadores" de `produto.md`, com novo formato (voltado ao morador).
- Decidir: indicadores do primeiro relatório, quem pode publicar, se vai ao WhatsApp como comunicado.

**NOV-05 — Dossiê de transição de síndico** *(ideia 9)*
- O quê: na troca de síndico, gerar pacote com pendências abertas, prestadores, contratos, documentos vigentes e histórico, entregue ao novo síndico junto com a revogação de acessos (R5).
- Encaixe: amplia o critério 9 da especificação e responde à pergunta aberta "como preservar/exportar histórico".
- Decidir: conteúdo do pacote, se é produto, serviço de apoio na transição, ou ambos.

**NOV-06 — Autoajuda e responsabilidade unidade × condomínio** *(ideia 5)*
- O quê: para tipos comuns de problema, o WhatsApp mostra orientação curta antes de abrir o chamado e indica quando é responsabilidade da unidade, com base nas regras aprovadas.
- Encaixe: menus ou WhatsApp Flows sobre MVP-07/MVP-14.
- Decidir: lista inicial de tipos e quem aprova o texto (o condomínio, sempre).

**NOV-07 — Pacote de conteúdo de autoajuda na implantação** *(ideia 5, lado serviço)*
- O quê: a equipe TRÍADE entrega modelos de orientação e de responsabilidade adaptados às regras do prédio.
- Encaixe: manual de implantação, etapa 3 (documentos).
- Decidir: incluso na implantação ou cobrado à parte.

**NOV-08 — Rascunho de resposta por IA com aprovação humana** *(ideia 11)*
- O quê: sugestão de resposta ao morador e resumo do caso; o síndico ou a secretária aprova antes de enviar.
- Encaixe: tela de atendimento (MVP-09).
- **Decisão obrigatória**: revisar a regra "não é autorização para IA". A proposta é **assistente de redação, nunca envio automático**. Também: provedor de IA, custo e dados enviados (LGPD).

### C. Produto futuro (junto com os conjuntos já previstos)

**NOV-09 — Respostas automáticas só com documento aprovado, citando a versão** *(ideia 12)*
- O quê: dúvida de regra respondida pelo documento vigente, com referência. Sem resposta segura, o caso vai para a fila com próximo retorno.
- Encaixe: depende de MVP-10 (documentos com versão) e da decisão de NOV-08.
- Decidir: quais documentos podem ser usados e o texto de aviso ao morador.

**NOV-10 — Prontuário digital do prédio** *(ideia 8)*
- O quê: seguros, garantias, laudos, contratos, prestadores e programa de manutenção (NBR 5674) em uma visão permanente do condomínio.
- Encaixe: base do conjunto "coordenação de manutenção" (`proximas-etapas.md`) e do "arquivo administrativo" ampliado.
- Decidir: escopo mínimo; parecer sobre a obrigatoriedade da NBR 5674 antes de usar como argumento.

**NOV-11 — Check-in e check-out do prestador por QR** *(ideia 7)*
- O quê: o prestador registra chegada e saída no local; vira evidência opcional.
- Encaixe: coordenação de manutenção (futuro). Sem checklist obrigatório.
- Decidir: se o prestador precisa de identificação mínima, já que hoje ele não tem portal nem login por decisão.

**NOV-12 — Canal de defeitos construtivos com a construtora** *(ideia 10)*
- O quê: separar defeito de obra (assistência da construtora, com prazo e histórico) da manutenção do condomínio.
- Encaixe: nicho de prédios novos no DF; depende de NOV-16 (canal construtora).
- Decidir: interesse no nicho; verificação jurídica de prazos de garantia.

**NOV-13 — Ferramenta interna de rascunho de ata e resumo** *(ideia 13)*
- O quê: no painel Carolina, a equipe gera rascunho a partir de anotações reais de reunião; o condomínio revisa e aprova.
- Encaixe: serviço de apoio documental. Regra mantida: ata só de reunião real.
- Decidir: depende da decisão sobre IA (NOV-08).

**NOV-14 — Plantão fora do horário** *(variante)*
- O quê: triagem TRÍADE fora do horário do condomínio (emergência → orientar o canal de emergência do prédio; resto → registrar com próximo retorno no horário de atendimento).
- Encaixe: forma concreta do "atendimento humano TRÍADE contratado" já aprovado; resgata SERV-03 (emergência).
- Decidir: horários, capacidade, preço. Regras vigentes mantidas: sem prometer socorro nem 24 h por padrão.

### D. Serviço e comercial (não são software)

**NOV-15 — Rede de especialistas sob demanda ("síndico cooperativo")** *(ideia 14)*
- O quê: contador, advogado e engenheiro parceiros, contratados por demanda ou pacote, ao lado do síndico morador.
- Encaixe: amplia o apoio documental e a "revisão profissional quando aplicável".
- Decidir: quais especialidades, modelo (parceria × equipe própria), responsabilidade e preço.

**NOV-16 — Canal de venda via construtoras e incorporadoras** *(ideia 15)*
- O quê: o prédio novo é entregue com TRÍADE implantada (canal, ficha, documentos iniciais).
- Decidir: abordagem comercial, quem paga a implantação, depois dos primeiros clientes.

**NOV-17 — Índice público de atendimento condominial no DF** *(ideia 4)*
- O quê: publicação trimestral de dados agregados e anônimos (ex.: tempo médio de retorno) como conteúdo e prova social.
- Decidir: só com volume e autorização contratual dos clientes; revisão LGPD.

### E. Itens do plano antigo que as referências sugerem resgatar

Já foram idealizados e estão no catálogo histórico, mas **não entraram no MVP aprovado**. As referências mostram que são valorizados lá fora.

| Item antigo | Onde está | Por que resgatar |
|---|---|---|
| Indicadores e relatório por condomínio | MET-01, MET-02; `produto.md` § Indicadores | Base de NOV-04 e NOV-17 |
| Prazos de retorno por categoria e regras de pausa | SERV-04 | Necessário para NOV-01 (prazo-padrão por tipo de pedido) |
| Emergência e escalonamento | SERV-03 | Necessário para NOV-14 e para a mensagem fora do expediente |
| Duplicidades e reincidências por local | TIC-06 | Fica muito mais preciso com o local vindo do QR (NOV-03) |
| Vistorias e evidências | VIS-01, EVI-01 | Base de NOV-11, sem checklist universal |

---

## 4. Cuidados: onde as novidades tocam decisões vigentes

| Novidade | Decisão vigente que limita | Como conciliar |
|---|---|---|
| NOV-08, 09, 13 (IA) | "Não é autorização para IA"; "sem IA para substituir atendimento" | IA só como **rascunho aprovado por pessoa**; precisa de aprovação explícita de Carolina para mudar a regra |
| NOV-02 (satisfação) | R4: não reabrir automaticamente por qualquer texto | Nota baixa só **sugere** reabertura |
| NOV-14 (plantão) | "Sem suporte 24h"; emergência pelo canal do condomínio | Plantão é **serviço contratado opcional**, com horário definido, e orienta o canal de emergência |
| NOV-11 (check-in) | Prestador sem portal ou login; sem checklist obrigatório | Check-in leve por link, opcional, sem conta |
| NOV-03 (QR local) | QR de chegada é futuro e fora do MVP | São coisas diferentes: QR de local só abre o WhatsApp do condomínio, não avisa morador nem libera entrada |
| NOV-17 (índice) | LGPD, dados de clientes | Só agregado, anônimo e com cláusula contratual |
| NOV-10 (prontuário) | NBR 5674 não confirmada como lei | Vender como "organização da manutenção", não como "conformidade legal", até haver parecer |

---

## 5. Para levar ao painel de execução

O arquivo [`lista-novidades-painel.json`](lista-novidades-painel.json) contém as 17 novidades como **tarefas de decisão**, no formato de importação do painel de construção (`outputs/triade-condo/construcao/index.html` → "Importar cópia"):
- IDs `LOCAL-901` a `LOCAL-917`, para não colidir com tarefas locais existentes;
- aplicação "A classificar";
- status "A fazer".

A importação **mescla** e não apaga nada. Exporte um backup antes, como o guia do painel recomenda.
