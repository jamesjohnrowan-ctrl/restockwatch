import {matchesProduct} from './identity.mjs';
const result = (status,note,extra={}) => ({status,note,...extra});
export function parseBestBuy(p,store={}) {
 if(p.sku !== (store.sku??'20149861') || !matchesProduct(p.name,store)) return result('unknown','Product identity could not be verified.');
 if(p.isMarketplace || p.sellerId !== 'bbyca') return result('unknown','Direct retailer offer could not be verified.');
 const a=p.availability;
 const extra={price:p.salePrice,currency:'CAD',method:'Retailer product API'};
 if(a?.isAvailableOnline === true && p.isAvailableForOrder === true) return result('in_stock','Available to order online from Best Buy.',extra);
 if(a?.isAvailableOnline === false && /SoldOut|OutOfStock/i.test(a.onlineAvailability)) return result('out_of_stock','Best Buy reports sold out online.',extra);
 return result('unknown','No conclusive online stock status.',extra);
}
export function parsePage(html,store) {
 if(/<title>[^<]*(?:just a moment|robot check|access denied|robot or human|verify your identity)/i.test(html) || /<form[^>]*(?:captcha|validateCaptcha)|id=["']px-captcha["']|<h[12][^>]*>\s*(?:verify you are human|access denied)/i.test(html)) return result('blocked','Retailer returned a bot check. Open the product page to check manually.');
 if(!html.trim())return result('unknown','Retailer returned an empty response; no stock status available.');
 if(store.id==='walmart') {
  const next=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  try{
   const product=JSON.parse(next?.[1]??'null')?.props?.pageProps?.initialData?.data?.product;
   if(product?.usItemId==='4LPRUXHD1MMQ' && matchesProduct(product.name)){
    if(product.sellerDisplayName && !/^(walmart|walmart\.ca|walmart canada)$/i.test(product.sellerDisplayName))return result('unknown',`Featured offer is sold by ${product.sellerDisplayName}; marketplace offer excluded. Walmart's own stock is unconfirmed.`,{method:'Retailer product and seller data'});
    if(/^(walmart|walmart\.ca|walmart canada)$/i.test(product.sellerDisplayName??'')){
     const extra={method:'Retailer product and seller data',price:product.priceInfo?.currentPrice?.currencyUnit==='CAD'?product.priceInfo.currentPrice.price:null,currency:'CAD'};
     if(product.availabilityStatus==='IN_STOCK' && product.shippingOption?.availabilityStatus==='AVAILABLE')return result('in_stock','Walmart-sold offer available online.',extra);
     if(product.availabilityStatus==='OUT_OF_STOCK')return result('out_of_stock','Walmart-sold offer reports sold out.',extra);
    }
   }
  }catch{}
 }
 const nodes=[];
 function walk(value){if(!value || typeof value!=='object')return;if(Array.isArray(value)){value.forEach(walk);return;}if([value['@type']].flat().includes('Product')) nodes.push(value);if(value['@graph'])walk(value['@graph']);}
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 const product=nodes.find(p=>matchesProduct(p.name,store));
 if(product){
  const offers=Array.isArray(product.offers)?product.offers:[product.offers];
  const valid=offers.filter(Boolean).filter(o=>o['@type']!=='AggregateOffer');
  const direct=valid.filter(o=>!['amazon','walmart'].includes(store.id) || (store.id==='amazon'?/^(amazon\.ca|amazon canada)$/i:/^(walmart\.ca|walmart canada|walmart)$/i).test(typeof o.seller==='string'?o.seller:o.seller?.name ?? ''));
  if(!direct.length) return result('unknown','Direct retailer seller could not be verified; marketplace offers excluded.');
  const states=direct.map(o=>String(o.availability??'').split('/').pop());
  const index=states.indexOf('InStock');
  const chosen=direct[index>=0?index:0];
  const extra={price:chosen.priceCurrency==='CAD' && Number.isFinite(Number(chosen.price))?Number(chosen.price):null,currency:'CAD',method:'Product structured data'};
  // Nintendo's discovery/SEO data can say InStock even when the live shop
  // cannot sell the item. Never turn that metadata into a restock or SMS.
  const nintendo=(store.retailerId??store.id)==='nintendo';
  if(nintendo&&chosen.priceCurrency!=='CAD')return result('unknown','Canadian Nintendo availability could not be verified.',extra);
  if(nintendo&&index>=0)return result('possible_stock','Nintendo metadata reports InStock. Possible stock only — check the product page; online purchasing is unconfirmed.',{...extra,metadataStock:'in_stock',method:'Nintendo metadata signal · unconfirmed'});
  if(index>=0 && chosen.priceCurrency==='CAD') return result('in_stock','Retailer product data reports in stock online.',extra);
  if(states.length && states.every(s=>['OutOfStock','SoldOut','Discontinued'].includes(s)))return result('out_of_stock','Retailer product data reports sold out.',{...extra,...(nintendo?{metadataStock:'out_of_stock'}:{})});
  if(states.some(s=>['PreOrder','PreSale','BackOrder'].includes(s)))return result('preorder','Retailer reports preorder or backorder; check its page.',extra);
 }
 if(store.id==='amazon') {
  const title=html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  if(matchesProduct(title)) {
   const availability=html.match(/id="availability"[^>]*>([\s\S]{0,2500})/i)?.[1]??'';
   if(/currently unavailable/i.test(availability))return result('out_of_stock','Amazon product availability says currently unavailable.',{method:'Product availability panel'});
   return result('unknown','Amazon page loaded, but an Amazon-sold online offer could not be confirmed.');
  }
 }
 return result('unknown', 'Page loaded, but no reliable product-specific online stock signal was found.');
}
async function request(url) {
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'en-CA,en;q=0.9'}});
 if(!response.ok)throw new Error(`HTTP ${response.status}`);
 return response.text();
}
export async function checkStore(store){
 if(store.id==='ebgames'){
  // Use an isolated rendered browser when the direct request cannot confirm stock.
  let direct;
  try{direct=parsePage(await request(store.url),store);}catch{}
  if(direct && ['in_stock','out_of_stock','preorder'].includes(direct.status))return direct;
  const {checkEBWithBrowser}=await import('./browser-checker.mjs');
  return checkEBWithBrowser(store);
 }
 try{
  if((store.retailerId??store.id)==='bestbuy') {
   try{return parseBestBuy(JSON.parse(await request('https://www.bestbuy.ca/api/v2/json/product/'+(store.sku??'20149861'))),store);}catch{}
  }
  return parsePage(await request(store.url),store);
 }catch(e){const blocked=/HTTP (403|412|429|503)/.test(e.message);return result(blocked?'blocked':'error',blocked?`Retailer refused the automated request (${e.message}). Use the retailer link for a manual check.`:e.name==='TimeoutError'?'Retailer check timed out.':`Could not complete check: ${e.message}`);}
}
