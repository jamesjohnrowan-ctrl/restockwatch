import test from 'node:test';
import assert from 'node:assert/strict';
import {recordMetadata} from './metadata.mjs';
import {createStockHistory,latestStockTimes} from './history.mjs';
const store={id:'nintendo_controller',retailerId:'nintendo',name:'Nintendo Canada',historyName:'Nintendo Canada · Controller only',productId:'controller',variant:'controller'};
const at=n=>`2026-11-13T15:${String(n).padStart(2,'0')}:00Z`;
test('positive metadata logs once; errors preserve signal; negative logs only after positive',()=>{
 const h=createStockHistory({},[store]);
 assert.equal(recordMetadata(h,store,{metadataStock:'out_of_stock'},at(0)),null);
 assert.equal(recordMetadata(h,store,{metadataStock:'in_stock'},at(1)).status,'unverified');
 for(const v of [{metadataStock:'in_stock'},{status:'blocked'},{status:'unknown'},{metadataStock:'in_stock'}])assert.equal(recordMetadata(h,store,v,at(2)),null);
 assert.equal(recordMetadata(h,store,{metadataStock:'out_of_stock'},at(3)).status,'unverified_end');
 assert.equal(recordMetadata(h,store,{metadataStock:'out_of_stock'},at(4)),null);
 assert.equal(h.history.length,2);assert.equal(h.lastStockStatuses[store.historyName],undefined);
 const times=latestStockTimes(h,store.historyName);assert.equal(times.lastRestock,null);assert.equal(times.lastUnverifiedRestock.at,at(1));assert.equal(times.lastUnverifiedSellout.at,at(3));
});
test('saved signal survives restart and rearms only after negative reading',()=>{
 let h=createStockHistory({},[store]);recordMetadata(h,store,{metadataStock:'in_stock'},at(0));
 h=createStockHistory({schema:2,...h},[store]);assert.equal(recordMetadata(h,store,{metadataStock:'in_stock'},at(1)),null);
 recordMetadata(h,store,{metadataStock:'out_of_stock'},at(2));assert.equal(recordMetadata(h,store,{metadataStock:'in_stock'},at(3)).status,'unverified');assert.equal(h.history.length,3);
});
test('variants are independent and non-Nintendo data never triggers metadata alerts',()=>{
 const h=createStockHistory({},[store]);recordMetadata(h,store,{metadataStock:'in_stock'},at(0));
 assert.equal(recordMetadata(h,{...store,id:'nintendo_stand',variant:'stand',historyName:'Nintendo Canada · Stand'},{metadataStock:'in_stock'},at(1)).status,'unverified');
 assert.equal(recordMetadata(h,{...store,retailerId:'staples'},{metadataStock:'in_stock'},at(2)),null);
});
