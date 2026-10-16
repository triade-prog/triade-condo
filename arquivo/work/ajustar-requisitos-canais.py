from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Jornada e notificações confirmadas — 07/10/2026
Em todos os cenários, o morador interage 100% pelo WhatsApp, sem aplicativo ou portal externo. O síndico tem painel web para gestão e recebe no próprio WhatsApp notificações de novidades relevantes, incluindo novo chamado/reclamação e nova solicitação de morador, evitando precisar manter o painel aberto. É requisito do produto para implementação futura, não integração entregue. Não presumir decisões/aprovações pelo WhatsApp nem notificações para cada alteração técnica. Detalhar eventos pertinentes, destinatários por vínculo, falha/entrega e prevenção de duplicidade, preservando a simplicidade da rotina. Outros tipos e regras de aviso continuam a detalhar.
'''
for name in ['produto.md','arquitetura.md','plano-execucao.md','revisao-modelos-2026-10-07.md','pesquisa-publica-2026-10-07.md','sintese-comercial-2026-10-07.md']:
 p=root/'outputs/triade-condo/docs'/name;p.write_text(p.read_text()+note)
p=root/'outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md';t=p.read_text();
t=t.replace('Pedido privado com texto e foto, pelo WhatsApp se viável','Morador 100% pelo WhatsApp, sem app/portal externo')
t=t.replace('Síndico recebe; vínculo do morador e viabilidade/custo do canal precisam ser definidos','Morador usa WhatsApp em todos os cenários; síndico gere no painel web. Identidade, vínculo e viabilidade técnica/custo a detalhar')
t=t.replace('| Status, retorno e histórico | Consultar andamento sem procurar prints | Síndico mantém a informação; mensagem entregue não significa problema resolvido |','| Andamento e avisos ao síndico pelo WhatsApp | Morador acompanha; síndico recebe novidades sem manter painel aberto | Síndico gere no painel web; avisos de novo chamado/reclamação e nova solicitação. Outros eventos/regras a detalhar; não presumir aprovação pelo WhatsApp |')
t+=note;p.write_text(t)
p=root/'work/comparativo-template.html';t=p.read_text();
t=t.replace('Retornos e registros úteis apoiam essa rotina, sem procedimento burocrático obrigatório.','Retornos e registros úteis apoiam essa rotina, sem procedimento burocrático obrigatório.</p><p><strong>Jornada confirmada em todos os cenários:</strong> morador 100% pelo WhatsApp, sem app/portal externo. Síndico com painel web de gestão e avisos no próprio WhatsApp sobre novo chamado/reclamação, nova solicitação e demais novidades relevantes. Integração futura, sem aprovação pelo WhatsApp presumida.')
t=t.replace('Identificar organização existente; plataforma self-service e adicional humano opcional.','Identificar organização existente; morador 100% WhatsApp, síndico com painel web e avisos WhatsApp. Requisitos futuros; adicional humano opcional.')
t=t.replace('MVP continua focado.','MVP continua focado. Morador 100% WhatsApp e síndico com painel web/avisos WhatsApp em todos os cenários. Detalhar eventos, destinatários por vínculo, falha/entrega e duplicidade, sem avisos para cada alteração técnica ou aprovação pelo WhatsApp presumida.')
p.write_text(t)
catalog_path=root/'outputs/triade-condo/construcao/catalogo.json'
d=json.loads(catalog_path.read_text());before=json.loads(json.dumps(d));tasks={t['id']:t for t in d['tasks']}
changes={
 'DEC-06':('Identificar organização existente e responsáveis por atividade','Identificar atores e procedimentos já adotados por cenário/modelo. Manutenção pode estar organizada em atas, regras, acordos ou contratos; referência/decisão/responsável registrados se útil, sem regra de ata ou novo fluxo obrigatório. C01: rotina compartilhada sem operação de portaria; visitas/entregas diretamente com moradores. Humano opcional.'),
 'TIC-02':(None,'Identificar organização existente e responsável real para pedido, providência, andamento e conclusão. Sem equipe inventada ou fluxo burocrático obrigatório. Acesso/autorizações só se necessários ao caso; não presumir operação de portaria em C01.'),
 'SERV-06':(None,'Identificar contratos, acordos, prestadores e modo de atendimento existentes; coordenar providências conforme necessidades reais. Não presumir cadastro novo, prestador fixo, autorização de entrada ou acompanhamento obrigatório no prédio simples sem operação de portaria.'),
 'PROD-05':(None,'Após descoberta comercial, definir MVP focado na rotina candidata. Visão de evolução: do prédio simples ao condomínio grande com muitos apartamentos, com ou sem portaria, com funções adequadas a cada contexto. Forma de disponibilizar recursos pendente; sem pacote, preço ou arquitetura definitivos. Morador 100% WhatsApp e síndico com painel web/avisos WhatsApp em todos os cenários. Construção e testes futuros.'),
 'WA-04':(None,'Planejar/implementar futuramente retornos ao morador no WhatsApp e avisos ao síndico no WhatsApp sobre novo chamado/reclamação, nova solicitação e eventos relevantes a detalhar. Mapear evento/destinatário por vínculo, entrega/falha, tentativas e prevenção de duplicidade. Painel web é gestão; não presumir decisões pelo WhatsApp nem avisos de cada alteração técnica.'),
 'WA-06':(None,'Jornada do morador 100% WhatsApp em todos os cenários, sem aplicativo/portal externo. Consultar só demandas autorizadas, retornar andamento e registrar revisão quando necessária. Síndico gere no painel web e recebe novidades relevantes no WhatsApp. Requisito futuro, sem integração entregue.'),
 'WA-07':(None,'Futuramente testar jornada 100% WhatsApp do morador, painel web do síndico e avisos WhatsApp de novo chamado/reclamação e solicitação. Verificar destinatários por vínculo, entrega/falha e duplicidade; outros eventos a detalhar. Não implementar nem contratar integração nesta revisão de materiais.'),
}
for task_id,(title,criteria) in changes.items():
 task=tasks[task_id]
 if title:task['title']=title
 task['criteria']=criteria
 task['revisionNote']='Ajuste de pressupostos e canais confirmado em 07/10/2026; requisito futuro. IDs, dependências e registros de execução preservados.'
assert [t['id'] for t in before['tasks']]==[t['id'] for t in d['tasks']]
for old,new in zip(before['tasks'],d['tasks']):
 for field in ['deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(field)==new.get(field),(old['id'],field)
catalog_path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
# Keep the existing generated execution-plan criteria aligned, without changing task IDs/status.
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for task_id,(title,criteria) in changes.items():
 old=next(x for x in before['tasks'] if x['id']==task_id)
 t=t.replace('Conclui quando: '+old['criteria'],'Conclui quando: '+criteria)
 if title:t=t.replace('— '+old['title'],'— '+title)
p.write_text(t)
print('Requisitos e 7 critérios existentes atualizados; 80 IDs e registros preservados.')
