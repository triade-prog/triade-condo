import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const base='/Users/carolina/Documents/Codex/2026-10-03/triade-condo';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(base+'/outputs/triade-condo/pesquisa/comparativo-cenarios-saas-2026-10-07.xlsx'));
for(const [name,range]of [['financeiro-esquerda','A17:F17'],['financeiro-direita','G17:K17']]){
 const b=await wb.render({sheetName:'Oferta por funcionalidade',range,scale:1,format:'png'});
 await fs.writeFile(base+'/work/'+name+'.png',new Uint8Array(await b.arrayBuffer()));
}
console.log('Revisão visual de P12 a partir do arquivo final.');
const pending=await wb.render({sheetName:'Fontes e pendências',range:'A51:C51',scale:1,format:'png'});
await fs.writeFile(base+'/work/armario-futuro.png',new Uint8Array(await pending.arrayBuffer()));
for(const [name,range]of [['entrada-esquerda','A18:F19'],['entrada-direita','G18:K19']]){
 const b=await wb.render({sheetName:'Oferta por funcionalidade',range,scale:1,format:'png'});
 await fs.writeFile(base+'/work/'+name+'.png',new Uint8Array(await b.arrayBuffer()));
}
