// Reads only the explicitly selected retailer's product tab, in an isolated world.
(async()=>{
 const response=await chrome.runtime.sendMessage({kind:'ready'});if(!response?.read)return;
 const id=response.requestId;
 if(globalThis.stockWatchReadId===id)return;globalThis.stockWatchReadId=id;
 const visible=element=>Boolean(element&&element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden');
 const sample=()=>{
  if((response.retailerId??response.storeId)==='staples'){
   const root=document.querySelector('.product__page');
   const name=Array.from(document.querySelectorAll('h1.product-title')).map(e=>e.textContent?.trim()).find(Boolean)??'';
   const labels=root?Array.from(root.querySelectorAll('.product-sold-out')).filter(visible).map(e=>(e.innerText??'').trim()):[];
   const buttons=root?Array.from(root.querySelectorAll('.product-form button, .product-form [role="button"], .product-form input[type="submit"]')):[];
   const orderButtonEnabled=buttons.some(e=>visible(e)&&/\badd to cart\b/i.test(e.innerText||e.value||'')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&!e.classList.contains('disabled'));
   const negative=labels.find(text=>/\bout of stock\b|\bsold out\b/i.test(text));
   return {title:document.title,name,stock:negative??(orderButtonEnabled?'In Stock':''),orderButtonEnabled};
  }
  // EB renders multiple empty elements with this same ID before the real label.
  const nodes=Array.from(document.querySelectorAll('#product_detail #out_of_stock_message, #product_detail #in_stock_message, #product_detail #product_stock_availability'));
  const labels=nodes.filter(visible).map(node=>(node.innerText??'').replace(/get notified[\s\S]*$/i,'').replace(/we.ll notify[\s\S]*$/i,'').replace(/\s+/g,' ').trim());
  const negative=labels.find(text=>/\bout of stock\b|\bsold out\b/i.test(text));
  const positive=labels.find(text=>/\bin stock\b/i.test(text)&&!/back in stock/i.test(text));
  const buttons=Array.from(document.querySelectorAll('#product_detail #add_to_cart'));
  const orderButtonEnabled=buttons.some(button=>visible(button)&&!button.disabled&&button.getAttribute('aria-disabled')!=='true'&&!button.classList.contains('disabled'));
  return {title:document.title,name:document.querySelector('#product_detail h1')?.textContent?.trim()??'',stock:negative??positive??'',orderButtonEnabled};
 };
 const started=Date.now();
 const timer=setInterval(async()=>{
  if(globalThis.stockWatchReadId!==id){clearInterval(timer);return;}
  const snapshot=sample();const stockKnown=/\bout of stock\b|\bsold out\b|\bin stock\b/i.test(snapshot.stock);
  if(stockKnown||Date.now()-started>=90000){clearInterval(timer);try{await chrome.runtime.sendMessage({kind:'snapshot',requestId:id,snapshot});}catch{}}
 },500);
})();
