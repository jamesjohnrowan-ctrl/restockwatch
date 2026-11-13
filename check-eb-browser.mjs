import {stores} from './stores.mjs';
import {checkEBWithBrowser} from './browser-checker.mjs';
const visible=process.argv.includes('--visible');
if(visible)console.error('A separate Chrome or Edge window will open. If EB Games asks for verification, complete it yourself. The test waits up to two minutes for a stock value. It then stays open until you close its window.');
const result=await checkEBWithBrowser(stores.find(s=>s.id==='ebgames'),{visible});
console.log(JSON.stringify(result,null,2));
if(!['in_stock','out_of_stock'].includes(result.status))process.exitCode=1;
