const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const file=path.resolve('mapa-da-empresa.html'),html=fs.readFileSync(file,'utf8');
const data=JSON.parse(html.match(/<script id="map-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const flatten=a=>a.flatMap(n=>[n,...flatten(n.children)]),all=flatten(data);let tests=0;function test(name,f){f();tests++;console.log('OK '+name)}
const elements={};function el(id){return elements[id]||= {textContent:'',innerHTML:'',dataset:{},addEventListener(t,f){this[t]=f},click(){this.clicked=true}}}
el('map-data').textContent=JSON.stringify(data);const details=all.map(()=>({open:false}));const nodes=Object.fromEntries(all.map((n,i)=>[n.id,{hidden:false,querySelector(){return details[i]},querySelectorAll(){return []}}]));let saved={},download;const document={getElementById:el,querySelectorAll:()=>details,querySelector:s=>nodes[s.match(/data-node="([^"]+)/)[1]],createElement(){return download=el('download')}};
const ctx={document,localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v},Blob,URL:{createObjectURL:()=> 'blob:review',revokeObjectURL(){}},setTimeout:f=>f()};vm.createContext(ctx);const code=html.match(/<script>\n([\s\S]*?)<\/script>/)[1];vm.runInContext(code,ctx);
test('4 áreas e IDs únicos',()=>{assert.equal(data.length,4);assert.equal(new Set(all.map(n=>n.id)).size,all.length)});
test('Conteúdo atual e desconhecidos explícitos',()=>{for(const t of ['TRÍADE Condo','CNPJ','paleta','não uma paleta','Morador exclusivamente','Propostas/orçamentos excluídos','inseparável','receptor','stack aprovada'])assert(html.includes(t),t)});
test('Expandir e recolher',()=>{el('expand').onclick();assert(details.every(d=>d.open));el('collapse').onclick();assert(details.every(d=>!d.open))});
test('Notas e persistência',()=>{el('map').input({target:{dataset:{note:'logo'},value:'Revisar símbolo <teste>'}});assert(JSON.parse(saved['triade-mapa-empresa-v1']).logo.note.includes('<teste>'))});
test('Estado editável',()=>{el('map').input({target:{dataset:{state:'logo'},value:'proposto'}});assert.equal(el('badge-logo').textContent,'Proposto')});
test('Busca e ancestrais',()=>{el('search').oninput({target:{value:'receptor sonoro'}});assert.equal(nodes.sistema.hidden,false);assert.equal(nodes.qr.hidden,false);assert.equal(nodes.marca.hidden,true);el('search').oninput({target:{value:''}});assert(Object.values(nodes).every(n=>!n.hidden))});
test('Exportação local',()=>{el('export').onclick();assert.equal(download.download,'triade-mapa-da-empresa-revisao.json');assert(download.clicked)});
test('Reabertura recupera revisão e escapa notas',()=>{vm.runInContext(code,vm.createContext({...ctx}));assert(el('map').innerHTML.includes('&lt;teste&gt;'))});
test('Falha no armazenamento tem aviso e mantém sessão',()=>{const fallback=vm.createContext({...ctx,localStorage:{getItem(){throw Error()},setItem(){throw Error()}}});vm.runInContext(code,fallback);assert(el('storage').textContent.includes('indisponível'))});
test('Links locais resolvem',()=>{for(const m of html.matchAll(/href="([^"]+)"/g)){const h=m[1];if(!h.includes('${'))assert(fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(h))),h)}for(const n of all)if(n.link)assert(fs.existsSync(path.resolve(n.link)),n.link)});
test('Sem rede e sem bibliotecas externas',()=>{assert(!/fetch\(|https?:\/\/|<script src=|<link.*stylesheet/.test(html))});
fs.writeFileSync('work/mapa-validacao.json',JSON.stringify({checks:tests,points:all.length,interaction:'DOM simulado',visualBrowserVerified:false,productImplemented:false},null,2));
