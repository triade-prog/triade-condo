from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Foco inicial Brasília/DF e entrada assistida — 08/10/2026
Foco inicial de atendimento escolhido pela usuária: Brasília/Distrito Federal. É definição comercial de atuação, sem demanda ou comprador validados. Ofertar implantação assistida como diferencial proposto: equipe vai a reunião/assembleia acordada com o cliente, demonstra o sistema e orienta passo a passo. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade competitiva.

Ofertar suporte de entrada de novos moradores, orientando uso do WhatsApp e funcionamento do serviço, com preparação/cadastro assistido conforme requisitos a detalhar. Não é registro de visitante ou aviso automático de chegada. Implantação/treinamento e suporte de entrada são distintos de assessoria operacional humana opcional, como triagem/vistoria. Preço/pacote, frequência, capacidade e responsáveis continuam a definir; presencial versus remoto para novos moradores também permanece aberto. Sem assumir contratação ou serviços ilimitados.

Preservar morador 100% WhatsApp, número institucional próprio do prédio como pré-requisito de adesão, síndico com painel web e notificações no WhatsApp dele. Esta revisão só registra materiais: sem pesquisa adicional, contratação, contato, agenda ou implementação.
'''
for relative in ['outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md','outputs/triade-condo/docs/revisao-modelos-2026-10-07.md','outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/README.md','memory/2026-10-08.md']:
 p=root/relative;t=p.read_text();t=t.replace('36 itens de comparação por cenário','42 itens de comparação por cenário').replace('36 combinações de oferta/cenário','42 combinações de oferta/cenário');p.write_text(t+note)
p=root/'work/comparativo-template.html';t=p.read_text().replace('36 itens de comparação por cenário','42 itens de comparação por cenário').replace("rows.length+' de 12 itens","rows.length+' de '+data.proposals.length+' itens")
needle='<h3>Roteiro para nossa explicação</h3>';assert needle in t
t=t.replace(needle,'<h3>Entrada assistida em Brasília/DF</h3><p>Foco inicial de atendimento decidido: Brasília/Distrito Federal. Ofertar apresentação presencial do sistema e orientação passo a passo em reunião/assembleia acordada com o cliente, sem requisito jurídico ou exclusividade afirmada.</p><p>Ofertar também orientação de novos moradores sobre WhatsApp e serviço, com preparação/cadastro assistido a detalhar. Distintos da assessoria operacional opcional. Preço/pacote, frequência, capacidade e responsáveis a definir; presencial/remoto para novos moradores ainda aberto.</p><h3>Roteiro para nossa explicação</h3>')
p.write_text(t)
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());before=json.loads(json.dumps(d));m={x['id']:x for x in d['tasks']}
changes={
 'PROD-02':' Foco inicial decidido: Brasília/Distrito Federal, sem demanda validada. Ofertar implantação assistida em reunião/assembleia acordada com cliente e suporte de entrada de novos moradores; distintos da assessoria operacional opcional. Preço/pacote, frequência, capacidade, responsáveis e presencial/remoto para novos moradores a definir. Sem exclusividade ou assembleia como requisito jurídico.',
 'WA-01':' Suporte de entrada de novos moradores orienta uso do WhatsApp e funcionamento do serviço, com preparação/cadastro assistido conforme requisitos a detalhar. Preservar número institucional como pré-requisito e morador 100% WhatsApp. Não é registro de visitante; frequência, responsáveis, capacidade e presencial/remoto a definir.',
 'PIL-03':' Ofertar implantação assistida: equipe demonstra sistema e orienta passo a passo em reunião/assembleia acordada, em Brasília/DF. Não exigir assembleia juridicamente nem afirmar exclusividade. Suporte de entrada de novos moradores distinto de assessoria operacional opcional; preço/pacote, frequência, capacidade, responsáveis e formato a definir. Sem agendamento, contratação ou atendimento executado nesta revisão.'
}
for id,addition in changes.items():m[id]['criteria']+=addition;m[id]['revisionNote']='Foco Brasília/DF e entrada assistida registrados em 08/10/2026; requisitos comerciais futuros; registros preservados.'
for old,new in zip(before['tasks'],d['tasks']):
 for f in ['id','deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(f)==new.get(f)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for id in changes:t=t.replace('Conclui quando: '+next(x for x in before['tasks'] if x['id']==id)['criteria'],'Conclui quando: '+m[id]['criteria'])
p.write_text(t)
for name in ['finalizar-comparativo.py','build-comparativo-html.py','test-comparativo-html.cjs']:
 p=root/'work'/name;t=p.read_text()
 if name=='finalizar-comparativo.py':t=t.replace("extract(2,6,41,11)","extract(2,6,47,11)").replace("len(data['offers'])==36","len(data['offers'])==42").replace("'ofertas_por_cenario':36","'ofertas_por_cenario':42")
 if name=='build-comparativo-html.py':t=t.replace("len(data['offers'])==36","len(data['offers'])==42").replace("==12 for s in data['scenarios']","==14 for s in data['scenarios']")
 if name=='test-comparativo-html.cjs':t=t.replace('/12 de 12 itens/','/14 de 14 itens/').replace('/2 de 12 itens/','/2 de 14 itens/')
 p.write_text(t)
print('Brasília/DF, implantação e suporte de entrada registrados; 42 itens, IDs anteriores preservados.')
