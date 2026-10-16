from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote,urlsplit
import json,re
root=Path.cwd();errors=[];checked=0
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  for k in ('href','src'):
   if k in a:self.links.append(a[k])
files=[root/'mapa-da-empresa.html']+list((root/'estruturação do sistema').glob('*.html'))+list((root/'outputs/triade-condo').rglob('*.html'))
for p in files:
 parser=Links();parser.feed(p.read_text());
 if len(parser.ids)!=len(set(parser.ids)):errors.append((str(p),'duplicate ids'))
 for h in parser.links:
  if h.startswith(('http:','https:','blob:','data:','mailto:')) or '${' in h:continue
  u=urlsplit(h)
  if not u.path:
   if u.fragment and u.fragment not in parser.ids:
    # Research panel uses runtime hash routes, not static anchors.
    if p.name!='comparativo-cenarios-saas-2026-10-07.html':errors.append((str(p),h))
  elif not (p.parent/unquote(u.path)).exists():errors.append((str(p),h))
  checked+=1
# Map's branch links stored as JSON data.
s=(root/'mapa-da-empresa.html').read_text();data=json.loads(re.search(r'<script id="map-data" type="application/json">([\s\S]*?)</script>',s)[1])
def walk(a):
 for n in a:
  if n.get('link'):
   assert (root/n['link']).exists(),n['link']
  walk(n['children'])
walk(data)
assert not errors,errors
# Old task IDs and fields preserved except documented application classification. Dates/evidence/status remain.
import zipfile
with zipfile.ZipFile(root/'outputs/entregas/revisao-2026-10-08/backup-antes-auditoria.zip') as z:old=json.loads(z.read('outputs/triade-condo/construcao/catalogo.json'))
new=json.loads((root/'outputs/triade-condo/construcao/catalogo.json').read_text());byid={x['id']:x for x in new['tasks']}
for t in old['tasks']:
 for k in ['status','owner','notes','evidence','updatedAt','baseline']:assert t.get(k)==byid[t['id']].get(k),(t['id'],k)
assert len(byid)==len(new['tasks'])==109
(root/'work/auditoria-links-validacao.json').write_text(json.dumps({'htmlFiles':len(files),'localLinksChecked':checked,'oldTaskRecordsPreserved':len(old['tasks']),'tasks':109,'errors':[],'visualBrowserVerified':False},indent=2))
print(f'{len(files)} HTMLs / {checked} links locais verificados; {len(old["tasks"])} tarefas pré-auditoria preservadas.')
