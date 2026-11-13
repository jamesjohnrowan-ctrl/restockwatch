import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createSmsService,validateSmsConfig,smsBody} from './sms.mjs';
const root=fileURLToPath(new URL('../../work/',import.meta.url));await mkdir(root,{recursive:true});
const config={enabled:true,accountSid:'AC'+'0'.repeat(32),authToken:'a'.repeat(32),from:'+15005550006',to:'+14165551234',monthlyLimit:20};
const store={id:'ebgames',name:'EB Games',url:'https://www.ebgames.ca/shop/console-220621'};
const at='2026-11-11T21:00:00.000Z';
async function fixture(fetcher){const directory=await mkdtemp(root+'sms-test-');const calls=[];const fake=fetcher??(async(url,request)=>{calls.push({url,request});return {ok:true,json:async()=>({sid:'SM'+'1'.repeat(32),status:'queued'})};});const options={directory,fetcher:fake,now:()=>new Date(at)};return {service:await createSmsService(options),calls,options};}
test('SMS defaults off and does not contact Twilio',async()=>{const f=await fixture();assert.equal(f.service.status().enabled,false);assert.equal((await f.service.notifyRestock(store,{status:'in_stock',at})).skipped,'disabled');assert.equal(f.calls.length,0);});
test('one fresh restock sends once across duplicates and restart',async()=>{const f=await fixture();await f.service.configure(config);const event={status:'in_stock',at};assert.equal((await f.service.notifyRestock(store,event)).status,'accepted');await f.service.notifyRestock(store,event);const restarted=await createSmsService(f.options);await restarted.notifyRestock(store,event);assert.equal(f.calls.length,1);assert.equal(f.calls[0].request.body.get('To'),config.to);});
test('sold out and old history do not send texts',async()=>{const f=await fixture();await f.service.configure(config);await f.service.notifyRestock(store,{status:'out_of_stock',at});await f.service.notifyRestock(store,{status:'in_stock',at:'2026-11-10T18:00:00Z'});assert.equal(f.calls.length,0);});
test('monthly cap includes tests and failed attempts',async()=>{const f=await fixture(async()=>({ok:false,json:async()=>({code:21608})}));await f.service.configure({...config,monthlyLimit:1});assert.equal((await f.service.test()).status,'rejected');assert.equal((await f.service.notifyRestock(store,{status:'in_stock',at})).skipped,'monthly limit reached');assert.equal(f.service.status().attemptsThisMonth,1);});
test('network uncertainty reserves event and prevents automatic duplicate',async()=>{let count=0;const f=await fixture(async()=>{count++;throw Error('timeout');});await f.service.configure(config);const e={status:'in_stock',at};assert.equal((await f.service.notifyRestock(store,e)).status,'uncertain');await f.service.notifyRestock(store,e);assert.equal(count,1);});
test('public status never exposes credentials or full phone number',async()=>{const f=await fixture();await f.service.configure(config);const publicState=JSON.stringify(f.service.status());for(const value of [config.accountSid,config.authToken,config.to,config.from])assert.ok(!publicState.includes(value));});
test('incomplete setup cannot enable alerts and blank fields retain saved secrets',()=>{assert.throws(()=>validateSmsConfig({enabled:true}),/Enter your/);assert.equal(validateSmsConfig({enabled:true,authToken:''},config).authToken,config.authToken);assert.throws(()=>validateSmsConfig({...config,monthlyLimit:101}),/limit/);});
test('alert is plain text and includes retailer purchase link',()=>{const text=smsBody(store);assert.match(text,/EB Games/);assert.ok(text.includes(store.url));assert.ok(/^[\x20-\x7E]+$/.test(text));});
test('SMS names the item explicitly and supports a distinct controller name',()=>{assert.match(smsBody(store),/Switch 2 console - Zelda 40th Anniversary Edition IN STOCK/);const text=smsBody({...store,productName:'Switch 2 Pro Controller - Zelda 40th Anniversary Edition'});assert.match(text,/Pro Controller - Zelda 40th Anniversary Edition IN STOCK/);assert.doesNotMatch(text,/Switch 2 console/);});

test('possible-stock SMS is explicit, names the variant, and deduplicates across restart',async()=>{
 const f=await fixture();await f.service.configure(config);
 const s={id:'nintendo_stand',retailerId:'nintendo',name:'Nintendo Canada',productName:'Zelda controller + display stand',url:'https://www.nintendo.com/en-ca/store/products/example/'};
 const e={status:'unverified',source:'metadata-monitor',at};
 await f.service.notifyPossibleStock(s,e);await f.service.notifyPossibleStock(s,e);
 const restarted=await createSmsService(f.options);await restarted.notifyPossibleStock(s,e);
 assert.equal(f.calls.length,1);const body=f.calls[0].request.body.get('Body');assert.match(body,/POSSIBLE STOCK/);assert.match(body,/UNCONFIRMED/);assert.match(body,/display stand/);assert.ok(body.includes(s.url));
 await restarted.notifyPossibleStock(s,{...e,status:'unverified_end'});await restarted.notifyPossibleStock(s,{...e,source:'user-note'});assert.equal(f.calls.length,1);
});
