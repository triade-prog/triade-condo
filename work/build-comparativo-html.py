from pathlib import Path
import json
root=Path('/Users/carolina/Documents/Codex/2026-10-03/triade-condo')
data=json.loads((root/'work/comparativo-web-data.json').read_text())
template=(root/'work/comparativo-template.html').read_text()
payload=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
html=template.replace('__DATA__',payload)
path=root/'outputs/triade-condo/pesquisa/comparativo-cenarios-saas-2026-10-07.html'
path.write_text(html)
assert '__DATA__' not in html
assert len(data['offers'])==42
assert len(data['matrix'])==15
assert all(len(r)==14 for r in data['matrix'])
assert all(r[0] in ['C01','C02','C03'] for r in data['offers'])
assert all(sum(r[0]==s[0] for r in data['offers'])==14 for s in data['scenarios'])
assert not any(x in html for x in ['<script src=','<link rel="stylesheet"','fetch(','XMLHttpRequest','localStorage'])
assert 'lang="pt-BR"' in html and 'name="viewport"' in html
print(str(path))
