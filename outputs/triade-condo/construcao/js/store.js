(function(g){
'use strict';
const statuses=['A fazer','Em andamento','Bloqueada','Em revisão','Concluída'],priorities=['P0','P1','P2'];
const key='triade-construcao-v1';
const mutable=['status','priority','owner','notes','evidence','targetDate','updatedAt'];
function initial(){return {version:1,updates:{},custom:[],history:[],sessions:[]};}
function checkFields(t){
 if(!statuses.includes(t.status)||!priorities.includes(t.priority))throw Error('Status ou prioridade inválidos.');
 for(const k of ['owner','notes','evidence','targetDate','updatedAt'])if(t[k]!==undefined&&(typeof t[k]!=='string'||t[k].length>8000))throw Error('Campo inválido: '+k);
 if(t.targetDate&&!/^\d{4}-\d{2}-\d{2}$/.test(t.targetDate))throw Error('Data inválida.');
}
function validate(raw,catalog){
 if(!raw||raw.version!==1||!raw.updates||typeof raw.updates!=='object'||Array.isArray(raw.updates)||!Array.isArray(raw.custom)||raw.custom.length>500)throw Error('Arquivo incompatível com este painel.');
 const ids=new Set(catalog.tasks.map(t=>t.id));if(ids.size!==catalog.tasks.length)throw Error('IDs duplicados no catálogo; preservar registros e corrigir base.');
 const custom=raw.custom.map(t=>{
  if(!t||!/^LOCAL-\d{3,6}$/.test(t.id)||ids.has(t.id)||!catalog.phases.some(p=>p.id===t.phase)||!Array.isArray(t.deps)||t.deps.some(x=>typeof x!=='string'))throw Error('Tarefa adicional inválida.');
  for(const k of ['title','criteria','front','kind'])if(typeof t[k]!=='string'||!t[k].trim()||t[k].length>4000)throw Error('Tarefa adicional incompleta.');
  checkFields(t);ids.add(t.id);return {...t,baseline:'Pendente',evidence:t.evidence||'',owner:t.owner||'',notes:t.notes||''};
 });
 const all=[...catalog.tasks,...custom];
 for(const t of all)if(t.deps.some(id=>!ids.has(id)||id===t.id))throw Error('Dependência desconhecida ou circular.');
 const seen=new Set(),active=new Set(),map=new Map(all.map(t=>[t.id,t]));
 function visit(id){if(active.has(id))throw Error('Dependências circulares.');if(seen.has(id))return;active.add(id);map.get(id).deps.forEach(visit);active.delete(id);seen.add(id);}
 all.forEach(t=>visit(t.id));
 const updates={};
 for(const [id,v] of Object.entries(raw.updates)){
  if(!ids.has(id)||!v||typeof v!=='object')throw Error('Atualização de tarefa desconhecida.');
  const patch=Object.fromEntries(mutable.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
  checkFields({...map.get(id),...patch});updates[id]=patch;
 }
 if(raw.history!==undefined&&(!Array.isArray(raw.history)||raw.history.length>10000||raw.history.some(h=>!h||typeof h.id!=='string'||!ids.has(h.id)||typeof h.at!=='string'||!Number.isFinite(Date.parse(h.at))||typeof h.type!=='string'||h.type.length>8000||!h.patch||typeof h.patch!=='object'||Array.isArray(h.patch))))throw Error('Histórico inválido.');
 const sessions=raw.sessions===undefined?[]:raw.sessions;
 if(!Array.isArray(sessions)||sessions.length>10000)throw Error('Sessões inválidas.');
 const sessionIds=new Set();for(const x of sessions){if(!x||typeof x.sid!=='string'||!x.sid||x.sid.length>300||typeof x.end!=='string'||sessionIds.has(x.sid)||!ids.has(x.id)||typeof x.start!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x.start)||!Number.isFinite(Date.parse(x.start))||typeof x.summary!=='string'||x.summary.length>8000||(x.end&&(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x.end)||!Number.isFinite(Date.parse(x.end))||Date.parse(x.end)<Date.parse(x.start)))||(x.end&&!x.summary.trim()))throw Error('Sessão de trabalho inválida.');sessionIds.add(x.sid);}
 for(const id of ids)if(sessions.filter(x=>x.id===id&&!x.end).length>1)throw Error('Mais de uma sessão aberta na tarefa.');
 const state={version:1,updates,custom,history:raw.history||[],sessions};
 for(const t of tasks(state,catalog))if(t.status==='Concluída'&&!t.evidence.trim())throw Error('Conclusão sem evidência em '+t.id);
 return state;
}
function tasks(state,catalog){return [...catalog.tasks,...state.custom].map(t=>({...t,...state.updates[t.id]}));}
function blockers(t,all){return t.deps.filter(id=>all.find(o=>o.id===id)?.status!=='Concluída');}
function change(state,catalog,id,patch){
 const all=tasks(state,catalog),t=all.find(t=>t.id===id);if(!t)throw Error('Tarefa não encontrada.');
 const cleaned=Object.fromEntries(mutable.filter(k=>patch[k]!==undefined).map(k=>[k,patch[k]]));
 const next={...t,...cleaned};checkFields(next);
 if(next.status==='Concluída'){
  if(!next.evidence.trim())throw Error('Informe uma evidência ou resultado verificável para concluir.');
  const waiting=blockers(next,all);if(waiting.length)throw Error('Conclua primeiro as dependências: '+waiting.join(', '));
 }
 const at=new Date().toISOString();return validate({...state,history:[...(state.history||[]),{id,at,type:'Alteração',patch:cleaned,before:Object.fromEntries(mutable.map(k=>[k,t[k]||'']))}],updates:{...state.updates,[id]:{...state.updates[id],...cleaned,updatedAt:at}}},catalog);
}
function create(state,catalog,input){
 const max=Math.max(0,...state.custom.map(t=>Number(t.id.split('-')[1]))),id='LOCAL-'+String(max+1).padStart(3,'0');
 const task={...input,id,baseline:'Pendente',status:'A fazer',owner:input.owner||'',notes:input.notes||'',evidence:'',updatedAt:new Date().toISOString()};
 return validate({...state,custom:[...state.custom,task],history:[...(state.history||[]),{id,at:task.updatedAt,type:'Tarefa adicional criada',patch:task}]},catalog);
}
function addConflict(history,item){if(!history.some(h=>h.id===item.id&&h.type===item.type&&JSON.stringify(h.patch)===JSON.stringify(item.patch)))history.push({...item,at:new Date().toISOString()});}
function merge(local,incoming,catalog){
 local=validate(local,catalog);incoming=validate(incoming,catalog);
 const custom=[...local.custom];for(const t of incoming.custom){const old=custom.find(o=>o.id===t.id);if(old&&JSON.stringify(old)!==JSON.stringify(t))throw Error('Tarefa adicional com ID em conflito: '+t.id+'. Nenhum registro alterado; reconciliar IDs na cópia.');if(!old)custom.push(t);}
 const updates={...local.updates},history=[...(local.history||[])];
 for(const h of incoming.history||[])if(!history.some(o=>JSON.stringify(o)===JSON.stringify(h)))history.push(h);
 for(const [id,patch] of Object.entries(incoming.updates)){if(!updates[id])updates[id]=patch;else if(JSON.stringify(updates[id])!==JSON.stringify(patch))addConflict(history,{id,type:'Conflito importado — local preservado',patch});}
 const sessions=[...(local.sessions||[])];for(const x of incoming.sessions||[]){const old=sessions.find(o=>o.sid===x.sid);if(old){if(JSON.stringify(old)!==JSON.stringify(x))addConflict(history,{id:x.id,type:'Conflito de sessão importada — local preservado',patch:x});}else if(!x.end&&sessions.some(o=>o.id===x.id&&!o.end))addConflict(history,{id:x.id,type:'Sessão aberta importada em conflito — preservada neste histórico',patch:x});else sessions.push(x);}
 return validate({version:1,updates,custom,history,sessions},catalog);
}
function startSession(state,catalog,id){if(!tasks(state,catalog).some(t=>t.id===id))throw Error('Tarefa desconhecida.');if((state.sessions||[]).some(x=>x.id===id&&!x.end))throw Error('Já existe sessão aberta nesta tarefa.');const at=new Date().toISOString(),session={sid:'S-'+Date.now()+'-'+Math.random().toString(36).slice(2),id,start:at,end:'',summary:''};return validate({...state,sessions:[...(state.sessions||[]),session],history:[...(state.history||[]),{id,at,type:'Início de sessão registrado',patch:session}]},catalog);}
function finishSession(state,catalog,id,summary){if(typeof summary!=='string'||!summary.trim())throw Error('Preencha o resumo do trabalho feito para finalizar a sessão.');const current=(state.sessions||[]).find(x=>x.id===id&&!x.end);if(!current)throw Error('Nenhuma sessão aberta nesta tarefa.');const at=new Date().toISOString(),finished={...current,end:at,summary:summary.trim()};return validate({...state,sessions:state.sessions.map(x=>x.sid===current.sid?finished:x),history:[...(state.history||[]),{id,at,type:'Finalização de sessão registrada — não aceita tarefa',patch:finished}]},catalog);}
function correctSession(state,catalog,sid,start,end,summary,reason){const old=(state.sessions||[]).find(x=>x.sid===sid);if(!old||!reason.trim())throw Error('Sessão e motivo de ajuste obrigatórios.');const corrected={...old,start,end,summary};return validate({...state,sessions:state.sessions.map(x=>x.sid===sid?corrected:x),history:[...(state.history||[]),{id:old.id,at:new Date().toISOString(),type:'Ajuste manual de sessão: '+reason,patch:corrected,before:old}]},catalog);}
function load(storage,catalog){let raw=null;try{raw=storage.getItem(key);return {state:raw?validate(JSON.parse(raw),catalog):initial(),error:'',raw};}catch(e){return {state:initial(),raw,error:'Não foi possível recuperar o registro local: '+e.message+'. O dado anterior não foi apagado. Baixe o original e importe uma cópia válida para recuperá-lo.'};}}
function preserveRaw(storage,raw){if(raw===null||raw===undefined)return '';const backupKey=key+'-backup-'+new Date().toISOString()+'-'+Math.random().toString(36).slice(2);storage.setItem(backupKey,raw);if(storage.getItem(backupKey)!==raw)throw Error('Backup original não confirmado; recuperação interrompida.');return backupKey;}
function save(storage,state){storage.setItem(key,JSON.stringify(state));}
g.TriadeStore={statuses,priorities,key,initial,validate,tasks,blockers,change,create,merge,startSession,finishSession,correctSession,load,preserveRaw,save};
})(globalThis);
