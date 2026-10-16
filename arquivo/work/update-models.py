from pathlib import Path
p=Path('work/build-roadmap.py');s=p.read_text()
block='''# Definição confirmada em 07/10/2026: adicional humano opcional.
add('DEC-06','1','Produto','Definir responsáveis por atividade nos dois modelos','Matriz pendente para triagem, acompanhamento, evidências, revisão, comunicação e presença local: síndico no modelo plataforma; equipe contratada somente no adicional. Plataforma utilizável sem equipe TRÍADE.','PROD-02','P0','Decisão')
add('ADD-01','1','Serviço humano','Definir composição da equipe do adicional','Definir funções e composição quando contratado; não pressupor equipe obrigatória para clientes da plataforma.','SERV-01','P1','Decisão')
add('ADD-02','1','Serviço humano','Definir demandas cobertas pelo adicional','Registrar categorias, ações incluídas, exclusões e encaminhamentos; sem capacidade ilimitada presumida.','SERV-01','P1','Decisão')
add('ADD-03','1','Serviço humano','Definir quantidade e capacidade de condomínios','Estimar volume, capacidade e quantidade de condomínios atendíveis pela equipe do adicional; registrar limites sem inventar números.','ADD-01 SERV-02','P1','Decisão')
add('ADD-04','1','Serviço humano','Definir atividades que exigem presença local','Mapear tarefas presenciais e remotas, locais, acesso e quem executa; não presumir envio de equipe no modelo plataforma.','DEC-06 ADD-02','P1','Decisão')
add('ADD-05','6','Piloto','Verificar prontidão do adicional humano, se contratado','Antes de iniciar o adicional: pacote/limites/preço acordados, demandas, equipe, cobertura, capacidade, presença local e treinamento revistos. Não bloqueia piloto somente da plataforma.','PIL-05 SERV-01 SERV-02 ADD-01 ADD-02 ADD-03 ADD-04','P1','Validação')
changes={
'SERV-01':dict(title='Definir pacote, limites e preço do adicional humano',criteria='Pacote opcional de assessoria com limites, atividades e preço a definir; sem decisão comercial definitiva ou obrigatoriedade de contratação.',deps=['PROD-02']),
'SERV-02':dict(title='Definir horários, cobertura e substituição do adicional',criteria='Horários, cobertura e substituição da equipe contratada a definir; não prometer atendimento humano TRÍADE aos usuários apenas da plataforma.'),
'SERV-03':dict(front='Operação por modelo',criteria='Canal de emergência e escalonamento documentados para ambos os modelos, com responsáveis definidos; sem prometer socorro ou equipe TRÍADE sem contratação.',deps=['DEC-06']),
'SERV-04':dict(front='Operação por modelo',criteria='Retorno e resolução separados, pausas/feriados e justificativas definidos para a rotina do síndico ou equipe contratada; não depende do pacote humano.',deps=['PROD-02','DEC-06']),
'SERV-05':dict(front='Operação por modelo',criteria='Checklists com local, acesso, responsável e evidência usados pelo síndico ou executor definido; necessidade de presença local identificada, sem exigir equipe TRÍADE.',deps=['DEC-06']),
'SERV-06':dict(front='Operação por modelo',criteria='Escopo, contatos, tarefas, prazo e impedimentos registrados; síndico coordena prestadores no modelo plataforma e equipe autorizada no adicional.',deps=['DEC-06']),
'SERV-07':dict(front='Operação por modelo',criteria='Síndico pode checar evidências e revisar conclusão na plataforma; executor/revisor contratado definido no adicional. Incidentes têm responsável e conciliação em cada modelo.'),
'DEC-01':dict(criteria='Matriz permite síndico triar, atribuir, acompanhar, checar evidências e revisar/concluir, além de decidir. Operador TRÍADE acessa somente vínculos do adicional autorizado; gestão não recebe acesso irrestrito. Autoridades e acesso de prestador a definir.',deps=['PROD-02','DEC-06']),
'DEC-05':dict(deps=['PROD-02','DEC-02','DEC-06']),
'AUTH-01':dict(criteria='Login/sessão de síndico e perfis autorizados; plataforma funciona sem operador TRÍADE. Morador continua no WhatsApp.'),
'AUTH-02':dict(criteria='Servidor valida função/vínculo por endpoint; síndico pode executar rotina operacional. Perfis TRÍADE dependem de autorização e modelo contratado, sem acesso automático.'),
'TIC-02':dict(criteria='Síndico ou responsável autorizado registra urgência, dados faltantes, duplicidade, responsável e motivo; sem exigir operador TRÍADE.'),
'SYN-01':dict(criteria='Síndico ou responsável autorizado registra alternativas, custo estimado, prazo e evidência; atos de decisão têm autoria, sem exigir intermediário TRÍADE.'),
'VIS-01':dict(front='Operação por modelo',criteria='Vistoria/checklist associados a chamado, local, responsável, data e evidência; síndico ou executor definido registra dados, sem obrigação de equipe humana TRÍADE.'),
'END-01':dict(criteria='Conclusão exige evidência e explicação revisadas pelo síndico ou revisor autorizado do adicional. Decisão pendente impede conclusão incompatível; não exige segunda pessoa ou operador TRÍADE no modelo plataforma.'),
'WA-04':dict(title='Implementar mensagens e disponibilidade por modelo',criteria='Mensagens distinguem recebimento automático, disponibilidade do responsável e emergência. Não prometem atendimento humano TRÍADE sem adicional contratado.',deps=['WA-03','DEC-06','SERV-03']),
'INC-01':dict(front='Operação por modelo',criteria='Responsável definido por modelo registra incidente, canal alternativo e conciliação; separar suporte técnico da plataforma do atendimento operacional contratado.'),
'PIL-01':dict(criteria='Revisão profissional dos termos da plataforma e, quando contratado, contrato separado do adicional com responsabilidades, dados e limites; sem preço ou contratação presumidos.',deps=['DEC-06','DEC-04']),
'PIL-03':dict(title='Treinar síndico e responsáveis do modelo escolhido',criteria='Síndico treinado para executar triagem, acompanhamento, checagem de evidências, revisão e comunicação. Equipe adicional treinada somente se contratada; simulação sem dados reais.',deps=['TIC-05','WA-07','VIS-01','INC-01','DEC-06']),
'PIL-04':dict(criteria='Distinguir suporte técnico da plataforma de execução operacional pelo síndico ou equipe adicional; responsáveis e cobertura definidos, sem obrigatoriedade do serviço humano.'),
'PIL-05':dict(criteria='Prontidão da plataforma: termos, treinamento do síndico, isolamento, comunicação, restauração e métricas verificados. Serviço humano não é pré-requisito; se contratado, aplicar ADD-05 antes do início do adicional.'),
'PIL-07':dict(criteria='Avaliar sustentabilidade da plataforma e, separadamente, adicional humano: custo/capacidade, preço ainda a definir, riscos e melhorias; sem expansão automática.')
}
optional={'SERV-01','SERV-02','ADD-01','ADD-02','ADD-03','ADD-04','ADD-05'}
for t in rows:
 t.update(changes.get(t['id'],{}))
 t['scope']='Adicional humano opcional' if t['id'] in optional else 'Plataforma / ambos os modelos'
 if t['id'] in changes:
  t['revisionNote']='Critério/dependências revisados em 07/10/2026. Status, notas e evidências locais anteriores são preservados; revisar conclusões antigas à luz dos dois modelos.'
'''
s=s.replace("catalog=dict(version=1",block+"\ncatalog=dict(version=1,revisionDate='2026-10-07'")
s=s.replace('Base revisada em 05/10/2026.','Base inicial de 05/10/2026; escopo revisado em 07/10/2026.')
s=s.replace('A TRÍADE acompanha a rotina e leva ao síndico decisões necessárias.','A plataforma organiza e registra a rotina; o síndico pode executar triagem, acompanhamento, checagem de evidências e revisão de conclusão. O serviço humano TRÍADE é adicional opcional, sem obrigação de enviar equipe para usuários apenas da plataforma.')
s=s.replace('Painel do produto: síndico, operação e gestão TRÍADE.','Painel do produto: síndico e responsáveis autorizados; operação TRÍADE somente nos vínculos do adicional contratado.')
s=s.replace('1. Revisar PROD-01/02 e SERV-01 com Gabriela: dor, escopo e capacidade humana.','1. Revisar PROD-01/02 e DEC-06 com Gabriela: escopo e quem executa cada atividade nos dois modelos. SERV-01/02 e ADD-01/02/03/04 são pendências do adicional, não requisitos de contratação para usar a plataforma.')
s=s.replace('- Produto/serviço: escopo, emergência, cobertura humana e autoridades definidos.','- Plataforma: escopo, emergência, responsáveis da rotina do síndico e autoridades definidos.\n- Adicional humano, somente quando contratado: pacote/preço/limites, equipe, demandas, horários/cobertura/substituição, capacidade de condomínios e presença local definidos; ADD-05 é a porta adicional.')
s=s.replace('## Catálogo completo','## Dois modelos e pendências expressas\nA escolha comercial de pacote e preço permanece em aberto. DEC-06 registra quem executa cada atividade em cada modelo. SERV-01/02 e ADD-01/02/03/04 registram pacote/limites/preço, horários/cobertura/substituição, equipe contratada, demandas cobertas, quantidade/capacidade de condomínios e atividades presenciais. Nenhuma tarefa comum depende dessas definições opcionais; apenas a prontidão do adicional usa ADD-05. Chamados, responsáveis, dois prazos, decisões, histórico, evidências, revisão, reabertura e comunicação permanecem na plataforma.\n\nOs 74 IDs anteriores foram preservados; seis novas pendências foram adicionadas. O armazenamento versão 1 e sua chave permanecem iguais: status, prioridade, responsável, datas, notas, evidências e tarefas locais não são reescritos. Conclusões antigas de tarefas revisadas exigem conferência manual; não são certificadas nem apagadas.\n\n## Catálogo completo')
s=s.replace("Frente: {t['front']} • Tipo:","Aplicação: {t['scope']} • Frente: {t['front']} • Tipo:")
s=s.replace("  if t['notes']:plan+=", "  if t.get('revisionNote'):plan+=f\"\\nRevisão: {t['revisionNote']}\\n\"\n  if t['notes']:plan+=")
p.write_text(s)
