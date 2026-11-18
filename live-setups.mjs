import {quoteStatus} from './live-feed.mjs';
export const indexKeys={'^NSEI':'NSE_INDEX|Nifty 50','^NSEBANK':'NSE_INDEX|Nifty Bank','^BSESN':'BSE_INDEX|SENSEX'};
export const indexNames={'^NSEI':'NIFTY 50','^NSEBANK':'BANK NIFTY','^BSESN':'SENSEX'};
export const methodId='trend-breakout-v1';
export const methodName='Five-minute trend breakout';
const setupId=row=>[row.ticker,row.side,row.candle_end,row.entry,row.premium?.instrument_key,methodId].join('|');
const compatible=row=>row?.method?.id===methodId;
const methodConfirms=row=>compatible(row)&&row.status==='conditional'&&row.method.status==='conditional'&&row.method.side===row.side&&row.method.checks?.length===3&&row.method.checks.every(check=>check[row.side==='CE'?'ce_pass':'pe_pass']===true);
const positive=x=>Number.isFinite(x)&&x>0;
const ageOK=(stamp,limit,now)=>{const age=now-Date.parse(stamp);return Number.isFinite(age)&&age>=0&&age<=limit;};
function session(now){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  return {minute:+p.hour*60+(+p.minute),weekday:!['Sat','Sun'].includes(p.weekday),date:`${p.year}-${p.month}-${p.day}`};
}
// A completed candle is eligible only after observing it from its opening seconds
// without a >30s data gap. First partial candles and reconnect gaps cannot confirm entry.
export class LiveSetups {
  constructor(){this.clear();}
  clear(){this.quotes=new Map();this.bars=new Map();this.closed=new Map();this.active=new Map();this.armed=new Map();this.completed=new Map();this.changes=new Map();}
  trackChange(row,now){
    // Ignore heartbeat times, source refresh times and changing quote references.
    // Pinned index levels and actual entry/exit observations are meaningful changes.
    const signature=JSON.stringify([row.state,row.side,row.contract,row.monitor?null:row.reason,row.indexEntry,row.indexStop,row.indexTarget1,row.indexTarget2,row.triggeredAt,row.exitAt,row.exitBid,row.method?.checks]);
    const previous=this.changes.get(row.ticker);
    const change=previous?.signature===signature?previous:{signature,at:now,from:previous?.state||null,state:row.state};
    this.changes.set(row.ticker,change);
    return {...row,changed_at:change.at,previous_state:change.from};
  }
  ingest(quotes,type,now=Date.now()){
    for(const quote of quotes){
      if(!positive(quote.ltp)||quoteStatus(quote,now)!=='Fresh trade')continue;
      const previous=this.quotes.get(quote.key);
      if(previous&&quote.ltt<previous.ltt)continue;
      this.quotes.set(quote.key,{...quote,receivedAt:now,live:type===1});
      if(!Object.values(indexKeys).includes(quote.key)||type!==1)continue;
      const bucket=Math.floor(quote.ltt/300000)*300000,bar=this.bars.get(quote.key);
      if(!bar||bucket>bar.start){
        if(bar&&bucket===bar.start+300000&&quote.ltt-bar.last<=30000&&bar.complete)this.closed.set(quote.key,{end:bucket,close:bar.close});
        this.bars.set(quote.key,{start:bucket,last:quote.ltt,close:quote.ltp,complete:quote.ltt-bucket<=10000});
      }else if(bucket===bar.start){bar.complete=bar.complete&&quote.ltt-bar.last<=30000;bar.last=quote.ltt;bar.close=quote.ltp;}
    }
    // Target and stop touches latch on every packet, even between UI redraws.
    for(const state of this.active.values())this.observe(state,now);
  }
  fresh(key,now){const q=this.quotes.get(key);return q&&q.live&&now-q.receivedAt<=5000&&quoteStatus(q,now)==='Fresh trade'?q:null;}
  recordExit(state,reason,now){
    if(state.exit)return;
    const option=this.fresh(state.key,now);
    const quoted=option&&positive(option.bid)&&positive(option.ask)&&option.bid<=option.ask;
    Object.assign(state,{exit:reason,exitAt:now,exitBid:quoted?option.bid:null,exitQuoteTime:quoted?option.ltt:null});
  }
  observe(state,now){
    if(state.exit)return;
    const index=this.fresh(indexKeys[state.ticker],now),option=this.fresh(state.key,now);
    const minute=session(now).minute;
    if(now-state.triggeredAt>=1800000||minute>=915){this.recordExit(state,'TIME EXIT',now);return;}
    if(index&&(state.side==='CE'?index.ltp<=state.indexStop:index.ltp>=state.indexStop)){this.recordExit(state,'INDEX STOP HIT',now);return;}
    // Long options are closed at bid, never at the ask or the last trade.
    if(option&&positive(option.bid)&&positive(option.ask)&&option.bid<=option.ask){
      if(option.bid<=state.stop)this.recordExit(state,'SL HIT',now);
      else if(option.bid>=state.target2){state.t1=true;this.recordExit(state,'TARGET 2 HIT',now);}
      else if(option.bid>=state.target1)state.t1=true;
    }
  }
  evaluate(snapshot,connected,now=Date.now()){
    const clock=session(now);
    return Object.keys(indexKeys).map(ticker=>{
      let row=snapshot.options?.find(r=>r.ticker===ticker),p=row?.premium;
      const key=indexKeys[ticker];
      const modelFresh=!!row&&ageOK(row.candle_end,600000,now);
      const base={ticker,name:indexNames[ticker],side:row?.side||'',method:row?.method,method_name:methodName,state:'NO TRADE',reason:'Waiting for fresh strategy analysis.',analysis_state:!row?'Missing':modelFresh?'Fresh':'Stale or invalid',analysis_time:row?.candle_end};
      let active=this.active.get(ticker);
      if(active?.exit&&row&&active.id!==setupId(row)){this.active.delete(ticker);active=null;}
      if(active){
        this.observe(active,now);
        const validModel=modelFresh&&compatible(row)&&row.status!=='unavailable'&&row.method.status!=='unavailable';
        if(validModel&&(!methodConfirms(row)||row.side!==active.side))this.recordExit(active,'METHOD INVALIDATED',now);
        if(active.exit)this.completed.set(active.id,active.exit);
        const fresh=connected&&this.fresh(key,now)&&this.fresh(active.key,now);
        const depth=this.fresh(active.key,now);
        return {...base,...active,state:active.exit||(!fresh||!positive(depth?.bid)||!validModel?'MONITORING PAUSED':active.t1?'TARGET 1 HIT':'BUY '+active.side+' TRIGGERED'),reason:active.exit?'Observed scenario exit; no order or fill is tracked.':!fresh||!validModel?'Feed or strategy data is stale. Monitor your broker; no new entry.':'Live scenario monitoring. Targets and SL use option bid; levels remain fixed.',current:depth?.ltp,bid:depth?.bid,monitor:true};
      }
      if(!row){this.armed.delete(ticker);return {...base,state:'WAIT FOR ANALYSIS',reason:'No strategy snapshot is available. Check the market-data refresh workflow.'};}
      if(!modelFresh){this.armed.delete(ticker);return {...base,state:'STALE ANALYSIS',reason:'The strategy candle is over ten minutes old or has an invalid timestamp. Refresh the market-data workflow; fresh live ticks alone cannot update strategy analysis.'};}
      if(!compatible(row)){this.armed.delete(ticker);return {...base,state:'WAIT FOR METHOD',reason:'This snapshot uses an older or missing decision model. Refresh for '+methodName+'.'};}
      if(row.status==='no_trade'){this.armed.delete(ticker);return {...base,reason:row.reason||'Trend checks are mixed or flat.'};}
      if(row.method.status==='unavailable'||row.status==='unavailable'){this.armed.delete(ticker);return {...base,state:'METHOD DATA UNAVAILABLE',reason:row.reason||row.method.reason||'Required candle history is unavailable.'};}
      if(!connected){this.armed.delete(ticker);return {...base,state:'LIVE FEED DISCONNECTED',reason:'Strategy analysis is fresh, but the live tab is disconnected or its heartbeat expired. Connect Live API quotes and keep that tab open.'};}
      if(!clock.weekday||clock.minute<570||clock.minute>=885){this.armed.delete(ticker);return {...base,state:'OUTSIDE ENTRY WINDOW',reason:'New entries only 09:30–14:45 IST, weekdays. Holidays are not checked.'};}
      if(!['CE','PE'].includes(row.side)||!methodConfirms(row)){this.armed.delete(ticker);return {...base,reason:row.reason||'Trend-breakout method checks do not confirm this direction.'};}
      if(![row.entry,row.stop,row.target1,row.target2].every(positive)||(row.side==='CE'?!(row.stop<row.entry&&row.entry<row.target1&&row.target1<row.target2):!(row.stop>row.entry&&row.entry>row.target1&&row.target1>row.target2)))return {...base,reason:'Invalid index risk levels.'};
      if(p?.status==='available'&&(p.side!==row.side||p.expiry<=clock.date)){this.armed.delete(ticker);return {...base,reason:'A matching future-expiry option contract is required.'};}
      let arm=this.armed.get(ticker);
      if(arm&&(arm.row.side!==row.side||arm.row.premium?.instrument_key!==p?.instrument_key)){this.completed.set(setupId(arm.row),'ARM INVALIDATED');this.armed.delete(ticker);arm=null;}
      if(arm&&(now-Date.parse(arm.row.candle_end)>600000||now-arm.confirmAfter>30000||(now>=arm.confirmAfter&&this.closed.get(key)?.end!==arm.confirmAfter))){
        this.completed.set(setupId(arm.row),'ARM EXPIRED');this.armed.delete(ticker);arm=null;
      }
      if(!arm){
        if(this.completed.has(setupId(row)))return {...base,state:'WATCH EXPIRED',reason:'This watch exited, expired or missed a complete confirmation candle. Wait for a new snapshot.'};
        arm={row:{...row,premium:p?{...p}:p},armedAt:now,confirmAfter:Math.floor(now/300000)*300000+300000};this.armed.set(ticker,arm);
      }else if(p?.status==='available'&&p.instrument_key===arm.row.premium?.instrument_key){
        // Refresh matching contract metadata age, keeping the armed risk references fixed.
        arm.row.premium={...arm.row.premium,fetched_at:p.fetched_at};
      }
      row=arm.row;p=row.premium;
      base.side=row.side;base.method=row.method;base.analysis_time=row.candle_end;
      const index=this.fresh(key,now);
      if(!index)return {...base,state:'WAIT FOR LIVE INDEX',reason:'Fresh live index updates are required.'};
      if(row.side==='CE'?index.ltp<=row.stop:index.ltp>=row.stop){this.completed.set(setupId(row),'ARM INVALIDATED');this.armed.delete(ticker);return {...base,reason:'Underlying has invalidated the armed stop.'};}
      if(p?.status!=='available')return {...base,state:'WAIT FOR OPTION DATA',reason:p?.reason||'A usable option premium scenario is not available.'};
      if(p?.status!=='available'||!ageOK(p.fetched_at,300000,now)||p.side!==row.side||!/^\d{4}-\d{2}-\d{2}$/.test(p.expiry)||p.expiry<=clock.date||![p.stop,p.target1,p.atr14,p.tick_size_rupees,p.lot_size].every(positive))return {...base,reason:'A current matching contract, ATR stop, expiry, tick size and lot size are required.'};
      const option=this.fresh(p.instrument_key,now);
      if(!option||![option.bid,option.ask,option.bidQty,option.askQty,option.volume].every(positive)||option.bid>option.ask||(option.ask-option.bid)/option.ask>.05||Math.min(option.bidQty,option.askQty)<p.lot_size)return {...base,state:'WAIT FOR LIVE OPTION',reason:'Need live option bid/ask, spread ≤5%, traded volume and depth ≥one lot.'};
      const id=setupId(row);
      if(this.completed.has(id))return {...base,reason:'This setup already exited. Wait for a new strategy snapshot.'};
      const tick=p.tick_size_rupees,rounded=(v,up=false)=>Number(((up?Math.ceil:Math.floor)(v/tick+ (up?-1e-8:1e-8))*tick).toFixed(6));
      const entry=rounded(option.ask,true),stop=rounded(Math.max(p.stop,entry-1.5*p.atr14));
      const risk=entry-stop;
      if(risk<2*tick||entry>=p.target1||(row.side==='CE'?index.ltp>=row.target1:index.ltp<=row.target1))return {...base,reason:'Move has already run or premium risk is invalid. Do not chase.'};
      const levels={entry,stop,target1:rounded(entry+risk,true),target2:rounded(entry+2*risk,true),key:p.instrument_key,contract:p.trading_symbol,expiry:p.expiry,lot:p.lot_size,indexEntry:row.entry,indexStop:row.stop,indexTarget1:row.target1,indexTarget2:row.target2,method_name:methodName,candle_end:row.candle_end,current:option.ltp,bid:option.bid};
      const bar=this.closed.get(key),confirmed=bar&&bar.end===arm.confirmAfter&&bar.end>arm.armedAt&&bar.end>Date.parse(row.candle_end)&&now-bar.end>=0&&now-bar.end<=30000&&(row.side==='CE'?bar.close>row.entry:bar.close<row.entry);
      if(!confirmed)return {...base,...levels,state:'WATCH '+row.side,reason:'Wait for a fully observed five-minute close '+(row.side==='CE'?'above ':'below ')+row.entry+'. Live ask references update until confirmation.'};
      const state={...levels,ticker,name:base.name,side:row.side,id,triggeredAt:now,exitDueAt:Math.min(now+1800000,Date.parse(clock.date+'T15:15:00+05:30')),t1:false,exit:null};
      this.active.set(ticker,state);
      this.armed.delete(ticker);
      return {...base,...state,state:'BUY '+row.side+' TRIGGERED',reason:'Completed live candle confirmed the breakout with fresh option depth. Indicative ask reference; verify your actual fill.',monitor:true};
    }).map(row=>this.trackChange(row,now));
  }
}
