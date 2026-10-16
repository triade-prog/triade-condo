from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Atividades e módulos opcionais — 07/10/2026
Decisão de produto: atividades/módulos devem poder ser usados de forma independente, com pouca burocracia e ativação opcional pelo síndico. Compartilhar dados e relacionar atividades quando útil não cria dependência comercial nem percurso compulsório entre funções. Orçamento não exige pagamento/financeiro; chamados, evidências, checagem e reabertura não exigem financeiro ou cobrança. Usar orçamento ou outro módulo independente não obriga criar chamado, evidência ou checagem. Preservar vínculos essenciais de registro, identidade, autorização e coerência quando necessários, como uma evidência pertencente ao caso correto.

Controle financeiro e cobrança mensal do condomínio por boleto entram como possibilidades opcionais de evolução, que o síndico pode usar ou não. Não estão aprovados para MVP nem implementados. Provedor, fluxo de boleto, ativação e eventuais integrações serão pesquisados/desenhados futuramente; nenhuma pesquisa extra ou movimentação financeira nesta revisão. Não interpretar a visão ampla como suíte obrigatória ou escolher pacotes, preços ou arquitetura definitivos. Morador permanece exclusivamente WhatsApp; síndico com painel web e avisos WhatsApp. MVP focado e assessoria humana opcional permanecem.
'''
for name in ['produto.md','arquitetura.md','plano-execucao.md','revisao-modelos-2026-10-07.md','pesquisa-publica-2026-10-07.md','sintese-comercial-2026-10-07.md']:
 p=root/'outputs/triade-condo/docs'/name;p.write_text(p.read_text()+note)
p=root/'outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md';t=p.read_text().replace('| Impedimentos e próximo passo | Fica claro se falta acesso, orçamento, decisão ou executor |','| Impedimentos e próximo passo | Fica clara a pendência real de orçamento, decisão, executor ou providência |');t+=note;p.write_text(t)
p=root/'work/comparativo-template.html';t=p.read_text().replace('Requisitos futuros; adicional humano opcional.','Requisitos futuros; adicional humano opcional. Atividades/módulos são opcionais e independentes: orçamento sem pagamento; chamados sem financeiro. Compartilhar dados quando útil preserva vínculos essenciais, sem percurso compulsório.');
t=t.replace('A forma de disponibilizar recursos está pendente, sem pacotes, preços ou arquitetura definitivos; MVP continua focado.','Atividades/módulos opcionais e independentes, com pouca burocracia. Controle financeiro e cobrança mensal por boleto são possibilidades de evolução que o síndico pode usar ou não, sem aprovação para MVP ou implementação. Orçamento não exige pagamento; chamados, evidências, checagem e reabertura não exigem financeiro/cobrança. Módulo independente não obriga criar chamado/evidência/checagem; vínculos essenciais de identidade, autorização e registro permanecem. Provedor, fluxo, ativação e integrações serão definidos futuramente. Sem pacotes, preços ou arquitetura definitivos; MVP continua focado.');p.write_text(t)
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());before=json.loads(json.dumps(d));m={x['id']:x for x in d['tasks']}
updates={
 'PROD-05':m['PROD-05']['criteria']+' Atividades/módulos opcionais e independentes. Financeiro e boleto mensal são evolução possível, não aprovados para MVP. Orçamento não exige pagamento; chamados/evidências/checagem/reabertura não exigem financeiro/cobrança. Preservar vínculos essenciais sem percurso compulsório. Ativação, provedor/fluxo e integrações a definir futuramente.',
 'SYN-01':'Se selecionado para um caso que exige decisão, registrar alternativas, custo e autoria conforme organização existente. Orçamento também pode ser usado como atividade independente/opcional, sem financeiro, pagamento, chamado, evidência ou checagem obrigatórios. Não criar fluxo burocrático universal; preservar identidade, autorização e coerência quando necessárias.'
}
for id,criteria in updates.items():m[id]['criteria']=criteria;m[id]['revisionNote']='Requisito de atividades/módulos opcionais e independentes registrado em 07/10/2026; implementação futura; registros preservados.'
for old,new in zip(before['tasks'],d['tasks']):
 for f in ['id','deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(f)==new.get(f)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for id,criteria in updates.items():t=t.replace('Conclui quando: '+next(x for x in before['tasks'] if x['id']==id)['criteria'],'Conclui quando: '+criteria)
p.write_text(t)
for relative in ['memory/2026-10-07.md','outputs/triade-condo/README.md']:
 p=root/relative;p.write_text(p.read_text()+note)
print('Optionalidade e módulos futuros registrados, sem novos IDs ou alteração de registros de execução.')
