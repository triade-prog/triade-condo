from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
note='''
## Estrutura inicial de disponibilização por planos — 08/10/2026
A usuária decidiu criar níveis/planos de disponibilização de funcionalidades. A tabela descreve a estrutura inicial da oferta, sem nomes comerciais, preços ou composição final aprovados.

| Nível proposto (descrição, não nome comercial) | Direção de recursos | Fronteiras a definir |
| --- | --- | --- |
| Básico | Atendimento e controle | Recursos exatos, limites, nome e preço |
| Ampliação | Nível que inclua coordenação e agenda; adquirir mais funcionalidades conforme plano | Composição e limites; coordenação não implica equipe TRÍADE executar manutenção |
| Serviços associados e evolução | Implantação de novo condomínio cliente, integração/orientação de novo morador em condomínio já cliente e apoio documental | Inclusão em cada plano, preço/pacote, frequência e capacidade ainda a definir; financeiro/boleto seguem evolução a decidir, armário após primeiros clientes |

Plano define acesso comercial aos recursos, não dependências artificiais no fluxo. Funções continuam opcionais/autônomas dentro dos recursos disponibilizados: orçamento não exige pagamento e chamados não exigem financeiro. Compartilhar dados quando útil preserva vínculos essenciais de identidade, autorização e coerência, sem percurso compulsório. A decisão atual esclarece a pendência anterior de como disponibilizar recursos; composição final e arquitetura seguem abertas. Preservar cenários variados, Brasília/DF, número institucional próprio de WhatsApp como pré-requisito, morador 100% WhatsApp, síndico painel/avisos WhatsApp e assessoria atual de implantação/orientação. Apenas registros, sem pesquisa, preços inventados, MVP, divulgação ou contratação.
'''
for relative in ['outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md','outputs/triade-condo/docs/revisao-modelos-2026-10-07.md','outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/README.md','memory/2026-10-08.md']:
 p=root/relative;t=p.read_text()
 if 'sintese-cenarios' in relative:t=t.replace('10 tabelas com filtro','11 tabelas com filtro').replace('14 verificações em DOM simulado','15 verificações em DOM simulado')
 p.write_text(t+note)
p=root/'work/comparativo-template.html';t=p.read_text();anchor='function render(){';assert anchor in t
fn='''function levelsMarkup(){return '<section class="card"><h3>Níveis propostos de funcionalidades</h3><p>Básico: atendimento e controle. Ampliação: coordenação e agenda. Descrições de níveis; nomes, preços e composição final não aprovados.</p><div class="grid">'+data.levels.map(r=>'<article class="card"><h3>'+esc(r[0])+'</h3>'+dl([['Recursos/escopo',r[1]],['Fronteira pendente',r[2]],['Independência',r[3]]])+'</article>').join('')+'</div><p>Plano define acesso comercial, sem dependências artificiais: orçamento não exige pagamento; chamados não exigem financeiro. Coordenação não significa equipe TRÍADE executando manutenção. Inclusão de implantação, orientação de moradores e apoio documental por plano a definir.</p></section>';}
'''
t=t.replace(anchor,fn+anchor)
needle="view.innerHTML='<h2>Foco inicial e evolução</h2><div class=\"intro\">";assert needle in t
t=t.replace(needle,"view.innerHTML='<h2>Foco inicial e evolução</h2>'+levelsMarkup()+'<div class=\"intro\">")
t=t.replace('<h3>Roteiro para nossa explicação</h3>','<p><strong>Estrutura inicial por planos:</strong> básico de atendimento/controle; ampliação com coordenação/agenda. Plano define acesso comercial, sem obrigar orçamento a usar pagamentos ou chamados a usar financeiro. Nomes, preços, composição final e inclusão da assessoria por plano a definir. Veja a tabela em Foco e evolução.</p><h3>Roteiro para nossa explicação</h3>')
p.write_text(t)
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());before=json.loads(json.dumps(d));m={x['id']:x for x in d['tasks']}
addition=' Estrutura inicial de planos decidida: básico com atendimento/controle; ampliação com coordenação/agenda, adquirindo mais recursos conforme plano. Nomes, preços e composição final não aprovados; inclusão de implantação/orientação/apoio documental por plano a definir. Plano regula acesso comercial, sem dependência artificial: orçamento sem pagamento, chamados sem financeiro. Coordenação não implica execução de manutenção pela TRÍADE; financeiro/boleto evolução a decidir e armário após primeiros clientes. Sem contratação, divulgação ou implementação agora.'
for id in ['PROD-02','PROD-05']:m[id]['criteria']+=addition;m[id]['revisionNote']='Estrutura inicial por planos registrada em 08/10/2026; fronteiras/composição pendentes, funções independentes; registros preservados.'
for old,new in zip(before['tasks'],d['tasks']):
 for f in ['id','deps','status','owner','notes','evidence','updatedAt','priority','scope']:assert old.get(f)==new.get(f)
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n')
p=root/'outputs/triade-condo/docs/plano-execucao.md';t=p.read_text()
for id in ['PROD-02','PROD-05']:t=t.replace('Conclui quando: '+next(x for x in before['tasks'] if x['id']==id)['criteria'],'Conclui quando: '+m[id]['criteria'])
p.write_text(t)
print('Níveis propostos registrados; composição/preço/arquitetura em aberto, IDs e registros preservados.')
