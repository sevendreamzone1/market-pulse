import assert from 'node:assert/strict';
import {LiveSetups,indexKeys} from '../live-setups.mjs';
const start=Date.parse('2026-11-17T04:30:00Z'),end=start+300000;
const quote=(key,ltp,now,extra={})=>({key,ltp,ltt:now,cp:100,...extra});
const index=(ltp,now)=>quote(indexKeys['^NSEI'],ltp,now);
const option=(bid,ask,now)=>quote('NSE_FO|fixture',bid,now,{bid,ask,bidQty:100,askQty:100,volume:1000});
function snapshot(side='CE'){
  const call=side==='CE';return {options:[{ticker:'^NSEI',status:'conditional',side,candle_end:new Date(start).toISOString(),entry:100,stop:call?90:110,target1:call?110:90,target2:call?120:80,method:{id:'trend-breakout-v1',status:'conditional',side,checks:[1,2,3].map(()=>({ce_pass:call,pe_pass:!call}))},strategy_report:{consensus:{signal:call?'Bullish':'Bearish',agreement_pct:75}},premium:{status:'available',side,instrument_key:'NSE_FO|fixture',trading_symbol:'FIXTURE OPTION',expiry:'2026-11-24',lot_size:50,tick_size_rupees:.05,atr14:4,stop:45,target1:60,fetched_at:new Date(end).toISOString()}}]};
}
function ready(side='CE'){
  const engine=new LiveSetups();
  engine.evaluate(snapshot(side),true,start);
  // Full five-minute candle, observed from its opening with no missing samples.
  for(let now=start;now<=end;now+=10000)engine.ingest([index(side==='CE'?101:99,now),option(49,50,now)],1,now);
  return engine;
}
const get=(e,s=snapshot(),connected=true,now=end)=>e.evaluate(s,connected,now)[0];
let e=ready();let row=get(e);
assert.equal(row.state,'BUY CE TRIGGERED');assert.equal(row.entry,50);assert.equal(row.stop,45);assert.equal(row.target1,55);assert.equal(row.target2,60);
assert.equal(row.triggeredAt,end);assert.equal(row.exitDueAt,end+1800000);assert.equal(row.exitAt,undefined);
assert.equal(row.changed_at,end);
e.ingest([option(51,52,end+1000),index(102,end+1000)],1,end+1000);
row=get(e,snapshot(),true,end+1000);assert.equal(row.entry,50,'entry must remain frozen');assert.equal(row.target1,55);
assert.equal(row.changed_at,end,'ordinary live prices must not reset the recommendation timestamp');
e.ingest([option(55,56,end+2000),index(103,end+2000)],1,end+2000);
assert.equal(get(e,snapshot(),true,end+2000).state,'TARGET 1 HIT');
assert.equal(get(e,snapshot(),true,end+2000).changed_at,end+2000);
e.ingest([option(44,45,end+3000),index(103,end+3000)],1,end+3000);
assert.equal(get(e,snapshot(),true,end+3000).state,'SL HIT');
row=get(e,snapshot(),true,end+3000);assert.equal(row.exitAt,end+3000);assert.equal(row.exitBid,44);assert.equal(row.exitQuoteTime,end+3000);
e.ingest([option(60,61,end+4000)],1,end+4000);assert.equal(get(e,snapshot(),true,end+4000).state,'SL HIT','SL must latch');
row=get(e,snapshot(),true,end+4000);assert.equal(row.exitAt,end+3000);assert.equal(row.exitBid,44,'later prices must not change the exit observation');
assert.equal(row.changed_at,end+3000);assert.equal(row.previous_state,'TARGET 1 HIT');
e=ready('PE');assert.equal(get(e,snapshot('PE')).state,'BUY PE TRIGGERED');
e.ingest([index(111,end+1000)],1,end+1000);assert.equal(get(e,snapshot('PE'),true,end+1000).state,'INDEX STOP HIT');
e=ready();assert.equal(get(e).state,'BUY CE TRIGGERED');
assert.equal(get(e,snapshot(),true,end+31000).state,'MONITORING PAUSED');
assert.equal(get(e,snapshot(),true,end+1800000).state,'TIME EXIT');
row=get(e,snapshot(),true,end+1800000);assert.equal(row.exitAt,end+1800000);assert.equal(row.exitBid,null,'a stale quote cannot supply a time-exit price');assert.equal(row.exitQuoteTime,null);
e=ready();get(e);const reverse=snapshot('PE');row=get(e,reverse);assert.equal(row.state,'METHOD INVALIDATED');
assert.equal(row.exitAt,end);assert.equal(row.exitBid,49);
e=ready();get(e);e.ingest([option(60,61,end+1000)],1,end+1000);row=get(e,snapshot(),true,end+1000);
assert.equal(row.state,'TARGET 2 HIT');assert.equal(row.exitBid,60);assert.equal(row.exitAt,end+1000);
e=ready('PE');get(e,snapshot('PE'));e.ingest([index(111,end+6000)],1,end+6000);row=get(e,snapshot('PE'),true,end+6000);
assert.equal(row.state,'INDEX STOP HIT');assert.equal(row.exitBid,null,'index stop with no fresh option must not invent an exit bid');
e=ready();get(e);e.ingest([option(51,50,end+1000),index(80,end+1000)],1,end+1000);row=get(e,snapshot(),true,end+1000);
assert.equal(row.exitBid,null,'a crossed option quote cannot supply an exit bid');
e=ready();e.ingest([option(60,61,end)],1,end);assert.equal(get(e).state,'NO TRADE','do not chase premiums past first target');
e=ready();let s=snapshot();s.options[0].candle_end=new Date(end-600001).toISOString();assert.equal(get(e,s).state,'STALE ANALYSIS');
s=snapshot();s.options[0].premium.fetched_at=new Date(end-300001).toISOString();assert.equal(get(e,s).state,'NO TRADE');
s=snapshot();s.options[0].premium.expiry='2026-11-17';assert.equal(get(e,s).state,'NO TRADE');
s=snapshot();s.options[0].method.checks[0].ce_pass=false;assert.equal(get(e,s).state,'NO TRADE');
for(const bad of [option(40,50,end),option(51,50,end),{...option(49,50,end),askQty:1},{...option(49,50,end),ltt:end-31000}]){
  e=ready();e.quotes.delete('NSE_FO|fixture');e.ingest([bad],1,end);assert.equal(get(e).state,'WAIT FOR LIVE OPTION');
}
e=ready();assert.equal(get(e,snapshot(),false).state,'LIVE FEED DISCONNECTED');
assert.equal(get(e,snapshot(),true,Date.parse('2026-11-17T10:00:00Z')).state,'STALE ANALYSIS');
const outside=snapshot();outside.options[0].candle_end='2026-11-17T10:00:00Z';
assert.equal(get(e,outside,true,Date.parse('2026-11-17T10:00:00Z')).state,'OUTSIDE ENTRY WINDOW');
e=new LiveSetups();e.ingest([index(101,end),option(49,50,end)],0,end);assert.equal(get(e).state,'WAIT FOR LIVE INDEX','initial feed cannot authorize entry');
e=new LiveSetups();e.ingest([index(101,end),option(49,50,end)],1,end);assert.equal(get(e).state,'WATCH CE','first partial candle cannot confirm');
assert.equal(get(e).triggeredAt,undefined,'watch references have no entry timestamp');assert.equal(get(e).exitDueAt,undefined);
e=new LiveSetups();
for(let now=start+30000;now<=end;now+=10000)e.ingest([index(101,now),option(49,50,now)],1,now);
assert.equal(get(e).state,'WATCH CE','missing opening cannot confirm');
e=new LiveSetups();for(const now of [start,start+60000,end])e.ingest([index(101,now),option(49,50,now)],1,now);
assert.equal(get(e).state,'WATCH CE','gaps cannot confirm');
e=ready();e.ingest([index(80,end-10000)],1,end);assert.equal(e.quotes.get(indexKeys['^NSEI']).ltp,101,'ignore out of order');
e.clear();assert.equal(e.quotes.size,0);assert.equal(e.active.size,0);
e=ready();s=snapshot();s.options[0].candle_end=new Date(start-86400000).toISOString();
assert.equal(get(e,s).state,'STALE ANALYSIS','fresh ticks cannot make a previous-session strategy model usable');
assert.equal(get(e,s).analysis_state,'Stale or invalid');assert.equal(e.active.size,0);
assert.equal(get(e,snapshot()).state,'WATCH CE','recovered analysis must arm a future candle, not trigger retroactively');
e=ready();s=snapshot();s.options[0].status='no_trade';s.options[0].reason='Current categories conflict.';
assert.equal(get(e,s).state,'NO TRADE');assert.equal(get(e,s).analysis_state,'Fresh');
assert.equal(get(e,s,false).state,'NO TRADE','a fresh neutral analysis is identifiable separately from socket state');
e=ready();s=snapshot();s.options[0].premium={status:'unavailable',reason:'Premium risk is invalid.'};
assert.equal(get(e,s).state,'WAIT FOR OPTION DATA');assert.match(get(e,s).reason,/risk is invalid/);
assert.equal(get(e,{items:[],options:[]}).state,'WAIT FOR ANALYSIS');
// The catalog can disagree without vetoing the single named method.
e=ready();s=snapshot();s.options[0].strategy_report.consensus.signal='Neutral';
assert.equal(get(e,s).state,'BUY CE TRIGGERED');
e=ready();s=snapshot();delete s.options[0].method;
assert.equal(get(e,s).state,'WAIT FOR METHOD');assert.equal(e.armed.size,0);
e=ready();s=snapshot();s.options[0].status=s.options[0].method.status='unavailable';s.options[0].reason='Missing candle history';
assert.equal(get(e,s).state,'METHOD DATA UNAVAILABLE');assert.equal(e.armed.size,0);
e=ready();get(e);assert.equal(get(e,s).state,'MONITORING PAUSED','unavailable method inputs cannot invent a direction-loss exit');
// A newer snapshot cannot move an already armed trigger before confirmation.
e=ready();s=snapshot();s.options[0].candle_end=new Date(end).toISOString();s.options[0].entry=105;
row=get(e,s);assert.equal(row.state,'BUY CE TRIGGERED');assert.equal(row.indexEntry,100);
assert.equal(row.analysis_time,new Date(start).toISOString());
// A new or recovered connection cannot use a pre-existing completed candle.
e=new LiveSetups();for(let t=start;t<=end;t+=10000)e.ingest([index(101,t),option(49,50,t)],1,t);
assert.equal(get(e).state,'WATCH CE');assert.equal(e.active.size,0);
// An armed watch with a missing confirmation candle expires without entry.
e=new LiveSetups();e.evaluate(snapshot(),true,start);
for(const t of [start,start+60000,end])e.ingest([index(101,t),option(49,50,t)],1,t);
assert.equal(get(e).state,'WATCH EXPIRED');assert.equal(e.active.size,0);
s=snapshot();s.options[0].candle_end=new Date(end).toISOString();
assert.equal(get(e,s).state,'WATCH CE','a new snapshot can arm again after a missed candle');
// Neutral/opposite method decisions invalidate an arm, not the legacy votes.
e=ready();s=snapshot();s.options[0].status=s.options[0].method.status='no_trade';s.options[0].reason='Mixed trend checks';
assert.equal(get(e,s).state,'NO TRADE');assert.equal(e.armed.size,0);
e=ready();assert.equal(get(e,snapshot('PE')).state,'WATCH PE');assert.equal(e.active.size,0);
e=ready();get(e,snapshot(),false);assert.equal(e.armed.size,0);
// Expired arms cannot borrow fresh timestamps from a later model.
e=ready();const later=end+600001;e.ingest([index(101,later),option(49,50,later)],1,later);
s=snapshot();s.options[0].candle_end=new Date(later-1).toISOString();s.options[0].premium.fetched_at=new Date(later).toISOString();
assert.equal(get(e,s,true,later).state,'WATCH CE');assert.equal(e.active.size,0);
assert.equal(e.armed.get('^NSEI').row.candle_end,s.options[0].candle_end);
e.clear();assert.equal(e.armed.size,0);
assert.equal(e.changes.size,0,'disconnect clearing must also remove recommendation change state');
// Watch ask references change without generating new recommendations.
e=new LiveSetups();e.ingest([index(101,end),option(49,50,end)],1,end);
row=get(e);assert.equal(row.state,'WATCH CE');assert.equal(row.changed_at,end);assert.equal(row.previous_state,null);
e.ingest([index(102,end+1000),option(51,52,end+1000)],1,end+1000);
row=get(e,snapshot(),true,end+1000);assert.equal(row.entry,52);assert.equal(row.changed_at,end);
// A newly armed trigger is a meaningful update, even with the same WATCH state.
const rearm=end+300000;e.ingest([index(102,rearm),option(51,52,rearm)],1,rearm);
s=snapshot();s.options[0].candle_end=new Date(rearm).toISOString();s.options[0].entry=105;s.options[0].premium.fetched_at=new Date(rearm).toISOString();
row=get(e,s,true,rearm);assert.equal(row.state,'WATCH CE');assert.equal(row.indexEntry,105);assert.equal(row.changed_at,rearm);assert.equal(row.previous_state,'WATCH CE');
// Snapshot publication times and heartbeat redraws do not create updates.
e=new LiveSetups();s=snapshot();s.options[0].status=s.options[0].method.status='no_trade';s.options[0].reason='Mixed checks';
row=get(e,s,false,end);assert.equal(row.changed_at,end);
s.options[0].candle_end=new Date(end+1000).toISOString();
assert.equal(get(e,s,false,end+1000).changed_at,end);
s.options[0].method.checks[0].ce_pass=false;
assert.equal(get(e,s,false,end+2000).changed_at,end+2000);
console.log('Live setups passed: CE/PE, completed candles, no initial/partial/gapped entry, fresh depth, anti-chase, frozen risk, bid exits, latched targets/SL, time and confluence exits.');
