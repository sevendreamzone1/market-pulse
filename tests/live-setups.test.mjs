import assert from 'node:assert/strict';
import {LiveSetups,indexKeys} from '../live-setups.mjs';
const start=Date.parse('2026-11-17T04:30:00Z'),end=start+300000;
const quote=(key,ltp,now,extra={})=>({key,ltp,ltt:now,cp:100,...extra});
const index=(ltp,now)=>quote(indexKeys['^NSEI'],ltp,now);
const option=(bid,ask,now)=>quote('NSE_FO|fixture',bid,now,{bid,ask,bidQty:100,askQty:100,volume:1000});
function snapshot(side='CE'){
  const call=side==='CE';return {options:[{ticker:'^NSEI',status:'conditional',side,candle_end:new Date(start).toISOString(),entry:100,stop:call?90:110,target1:call?110:90,target2:call?120:80,strategy_report:{consensus:{signal:call?'Bullish':'Bearish',agreement_pct:75}},premium:{status:'available',side,instrument_key:'NSE_FO|fixture',trading_symbol:'FIXTURE OPTION',expiry:'2026-11-24',lot_size:50,tick_size_rupees:.05,atr14:4,stop:45,target1:60,fetched_at:new Date(end).toISOString()}}]};
}
function ready(side='CE'){
  const engine=new LiveSetups();
  // Full five-minute candle, observed from its opening with no missing samples.
  for(let now=start;now<=end;now+=10000)engine.ingest([index(side==='CE'?101:99,now),option(49,50,now)],1,now);
  return engine;
}
const get=(e,s=snapshot(),connected=true,now=end)=>e.evaluate(s,connected,now)[0];
let e=ready();let row=get(e);
assert.equal(row.state,'BUY CE TRIGGERED');assert.equal(row.entry,50);assert.equal(row.stop,45);assert.equal(row.target1,55);assert.equal(row.target2,60);
e.ingest([option(51,52,end+1000),index(102,end+1000)],1,end+1000);
row=get(e,snapshot(),true,end+1000);assert.equal(row.entry,50,'entry must remain frozen');assert.equal(row.target1,55);
e.ingest([option(55,56,end+2000),index(103,end+2000)],1,end+2000);
assert.equal(get(e,snapshot(),true,end+2000).state,'TARGET 1 HIT');
e.ingest([option(44,45,end+3000),index(103,end+3000)],1,end+3000);
assert.equal(get(e,snapshot(),true,end+3000).state,'SL HIT');
e.ingest([option(60,61,end+4000)],1,end+4000);assert.equal(get(e,snapshot(),true,end+4000).state,'SL HIT','SL must latch');
e=ready('PE');assert.equal(get(e,snapshot('PE')).state,'BUY PE TRIGGERED');
e.ingest([index(111,end+1000)],1,end+1000);assert.equal(get(e,snapshot('PE'),true,end+1000).state,'INDEX STOP HIT');
e=ready();assert.equal(get(e).state,'BUY CE TRIGGERED');
assert.equal(get(e,snapshot(),true,end+31000).state,'MONITORING PAUSED');
assert.equal(get(e,snapshot(),true,end+1800000).state,'TIME EXIT');
e=ready();get(e);const reverse=snapshot('PE');assert.equal(get(e,reverse).state,'CONFLUENCE LOST');
e=ready();e.ingest([option(60,61,end)],1,end);assert.equal(get(e).state,'NO TRADE','do not chase premiums past first target');
e=ready();let s=snapshot();s.options[0].candle_end=new Date(end-600001).toISOString();assert.equal(get(e,s).state,'NO TRADE');
s=snapshot();s.options[0].premium.fetched_at=new Date(end-300001).toISOString();assert.equal(get(e,s).state,'NO TRADE');
s=snapshot();s.options[0].premium.expiry='2026-11-17';assert.equal(get(e,s).state,'NO TRADE');
s=snapshot();s.options[0].strategy_report.consensus.signal='Neutral';assert.equal(get(e,s).state,'NO TRADE');
for(const bad of [option(40,50,end),option(51,50,end),{...option(49,50,end),askQty:1},{...option(49,50,end),ltt:end-31000}]){
  e=ready();e.quotes.delete('NSE_FO|fixture');e.ingest([bad],1,end);assert.equal(get(e).state,'WAIT FOR LIVE OPTION');
}
e=ready();assert.equal(get(e,snapshot(),false).state,'NO TRADE');
assert.equal(get(e,snapshot(),true,Date.parse('2026-11-17T10:00:00Z')).state,'NO TRADE');
e=new LiveSetups();e.ingest([index(101,end),option(49,50,end)],0,end);assert.equal(get(e).state,'WAIT FOR LIVE INDEX','initial feed cannot authorize entry');
e=new LiveSetups();e.ingest([index(101,end),option(49,50,end)],1,end);assert.equal(get(e).state,'WATCH CE','first partial candle cannot confirm');
e=new LiveSetups();
for(let now=start+30000;now<=end;now+=10000)e.ingest([index(101,now),option(49,50,now)],1,now);
assert.equal(get(e).state,'WATCH CE','missing opening cannot confirm');
e=new LiveSetups();for(const now of [start,start+60000,end])e.ingest([index(101,now),option(49,50,now)],1,now);
assert.equal(get(e).state,'WATCH CE','gaps cannot confirm');
e=ready();e.ingest([index(80,end-10000)],1,end);assert.equal(e.quotes.get(indexKeys['^NSEI']).ltp,101,'ignore out of order');
e.clear();assert.equal(e.quotes.size,0);assert.equal(e.active.size,0);
console.log('Live setups passed: CE/PE, completed candles, no initial/partial/gapped entry, fresh depth, anti-chase, frozen risk, bid exits, latched targets/SL, time and confluence exits.');
