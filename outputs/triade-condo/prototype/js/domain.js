export function pending(t) { return t.decision?.state === 'Pendente'; }
export function overdue(t,now) {return t.status !== 'Concluído' && new Date(t.response) < now;}
export function record(t,text) {t.history.push(`${new Date().toLocaleString('pt-BR')} • ${text} [simulação]`);}
export function decide(t,choice,reason) {if(!pending(t)||!reason.trim()) throw Error('Informe a justificativa da decisão.'); t.decision.state=choice;t.status=choice==='Aprovado'?'Em andamento':'Em triagem';record(t,`Síndico: ${choice}. ${reason}`);}
export function review(t) {if(t.status!=='Em revisão'||!t.evidence.trim()||!t.closure.trim())throw Error('Registre evidência e explicação antes da revisão.');t.status='Concluído';record(t,`Operação revisou e concluiu: ${t.closure}. Evidência: ${t.evidence}`);}
