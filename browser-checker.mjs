import {matchesProduct} from './identity.mjs';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const profile=fileURLToPath(new URL('./data/eb-browser/',import.meta.url));
export function parseStaplesSnapshot(snapshot,store={}){
 const answer=(status,note)=>({status,note,method:'Staples browser tab check'});
 if(/just a moment|verify you are human|access denied|robot check|request (?:was )?blocked/i.test(snapshot.title??''))return answer('blocked','Staples challenged the browser tab.');
 const name=snapshot.name??'';
 if(!matchesProduct(name,store))return answer('unknown','Staples tab did not identify the requested anniversary item and version.');
 if(/\bout of stock\b|\bsold out\b/i.test(snapshot.stock??''))return answer('out_of_stock','Staples product stock label reports out of stock.');
 if(/^in stock$/i.test((snapshot.stock??'').trim())&&snapshot.orderButtonEnabled===true)return answer('in_stock','Staples product page has an enabled Add to Cart control.');
 return answer('unknown','Staples online stock could not be confirmed from the product controls.');
}
export function parseEBBrowserSnapshot(snapshot,store={}) {
 const method='EB Games browser check';
 const answer=(status,note)=>({status,note,method});
 if(/just a moment|verify you are human|access denied|robot check/i.test(snapshot.title??''))return answer('blocked','EB Games also challenged the browser check.');
 if(!matchesProduct(snapshot.name,store))return answer('unknown','Browser loaded, but the requested anniversary item and version could not be verified.');
 const stock=(snapshot.stock??'').replace(/\s+/g,' ').trim();
 if(/\bout of stock\b|\bsold out\b/i.test(stock))return answer('out_of_stock','EB Games browser stock indicator reports out of stock.');
 if(/\bin stock\b/i.test(stock)&&snapshot.orderButtonEnabled===true)return answer('in_stock','EB Games browser stock indicator reports in stock with online ordering enabled.');
 return answer('unknown','EB Games browser loaded, but online availability could not be confirmed.');
}
export async function checkEBWithBrowser(store,{visible=false}={}) {
 let context,phase='starting browser';
 try {
  const {chromium}=await import('playwright-core');
  await mkdir(profile,{recursive:true});
  let launchError;const launchFailures=[];
  for(const channel of ['chrome','msedge']){
   try{context=await chromium.launchPersistentContext(profile,{channel,headless:!visible,chromiumSandbox:true,timeout:20000,locale:'en-CA'});break;}catch(e){launchError=e;launchFailures.push({channel,error:String(e.message)});}
  }
  if(!context){launchError.browserLaunchFailures=launchFailures;throw launchError;}
  const page=context.pages()[0]??await context.newPage();
  phase='loading EB Games product page';
  await page.goto(store.url,{waitUntil:'domcontentloaded',timeout:45000});
  phase='waiting for product stock data';
  const stock=page.locator('#product_stock_availability');
  // The container can be visible before EB's asynchronous stock data arrives.
  // Wait for an explicit result, rather than just for the empty container.
  try{await page.waitForFunction(()=>{
   const label=document.querySelector('#product_stock_availability')?.innerText??'';
   return /\bout of stock\b|\bsold out\b|\bin stock\b/i.test(label.replace(/get notified[\s\S]*$/i,''));
  },null,{timeout:visible?120000:30000,polling:500});}catch{}
  phase='reading product stock data';
  const button=page.locator('#product_detail #add_to_cart');
  const snapshot={title:await page.title(),name:await page.locator('#product_detail h1').textContent({timeout:2000}).catch(()=>''),stock:await stock.innerText({timeout:2000}).catch(()=>''),orderButtonEnabled:await button.isEnabled({timeout:2000}).catch(()=>false)};
  const result={...parseEBBrowserSnapshot(snapshot),observedAt:new Date().toISOString(),diagnostics:{title:snapshot.title,productName:snapshot.name,stockText:snapshot.stock,orderButtonEnabled:snapshot.orderButtonEnabled}};
  if(visible){
   // Emit the result before waiting, so it remains saved even if the user closes
   // the terminal. Never dismiss a challenge or click any retailer controls.
   console.error('Browser observation:',JSON.stringify(result,null,2));
   console.error('The test browser is staying open. Close its window when finished to complete the test.');
   await new Promise(resolve=>context.once('close',resolve));
  }
  return result;
 }catch(e){const message=String(e.message);return {status:'error',method:'EB Games browser fallback unavailable',note:`Browser check failed while ${phase}. This does not establish whether EB Games blocked access.`,diagnostics:{phase,error:message,...(e.browserLaunchFailures?{launchFailures:e.browserLaunchFailures}:{})}};}
 finally{await context?.close().catch(()=>{});}
}
