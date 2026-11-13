import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./extension/content.js',import.meta.url),'utf8');
async function run(labels,{storeId='ebgames'}={}){
 let tick;const reports=[];
 const node=text=>({innerText:text,getClientRects:()=>[{}]});
 const root={querySelectorAll:selector=>selector==='.product-sold-out'?labels.map(node):[]};
 const context={chrome:{runtime:{sendMessage:async message=>{if(message.kind==='ready')return {read:true,storeId,requestId:'one'};reports.push(message);}}},document:{title:'Console',querySelector:selector=>selector==='.product__page'?root:{textContent:'Nintendo Switch 2 - The Legend of Zelda - 40th Anniversary Edition'},querySelectorAll:selector=>selector==='h1.product-title'?[{textContent:'Nintendo The Legend of Zelda: 40th Anniversary Edition Switch 2 Console'}]:selector.includes('#add_to_cart')?[]:labels.map(node)},getComputedStyle:()=>({visibility:'visible'}),setInterval:f=>{tick=f;return 1;},clearInterval:()=>{},Date,console};
 await vm.runInNewContext(source,context);await tick();return reports;
}
test('fourteen empty duplicate stock IDs do not hide the fifteenth populated label',async()=>{const reports=await run([...Array(14).fill(''),'Out of Stock\nGet notified when back in stock']);assert.equal(reports.length,1);assert.equal(reports[0].snapshot.stock,'Out of Stock');});
test('notification copy alone is not a positive stock reading',async()=>{const reports=await run(['','Get notified when back in stock']);assert.equal(reports.length,0);});
test('Staples reader uses the product sold-out label',async()=>{const reports=await run(['Out of Stock'],{storeId:'staples'});assert.equal(reports[0].snapshot.stock,'Out of Stock');assert.match(reports[0].snapshot.name,/Switch 2 Console/);});
test('Staples does not use unrelated Add to Cart controls outside the product form',async()=>{const reports=await run([],{storeId:'staples'});assert.equal(reports.length,0);});
