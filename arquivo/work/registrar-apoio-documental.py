from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Apoio documental na implantação — 08/10/2026
A consultoria/assessoria de implantação de novo condomínio cliente inclui como diferencial proposto apoio à documentação do condomínio: atas, regras e documentos pertinentes. Se inexistentes, ajudar a desenvolver; se existentes, revisar e propor ajustes quando necessários. Não afirmar exclusividade de mercado. Apoio de redação/organização e propostas de ajuste são distintos da aprovação das regras pelo condomínio. Atas devem refletir reuniões e decisões efetivamente ocorridas, sem fabricar atas retroativas ou decisões. Não apresentar o apoio como regularização automática ou assessoria jurídica já contratada.

Documentos abrangidos, responsáveis, revisão profissional quando aplicável e preço/pacote continuam a definir. Documentação não se torna requisito compulsório para todos os módulos nem burocracia obrigatória por chamado. Orientar moradores pelas regras fornecidas/aprovadas pelo cliente, sem substituir documentos. Preservar implantação de novo condomínio cliente versus integração/orientação de novo morador em condomínio já cliente, cadastro breve nome/telefone/apartamento e CPF condicional à necessidade financeira, Brasília/DF, WhatsApp institucional e síndico painel/avisos. Apenas registro; nenhum documento real criado para cliente inexistente, pesquisa, contato ou implementação.
'''
for relative in ['outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md','outputs/triade-condo/docs/revisao-modelos-2026-10-07.md','outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/README.md','memory/2026-10-08.md']:
 p=root/relative;p.write_text(p.read_text()+note)
p=root/'work/comparativo-template.html';t=p.read_text();needle='<h3>Roteiro para nossa explicação</h3>';assert needle in t
t=t.replace(needle,'<p><strong>Apoio documental na implantação:</strong> ajudar a desenvolver atas, regras e documentos se inexistentes; revisar e propor ajustes quando necessário se existentes. O condomínio aprova suas regras; atas refletem reuniões/decisões reais, sem fabricação retroativa. Não é regularização automática ou jurídico já contratado. Documentos abrangidos, responsáveis, revisão profissional quando aplicável e preço/pacote a definir. Sem documentação compulsória para todos os módulos ou burocracia por chamado; sem exclusividade afirmada.</p>'+needle)
p.write_text(t)
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());before=json.loads(json.dumps(d));m={x['id']:x for x in d['tasks']}
addition=' Implantação de novo condomínio cliente também oferece apoio documental a atas, regras e documentos pertinentes: desenvolver se inexistentes; revisar/propor ajustes quando necessário. Condomínio aprova regras; atas refletem reuniões/decisões reais, sem fabricação retroativa. Sem regularização automática ou jurídico já contratado. Documentos abrangidos, responsáveis/revisão profissional quando aplicável e preço/pacote a definir. Não exigir documentação para todos os módulos/chamados; nenhum documento real criado agora.'
for id in ['PROD-02','PIL-03']:m[id]['criteria']+=addition
for old,new in zip(before['tasks'],d['tasks']):
 for f in ['id','deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(f)==new.get(f)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for id in ['PROD-02','PIL-03']:t=t.replace('Conclui quando: '+next(x for x in before['tasks'] if x['id']==id)['criteria'],'Conclui quando: '+m[id]['criteria'])
p.write_text(t)
print('Apoio documental proposto registrado, sem documento real ou implementação.')
