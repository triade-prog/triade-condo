from pathlib import Path
import re,html,json
root=Path.cwd();folder=root/'estruturação do sistema';source=(folder/'proposta-decisoes-construcao.md').read_text()
def inline(s):
 s=html.escape(s);s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s);return re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m:f'<a href="{m[2]}">{m[1]}</a>',s)
parts=source.split('\n## ');nav='';content=''
for i,part in enumerate(parts[1:]):
 title,body=part.split('\n',1);id=f'parte-{i+1}';nav+=f'<a href="#{id}">{html.escape(title)}</a>';lines=body.splitlines();render=[];j=0
 while j<len(lines):
  line=lines[j]
  if line.startswith('|'):
   rows=[]
   while j<len(lines) and lines[j].startswith('|'):rows.append(lines[j]);j+=1
   cells=lambda r:[inline(x.strip()) for x in r.strip('|').split('|')]
   render.append('<div class="tablewrap"><table><thead><tr>'+''.join('<th scope="col">'+x+'</th>' for x in cells(rows[0]))+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+x+'</td>' for x in cells(row))+'</tr>' for row in rows[2:])+'</tbody></table></div>');continue
  if line.strip():render.append('<p>'+inline(line)+'</p>')
  j+=1
 content+=f'<section id="{id}"><h2>{html.escape(title)}</h2>'+''.join(render)+'</section>'
css=re.search(r'<style>([\s\S]*?)</style>',(folder/'relatorio-revisao-desenvolvimento.html').read_text())[1]
page=f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposta de construção · TRÍADE Condo</title><style>{css}</style></head><body><header><p>08/10/2026 · proposta para revisão</p><h1>Como construir o TRÍADE Condo</h1><p class="notice"><strong>Sete recomendações para aprovação.</strong> Nenhuma nova regra aplicada, fornecedor contratado ou produto implementado. Os padrões sugeridos e as escolhas de Carolina estão separados em cada área.</p><p><a href="proposta-decisoes-construcao.md">Documento Markdown</a> · <a href="relatorio-revisao-desenvolvimento.html">Auditoria</a> · <a href="../mapa-da-empresa.html">Mapa</a></p><button id="print">Imprimir / salvar PDF</button></header><main class="layout"><nav aria-label="Áreas da proposta">{nav}</nav><article>{content}</article></main><footer>Revisar R1–R7 e registrar escolhas antes de atualizar a especificação. Não há aprovação automática.</footer><script>document.getElementById('print').onclick=()=>window.print();</script></body></html>'''
(folder/'proposta-decisoes-construcao.html').write_text(page)
p=folder/'README.md';p.write_text(p.read_text()+'\n## Recomendações para fechar as sete pendências\n\n[Proposta Markdown](proposta-decisoes-construcao.md) e [leitura navegável](proposta-decisoes-construcao.html): padrões R1–R7, funcionamento/razão, escolhas concretas, aceite, arquitetura e sequência com fontes oficiais. Não substitui decisões aprovadas nem aplica novas regras.\n')
p=root/'mapa-da-empresa.html';s=p.read_text();m=re.search(r'(<script id="map-data" type="application/json">)([\s\S]*?)(</script>)',s);d=json.loads(m[2]);dev=next(x for x in next(x for x in d if x['id']=='sistema')['children'] if x['id']=='desenvolvimento');dev['children'].insert(0,dict(id='proposta-construcao',title='Recomendações para as sete pendências',status='proposto',text='Proposta R1–R7 com padrões, escolhas de Carolina, critérios e sequência. Documento disponível para revisão; novas regras não aprovadas nem implementadas.',children=[],link='estruturação do sistema/proposta-decisoes-construcao.html'));s=s[:m.start(2)]+json.dumps(d,ensure_ascii=False).replace('</','<\\/')+s[m.end(2):];p.write_text(s)
p=root/'memory/2026-10-08.md';p.write_text(p.read_text()+'\n## Proposta para fechar sete pendências, sem aplicar regras\n- Criados proposta-decisoes-construcao.md/html: R1 vínculos/permissões, R2 WhatsApp falhas/pessoa responsável, R3 documentos privados distribuídos/consultados no próprio WhatsApp (limite revogação após download), R4 configuração IDs/versões/conflitos, R5 identidade mantida/e-mail/reset/MFA propostos, R6 obrigações por competência e recebimentos, R7 revisão visual/acessibilidade. Cada área padrão/razão/decisões Carolina/aceite; arquitetura modular proporcional, sequência/custos sem números comerciais.\n- Fontes atuais oficiais OWASP, Twilio, W3C, RFC9110, PostgreSQL e ANPD consultadas. Metawebhook abriu erro; não atribuir regra não verificada. Parâmetros cinco tentativas/30min/10MB são propostas explícitas, não obrigações ou aprovações. Preservada plataforma vs serviços e escopo MVP; nenhuma nova regra implementada/catalogtask aprovada. Link README/mapa como proposta.\n')
print('Proposta navegável criada; mapa marcado como proposto.')
