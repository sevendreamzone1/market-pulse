import assert from 'node:assert/strict';
class Element{
  constructor(){this.children=[];this.textContent='';}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
}
const panel=new Element(),events=[],intervals=[];
const homeRows=new Element(),homeStatus=new Element();
globalThis.document={getElementById:id=>id==='live-setups'?panel:id==='home-live-rows'?homeRows:id==='home-live-status'?homeStatus:null,createElement:()=>new Element()};
globalThis.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
globalThis.dispatchEvent=event=>events.push(event);
const listeners={};globalThis.addEventListener=(name,fn)=>{listeners[name]=fn;};
const realInterval=globalThis.setInterval;globalThis.setInterval=fn=>intervals.push(fn);
let channel;globalThis.BroadcastChannel=class{constructor(){channel=this;}close(){}};
const text=e=>[e.textContent,...e.children.map(text)].join(' ');
await import('../live-dashboard.mjs');
assert.match(text(panel),/WAIT FOR ANALYSIS/);
assert.match(homeStatus.textContent,/disconnected/);assert.match(text(homeRows),/NIFTY 50/);assert.doesNotMatch(text(homeRows),/Fresh trade/);
const now=Date.now();
listeners['marketpulse-snapshot']({detail:{items:[],options:[{ticker:'^NSEI',status:'no_trade',reason:'Old neutral result must not appear as current.',candle_end:new Date(now-86400000).toISOString()}]}});
assert.match(text(panel),/STALE ANALYSIS/);assert.doesNotMatch(text(panel),/Old neutral result must not appear as current/);
listeners['marketpulse-snapshot']({detail:{items:[],options:[{ticker:'^NSEI',status:'no_trade',reason:'Fresh conflicting strategies.',candle_end:new Date(now-60000).toISOString()}]}});
assert.match(text(panel),/NO TRADE/);assert.match(text(panel),/Fresh conflicting strategies/);assert.doesNotMatch(text(panel),/STALE ANALYSIS/);
listeners['marketpulse-snapshot']({detail:{items:[],options:[{ticker:'^NSEI',status:'conditional',side:'CE',candle_end:new Date(now-60000).toISOString()}]}});
assert.match(text(panel),/LIVE FEED DISCONNECTED/);
const message={type:'marketpulse-live-v1',source:'fixture',sentAt:now,connected:true,rows:[{name:'NIFTY 50',state:'BUY CE TRIGGERED',reason:'Fixture scenario',contract:'<img src=x>',expiry:'2026-11-24',lot:50,entry:50,stop:45,target1:55,target2:60,current:51,bid:50.5,indexEntry:25000,indexStop:24950,indexTarget1:25050,indexTarget2:25100,agreement:75,monitor:true}],quotes:[{key:'NSE_INDEX|Nifty 50',ltp:25001,cp:25000,ltt:now,receivedAt:now,live:true}]};
channel.onmessage({data:message});
assert.match(text(panel),/BUY CE TRIGGERED/);assert.match(text(panel),/50.00/);assert.match(text(panel),/45.00/);assert.match(text(panel),/55.00/);assert.match(text(panel),/60.00/);
assert.equal(events.at(-1).detail[0].ltp,25001);
assert.match(homeStatus.textContent,/LIVE · 1 instrument/);assert.match(text(homeRows),/25,001.00/);assert.match(text(homeRows),/Fresh trade/);
for(const invalid of [{...message.quotes[0],live:false},{...message.quotes[0],ltt:now-31000},{...message.quotes[0],ltt:now+10000},{...message.quotes[0],receivedAt:now-6000},{...message.quotes[0],ltp:NaN}]){
  channel.onmessage({data:{...message,quotes:[invalid]}});
  assert.doesNotMatch(text(homeRows),/25,001.00/);assert.doesNotMatch(text(homeRows),/Fresh trade/);assert.deepEqual(events.at(-1).detail,[]);
}
channel.onmessage({data:message});
assert.match(text(panel),/<img src=x>/,'labels are plain text');
const realNow=Date.now;Date.now=()=>now+6000;intervals[0]();Date.now=realNow;
assert.match(text(panel),/LIVE FEED DISCONNECTED/);assert.deepEqual(events.at(-1).detail,[],'expired tab heartbeat clears dashboard live quotes');
assert.doesNotMatch(text(homeRows),/25,001.00/);assert.match(homeStatus.textContent,/disconnected/);
globalThis.setInterval=realInterval;
console.log('Dashboard live panel passed: shared scenario entry/SL/targets, safe text labels, quote events and stale-tab suppression.');
