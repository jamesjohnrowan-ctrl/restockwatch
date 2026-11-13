// Visual navigation only. Controller data, scheduling and alerts are not connected.
const productTabs=Array.from(document.querySelectorAll('.product-tab'));
function selectProduct(tab){
 for(const item of productTabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!selected;}
}
for(const [index,tab]of productTabs.entries()){
 tab.addEventListener('click',()=>selectProduct(tab));
 tab.addEventListener('keydown',event=>{
  let target;
  if(event.key==='ArrowRight')target=productTabs[(index+1)%productTabs.length];
  if(event.key==='ArrowLeft')target=productTabs[(index-1+productTabs.length)%productTabs.length];
  if(event.key==='Home')target=productTabs[0];
  if(event.key==='End')target=productTabs.at(-1);
  if(target){event.preventDefault();selectProduct(target);target.focus();}
 });
}
