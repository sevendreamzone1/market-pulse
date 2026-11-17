import assert from 'node:assert/strict';
class Element{
  constructor(){this.children=[];this.textContent='';}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
}
const panel=new Element(),events=[],intervals=[];
globalThis.document={getElementById:()=>panel,createElement:()=>new Element()};
globalThis.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
globalThis.dispatchEvent=event=>events.push(event);
globalThis.addEventListener=()=>{};
const realInterval=globalThis.setInterval;globalThis.setInterval=fn=>intervals.push(fn);
let channel;globalThis.BroadcastChannel=class{constructor(){channel=this;}close(){}};
const text=e=>[e.textContent,...e.children.map(text)].join(' ');
await import('../live-dashboard.mjs');
assert.match(text(panel),/NO LIVE ENTRY/);
const now=Date.now();
channel.onmessage({data:{type:'marketpulse-live-v1',source:'fixture',sentAt:now,connected:true,rows:[{name:'NIFTY 50',state:'BUY CE TRIGGERED',reason:'Fixture scenario',contract:'<img src=x>',expiry:'2026-11-24',lot:50,entry:50,stop:45,target1:55,target2:60,current:51,bid:50.5,indexEntry:25000,indexStop:24950,indexTarget1:25050,indexTarget2:25100,agreement:75,monitor:true}],quotes:[{key:'NSE_INDEX|Nifty 50',ltp:25001,ltt:now,receivedAt:now}]}});
assert.match(text(panel),/BUY CE TRIGGERED/);assert.match(text(panel),/50.00/);assert.match(text(panel),/45.00/);assert.match(text(panel),/55.00/);assert.match(text(panel),/60.00/);
assert.equal(events.at(-1).detail[0].ltp,25001);
assert.match(text(panel),/<img src=x>/,'labels are plain text');
const realNow=Date.now;Date.now=()=>now+6000;intervals[0]();Date.now=realNow;
assert.match(text(panel),/NO LIVE ENTRY/);assert.deepEqual(events.at(-1).detail,[],'expired tab heartbeat clears dashboard live quotes');
globalThis.setInterval=realInterval;
console.log('Dashboard live panel passed: shared scenario entry/SL/targets, safe text labels, quote events and stale-tab suppression.');
