from pathlib import Path
import json
root=Path.cwd();out=root/'estruturação do sistema'
files={
'README.md':'''# Estruturação do sistema TRÍADE Condo

Planejamento revisável de 08/10/2026. Esta pasta pertence à raiz do projeto. Nenhum produto, autenticação ou integração foi implementado; não há preços definidos.

Comece pelo [HTML de revisão](planejamento-paineis.html). Depois consulte:

- [Visão e fronteiras](visao-do-sistema.md): quem acessa o quê, conjuntos e limites de configuração.
- [Painel Carolina / administradora TRÍADE](painel-carolina.md): carteira, contratação e liberações por condomínio.
- [Painel do síndico](painel-sindico.md): recursos contratados/liberados e configuração proporcional à rotina.

São dois painéis. Não planejar painel do morador neste recorte: morador usa exclusivamente WhatsApp, sem app, portal, login/senha ou recuperação de conta. A expressão anterior “painel do morador” foi corrigida para “painel do síndico”.

O HTML usa exemplos fictícios e permite editar anotações/configurações e simular conjuntos inteiros. Alterações ficam na sessão; o botão de exportar baixa uma cópia local de revisão em JSON. Não altera contratação, permissões reais ou os documentos desta pasta. Não inclui contas, banco de dados ou envio de mensagens.

Propostas/orçamentos ficam fora do desenvolvimento inicial. Pesquisa anterior preservada em [referência de cotações](../outputs/triade-condo/pesquisa/aprofundamento-cotacoes-propostas-2026-10-08.md). A comparação geral está em [HTML de pesquisa](../outputs/triade-condo/pesquisa/comparativo-cenarios-saas-2026-10-07.html).
''',
'visao-do-sistema.md':'''# Visão e fronteiras do sistema

## Direção confirmada

Carolina administra a carteira de TODOS os condomínios clientes da TRÍADE em um painel interno. Cada condomínio/cliente mantém contratação, recursos liberados, dados e responsáveis próprios. O síndico vê apenas o condomínio ao qual está autorizado e os conjuntos contratados/liberados para ele. A simulação desta pasta não implementa essas barreiras; elas são requisitos do produto futuro.

Morador exclusivamente WhatsApp institucional próprio do condomínio, requisito de adesão; nenhum painel/login do morador. O síndico usa painel e recebe avisos relevantes em seu WhatsApp. Brasília/DF permanece cobertura inicial. Provedor, conta/API, custos e integração continuam a definir.

## Dois painéis e um canal

| Perfil | Acesso planejado | Limite |
|---|---|---|
| Carolina / equipe TRÍADE autorizada | Carteira, contratação, liberações, contatos responsáveis, implantação e entregas internas | Acesso administrativo não implica leitura indiscriminada de conversas ou poder de decidir manutenção/compras pelo cliente. Alcance de suporte a validar. |
| Síndico autorizado | Recursos liberados e dados de seu condomínio; configuração dentro de limites | Sem carteira de clientes, contratação de outros prédios, notas internas TRÍADE ou autoativação de conjunto não liberado. |
| Morador | Pedidos, retorno, andamento, avisos e conteúdo autorizado pelo WhatsApp | Sem app/portal/login próprio; não acessa fila geral ou documentos administrativos restritos. |

## Contratação e liberação

Distinguir o que foi contratado do que foi liberado. Regra proposta: conjunto disponível ao síndico somente quando contratado E liberado para aquele condomínio. Carolina registra referência do acordo, conjunto e responsável pela mudança. Teste/exceção temporária, se necessário, exige política explícita a validar, sem liberar silenciosamente recursos não contratados. Não definir cobrança/preços aqui.

Conjunto é uma capacidade coerente; seus componentes internos necessários permanecem juntos:

- Atendimento completo e comunicação/documentos essenciais: receber/registrar, fila, responsável, prioridade, etapas/andamento, próximo retorno, estimativa quando disponível, conclusão, histórico, avisos e documentos vigentes. Não remover fila/responsável/prioridade/retorno ou vendê-los como upgrade. É base proposta comum, cuja composição será revisada.
- Agenda/compromissos: escolha adicional em revisão; calendário administrativo e compromissos. Próximo retorno do atendimento não depende de agenda.
- Coordenação de manutenção: escolha adicional em revisão; planejar e acompanhar executor real. Não significa TRÍADE executar reparos; mantém acompanhamento próprio se agenda não contratada.
- Comunicação/documentos ampliados: escolha adicional em revisão; campanhas e arquivo administrativo/revisões além da publicação/consulta essencial. Separar os dois ampliados ainda a decidir.

Orçamentos/propostas NÃO desenvolver agora; eventual necessidade pode usar tarefa simples existente, sem módulo disfarçado. Financeiro/boletos futuros opcionais. QR, múltiplos contatos e receptor sonoro são ideias em avaliação; armários só após primeiros clientes. Nenhum desses recursos está na simulação como conjunto inicial liberável.

## Funcional e editável sem fluxo único

Processo adequado a X não precisa ser o de Y. Troca de lâmpada, pedido de regra e limpeza são exemplos para testar a organização, nunca fluxos obrigatórios. O síndico pode ajustar responsáveis, prioridades, nomes/etapas, próximos retornos, modelos de resposta e categorias de maneira proporcional. Começar com configuração simples; detalhamento adicional somente quando necessário.

Limites propostos para revisão: responsável vinculado/autorizado; prioridades com significado explícito; etapas mantendo possibilidade de saber se está aberto, em andamento ou encerrado; retorno acompanhado mesmo sem estimativa de resolução; mudanças preservam histórico e mapeamento de registros antigos. Não exigir foto, ata, orçamento ou checklist universal. Não autorizar edição de histórico para esconder mudanças, acesso a outro condomínio ou remoção de comunicação/histórico/permissões essenciais.

A configuração altera opções dentro do recurso existente. Novo tipo de integração, novo conjunto, nova regra complexa de autorização ou nova tela é desenvolvimento futuro a avaliar. Configurabilidade não significa um construtor ilimitado de sistemas.

## Decisões para revisão conjunta

Quais pessoas da equipe TRÍADE podem ver/alterar contratação, implantação e suporte? Carolina terá acesso excepcional ao painel cliente para suporte mediante autorização e registro? Quem substitui síndico e como revogar vínculo? Quais ajustes podem ser feitos sem afetar atendimentos em andamento? Como suspender conjunto e preservar/exportar histórico? Quando separar comunicação/documentos ampliados? Autenticação dos dois painéis será planejada depois; esta pasta não cria login.
''',
'painel-carolina.md':'''# Painel Carolina / administradora TRÍADE

## Objetivo

Gerenciar todos os condomínios clientes, suas contratações e conjuntos liberados, com visão da implantação e serviços internos. Área exclusiva Carolina/equipe TRÍADE autorizada, separada do painel cliente.

## Organização proposta

1. Carteira: identificar condomínio, contato responsável, estágio do cliente, contratação e implantação. Distinguir ativo, em implantação e situações a tratar; sem inventar estados de cobrança.
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

Confirmar pessoas autorizadas por função, aprovação de mudanças de contratação, regras de suspensão/retirada sem perder histórico, acesso de suporte e aceite das entregas. Base de atendimento não pode ser reduzida em subfunções. Nenhum preço ou procedimento de cobrança definido.
''',
'painel-sindico.md':'''# Painel do síndico

## Objetivo

Disponibilizar somente os conjuntos contratados e liberados para o seu condomínio. A administração TRÍADE gerencia a liberação; síndico não acessa carteira interna, outros condomínios ou ativa conjunto por conta própria. Não há painel do morador.

## Área de trabalho proposta

- Atendimento completo: pedidos do WhatsApp, fila, responsável, prioridade, andamento, próximo retorno, estimativa conhecida, conclusão e histórico. Mostrar pendências úteis; sem fila/responsável/retorno contratados separadamente.
- Comunicados/documentos essenciais: preparar/publicar avisos e disponibilizar conteúdo vigente; morador recebe/consulta pelo WhatsApp, conforme vínculo/permissão. Manter conteúdo aprovado, sem transformar publicação básica em extra.
- Agenda, se contratada/liberada: compromissos, responsáveis e lembretes. Retorno do pedido continua na base sem agenda.
- Coordenação de manutenção, se contratada/liberada: planejar ação, indicar executor, acompanhar pendências e resultado. Não força agenda, financeiro ou orçamento; não implica TRÍADE executar reparo.
- Gestão ampliada de comunicação/documentos, se contratada/liberada: recursos além da base, com fronteira ainda a revisar. Não expor notas internas de elaboração/revisão da TRÍADE.

## Configuração simples e proporcional

| Ajuste do síndico | Proposta permitida | Limite a validar |
|---|---|---|
| Responsáveis | Designar contatos/equipe autorizados e substituir quando necessário | Vínculo correto e histórico; não convidar pessoa a outro condomínio |
| Prioridades | Definir nomes/significado e ordenar urgências | Não ocultar pendência; sem priorização automática obrigatória |
| Etapas | Ajustar nomes/etapas por tipo de demanda ou rotina | Preservar estado compreensível, histórico e registros em curso; sem fluxo universal |
| Retornos | Combinar próxima atualização e definir lembretes proporcionais | Estimativa quando disponível; ausência não vira promessa inventada |
| Conteúdo | Categorias, modelos e documentos vigentes aprovados | Destinatários/permissões corretos; sem falsificar regras/atas |
| Rotina | Usar passos simples; acrescentar detalhe apenas quando necessário | Sem foto, ata, checklist ou orçamento obrigatório para todos os casos |

Funcional e editável significa adaptar a ferramenta ao processo real. “Troca de lâmpada” é só exemplo de teste; sua sequência não define como atender dúvida, reclamação ou outro reparo. Não planejar editor ilimitado de regras complexas. Alterações futuras de etapas preservam histórico e indicam como registros existentes ficam mapeados.

## Canais e responsabilidades

Morador inicia/interage pelo WhatsApp institucional próprio do condomínio. Síndico administra no painel e recebe notificações relevantes em seu WhatsApp. O responsável pelo atendimento não precisa ser o executor do reparo. Quem decide conforme atribuições reais do condomínio; notificações não significam aprovação via WhatsApp.

O síndico fornece dados/documentos à implantação, valida conteúdo e recebe entregas compartilhadas; isso não lhe dá acesso aos controles internos da Carolina. Propostas/orçamentos fora do desenvolvimento inicial; tarefa eventual simples não implica comparar/aprovar cotações ou contratar pelo cliente.

## Construção futura

Exige desenvolvimento: painel real, identidade/permissões, dados isolados, configuração persistente com histórico, WhatsApp e notificações. A simulação desta pasta não implementa nenhum desses recursos. Revisar configurações necessárias, permissões de substitutos/equipe e fronteiras antes de definir MVP.
'''}
for name,content in files.items():(out/name).write_text(content)
html='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TRÍADE · Estruturação dos dois painéis</title><style>
:root{--ink:#193f46;--accent:#286b67;--line:#cbdedb;--muted:#53666a}*{box-sizing:border-box}body{margin:0;background:#f1f6f4;color:var(--ink);font:16px/1.5 system-ui,sans-serif}header{padding:30px max(20px,calc((100vw - 1240px)/2));background:var(--ink);color:white}h1{margin:0;font-size:30px}h2{font-size:25px}h3{font-size:20px;margin:0 0 10px}p{margin:8px 0 15px}main{max-width:1280px;margin:auto;padding:24px 20px 50px}a{color:#146075}header a{color:white}nav{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.button,button,select,input,textarea{font:inherit;border:1px solid #92b5b0;border-radius:8px;padding:10px;background:white;color:var(--ink)}button{cursor:pointer}button[aria-pressed=true]{background:var(--accent);color:white}button:disabled{cursor:default;opacity:.7}:focus-visible{outline:3px solid #b87917;outline-offset:3px}.notice{background:#fff2d7;border:1px solid #d9c298;border-radius:12px;padding:18px;margin-bottom:20px}.card{padding:20px;border:1px solid var(--line);border-radius:12px;background:white;margin:0 0 18px}.columns,.profiles{display:grid;grid-template-columns:1fr 1fr;gap:20px}.profiles>div{background:#edf5f3;border-radius:8px;padding:14px}.badge{display:inline-block;background:#e4efeb;border-radius:5px;padding:4px 8px;font-size:13px}.internal{border-top:5px solid #193f46}.client{border-top:5px solid #3d8a7f}.fields{display:grid;gap:12px}label{display:block;font-weight:600}input[type=text],textarea,select{width:100%;margin:5px 0}textarea{resize:vertical;min-height:80px}input[type=checkbox]{width:20px;height:20px;vertical-align:middle}.muted,small{color:var(--muted)}.bundle{border-top:1px solid var(--line);padding:14px 0}.bundle p{margin:5px 0;font-size:14px}.choices{display:flex;gap:15px;flex-wrap:wrap}.choices label{font-size:14px}.summary{padding:14px;background:#e9f4ee;border-radius:8px;margin:14px 0}.log{font-size:14px;padding-left:20px}.hidden{display:none}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:640px}td,th{padding:12px;border:1px solid var(--line);vertical-align:top;text-align:left}th{background:var(--ink);color:white}footer{margin-top:25px}.flow{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.flow span{background:#e6f0ed;border-radius:8px;padding:9px}ul{padding-left:22px}@media(max-width:850px){.columns,.profiles{grid-template-columns:1fr}h1{font-size:25px}}@media print{nav,button{display:none}.hidden{display:block}.columns{display:block}body{background:white}.card{break-inside:avoid}}
</style></head><body><header><h1>TRÍADE · Estruturação dos dois painéis</h1><p>Planejamento revisável para Carolina · 08/10/2026</p></header><main><div class="notice"><strong>Simulação de planejamento, com exemplos fictícios.</strong><p>Dois painéis: Carolina administra clientes e libera conjuntos; síndico usa somente o que foi contratado/liberado para seu condomínio. Não há painel do morador: ele permanece exclusivamente no WhatsApp, sem portal, app ou login próprio. Nenhum produto, autenticação, contratação real ou integração foi implementado.</p></div><nav aria-label="Visões de planejamento"><button data-tab="paineis" aria-pressed="true">Comparar os dois painéis</button><button data-tab="fronteiras" aria-pressed="false">Configuração e limites</button><button data-tab="revisao" aria-pressed="false">Anotações de revisão</button></nav>
<section id="paineis"><div class="flow" aria-label="Relação entre contratação e acesso"><span>Carolina: selecionar condomínio</span><span>→ conferir contratação</span><span>→ liberar conjunto inteiro</span><span>→ síndico: acesso daquele condomínio</span></div><div class="columns"><section class="card internal"><span class="badge">Painel 1 · área interna TRÍADE</span><h2>Carolina / administradora</h2><p>Visão da carteira inteira, serviços internos e liberações por cliente. Nenhum cliente real está listado aqui.</p><label for="condo">Condomínio fictício a revisar<select id="condo"></select></label><label for="stage">Estágio do cliente · texto de revisão<input id="stage" type="text"></label><div id="bundles"></div><div class="summary"><strong>Regra proposta:</strong> recurso disponível = contratado e liberado. A base permanece completa; seus componentes internos não são extras removíveis. A projeção ao lado não implementa permissões reais.</div><div class="profiles"><div><h3>Serviços internos</h3><p>Implantação, orientação e apoio documental; responsáveis, pendências, rascunhos e entrega. Inclusão/preço ainda a definir.</p></div><div><h3>Limite da administração</h3><p>Controle interno não é módulo cliente. Acesso aos dados do cliente para suporte precisa de política/permissão; não presume leitura irrestrita.</p></div></div><label for="adminNotes">Notas internas de planejamento<textarea id="adminNotes"></textarea></label><p class="muted">Estas notas nunca aparecem na projeção do síndico. Não inserir dados pessoais reais.</p></section><section class="card client"><span class="badge">Painel 2 · somente condomínio autorizado</span><h2>Painel do síndico</h2><p id="clientName"></p><p class="muted">Projeção dos conjuntos escolhidos na revisão. No produto futuro, o síndico não terá seletor de outros condomínios nem acesso à carteira Carolina.</p><div id="clientTools" aria-live="polite"></div><details><summary>Configuração simples da rotina · editável nesta revisão</summary><div class="fields"><label>Responsáveis propostos<input id="responsible" type="text"></label><label>Prioridades e significados<input id="priorities" type="text"></label><label>Etapas propostas<input id="steps" type="text"></label><label>Orientação sobre próximo retorno<input id="returns" type="text"></label></div><p class="muted">Campos de planejamento, não configurações de um produto existente. Atribuições e vínculos precisam ser validados; histórico/permissões essenciais não podem ser removidos.</p></details><div class="summary"><strong>Morador — WhatsApp</strong><p>Envia pedido, recebe retorno/andamento/conclusão e consulta avisos/documentos disponibilizados. Nenhum painel, senha ou recuperação de conta para o morador.</p></div></section></div></section>
<section id="fronteiras" class="hidden"><section class="card"><h2>Funcional e editável, com limites</h2><p>Processo para X não precisa ser o de Y. Troca de lâmpada é apenas um teste de uso; não define uma sequência obrigatória para dúvida, reclamação, limpeza ou outro reparo.</p><div class="table-wrap"><table><thead><tr><th>Quem ajusta</th><th>Configuração proposta</th><th>Fronteira</th></tr></thead><tbody><tr><td>Carolina</td><td>Contratação/liberação por condomínio; equipe e implantação</td><td>Conjuntos inteiros; sem remover componentes essenciais. Histórico de mudança e referência do acordo.</td></tr><tr><td>Síndico</td><td>Responsáveis, prioridades, categorias, etapas e retornos</td><td>Pessoas autorizadas; estado compreensível; preservar histórico e registros em curso; sem acesso a outro condomínio.</td></tr><tr><td>Síndico</td><td>Avisos/modelos e documentos vigentes</td><td>Conteúdo aprovado e destinatários corretos; essencial permanece na base. Sem notas internas da TRÍADE.</td></tr><tr><td>Desenvolvimento futuro</td><td>Novas integrações, conjuntos ou regras complexas</td><td>Não são mera configuração. Exigem decisão de escopo e construção, sem editor ilimitado presumido.</td></tr></tbody></table></div></section><section class="card"><h3>Base completa, rotina proporcional</h3><p>Fila, responsável, prioridade, andamento, próximo retorno, estimativa quando disponível, conclusão e histórico fazem parte do atendimento. Comunicação e documentos essenciais também. Não obrigar foto, ata, orçamento ou checklist para todas as demandas; não inventar estimativa desconhecida.</p><p>Agenda, manutenção e gestão ampliada estão em revisão. Coordenação não implica TRÍADE executar reparos. Próximo retorno não depende de agenda contratada.</p></section><section class="notice"><h3>Fora do desenvolvimento inicial</h3><p>Propostas/orçamentos não serão desenvolvidos agora. Uma pendência eventual pode usar tarefa simples existente, sem comparação/aprovação de cotações ou portal disfarçado. TRÍADE não seleciona fornecedor nem compra pelo cliente. Financeiro/boletos futuros opcionais; QR/receptor sonoro em avaliação; armários somente após primeiros clientes.</p></section><section class="card"><h3>O que ainda requer desenvolvimento</h3><p>Autenticação dos dois painéis, permissões e isolamento real dos dados; contratação/liberação persistente; histórico e mudanças de configuração; WhatsApp e notificações. A interface desta revisão não implementa essas funções.</p><p>O número institucional próprio continua requisito; Brasília/DF permanece cobertura inicial. Nenhum preço, provedor ou MVP final definido.</p></section></section>
<section id="revisao" class="hidden"><section class="card"><h2>Revisar antes de construir</h2><ul><li>Quem da equipe TRÍADE vê contratação, implantação e dados de suporte?</li><li>Como autorizar suporte no painel cliente sem compartilhar senha?</li><li>Quem substitui o síndico e como revogar vínculos?</li><li>Quais etapas/prioridades podem mudar sem afetar histórico e registros abertos?</li><li>Como retirar um conjunto preservando consulta/exportação de histórico?</li><li>Comunicação ampliada e documentos ampliados serão escolhas separadas?</li></ul><label for="reviewNotes">Decisões e ajustes para discutirmos<textarea id="reviewNotes" placeholder="Escreva aqui sugestões de revisão, sem dados reais."></textarea></label><button id="export" type="button">Exportar cópia local da revisão</button><p class="muted">Edições ficam somente nesta sessão. A exportação baixa JSON local com exemplos/configurações/notas; não salva nos documentos nem altera permissões ou clientes reais. Guarde a cópia antes de fechar se quiser preservar alterações.</p><h3>Mudanças desta sessão de revisão</h3><ol id="log" class="log"></ol></section></section><footer><a href="README.md">Índice da pasta</a> · <a href="painel-carolina.md">Planejamento Carolina</a> · <a href="painel-sindico.md">Planejamento síndico</a> · <a href="visao-do-sistema.md">Visão e fronteiras</a> · <a href="../outputs/triade-condo/pesquisa/comparativo-cenarios-saas-2026-10-07.html">Pesquisa anterior</a></footer></main><script>
'use strict';
const bundles=[{id:'base',name:'Atendimento completo + comunicação/documentos essenciais',manager:'Pedidos, fila, responsável, prioridade, andamento, retorno, estimativa disponível, conclusão/histórico; avisos e documentos vigentes.',resident:'Pedidos e acompanhamento, avisos e conteúdo autorizado pelo WhatsApp.',essential:true},{id:'agenda',name:'Agenda e compromissos · em revisão',manager:'Calendário, responsáveis, datas e acompanhamento dos compromissos.',resident:'Avisos pertinentes sobre compromissos pelo WhatsApp; sem calendário administrativo.'},{id:'maintenance',name:'Coordenação de manutenção · em revisão',manager:'Planejar ação, identificar executor, acompanhar pendências e resultado.',resident:'Relato e atualizações do pedido já na base; avisos de impacto pelo WhatsApp.'},{id:'extended',name:'Comunicação/documentos ampliados · em revisão',manager:'Campanhas e arquivo administrativo/revisões além da publicação essencial; fronteira a validar.',resident:'Conteúdo disponibilizado pelo WhatsApp; sem acesso a arquivos restritos.'}];
const planning={kind:'planejamento-revisavel',date:'2026-10-08',reviewNotes:'',clients:[{id:'EX-A',name:'Condomínio fictício A',stage:'Exemplo: implantação',contracted:['base'],released:['base'],adminNotes:'Orientação e documentos: escopo a combinar.',config:{responsible:'Síndico responsável; substituto a validar',priorities:'Rotina / urgente — critérios a combinar',steps:'Recebido / em andamento / concluído — nomes em revisão',returns:'Combinar próximo retorno; estimativa somente quando disponível'}},{id:'EX-B',name:'Condomínio fictício B',stage:'Exemplo: composição em revisão',contracted:['base','agenda','maintenance'],released:['base','agenda'],adminNotes:'Manutenção ainda não liberada neste exemplo.',config:{responsible:'Responsável do atendimento e executor podem ser distintos',priorities:'Critérios conforme rotina local',steps:'Etapas adequadas a cada tipo de demanda',returns:'Retorno do pedido independente da agenda'}}],changes:[]};
let selected='EX-A';const el=id=>document.getElementById(id);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function client(){return planning.clients.find(c=>c.id===selected)}
function available(c){return bundles.filter(b=>c.contracted.includes(b.id)&&c.released.includes(b.id))}
function record(text){planning.changes.push({client:selected,text});el('log').innerHTML=planning.changes.map(x=>'<li>'+esc(x.client+': '+x.text)+'</li>').join('')}
function setBundle(id,kind,checked){const c=client(),b=bundles.find(b=>b.id===id);if(!b||b.essential)return;if(kind==='released'&&!c.contracted.includes(id))return;c[kind]=c[kind].filter(x=>x!==id);if(checked)c[kind].push(id);if(kind==='contracted'&&!checked)c.released=c.released.filter(x=>x!==id);record(b.name+' · '+kind+' = '+checked);render()}
function render(){const c=client();el('stage').value=c.stage;el('adminNotes').value=c.adminNotes;el('clientName').textContent=c.name+' · dados e funções somente deste exemplo';el('bundles').innerHTML=bundles.map(b=>'<div class="bundle"><strong>'+esc(b.name)+'</strong><div class="choices"><label><input type="checkbox" data-bundle="'+b.id+'" data-kind="contracted"'+(c.contracted.includes(b.id)?' checked':'')+(b.essential?' disabled':'')+'> Contratado · simulação</label><label><input type="checkbox" data-bundle="'+b.id+'" data-kind="released"'+(c.released.includes(b.id)?' checked':'')+(b.essential||!c.contracted.includes(b.id)?' disabled':'')+'> Liberado · simulação</label></div><p>'+ (b.essential?'Base indivisível nesta proposta.':'Só aparece ao síndico quando ambas as condições são verdadeiras.')+'</p></div>').join('');el('clientTools').innerHTML=available(c).map(b=>'<article class="bundle"><h3>'+esc(b.name)+'</h3><div class="profiles"><div><strong>Síndico — painel</strong><p>'+esc(b.manager)+'</p></div><div><strong>Morador — WhatsApp</strong><p>'+esc(b.resident)+'</p></div></div></article>').join('');for(const key of ['responsible','priorities','steps','returns'])el(key).value=c.config[key];document.querySelectorAll('[data-bundle]').forEach(x=>x.addEventListener('change',()=>setBundle(x.dataset.bundle,x.dataset.kind,x.checked)))}
el('condo').innerHTML=planning.clients.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');el('condo').addEventListener('change',e=>{selected=e.target.value;render()});
for(const key of ['responsible','priorities','steps','returns'])el(key).addEventListener('input',e=>client().config[key]=e.target.value);
el('stage').addEventListener('input',e=>client().stage=e.target.value);el('adminNotes').addEventListener('input',e=>client().adminNotes=e.target.value);el('reviewNotes').addEventListener('input',e=>planning.reviewNotes=e.target.value);
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{for(const id of ['paineis','fronteiras','revisao'])el(id).classList.toggle('hidden',id!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}));
el('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(planning,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='triade-revisao-dois-paineis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});render();
</script></body></html>'''
(out/'planejamento-paineis.html').write_text(html)
# Link new planning without replacing research.
p=root/'work/comparativo-template.html';s=p.read_text();s=s.replace('<h1>TRÍADE: cenários e ofertas</h1>','<h1>TRÍADE: cenários e ofertas</h1><p><a href="../../../estruturação do sistema/planejamento-paineis.html" style="color:white">Novo planejamento: painel Carolina e painel do síndico</a> · morador permanece WhatsApp.</p>');p.write_text(s)
note='''\n\n## Nova pasta de estruturação — 08/10/2026\n\nCriada na raiz do projeto a pasta `estruturação do sistema`, com índice, visão/fronteiras, planejamento separado dos painéis Carolina e síndico e HTML revisável com exemplos fictícios. Carolina gerencia todos os condomínios clientes e contratação/liberação de conjuntos; síndico vê somente recursos contratados/liberados do próprio condomínio, sem operação interna TRÍADE. Morador exclusivamente WhatsApp, sem painel/app/portal/login/senha/recuperação próprios. Correção final substitui a referência equivocada a “painel do morador”.\n\nFuncional/editável: processos de X/Y podem diferir; exemplos de lâmpada são testes, não fluxos universais. Configuração simples de responsáveis/prioridades/etapas/retornos, preservando histórico/comunicação/permissões e registros existentes, sem editor ilimitado presumido. Atendimento completo e comunicação/documentos essenciais não são fracionados. Agenda/manutenção/ampliados em revisão; cotações fora do desenvolvimento inicial; QR/sonoro ideias em avaliação. HTML simula escolhas locais e exporta cópia de revisão, sem implementar produto/autenticação/liberação real/integração ou definir preço.\n'''
for rel in ['outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','memory/2026-10-08.md']:
 p=root/rel;p.write_text(p.read_text()+note)
print(out)
