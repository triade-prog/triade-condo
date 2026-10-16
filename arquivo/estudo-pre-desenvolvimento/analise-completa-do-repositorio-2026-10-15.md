# Análise completa do repositório `triade-condo`

Leitura feita em 15/10/2026 sobre o commit `df2b57b`: 128 arquivos versionados, cerca de 3,2 MB, incluindo 4 ZIPs e 1 planilha. Todos os arquivos foram abertos:
- Markdown e HTML lidos integralmente, com o texto dos HTML extraído;
- JavaScript lido integralmente;
- JSON inspecionados (o catálogo tarefa a tarefa);
- planilha lida aba por aba;
- scripts de `work/` lidos e comparados com os documentos finais;
- ZIPs extraídos e comparados arquivo a arquivo com a versão atual.

Os testes também foram executados.

---

## 1. O que é o projeto, em uma frase

**TRÍADE Condo** é uma plataforma, ainda **não construída**, para organizar o atendimento de condomínios:
- o **morador** usa só o **WhatsApp institucional** do prédio;
- o **síndico** e seus delegados usam um **painel web** e recebem avisos no próprio WhatsApp;
- **Carolina e a equipe TRÍADE** usam um **painel interno** para carteira de clientes, contratação e liberação de funções, implantação, pagamentos à TRÍADE e recuperação de acesso.

O foco inicial é **Brasília/DF**, com o prédio simples sem portaria como primeiro cenário (C01). A TRÍADE também vende **serviços humanos** à parte: implantação presencial, orientação de novos moradores, apoio documental e atendimento humano opcional.

---

## 2. Estado real

| Item | Situação |
|---|---|
| Código de produto (backend, banco, login, WhatsApp, pagamentos) | **Não existe** |
| Especificação do MVP | Pronta para avaliação (`estruturação do sistema/especificacao-mvp.md`), aprovada em 08/10 |
| Decisões técnicas R1–R7 | **Propostas, não aprovadas** (exceto a ficha por condomínio) |
| Protótipos | 3 simulações HTML/JS com dados fictícios e `localStorage` |
| Ferramentas internas | Painel de execução (109 tarefas), mapa da empresa, painel informativo de pesquisa |
| Testes | 11 scripts Node: **10 passam e 1 falha** (ver seção 6) |
| Validação visual em navegador | **Nunca feita** (registrado em todos os relatórios) |

---

## 3. Linha do tempo das decisões (reconstruída pelos arquivos)

| Data | O que aconteceu | Onde ver |
|---|---|---|
| 03/10 | Produto nasce como **"assessoria operacional"**: a equipe TRÍADE recebe, tria, cobra prestadores, faz vistorias e leva decisões ao síndico. Protótipo operacional com visões "Operação" e "Síndico" | `work/build.py`, `outputs/triade-condo/prototype/` |
| 05/10 | Painel de execução com 74 tarefas em 7 fases e 16 frentes | `work/build-roadmap.py`, `work/catalogo-antes-2026-10-07.json` |
| 07/10 | **Virada:** serviço humano vira **adicional opcional**; a plataforma deve funcionar só com o síndico (80 tarefas). Pesquisa pública e comparativo de 15 SaaS. Cenários C01/C02/C03. Morador 100% WhatsApp. Módulos independentes. Armário de encomendas adiado | `docs/revisao-modelos`, `docs/pesquisa-publica`, `pesquisa/` |
| 08/10 (manhã) | Número institucional vira "pré-requisito de adesão". Brasília/DF como foco. Implantação assistida e apoio documental. Planos básico/ampliação, depois substituídos por "conjuntos". Ideia da plaquinha QR. Cotações pesquisadas e logo **excluídas** do desenvolvimento inicial | scripts `registrar-*.py`, `adiar-orcamentos.py` |
| 08/10 (tarde) | Pasta `estruturação do sistema/`: dois painéis, manual de implantação, **MVP aprovado**, próximas etapas (agenda e manutenção), protótipo dos painéis | `criar-estruturacao.py`, `especificar-mvp.py` |
| 08–09/10 | Auditoria técnica: 10 bugs corrigidos nas ferramentas locais, 9 riscos ou decisões abertas, proposta R1–R7 | `relatorio-revisao-desenvolvimento.md`, `proposta-decisoes-construcao.md` |
| 08/10 (fim) | **Ficha por condomínio aprovada** (pessoas, permissões, secretária, horários, mensagem fora do expediente). Atendimento humano opcional por condomínio. **Número exclusivo volta a ser só "proposta"** | `ficha-condominio.py`, `atualizar-ficha-docs.py` |
| 15/10 | Importação de tudo para o GitHub | `inventario-importacao.json` |

**Leitura:** em cinco dias o projeto mudou de modelo de negócio duas vezes:
1. de serviço humano para plataforma com serviço opcional;
2. de catálogo amplo para MVP focado.

Os documentos guardam todas as camadas, o que explica boa parte da confusão de leitura (seção 5).

---

## 4. Inventário comentado (todos os arquivos)

### Raiz
| Arquivo | Conteúdo | Situação |
|---|---|---|
| `README.md` | Índice e decisões vigentes | Atual |
| `mapa-da-empresa.html` | Árvore clicável com 45 pontos: Marca, Canais, Site e Sistema, cada um com estado (definido, existente, pendente, proposto) e revisão local | Atual. Marca, logo, CNPJ, redes sociais e site estão **todos pendentes** |
| `inventario-importacao.json` | Hash SHA-256 de cada arquivo importado e lista do que foi excluído (memória, PNGs, logs) | Registro |
| `.gitignore` | `.env`, `node_modules`, `memory/` | OK |

### `estruturação do sistema/` (material **vigente**)
| Arquivo | Conteúdo |
|---|---|
| `especificacao-mvp.md` / `.html` | **Fonte de verdade.** Escopo DENTRO/DEPOIS/FORA, papéis e isolamento, telas, atendimento, jornada WhatsApp, conteúdos, implantação, pagamentos internos, recuperação de acesso, modelo de dados conceitual, 10 critérios de aceitação, sequência em 7 etapas, decisões bloqueadoras |
| `proposta-decisoes-construcao.md` / `.html` | R1 vínculos e permissões, R2 WhatsApp e falhas, R3 documentos, R4 configuração e concorrência, R5 recuperação de acesso e MFA, R6 pagamentos por competência, R7 revisão visual e WCAG 2.2 AA. Inclui arquitetura sugerida: monólito modular + worker + PostgreSQL + arquivos privados + outbox |
| `relatorio-revisao-desenvolvimento.md` / `.html` | Auditoria: bugs C01–C10 corrigidos, riscos D01–D09, comparação com documentação oficial (uCondo, Intercom, Twilio, Zendesk, Auth0, Jira) |
| `visao-do-sistema.md` | Fronteiras dos 3 perfis, contratado × liberado, conjuntos, permissões internas |
| `painel-carolina.md`, `painel-sindico.md` | Detalhe de cada painel |
| `manual-implantacao.md` | Roteiro interno em 8 etapas para o funcionário que implanta um condomínio |
| `proximas-etapas.md` / `.html` | Agenda e coordenação de manutenção, só planejamento (fora do MVP) |
| `prototipo-paineis.html` | **Protótipo atual**: perfis Carolina e síndico, carteira, ficha com permissões por pessoa, contratação e liberação, implantação, pagamentos, suporte de acesso, fila de atendimento, prévia do WhatsApp, comunicados, configuração. Salva no navegador |
| `planejamento-paineis.html` | Simulação anterior dos dois painéis com conjuntos liberáveis. Marcada como **histórica** |
| `README.md` | Índice da pasta |

### `outputs/triade-condo/`
| Pasta/arquivo | Conteúdo | Situação |
|---|---|---|
| `docs/produto.md`, `arquitetura.md`, `plano-execucao.md` | Documentos de 03–08/10 com todas as camadas de decisão empilhadas | **Históricos com cabeçalho atualizado.** `plano-execucao.md` (942 linhas) tem o catálogo completo das 80 tarefas antigas |
| `docs/pesquisa-publica-2026-10-07.md`, `sintese-comercial-2026-10-07.md` | Pesquisa de mercado de 07/10: 9 alternativas, relatos, hipótese de público e MVP | Base válida, complementada pelo novo estudo |
| `docs/revisao-modelos-2026-10-07.md`, `validacao*.md`, `guia-painel-construcao.md` | Registros de validação e manual do painel de execução | Registro |
| `pesquisa/comparativo-cenarios-saas-2026-10-07.html` (154 KB) | Painel informativo: 9 seções, 15 sistemas, matriz de 12 funcionalidades, 42 ofertas por cenário, conjuntos de ferramentas, operação interna, desenvolvimento, análise de preços, cotações, QR/receptor sonoro | Atual na abertura; demais seções históricas |
| `pesquisa/…xlsx` | Mesma pesquisa em 6 abas. **Todo o conteúdo está também no HTML**, conferido célula a célula | Redundante |
| `pesquisa/sintese-cenarios-saas…md`, `aprofundamento-cotacoes…md` | Sínteses da pesquisa e de cotações | Histórico |
| `construcao/` | Painel de execução (HTML + `catalog.js` + `store.js` + `app.js` + `catalogo.json`): filtros, dependências, sessões de trabalho, exportação e importação com mescla | Ferramenta local funcional. `catalogo.json` e `catalog.js` são idênticos (conferido) |
| `prototype/` | Protótipo operacional de 03/10 (ES modules), modelo antigo de assessoria | **Histórico** |

### `outputs/entregas/`
| Arquivo | Conteúdo | Achado |
|---|---|---|
| `triade-ficha-condominio-2026-10-08.zip` | Pacote mais recente | **43 de 43 arquivos idênticos** ao repositório atual |
| `triade-paineis-revisados-…zip`, `triade-paineis-…zip`, `revisao-2026-10-08/backup-antes-auditoria.zip` | Versões anteriores | **Nenhum conteúdo exclusivo**: todo texto delas está nos arquivos atuais |
| `LEIA-ME-*.md`, `registro-auditoria.json` | Guias dos pacotes e registro importável da auditoria | Registro |

**Conclusão:** os ~1,25 MB de ZIPs são redundantes com o Git, que já guarda o histórico. Podem ser mantidos por rastreabilidade, mas não precisam ser consultados.

### `work/` (76 arquivos)
- **42 scripts Python e JS geradores.** Cada um aplicou uma decisão aos documentos, por exemplo `registrar-qr.py`, `adiar-orcamentos.py` e `ficha-condominio.py`. Contam a história das decisões. **Gravam por cima dos arquivos finais** se forem executados de novo, e o README já alerta para não fazer isso.
- **11 testes `test-*.cjs`.** Executam a lógica dos HTML em DOM simulado com `vm`, sem navegador.
- **JSON de validação e catálogos antigos** (74 e 80 tarefas), dados do comparativo, `analise-planos-2026-10-08.md` (conteúdo integral já incluído na síntese).
- **Texto que só existe nos scripts:** 166 trechos de redação superada, como "A TRÍADE oferece assessoria operacional…" e "número institucional é pré-requisito". Nenhuma decisão vigente depende deles.

---

## 5. Problemas encontrados

### 5.1 Contradição: número institucional
- **Decisão mais recente:** o número exclusivo por condomínio é **proposta**.
- **O que os documentos ainda dizem:** o corpo de cerca de 15 arquivos continua dizendo "requisito/pré-requisito de adesão", incluindo:
  - a seção "APROVADO" da Jornada WhatsApp em `especificacao-mvp.md`;
  - `visao-do-sistema.md`, `manual-implantacao.md` (etapa 2) e `planejamento-paineis.html`;
  - o critério da tarefa WA-01 no catálogo.
- **Risco:** um desenvolvedor lendo uma seção isolada implementa a regra errada.
- **Agravante:** a pesquisa mostra que essa decisão afeta custo e operação (coexistência, franquias, BSP). Por isso é a primeira a fechar.

### 5.2 Documentos em camadas
- **Bloco repetido.** O mesmo parágrafo "Decisão mais recente — atendimento humano opcional…" aparece colado no topo de **10 arquivos**.
- **Títulos trocados.** `produto.md`, `arquitetura.md`, `plano-execucao.md` e `guia-painel-construcao.md` começam com o título "# Atualização vigente dos painéis", que não é o assunto do arquivo. O título real aparece só na linha ~30.
- **Repetição interna.** `produto.md`, `arquitetura.md` e o README de `outputs/` repetem vários blocos de decisão idênticos entre si.
- **Consequência:** a leitura exige saber a ordem cronológica para descobrir o que vale.

### 5.3 Nomes divergentes
"Gabriela" aparece como validadora em `outputs/triade-condo/README.md`, `produto.md` e `plano-execucao.md`. Os documentos atuais usam **Carolina**.

### 5.4 Catálogo de tarefas misturado
109 tarefas no total:
- 80 históricas, todas "A fazer";
- 21 do MVP (3 concluídas, que são documentos);
- 8 de auditoria.

Sem o filtro "MVP aprovado", a visão geral mostra 99 pendências, muitas superadas (por exemplo SYN-01/02 "decisões do síndico com valor estimado", VIS-01 "vistorias").

### 5.5 Protótipos antigos ainda acessíveis
- `outputs/triade-condo/prototype/` mostra a equipe TRÍADE como operadora ("Ana • TRÍADE") e aprovação de despesa de R$ 480 pelo síndico, ou seja, o modelo abandonado.
- `planejamento-paineis.html` permite liberar agenda e manutenção.

Ambos estão marcados como históricos, mas continuam linkados no painel de execução.

### 5.6 Proposta R1–R7 sem resposta
A fundação técnica (MVP-03) depende de AUD-02 e MVP-01, e estas dependem das escolhas listadas na terceira coluna do "Quadro de decisões" da proposta. **Sem essas respostas, não há como começar o código.**

### 5.7 Observações sobre o protótipo atual (não são bugs de produto)
- Configuração de etapas e responsáveis por texto separado por vírgula. A proposta R4 pede IDs estáveis; o protótipo serve só para demonstrar.
- Uma única ficha de pagamento por cliente, já apontado como limite em D07.
- Toda a autorização é feita no navegador, como esperado de simulação.

---

## 6. Testes executados (Node 22)

| Teste | Resultado |
|---|---|
| `test-auditoria-riscos.cjs` | ✅ |
| `test-comparativo-html.cjs` | ✅ 23 verificações |
| `test-construcao.cjs` | ❌ **falha**: espera 80 tarefas, o catálogo tem 109 |
| `test-estruturacao.cjs` | ✅ 15 |
| `test-execucao-atual.cjs` | ✅ (catálogo JSON = JS) |
| `test-execucao-ui.cjs` | ✅ |
| `test-ficha-condominio.cjs` | ✅ |
| `test-mapa.cjs` | ✅ |
| `test-modelos.cjs` | ✅ 6 |
| `test-prototipo-paineis.cjs` | ✅ |
| `test-sessoes.cjs` | ✅ |

A falha é de **teste desatualizado**, não de código: o README já avisa que testes antigos refletem catálogos superados. Os testes cobrem só as ferramentas locais e protótipos; **não há teste de produto** porque não há produto.

---

## 7. Avaliação geral

**Pontos fortes**
- Escopo do MVP enxuto e bem delimitado, com fronteiras explícitas (o que não fazer é tão claro quanto o que fazer).
- Requisitos de segurança maduros para a fase:
  - isolamento por condomínio verificado no servidor;
  - autoria e histórico;
  - "envio aceito não é entrega";
  - "valor ausente não é zero";
  - nunca mostrar senha;
  - deduplicação de eventos.
- Critérios de aceitação testáveis (10 cenários) e uma arquitetura proporcional proposta (monólito modular, PostgreSQL, outbox, worker).
- Diferencial do "próximo retorno": a pesquisa mostra que ninguém no Brasil vende isso publicamente e que é padrão consagrado em help desks (ver `estudo-de-mercado-2026-10-15.md`).
- Honestidade sistemática: cada documento distingue aprovado, proposta e aberto, e não declara pronto o que não está.

**Pontos fracos**
- Volume e repetição de texto: cerca de 600 KB de Markdown e HTML para um produto sem código. O custo de leitura é alto e o risco de contradição já se materializou (5.1).
- Decisões de negócio que afetam a técnica estão abertas:
  - número de WhatsApp;
  - preço e unidade de cobrança;
  - escopo do serviço humano;
  - quem é o desenvolvedor e qual a stack.
- Nenhum contato com cliente real ainda. O público e a disposição a pagar são hipóteses, e a concorrência direta (SindIA, MeuVizy) já cobra de R$ 149 a R$ 397, enquanto a IA de perguntas frequentes é gratuita (Móra).
- Nenhuma revisão visual em navegador foi feita até hoje.

---

## 8. Recomendações antes de codar (ordem sugerida)

1. **Consolidar uma versão única e limpa** da especificação (`especificacao-mvp.md`): aplicar as decisões mais recentes no corpo do texto, em vez de avisos no topo; corrigir o número institucional; trocar Gabriela por Carolina. Os demais documentos ficam como histórico.
2. **Responder ao "Quadro de decisões" R1–R7**, ao menos R1 (vínculos e permissões) e R2 (WhatsApp). Para R2, usar os fatos novos do estudo de mercado:
   - coexistência de número;
   - cobrança de mensagens de serviço desde 01/10/2026;
   - categorias de template;
   - política de IA da Meta;
   - faturamento em BRL.
3. **Fechar a stack e o responsável técnico** (DEC-02 / MVP-01). A sugestão documentada é TypeScript/Node + PostgreSQL. É razoável e compatível com a arquitetura proposta, mas depende de quem vai manter o sistema.
4. **Fazer uma planilha de custo por condomínio**: mensagens WhatsApp, BSP, hospedagem, horas de implantação. Comparar com a faixa de preço do mercado antes de definir planos.
5. **Atualizar ou arquivar `work/test-construcao.cjs`** e marcar no painel de execução as 80 tarefas históricas como arquivadas, para a visão geral refletir só o MVP.
6. **Começar o código pela fundação** (etapa 2 da especificação): vínculos, isolamento A/B, autenticação, auditoria, com testes negativos entre condomínios. Só depois os painéis.
