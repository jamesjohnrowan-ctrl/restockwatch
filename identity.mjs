// Match the requested item, never another anniversary accessory or variant.
export function matchesProduct(name,store={}) {
 const value=String(name??'');
 if(!/switch\s*[™®]?\s*2/i.test(value)||!/zelda/i.test(value)||!/40th/i.test(value))return false;
 if(store.productId!=='controller')return !/controller|carrying case|screen protector/i.test(value);
 if(!/pro\s+controller/i.test(value)||/carrying case|screen protector/i.test(value))return false;
 return /display\s*stand/i.test(value)===(store.variant==='stand');
}
