import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {stores,retailers,historyName} from './products.mjs';
import {checkStore} from './checker.mjs';
import {createStockHistory,recordStock,latestStockTimes} from './history.mjs';
import {parseEBBrowserSnapshot,parseStaplesSnapshot} from './browser-checker.mjs';
import {nextDelay,minDelay,maxDelay} from './timing.mjs';
import {createSmsService} from './sms.mjs';
import {recordMetadata} from './metadata.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
let interval=nextDelay(),timer;
const observations={};
const tabParsers=Object.fromEntries(stores.filter(s=>['ebgames','staples'].includes(s.retailerId)).map(s=>[s.id,s.retailerId==='ebgames'?parseEBBrowserSnapshot:parseStaplesSnapshot]));
const evidenceFile=id=>root+'data/'+(id==='ebgames'?'eb-tab-last.json':id==='staples'?'staples-tab-last.json':id+'-tab-last.json');
await mkdir(root+'data',{recursive:true});
let trackerKey;
try{trackerKey=JSON.parse(await readFile(root+'data/extension-key.json','utf8')).key;}catch{}
if(!/^[a-f0-9]{64}$/.test(trackerKey??'')){trackerKey=randomBytes(32).toString('hex');await writeFile(root+'data/extension-key.json',JSON.stringify({key:trackerKey}));}
await writeFile(root+'extension/config.js',`export const trackerKey=${JSON.stringify(trackerKey)};\n`);
let rows=stores.map(s=>({...s,status:'pending',note:'Waiting for first check.',checkedAt:null}));
for(const id of Object.keys(tabParsers))try{const payload=JSON.parse(await readFile(evidenceFile(id),'utf8'));const index=stores.findIndex(s=>s.id===id);if(payload.url===stores[index].url&&Number.isFinite(Date.parse(payload.observedAt))){observations[id]=payload;rows[index]={...stores[index],...tabParsers[id](payload.snapshot,stores[index]),method:'Established browser tab',checkedAt:payload.observedAt};}}catch{}
let running=false,nextCheck=null,lastRun=0,saved={};
try{saved=JSON.parse(await readFile(root+'data/history.json','utf8'));}catch{}
const stockHistory=createStockHistory(saved,stores);
const sms=await createSmsService({directory:root+'data'});
function recordAndNotify(store,event){const recorded=recordStock(stockHistory,event);if(recorded&&event.status==='in_stock')void persist().then(()=>sms.notifyRestock(store,event)).catch(()=>console.error('SMS alert could not be processed.'));return recorded;}
let saving=Promise.resolve();
function persist(){saving=saving.catch(()=>{}).then(()=>writeFile(root+'data/history.json',JSON.stringify({schema:2,...stockHistory},null,2)));return saving;}
function viewRow(row){
 if(!tabParsers[row.id])return row;
 if(!observations[row.id])return {...row,status:'pending',note:`Waiting for the ${row.name} tab extension. Select its established product tab in ReStockWatch.`,method:'Established browser tab · not connected',checkedAt:null};
 if(Date.now()-Date.parse(observations[row.id].observedAt)>9*60000)return {...row,status:'unknown',note:'Tab result is over nine minutes old. Confirm that the selected tab and extension are still running.',method:'Established browser tab · stale'};
 return row;
}
async function refresh(){
 if(running)return;
 running=true;lastRun=Date.now();
 clearTimeout(timer);
 await Promise.all(stores.map(async(store,index)=>{
  if(tabParsers[store.id])return;
  const value=await checkStore(store),checkedAt=new Date().toISOString(),previous=rows[index];
  rows[index]={...store,...value,checkedAt,lastVerifiedAt:['in_stock','out_of_stock','preorder'].includes(value.status)?checkedAt:previous.lastVerifiedAt??null};
  const metadataEvent=recordMetadata(stockHistory,store,value,checkedAt);
  if(metadataEvent?.status==='unverified')void persist().then(()=>sms.notifyPossibleStock(store,metadataEvent)).catch(()=>console.error('Possible-stock alert could not be processed.'));
  recordAndNotify(store,{store:historyName(store),productId:store.productId,variant:store.variant,status:value.status,at:checkedAt,source:'monitor',note:value.status==='in_stock'?'Restock detected.':'Sellout detected.'});
 }));
 running=false;interval=nextDelay();nextCheck=new Date(Date.now()+interval).toISOString();timer=setTimeout(()=>void refresh(),interval);
 try{await persist();}catch(e){console.error('History save failed:',e.message);}
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.host && !/^(127\.0\.0\.1|localhost):4317$/.test(req.headers.host)){res.writeHead(403).end();return;}
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/api/sms'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(sms.status()));return;}
 if(['/api/sms','/api/sms-test'].includes(pathname)&&req.method==='POST'){
  if(!['http://127.0.0.1:4317','http://localhost:4317'].includes(req.headers.origin)||req.headers['x-stockwatch-action']!=='sms-settings'){res.writeHead(403).end();return;}
  try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){res.writeHead(413).end();return;}}const input=JSON.parse(body);
   const result=pathname==='/api/sms'?await sms.configure(input):input.confirm===true?await sms.test():{error:'Explicit test confirmation is required.'};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:e instanceof SyntaxError?'Invalid settings JSON.':e.message}));}return;
 }
 if(pathname==='/api/browser-result'){
  const origin=req.headers.origin;
  if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)){res.writeHead(403).end();return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Tracker-Key');res.writeHead(204).end();return;}
  const key=String(req.headers['x-tracker-key']??'');
  if(req.method!=='POST'||!/^[a-f0-9]{64}$/.test(key)||!timingSafeEqual(Buffer.from(key),Buffer.from(trackerKey))){res.writeHead(403).end();return;}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192){res.writeHead(413).end();return;}}
   const payload=JSON.parse(body);const id=payload.storeId??'ebgames';const store=stores.find(s=>s.id===id);const snap=payload.snapshot;
   const observed=Date.parse(payload.observedAt);
   if(!tabParsers[id]||payload.url!==store?.url||!snap||!Number.isFinite(observed)||observed>Date.now()+60000||Date.now()-observed>9*60000||!['title','name','stock'].every(k=>typeof snap[k]==='string'&&snap[k].length<=2000)){res.writeHead(400).end('Invalid or stale browser observation');return;}
   if(observations[id]&&observed<=Date.parse(observations[id].observedAt)){res.writeHead(200).end('Already recorded');return;}
   const value=tabParsers[id]({...snap,orderButtonEnabled:snap.orderButtonEnabled===true},store);
   const index=stores.findIndex(s=>s.id===id);
   rows[index]={...store,...value,method:'Established browser tab',checkedAt:payload.observedAt};observations[id]=payload;
   recordAndNotify(store,{store:historyName(store),productId:store.productId,variant:store.variant,status:value.status,at:payload.observedAt,source:'tab-extension',note:value.status==='in_stock'?'Restock detected in established browser tab.':'Sellout detected in established browser tab.'});
   await persist();await writeFile(evidenceFile(id),JSON.stringify(payload,null,2));res.writeHead(200).end('Recorded');
  }catch{if(!res.headersSent)res.writeHead(400).end('Invalid browser observation');}return;
 }
 if(pathname==='/api/status' && req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({rows:rows.map(viewRow).map(r=>({...r,...latestStockTimes(stockHistory,historyName(r))})),retailers,history:stockHistory.history,sms:sms.status(),running,nextCheck,interval,minDelay,maxDelay}));return;}
 if(pathname==='/api/refresh' && req.method==='POST'){
  if(req.headers.origin && !['http://127.0.0.1:4317','http://localhost:4317'].includes(req.headers.origin)){res.writeHead(403).end();return;}
  if(Date.now()-lastRun<30000){res.writeHead(429).end('Please wait 30 seconds between checks.');return;}
  void refresh();res.writeHead(202).end();return;
 }
 const files={'/':['index.html','text/html'],'/sms':['sms.html','text/html'],'/sms.js':['sms.js','text/javascript'],'/extension-guide':['extension-guide.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/console.jpg':['console.jpg','image/jpeg']};
 const item=files[pathname];if(!item || req.method!=='GET'){res.writeHead(404).end();return;}
 try{res.setHeader('Content-Type',item[1]);res.end(await readFile(root+'public/'+item[0]));}catch{res.writeHead(404).end();}
});
server.listen(4317,'127.0.0.1',()=>{console.log('ReStockWatch: http://127.0.0.1:4317');void refresh();});
server.on('error',e=>{console.error(e.message);process.exit(1);});
