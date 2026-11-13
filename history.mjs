const stockStatuses=new Set(['in_stock','out_of_stock']);
const seed=[
 {store:'Nintendo Canada',status:'in_stock',at:'2026-11-10T13:00:00-05:00',source:'user',note:'User-reported restock.'},
 {store:'Nintendo Canada',status:'out_of_stock',at:'2026-11-10T14:00:00-05:00',source:'user',note:'User-reported sellout.'}
];
export function createStockHistory(saved={},stores=[]) {
 const activeNames=new Set(stores.map(s=>s.historyName??s.name));
 const events=[...(saved.history??[])];
 for(const e of seed)if(activeNames.has(e.store)&&!events.some(x=>x.store===e.store&&x.status===e.status&&Date.parse(x.at)===Date.parse(e.at)))events.push(e);
 const state={history:[],lastStockStatuses:{},lastMetadataStatuses:{}};
 for(const event of events.filter(e=>activeNames.has(e.store)&&(stockStatuses.has(e.status)||['unverified','unverified_end'].includes(e.status))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)))recordStock(state,event);
 for(const store of stores){const status=saved.lastMetadataStatuses?.[store.id];if(['in_stock','out_of_stock'].includes(status))state.lastMetadataStatuses[store.id]=status;}
 if(saved.schema===2)for(const [name,status]of Object.entries(saved.lastStockStatuses??{}))if(activeNames.has(name)&&stockStatuses.has(status))state.lastStockStatuses[name]=status;
 return state;
}
export function recordStock(state,event) {
 if(['unverified','unverified_end'].includes(event.status)){
  if(state.history.some(e=>e.status===event.status&&e.store===event.store&&e.at===event.at))return false;
  state.history.push(event);state.history.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));return true;
 }
 if(!stockStatuses.has(event.status))return false;
 const previous=state.lastStockStatuses[event.store];
 state.lastStockStatuses[event.store]=event.status;
 // A first sold-out observation establishes a baseline, not a sellout event.
 if(previous===event.status || (event.status==='out_of_stock'&&previous!=='in_stock'))return false;
 state.history.push(event);
 state.history.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return true;
}
export function latestStockTimes(state,name) {
 const events=state.history.filter(e=>e.store===name);
 return {lastRestock:events.find(e=>e.status==='in_stock')??null,lastUnverifiedRestock:events.find(e=>e.status==='unverified')??null,lastUnverifiedSellout:events.find(e=>e.status==='unverified_end')??null,lastSellout:events.find(e=>e.status==='out_of_stock')??null};
}
