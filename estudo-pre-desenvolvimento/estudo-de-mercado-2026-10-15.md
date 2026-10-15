# Estudo de mercado — software para condomínios (base antes de codar)

Pesquisa web feita em 15/10/2026. Complementa, sem substituir, a pesquisa de 07–08/10 que já está em `outputs/triade-condo/pesquisa/`. Objetivo: entender o que já existe, o que os concorrentes fazem melhor, onde ainda há espaço para a TRÍADE e quais fatos externos (WhatsApp, leis, custos) mudam decisões técnicas antes do desenvolvimento.

**Complemento:** [referências internacionais e 15 ideias de diferencial](referencias-internacionais-2026-10-15.md), cobrindo EUA, Reino Unido, França, Alemanha, Índia, Austrália, Malásia, Coreia e América Latina.

**Como ler.** Quase todas as informações de concorrentes vêm de páginas comerciais ou blogs dos próprios fornecedores: são *alegações*, não testes. Números de mercado vêm de fontes privadas e divergem entre si. Cada ponto traz a fonte; onde há conflito, isso está dito.

---

## 1. Resumo em 10 pontos

1. **O mercado é grande, mas o software de base já está comoditizado.** O Brasil tem algo entre 327 mil e 520 mil condomínios, conforme a fonte. A Superlógica sozinha declara estar em mais de 100 mil condomínios (mais de 50% do mercado, segundo ela). WhatsApp, chamados com foto e IA respondendo dúvidas já são recursos comuns.
2. **IA no WhatsApp para tirar dúvidas do morador virou "grátis".** A uCondo oferece a Móra, IA no WhatsApp "100% gratuita e ilimitada". Cobrar por FAQ automatizado não se sustenta como diferencial.
3. **Ninguém no Brasil vende publicamente "prestação de contas do atendimento".** Nenhum concorrente brasileiro pesquisado mostra prazo de próximo retorno, conclusão explicada e reabertura rastreável. A SindIA mostra status (novo, em análise, aguardando peça, em andamento, concluído), mas sem prazos. Fora do Brasil, prazo e tempo de resposta são argumento de venda: SLA por prioridade e escalonamento (Condo Control, Mygate) e benchmarks mensais de velocidade e satisfação (Property Meld). Esse é o espaço mais claro para a TRÍADE. Ver [referências internacionais](referencias-internacionais-2026-10-15.md).
4. **O "próximo retorno" da TRÍADE é um padrão consagrado em help desks.** Equivale ao SLA de "periodic update" / "next reply time" do Zendesk: um teto para o tempo sem resposta ao cliente. A ideia tem respaldo de mercado e pode ser explicada aos síndicos com essa linguagem.
5. **Muitos concorrentes baratos usam conexão não oficial do WhatsApp.** É o caso, por exemplo, da conexão "por QR Code" que o MeuSíndico.IA anuncia. Esse tipo de conexão traz risco de banimento e instabilidade. A recomendação R2 do repositório (API oficial) é um diferencial de confiabilidade, mas tem custo e burocracia.
6. **O custo do WhatsApp mudou, segundo parceiros da Meta.** A partir de 01/10/2026, respostas dentro da janela de 24 h e templates de utilidade passam a ser cobrados por mensagem (anúncio da Zendesk de 10/08/2026; a página pública da Meta consultada ainda não mostra a mudança). O produto da TRÍADE é feito de respostas ao morador, então isso afeta a margem.
7. **O "número institucional por condomínio" ficou mais viável.** A Meta permite *coexistência*: o mesmo número funciona no app WhatsApp Business e na API ao mesmo tempo. O condomínio pode manter o número que já usa e a plataforma se conecta a ele, sem migração traumática.
8. **Em Brasília, o cenário de portaria remota vai crescer.** Em maio de 2026, o STF derrubou por unanimidade a Lei Distrital 7.686/2025, que restringia portarias virtuais. Mais de 800 condomínios do DF já usam portaria virtual ou autônoma (Sindicondomínio-DF). Isso reforça o cenário C02 como evolução natural.
9. **O mercado está em consolidação.** A NokNox (comprada pelo QuintoAndar em 2022) encerrou e migrou clientes para a MyCond. A Visma comprou a chilena ComunidadFeliz (dez/2025, cerca de US$ 70 mi). A Superlógica lançou a IA "Nexus" (ago/2026). Players pequenos sobrevivem com nicho claro, não com amplitude.
10. **Faixa de preço praticada: de R$ 25 a R$ 400 por mês por condomínio pequeno ou médio.** Há três modelos de cobrança dominantes: por condomínio fixo, por faixa de unidades e por unidade com mínimo. O serviço humano de implantação quase nunca tem preço publicado.

---

## 2. Tamanho e estrutura do mercado

| Dado | Valor | Fonte / ressalva |
|---|---|---|
| Condomínios ativos no Brasil | 327.248 | [Censo Condominial 2025/2026 — uCondo](https://www.ucondo.com.br/materiais/censo-2026) (cruza IBGE e Receita; metodologia não publicada) |
| Condomínios no Brasil (outra contagem) | ~420 mil (2016) → >520 mil (2024), +23,8% | [Condomínio Interativo / INCC, 28/08/2025](https://www.condominiointerativo.com.br/noticia/1625/noticias/mercado-condominial-brasileiro-cresce-23-8-e-movimenta-mais-de-r-300-bilhoes-ao-ano.html) |
| Moradores em condomínio | ~39 milhões | Censo uCondo |
| Endereços em arranjos condominiais | ~13,3 milhões | IBGE, citado pelas duas fontes acima |
| Síndicos no DF | >12 mil | Sindicondomínio-DF, citado pelo [Jornal de Brasília](https://jornaldebrasilia.com.br/brasilia/ele-pode-mediar-ou-gerar-conflitos/) (sem data clara) |
| Condomínios com síndico profissional | 6% (2013) → 15% (2020) → 18% (2021) | [Censo SíndicoNet](https://www.sindiconet.com.br/informese/condominios-com-sindicos-profissionais-triplicam-em-8-anos-administracao-sindiconet/amp). Logo, **cerca de 80% ainda têm síndico não profissional** |
| Condomínios com administradora, Centro-Oeste | 30% (o menor índice do país; Sudeste 76%) | [SíndicoNet, censo 2015](https://www.sindiconet.com.br/informese/dados-e-numeros-do-mercado-de-condominios-no-brasil-administracao-atribuicoes-do-sindico/amp). Dado antigo, mas sugere **muita autogestão no Centro-Oeste**, o público-alvo da TRÍADE |
| Condomínios do DF com portaria virtual/autônoma | >800 | Sindicondomínio-DF, via [Condomínio S/C](https://condominiosc.com.br/secoes/condominio-e-cia/6190-stf-declara-inconstitucional-lei-do-df-que-restringia-portaria-virtual-em-condominios) |

**Leitura para a TRÍADE.** O público "síndico morador de prédio pequeno, sem administradora" é grande, mas os dados mais específicos são antigos (2015/2021). Não há número oficial de condomínios do DF. Para dimensionar Brasília, as fontes seriam o Sindicondomínio-DF, uma consulta a CNPJs com CNAE 8112-5/00 (condomínios prediais) no DF ou o relatório completo do Censo uCondo, que exige cadastro.

---

## 3. Mapa competitivo

### 3.1 Plataformas grandes (ERP, administradoras, app do morador)

| Player | Escala declarada | Foco | WhatsApp / IA | Preço público |
|---|---|---|---|---|
| **Superlógica** | >100 mil (site) a >130 mil condomínios; >3.000 administradoras | ERP de administradora, financeiro, conta digital, FIDC de inadimplência | Chatbot "Atende" para moradores no WhatsApp (2024); IA "Nexus" (ago/2026); parceria OpenAI | Não publicado ("alto") |
| **Group Software (Condomínio21)** | >100 mil condomínios; >1.500 administradoras | ERP tradicional, folha | Chatbot básico | Não publicado ("médio") |
| **TownSq** | >30 mil condomínios em 4 países | Comunicação, encomendas, assembleia; também nos EUA (HOAs) | WhatsApp básico | Não publicado |
| **Gruvi** (integra com Superlógica) | >60 mil condomínios via >1.600 administradoras | App do morador, portaria, acesso, marketplace | "Gruvi Assist": IA no WhatsApp que responde 24 h com base nos documentos do condomínio | Não publicado; app gratuito para o morador |
| **uCondo** | 4–6 mil condomínios | Autogestão e administradoras pequenas | **Móra: IA gratuita no WhatsApp** (regras/regimento) | "A partir de R$ 139" |
| **Condomob** | >6 mil | Controle de acesso, social, financeiro | Sem IA generativa | Sob consulta |
| **MyCond** | >3 mil; recebeu a base da NokNox | Régua de cobrança | WhatsApp para cobrança | A partir de R$ 799/ano |

Fontes: [Superlógica](https://superlogica.com/condominios/), [Exame](https://exame.com/mercado-imobiliario/presente-em-108-mil-imoveis-superlogica-quer-ser-a-rede-social-dos-condominios/), [SíndicoNet — Nexus](https://www.sindiconet.com.br/informese/superlogica-nexus-inteligencia-artificial-noticias-administracao), [SíndicoNet — chatbot](https://www.sindiconet.com.br/informese/superlogica-chatbot-administradoras-de-condominios-noticias-administracao), [Gruvi](https://gruvi.app/), [uCondo Móra](https://www.ucondo.com.br/ia-mora), [guia Condominizando 2026](https://condominizando.com.br/blog/noticias-3/melhores-softwares-para-administracao-de-condominios-no-brasil-em-2026-guia-completo-22). O guia é de um concorrente (wCond) e se coloca em 1º lugar, portanto tem viés.

**Leitura.** Essas empresas competem por **administradoras** e por **financeiro**. Não são o concorrente direto de um prédio pequeno sem administradora, mas definem o que o síndico considera "normal" ter.

### 3.2 Nativos de WhatsApp para síndico (concorrência direta)

| Player | O que faz | Preço | Pontos de atenção |
|---|---|---|---|
| **[SindIA](https://www.sindia.app.br/)** | Bot no WhatsApp: dúvidas, encomendas, visitantes, reservas, comunicados. Chamados roteados (manutenção → zelador, reclamação → síndico) com protocolo e status | R$ 197/mês até 50 un.; R$ 397 até 150; mesmas funções em todos os planos | Implantação "em até 48 h". Status sim, **prazo não**. Não diz se usa API oficial. Supõe zelador/portaria |
| **[MeuVizy](https://meuvizy.com.br/)** | Bot com IA no número do condomínio; chamados com foto e status; avisos segmentados; reservas; encomendas; indicação de prestadores | A partir de R$ 149/mês por unidades; "uso ilimitado", sem setup | Não informa como o responsável é atribuído |
| **[Seu Síndico IA](https://www.seusindicoia.com/)** | IA que **lê o grupo** do condomínio, guarda memória, gera resumo diário, extrai tarefas com responsável/prioridade e dá "assistente jurídico" | Síndico R$ 99,99 (1 condomínio, só responde ao síndico); Profissional R$ 139,99 (3 condomínios, responde moradores) | Não informa se usa API oficial; ler grupos tem implicações de privacidade |
| **[MeuSíndico.IA](https://meusindico.ia.br/homepage.html)** | Quatro agentes de IA (gateway, síndico, condomínio, morador), protocolo automático, escalonamento de urgências, Kanban, preventivas | R$ 249/mês com 3 condomínios + R$ 49–79 por condomínio extra | **Conecta WhatsApp por QR Code**, ou seja, conexão não oficial. Alega ISO 27001/SOC 2 sem evidência |
| **[uCondo Móra](https://www.ucondo.com.br/ia-mora)** | FAQ de regras e regimento por IA no WhatsApp | **Grátis** | Não abre chamados; usa um número único da uCondo |
| Radar Condo | Triagem de grupos (conteúdo indexado) | — | Site fora do ar na pesquisa anterior |

Também aparecem: Gcondo (síndico profissional), Organize Meu Condomínio (assistente "Manu"), ConexCondo e Seu Condomínio (chatbots ligados ao ERP da administradora, com 2ª via de boleto e ocorrências), wCond (17 funções de IA, incluindo acordos de inadimplência).

**Leitura.** Esse grupo já entrega "morador 100% WhatsApp + painel do síndico". A diferença entre eles está em **quem atende** (bot × humano), **profundidade do acompanhamento** e **confiabilidade da conexão**. Nenhum publica:
- prazo de próximo retorno separado da previsão de solução;
- conclusão com explicação e reabertura;
- histórico auditável de quem fez o quê;
- ficha de permissões por pessoa (secretária e delegados);
- implantação presencial com apoio documental.

### 3.3 SaaS de autogestão de baixo custo

| Player | Preço | Foco | Observação |
|---|---|---|---|
| **[iSindi](https://isindi.com.br/)** | **R$ 24,90/mês por condomínio**, 30 dias grátis | Financeiro, comunicados, assembleias, avisos de vencimento por WhatsApp | Ocorrências no app, não no WhatsApp. Onboarding em 3 passos, começando pelo mês atual |
| **[HabitaOne](https://www.habitaone.com.br/precos)** | R$ 4,90/unidade/mês (mín. R$ 149); Profissional R$ 7,90 (mín. R$ 299); Administradora R$ 6,50 (mín. R$ 1.490) | Chamados, manutenção, vistorias, cotações, copiloto de IA | Cobrança por WhatsApp e boleto ainda "em breve" |

**Leitura.** Esses dois definem o **piso de preço** e a **expectativa de onboarding**: começar sozinho, sem cartão, em minutos. A TRÍADE propõe o oposto (implantação assistida), o que só se justifica se o valor percebido do serviço humano for claro.

### 3.4 Referências internacionais (o que "melhor" parece lá fora)

| Player | O que vale observar |
|---|---|
| **[Condo Control](https://www.condocontrol.com/solutions/ai/)** (Canadá/EUA) | **Caixa de entrada única com IA** (voz, texto, e-mail; anunciada como "em breve"), triagem de urgência e escalonamento. IA responde rotina **só com conteúdo aprovado** e encaminha o resto a humanos; todo texto de IA é rascunho aprovado por pessoa. SLA por prioridade nos chamados e painel de tempos de resposta anunciado. *(Correção: uma métrica de "1,7 hora útil" citada na primeira versão deste estudo não foi confirmada em fonte primária e foi retirada.)* |
| **[BuildingLink](https://buildinglink.io/blog/simplify-property-maintenance-with-buildinglink)** (EUA) | Ordens de serviço pelo app, status consultável a qualquer momento, recepção, encomendas e chaves. Avaliações no [Capterra](https://capterra.com/p/114529/BuildingLink/reviews/) citam falhas do app ao enviar pedidos, sinal de que confiabilidade pesa mais que recursos |
| **AppFolio Realm-X / Buildium Lumina / ManageCasa** | IA embutida para redigir comunicados, resumir documentos e atender moradores ([comparativo ManageCasa](https://managecasa.com/articles/best-hoa-ai-software)). Tendência: **IA como assistente do gestor**, não como substituta |
| **ComunidadFeliz** (Chile) | Comprada pela Visma em dez/2025 ([CB Insights](https://www.cbinsights.com/company/comunidadfeliz)). Foco em gastos comuns e pagamentos. A consolidação na América Latina é real |

**O que "melhor" significa, em síntese.** Os líderes internacionais competem em:
1. uma fila única com triagem;
2. tempo de resposta medido e publicado;
3. IA que ajuda o gestor a escrever e resumir;
4. autoatendimento do morador para o que é rotina.

Os itens 1, 2 e 3 já estão no DNA da especificação da TRÍADE (fila, responsável, próximo retorno, histórico). Falta transformar isso em **métrica visível e argumento comercial**.

---

## 4. Dores reais que aparecem publicamente

| Dor | Evidência | Implicação |
|---|---|---|
| App existe, mas **ninguém lê ou responde** | Reclame Aqui: "o aplicativo… não serve de nada pois ele não lê" (fev/2024); administradora trocou de plataforma de chamados por falhas técnicas (jun/2026) | O problema é **responsabilidade e prazo**, não canal. Reforça o próximo retorno e o responsável explícito |
| **Empurra-empurra** entre fornecedor do app e administração | Condomob respondeu que "não houve incidente" e repassou o caso à administração ([Reclame Aqui](https://www.reclameaqui.com.br/condomob/mural-de-avisos-nao-carrega_iwXvRqPOONStZoqs/)) | Separar suporte técnico de atendimento operacional, como os docs já preveem, e deixar claro ao morador quem responde |
| **Encerramento sem resposta** | Avaliações do uCondo na App Store (pesquisa de 07/10) | Conclusão explicada e reabertura são diferenciais |
| **Falta de transparência e comunicação** | Direcional Condomínios: ~70% dos condôminos insatisfeitos com transparência e comunicação ([OHub](https://www.ohub.com.br/ideias/insatisfacao-gestao-de-condominio/)); Pró-Síndico: 47% não aprovavam o síndico | Histórico e retorno periódico respondem diretamente a isso |
| **Conflito síndico × morador** | Águas Claras (DF) lidera ranking de conflitos ([Metrópoles](https://www.metropoles.com/distrito-federal/aguas-claras-sindicos-moradores)); moradores tratam o síndico "como empregado" | Ferramenta deve proteger o síndico: horário de atendimento, mensagem fora do expediente e registro do que foi feito. A ficha aprovada já cobre isso |
| **Instabilidade e suporte lento** | Médias de resposta no Reclame Aqui citadas para Superlógica (4 dias e 17 h), Condomob (5 dias) e Group, segundo o [guia Condominizando](https://condominizando.com.br/blog/noticias-3/melhores-softwares-para-administracao-de-condominios-no-brasil-em-2026-guia-completo-22) (fonte concorrente, com viés) | Confiabilidade e suporte rápido são diferenciais possíveis para um player pequeno e local |

---

## 5. Fatos externos que mudam decisões técnicas

### 5.1 WhatsApp: preço, regras e conexão

- **Modelo de cobrança.** Desde 01/07/2025 a cobrança é **por mensagem** de template entregue, conforme a categoria: marketing, utilidade ou autenticação ([Meta — pricing](https://developers.facebook.com/docs/whatsapp/pricing)).
- **Mudança de 01/10/2026.** Respostas livres dentro da janela de 24 h e templates de utilidade dentro da janela **passam a ser cobrados** ([Zendesk, anúncio de 10/08/2026](https://support.zendesk.com/hc/en-us/articles/11113277351322-Announcing-upcoming-changes-to-WhatsApp-Business-messaging-pricing); [SendPulse](https://sendpulse.com/blog/whatsapp-service-message-pricing)). Algumas fontes citam uma franquia de 1.000 mensagens de serviço por mês por número, mas isso não está confirmado. A página da Meta consultada ainda descreve essas mensagens como grátis: **confirmar na tabela oficial antes de orçar**.
- **Valores aproximados para o Brasil, em US$ por mensagem** ([Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026), [Hyperleap](https://hyperleap.ai/whatsapp-pricing-calculator-brazil); fontes de terceiros e divergentes): marketing ~0,0625; utilidade ~0,0068–0,008.
- **Moeda.** Desde 01/07/2026 contas brasileiras podem ser faturadas em **reais** pela Facebook Brasil. Todas as contas precisam migrar para BRL até 30/06/2027 ([Meta](https://developers.facebook.com/docs/whatsapp/pricing)).
- **Coexistência.** Um número do **app WhatsApp Business** pode ser conectado à Cloud API sem deixar de funcionar no app, com histórico sincronizado de até 6 meses ([Meta — onboarding de usuários do app](https://developers.secure.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users), [360dialog](https://docs.360dialog.com/partner/waba-management/phone-number-and-hosting/whatsapp-coexistence)). Limites: app versão 2.24.17 ou superior, vazão de 20 mensagens/s e desconexão de aparelhos acompanhantes. Uma fonte exige uso ativo do número por 7 dias antes, sem confirmação oficial. **Não serve para número de WhatsApp pessoal comum**, só para WhatsApp Business.
- **Política de IA.** Desde 15/01/2026, a Meta proíbe na API **chatbots de IA de uso geral** (ChatGPT, Perplexity etc.). **Bots de atendimento da própria empresa continuam permitidos** ([respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)). Um bot de condomínio é permitido, desde que a IA seja acessória ao atendimento.
- **Conexões não oficiais** (QR Code, bibliotecas Baileys, wwebjs, Venom) trazem risco de banimento sem recurso, quebram com atualizações e não registram consentimento de forma auditável ([SocialHub](https://www.socialhub.pro/blog/baileys-wwebjs-venom-riscos-apis-whatsapp-nao-oficiais/), [Clint](https://clint.digital/blog/riscos-whatsapp-nao-oficial-2026)). As fontes vendem API oficial e têm interesse, mas o risco é amplamente reconhecido.
- **Provedores (BSPs).** Há dois modelos: taxa por mensagem sobre o preço da Meta (por exemplo, Twilio, cerca de +US$ 0,005/msg) ou mensalidade fixa (por exemplo, 360dialog). Fontes indicam que o ponto de equilíbrio fica perto de 10 mil mensagens por mês. Integradores nacionais (Blip, Zenvia) são mais caros e consultivos ([Aurora Inbox](https://www.aurorainbox.com/pt/2026/05/23/comparacao-dos-fornecedores-da-api-do-whatsapp-business-ate-2026/)).
- **WhatsApp Flows.** São formulários estruturados dentro da conversa e servem para abrir chamados com campos validados, como unidade, local e categoria ([Zenvia](https://zenvia.com/blog/whatsapp-flows/)). Podem reduzir mensagens de ida e volta.

**Exemplo de custo de mensagens (ordem de grandeza, não orçamento).** Hipóteses: prédio de 40 unidades, 30 pedidos/mês com ~5 mensagens de saída cada, 2 avisos ao síndico por pedido e 4 comunicados/mês para todas as unidades. Isso dá cerca de 370 mensagens/mês.
- Se todas forem cobradas como utilidade (cerca de US$ 0,007): aproximadamente **US$ 2,6/mês**.
- Se os comunicados gerais forem classificados como **marketing** (cerca de US$ 0,0625): o total sobe para aproximadamente **US$ 11/mês**.

Em reais, depende do câmbio. Em prédio pequeno com preço na faixa de R$ 150, isso pode ir de pouco relevante a algo como 10% ou mais da receita. **Duas decisões pesam mais que o volume:**
1. Como os comunicados serão classificados pela Meta (utilidade × marketing).
2. Se cada condomínio terá número próprio, o que pode multiplicar franquias, se elas existirem, e também custos fixos de BSP.

### 5.2 Legislação e privacidade

- **Portaria virtual no DF liberada.** O STF julgou inconstitucional a Lei Distrital 7.686/2025, que proibia portaria virtual em condomínios com mais de 45 unidades e exigia seguro específico. Decisão unânime na ADI 7836, concluída em 11/05/2026 ([Correio Braziliense](https://blogs.correiobraziliense.com.br/capital-sa/2026/05/11/stf-derruba-lei-do-df-que-restringia-portarias-virtuais-em-condominios/amp/), [Dizer o Direito](https://www.dizerodireito.com.br/2026/06/lei-estadual-ou-distrital-pode-proibir.html)).
- **LGPD.** Colunas especializadas tratam o **síndico** (representando o condomínio) como responsável pelo tratamento dos dados dos moradores. Administradoras e plataformas atuam por ele ([SíndicoNet](https://www.sindiconet.com.br/informese/perguntas-e-respostas-sobre-a-lgpd-em-condominios-colunistas-fernando-augusto-zito)). Isso indica que a TRÍADE provavelmente será **operadora** dos dados do condomínio e **controladora** dos próprios dados de clientes, o que precisa de contrato e termo de tratamento. É inferência; a proposta R1–R7 já pede avaliação profissional. Não foi encontrada orientação da ANPD específica para condomínios; existe o regulamento de agentes de tratamento de pequeno porte, a verificar.

---

## 6. Onde a TRÍADE pode ser melhor (e onde não deve competir)

### 6.1 Espaços com pouca concorrência

| Diferencial | Por que é espaço livre | Já está nos documentos? |
|---|---|---|
| **Prestação de contas do atendimento**: próximo retorno obrigatório, previsão só quando conhecida, conclusão explicada, reabertura, histórico com autoria | Nenhum player brasileiro pesquisado publica isso; lá fora, tempo de resposta é argumento de venda | Sim (núcleo do MVP). **Falta transformar em métrica e mensagem comercial** |
| **Implantação presencial em Brasília + apoio documental** (regras, regimento, atas) | Concorrentes vendem "48 h" e "10 minutos", sem cuidar da organização do prédio | Sim (serviço). Falta preço e capacidade |
| **Ficha por condomínio** com pessoas, permissões individuais, secretária, horários e mensagem fora do expediente | Concorrentes falam em "painel do síndico"; poucos tratam delegação e proteção do síndico | Sim (aprovado). Responde à dor de conflito e sobrecarga |
| **Atendimento humano opcional** (equipe do condomínio ou TRÍADE contratada) | Bots prometem "24 h com IA"; poucos oferecem humano local como alternativa | Sim. Precisa de pacote e preço |
| **Confiabilidade**: API oficial, fila durável, falha de envio visível, sem duplicidade | Concorrentes baratos usam QR Code | Sim (R2). Pode virar argumento: "seu número não cai" |

### 6.2 Onde **não** competir agora

- **IA de perguntas frequentes como produto pago.** Já é gratuita (Móra). Faz sentido como recurso da base no futuro, respondendo só com documentos aprovados.
- **Financeiro, boletos e cobrança.** Mercado dominado por Superlógica, Group, iSindi e MyCond. Os docs já colocam isso como evolução opcional, e a pesquisa confirma.
- **Portaria, acesso e encomendas.** Ecossistema de hardware (Condomob, Gruvi, Winker, Nextin). Fica para depois, possivelmente via parceria. A decisão do STF torna o DF mais aberto a isso.
- **Ler grupos de WhatsApp** (como o Seu Síndico IA). Tem risco de privacidade e de política da Meta, e contraria a escolha de canal institucional.

---

## 7. Implicações práticas antes de começar a codar

1. **Arquitetura de WhatsApp antes do código de atendimento.**
   - Decidir entre Cloud API direta ou via BSP.
   - Decidir entre número por condomínio (com coexistência) ou número compartilhado da TRÍADE com roteamento por condomínio.
   - Definir a classificação de templates (utilidade × marketing) para comunicados.
   - Confirmar a tabela oficial da Meta de outubro de 2026 em BRL.
   - Isso alimenta a decisão aberta sobre o número institucional, hoje em "proposta".
2. **Desenhar o modelo de custo por condomínio** (mensagens, BSP, hospedagem, horas de implantação) antes de fixar preço. Use a faixa de mercado (R$ 25–400) como referência, não como alvo.
3. **Tornar a promessa mensurável desde o MVP.** Registrar automaticamente o tempo até o primeiro retorno e o cumprimento do próximo retorno por condomínio. Os indicadores já listados em `produto.md` vão nessa direção.
4. **Usar IA só como assistente**, como já recomendado nos documentos: classificar pedido, sugerir rascunho de resposta e resumir histórico, sempre com confirmação humana. Evitar promessa de "atendimento 24 h por IA".
5. **WhatsApp Flows** para o pedido estruturado (unidade, local, categoria, foto) reduz ambiguidade e custo de mensagens.
6. **Conversas com síndicos reais em Brasília.** A decisão vigente é testar depois do MVP, e isso continua sendo escolha de vocês. Como reforço de baixo custo, 5 a 10 conversas curtas antes de fechar o preço reduziriam o risco de construir algo que concorre com um produto grátis.

---

## 8. Limites deste estudo

- Nenhum produto foi testado, contratado ou contatado. Preços e recursos são **anúncios** consultados em 15/10/2026 e mudam com frequência.
- Os números de mercado vêm de fontes privadas e divergentes. Não há número oficial do DF.
- As regras de preço do WhatsApp de outubro de 2026 vêm de parceiros oficiais da Meta, e a página pública da Meta consultada não as reflete: **verificar antes de orçar**.
- A pesquisa de 07–08/10 (`outputs/triade-condo/pesquisa/`) continua válida como base. Este estudo atualiza preços, acrescenta concorrentes novos (Gruvi, MeuSíndico.IA, Móra, wCond, MyCond) e traz fatos externos que ela não cobria (custo do WhatsApp, coexistência, política de IA, decisão do STF).
