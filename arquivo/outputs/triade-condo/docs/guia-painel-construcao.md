# Atualização vigente dos painéis

O fluxo abaixo prevalece sobre instruções históricas (inclusive substituição de importação e escopo não aprovado).

## Fluxo vigente dos dois painéis — 08/10/2026

- [Painel informativo](../pesquisa/comparativo-cenarios-saas-2026-10-07.html): direção atual na abertura; demais seções preservam pesquisa histórica.
- [Painel execução](../construcao/index.html): filtrar “MVP aprovado” para 21 tarefas atuais (3 entregas de planejamento e 18 tarefas ainda não iniciadas). 80 tarefas anteriores preservadas no filtro histórico; registros locais com os mesmos IDs continuam recuperáveis.
- [Especificação atual](../../../estruturação%20do%20sistema/especificacao-mvp.md) orienta critérios; [próximas etapas](../../../estruturação%20do%20sistema/proximas-etapas.md) não amplia MVP.

Protocolo proposto ao desenvolvedor: abrir tarefa e conferir pré-requisitos → registrar responsável/data e início → atualizar notas/bloqueios e trabalho feito → indicar evidências reais (caminho, commit, teste/resultado) → Em revisão → Concluída somente com evidência e dependências concluídas. “A fazer” equivale a planejado; não afirmar implementação a partir de plano ou protótipo. O painel não verifica a existência/veracidade da evidência, não executa trabalho e não impõe a rotina a ferramentas externas.

Fonte base versionável: construcao/catalogo.json e construcao/js/catalog.js precisam permanecer iguais. Registros de trabalho: JSON exportado do painel, separado da base. Compartilhar/versionar essa cópia no repositório pelo responsável, após revisão, por exemplo em registros-execucao/ com data no nome (pasta não criada com evidência fictícia). Notas do navegador não atualizam arquivos automaticamente.

Exportar backup antes de importar e ao final de cada sessão. Importação valida antes de salvar e MESCLA: preserva registros locais, soma tarefas novas e histórico; conflitos em uma tarefa mantêm estado local e alternativa importada no histórico. IDs de tarefas adicionais diferentes com mesmo ID recusam importação inteira sem alterar dados; reconciliar na cópia mantendo backup. Não há sincronia de equipe, trava colaborativa ou comparação automática de commits. Usar uma pessoa/aba para edição e revisar conflitos antes de redistribuir exportação. Histórico anterior à atualização não pode ser reconstruído; painel guarda apenas alterações registradas daqui em diante.

Estados: A fazer/planejado, Em andamento, Bloqueada (anotar impedimento/decisão), Em revisão e Concluída. Data desejada não é compromisso; última alteração é data de registro. Dados antigos/exports versão 1 continuam aceitos sem histórico, preservando chave triade-construcao-v1. A aparência no navegador não foi verificada devido restrição de arquivos locais; não houve contorno por servidor.

---

## Material anterior preservado

# Como usar o painel da construção

## Dois painéis diferentes
- **Construção:** planejamento e progresso do projeto TRÍADE Condo. Possui tarefas reais de desenvolvimento e preparação do serviço; base de 05/10/2026.
- **Protótipo operacional:** demonstra atendimento de condomínio usando dados fictícios em memória; cenário fixo de 03/10/2026. Continua preservado, sem integração real.

## Acesso local
Com o servidor local ativo, abrir http://127.0.0.1:8766/construcao/. O protótipo está em http://127.0.0.1:8766/prototype/.

Para iniciar novamente: na pasta `outputs/triade-condo`, executar `python3 -m http.server 8766 --bind 127.0.0.1`. O servidor entrega arquivos somente neste computador e precisa permanecer aberto. Em caso de porta ocupada, usar outra porta e lembrar que a persistência do navegador pertence ao endereço original.

O arquivo `construcao/index.html` também usa scripts locais sem dependências ou módulos; pode ser aberto diretamente se o navegador permitir. O comportamento do armazenamento em arquivos locais varia. Preferir o endereço do servidor para manter a mesma origem. O protótipo operacional usa módulos e precisa do servidor.

## Revisar e atualizar
1. Começar em Visão geral; clicar numa fase para ver suas tarefas.
2. Usar busca e filtros por fase, frente, status, prioridade e classificação da base. Filtros são combinados. Trocar visão limpa os filtros.
3. Em Decisões pendentes, registrar escolhas de escopo, stack, WhatsApp, privacidade e operação. Não há valores ou datas assumidos.
4. Em Próximas ações, ver tarefas A fazer sem dependências pendentes; essa visão indica ordem possível, não autorização automática.
5. Abrir tarefa para conferir critério, dependências e base original. Atualizar status, prioridade, responsável, data desejada opcional, notas e evidência.
6. Salvar. A tarefa só pode ser concluída com evidência textual e dependências concluídas. Se uma dependência for reaberta, a conclusão anterior permanece visível com aviso para revisão.
7. Usar Nova tarefa para adicionar trabalho descoberto. Informar fase, frente, tipo, prioridade, critérios e IDs de dependências. Dependências desconhecidas e circulares são recusadas.
8. Exportar registros periodicamente; importar uma cópia validada quando precisar recuperar ou transferir o acompanhamento. A confirmação da importação substitui o registro local; exporte antes.

## Significado dos estados
A fazer: ainda não iniciado. Em andamento: execução começou. Bloqueada: impedimento descrito nas notas. Em revisão: execução aguarda conferência. Concluída: há evidência registrada e pré-requisitos concluídos. O painel não comprova a veracidade da evidência nem executa código futuro.

Base original é imutável e independente do acompanhamento: Documentado = artefato informativo; Simulado = demonstração com dados fictícios; Implementado localmente = ferramenta local utilizável; Pendente = trabalho futuro. As seis conclusões iniciais representam documentos, demonstração e ferramenta local — não a prontidão do produto real. A revisão visual do novo painel está em BASE-07, ainda pendente.

## Persistência e limites
- Usa localStorage no navegador, sem banco, login ou sincronização entre dispositivos. Navegador, perfil, protocolo, host ou porta diferente geram outro armazenamento.
- Limpar dados do navegador pode apagar o acompanhamento. O armazenamento tem limites e pode estar bloqueado em perfis privados ou configurações restritas. Se salvar falhar, o painel informa que a alteração não foi aplicada.
- Uma falha ao carregar dados não apaga o registro antigo. A recuperação usa importação de cópia válida. O JSON de exportação contém alterações e tarefas adicionais; depende da versão 1 do catálogo entregue.
- Importação aceita arquivos de até 5 MB; valida versão, campos, IDs e dependências antes da substituição. Não faz mesclagem automática. Não importamos arquivos enviados por terceiros nesta entrega.
- Alterações em outra aba da mesma origem atualizam o painel, mas não há trava ou resolução colaborativa de conflitos. Usar uma aba de edição por vez.
- Não guardar credenciais, dados pessoais de moradores ou evidências reais de atendimento aqui. Este painel é para acompanhar trabalho do projeto.
- Status e notas não atualizam automaticamente os documentos Markdown. Reconciliar decisões e mudanças de escopo na rotina GOV-01. Os critérios/dependências da base são mantidos em `catalogo.json` e `js/catalog.js`; atualizar esses arquivos quando o plano-base mudar. Novas tarefas podem ser adicionadas pelo painel.

## Reunião de acompanhamento sugerida
Revisar decisões, bloqueios e evidências; escolher as próximas ações; nomear responsáveis e capacidade; atualizar datas somente quando acordadas; exportar uma cópia ao final. Não há automação de lembretes criada.

## Revisão de modelos — 07/10/2026
Catálogo atualizado para 80 tarefas. Os 74 IDs anteriores, chave e versão de armazenamento permanecem iguais; seis pendências foram acrescentadas. A classificação Aplicação distingue plataforma/ambos os modelos de adicional humano opcional. Tarefas locais antigas aparecem como A classificar até revisão; não são removidas. Use o novo filtro para revisar cada frente. A visão geral reúne todo o projeto, inclusive o opcional; seus totais não significam exigência de contratar equipe.

Critérios e dependências de tarefas existentes foram revisados. Status, notas, responsáveis, prioridades, datas e evidências locais permanecem; o detalhe avisa quando o critério mudou. Conferir manualmente conclusões antigas antes de usá-las como validação do novo modelo. Nenhum acesso a registros reais do navegador foi realizado nesta atualização. O protótipo operacional antigo permanece preservado e ainda não demonstra o síndico executando toda a rotina.

Prioridade atual: descoberta comercial antes do MVP. Todas as tarefas técnicas permanecem hipóteses de backlog. A visão Próximas ações aponta dependências registradas, sem autorizar execução ou validar oferta.

## Caminho de descoberta escolhido — 07/10/2026
Não há síndico/condomínio inicial disponível. A descoberta inicial usa ofertas concorrentes e relatos públicos na web para formular hipóteses de necessidade, público, oferta e venda. Isso não valida demanda ou disposição a pagar. Não exigir entrevistas prévias. Depois definir e desenvolver MVP focado e oferecê-lo a alguns síndicos para teste. Testes com síndicos vêm após o MVP. Nenhuma pesquisa extensa ou implementação foi executada nesta atualização.

## Cenários de portaria registrados em 07/10/2026
PROD-01/03: pesquisar presencial/atendente, online/remota e sem portaria, inclusive prédios com pouca estrutura. DEC-06, SERV-05/06, TIC-02, VIS-01, EVI-01, END-01 e WA-04: revisar responsáveis, acesso, vistoria, evidência, revisão e comunicação sem presumir equipe. PROD-02/05: escolher recorte após pesquisa, sem incluir automaticamente todos os cenários no MVP. Mesmos 80 IDs e mesma chave/versão de armazenamento; nenhum registro local reescrito.

## Sessões de execução por tarefa

Iniciar sessão registra data/horário atual do navegador. Finalizar exige breve resumo do executor; não conclui nem aceita tarefa. Retomada cria nova sessão. Histórico mostra início/fim/resumo em horário local legível; tarefas antigas sem registro continuam sem horário. Ajuste manual exige motivo e mantém versão anterior no histórico. Esses horários não comprovam trabalho e dependem do relógio local.

Sessões integram o JSON de exportação, validação e mesclagem. Mesmo ID com versões diferentes mantém local e guarda alternativa no histórico; duas sessões abertas distintas em conflito guardam a importada no histórico para reconciliação, sem criar duas sessões abertas na tarefa. Manter backup e revisar antes de compartilhar.

## Correções e registro da auditoria

[Relatório](../../../estruturação%20do%20sistema/relatorio-revisao-desenvolvimento.md). 109 tarefas: 80 históricas, 21 MVP e 8 auditoria. REV-01 é revisão assistida, sem produto; AUD-02 a AUD-08 são decisões/validações pendentes. Base permanece planejada; importar registro da auditoria é opcional.

Em erro de leitura, “Baixar original local” preserva conteúdo bruto; exportar também oferece o original, não um estado vazio enganoso. Recuperação por importação só substitui o inválido após backup local verificado. Mapa/protótipo também preservam originais inválidos. Backup anterior em outputs/entregas/revisao-2026-10-08, separado do pacote vigente. Se armazenamento está inacessível ou cheio, não promete recuperação: exportar original quando legível e resolver bloqueio antes de importar/restaurar.
