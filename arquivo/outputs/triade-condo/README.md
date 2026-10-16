# TRÍADE Condo

## Esclarecimento posterior aprovado

Atendimento humano WhatsApp é opcional: equipe do condomínio ou TRÍADE contratada separadamente da plataforma; ficha guarda modelo/responsáveis/horários/histórico. Número exclusivo por condomínio permanece proposta, não requisito confirmado. Este esclarecimento prevalece sobre descrições anteriores; não aprova provedor, preços, cobertura ou demais recomendações.


## Assessoria atual e terminologia confirmadas — 08/10/2026
Este esclarecimento prevalece sobre o enquadramento anterior: a assessoria da oferta atual concentra-se na **implantação de novo condomínio cliente** (prédio/condomínio que contrata o sistema), com demonstração e orientação passo a passo em reunião/assembleia acordada, e na **integração/orientação de novo morador em condomínio já cliente**, reduzindo trabalho do síndico. “Novo cliente” significa condomínio, não morador. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade.

Na orientação do novo morador, explicar regras existentes aprovadas/fornecidas pelo cliente, mostrar uso do WhatsApp e funcionamento do sistema e realizar cadastro breve com nome, telefone e apartamento. Não inventar regras nem substituir documentos do prédio. CPF é possibilidade condicional à necessidade do módulo financeiro, não obrigatório para funções básicas; sem coleta real agora ou interpretação de regra legal. Preço/pacote, frequência, capacidade, responsáveis e presencial versus remoto para novos moradores continuam a definir.

Assessoria operacional recorrente (triagem, vistoria, acompanhamento/manutenção) permanece apenas hipótese opcional futura, claramente distinta, sem inclusão automática na oferta atual. Descrições anteriores desse modelo não significam serviço vigente ou obrigação de execução. Preservar Brasília/DF, morador exclusivamente WhatsApp, número institucional próprio como pré-requisito, síndico painel web e avisos no WhatsApp dele, módulos independentes e MVP focado. Apenas materiais atualizados; sem pesquisa, contato, contratação ou implementação.


Protótipo inicial e documentação de produto. Todos os nomes, valores e registros são fictícios.

## Abrir
Na pasta `outputs/triade-condo/prototype`, executar `python3 -m http.server 8765 --bind 127.0.0.1` e abrir http://127.0.0.1:8765. Módulos JavaScript precisam desse servidor local.

## Roteiro de revisão
1. Operação: abrir chamado, observar prazos separados e registrar retorno simulado.
2. Síndico: entrar na fila de decisões, aprovar ou devolver com justificativa.
3. Operação: registrar conclusão e evidência textual, revisar e concluir; reabrir se necessário.
4. Simular WhatsApp: preencher condomínio/local/categoria e observar protocolo na fila.
5. Trocar condomínio e conferir filtros de atrasos e reincidências.

Alterações duram somente nesta sessão da página. Evidências são referências textuais fictícias, sem upload. Perfis e filtros são simulações sem autenticação. Nenhuma comunicação sai do navegador. O protótipo não serve para operação real.

Arquivos: `docs/produto.md`, `docs/arquitetura.md`, `prototype/js/data.js`, `prototype/js/domain.js`, `prototype/js/app.js` e `prototype/css/style.css`.

## Próximos passos
Validar o fluxo com Gabriela e 3–5 síndicos; definir horário humano, emergências e critérios de encerramento; priorizar ajustes; implementar autenticação, API e isolamento; testar integração em ambiente de testes; preparar piloto com contrato e privacidade revisados profissionalmente.

## Gestão da construção — 05/10/2026
Um painel separado acompanha tudo que precisamos fazer e codificar, sem alterar o protótipo operacional. Catálogo inicial: 74 tarefas, 7 fases e 16 frentes; busca, filtros, dependências, critérios, responsáveis, edição e cópias de registros locais.

Servir esta pasta inteira com `python3 -m http.server 8766 --bind 127.0.0.1`:
- Construção: http://127.0.0.1:8766/construcao/
- Protótipo: http://127.0.0.1:8766/prototype/

Documentos: `docs/plano-execucao.md`, `docs/guia-painel-construcao.md` e `docs/validacao-construcao.md`. Persistência apenas no navegador; exportar para guardar uma cópia. Nenhuma conta conectada ou publicação realizada. Validação visual do novo painel segue pendente por indisponibilidade de navegador automatizado.

## Definição registrada — 07/10/2026
Serviço humano TRÍADE é adicional opcional. Plataforma deve permitir ao síndico executar triagem, acompanhamento, checagem de evidências e revisão de conclusão, sem equipe TRÍADE obrigatória. Produto, arquitetura, plano e catálogo sincronizados; 80 tarefas com filtro de aplicação. Os 74 IDs e armazenamento versão 1 foram preservados. Nenhum backend/integração implementado nesta revisão. Protótipo anterior preservado; jornada completa do síndico será ajustada e testada nas tarefas futuras.

## Caminho de descoberta escolhido — 07/10/2026
Não há síndico/condomínio inicial disponível. A descoberta inicial usa ofertas concorrentes e relatos públicos na web para formular hipóteses de necessidade, público, oferta e venda. Isso não valida demanda ou disposição a pagar. Não exigir entrevistas prévias. Depois definir e desenvolver MVP focado e oferecê-lo a alguns síndicos para teste. Testes com síndicos vêm após o MVP. Nenhuma pesquisa extensa ou implementação foi executada nesta atualização.

## Pesquisa pública realizada — 07/10/2026
[Relatório de descoberta](docs/pesquisa-publica-2026-10-07.md) e [síntese comercial](docs/sintese-comercial-2026-10-07.md) disponíveis na pasta docs. Pesquisa exploratória realizada após os registros de escopo; hipóteses de oferta/recorte ainda precisam de discussão. Não aprova MVP, valida compradores ou autoriza implementação.

## Comparação de cenários e SaaS — 07/10/2026
[HTML local para leitura guiada](pesquisa/comparativo-cenarios-saas-2026-10-07.html), [planilha Excel](pesquisa/comparativo-cenarios-saas-2026-10-07.xlsx) e [síntese](pesquisa/sintese-cenarios-saas-2026-10-07.md). O HTML abre diretamente como arquivo, com dados/estilo embutidos, roteiro, filtros e detalhes. As marcas e fontes da pesquisa são públicas reais; as propostas TRÍADE continuam hipóteses. Os dados fictícios mencionados no início deste documento pertencem ao protótipo.

Três cenários, 42 combinações de oferta/cenário, 15 referências comerciais e uma matriz de 12 funcionalidades. Cenário sem porteiro explicita benefício, executor e dependência por recurso. Planilha revisada por renderização e estrutura; HTML verificado por consistência integral dos dados e lógica em DOM simulado. A abertura visual do HTML não foi verificada: o navegador integrado bloqueia arquivos file://. Nenhum MVP, catálogo ou estado salvo foi alterado nesta entrega.

## Contexto e canais ajustados — 07/10/2026
Revisão do comparativo em 07/10/2026: C01 confirmado como prédio simples sem operação de portaria, com porta/elevador/apartamentos; visitas e entregas diretamente com moradores. Encomendas/visitantes fora do recorte inicial, apenas referência/evolução se necessidade concreta surgir. Organizar manutenção conforme atores/procedimentos existentes, com possível referência a atas/regras/acordos/contratos; registro opcional, sem ata ou nova burocracia obrigatória. Visão de evolução para prédio simples a condomínio grande, com ou sem portaria, com recursos adequados ao contexto; forma de disponibilizar pendente, sem pacotes/preço/arquitetura definidos. Morador 100% WhatsApp em todos os cenários; síndico painel web + avisos WhatsApp de novo chamado/reclamação/solicitação e novidades pertinentes. Requisito futuro; mapear eventos, destinatários por vínculo, entrega/falha/duplicidade, sem decisões no WhatsApp presumidas. Sete critérios existentes atualizados; 80 IDs/status/registros e humano opcional preservados. Sem pesquisa nova, implementação ou publicação.

## Atividades e módulos opcionais — 07/10/2026
Decisão de produto: atividades/módulos devem poder ser usados de forma independente, com pouca burocracia e ativação opcional pelo síndico. Compartilhar dados e relacionar atividades quando útil não cria dependência comercial nem percurso compulsório entre funções. Orçamento não exige pagamento/financeiro; chamados, evidências, checagem e reabertura não exigem financeiro ou cobrança. Usar orçamento ou outro módulo independente não obriga criar chamado, evidência ou checagem. Preservar vínculos essenciais de registro, identidade, autorização e coerência quando necessários, como uma evidência pertencente ao caso correto.

Controle financeiro e cobrança mensal do condomínio por boleto entram como possibilidades opcionais de evolução, que o síndico pode usar ou não. Não estão aprovados para MVP nem implementados. Provedor, fluxo de boleto, ativação e eventuais integrações serão pesquisados/desenhados futuramente; nenhuma pesquisa extra ou movimentação financeira nesta revisão. Não interpretar a visão ampla como suíte obrigatória ou escolher pacotes, preços ou arquitetura definitivos. Morador permanece exclusivamente WhatsApp; síndico com painel web e avisos WhatsApp. MVP focado e assessoria humana opcional permanecem.

## Armário de encomendas: hipótese após os primeiros clientes — 07/10/2026
A usuária decidiu adiar a idealização detalhada e a implantação de armário de encomendas para uma fase de ampliação futura, após os primeiros clientes. Fica fora do MVP, sem escopo aprovado. Hipótese discutida: locação a prédios/condomínios com sistema, manutenção/suporte e notificações ao morador via WhatsApp; viabilidade comercial ainda não confirmada.

Somente depois de haver clientes, avaliar no local necessidade, espaço e acesso do entregador, possibilidade externa/área separada/hall com integração, depósito, guarda, retirada individual e rastreabilidade, exceções e suporte, custos e responsabilidades. Não prometer ausência de extravio nem integração disponível. Não iniciar desenvolvimento, compra, parceria ou instalação. Esta decisão não cria operação de portaria no prédio simples, não torna o módulo obrigatório e preserva morador exclusivamente WhatsApp, síndico com painel/avisos WhatsApp, módulos opcionais e assessoria humana opcional. Registro apenas; sem pesquisa nova.

## WhatsApp institucional como pré-requisito de adesão — 08/10/2026
Para adquirir/usar a TRÍADE, o prédio ou condomínio deve ter WhatsApp próprio, com número institucional do prédio/condomínio. Se ainda não houver, providenciar esse número é pré-requisito da adesão. Não usar automaticamente WhatsApp pessoal do síndico como canal institucional e não inventar exceções ou burocracia adicional. Morador continua 100% WhatsApp, pelo canal institucional; síndico mantém painel web de gestão e recebe notificações no WhatsApp dele.

É requisito comercial e de jornada confirmado, não integração entregue. Viabilidade técnica do número para futura integração permanece a verificar. Provedor, tipo de conta/API, custos e migração não foram escolhidos. Não criar número/conta, pesquisar ou implementar nesta atualização. As demais decisões permanecem.

## Foco inicial Brasília/DF e entrada assistida — 08/10/2026
Foco inicial de atendimento escolhido pela usuária: Brasília/Distrito Federal. É definição comercial de atuação, sem demanda ou comprador validados. Ofertar implantação assistida como diferencial proposto: equipe vai a reunião/assembleia acordada com o cliente, demonstra o sistema e orienta passo a passo. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade competitiva.

Ofertar suporte de entrada de novos moradores, orientando uso do WhatsApp e funcionamento do serviço, com preparação/cadastro assistido conforme requisitos a detalhar. Não é registro de visitante ou aviso automático de chegada. Implantação/treinamento e suporte de entrada são distintos de assessoria operacional humana opcional, como triagem/vistoria. Preço/pacote, frequência, capacidade e responsáveis continuam a definir; presencial versus remoto para novos moradores também permanece aberto. Sem assumir contratação ou serviços ilimitados.

Preservar morador 100% WhatsApp, número institucional próprio do prédio como pré-requisito de adesão, síndico com painel web e notificações no WhatsApp dele. Esta revisão só registra materiais: sem pesquisa adicional, contratação, contato, agenda ou implementação.

## Apoio documental na implantação — 08/10/2026
A consultoria/assessoria de implantação de novo condomínio cliente inclui como diferencial proposto apoio à documentação do condomínio: atas, regras e documentos pertinentes. Se inexistentes, ajudar a desenvolver; se existentes, revisar e propor ajustes quando necessários. Não afirmar exclusividade de mercado. Apoio de redação/organização e propostas de ajuste são distintos da aprovação das regras pelo condomínio. Atas devem refletir reuniões e decisões efetivamente ocorridas, sem fabricar atas retroativas ou decisões. Não apresentar o apoio como regularização automática ou assessoria jurídica já contratada.

Documentos abrangidos, responsáveis, revisão profissional quando aplicável e preço/pacote continuam a definir. Documentação não se torna requisito compulsório para todos os módulos nem burocracia obrigatória por chamado. Orientar moradores pelas regras fornecidas/aprovadas pelo cliente, sem substituir documentos. Preservar implantação de novo condomínio cliente versus integração/orientação de novo morador em condomínio já cliente, cadastro breve nome/telefone/apartamento e CPF condicional à necessidade financeira, Brasília/DF, WhatsApp institucional e síndico painel/avisos. Apenas registro; nenhum documento real criado para cliente inexistente, pesquisa, contato ou implementação.

## Estrutura inicial de disponibilização por planos — 08/10/2026
A usuária decidiu criar níveis/planos de disponibilização de funcionalidades. A tabela descreve a estrutura inicial da oferta, sem nomes comerciais, preços ou composição final aprovados.

| Nível proposto (descrição, não nome comercial) | Direção de recursos | Fronteiras a definir |
| --- | --- | --- |
| Básico | Atendimento e controle | Recursos exatos, limites, nome e preço |
| Ampliação | Nível que inclua coordenação e agenda; adquirir mais funcionalidades conforme plano | Composição e limites; coordenação não implica equipe TRÍADE executar manutenção |
| Serviços associados e evolução | Implantação de novo condomínio cliente, integração/orientação de novo morador em condomínio já cliente e apoio documental | Inclusão em cada plano, preço/pacote, frequência e capacidade ainda a definir; financeiro/boleto seguem evolução a decidir, armário após primeiros clientes |

Plano define acesso comercial aos recursos, não dependências artificiais no fluxo. Funções continuam opcionais/autônomas dentro dos recursos disponibilizados: orçamento não exige pagamento e chamados não exigem financeiro. Compartilhar dados quando útil preserva vínculos essenciais de identidade, autorização e coerência, sem percurso compulsório. A decisão atual esclarece a pendência anterior de como disponibilizar recursos; composição final e arquitetura seguem abertas. Preservar cenários variados, Brasília/DF, número institucional próprio de WhatsApp como pré-requisito, morador 100% WhatsApp, síndico painel/avisos WhatsApp e assessoria atual de implantação/orientação. Apenas registros, sem pesquisa, preços inventados, MVP, divulgação ou contratação.

## Dois painéis atualizados — 08/10/2026

[Informativo produto/arquitetura](pesquisa/comparativo-cenarios-saas-2026-10-07.html) e [execução desenvolvedor](construcao/index.html). Direção atual separada da pesquisa histórica; 21 tarefas MVP atuais e 80 anteriores preservadas. [Protocolo de atualização e compartilhamento](docs/guia-painel-construcao.md): trabalho → evidência → revisão → conclusão. Registros locais/exportação/mesclagem, sem backend ou sincronia de equipe. Produto não codado nesta atualização.
