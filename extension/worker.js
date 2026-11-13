import {trackerKey} from './config.js';
const targets={
 ebgames:{name:'EB Games',url:'https://www.ebgames.ca/shop/games-nintendo-switch-2-196/nintendo-switch-2-the-legend-of-zelda-40th-anniversary-edition-220621',pattern:'https://www.ebgames.ca/shop/*'},
 staples:{name:'Staples',url:'https://www.staples.ca/products/3193784-en-nintendo-the-legend-of-zelda-40th-anniversary-edition-switch-2-console',pattern:['https://www.staples.ca/products/*','https://staples.ca/products/*']}
};
targets.ebgames_controller={...targets.ebgames,name:'EB Games controller',url:'https://www.ebgames.ca/shop/904030-nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition-220623'};
targets.staples_controller={...targets.staples,name:'Staples controller',url:'https://www.staples.ca/products/3193785-en-nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition'};
function exact(url,id){
 try{
  const u=new URL(url),expected=new URL(targets[id].url);
  if(u.protocol!=='https:')return false;
  if(id.startsWith('ebgames'))return u.hostname==='www.ebgames.ca'&&u.pathname.startsWith('/shop/')&&u.pathname.replace(/\/$/,'').endsWith('-'+expected.pathname.match(/-(\d+)$/)[1]);
  return ['www.staples.ca','staples.ca'].includes(u.hostname)&&u.pathname.startsWith('/products/'+expected.pathname.match(/products\/(\d+)/)[1]+'-en-')&&u.pathname.replace(/\/$/,'').split('/').length===3;
 }catch{return false;}
}
const delay=()=>240000+Math.floor(Math.random()*120001);
async function get(id){const all=await chrome.storage.local.get(null);if(all['monitor_'+id])return all['monitor_'+id];if(id==='ebgames'&&all.enabled!==undefined){const legacy={};for(const k of ['enabled','tabId','awaiting','requestId','nextCheck','lastCheck','lastStock','deliveryError','pending','delivered','startError'])legacy[k]=all[k];return legacy;}return {};}
async function set(id,update){const current=await get(id);await chrome.storage.local.set({['monitor_'+id]:{...current,...update}});}
const alarmName=(kind,id)=>kind+':'+id;
async function schedule(id){const nextCheck=Date.now()+delay();await set(id,{nextCheck});await chrome.alarms.create(alarmName('recheck',id),{when:nextCheck});}
async function deliver(id,payload){
 try{const response=await fetch('http://127.0.0.1:4317/api/browser-result',{method:'POST',headers:{'Content-Type':'application/json','X-Tracker-Key':trackerKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error(`HTTP ${response.status}`);await set(id,{delivered:true,pending:null,deliveryError:null});await chrome.alarms.clear(alarmName('delivery',id));}
 catch(e){await set(id,{delivered:false,pending:payload,deliveryError:'Local tracker unavailable: '+e.message});await chrome.alarms.create(alarmName('delivery',id),{delayInMinutes:1});}
}
async function finish(id,snapshot){
 const state=await get(id);if(!state.enabled||!state.awaiting)return;
 const payload={storeId:id,url:targets[id].url,snapshot,observedAt:new Date().toISOString()};
 await set(id,{awaiting:false,lastCheck:payload.observedAt,lastStock:snapshot.stock||snapshot.title,nextCheck:null});
 await chrome.alarms.clear(alarmName('watchdog',id));await deliver(id,payload);await schedule(id);
}
async function read(id,tabId){try{await chrome.scripting.executeScript({target:{tabId},files:['content.js']});}catch(e){await finish(id,{title:'Check failed',name:'',stock:'',failure:'Could not read the selected tab: '+e.message});}}
async function stop(id,error=null){await set(id,{enabled:false,awaiting:false,nextCheck:null,startError:null,deliveryError:error});await chrome.alarms.clear(alarmName('recheck',id));await chrome.alarms.clear(alarmName('watchdog',id));}
async function begin(id,reload){
 const s=await get(id);if(!s.enabled||s.awaiting)return;
 let tab;try{tab=await chrome.tabs.get(s.tabId);}catch{await stop(id,'The selected tab was closed. Open the product listing and select it again.');return;}
 if(!exact(tab.url,id)){await stop(id,'The selected tab navigated away from the product listing.');return;}
 await set(id,{awaiting:true,requestId:crypto.randomUUID(),checkStartedAt:Date.now(),nextCheck:null});await chrome.alarms.clear(alarmName('recheck',id));await chrome.alarms.create(alarmName('watchdog',id),{when:Date.now()+120000});
 try{if(reload)await chrome.tabs.reload(s.tabId);else await read(id,s.tabId);}catch(e){await finish(id,{title:'Check failed',name:'',stock:'',failure:e.message});}
}
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='complete')for(const id of Object.keys(targets))void get(id).then(s=>{if(s.enabled&&s.awaiting&&s.tabId===tabId)return read(id,tabId);});});
chrome.tabs.onRemoved.addListener(tabId=>{for(const id of Object.keys(targets))void get(id).then(s=>{if(s.tabId===tabId)return stop(id,'Watched tab closed. Monitoring stopped.');});});
chrome.alarms.onAlarm.addListener(alarm=>{
 if(alarm.name==='health'){void recover();return;}
 const [kind,id]=alarm.name.split(':');if(!targets[id])return;
 if(kind==='recheck')void begin(id,true);
 if(kind==='watchdog')void finish(id,{title:'Check timed out',name:'',stock:'',failure:'The established tab did not produce a readable stock result within two minutes.'});
 if(kind==='delivery')void get(id).then(s=>s.pending&&deliver(id,s.pending));
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 const handle=async()=>{
  if(message.kind==='ready'||message.kind==='snapshot'){
   const id=Object.keys(targets).find(id=>exact(sender.url,id));if(!id)return {read:false};
   const s=await get(id);const selected=s.enabled&&s.awaiting&&sender.tab?.id===s.tabId;
   if(message.kind==='ready')return selected?{read:true,storeId:id,retailerId:id.startsWith('staples')?'staples':'ebgames',requestId:s.requestId}:{read:false};
   if(selected&&message.requestId===s.requestId)await finish(id,message.snapshot);return {ok:true};
  }
  if(sender.tab)return {error:'Unsupported message'};
  const id=message.storeId??'ebgames';if(!targets[id])return {error:'Unknown retailer'};
  if(message.kind==='status'){await recover();return get(id);}
  if(message.kind==='start'){
   let [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   if(!exact(tab?.url,id)){
    const candidates=(await chrome.tabs.query({url:targets[id].pattern})).filter(t=>exact(t.url,id));
    if(candidates.length===1)tab=candidates[0];
    else{const error=candidates.length>1?'More than one matching product tab is open. Select the one you want to monitor, then open this popup again.':`No Zelda ${id.includes("controller")?"controller":"console"} tab found for ${targets[id].name}. Open its product listing in this browser, then try again.`;await set(id,{startError:error});return {error};}
   }
   await set(id,{enabled:true,tabId:tab.id,awaiting:false,deliveryError:null,startError:null});await begin(id,false);
   const state=await get(id);return state.enabled?{ok:true}:{error:state.deliveryError??'Monitoring could not start.'};
  }
  if(message.kind==='stop'){await stop(id);return {ok:true};}
 };
 handle().then(reply).catch(async e=>{if(message.kind==='start')await set(message.storeId??'ebgames',{startError:e.message});reply({error:e.message});});return true;
});
let recovery;
function recover(){if(!recovery)recovery=recoverAll().finally(()=>{recovery=null;});return recovery;}
async function recoverAll(){
 for(const id of Object.keys(targets)){
  const s=await get(id);if(!s.enabled)continue;
  if(s.awaiting){
   const started=Number(s.checkStartedAt)||Date.now();
   if(!s.checkStartedAt)await set(id,{checkStartedAt:started});
   if(started+120000<=Date.now())await finish(id,{title:'Check timed out',name:'',stock:'',failure:'The selected tab did not return stock data before the saved deadline.'});
   else if(!await chrome.alarms.get(alarmName('watchdog',id)))await chrome.alarms.create(alarmName('watchdog',id),{when:started+120000});
  }else{
   const existing=await chrome.alarms.get(alarmName('recheck',id));
   const lastRead=Date.parse(s.lastCheck);
   let deadline=Number(s.nextCheck)||existing?.scheduledTime||(Number.isFinite(lastRead)?lastRead+delay():Date.now());
   // Correct drift left by the previous recovery code. Delivery can take up to
   // eight seconds before the next 4–6 minute wait is chosen.
   if(Number.isFinite(lastRead))deadline=Math.min(deadline,lastRead+360000+15000);
   if(s.nextCheck!==deadline)await set(id,{nextCheck:deadline});
   if(deadline<=Date.now())await begin(id,true);
   else if(!existing||existing.scheduledTime!==deadline)await chrome.alarms.create(alarmName('recheck',id),{when:deadline});
  }
  if(s.pending&&!await chrome.alarms.get(alarmName('delivery',id)))await chrome.alarms.create(alarmName('delivery',id),{delayInMinutes:1});
 }
 if(!await chrome.alarms.get('health'))await chrome.alarms.create('health',{periodInMinutes:1});
 for(const name of ['recheck','watchdog','delivery'])await chrome.alarms.clear(name);
}
chrome.runtime.onStartup.addListener(()=>void recover());void recover();