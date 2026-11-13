import test from 'node:test';
import assert from 'node:assert/strict';
import {nextDelay,minDelay,maxDelay} from './timing.mjs';
test('new schedules stay between four and six minutes inclusive',()=>{const values=Array.from({length:200},()=>nextDelay());assert.ok(values.every(v=>v>=240000&&v<=360000));assert.ok(new Set(values).size>1);});
test('both timing endpoints can be selected',()=>{assert.equal(nextDelay((lo)=>lo),minDelay);assert.equal(nextDelay((lo,hi)=>hi-1),maxDelay);});
