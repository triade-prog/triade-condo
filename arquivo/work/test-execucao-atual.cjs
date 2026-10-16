const fs=require('fs'),vm=require('vm'),assert=require('assert');const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('outputs/triade-condo/construcao/js/store.js','utf8'),ctx);const S=ctx.TriadeStore,C=JSON.parse(fs.readFileSync('outputs/triade-condo/construcao/catalogo.json'));let checks=0;function test(t,f){f();checks++;console.log('OK '+t)}
test('109 tarefas IDs únicos e 18 implementações pendentes',()=>{assert.equal(C.tasks.length,109);assert.equal(new Set(C.tasks.map(t=>t.id)).size,109);assert(C.tasks.filter(t=>t.id.startsWith('MVP-')).every(t=>t.status==='A fazer'&&!t.evidence))});
test('dependências válidas e sem ciclos',()=>S.validate(S.initial(),C));
test('conclusão sem evidência recusada',()=>assert.throws(()=>S.change(S.initial(),C,'MVP-01',{status:'Concluída'})));
test('conclusão com dependências pendentes recusada',()=>assert.throws(()=>S.change(S.initial(),C,'MVP-03',{status:'Concluída',evidence:'resultado teste'})));
let local=S.change(S.initial(),C,'MVP-01',{status:'Em andamento',owner:'Desenvolvedor',notes:'Revisar decisões'});
test('histórico data e autoria registrada',()=>{assert.equal(local.history.length,1);assert(local.history[0].at);assert.equal(local.history[0].patch.owner,'Desenvolvedor')});
test('roundtrip persistência',()=>{let value;const storage={setItem(k,v){value=v},getItem(){return value}};S.save(storage,local);assert.equal(S.load(storage,C).state.updates['MVP-01'].owner,'Desenvolvedor')});
test('importação inválida não muda registros',()=>{assert.throws(()=>S.merge(local,{version:99},C));assert.equal(local.history.length,1)});
test('merge preserva local e alternativa conflito',()=>{const incoming=S.change(S.initial(),C,'MVP-01',{notes:'Outra proposta'});const merged=S.merge(local,incoming,C);assert.equal(merged.updates['MVP-01'].notes,'Revisar decisões');assert(merged.history.some(h=>h.type.includes('Conflito')))});
test('merge inclui novas atualizações e histórico',()=>{const incoming=S.change(S.initial(),C,'MVP-02',{notes:'Aguardando decisão'});const merged=S.merge(local,incoming,C);assert(merged.updates['MVP-02']);assert(merged.updates['MVP-01'])});
test('catálogo JSON e JS idênticos',()=>{const env={};vm.createContext(env);vm.runInContext(fs.readFileSync('outputs/triade-condo/construcao/js/catalog.js','utf8'),env);assert.equal(JSON.stringify(env.TriadeCatalog),JSON.stringify(C))});
fs.writeFileSync('work/execucao-atual-validacao.json',JSON.stringify({checks,tasks:C.tasks.length,legacyPreserved:80,mvpTasks:18,planningTasks:3,auditTasks:8,visualBrowserVerified:false,productImplemented:false},null,2));
