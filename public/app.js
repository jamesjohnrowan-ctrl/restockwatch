function summarizeStock(rows){
 const available=rows.filter(r=>r.status==='in_stock').length;
 if(available)return {status:'in_stock',text:'In stock',detail:`Available at ${available} retailer${available===1?'':'s'}.`};
 if(rows.some(r=>r.status==='possible_stock'))return {status:'possible_stock',text:'Possible stock (?)',detail:'Nintendo metadata reports InStock. Purchasing is unconfirmed; check the page personally.'};
 if(rows.length&&rows.every(r=>r.status==='out_of_stock'))return {status:'out_of_stock',text:'Sold out',detail:'All monitored retailers report sold out.'};
 if(rows.some(r=>r.status==='preorder'))return {status:'preorder',text:'Preorder',detail:'A retailer reports preorder or backorder availability.'};
 if(!rows.length||rows.every(r=>r.status==='pending'))return {status:'pending',text:'Checking',detail:'Waiting for stock readings.'};
 const unconfirmed=rows.filter(r=>r.status!=='out_of_stock').length;
 return {status:'unknown',text:'Unconfirmed',detail:`No stock confirmed; ${unconfirmed} retailer${unconfirmed===1?' has':'s have'} an unconfirmed result.`};
}
const labels={possible_stock:'Possible stock (?)',unverified_end:'Metadata returned to sold out (?)',unverified:'Unverified availability signal',pending:'Waiting',in_stock:'In stock',out_of_stock:'Sold out',unknown:'Unknown',blocked:'Blocked',error:'Check failed',preorder:'Preorder / backorder'};
const initials={nintendo:'N',bestbuy:'BB',ebgames:'EB',staples:'S',costco:'C',canadacomputers:'CC'};
let state;
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>s?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(new Date(s)):'Not checked';
const historicalTime=event=>event?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(event.at)):'Not recorded yet';
function stockTime(r,sellout=false){
 const confirmed=sellout?r.lastSellout:r.lastRestock,possible=sellout?r.lastUnverifiedSellout:r.lastUnverifiedRestock;
 const event=possible&&(!confirmed||Date.parse(possible.at)>Date.parse(confirmed.at))?possible:confirmed;
 const unconfirmed=event&&['unverified','unverified_end'].includes(event.status);
 return {text:event?historicalTime(event)+(unconfirmed?' (?)':event.source==='user'?' *':''):'—',title:unconfirmed?'Unconfirmed metadata signal: '+event.note:event?.source==='user'?'User-reported time':'First detected by the tracker'};
}
function render(){
 updateTabIndicator(state.rows);
 const summary=summarizeStock(state.rows.filter(r=>(r.productId??'console')==='console')),badge=$('console-stock-summary');
 badge.className='badge product-status '+summary.status;
 if(badge.textContent!==summary.text)badge.textContent=summary.text;
 badge.title=summary.detail;
 if(state.sms){
  const s=state.sms;$('sms-indicator').dataset.enabled=String(s.enabled);
  $('sms-state').textContent=s.enabled?'On':'Off';
  $('sms-detail').textContent=s.enabled?(s.attemptsThisMonth>=s.monthlyLimit?'Monthly attempt limit reached':'Restock + possible-stock texts enabled'):'Console restock texts paused';
  $('sms-indicator').title=s.attemptsThisMonth+' / '+s.monthlyLimit+' send attempts this month';
 }
 const rows=state.rows.filter(r=>(r.productId??'console')==='console');
 $('cards').innerHTML=rows.map(r=>`<article class="card"><div class="card-top"><span class="logo" aria-hidden="true">${initials[r.id]}</span><div><h3>${escape(r.name)}</h3><div class="tag">${escape(r.tag)}${['ebgames','staples'].includes(r.id) ? ' · Established tab' : ''}</div></div></div><span title="${escape(r.note)}" class="badge ${r.status}">${labels[r.status]}</span><div class="stock-times"><div><span>Last in stock</span><time title="${escape(stockTime(r).title)}">${escape(stockTime(r).text)}</time></div><div><span>Last sold out</span><time title="${escape(stockTime(r,true).title)}">${escape(stockTime(r,true).text)}</time></div></div><div class="card-bottom"><span title="${escape(r.method??'Automated check')}">${time(r.checkedAt)}</span><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">Visit retailer ↗</a></div></article>`).join('')||'<p class="empty">No retailers configured.</p>';
 $('available').textContent=rows.filter(r=>r.status==='in_stock').length;
 $('total').textContent=rows.length;
 $('monitor').textContent=state.running?'Checking retailers…':'Monitoring · random 4–6 minute intervals';
 $('refresh').disabled=state.running;
 $('refresh').textContent=state.running?'↻ Checking…':'↻ Check stock now';
 const verified=rows.filter(r=>['in_stock','out_of_stock','preorder'].includes(r.status)).length;
 $('updated').textContent=`${verified} readable · ${rows.length-verified} unconfirmed · Eastern Time`;
 $('history').innerHTML=state.history.filter(e=>(e.productId??'console')==='console').map(e=>`<div class="event"><time>${time(e.at)}<br>${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric'}).format(new Date(e.at))}</time><strong>${escape(e.store)} · ${labels[e.status]}</strong><span>${escape(e.note)}</span></div>`).join('')||'<p class="empty">Restocks and subsequent sellouts will appear here as they are detected.</p>';
 renderController();
 tick();
}
function updateTabIndicator(rows=[]){
 const confirmed=rows.some(r=>r.status==='in_stock'),possible=rows.some(r=>r.status==='possible_stock');
 const active=confirmed||possible;
 let icon=document.querySelector('link[data-stock-indicator]');
 if(!icon){icon=document.createElement('link');icon.rel='icon';icon.type='image/svg+xml';icon.dataset.stockIndicator='true';document.head.append(icon);}
 const color=active?'#8bd6a0':'#c98484';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#14211c"/><circle cx="16" cy="16" r="11" fill="'+color+'"/><circle cx="12" cy="12" r="4" fill="#ffffff" opacity=".18"/></svg>';
 const href='data:image/svg+xml,'+encodeURIComponent(svg);
 if(icon.getAttribute('href')!==href)icon.setAttribute('href',href);
 document.title=(confirmed?'In stock · ':possible?'Possible stock (?) · ':'')+'ReStockWatch · Canada';
}
function renderController(){
 const rows=state.rows.filter(r=>r.productId==='controller'),summary=summarizeStock(rows),badge=$('controller-stock-summary');
 badge.className='badge product-status '+summary.status;badge.textContent=summary.text;badge.title=summary.detail;
 const listing=(r,retailer,second=false)=>{
  const nintendo=retailer.id==='nintendo';
  const title=second?'Controller + display stand':retailer.name;
  const tag=nintendo?(second?'Nintendo Store exclusive':'Controller only'):retailer.tag+(['ebgames','staples'].includes(retailer.id)?' · Established tab':'');
  return '<div class="card controller-listing'+(second?' controller-stand-listing':'')+'"><div class="card-top"><span class="logo'+(second?' continuation-logo':'')+'" aria-hidden="true">'+(second?'↳':initials[retailer.id])+'</span><div><h3>'+escape(title)+'</h3><div class="tag">'+escape(tag)+'</div></div></div><span class="badge '+r.status+'" title="'+escape(r.note)+'">'+labels[r.status]+'</span><div class="stock-times"><div><span>Last in stock</span><time title="'+escape(stockTime(r).title)+'">'+escape(stockTime(r).text)+'</time></div><div><span>Last sold out</span><time title="'+escape(stockTime(r,true).title)+'">'+escape(stockTime(r,true).text)+'</time></div></div><div class="card-bottom"><span title="'+escape(r.method??'Automated check')+'">'+time(r.checkedAt)+'</span><a href="'+escape(r.url)+'" target="_blank" rel="noopener noreferrer">Visit retailer ↗</a></div></div>';
 };
 $('controller-cards').innerHTML=state.retailers.filter(retailer=>rows.some(r=>r.retailerId===retailer.id)).map(retailer=>{
  const own=rows.filter(r=>r.retailerId===retailer.id).sort((a,b)=>Number(a.variant==='stand')-Number(b.variant==='stand'));
  return '<article class="controller-retailer-group" aria-label="'+escape(retailer.name)+'">'+own.map((r,index)=>listing(r,retailer,index>0)).join('')+'</article>';
 }).join('');
 $('controller-available').textContent=rows.filter(r=>r.status==='in_stock').length;$('controller-total').textContent=rows.length;
 $('controller-monitor').textContent=state.running?'Checking retailers…':'Monitoring · random 4–6 minute intervals';
 $('controller-refresh').disabled=state.running;$('controller-refresh').textContent=state.running?'↻ Checking…':'↻ Check stock now';
 const verified=rows.filter(r=>['in_stock','out_of_stock','preorder'].includes(r.status)).length;
 $('controller-updated').textContent=verified+' readable · '+(rows.length-verified)+' unconfirmed · Eastern Time';
 if(state.sms){const s=state.sms;$('controller-sms-indicator').dataset.enabled=String(s.enabled);$('controller-sms-state').textContent=s.enabled?'On':'Off';$('controller-sms-detail').textContent=s.enabled?(s.attemptsThisMonth>=s.monthlyLimit?'Monthly attempt limit reached':'Restock + possible-stock alerts'):'Controller restock texts paused';$('controller-sms-indicator').title=s.attemptsThisMonth+' / '+s.monthlyLimit+' shared send attempts this month';}
 $('controller-history').innerHTML=state.history.filter(e=>e.productId==='controller').map(e=>'<div class="event"><time>'+historicalTime(e)+'</time><strong>'+escape(e.store)+' · '+labels[e.status]+'</strong><span>'+escape(e.note)+'</span></div>').join('')||'<p class="empty">Restocks and subsequent sellouts will appear here, separately for each version.</p>';
}
function tick(){if(state?.nextCheck&&!state.running){const seconds=Math.max(0,Math.ceil((new Date(state.nextCheck)-Date.now())/1000));$('countdown').textContent=`Next check in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}else $('countdown').textContent='Checking Canadian retailers';$('controller-countdown').textContent=$('countdown').textContent;}
async function load(){try{const response=await fetch('/api/status');if(!response.ok)throw Error();state=await response.json();render();}catch{updateTabIndicator();document.title='Disconnected · ReStockWatch · Canada';for(const prefix of ['console','controller']){$(prefix+'-stock-summary').className='badge product-status unknown';$(prefix+'-stock-summary').textContent='Disconnected';} $('controller-cards').innerHTML='<p class="empty">Live controller checks are disconnected. Restart the tracker.</p>';$('controller-refresh').disabled=true;$('controller-monitor').textContent='Local tracker disconnected';$('controller-countdown').textContent='Restart using Start Tracker.cmd';$('console-stock-summary').className='badge product-status unknown';$('console-stock-summary').textContent='Disconnected';$('console-stock-summary').title='Live stock readings are unavailable.';$('monitor').textContent='Local tracker disconnected';$('countdown').textContent='Restart using Start Tracker.cmd';$('refresh').disabled=true;if(state){$('cards').innerHTML='<p class="empty">Live checks are disconnected. Restart the tracker to see current results.</p>';}}}
$('refresh').addEventListener('click',async()=>{try{const r=await fetch('/api/refresh',{method:'POST'});if(!r.ok){$('countdown').textContent=await r.text();return;}await load();}catch{$('monitor').textContent='Unable to reach local tracker';}});
$('controller-refresh').addEventListener('click',()=>$('refresh').click());
await load();setInterval(load,4000);setInterval(tick,1000);
