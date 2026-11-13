import {randomInt} from 'node:crypto';
export const minDelay=4*60*1000,maxDelay=6*60*1000;
export function nextDelay(draw=randomInt){return draw(minDelay,maxDelay+1);}
