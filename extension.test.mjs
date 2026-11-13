import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const product='https://www.ebgames.ca/shop/games-nintendo-switch-2-196/nintendo-switch-2-the-legend-of-zelda-40th-anniversary-edition-220621';
async function harness({url=product,extraTabs=[],initial={}}={}){
 const state=structuredClone(initial),alarms=new Map(),events={};let reloads=0,reads=0,deliveries=0;
 const chrome={storage:{local:{get:async()=>structuredClone(state),set:async v=>Object.assign(state,v)}},alarms:{create:async(n,v)=>alarms.set(n,v),clear:async n=>alarms.delete(n),get:async n=>alarms.get(n),onAlarm:{addListener:f=>events.alarm=f}},tabs:{query:async query=>query.active?[{id:10,url}]:[{id:10,url},...extraTabs],get:async id=>[{id:10,url},...extraTabs].find(t=>t.id===id),reload:async()=>reloads++,onUpdated:{addListener:f=>events.updated=f},onRemoved:{addListener:f=>events.removed=f}},scripting:{executeScript:async()=>reads++},runtime:{onMessage:{addListener:f=>events.message=f},onStartup:{addListener:f=>events.startup=f}}};
 const source=(await readFile(new URL('./extension/worker.js',import.meta.url),'utf8')).replace("import {trackerKey} from './config.js';","const trackerKey='test-only';");
 const context=vm.createContext({chrome,crypto:{randomUUID},fetch:async()=>{deliveries++;return {ok:true};},AbortSignal,Date,Math,URL,console});
 vm.runInContext(source,context);await vm.runInContext("recover()",context);
 const message=(m,sender={})=>new Promise(resolve=>events.message(m,sender,resolve));
 return {get state(){return state.monitor_ebgames??state;},storeState:id=>state['monitor_'+id]??{},alarms,events,message,recover:()=>vm.runInContext("recover()",context),counts:()=>({reloads,reads,deliveries})};
}
test('established-tab start reads the current page without reloading; a completed read creates a randomized one-shot alarm',async()=>{
 const h=await harness();await h.message({kind:'start'});assert.equal(h.counts().reloads,0);assert.equal(h.counts().reads,1);assert.equal(h.state.awaiting,true);
 const id=h.state.requestId;
 await h.message({kind:'snapshot',requestId:id,snapshot:{title:'Product',name:'Console',stock:'Out of Stock'}},{tab:{id:10},url:product});
 assert.equal(h.state.awaiting,false);assert.equal(h.counts().deliveries,1);assert.ok(h.alarms.has('recheck:ebgames'));const wait=h.alarms.get('recheck:ebgames').when-Date.now();assert.ok(wait>=239900&&wait<=360000);assert.equal(h.alarms.has('watchdog:ebgames'),false);
});
test('unselected tabs and old read messages cannot submit stock results',async()=>{
 const h=await harness();await h.message({kind:'start'});
 await h.message({kind:'snapshot',requestId:h.state.requestId,snapshot:{stock:'In Stock'}},{tab:{id:99},url:product});
 await h.message({kind:'snapshot',requestId:'old',snapshot:{stock:'In Stock'}},{tab:{id:10},url:product});
 assert.equal(h.counts().deliveries,0);assert.equal(h.state.awaiting,true);
});
test('canonical product URL and trailing slash still select the exact console',async()=>{const h=await harness({url:'https://www.ebgames.ca/shop/nintendo-switch-2-the-legend-of-zelda-40th-anniversary-edition-220621/?utm_source=test'});assert.equal((await h.message({kind:'start'})).ok,true);assert.equal(h.state.enabled,true);});
test('missing product tab preserves its start error across status refreshes',async()=>{const h=await harness({url:'http://127.0.0.1:4317/'});const result=await h.message({kind:'start'});assert.match(result.error,/No Zelda console tab/);const status=await h.message({kind:'status'});assert.equal(status.startError,result.error);assert.ok(!status.enabled);});
test('Staples and EB use separate selected tabs and alarms; stopping Staples preserves EB',async()=>{
 const staples='https://www.staples.ca/products/3193784-en-nintendo-the-legend-of-zelda-40th-anniversary-edition-switch-2-console';
 const h=await harness({extraTabs:[{id:20,url:staples}]});
 await h.message({kind:'start',storeId:'ebgames'});await h.message({kind:'start',storeId:'staples'});
 assert.equal(h.storeState('ebgames').tabId,10);assert.equal(h.storeState('staples').tabId,20);
 for(const [id,tabId,url]of [['ebgames',10,product],['staples',20,staples]])await h.message({kind:'snapshot',requestId:h.storeState(id).requestId,snapshot:{title:'Console',name:'Console',stock:'Out of Stock'}},{tab:{id:tabId},url});
 assert.ok(h.alarms.has('recheck:ebgames'));assert.ok(h.alarms.has('recheck:staples'));
 await h.message({kind:'stop',storeId:'staples'});assert.equal(h.storeState('staples').enabled,false);assert.equal(h.storeState('ebgames').enabled,true);assert.ok(h.alarms.has('recheck:ebgames'));
});
test('legacy EB selection remains readable after upgrading to multiple retailers',async()=>{const h=await harness({initial:{enabled:true,tabId:10,lastStock:'Out of Stock'}});const s=await h.message({kind:'status',storeId:'ebgames'});assert.equal(s.enabled,true);assert.equal(s.tabId,10);assert.equal(s.lastStock,'Out of Stock');assert.ok(!(await h.message({kind:'status',storeId:'staples'})).enabled);});

test('both controller monitors coexist with console monitors and route snapshots independently',async()=>{
 const eb='https://www.ebgames.ca/shop/904030-nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition-220623';
 const staples='https://www.staples.ca/products/3193785-en-nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition';
 const h=await harness({extraTabs:[{id:30,url:eb},{id:40,url:staples}]});
 for(const id of ['ebgames','ebgames_controller','staples_controller'])assert.equal((await h.message({kind:'start',storeId:id})).ok,true);
 assert.equal(h.storeState('ebgames').tabId,10);assert.equal(h.storeState('ebgames_controller').tabId,30);assert.equal(h.storeState('staples_controller').tabId,40);
 const ready=await h.message({kind:'ready'},{tab:{id:40},url:staples});assert.equal(ready.storeId,'staples_controller');assert.equal(ready.retailerId,'staples');
 await h.message({kind:'snapshot',requestId:ready.requestId,snapshot:{title:'Controller',name:'Controller',stock:'Out of Stock'}},{tab:{id:40},url:staples});
 assert.ok(h.alarms.has('recheck:staples_controller'));assert.equal(h.storeState('ebgames').awaiting,true);
 await h.message({kind:'stop',storeId:'staples_controller'});assert.equal(h.storeState('ebgames_controller').enabled,true);
});

test('controller monitor cannot select a console listing or a different product',async()=>{
 const h=await harness();assert.match((await h.message({kind:'start',storeId:'ebgames_controller'})).error,/No Zelda controller tab/);
 assert.equal((await h.message({kind:'ready'},{tab:{id:10},url:product})).read,false);
});
test('worker recovery restores the saved future deadline instead of choosing a fresh delay',async()=>{
 const deadline=Date.now()+250000;
 const h=await harness({initial:{monitor_ebgames:{enabled:true,tabId:10,lastCheck:new Date().toISOString(),nextCheck:deadline}}});
 assert.equal(h.state.nextCheck,deadline);assert.equal(h.alarms.get('recheck:ebgames').when,deadline);
 h.alarms.delete('recheck:ebgames');await h.recover();assert.equal(h.state.nextCheck,deadline);assert.equal(h.alarms.get('recheck:ebgames').when,deadline);assert.equal(h.counts().reloads,0);
});
test('overdue saved check runs once immediately rather than being postponed',async()=>{
 const h=await harness({initial:{monitor_ebgames:{enabled:true,tabId:10,lastCheck:new Date(Date.now()-900000).toISOString(),nextCheck:Date.now()-600000}}});
 assert.equal(h.counts().reloads,1);assert.equal(h.state.awaiting,true);await h.recover();assert.equal(h.counts().reloads,1);
});
test('a twenty-minute scheduling drift is corrected even if nextCheck is in the future',async()=>{
 const h=await harness({initial:{monitor_ebgames:{enabled:true,tabId:10,lastCheck:new Date(Date.now()-1200000).toISOString(),nextCheck:Date.now()+240000}}});
 assert.equal(h.counts().reloads,1);assert.equal(h.state.awaiting,true);
});
test('missing watchdog keeps the original deadline rather than resetting two minutes',async()=>{
 const started=Date.now()-60000;
 const h=await harness({initial:{monitor_ebgames:{enabled:true,tabId:10,awaiting:true,checkStartedAt:started,requestId:'pending'}}});
 assert.equal(h.alarms.get('watchdog:ebgames').when,started+120000);h.alarms.delete('watchdog:ebgames');await h.recover();assert.equal(h.alarms.get('watchdog:ebgames').when,started+120000);
});
