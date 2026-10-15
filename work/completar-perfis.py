from pathlib import Path
import json,re
p=Path('work/comparativo-template.html');s=p.read_text()
m=re.search(r'function levelsMarkup\(\)\{return (.*?);\}\n',s)
h=json.loads(m[1])
def sides(manager,resident,access):
 return '<div class="profile-grid"><div class="profile"><strong>Síndico — acesso pelo painel</strong><p>'+manager+'</p></div><div class="profile"><strong>Morador — acesso pelo WhatsApp</strong><p>'+resident+'</p></div></div><p class="access"><strong>Ao compor o plano:</strong> '+access+'</p>'
h=h.replace('<p><strong>Dependências internas reais:</strong>',sides('Registra e acompanha pedidos; administra fila, responsável, prioridade, andamento, próximo retorno e estimativa; conclui e consulta histórico. Prepara/publica avisos e disponibiliza documentos vigentes.','Envia pedido, recebe retorno e andamento, consulta estimativa quando conhecida e conclusão; retoma o assunto. Recebe/consulta avisos e regras disponibilizadas.','Tudo isto está incluído no conjunto de atendimento. Nenhuma etapa interna é uma opção contratável separada.')+'<p><strong>Dependências internas reais:</strong>')
insertions=[
('Agenda e compromissos','Cria calendário, tarefas e compromissos; atribui responsável, data e lembretes; acompanha cumprimento.','Recebe pelo WhatsApp informações de compromissos que lhe dizem respeito, quando disponibilizadas. Não acessa o calendário administrativo nem o painel.','Adiciona gestão de calendário ao síndico e avisos pertinentes ao morador. O retorno e a estimativa do atendimento já estão na base.'),
('Coordenação de manutenção','Planeja manutenção, indica executor, acompanha etapas, pendências e resultado; vincula atendimento quando útil.','Recebe avisos sobre impacto da manutenção e atualizações do seu pedido pelo WhatsApp; pode relatar problema. Não assume coordenação nem contrata prestador pelo sistema.','Adiciona planejamento e acompanhamento do serviço ao síndico. Relato, retorno e conclusão do pedido do morador já estão na base.'),
('Orçamentos e propostas','Registra propostas, valores e condições, compara fornecedores e guarda decisão conforme suas atribuições.','Mantém pedidos e retornos pelo WhatsApp. Recebe informação aprovada e disponibilizada, quando pertinente; não vê automaticamente propostas, aprova gastos ou paga.','Adiciona comparação/registro de propostas ao síndico. Não cria função financeira nem dependência de pagamento para o morador.'),
('Gestão ampliada de comunicação e documentos','Planeja campanhas e revisões; organiza arquivo administrativo, versões e permissões conforme a fronteira validada.','Recebe/consulta o conteúdo autorizado e disponibilizado pelo WhatsApp. Não acessa arquivo administrativo, versões restritas ou painel.','Adiciona controle administrativo ao síndico; melhora organização do conteúdo entregue. Publicar aviso e consultar documento vigente já pertencem à base.')]
for title,a,b,c in insertions:
 needle='<h3>'+title+'</h3>'
 pos=h.index('</article>',h.index(needle))
 h=h[:pos]+sides(a,b,c)+h[pos:]
start=h.index('<ol class="steps">',h.index('Como compor o plano'))
end=h.index('</ol>',start)+len('</ol>')
rows=[
('Atendimento completo','Fila, responsável, prioridade, retorno, estimativa disponível, conclusão, histórico, avisos e documentos essenciais.','Pedidos, acompanhamento e consulta de avisos/documentos pelo WhatsApp.','Base inteira; nenhuma subfunção como extra.'),
('Atendimento + manutenção + agenda (se necessária)','Base + planejamento de manutenção + calendário compartilhado, responsáveis e compromissos.','Base + avisos pertinentes de intervenção e compromissos no WhatsApp.','Acrescenta coordenação e calendário; retorno do pedido permanece na base.'),
('Atendimento + orçamentos','Base + cadastro/comparação de propostas e registro de decisão.','Base; recebe apenas informação pertinente disponibilizada no WhatsApp.','Acrescenta gestão de propostas; sem pagamento ou acesso automático a dados internos.'),
('Atendimento + conjuntos administrativos escolhidos','Base + capacidades dos conjuntos selecionados; gestão ampliada de campanhas/arquivo se contratada.','Base + conteúdo autorizado e avisos pertinentes no WhatsApp.','Somam-se conjuntos completos; o morador continua sem portal/painel.')]
table='<div class="table-wrap"><table class="plan-table"><caption>Composições ilustrativas — nomes e preços a definir</caption><thead><tr><th>Composição</th><th>Síndico — acesso pelo painel</th><th>Morador — acesso pelo WhatsApp</th><th>O que já está incluído / o que acrescenta</th></tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+v+'</td>' for v in r)+'</tr>' for r in rows)+'</tbody></table></div>'
h=h[:start]+table+h[end:]
s=s[:m.start(1)]+json.dumps(h,ensure_ascii=False)+s[m.end(1):]
s=s.replace('</style>','.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.profile{background:#f0f6f5;border:1px solid var(--line);border-radius:8px;padding:14px}.profile p{margin-bottom:0}.access{border-left:3px solid var(--accent);padding-left:12px}.table-wrap{overflow-x:auto}.plan-table{border-collapse:collapse;width:100%;min-width:700px;font-size:15px}.plan-table caption{text-align:left;font-weight:600;padding:8px 0}.plan-table th,.plan-table td{padding:14px;border:1px solid var(--line);text-align:left;vertical-align:top}.plan-table th{background:var(--ink);color:white}.plan-table tbody tr:nth-child(even){background:#f0f6f5}@media(max-width:740px){.profile-grid{grid-template-columns:1fr}}\n</style>')
p.write_text(s)
