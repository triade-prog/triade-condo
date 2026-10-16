"""Add native URL links absent from the authoring runtime, then validate export."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json, xml.etree.ElementTree as E
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
path=root/'outputs/triade-condo/pesquisa/comparativo-cenarios-saas-2026-10-07.xlsx'
data=json.loads((root/'work/comparativo-data.json').read_text())
ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
rn='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
pn='http://schemas.openxmlformats.org/package/2006/relationships'
E.register_namespace('',ns);E.register_namespace('r',rn)
with ZipFile(path) as z: parts={n:z.read(n) for n in z.namelist()}
sheet='xl/worksheets/sheet6.xml'
rel='xl/worksheets/_rels/sheet6.xml.rels'
xml=E.fromstring(parts[sheet])
old=xml.find('{'+ns+'}hyperlinks')
if old is not None:xml.remove(old)
rels=E.fromstring(parts[rel]) if rel in parts else E.Element('{'+pn+'}Relationships')
for r in list(rels):
 if r.attrib.get('Id','').startswith('triadeSource'):rels.remove(r)
links=E.Element('{'+ns+'}hyperlinks')
for i,s in enumerate(data['sources']):
 rid='triadeSource'+str(i+1)
 E.SubElement(links,'{'+ns+'}hyperlink',{'ref':f'D{i+6}','{'+rn+'}id':rid})
 E.SubElement(rels,'{'+pn+'}Relationship',{'Id':rid,'Type':rn+'/hyperlink','Target':s[3],'TargetMode':'External'})
following={'printOptions','pageMargins','pageSetup','headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst'}
idx=next((i for i,c in enumerate(xml) if c.tag.split('}')[-1] in following),len(xml))
xml.insert(idx,links)
parts[sheet]=E.tostring(xml,encoding='utf-8',xml_declaration=True)
parts[rel]=E.tostring(rels,encoding='utf-8',xml_declaration=True)
# Exporter may omit the autoFilter element despite showFilterButton=True.
for n in list(parts):
 if n.startswith('xl/tables/table') and n.endswith('.xml'):
  t=E.fromstring(parts[n])
  if t.find('{'+ns+'}autoFilter') is None:
   t.insert(0,E.Element('{'+ns+'}autoFilter',{'ref':t.attrib['ref']}))
   parts[n]=E.tostring(t,encoding='utf-8',xml_declaration=True)
temporary=root/'work/comparativo-final.xlsx'
with ZipFile(temporary,'w',ZIP_DEFLATED) as z:
 for n,b in parts.items():z.writestr(n,b)
temporary.replace(path)
# Verify native structure, values and source links from the actual exported file.
with ZipFile(path) as z:
 assert z.testzip() is None
 book=E.fromstring(z.read('xl/workbook.xml'))
 names=[s.attrib['name'] for s in book.find('{'+ns+'}sheets')]
 assert len(names)==6 and len(set(names))==6
 tables=[n for n in z.namelist() if n.startswith('xl/tables/table') and n.endswith('.xml')]
 assert len(tables)==11
 for n in tables:assert E.fromstring(z.read(n)).find('{'+ns+'}autoFilter') is not None
 for i in range(1,7):
  x=E.fromstring(z.read(f'xl/worksheets/sheet{i}.xml'))
  assert x.find('.//{'+ns+'}pane') is not None
  assert not [c for c in x.iter('{'+ns+'}c') if c.attrib.get('t')=='e']
  assert not list(x.iter('{'+ns+'}f'))
 x=E.fromstring(z.read(sheet));assert len(x.find('{'+ns+'}hyperlinks'))==len(data['sources'])
 rels=E.fromstring(z.read(rel)); targets={r.attrib['Target'] for r in rels if r.attrib.get('TargetMode')=='External'}
 assert all(s[3] in targets for s in data['sources'])
 x=E.fromstring(z.read('xl/worksheets/sheet3.xml'))
 cells={c.attrib['r']:c for c in x.iter('{'+ns+'}c')}
 assert float(cells['E11'].find('{'+ns+'}v').text)==99.99
 assert float(cells['E18'].find('{'+ns+'}v').text)==24.90
 assert cells['J6'].attrib.get('t') not in ['s','inlineStr']
 x=E.fromstring(z.read('xl/worksheets/sheet5.xml'))
 assert x.find('{'+ns+'}dataValidations') is not None
 shared=E.fromstring(z.read('xl/sharedStrings.xml')) if 'xl/sharedStrings.xml' in z.namelist() else None
 strings=[''.join(n.itertext()) for n in shared] if shared is not None else []
 def extract(sheet_id,start,end,count):
  x=E.fromstring(z.read(f'xl/worksheets/sheet{sheet_id}.xml'))
  result=[]
  for r in x.findall('.//{'+ns+'}row'):
   if not start<=int(r.attrib['r'])<=end:continue
   row=['']*count
   for c in r.findall('{'+ns+'}c'):
    address=c.attrib['r']; letters=''.join(a for a in address if a.isalpha()); idx=0
    for a in letters:idx=idx*26+ord(a)-64
    v=c.find('{'+ns+'}v');typ=c.attrib.get('t')
    text=v.text if v is not None else ''.join(c.find('{'+ns+'}is').itertext()) if c.find('{'+ns+'}is') is not None else ''
    value=strings[int(text)] if typ=='s' else text
    if idx<=count:row[idx-1]=value
   result.append(row)
  return result
 data['matrix']=extract(4,6,20,14)
 data['focus']=extract(5,6,9,10)
 data['stages']=extract(5,13,16,4)
 data['levels']=extract(5,20,22,4)
 data['offers']=extract(2,6,47,11)
 assert len(data['offers'])==42 and len(data['matrix'])==15
 (root/'work/comparativo-web-data.json').write_text(json.dumps(data,ensure_ascii=False))
 report={'abas':names,'tabelas_com_filtro':len(tables),'links_nativos':len(data['sources']),'ofertas_por_cenario':42,'matriz':'14 SaaS + TRÍADE; 12 funcionalidades','erros_celula':0,'preco_e_data':'valores tipados verificados','decisao':'lista editável verificada','aplicativo_excel':'não testado em sessão nativa'}
 (root/'work/comparativo-validacao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False))
