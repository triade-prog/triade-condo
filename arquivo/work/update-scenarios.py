from pathlib import Path
p=Path('work/build-roadmap.py');s=p.read_text()
insert='''# Cenários de estrutura operacional: descoberta ampla, MVP a recortar.
scenario_changes={
'PROD-01':dict(criteria='Pesquisar fontes públicas sobre necessidades em edifícios residenciais com portaria presencial/atendente, online/remota e sem portaria, incluindo vários andares/apartamentos com síndico morador e pouca estrutura. Sem cliente inicial; pesquisa gera hipóteses, não valida demanda/pagamento.'),
'PROD-03':dict(title='Comparar dores, fluxos e oferta entre cenários de portaria',criteria='Comparar fontes públicas por cenário: dores, fluxos, responsáveis disponíveis e impacto na oferta/venda. Registrar fontes e lacunas, sem presumir porteiro, zelador, equipe, administradora ou prestador fixo; portaria remota não implica manutenção nem integração técnica.'),
'PROD-02':dict(criteria='Após pesquisa pública, estruturar necessidade, público, oferta e venda e escolher recorte. Os cenários amplos não são todos escopo obrigatório do MVP; não há oferta ou público validados.'),
'DEC-06':dict(criteria='Mapear quem tria, acompanha, viabiliza acesso à manutenção, faz vistoria, coleta/checa evidências, revisa e comunica em cada cenário/modelo. Síndico pode executar/atribuir; não presumir equipe local. Portaria remota não é automaticamente mantenedora/revisora; adicional TRÍADE opcional.'),
'DEC-01':dict(criteria='Permissões por função/vínculo permitem rotina do síndico sem equipe. Não criar direitos automáticos por haver portaria presencial/remota, administradora ou fornecedor; acesso TRÍADE somente autorizado no adicional. Autoridades de decisão preservadas.'),
'TIC-02':dict(criteria='Síndico ou responsável disponível autorizado faz triagem e atribuição com urgência, dados faltantes, duplicidade e acesso ao local. Registrar responsável real e impedimento quando necessário, sem inventar equipe, zelador ou prestador fixo.'),
'SERV-05':dict(criteria='Planejar checklist/vistoria, acesso, responsável e coleta de fotos/evidências para os três cenários; síndico pode executar/atribuir. Se acesso ou executor não estiver disponível, registrar impedimento; não exigir equipe local ou envio TRÍADE.'),
'SERV-06':dict(criteria='Planejar coordenação de prestadores eventuais ou existentes pelo síndico/executor autorizado. Identificar quem combina acesso e acompanha visita, sem presumir prestador fixo, administradora, porteiro ou equipe.'),
'VIS-01':dict(criteria='Se selecionado para MVP, registrar vistoria/checklist, responsável, acesso, impedimentos e evidências por chamado/local. Síndico pode executar/atribuir mesmo sem portaria; nenhuma função automaticamente atribuída a portaria remota.'),
'EVI-01':dict(criteria='Se selecionado para MVP, upload privado com validação e vínculo; evidência pode vir do síndico ou executor autorizado, sem depender de porteiro/zelador/equipe local. Tipos e meios de coleta a definir após pesquisa.'),
'END-01':dict(criteria='Evidência e explicação checadas/revisadas pelo síndico ou revisor autorizado; preservar histórico, decisões pendentes e justificativa. Não exigir equipe local, segunda pessoa TRÍADE ou revisão por portaria remota.'),
'WA-04':dict(criteria='Planejar comunicação por responsável/modelo/cenário, distinguindo automático, disponibilidade e emergência. Não depender de portaria para receber/encaminhar demandas nem presumir conexão técnica com fornecedor de portaria.'),
'PROD-05':dict(criteria='Após necessidade/público/oferta/venda e pesquisa dos cenários, escolher recorte e MVP focado; outros cenários ficam como hipóteses/evolução. Depois desenvolver e oferecer a alguns síndicos para teste, sem entrevistas prévias obrigatórias.'),
'ADD-04':dict(criteria='Pesquisar e definir quais atividades exigem presença local, quem viabiliza acesso e quem executa por cenário. Adicional opcional; ausência de portaria não obriga contratar equipe TRÍADE.')
}
for t in rows:
 if t['id'] in scenario_changes:
  t.update(scenario_changes[t['id']])
  t['revisionNote']='Critérios revistos em 07/10/2026 para os dois modelos e cenários de portaria. Registros locais preservados; revisar conclusões antigas. Cenários são hipóteses, não escopo aprovado do MVP.'
'''
s=s.replace("catalog=dict(version=1",insert+"\ncatalog=dict(version=1")
s=s.replace('## Catálogo completo','## Cenários para pesquisa, sem ampliar automaticamente o MVP\nPesquisar edifícios residenciais com portaria presencial/atendente, online/remota e sem qualquer portaria, inclusive vários andares e apartamentos com síndico morador e pouca estrutura. Não presumir porteiro, zelador, equipe local, administradora ou prestador fixo. “Nem é condomínio, é um prédio” descreve pouca estrutura operacional, não classificação jurídica.\n\nPROD-01/03 registram pesquisa das diferenças de dores, fluxos, responsáveis e impacto na oferta. DEC-06 e SERV-05/06 tratam triagem, atribuição, acesso à manutenção, vistoria, evidências, revisão e comunicação. O síndico pode executar/atribuir; adicional humano permanece opcional. Portaria remota não assume manutenção/revisão automaticamente e não se presume integração técnica com seu fornecedor. Escolher recorte após pesquisa pública; só depois MVP e testes com síndicos. Nenhuma pesquisa ou funcionalidade nova executada nesta revisão.\n\n## Catálogo completo')
p.write_text(s)
