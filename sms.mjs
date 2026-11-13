import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
const defaults={enabled:false,accountSid:'',authToken:'',from:'',to:'',monthlyLimit:20};
const phone=value=>/^\+[1-9]\d{7,14}$/.test(value);
const mask=value=>value?'•••• '+value.slice(-4):'';
function monthKey(date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit'}).formatToParts(date);return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
export function smsBody(store){const item=store.productName||'Nintendo Switch 2 console - Zelda 40th Anniversary Edition';return `ReStockWatch: ${item} IN STOCK at ${store.name}. ${store.url}`.normalize('NFKD').replace(/[^\x20-\x7E]/g,'');}
export function possibleStockBody(store){return `ReStockWatch: POSSIBLE STOCK (?) - ${store.productName}. Nintendo metadata changed to InStock; purchasing is UNCONFIRMED. Check the page now: ${store.url}`.normalize('NFKD').replace(/[^\x20-\x7E]/g,'');}
export function validateSmsConfig(input,current=defaults){
 const c={...current};for(const k of ['accountSid','authToken','from','to'])if(typeof input[k]==='string'&&input[k].trim())c[k]=input[k].trim();
 c.enabled=input.enabled===true;c.monthlyLimit=Number(input.monthlyLimit??current.monthlyLimit);
 if(!Number.isInteger(c.monthlyLimit)||c.monthlyLimit<1||c.monthlyLimit>100)throw Error('Monthly attempt limit must be between 1 and 100.');
 if(c.accountSid&&!/^AC[a-f0-9]{32}$/i.test(c.accountSid))throw Error('Account SID should start with AC followed by 32 hexadecimal characters.');
 if(c.authToken&&!/^[a-f0-9]{32}$/i.test(c.authToken))throw Error('Auth Token should contain 32 hexadecimal characters.');
 if(c.from&&!phone(c.from)||c.to&&!phone(c.to))throw Error('Use international phone numbers, such as +14165551234.');
 if(c.enabled&&(!c.accountSid||!c.authToken||!c.from||!c.to))throw Error('Enter your Account SID, Auth Token, Twilio sending number and destination number before enabling alerts.');
 return c;
}
export async function createSmsService({directory,fetcher=fetch,now=()=>new Date()}={}){
 await mkdir(directory,{recursive:true});let config={...defaults},ledger={attempts:[]},queue=Promise.resolve();
 try{config={...defaults,...JSON.parse(await readFile(join(directory,'sms-config.json'),'utf8'))};}catch{}
 try{ledger=JSON.parse(await readFile(join(directory,'sms-ledger.json'),'utf8'));if(!Array.isArray(ledger.attempts))ledger={attempts:[]};}catch{}
 const serialized=operation=>{const result=queue.then(operation);queue=result.catch(()=>{});return result;};
 async function save(file,value){await writeFile(join(directory,file+'.tmp'),JSON.stringify(value,null,2));await rename(join(directory,file+'.tmp'),join(directory,file));}
 function status(){const month=monthKey(now());const last=ledger.attempts.at(-1);return {enabled:config.enabled,configured:Boolean(config.accountSid&&config.authToken&&config.from&&config.to),from:mask(config.from),to:mask(config.to),monthlyLimit:config.monthlyLimit,month,attemptsThisMonth:ledger.attempts.filter(a=>a.month===month).length,lastAttempt:last?{at:last.at,kind:last.kind,store:last.store,status:last.status,code:last.code??null}:null};}
 async function send({key,kind,store,body}){
  if(!config.enabled)return {skipped:'disabled'};
  if(ledger.attempts.some(a=>a.key===key))return {skipped:'already attempted'};
  const date=now(),month=monthKey(date);
  if(ledger.attempts.filter(a=>a.month===month).length>=config.monthlyLimit)return {skipped:'monthly limit reached'};
  // Reserve durably before making a paid request. A timeout must not cause an
  // automatic duplicate text on retry or server restart.
  const attempt={key,kind,store,at:date.toISOString(),month,status:'attempting'};ledger.attempts.push(attempt);await save('sms-ledger.json',ledger);
  try{
   const response=await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.accountSid+':'+config.authToken).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:config.from,To:config.to,Body:body}),signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok){attempt.status='rejected';attempt.code=Number.isInteger(data.code)?data.code:null;}
   else if(typeof data.sid==='string'&&/^SM[a-f0-9]{32}$/i.test(data.sid)){attempt.status='accepted';attempt.messageSid=data.sid;}
   else attempt.status='uncertain';
  }catch{attempt.status='uncertain';}
  await save('sms-ledger.json',ledger);return {status:attempt.status,code:attempt.code??null};
 }
 return {
  status,
  configure:input=>serialized(async()=>{const next=validateSmsConfig(input,config);await save('sms-config.json',next);config=next;return status();}),
  notifyRestock:(store,event)=>serialized(()=>event.status==='in_stock'&&Date.parse(event.at)>=now().getTime()-120000?send({key:store.id+':'+event.at,kind:'restock',store:store.name,body:smsBody(store)}):{skipped:'not a fresh restock'}),
  notifyPossibleStock:(store,event)=>serialized(()=>store.retailerId==='nintendo'&&event.status==='unverified'&&event.source==='metadata-monitor'&&Date.parse(event.at)>=now().getTime()-120000?send({key:'metadata:'+store.id+':'+event.at,kind:'possible-stock',store:store.name,body:possibleStockBody(store)}):{skipped:'not a fresh metadata signal'}),
  test:()=>serialized(()=>send({key:'test:'+now().toISOString(),kind:'test',store:null,body:'ReStockWatch test: SMS alerts are connected. This is a test, not a restock.'}))
 };
}
