import {recordStock} from './history.mjs';
// A separate state machine: metadata never changes confirmed stock state.
export function recordMetadata(state,store,value,at){
 if(store.retailerId!=='nintendo'||!['in_stock','out_of_stock'].includes(value.metadataStock))return null;
 state.lastMetadataStatuses??={};
 const previous=state.lastMetadataStatuses[store.id];
 state.lastMetadataStatuses[store.id]=value.metadataStock;
 if(previous===value.metadataStock||(!previous&&value.metadataStock==='out_of_stock'))return null;
 const positive=value.metadataStock==='in_stock';
 const event={store:store.historyName??store.name,productId:store.productId,variant:store.variant,status:positive?'unverified':'unverified_end',source:'metadata-monitor',at,note:positive?'Nintendo metadata reports InStock. Possible stock only: check the product page personally; online purchasing is unconfirmed.':'Nintendo metadata returned to sold out after a possible-stock signal. This does not confirm a restock or sellout occurred.'};
 recordStock(state,event);return event;
}
