import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const root='/Users/carolina/Documents/Codex/2026-10-03/triade-condo';
const out=root+'/outputs/triade-condo/pesquisa';
await fs.mkdir(out,{recursive:true});
const wb=Workbook.create();
const date=new Date('2026-10-07T12:00:00Z');
const sources=[
 ['F01','Acolweb','Fornecedor','https://acolweb.com.br/','Direta','Ocorrências no app/portal e sugestões de IA. AlcoWeb continua associação não confirmada.'],
 ['F02','Organize meu Condomínio','Fornecedor','https://www.organizemeucondominio.com.br/site/','Direta','Manu no WhatsApp é assistente do síndico; não confirma abertura de chamados do morador nesse canal.'],
 ['F03','OMC aplicativo','Fornecedor / loja','https://play.google.com/store/apps/details?hl=pt_BR&id=com.omc.app','Direta','Descrição do publicador: tickets, OS, calendário, mensagens, visitantes.'],
 ['F04','Winker App','Fornecedor','https://www.winker.com.br/solucoes/app-winker/','Direta','White label, atendimento IA/WhatsApp, classificação, recursos de acesso. Depende dos produtos e integrações contratados.'],
 ['F05','TownSq','Fornecedor','https://townsq.com.br/','Direta','Gestão, tarefas, fornecedores, manutenções e financeiro. Não usar contadores extraídos inconsistentes.'],
 ['F06','Nextin Home produto','Fornecedor','https://nextin.com.br/br/produto/','Índice; direta falhou 502','Ocorrências privadas com respostas e-mail/SMS, reservas e documentos. Validar versão/planos.'],
 ['F07','Nextin portaria','Fornecedor / suporte','https://suporte.nextin.com.br/portal/pt-br/kb/articles/painel-da-portaria-funcionalidades-que-tornam-a-rotina-do-porteiro-mais-%C3%A1gil-e-segura','Índice','Documentação de portaria com pessoas, veículos, encomendas e anotações de turno.'],
 ['F08','Seu Síndico IA','Fornecedor','https://www.seusindicoia.com/','Direta','Atendimento aos moradores depende do plano e ativação. Não atribuir plano Profissional ao Síndico.'],
 ['F09','SindIA','Fornecedor','https://www.sindia.app.br/','Direta','Domínio app.br distinto de sindia.ia.br. Exemplo com zelador não implica obrigação de contratar equipe.'],
 ['F10','uCondo','Fornecedor','https://www.ucondo.com.br/','Direta','Autogestão, manutenção, ocorrências, IA e financeiro. IA WhatsApp não comprova canal de abertura de ocorrências.'],
 ['F11','uCondo contratação','Fornecedor / artigo','https://www.ucondo.com.br/blog/como-funciona-o-sistema-ucondo','Direta na pesquisa anterior de hoje','Piso de preço do artigo não define pacote completo nem substitui proposta personalizada.'],
 ['F12','MeuVizy','Fornecedor','https://meuvizy.com.br/','Direta','WhatsApp privado, fotos/status, reservas, avisos e prestadores. Encomendas pressupõem registro por alguém.'],
 ['F13','PedeCondo','Fornecedor','https://pedecondo.com.br/','Direta','Página atual: orientação ao síndico. Índice antigo de SaaS/QR/preço não confirma oferta atual.'],
 ['F14','Gcondo','Fornecedor','https://gcondo.com.br/','Direta resumida','Chamados, documentos, prestadores e IA no WhatsApp para síndicos profissionais. Canal exato de entrada incerto.'],
 ['F15','HabitaOne preços','Fornecedor','https://www.habitaone.com.br/precos','Direta','Distingue recursos disponíveis, em breve e limites ainda sendo ativados. PIX tem tarifa em proposta; boleto em breve.'],
 ['F16','iSindi','Fornecedor','https://isindi.com.br/','Direta','Ocorrências com foto no app, prestadores/OS e financeiro. WhatsApp anunciado para avisos/cobrança.'],
 ['F17','Radar Condo','Fornecedor indexado','https://radarcondo.com/','Índice; direta falhou','Monitoramento/triagem de grupos e painel no índice. Operabilidade e oferta atual incertas.'],
 ['F18','Unique Serviços','Prestador humano','https://uniqueservicos.com.br/','Direta na pesquisa anterior de hoje','Assessoria/supervisão humana. Oferta de supervisão menciona equipe CLT; não extrapolar para prédio sem equipe.'],
 ['R01','Prédio sem zelador','Relato público','https://www.reddit.com/r/desabafos/comments/1r5h4wl/fui_s%C3%ADndica_por_7_anos_sa%C3%AD_e_agora_querem_que_eu/','Direta na pesquisa anterior de hoje','Comentário, distinto do texto principal, descreve acúmulo de tarefas e acompanhamento local. Sem representatividade.'],
 ['R02','Sem portaria','Relato público','https://www.reddit.com/r/primeiroimovel/comments/1vrx8bu/apartamento_sem_portaria/','Direta na pesquisa anterior de hoje','Relatos variados de visitas/entregas e de ausência de problema. Não prova demanda paga.'],
 ['R03','Continuidade de chamados','Avaliações públicas','https://apps.apple.com/br/app/ucondo/id1062839687?platform=iphone&see-all=reviews','Direta na pesquisa anterior de hoje','Relato de encerramento sem resposta; resposta do desenvolvedor e avaliações positivas. Algumas datas sem ano.'],
 ['R04','Portaria presencial','Relato público','https://www.reddit.com/r/ConselhosLegais/comments/1t3gl25/encomenda_recebida_por_portaria_e_entregue_a/','Direta na pesquisa anterior de hoje','Entrega com unidade errada e posterior recuperação. Caso individual, não prevalência.'],
];
// status A=anunciado, N=não encontrado, I=incerto. Não encontrado nunca significa ausência.
const systems=[
 ['Acolweb','Síndicos e administradores','SaaS / IA','App/portal; ocorrências, respostas sugeridas, comunicados e resumos de documentos.',null,'Não encontrado','Teste anunciado de 15 dias; demonstração.','C01–C03: comunicação; adequação operacional a verificar.','F01','ANNNNNNNNAA'],
 ['Organize meu Condomínio','Síndico morador e profissional','SaaS + assistente','Tickets/OS, manutenção/checklists, comunicação, reservas, visitantes e encomendas.',null,'Não encontrado','Demonstração; conteúdo/cursos; Manu no WhatsApp.','C01–C03: rotinas digitais; portaria depende de operação local.','F02, F03','ANNNNANNAAA'],
 ['Winker','Administradoras, segurança, construtoras e condomínios','Ecossistema SaaS','App white label, Chat IA/WhatsApp, triagem e acesso integrado.',null,'Não encontrado','Especialista; implantação/suporte; produtos separados.','C02/C03: acesso e repasse; C01 pode usar comunicação, contratação a verificar.','F04','AINNNNNNAAA'],
 ['TownSq','Síndicos, administradoras e moradores','SaaS + serviços','Demandas, comunicação, tarefas, fornecedores, manutenções, acesso e financeiro.',null,'Não encontrado','Consulta de planos; implantação guiada e especialistas.','C01–C03: gestão; não assumir execução local incluída.','F05','ANNNNANNAAA'],
 ['Nextin Home','Síndicos e profissionais multicarteira','SaaS / app','Ocorrência privada, resposta e-mail/SMS, reservas, documentos e módulo portaria.',null,'Não encontrado','Teste/contratação; pacote e versão a confirmar.','C01: ocorrências; C02/C03: portaria. Inferência com fonte indexada.','F06, F07','INNNNNNNIII'],
 ['Seu Síndico IA','Síndico de um prédio, profissional e administradora','Assistente WhatsApp','Memória, resumo e tarefas com responsável/prioridade; atendimento configurável.',99.99,'BRL/mês; Síndico: 1 condomínio/1 grupo; só responde ao síndico no privado.','Profissional: 139,99/mês até 3; extra 29,99. Moradores/grupo nesse plano; 7 dias sem cartão.','C01–C03: organizar conversas; execução física não demonstrada.','F08','IANNANNNNAA'],
 ['SindIA','Síndico, moradores e operação do condomínio','Bot WhatsApp + painel','Dúvidas, demandas, avisos, reservas, encomendas e acesso.',197,'BRL/mês; até 50 unidades. 397 até 150; acima sob consulta.','Demonstração; implantação em até 48h anunciada, não testada.','C01: demanda/info; C02/C03: acesso/encomendas com atores definidos.','F09','AANNNNNNNAA'],
 ['uCondo','Autogestão, profissional e administradora','SaaS / app','Ocorrências, comunicados/documentos, agenda preventiva, portaria e financeiro.',139,'BRL/mês; a partir de, em artigo próprio. Home exige proposta; pacote do piso não confirmado.','Demonstração/vendas e treinamento; conteúdo educativo.','C01–C03: gestão digital; portaria não cria executor local.','F10, F11','ANNNNANNAAA'],
 ['MeuVizy','Síndicos, administradoras e moradores','Bot WhatsApp + painel','Chamados com fotos/status, comunicados, reservas, encomendas e indicações.',149,'BRL/mês; a partir de; valor por unidades, sem setup anunciado.','Demonstração/WhatsApp; todos módulos/uso ilimitado anunciados.','C01: chamados; C02/C03: registro de entregas depende de pessoa.','F12','AANANNNANAA'],
 ['PedeCondo','Síndico morador e profissional','Orientação digital','Orientação de ações, riscos e documentos para decisões.',null,'Não encontrado na página atual','Criar conta; não usar preços e funções do índice antigo.','C01–C03: apoio à decisão; não confirma fila operacional.','F13','NNNNNNNNNNN'],
 ['Gcondo','Síndico profissional / carteira','SaaS + IA','Chamados, documentos, prestadores, relatórios e IA no WhatsApp.',null,'Não encontrado','Contato e blog; detalhes de implantação incertos.','C01–C03: gestão; posicionamento de carteira pode ampliar esforço.','F14','AINNNNAN NAA'.replaceAll(' ','')],
 ['HabitaOne','Autogestão, profissional e administradora','SaaS web / app','Chamados, manutenção/vistorias, cotações/contratos, reservas e financeiro.',4.90,'BRL/unidade ativa/mês; Essencial mínimo 149, 1 condomínio e 3 usuários de equipe.','7 dias sem cartão até 50 unidades; tarifas PIX em proposta; boleto/WhatsApp cobrança em breve.','C01–C03: operação; hardware explicitamente não incluído.','F15','ANNNNAANAAA'],
 ['iSindi','Síndico do próprio prédio','SaaS / app','Financeiro, avisos WhatsApp/e-mail, ocorrências com foto, prestadores e OS.',24.90,'BRL/mês por condomínio, sem cobrança por morador.','30 dias sem cartão; cadastro simples; começar pelo mês atual.','C01: autogestão; C02/C03: gestão, acesso não demonstrado.','F16','ANNANNAN NAN'.replaceAll(' ','')],
 ['Radar Condo','Gestor de condomínio no WhatsApp','Painel / triagem (incerto)','Índice descreve grupos, prioridades, responsável, reincidências e resposta.',null,'Não confirmado','Índice menciona grátis/sem cartão; página direta falhou.','C01–C03: hipótese de triagem; oferta atual não confirmada.','F17','IINNINNNNNI'],
 ['Unique Serviços','Síndico morador com necessidades de assessoria','Serviço humano','Assessoria e supervisão; oferta de supervisão menciona colaboradores CLT.',null,'Não encontrado','Contato consultivo; não é referência de funções SaaS.','Não presumir pacote adequado a prédio sem funcionários.','F18',null],
];
const features=[
 ['D01','Entrada de demandas','Canal do morador para registrar ocorrência/chamado.'],
 ['D02','Demanda pelo WhatsApp','Pedido recebido pelo WhatsApp e convertido/encaminhado como demanda. Assistente de dúvidas e avisos não bastam.'],
 ['D03','Dois prazos','Próximo retorno separado de estimativa de resolução.'],
 ['D04','Fotos no chamado','Anexo de foto na ocorrência. Não equivale a prova de conclusão.'],
 ['D05','Responsável explícito','Atribuição de pessoa responsável pela tarefa.'],
 ['D06','Manutenção preventiva','Agenda preventiva/checklists/vistorias.'],
 ['D07','Prestadores / cotações','Cadastro/coordenação de prestadores, contratos ou cotações. Não garante contratação.'],
 ['D08','Status consultável','Acompanhamento de status da ocorrência explicitamente descrito.'],
 ['D09','Acesso / encomendas','Registro, autorização ou integração de acesso/entregas. Não representa presença física.'],
 ['D10','Comunicação / documentos','Avisos, respostas ou documentos compartilhados.'],
 ['D11','Financeiro','Gestão financeira/cobrança, além de texto ou conselho de IA.'],
 ['D12','Revisão / reabertura','Revisão da conclusão e possibilidade explícita de pedir reabertura.'],
];
// As cadeias codificam D01–D11; D12 não foi explicitamente encontrado nas páginas examinadas.
const scenarios=[
 ['C01','Sem porteiro / sem operação de portaria','Prédio simples com porta de entrada, elevador e apartamentos. Visitas e entregas seguem diretamente com o morador, como já acontece.','Cenário confirmado pela usuária; não inclui portaria remota nem equipamentos de controle específicos. Sem faixa numérica.','Pedidos e providências da rotina compartilhada: porta/elevador, iluminação, limpeza, manutenção e comunicação. Dor e compra ainda hipóteses.','Pedido → responsável real → providência → andamento → conclusão; organizar a rotina existente, sem fluxo burocrático obrigatório.','Identificar quem já executa/coordena cada manutenção; síndico, prestador ou outra pessoa conforme organização real do prédio.','Não presumir autorização de entrada, cadastro de visitante, aviso de chegada ou encomendas. Verificar acordos/contratos existentes; registrar referência se útil.','MeuVizy, uCondo, OMC, HabitaOne; funções digitais em F02/F10/F12/F15, não validação da TRÍADE nem necessidade de portaria.'],
 ['C02','Portaria remota / online','Operador remoto administra acesso conforme contrato; síndico coordena manutenção e acompanhamento.','Pode não haver ninguém no local. Mais equipamentos/fornecedores aumentam dependências.','Repasse entre empresa remota, síndico e prestador; defeito de acesso e espera: hipóteses.','Núcleo C01 + registro de impedimentos, agenda de visitas e responsáveis por liberar/acompanhar.','Síndico, operador remoto e prestador; acompanhante local só se identificado.','Registrar visita não abre portão. Integração exige fornecedor, equipamentos e contrato.','Winker, Nextin e SindIA (F04/F07/F09) como referências de acesso; TRÍADE inicialmente só coordenação.'],
 ['C03','Portaria presencial / atendente','Atendente recebe e repassa; síndico decide. Ter porteiro não implica zelador ou mantenedor.','Turnos, áreas comuns e volume variam; equipe técnica ou administradora são opcionais.','Informação dispersa, troca de turno e encerramento sem retorno: hipóteses.','Núcleo C01 + repasse por papel/turno, aceite da atribuição e rastreabilidade.','Síndico, atendente durante seu turno e prestador eventual. Cada papel precisa de definição.','Atendente não é automaticamente executor ou revisor técnico. Encomendas exigem registro e custódia local.','OMC, Winker, Nextin e MeuVizy (F02/F04/F07/F12) como referências de portaria.'],
];
const proposals=[
 ['P01','Morador 100% no WhatsApp institucional do prédio','Registrar pedido/reclamação e acompanhar a rotina sem aplicativo ou portal externo.','Morador usa número institucional do prédio; síndico gere no painel web e recebe avisos no WhatsApp dele.','Digital sem funcionário','Adesão exige WhatsApp próprio do prédio/condomínio; providenciar número se ainda não houver. Não usar automaticamente número pessoal do síndico como canal institucional. Viabilidade de integração a verificar; provedor, conta/API, custos e migração não escolhidos.','F12: referência de canal WhatsApp; número institucional é requisito TRÍADE confirmado, não integração entregue.','Pré-requisito de adesão; integração futura'],
 ['P02','Fila com responsável e prioridade','Saber quem dá o próximo passo.','Identificar responsável real na organização existente; síndico coordena conforme a rotina.','Digital sem funcionário','Não inventar novo responsável obrigatório. Verificar acordos, regras ou contratos quando existirem; registro de referência é opcional.','F08: tarefa com responsável/prioridade.','Núcleo candidato'],
 ['P03','Próximo retorno e estimativa de resolução','Distinguir informar de resolver; expor atraso.','Síndico define/atualiza.','Digital sem funcionário','Dois prazos são proposta própria; não encontrados explicitamente na comparação.','F12: status; R03: sinal qualitativo de continuidade.','Núcleo candidato'],
 ['P04','Impedimentos e próximo passo','Expor falta de acesso, orçamento, decisão ou executor.','Síndico registra e coordena.','Digital sem funcionário','Não garante que impedimento seja removido.','F05: tarefas/fornecedores; adaptação proposta TRÍADE.','Núcleo candidato'],
 ['P05','Agenda simples de manutenção preventiva','Acompanhar a programação que o prédio já usa, quando existir.','Identificar quem organiza e quem executa conforme contrato, acordo ou rotina existente.','Organização digital; execução local','Verificar referências existentes e orientação técnica; não impor nova periodicidade, ata ou procedimento obrigatório.','F02: calendário/checklists; F10: agenda; F15: manutenção.','Avaliar no recorte / evolução'],
 ['P06','Coordenação da manutenção e prestador','Acompanhar providência, contato e execução da rotina comum.','Quem já coordena/executa conforme organização real; prestador existente ou eventual, sem presunção.','Execução local quando o serviço exigir','Identificar contratos/acordos e modo de atendimento existentes. Acesso só é questão se houver necessidade concreta; não criar etapa obrigatória.','F05: fornecedores; F15: contratos; F07: acesso apenas para operação de portaria.','Registro simples candidato'],
 ['P07','Orçamento e referências opcionais','Usar orçamento de forma independente e guardar referência/decisão quando útil.','Responsável já competente conforme regras/acordos do prédio.','Digital sem funcionário','Registro opcional; orçamento não exige pagamento, financeiro, chamado, evidência ou checagem. Não exigir ata para toda manutenção ou nova burocracia. Preservar identidade, autorização e vínculos essenciais quando houver.','F15: cotações/contratos; autonomia e registro opcional são requisitos TRÍADE, não integração entregue.','Módulo opcional independente'],
 ['P08','Evidência, checagem e reabertura','Explicar a conclusão e permitir contestação.','Executor envia; síndico checa; morador pede revisão.','Digital + checagem local quando necessária','Foto não é laudo; serviço especializado exige avaliação competente. Reabertura é proposta não comprovada nos sites.','F12/F16: fotos; F15: vistorias; R03: continuidade.','Núcleo candidato'],
 ['P09','Andamento no WhatsApp e avisos ao síndico','Morador acompanha pelo WhatsApp; síndico recebe novidades relevantes sem manter painel aberto.','Síndico usa painel web; recebe no WhatsApp novo chamado/reclamação e nova solicitação de morador.','Digital sem funcionário','Mapear eventos e destinatários por vínculo, entrega/falha e evitar duplicidade. Não presumir aprovação pelo WhatsApp ou aviso para cada alteração técnica. Requisito futuro.','F12: status; requisito TRÍADE de aviso ao síndico confirmado pela usuária, sem integração entregue.','Requisito confirmado; regras a detalhar'],
 ['P10','Comunicados e documentos','Informar manutenção/regras e manter referência.','Síndico publica e controla acesso.','Digital sem funcionário','Dúvidas respondidas com base aprovada; IA pode errar e precisa de limites.','F01/F02: comunicados; F10/F15: documentos.','Comunicado ligado ao caso; biblioteca/IA depois'],
 ['P11','Encomendas e visitantes','Recurso de referência para operação de portaria existente, quando necessário.','Identificar atores/procedimentos reais; no C01, moradores tratam visitas/entregas diretamente.','Só conforme operação real existente','Fora do recorte C01. Reavaliar apenas com necessidade concreta; não impor cadastro, autorização, aviso de chegada ou custódia.','F02/F07/F12: referências; R02: logística variável.','Evolução condicional'],
 ['P12','Financeiro e cobrança mensal por boleto opcionais','Síndico pode usar controle financeiro e/ou cobrança mensal do condomínio por boleto, se escolher.','Síndico no painel web; morador exclusivamente WhatsApp.','Provedor/fluxo e integrações futuros a definir','Possibilidades futuras, não aprovadas para MVP nem implementadas. Não exigidas por orçamento, chamados, evidências, checagem ou reabertura. Pesquisar provedor/fluxo futuramente; sem movimentação financeira nesta revisão. Reservas/assembleias também poderão ser opções adequadas ao contexto.','F05/F10/F16: financeiro; F15: gestão e boleto em breve. TRÍADE: proposta futura, sem integração entregue.','Evolução condicional'],
 ['P13','Implantação de novo condomínio cliente e apoio documental','Apresentar sistema/orientar em reunião acordada. Apoiar atas, regras e documentos: desenvolver se inexistentes, revisar/ajustar quando necessário se existentes.','Assessoria de implantação em Brasília/DF; responsáveis, capacidade e revisão profissional quando aplicável a definir.','Apresentação presencial e apoio documental propostos','Redação/organização e propostas de ajuste não aprovam regras pelo condomínio. Atas só refletem reuniões/decisões reais; sem retroatividade fabricada, regularização automática ou jurídico já contratado. Documentos abrangidos/preço/pacote a definir. Não exigir documentação para todo módulo/chamado. Novo cliente é condomínio, não morador; reunião acordada sem requisito jurídico ou exclusividade.','Oferta TRÍADE confirmada pela usuária; sem documentos reais criados, contratação ou apresentação agendada. Operação recorrente só hipótese futura.','Assessoria de implantação proposta'],
 ['P14','Integração/orientação de novo morador em condomínio já cliente','Reduzir trabalho do síndico: explicar regras existentes aprovadas/fornecidas pelo cliente, uso WhatsApp e sistema; cadastro breve de nome, telefone e apartamento.','Equipe de assessoria de implantação/orientação; responsáveis, frequência e capacidade a definir.','Presencial versus remoto a definir','CPF apenas se necessário ao módulo financeiro; não obrigatório para funções básicas, sem coleta real agora ou interpretação legal. Não inventar regras nem substituir documentos do prédio. Não é registro de visitante/aviso de chegada. Preço/pacote e execução a detalhar.','Definição TRÍADE confirmada pela usuária; morador 100% WhatsApp institucional; sem atendimento ou integração entregue.','Assessoria de orientação proposta'],
];
const offerRows=[];
for(const s of scenarios) for(const p of proposals){
 let adaptation=s[0]==='C01'?'Síndico pode operar sozinho; identificar e respeitar organização existente.':s[0]==='C02'?'Identificar repasse existente com empresa remota; tratar acesso só conforme operação real.':'Identificar repasse existente com atendente; execução técnica separada.';
 let row=[s[0],p[0],p[1],'Proposta TRÍADE',p[2],p[3],p[4],adaptation,p[5],p[6],p[7]];
 if(p[0]==='P01'||p[0]==='P09')row[3]='Requisito confirmado (futuro)';
 if(p[0]==='P11'){
  if(s[0]==='C01')row=[s[0],p[0],'Encomendas e visitantes: referência fora do recorte','Referência / evolução condicional','Não há oferta inicial presumida; moradores tratam visitas e entregas diretamente.','Morador, como já acontece.','Nenhuma operação de portaria presumida','Não incluir autorização de entrada, cadastro de visitante, aviso de chegada ou custódia.','Só reavaliar se necessidade concreta surgir; equipamentos/operação remota constituem cenário distinto.','F02/F07/F12: recursos de fornecedores; não necessários ao C01.','Fora do recorte inicial'];
  else row[7]=s[0]==='C02'?'Operador autoriza conforme contrato; custódia depende de pessoa/local.':'Atendente registra quando recebe; custódia e turno devem ser identificados.';
 }
 if(s[0]==='C01'&&p[0]==='P04'){row[4]='Expor pendência de orçamento, decisão, executor ou providência da rotina comum.';row[8]='Não criar impedimento de acesso presumido ou nova etapa de autorização; registrar só o que ocorre no caso.';}
 offerRows.push(row);
}
const focus=[
 ['C01','Prédio simples: rotina comum, andamento e conclusão','Porta/elevador, iluminação, limpeza, manutenção e comunicação. Frequência e valor da dor ainda não validados.','Organizar a rotina existente com o síndico, sem novo procedimento obrigatório.','Autogestão e bots já oferecidos. Fluxo com revisão não prova exclusividade.','Pedido, responsável real, providência, andamento e conclusão; não incluir operação de portaria.','Execução conforme organização real; visitas e entregas diretamente com moradores.','Candidato a teste da rotina compartilhada, sem encomendas/visitantes presumidos.','Não decidido','Identificar organização existente, contratos/acordos/regras úteis e caso recente; registro opcional de referência, responsável ou decisão.'],
 ['C02','Remota: coordenação de impedimentos e visitas','Repasse é plausível; não demonstrada disposição para outro sistema.','App do fornecedor existente pode competir com novo canal.','Suítes integradas com acesso; TRÍADE precisa demonstrar ganho incremental.','Núcleo + múltiplos atores; hardware/integração elevam esforço.','Alta para acesso; pode faltar acompanhante.','Comparação futura sem controlar portão.','Não decidido','Checar contrato, interlocutor e disponibilidade física antes de prometer coordenação.'],
 ['C03','Presencial: rastreabilidade de repasses','Casos de registro/retorno existem; não medem frequência.','Treinar turnos e confirmar quem atualiza.','Suítes de portaria já estabelecidas.','Permissões, troca de turno e mais fluxos; encomendas ampliam escopo.','Atendente existe no turno; técnico/zelador não presumido.','Evolução se repasse for dor relevante.','Não decidido','Comparar rotina atual e duplicação de registro com sistema de portaria.'],
 ['H01','Assessoria de implantação e orientação','Oferta atual concentrada em implantar novo condomínio cliente e orientar novo morador em condomínio já cliente, reduzindo trabalho do síndico.','Demonstração acordada e orientação/cadastro breve; equipe, frequência e capacidade a definir.','Diferencial proposto, sem exclusividade ou equivalência a serviço operacional de terceiros.','Preço/pacote e presencial/remoto para novos moradores a definir. CPF condicional ao financeiro, sem exigência básica.','Implantação presencial proposta em Brasília/DF; formato da orientação a detalhar.','Assessoria operacional recorrente apenas hipótese opcional futura, sem inclusão automática.','Não decidido','Regras fornecidas/aprovadas pelo cliente; nome, telefone, apartamento. Sem regra inventada, coleta real ou implementação agora.'],
];
const identities=[
 ['N01','AlcoWeb','Acolweb','Associação não confirmada','F01','Pedir grafia/link antes de atribuir identidade; candidato aparece com grafia diferente.'],
 ['N02','Organize Meu Condomínio','Organize meu Condomínio','Nome identificado','F02, F03','Site e aplicativo do publicador.'],
 ['N03','o Condo','uCondo','Associação não confirmada','F10','Candidato plausível; transcrição não comprova que foi a marca citada.'],
 ['N04','Winker','Winker','Nome identificado','F04','Site próprio.'],
 ['N05','Nextin Home','Nextin Home','Nome identificado; fonte parcial','F06, F07','Produto no índice e documentação de suporte; abertura de produto falhou.'],
 ['N06','Tom... SQ','TownSq','Associação não confirmada','F05','Candidato plausível; validar nome original.'],
 ['N07','síndico I...AI','SindIA / Seu Síndico IA','Identidade incerta','F08, F09','São referências distintas. Não unir a sindia.ia.br ou MeuSíndico.IA sem confirmação.'],
];
const pending=[
 ['Q01','Público e dor','Escolher comportamento/rotina, não só porte ou número de andares.'],
 ['Q02','Oferta e preço','Ainda não aprovados nem validados; preços de fornecedores não medem disposição para pagar.'],
 ['Q03','Organização existente','Quem já organiza/executa manutenção e acompanha providências? Há atas, regras internas, acordos ou contratos úteis? Referência/decisão/responsável podem ser registrados se necessário, sem fluxo obrigatório.'],
 ['Q04','WhatsApp institucional e notificações','Pré-requisito de adesão: prédio/condomínio deve ter WhatsApp próprio, com número institucional; providenciar se ainda não houver. Não usar automaticamente WhatsApp pessoal do síndico como canal institucional. Morador 100% WhatsApp; síndico painel web e avisos no WhatsApp dele. Viabilidade técnica do número a verificar; provedor, conta/API, custos e migração não escolhidos. Detalhar eventos, destinatários por vínculo, falha/entrega e duplicidade; sem decisões pelo WhatsApp presumidas. Integração futura.'],
 ['Q05','Concorrente atual','Qual sistema/caderno/WhatsApp já usa e qual custo de duplicar ou trocar?'],
 ['Q06','Teste posterior','MVP após decisão; teste com alguns síndicos depois, sem recrutamento autorizado agora.'],
 ['Q07','Evidência de mercado','Relatos não são amostra representativa; anúncios não são recursos testados. Sem sizing ou pontuação artificial.'],
 ['Q08','Recursos por realidade','Visão: do prédio simples ao condomínio grande, com ou sem portaria, com atividades/módulos opcionais e independentes. Financeiro e boleto mensal são evolução possível, sem aprovação para MVP. Orçamento não exige pagamentos; chamados não exigem financeiro. Compartilhar dados quando útil, preservando vínculos essenciais. Ativação, integrações/provedor, pacotes/preços/arquitetura a definir futuramente.'],
 ['Q09','Armário após primeiros clientes','Hipótese futura de locação de armário com sistema, manutenção/suporte e avisos WhatsApp. Viabilidade comercial não confirmada; fora do MVP. Idealização detalhada e implantação adiadas. Após clientes, avaliar no local necessidade, espaço, acesso do entregador, externo/área separada/hall e integração, depósito, guarda, retirada individual, rastreabilidade, exceções/suporte, custos e responsabilidades. Sem promessa de ausência de extravio ou integração disponível. Sem desenvolvimento, compra, parceria ou instalação agora.'],
 ['Q10','Brasília/DF e assessoria atual','Foco Brasília/DF. Implantação de novo condomínio cliente: apresentação acordada e apoio a atas/regras/documentos, desenvolver se inexistentes e revisar/ajustar se necessário; aprovação pelo condomínio, atas de reuniões/decisões reais, sem regularização automática. Integração/orientação de novo morador em condomínio já cliente: regras fornecidas/aprovadas, WhatsApp/sistema, nome/telefone/apartamento; CPF condicional ao financeiro. Documentos, revisão profissional quando aplicável, preço/pacote, frequência, capacidade, responsáveis e presencial/remoto da orientação a definir. Sem burocracia compulsória; operação recorrente só hipótese futura.'],
 ['Q11','Níveis e composição comercial','Estrutura inicial decidida: básico com atendimento/controle; ampliação que inclua coordenação/agenda, adquirindo recursos conforme plano. Nomes, preços e composição final não aprovados. Inclusão de implantação/orientação/apoio documental por plano a definir. Plano delimita acesso comercial, sem percurso compulsório: orçamento sem pagamento, chamados sem financeiro. Coordenação não implica execução de manutenção pela TRÍADE. Financeiro/boleto em evolução a decidir; armário só após primeiros clientes.'],
];
const specs=[];
function col(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
function sheet(name,title,note,headers,rows,widths,rowHeight=100){
 const sh=wb.worksheets.add(name); sh.showGridLines=false;sh.tabColor='#244B52';
 const last=col(headers.length),end=5+rows.length;
 sh.getRange(`A1:${last}${end}`).format={font:{name:'Arial',size:10,color:'#24343B'},verticalAlignment:'center',wrapText:true};
 sh.getRange('A2').values=[[title]];sh.getRange('A2').format={font:{name:'Arial',size:14,bold:true,color:'#17343B'},wrapText:false};sh.getRange('A2').format.rowHeight=26;
 sh.getRange('A3').values=[[note]];sh.getRange('A3').format.wrapText=false;sh.getRange('A3').format.rowHeight=24;
 sh.getRange(`A5:${last}${end}`).values=[headers,...rows];
 sh.tables.add(`A5:${last}${end}`,true,'Table'+specs.length);
 sh.getRange(`A5:${last}5`).format={fill:'#244B52',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:42};
 sh.getRange(`A6:${last}${end}`).format.rowHeight=rowHeight;
 for(let i=0;i<headers.length;i++)sh.getRange(`${col(i+1)}1:${col(i+1)}${end}`).format.columnWidthPx=widths[i]||230;
 for(let r=6;r<=end;r++){
  if(r%2===0)sh.getRange(`A${r}:${last}${r}`).format.fill='#F1F5F5';
  const lines=Math.max(...rows[r-6].map((v,i)=>Math.ceil(String(v??'').length/Math.max(10,Math.floor(((widths[i]||230)-16)/6.5)))));
  const cap=name==='Oferta por funcionalidade'&&['P13','P14'].includes(rows[r-6][1])?200:rowHeight;
  sh.getRange(`A${r}:${last}${r}`).format.rowHeight=Math.min(cap,Math.max(46,lines*14+18));
 }
 sh.freezePanes.freezeRows(5);sh.freezePanes.freezeColumns(1);
 specs.push({name,end,cols:headers.length});return sh;
}
sheet('Cenários e ofertas','Cenários e funcionamento','Foco inicial: Brasília/DF. Ofertas propostas, sem demanda/preço validados; pesquisa em 07/10/2026.',
 ['ID','Cenário','Como funciona','Porte e estrutura','Necessidades a investigar','Oferta TRÍADE candidata','Quem pode agir','Dependências','Referências / inferência'],scenarios,[70,210,270,270,280,290,270,280,280],170);
sheet('Oferta por funcionalidade','O que oferecer em cada cenário','C01: prédio simples sem operação de portaria. Propostas e referências condicionais; serviço humano opcional.',
 ['Cenário','Oferta ID','Funcionalidade / referência','Estado','Benefício','Executor real / organização existente','Presença necessária','Adaptação ao cenário','Limite / dependência','Referência e recurso observado','Momento candidato'],offerRows,[75,85,240,160,240,260,220,260,290,290,230],125);
const sysRows=systems.map(s=>[...s.slice(0,9),date]);
const sy=sheet('Sistemas de referência','Sistemas e modelos comerciais','Preço publicado não é proposta recebida nem comparação equivalente. C01–C03 são inferências de adequação.',
 ['Sistema','Público anunciado','Tipo','Recursos anunciados','Valor numérico','Preço / contexto','Entrada e modelo comercial','Cenários possíveis / limite','Fontes','Consulta'],sysRows,[200,230,185,300,125,310,310,310,105,110],145);
sy.getRange('E6:E20').setNumberFormat('0.00');sy.getRange('J6:J20').setNumberFormat('dd/mm/yyyy');
const statuses={A:'Anunciado',N:'Não encontrado',I:'Incerto'};
const announced={
 'Acolweb':[0,9], 'Organize meu Condomínio':[0,5,8,9,10],
 'Winker':[0,8,9], 'TownSq':[0,5,6,8,9,10], 'Nextin Home':[],
 'Seu Síndico IA':[1,4,9], 'SindIA':[0,1,8,9],
 'uCondo':[0,5,8,9,10], 'MeuVizy':[0,1,3,6,7,8,9],
 'PedeCondo':[], 'Gcondo':[0,6,9], 'HabitaOne':[0,5,6,8,9,10],
 'iSindi':[0,3,6,9,10], 'Radar Condo':[]
};
const uncertain={'Winker':[1],'Nextin Home':[0,8,9],'Seu Síndico IA':[0],'SindIA':[4],'Gcondo':[1],'Radar Condo':[0,1,4,7,9]};
const matrix=systems.filter(s=>s[9]).map(s=>[s[0],...features.map((f,i)=>announced[s[0]].includes(i)?statuses.A:(uncertain[s[0]]||[]).includes(i)?statuses.I:statuses.N),s[8]]);
if(matrix.some(r=>r.some(v=>v===undefined)))throw Error('Cadeia de status inválida');
matrix.push(['TRÍADE (hipótese)',...features.map(()=> 'Proposta TRÍADE'),'P01–P12; D09 apenas evolução condicional, fora do C01. Sem recurso implementado prometido.']);
sheet('Matriz de funcionalidades','Recursos SaaS e propostas TRÍADE','Anunciado = declaração pública; Não encontrado = sem menção explícita nas páginas consultadas; Incerto = fonte/alcance insuficiente.',
 ['Sistema',...features.map(f=>f[0]+' '+f[1]),'Fontes'],matrix,[200,...features.map(()=>145),260],62);
const focusSheet=sheet('Foco e evolução','Comparar o foco inicial','Critérios qualitativos, sem ranking automático. Campo Decisão aberto para a usuária.',
 ['Opção','Recorte','Dor / evidência','Adoção','Concorrência','Complexidade','Dependência local','Papel candidato','Decisão','O que precisa de teste'],focus,[75,240,285,280,280,280,260,250,145,300],155);
focusSheet.getRange('I6:I9').format.fill='#FFF3D7';
focusSheet.getRange('I6:I9').dataValidation={rule:{type:'list',values:['Não decidido','Testar hipótese','Evolução','Não priorizar agora']}};
focusSheet.getRange('A12:D16').values=[['Etapa','O que fazer','Condição para avançar','Estado'],['1. Descoberta','Confirmar nomes, público e dor; escolher promessa.','Decisão da usuária sobre recorte/oferta.','Em discussão'],['2. Definição','Fechar jornada, custos/canal, responsabilidades e critério de teste.','Escopo e condições definidos.','Pendente'],['3. Construção futura','Codificar MVP da jornada escolhida.','Autorização de implementação e verificação.','Não iniciada por esta pesquisa'],['4. Teste e evolução','Alguns síndicos usam; observar retorno, esforço, impedimentos e continuidade.','Evidência de uso e decisão comercial; preço ainda aberto.','Futuro']];
focusSheet.getRange('A12:D16').format={font:{name:'Arial',size:10},wrapText:true,rowHeight:90};focusSheet.getRange('A12:D12').format={fill:'#244B52',font:{color:'#FFFFFF',bold:true},rowHeight:42};focusSheet.tables.add('A12:D16',true,'Etapas');
const levels=[
 ['Básico: atendimento e controle','Atendimento e controle, com fronteiras de recursos a definir.','Nomes, preço e composição final não aprovados.','Acesso comercial pelo plano; uso de funções sem percurso compulsório.'],
 ['Ampliação: coordenação e agenda','Nível que inclua coordenação e agenda; mais funcionalidades conforme plano.','Limites e composição final a definir; coordenação não significa equipe TRÍADE executando manutenção.','Orçamento não exige pagamento; chamados não exigem financeiro.'],
 ['Serviços e evolução','Implantação de novo condomínio cliente, orientação de novo morador e apoio documental: inclusão em cada plano a definir.','Financeiro/boleto como evolução a decidir; armário futuro após primeiros clientes.','Sem preço inventado, contratação, divulgação ou implementação.']
];
focusSheet.getRange('A19:D22').values=[['Nível','Recursos / escopo','Fronteira pendente','Independência e limites'],...levels];
focusSheet.getRange('A19:D22').format={font:{name:'Arial',size:10},wrapText:true,verticalAlignment:'center',rowHeight:130};
focusSheet.getRange('A19:D19').format={fill:'#244B52',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:42};
focusSheet.tables.add('A19:D22',true,'NiveisPropostos');
focusSheet.getRange('A20:A22').format.font={name:'Arial',size:10,bold:true};
focusSheet.getRange('A20:A22').format.rowHeight=160;
const src=sheet('Fontes e pendências','Fontes, identidades e decisões abertas','Use IDs das fontes nas outras abas. Relatos ficam separados dos fornecedores; nenhuma prevalência foi estimada.',
 ['ID','Fonte','Natureza','URL','Acesso / limite','Nota','Consulta'],sources.map(s=>[s[0],s[1],s[2],s[3],s[4],s[5],date]),[75,240,260,520,220,420,110],100);
src.getRange(`G6:G${5+sources.length}`).setNumberFormat('dd/mm/yyyy');
// URL values stay readable. Native links are added after export because runtime
// HYPERLINK evaluation returns an unsupported-function message.
src.getRange(`D6:D${sources.length+5}`).format.font={name:'Arial',size:10,color:'#165E8A'};
let at=9+sources.length;
src.getRange(`A${at}:F${at+identities.length}`).values=[['ID','Nome informado','Candidato identificado','Estado da associação','Fontes','Pendência'],...identities];
src.getRange(`A${at}:F${at+identities.length}`).format={font:{name:'Arial',size:10},wrapText:true,rowHeight:95};src.getRange(`A${at}:F${at}`).format={fill:'#244B52',font:{color:'#FFFFFF',bold:true},rowHeight:42};src.tables.add(`A${at}:F${at+identities.length}`,true,'Identidades');
at+=identities.length+4;
src.getRange(`A${at}:C${at+pending.length}`).values=[['ID','Decisão pendente','Pergunta / limite'],...pending];src.getRange(`A${at}:C${at+pending.length}`).format={font:{name:'Arial',size:10},wrapText:true,rowHeight:125};src.getRange(`A${at}:C${at}`).format={fill:'#244B52',font:{color:'#FFFFFF',bold:true},rowHeight:42};src.tables.add(`A${at}:C${at+pending.length}`,true,'Pendencias');
// Definições deixam o alcance de cada coluna da matriz verificável.
at+=pending.length+4;
src.getRange(`A${at}:C${at+features.length}`).values=[['ID','Funcionalidade','Critério de leitura'],...features];src.getRange(`A${at}:C${at+features.length}`).format={font:{name:'Arial',size:10},wrapText:true,rowHeight:125};src.getRange(`A${at}:C${at}`).format={fill:'#244B52',font:{color:'#FFFFFF',bold:true},rowHeight:42};src.tables.add(`A${at}:C${at+features.length}`,true,'Definicoes');
function restyle(sh,start,end,last){
 sh.getRange(`A${start}:${last}${end}`).format.verticalAlignment='center';
 sh.getRange(`A${start}:${last}${start}`).format={fill:'#244B52',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:42};
 for(let r=start+1;r<=end;r++){sh.getRange(`A${r}:${last}${r}`).format.fill=r%2===0?'#F1F5F5':'#FFFFFF';sh.getRange(`A${r}:${last}${r}`).format.rowHeight=80;}
}
restyle(focusSheet,12,16,'D');
restyle(src,9+sources.length,9+sources.length+identities.length,'F');
restyle(src,9+sources.length+identities.length+4,9+sources.length+identities.length+4+pending.length,'C');
restyle(src,at,at+features.length,'C');
const pendingStart=9+sources.length+identities.length+4;
for(const id of ['Q03','Q04','Q08']){const r=pendingStart+1+pending.findIndex(p=>p[0]===id);src.getRange(`A${r}:C${r}`).format.rowHeight=id==='Q04'?250:id==='Q08'?200:140;}
src.getRange(`A${pendingStart+1+pending.findIndex(p=>p[0]==='Q09')}:C${pendingStart+1+pending.findIndex(p=>p[0]==='Q09')}`).format.rowHeight=250;
src.getRange(`A${pendingStart+1+pending.findIndex(p=>p[0]==='Q10')}:C${pendingStart+1+pending.findIndex(p=>p[0]==='Q10')}`).format.rowHeight=320;
src.getRange(`A${pendingStart+1+pending.findIndex(p=>p[0]==='Q11')}:C${pendingStart+1+pending.findIndex(p=>p[0]==='Q11')}`).format.rowHeight=250;
const mx=wb.worksheets.getItem('Matriz de funcionalidades').getRange(`B6:M${matrix.length+5}`);
for(let i=0;i<wb.worksheets.items.length;i++)for(const table of wb.worksheets.getItemAt(i).tables.items)table.showFilterButton=true;
for(const [text,fill,color]of [['Anunciado','#E7F1EB','#28533B'],['Incerto','#FFF0D5','#705016'],['Proposta TRÍADE','#E8E8F7','#41396F']])mx.conditionalFormats.add('containsText',{text,format:{fill,font:{color}}});
wb.recalculate();
const checks=[];
for(const s of specs){const r=await wb.inspect({kind:'table',range:`'${s.name}'!A5:D8`,include:'values,formulas',tableMaxRows:4,tableMaxCols:4,maxChars:2200});checks.push(r.ndjson);}
checks.push((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:300},maxChars:2000})).ndjson);
await fs.writeFile(root+'/work/comparativo-checks.txt',checks.join('\n'));
console.log('checks',checks.at(-1));
const views=[['Cenários e ofertas','A1:D8'],['Cenários e ofertas','E5:I8'],['Oferta por funcionalidade','A1:F9'],['Oferta por funcionalidade','G5:K9'],['Oferta por funcionalidade','A10:F16'],['Oferta por funcionalidade','G10:K16'],['Matriz de funcionalidades','G18:N20'],['Foco e evolução','A1:E9'],['Foco e evolução','F5:J9'],['Fontes e pendências',`A${9+sources.length+identities.length+4}:C${9+sources.length+identities.length+4+pending.length}`]];
if(process.argv.includes('--render-levels')){for(const [name,range] of [['Foco e evolução','A19:D22'],['Fontes e pendências','A53:C53']]){const b=await wb.render({sheetName:name,range,scale:1,format:'png'});await fs.writeFile(root+'/work/'+(name==='Foco e evolução'?'niveis':'pendencia-niveis')+'.png',new Uint8Array(await b.arrayBuffer()));}}
if(process.argv.includes('--render')||process.argv.includes('--render-fixes')||process.argv.includes('--render-pending'))for(let i=0;i<views.length;i++){if(process.argv.includes('--render-fixes')&&![2,4,9].includes(i))continue;if(process.argv.includes('--render-pending')&&i!==9)continue;const [sheetName,range]=views[i];const b=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${root}/work/comparativo-${i}.png`,new Uint8Array(await b.arrayBuffer()));}
const x=await SpreadsheetFile.exportXlsx(wb);await x.save(out+'/comparativo-cenarios-saas-2026-10-07.xlsx');
await fs.writeFile(root+'/work/comparativo-data.json',JSON.stringify({sources,systems,features,scenarios,proposals,identities,pending},null,2));
console.log('Exportado',out,'sistemas',systems.length,'ofertas por cenário',offerRows.length,'matriz',matrix.length);
