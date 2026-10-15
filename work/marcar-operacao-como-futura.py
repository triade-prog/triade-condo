from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
p=root/'outputs/triade-condo/construcao/catalogo.json';d=json.loads(p.read_text());plan=root/'outputs/triade-condo/docs/plano-execucao.md';text=plan.read_text();count=0
for t in d['tasks']:
 if t.get('scope')=='Adicional humano opcional':
  old=t['criteria'];t['criteria']='Hipótese futura de assessoria operacional recorrente, distinta da assessoria atual de implantação/orientação; sem inclusão automática na oferta vigente. '+old
  t['revisionNote']='Enquadramento esclarecido em 08/10/2026: operação recorrente apenas hipótese opcional futura. IDs, status e registros preservados.'
  text=text.replace('Conclui quando: '+old,'Conclui quando: '+t['criteria']);count+=1
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(root/'outputs/triade-condo/construcao/js/catalog.js').write_text('globalThis.TriadeCatalog = '+json.dumps(d,ensure_ascii=False,indent=2)+';\n');plan.write_text(text)
print(count,'critérios operacionais identificados como hipótese futura; sem alterar IDs ou status.')
