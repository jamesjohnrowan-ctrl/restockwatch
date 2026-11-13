import test from 'node:test';
import assert from 'node:assert/strict';
import {stores,historyName} from './products.mjs';
import {parsePage,parseBestBuy} from './checker.mjs';
import {parseStaplesSnapshot,parseEBBrowserSnapshot} from './browser-checker.mjs';
import {createStockHistory,recordStock,latestStockTimes} from './history.mjs';
import {smsBody} from './sms.mjs';
const only=stores.find(s=>s.id==='nintendo_controller'),stand=stores.find(s=>s.id==='nintendo_stand');
const name='Nintendo Switch 2 Pro Controller The Legend of Zelda – 40th Anniversary Edition';
const page=(name,status='InStock')=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name,offers:{availability:'https://schema.org/'+status,priceCurrency:'CAD'}})+'</script>';
test('controller and stand bundle stock cannot be exchanged, nor counted as console stock',()=>{
 for(const [s,title]of [[only,name],[stand,name+' + display stand']])assert.equal(parsePage(page(title),{...s,retailerId:'costco'}).status,'in_stock');
 assert.equal(parsePage(page(name),stand).status,'unknown');assert.equal(parsePage(page(name+' + display stand'),only).status,'unknown');
 assert.equal(parsePage(page(name),stores[0]).status,'unknown');assert.equal(parsePage(page(name.replace('40th','35th')),only).status,'unknown');
});
test('Nintendo SEO InStock metadata is possible stock, not confirmed stock for either variant or console',()=>{
 for(const [s,title]of [[only,name],[stand,name+' + display stand'],[stores[0],'Nintendo Switch 2 The Legend of Zelda 40th Anniversary Edition']]){
  const r=parsePage(page(title),s);assert.equal(r.status,'possible_stock');assert.equal(r.metadataStock,'in_stock');assert.match(r.note,/purchasing is unconfirmed/);
  const history=createStockHistory({},stores);const before=history.history.length;
  assert.equal(recordStock(history,{store:historyName(s),status:r.status,at:new Date().toISOString()}),false);assert.equal(history.history.length,before);
 }
});
test('Best Buy controller checks its own exact SKU and direct online offer',()=>{
 const s=stores.find(s=>s.id==='bestbuy_controller'),p={sku:'20149830',name,sellerId:'bbyca',availability:{isAvailableOnline:true},isAvailableForOrder:true};
 assert.equal(parseBestBuy(p,s).status,'in_stock');assert.equal(parseBestBuy({...p,sku:'20149861'},s).status,'unknown');assert.equal(parseBestBuy({...p,isMarketplace:true},s).status,'unknown');
});
test('retailer snapshots verify controller identity and online stock controls',()=>{
 for(const [parser,id]of [[parseEBBrowserSnapshot,'ebgames_controller'],[parseStaplesSnapshot,'staples_controller']]){
  const s=stores.find(s=>s.id===id),snap={name,stock:'In Stock',orderButtonEnabled:true};
  assert.equal(parser(snap,s).status,'in_stock');assert.equal(parser({...snap,orderButtonEnabled:false},s).status,'unknown');
  assert.equal(parser({...snap,name:name+' + display stand'},s).status,'unknown');assert.equal(parser({...snap,stock:'Out of Stock'},s).status,'out_of_stock');
  assert.equal(parser({...snap,title:'Just a moment'},s).status,'blocked');assert.equal(parser(snap,stores[0]).status,'unknown');
 }
});
test('console and two controller variants preserve separate history through restart',()=>{
 let h=createStockHistory({},stores);const at='2026-11-12T21:00:00Z';
 for(const s of [only,stand])recordStock(h,{store:historyName(s),productId:s.productId,variant:s.variant,status:'in_stock',at});
 recordStock(h,{store:historyName(only),productId:'controller',variant:'controller',status:'out_of_stock',at:'2026-11-12T21:01:00Z'});
 h=createStockHistory({schema:2,...h},stores);
 assert.equal(latestStockTimes(h,historyName(only)).lastSellout.at,'2026-11-12T21:01:00Z');assert.equal(latestStockTimes(h,historyName(stand)).lastSellout,null);
 assert.equal(latestStockTimes(h,'Nintendo Canada').lastRestock.source,'user');assert.equal(h.history.filter(e=>e.productId==='controller').length,3);
});
test('SMS distinguishes versions and uses their respective product links',()=>{
 assert.match(smsBody(only),/controller only/i);assert.match(smsBody(stand),/display stand/i);assert.ok(smsBody(only).includes(only.url));assert.ok(smsBody(stand).includes(stand.url));
});
