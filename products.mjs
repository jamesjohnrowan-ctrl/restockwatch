import {stores as consoleStores} from './stores.mjs';
export const retailers=consoleStores.map(({id,name,tag})=>({id,name,tag}));
const urls={
 nintendo:'https://www.nintendo.com/en-ca/store/products/nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition-127074/',
 bestbuy:'https://www.bestbuy.ca/en-ca/product/nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition/20149830',
 ebgames:'https://www.ebgames.ca/shop/904030-nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition-220623',
 staples:'https://www.staples.ca/products/3193785-en-nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary-edition',
 costco:'https://www.costco.ca/p/-/nintendo-switch-2-pro-controller-the-legend-of-zelda-40th-anniversary/4201053545'
};
export const stores=[
 ...consoleStores.map(s=>({...s,retailerId:s.id,productId:'console',variant:'console',productName:'Nintendo Switch 2 console - Zelda 40th Anniversary Edition',...(s.id==='bestbuy'?{sku:'20149861'}:{})})),
 ...retailers.filter(s=>urls[s.id]).map(s=>({...s,id:s.id+'_controller',retailerId:s.id,productId:'controller',variant:'controller',historyName:s.name+' · Controller only',productName:'Switch 2 Pro Controller - Zelda 40th Anniversary Edition (controller only)',url:urls[s.id],...(s.id==='bestbuy'?{sku:'20149830'}:{})})),
 {id:'nintendo_stand',retailerId:'nintendo',name:'Nintendo Canada',tag:'Official store',productId:'controller',variant:'stand',historyName:'Nintendo Canada · Controller + display stand',productName:'Switch 2 Pro Controller + display stand - Zelda 40th Anniversary Edition',url:'https://www.nintendo.com/en-ca/store/products/nintendo-switch-2-pro-controller-display-stand-the-legend-of-zelda-40th-anniversary-edition-127076/'}
];
export const historyName=store=>store.historyName??store.name;
