from pathlib import Path
import json,re,copy
p=Path('work/comparativo-template.html');s=p.read_text()
notice='<section class="notice"><h3>Decisão vigente · não desenvolver orçamentos/propostas agora</h3><p>Fora da oferta e do desenvolvimento inicial. Pesquisa preservada apenas como referência de evolução; reavaliar somente se a necessidade surgir e for validada nos primeiros clientes, sem compromisso de construção. Pode-se acompanhar uma pendência por tarefa simples existente ou processo acordado, sem comparação de propostas, aprovação de cotações, portal de fornecedor ou módulo disfarçado. A TRÍADE não assume selecionar fornecedor, contratar ou comprar pelo cliente.</p></section>'
def change(name,fn):
 global s
 m=re.search(r'function '+name+r'\(\)\{return (.*?);\}\n',s);v=fn(json.loads(m[1]));s=s[:m.start(1)]+json.dumps(v,ensure_ascii=False)+s[m.end(1):]
def product(v):
 v=re.sub(r'<article class="card"><h3>Orçamentos e propostas</h3>.*?</article>','',v,flags=re.S)
 v=re.sub(r'<tr><td>Atendimento \+ orçamentos</td>.*?</tr>','',v,flags=re.S)
 v=v.replace('Agenda, manutenção, orçamentos, comunicados e documentos aparecem no painel.','Agenda, manutenção, comunicados e documentos aparecem no painel.')
 v=v.replace('Usa agenda e orçamento se escolhidos, mas mantém','Usa agenda se escolhida, mas mantém')
 v=v.replace('agenda, manutenção, orçamento e comunicação/documentos ampliados','agenda, manutenção e comunicação/documentos ampliados')
 v=v.replace('Atendimento funciona sem financeiro, agenda de manutenção ou pagamento.','Atendimento funciona sem financeiro, agenda de manutenção ou pagamento.')
 return notice+v
change('levelsMarkup',product)
def development(v):
 v=v.replace('priorizar agenda, coordenação de manutenção, orçamentos e gestão ampliada','priorizar agenda, coordenação de manutenção e gestão ampliada').replace('Priorizar agenda, coordenação de manutenção, orçamentos e gestão ampliada','Priorizar agenda, coordenação de manutenção e gestão ampliada')
 return notice+v
change('developmentMarkup',development)
def quotations(v):
 v=v.replace('Para discutirmos:</strong> o conjunto deve organizar uma necessidade, propostas comparáveis e uma decisão rastreável; não precisa executar pagamentos.','Referência histórica para evolução:</strong> o fluxo pesquisado não será desenvolvido agora. Não representa próximo passo aprovado.')
 v=v.replace('O que a comparação ensina — inferência para TRÍADE','Aprendizados preservados para eventual evolução')
 v=v.replace('Fluxo simples proposto para TRÍADE — ainda não implementado','Fluxo anteriormente proposto — arquivado como referência futura')
 v=v.replace('Perfis e fronteiras do conjunto proposto','Perfis estudados para eventual módulo futuro')
 v=v.replace('Evolução possível e pontos a decidir','Somente se surgir necessidade validada nos primeiros clientes')
 v=v.replace('Começar com registro/anexo pelo síndico; envio direto por link como evolução, preservando alternativa manual.','Não iniciar registro estruturado/comparação agora; ambos ficam como referência de eventual módulo futuro.')
 v=v.replace('Para nossa revisão:</strong> registro manual com anexo basta no primeiro recorte? Fornecedor precisa enviar por link desde o início? Quem aprova e o que recebe o conselho/morador? Comparação por serviço completo ou item? Acompanhamento de aceite/entrega entra aqui ou é compartilhado com manutenção? Sem preço, MVP aprovado ou implementação.','Reavaliação futura:</strong> os primeiros clientes apresentam necessidade que uma tarefa simples não resolve? Somente depois disso discutir um módulo e seus limites. Nenhuma destas etapas ou telas entra no desenvolvimento inicial.')
 return notice+v
change('quotationsMarkup',quotations)
def pricing(v):
 v=v.replace('agenda/manutenção/orçamentos/gestão ampliada','agenda/manutenção/gestão ampliada').replace('atendimento completo + orçamentos','atendimento completo + agenda, se necessária')
 return notice+v
change('pricingMarkup',pricing)
s=s.replace("['orcamentos','Cotações · aprofundamento']","['orcamentos','Cotações · referência futura']")
s=s.replace('Veja como outros sistemas recebem, comparam e decidem propostas; revise o fluxo TRÍADE.','Pesquisa preservada para futuro; cotações ficam fora do desenvolvimento e da oferta inicial.')
s=s.replace('Sem pacotes, preços ou arquitetura definitivos; MVP continua focado.','Sem pacotes, preços ou arquitetura definitivos; MVP continua focado. Orçamentos/propostas não serão desenvolvidos agora; eventual pendência pode ser acompanhada por tarefa simples, sem módulo próprio.')
p.write_text(s)
note='''\n## Decisão vigente — orçamentos/propostas fora do desenvolvimento inicial (08/10/2026)\n\nA usuária decidiu não desenvolver propostas/orçamentos agora. Retirados dos conjuntos e exemplos de plano inicial no HTML. A pesquisa e o fluxo anteriormente proposto permanecem apenas como referência futura, sob necessidade surgida e validada nos primeiros clientes, sem compromisso de construção. Esta decisão prevalece sobre sugestões anteriores de incluir registro/comparação de propostas no recorte inicial.\n\nSe necessário, acompanhar uma pendência por tarefa simples existente ou processo acordado, sem construir comparação, aprovação de cotações, portal do fornecedor ou módulo próprio disfarçado. Isso não atribui à TRÍADE seleção de fornecedores, contratação ou compra pelo condomínio. Atendimento completo, agenda/manutenção e fronteiras de comunicação/documentos continuam em revisão; perfis e operação interna permanecem separados.\n\n'''
for rel in ['outputs/triade-condo/pesquisa/sintese-cenarios-saas-2026-10-07.md','outputs/triade-condo/pesquisa/aprofundamento-cotacoes-propostas-2026-10-08.md','outputs/triade-condo/docs/produto.md','outputs/triade-condo/docs/arquitetura.md','outputs/triade-condo/docs/plano-execucao.md']:
 p=Path(rel);txt=p.read_text();lines=txt.splitlines(keepends=True);lines.insert(1,note);txt=''.join(lines)
 txt=txt.replace('agenda/compromissos; coordenação de manutenção; orçamentos/propostas; gestão ampliada','agenda/compromissos; coordenação de manutenção; gestão ampliada')
 p.write_text(txt)
p=Path('memory/2026-10-08.md');p.write_text(p.read_text()+note)
# Update current commercial criteria, preserve task states/dependencies.
p=Path('outputs/triade-condo/construcao/catalogo.json');x=json.loads(p.read_text());before=copy.deepcopy(x)
prefix='Decisão vigente: não desenvolver orçamentos/propostas agora; fora dos conjuntos/exemplos de plano e desenvolvimento inicial. Pesquisa apenas referência futura, condicionada à necessidade validada nos primeiros clientes. Pendência pode ser acompanhada por tarefa simples existente, sem comparação/aprovação de cotações/portal ou módulo disfarçado. TRÍADE não seleciona fornecedor nem compra pelo cliente. '
for t in x['tasks']:
 if t['id'] in ['PROD-02','PROD-05']:t['criteria']=prefix+t['criteria']
for a,b in zip(before['tasks'],x['tasks']):assert {k:v for k,v in a.items() if k!='criteria'}=={k:v for k,v in b.items() if k!='criteria'}
p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n');Path('outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(x,ensure_ascii=False,indent=2)+';\n')
print('Decisão registrada; pesquisa preservada e oferta inicial ajustada.')
