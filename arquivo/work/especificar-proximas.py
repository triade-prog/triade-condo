from pathlib import Path
import html,json,re,hashlib
root=Path.cwd();folder=root/'estruturação do sistema'
before={f:hashlib.sha256((folder/f).read_bytes()).hexdigest() for f in ['especificacao-mvp.md','especificacao-mvp.html']}
sections=[
('fronteiras','Autorização e fronteiras', '''APROVADO ANTERIORMENTE: o MVP inclui atendimento completo pelo WhatsApp institucional, conteúdos básicos e os dois painéis com controles internos. Agenda e coordenação de manutenção foram colocadas depois do MVP.

AUTORIZADO AGORA: iniciar somente o planejamento/especificação dessas próximas etapas. Nenhum módulo foi implementado e nenhuma tecnologia, fornecedor, preço ou prazo foi escolhido. Este documento não amplia o escopo de especificacao-mvp nem autoriza implementar todas as ideias futuras.

As descrições detalhadas abaixo são PROPOSTAS para revisão, salvo decisões expressamente identificadas. O síndico atua no próprio condomínio; Carolina administra todos os clientes e libera apenas capacidades contratadas; equipe interna por função/cliente/ação. Morador permanece somente WhatsApp, sem painel/login.

Conjuntos devem ser coerentes e configuráveis conforme a realidade. Atendimento e próximo retorno não dependem de agenda. Coordenação de manutenção não depende de orçamento, financeiro ou agenda. Relações opcionais ajudam a acompanhar, sem percurso compulsório.'''),
('agenda','Agenda: propósito e itens', '''DIREÇÃO ANTERIOR: agenda/compromissos como conjunto adicional, distinto do próximo retorno do atendimento. A composição definitiva não foi aprovada.

PROPOSTA de tipos iniciais: compromisso/reunião, visita técnica combinada, atividade programada e lembrete administrativo. Cada condomínio pode usar apenas os tipos necessários. Reserva de áreas comuns não foi aprovada e não integra este detalhamento.

PROPOSTA de item: título, descrição pertinente, condomínio, tipo, responsável autorizado, participantes quando necessários, início e fim ou data sem horário, situação, local/referência e vínculo opcional com atendimento/manutenção. Data prevista pode ser desconhecida; pendência sem data não deve aparecer como compromisso confirmado.

Distinguir data pretendida, horário combinado e execução realizada. Estimativa de resolução de atendimento não se torna evento automaticamente. Se item representar próximo retorno, atendimento continua como origem e referência; mudança deve informar a inconsistência, sem duas promessas divergentes.

PROPOSTA de estados: rascunho/planejado, a confirmar, confirmado, realizado e cancelado. Política de reagendamento/ausência precisa de decisão; preservar horário anterior e motivo, sem apagar evento concluído.'''),
('agendatela','Agenda: telas, ações e visualizações', '''PROPOSTA painel síndico: lista cronológica e calendário mensal/semanal, filtros por tipo/responsável/situação; detalhe; criar/editar, atribuir, confirmar, reagendar, registrar realização/cancelamento e consultar histórico. Lista acessível e adequada ao celular é alternativa ao calendário visual.

PROPOSTA Carolina: acompanhar agenda do cliente somente quando função e finalidade de suporte autorizadas. Compromissos internos de implantação pertencem à operação TRÍADE; não aparecem automaticamente ao condomínio. Qualquer compartilhamento precisa ser explícito.

Morador recebe informação autorizada pelo WhatsApp quando pertinente, não lista geral da agenda ou notas administrativas. Aviso de visita não autoriza entrada nem cria operação de portaria.

Conflitos são PROPOSTA: alertar sobre sobreposição de responsável/participante/local conhecido, sem bloqueio universal. Sobreposição pode ser legítima; regra por tipo e recurso exige validação. Não presumir disponibilidade de prestador externo a partir da agenda.

Recorrência é PROPOSTA: se necessária, padrão simples e horizonte limitado a definir; distinguir alteração de uma ocorrência versus série, cancelamento e histórico. Não construir recorrência complexa sem necessidade validada.

Notificações/lembretes são PROPOSTA: destinatário autorizado, horário/antecedência, canal e cancelamento/reagendamento a validar. Reusar integração futura WhatsApp do MVP somente após ela existir e ser autorizada. Mostrar falha/resultado real; sem promessa de entrega ou leitura.'''),
('agendaconfig','Agenda: configurações e decisões abertas', '''PROPOSTA de configuração mínima: tipos usados, responsáveis, situações significativas, permissão de criação/edição/confirmação e preferência de visualização. Fuso horário do condomínio, data sem horário e janela de avisos precisam ser definidos.

ABERTO: quem confirma compromissos com terceiros; participantes e visibilidade por item; detalhes públicos ao morador; horário obrigatório por tipo; conflito apenas aviso ou restrição específica; recorrência necessária no primeiro incremento; lembretes e ausência; referência de local; reação a atraso e reagendamento.

Não assumir autorização do síndico para compartilhar dados de qualquer morador ou fornecedor. Mostrar apenas contatos necessários e autorizados. Priorizar estrutura simples e sem dependência comercial de manutenção.'''),
('manutencao','Coordenação de manutenção: necessidade e acompanhamento', '''DIREÇÃO ANTERIOR: conjunto adicional para planejar e acompanhar manutenção com responsáveis/executores reais. Coordenação não significa TRÍADE executar reparos, escolher/contratar fornecedores ou decidir compras pelo condomínio.

PROPOSTA de registro independente: necessidade/atividade, condomínio, descrição, área/equipamento quando útil, responsável por acompanhar, executor/prestador se realmente definido, prioridade, situação, data prevista opcional, próximo retorno e histórico. Pode nascer diretamente ou de atendimento existente; origem opcional, sem exigir chamado.

PROPOSTA de tarefas: providência, responsável real, executor quando distinto, situação, previsão quando conhecida, próximo passo e resultado. Não confundir responsável de acompanhamento com quem faz o reparo. Equipe/prestador ausente permanece pendência explícita, nunca atribuição fictícia.

PROPOSTA de estados canônicos: planejada, em andamento, pendente e concluída; etapas ajustáveis mapeadas para entendimento consistente. Cancelamento/reabertura e critérios de conclusão a validar. Fotos/evidências podem ajudar quando pertinentes, não são requisito universal.

Preventiva e corretiva podem ser categorias configuráveis se necessárias. Plano periódico complexo, estoque, compras e contratos de fornecedores não integram este detalhamento. Procedimentos reais adotados podem ser referenciados, sem exigir ata/checklist/orçamento em toda manutenção.'''),
('manutencaotela','Manutenção: telas, ações e vínculos', '''PROPOSTA painel síndico: lista com filtros por situação/responsável/área; ficha com tarefas, providências, datas/retornos, executor conhecido e histórico; criar, atribuir, atualizar, anexar referência pertinente e registrar conclusão. Não incorporar comparador de orçamento ou pagamento de prestador.

PROPOSTA vínculo com atendimento: associar registros do mesmo condomínio, permitindo acompanhar a origem e informar o andamento relevante ao morador. Atendimento continua com responsável/prioridade/próximo retorno próprios. Concluir tarefa ou manutenção não conclui atendimento automaticamente sem regra/validação explicitamente aprovadas.

PROPOSTA vínculo com agenda: criar/associar visita ou atividade se agenda estiver contratada e liberada; caso contrário, registrar previsão/retorno na manutenção. Cancelar evento não apaga manutenção. Alterar data precisa atualizar referências ou sinalizar divergência. Nenhum vínculo atravessa condomínios.

Prestadores podem ser referência mínima de executor/contato necessário, sem portal/login próprio nesta proposta. Definir quem cadastra/valida/edita e quais dados devem ser visíveis. Não apresentar indicação de fornecedor como contratação ou autorização de acesso ao prédio.

Carolina/equipe acompanha apenas serviço e suporte atribuídos; acesso administrativo não torna a TRÍADE executora. Morador recebe resumo autorizado no WhatsApp, não ficha geral de prestadores, contratos ou notas internas.'''),
('dados','Dados e relações propostos', '''Modelo conceitual, sem escolha de banco ou pastas técnicas. Reusar entidades do MVP: condomínio, usuário/vínculo, unidade/contato autorizado, atendimento, conteúdo, contratação/liberação e auditoria.

AgendaItem: condomínio, tipo, título, descrição, responsável, participantes autorizados, início/fim opcionais ou data sem horário, referência de local, situação e referências opcionais a atendimento/manutenção. Ocorrência/série somente se recorrência aprovada; regras de fuso e duração a decidir.

Manutencao: condomínio, necessidade, área/equipamento opcional, categoria, responsável por acompanhar, executor conhecido opcional, estado/etapa, prioridade, previsão opcional e próximo retorno. TarefaManutencao: manutenção, providência, responsável/executor, situação, previsão/retorno e resultado.

ReferenciaPrestador: identificação e contato mínimo necessário, vínculo/visibilidade do condomínio, validação e responsável pelo registro; compartilhamento entre clientes nunca automático. Anexo/referência pertence ao registro correto e mantém autorização privada.

Historico: registro, autor/data, mudança/motivo relevante e estado anterior preservado. Notificacao proposta: item/origem, destinatário autorizado, canal, tentativa e resultado realmente conhecido. Não duplicar mensagem em reagendamento ou evento repetido.

Relações opcionais precisam validar condomínio comum. Retenção, exclusão/arquivamento, versões, auditoria e exportação seguem políticas do MVP a definir; não apagar dados compartilhados por apagar um vínculo. Não copiar conversa pessoal inteira sem necessidade.'''),
('permissoes','Permissões e isolamento', '''APROVADO: síndico somente próprio condomínio e funções contratadas E liberadas; Carolina controla carteira e liberações. Agenda/manutenção adicionais não surgem como disponíveis apenas porque um registro anterior possui vínculo.

PROPOSTA de ações separadas: visualizar, criar, atribuir, editar datas/etapas, confirmar, concluir/cancelar e configurar. Delegação interna definida por função, cliente e finalidade; prestador sem portal próprio, morador sem conta.

Validar no servidor leitura/alteração, relações, buscas, anexos, calendário e avisos. Ocultar interface não substitui isolamento. Sem acesso de outro condomínio por identificador ou lista de participantes.

ABERTO: acesso excepcional de suporte, delegação do síndico, campos sensíveis/visíveis ao morador, política ao suspender capacidade e consulta de histórico. Suspensão não apaga histórico; forma de leitura/exportação precisa ser decidida. Pagamento interno vencido não cria bloqueio automático.'''),
('criterios','Critérios de aceitação propostos', '''1. Agenda contratada e liberada para A não aparece disponível para B; servidor impede acesso aos dados de A por síndico B. Mudança de liberação em um cliente não altera outros.

2. Atendimento sem agenda continua completo, com responsável/prioridade/andamento/próximo retorno/estimativa conhecida/histórico. Nenhum campo exige evento para permitir atualização.

3. Manutenção sem agenda permite registrar tarefas, datas opcionais, responsável, executor conhecido e retorno. Não exige orçamento, financeiro, foto, ata ou checklist universal.

4. Duas realidades: lâmpada em prédio sem porteiro e visita de elevador em condomínio maior podem usar etapas/responsáveis distintos. Sem executor ou data, mostrar pendência e ausência real sem promessa inventada.

5. Reagendar/cancelar preserva histórico. Eventos conflitantes geram somente a regra aprovada; recurso não implementa bloqueio universal. Caso recorrência seja aprovada, alterar ocorrência não modifica série silenciosamente.

6. Vínculos só no mesmo condomínio; concluir manutenção não encerra automaticamente atendimento; cancelar visita não apaga tarefas. Datas divergentes ficam identificadas e não geram avisos contraditórios silenciosos.

7. Avisos futuros vão apenas a contatos autorizados, sem agenda geral/notas internas ao morador. Falha não é registrada como entrega/leitura; evento repetido não duplica mensagem. Não há autorização de entrada/desbloqueio de porta.

8. Funcionário só acompanha clientes/ações atribuídos. TRÍADE não aparece como prestador por padrão. Registro de prestador não implica compra, contrato, indicação garantida ou visita confirmada.

9. Navegação por teclado, foco visível, lista alternativa ao calendário, rótulos claros, uso em celular e estados vazio/erro. Desempenho/volumes/navegadores alvo a acordar, sem meta inventada.

Esses critérios são proposta para orientar revisão e futura implementação. Testes de integração reais dependem das decisões e autorização do ambiente.'''),
('fases','Dependências e fases de planejamento', '''Dependências técnicas futuras: isolamento/autorização, vínculos, contratação/liberação, auditoria e anexos seguros do MVP. WhatsApp/notificações só dependem de integração para efetivo envio, não para existência de registro interno. Agenda e manutenção são independentes entre si no uso.

Fase proposta 1 — revisar necessidades e fronteiras, quem usa e permissões; escolher mínimo de agenda e manutenção para próxima entrega. Sem prazo/preço definido.

Fase proposta 2 — detalhar agenda simples sem exigir recorrência/conflitos complexos; prototipar telas/dados e validar cenários. Decidir avisos e confirmação antes de prometer integração.

Fase proposta 3 — detalhar manutenção independente: tarefas, responsáveis/executor, andamento e histórico; validar referências opcionais com atendimento. Não desenvolver orçamento disfarçado.

Fase proposta 4 — revisar vínculos com agenda, divergências de datas e conclusão; incluir recorrência/conflitos/notificações somente se explicitamente aprovados e necessários.

Fase proposta 5 — após aprovação específica para codar, desenvolver e testar isoladamente, preparar piloto autorizado. Esta entrega não executa qualquer fase de código, não altera MVP nem sua ordem de entrega.'''),
('futuro','Outras referências futuras: sem autorização de implementação', '''Comunicação/documentos ampliados: campanhas, arquivo administrativo, versões/revisões além da publicação/consulta essencial; fronteira/separação ainda a decidir. Conteúdos básicos continuam no MVP. Não detalhar suíte avançada por esta autorização.

Propostas/orçamentos: expressamente fora do inicial. Pesquisa anterior preservada só para eventual demanda comprovada; nenhum novo detalhamento ou módulo autorizado aqui.

Financeiro do condomínio/boletos: ideia futura opcional, provedor/fluxos/regras pendentes. Separado do registro interno dos pagamentos dos clientes à TRÍADE que está no MVP; sem gateway ou cobrança aprovados.

QR de chegada: estudo de viabilidade futura com apartamento e roteamento interno para vários contatos autorizados por unidade, conforme preferências/revogação a avaliar. Resposta pública neutra; não expor telefones/cadastro/presença. Não autoriza entrada nem desbloqueia porta. Não é integração comprovada.

Receptor sonoro/chamada local: alternativas futuras de interfone/campainha ou integração compatível; necessidade de energia, fiação/rede, alcance, instalador e testes. Não presumir que campainha comum aceita acionamento por software. Produção/instalação física é separada da integração. Nenhum fornecedor escolhido/compra/instalação.

Armários de encomendas: somente após primeiros clientes, necessidade/espaço/custos/custódia/exceções/responsabilidades a avaliar. Não prometer ausência de extravio ou integração disponível.

Assessoria operacional recorrente: hipótese futura distinta da implantação/orientação atual. Escopo, capacidade, pessoas e inclusão comercial não definidos. Site institucional continua planejamento separado, não criado nesta etapa.'''),
('duvidas','Decisões abertas para a revisão', '''Agenda: tipos realmente necessários; confirmação e participantes; quem vê cada campo; fuso/duração; recorrência no primeiro incremento; política de conflito, reagendamento/ausência; avisos e horários. Reserva de áreas comuns não aprovada.

Manutenção: etapas mínimas, critérios de conclusão/reabertura, categorias e áreas; cadastro mínimo de executor/prestador, visibilidade e finalidade; responsáveis substitutos; como tratar previsão desconhecida e divergência com agenda/atendimento.

Transversal: permissões de delegação/suporte, suspensão/histórico, dados necessários e retenção, notificações reais após integração, fronteiras comerciais dos conjuntos. Stack/provedor/preço/prazo seguem pendentes.

Próxima aprovação útil: Carolina revisar este documento e selecionar quais propostas entram na futura especificação fechada de agenda/manutenção. Isso não condiciona nem modifica a revisão do MVP já entregue.''')]
md='# Próximas etapas — agenda e coordenação de manutenção\n\nPlanejamento para revisão • 08/10/2026 • Sem implementação de produto.\n\n'
for i,t,b in sections:md+=f'## {t}\n\n{b}\n\n'
refs=[('especificacao-mvp.md','MVP aprovado — permanece separado'),('visao-do-sistema.md','Visão e fronteiras'),('painel-sindico.md','Painel síndico'),('painel-carolina.md','Carolina e equipe'),('manual-implantacao.md','Manual de implantação'),('../outputs/triade-condo/docs/arquitetura.md','Arquitetura histórica proposta'),('../outputs/triade-condo/pesquisa/aprofundamento-cotacoes-propostas-2026-10-08.md','Pesquisa futura de cotações, não escopo'),('../mapa-da-empresa.html','Mapa da empresa')]
md+='## Referências existentes\n\n'+''.join(f'- [{t}]({p})\n' for p,t in refs)+'\nDecisões mais recentes prevalecem sobre desenhos históricos. Materiais anteriores preservados.\n'
(folder/'proximas-etapas.md').write_text(md)
source=(folder/'especificacao-mvp.html').read_text();style=re.search(r'<style>([\s\S]*?)</style>',source)[1]
nav=''.join(f'<a href="#{i}">{html.escape(t)}</a>' for i,t,b in sections)
content=''.join(f'<section id="{i}"><h2>{html.escape(t)}</h2>'+''.join(f'<p>{html.escape(p)}</p>' for p in b.split('\n\n'))+'</section>' for i,t,b in sections)
page=f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Próximas etapas · TRÍADE Condo</title><style>{style}</style></head><body><header><p>TRÍADE Condo • 08/10/2026</p><h1>Agenda e coordenação de manutenção</h1><p>Próximas etapas em planejamento. Detalhes propostos para revisão; nenhum módulo implementado.</p><p class="notice"><strong>O MVP permanece separado e intacto.</strong> Autorização atual é somente para especificar. Outros módulos futuros são referências pendentes, sem autorização de implementação.</p><p><a href="../mapa-da-empresa.html">← Mapa da empresa</a> · <a href="proximas-etapas.md">Documento Markdown</a> · <a href="especificacao-mvp.html">MVP aprovado</a></p><button id="print">Imprimir / salvar PDF pelo navegador</button></header><main class="layout"><nav aria-label="Seções das próximas etapas">{nav}</nav><article>{content}<section id="fontes"><h2>Referências existentes</h2>{''.join(f'<p><a href="{p}">{html.escape(t)}</a></p>' for p,t in refs)}<p>Materiais históricos preservados; decisão mais recente prevalece.</p></section></article></main><footer>Planejamento local: sem mensagens, pagamentos, instalações ou código de produto.</footer><script>document.getElementById('print').onclick=()=>window.print();</script></body></html>'''
(folder/'proximas-etapas.html').write_text(page)
p=root/'mapa-da-empresa.html';s=p.read_text();m=re.search(r'(<script id="map-data" type="application/json">)([\s\S]*?)(</script>)',s);data=json.loads(m[2]);system=next(x for x in data if x['id']=='sistema');dev=next(x for x in system['children'] if x['id']=='desenvolvimento');dev['children'].insert(1,dict(id='proximas-etapas',title='Próximas etapas: agenda e manutenção',status='existente',text='Documentos de planejamento existentes, não funções operando. Agenda e coordenação manutenção detalhadas como propostas para revisão após MVP; demais ideias são referências pendentes, sem autorização de implementação. O MVP permanece separado.',children=[],link='estruturação do sistema/proximas-etapas.html'));s=s[:m.start(2)]+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+s[m.end(2):];p.write_text(s)
p=folder/'README.md';p.write_text(p.read_text()+'\n## Planejamento das próximas etapas\n\n[Agenda/manutenção — Markdown](proximas-etapas.md) e [HTML navegável](proximas-etapas.html). Autorização apenas para planejamento: propostas, dados, ações e critérios para revisão; outros módulos futuros como referências pendentes. Não modifica a especificação do MVP nem implementa módulos.\n')
assert all(hashlib.sha256((folder/f).read_bytes()).hexdigest()==h for f,h in before.items())
(root/'work/proximas-etapas-mvp-hashes.json').write_text(json.dumps(before,indent=2))
print('Documentos criados; os dois arquivos MVP permanecem idênticos.')
