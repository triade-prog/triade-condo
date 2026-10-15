from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Assessoria atual e terminologia confirmadas — 08/10/2026
Este esclarecimento prevalece sobre o enquadramento anterior: a assessoria da oferta atual concentra-se na **implantação de novo condomínio cliente** (prédio/condomínio que contrata o sistema), com demonstração e orientação passo a passo em reunião/assembleia acordada, e na **integração/orientação de novo morador em condomínio já cliente**, reduzindo trabalho do síndico. “Novo cliente” significa condomínio, não morador. Assembleia não é requisito jurídico de adesão; não afirmar exclusividade.

Na orientação do novo morador, explicar regras existentes aprovadas/fornecidas pelo cliente, mostrar uso do WhatsApp e funcionamento do sistema e realizar cadastro breve com nome, telefone e apartamento. Não inventar regras nem substituir documentos do prédio. CPF é possibilidade condicional à necessidade do módulo financeiro, não obrigatório para funções básicas; sem coleta real agora ou interpretação de regra legal. Preço/pacote, frequência, capacidade, responsáveis e presencial versus remoto para novos moradores continuam a definir.

Assessoria operacional recorrente (triagem, vistoria, acompanhamento/manutenção) permanece apenas hipótese opcional futura, claramente distinta, sem inclusão automática na oferta atual. Descrições anteriores desse modelo não significam serviço vigente ou obrigação de execução. Preservar Brasília/DF, morador exclusivamente WhatsApp, número institucional próprio como pré-requisito, síndico painel web e avisos no WhatsApp dele, módulos independentes e MVP focado. Apenas materiais atualizados; sem pesquisa, contato, contratação ou implementação.
'''
files=['outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md','outputs/triade-condo/docs/revisao-modelos-2026-10-07.md','outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/README.md']
for relative in files:
 p=root/relative;t=p.read_text();title,sep,body=t.partition('\n');p.write_text(title+'\n'+note+'\n'+body)
p=root/'memory/2026-10-08.md';p.write_text(p.read_text()+note)
p=root/'work/comparativo-template.html';t=p.read_text()
t=t.replace('adicional humano opcional','assessoria de implantação/orientação proposta; operação recorrente só hipótese futura')
t=t.replace('assessoria operacional opcional','assessoria operacional recorrente, apenas hipótese opcional futura')
t=t.replace('Entrada assistida em Brasília/DF','Assessoria atual em Brasília/DF')
t=t.replace('Ofertar apresentação presencial do sistema e orientação passo a passo em reunião/assembleia acordada com o cliente','Ofertar implantação de novo condomínio cliente: apresentação presencial do sistema e orientação passo a passo em reunião/assembleia acordada com o cliente')
t=t.replace('Ofertar também orientação de novos moradores sobre WhatsApp e serviço, com preparação/cadastro assistido a detalhar.','Ofertar também integração/orientação de novo morador em condomínio já cliente: explicar regras existentes aprovadas/fornecidas pelo cliente, uso do WhatsApp e funcionamento do sistema. Cadastro breve de nome, telefone e apartamento; CPF somente se necessário ao módulo financeiro, não obrigatório para funções básicas. Não inventar regras ou substituir documentos; sem coleta real agora.')
p.write_text(t)
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());before=json.loads(json.dumps(d));m={x['id']:x for x in d['tasks']}
requirements={
 'PROD-02':'Oferta atual em Brasília/DF: assessoria para implantação de novo condomínio cliente (prédio/condomínio que contrata o sistema), com demonstração/orientação em reunião/assembleia acordada, e integração/orientação de novo morador em condomínio já cliente. Não é requisito jurídico nem exclusividade. Assessoria operacional recorrente só hipótese opcional futura. Preço/pacote, frequência, capacidade, responsáveis e presencial/remoto da orientação a definir.',
 'WA-01':'Requisito futuro: número institucional próprio de WhatsApp do prédio/condomínio como pré-requisito de adesão; providenciar se inexistente, sem usar automaticamente WhatsApp pessoal do síndico como canal institucional. Morador 100% WhatsApp, síndico painel web e avisos no WhatsApp dele. Integração/orientação de novo morador em condomínio já cliente explica regras existentes fornecidas/aprovadas pelo cliente e uso WhatsApp/sistema; cadastro breve nome, telefone, apartamento. CPF só se necessário ao financeiro, não obrigatório para funções básicas. Viabilidade técnica, provedor, conta/API, custos e migração não definidos; sem coleta ou implementação agora.',
 'PIL-03':'Planejar assessoria atual: implantação de novo condomínio cliente, com equipe demonstrando e orientando passo a passo em reunião/assembleia acordada, em Brasília/DF. Integração/orientação de novo morador em condomínio já cliente explica regras existentes aprovadas/fornecidas, WhatsApp e sistema; cadastro breve nome, telefone, apartamento; CPF condicional ao financeiro. Sem requisito jurídico de assembleia, regra inventada ou exclusividade. Preço/pacote, frequência, capacidade, responsáveis e presencial/remoto da orientação a definir; sem contato/agenda/execução agora.',
}
for id,text in requirements.items():m[id]['criteria']=text;m[id]['revisionNote']='Terminologia e assessoria atual esclarecidas em 08/10/2026; implantação/orientação, sem operação recorrente automática. Registros preservados.'
for old,new in zip(before['tasks'],d['tasks']):
 for f in ['id','deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(f)==new.get(f)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for id,text in requirements.items():t=t.replace('Conclui quando: '+next(x for x in before['tasks'] if x['id']==id)['criteria'],'Conclui quando: '+text)
p.write_text(t)
print('Assessoria atual e terminologia corrigidas; registros preservados.')
