from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## WhatsApp institucional como pré-requisito de adesão — 08/10/2026
Para adquirir/usar a TRÍADE, o prédio ou condomínio deve ter WhatsApp próprio, com número institucional do prédio/condomínio. Se ainda não houver, providenciar esse número é pré-requisito da adesão. Não usar automaticamente WhatsApp pessoal do síndico como canal institucional e não inventar exceções ou burocracia adicional. Morador continua 100% WhatsApp, pelo canal institucional; síndico mantém painel web de gestão e recebe notificações no WhatsApp dele.

É requisito comercial e de jornada confirmado, não integração entregue. Viabilidade técnica do número para futura integração permanece a verificar. Provedor, tipo de conta/API, custos e migração não foram escolhidos. Não criar número/conta, pesquisar ou implementar nesta atualização. As demais decisões permanecem.
'''
for relative in ['outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md','outputs/triade-condo/docs/revisao-modelos-2026-10-07.md','outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/README.md']:
 p=root/relative;p.write_text(p.read_text()+note)
p=root/'memory/2026-10-08.md';p.write_text((p.read_text() if p.exists() else '')+note)
p=root/'work/comparativo-template.html';t=p.read_text();needle='Jornada confirmada em todos os cenários:</strong> morador 100% pelo WhatsApp, sem app/portal externo.';assert needle in t
t=t.replace(needle,'Jornada confirmada em todos os cenários:</strong> morador 100% pelo WhatsApp institucional do prédio, sem app/portal externo. Para adquirir/usar o sistema, o prédio/condomínio deve ter WhatsApp próprio: providenciar o número institucional é pré-requisito da adesão se ainda não houver. Não usar automaticamente WhatsApp pessoal do síndico como canal institucional. A viabilidade técnica do número para futura integração fica a verificar; provedor, conta/API, custos e migração não escolhidos.')
t=t.replace('síndico com painel web e avisos WhatsApp. Requisitos futuros','síndico com painel web e avisos no WhatsApp dele. Número institucional próprio do prédio é pré-requisito da adesão. Requisitos futuros')
p.write_text(t)
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());before=json.loads(json.dumps(d));m={x['id']:x for x in d['tasks']}
addition=' Adesão exige número institucional próprio de WhatsApp do prédio/condomínio; providenciar se ainda não houver, sem usar automaticamente WhatsApp pessoal do síndico como canal institucional. Morador 100% no canal institucional; síndico painel web e avisos no WhatsApp dele. Viabilidade técnica do número a verificar futuramente; sem escolha de provedor, conta/API, custos ou migração e sem criar número/conta nesta revisão.'
for id in ['PROD-02','WA-01']:
 m[id]['criteria']+=addition;m[id]['revisionNote']='Pré-requisito comercial/jornada registrado em 08/10/2026; integração futura; IDs e registros preservados.'
for old,new in zip(before['tasks'],d['tasks']):
 for f in ['id','deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(f)==new.get(f)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for id in ['PROD-02','WA-01']:t=t.replace('Conclui quando: '+next(x for x in before['tasks'] if x['id']==id)['criteria'],'Conclui quando: '+m[id]['criteria'])
p.write_text(t)
print('Número institucional registrado; sem pesquisa, criação de conta ou implementação.')
