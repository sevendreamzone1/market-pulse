const money=value=>Number.isFinite(value)?new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value):'—';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const timestamp=value=>Number.isFinite(value)&&value>0?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value)):'—';
function renderScenarioTable(rows){
  const wrap=node('div',undefined,'live-trade-table-wrap');
  wrap.tabIndex=0;wrap.role='region';wrap.ariaLabel='Live entry and exit summary; scroll horizontally for all columns';
  const table=node('table',undefined,'live-trade-table');
  table.append(node('caption','Current CE / PE scenarios · times in IST · option prices in ₹'));
  const head=node('thead'),header=node('tr');
  for(const title of ['Index / contract','Status','Status changed IST','Side','Entry observed IST','Entry ask ₹','SL ₹','T1 ₹','T2 ₹','Time exit due IST','Exit observed IST','Exit bid ₹','Exit quote IST']){const th=node('th',title);th.scope='col';header.append(th);}
  head.append(header);table.append(head);
  const body=node('tbody');
  for(const row of rows){
    const tr=node('tr'),confirmed=Number.isFinite(row.triggeredAt)&&row.triggeredAt>0;
    const identity=node('th',row.name);identity.scope='row';
    if(row.contract)identity.append(node('small',row.contract+' · '+row.expiry));
    tr.append(identity);
    const status=node('td',row.state);status.append(node('small',row.reason));tr.append(status,node('td',timestamp(row.changed_at)));
    for(const value of [row.side||'—',confirmed?timestamp(row.triggeredAt):row.contract?'Awaiting confirmation':'—',row.contract?money(row.entry)+(confirmed?'':' (watch)'):'—',row.contract?money(row.stop):'—',row.contract?money(row.target1):'—',row.contract?money(row.target2):'—',timestamp(row.exitDueAt),timestamp(row.exitAt),money(row.exitBid),timestamp(row.exitQuoteTime)])tr.append(node('td',value));
    body.append(tr);
  }
  table.append(body);wrap.append(table);return wrap;
}
export function renderLivePanel(container,rows,connected){
  const previous=container.querySelector?.('.live-trade-table-wrap');
  const scrollLeft=previous?.scrollLeft||0,focused=previous&&document.activeElement===previous;
  container.replaceChildren();
  container.append(node('h2','Live CE / PE trade scenarios'));
  container.append(node('p','Decision method: Five-minute trend breakout · EMA9/21 trend + 20-bar range ±0.1 ATR14. Requires 20 current-session candles; earliest watch 10:55 IST. Catalog votes do not drive entries.'));
  container.append(node('p',connected?'Live feed connected · levels below are research scenarios; no orders or fills are tracked.':'Connect Live API quotes in another tab and keep it open. Credentials stay in that tab.'));
  const updates=node('section',undefined,'live-recommendation-updates');
  updates.ariaLabel='Current recommendation changes';
  updates.append(node('h3','Recommendation updates'));
  const list=node('ul');
  for(const row of [...rows].sort((a,b)=>(b.changed_at||0)-(a.changed_at||0))){
    const item=node('li');
    item.append(node('strong',row.name+' · '+row.state),node('small',(row.previous_state===row.state?'Levels or checks updated':row.previous_state?'Changed from '+row.previous_state:'First observed status')+' · '+timestamp(row.changed_at)+' IST'));
    list.append(item);
  }
  updates.append(list,node('p','Updates automatically when the recommendation, eligibility or armed levels change. Price ticks alone do not create a new suggestion. Keep the live tab connected; this is a current-session display, not background notifications.'));
  container.append(updates);
  const refresh=node('a','Open market-data refresh workflow');refresh.href='https://github.com/sevendreamzone1/market-pulse/actions/workflows/pages.yml';refresh.target='_blank';refresh.rel='noopener noreferrer';container.append(refresh);
  container.append(node('p','Refresh data on this page only reloads the published snapshot. If analysis is stale, run the workflow above and check its result. An open socket alone does not establish fresh strategy data.'));
  const tableWrap=renderScenarioTable(rows);
  container.append(tableWrap,node('p','Watch prices are conditional references, not entries. Entry time is the observed confirmation; exit time is when this browser detected an exit condition. Exit bid is captured only from a fresh, uncrossed quote, not an executed fill. Dashes mean unavailable or not yet observed. Current session only; disconnecting clears scenarios.'));
  tableWrap.scrollLeft=scrollLeft;
  if(focused)tableWrap.focus({preventScroll:true});
  const grid=node('div',undefined,'live-setup-grid');
  for(const row of rows){
    const card=node('article',undefined,'live-setup-card');
    card.append(node('h3',row.name),node('strong',row.state,'live-setup-state'),node('p',row.reason));
    if(row.method?.checks?.length){
      const checks=node('ul');
      for(const check of row.method.checks)checks.append(node('li',check.name+': CE '+(check.ce_pass?'pass':'fail')+' · PE '+(check.pe_pass?'pass':'fail')));
      card.append(checks);
    }
    if(row.analysis_state){
      const stamp=Date.parse(row.analysis_time);
      const time=Number.isFinite(stamp)?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(stamp))+' IST':'Unavailable';
      card.append(node('p','Strategy analysis: '+row.analysis_state+' · candle ended '+time));
    }
    if(row.contract){
      card.append(node('p',`${row.contract} · ${row.expiry} · lot ${row.lot}`));
      const dl=node('dl',undefined,'live-setup-levels');
      for(const [label,value] of [['Buy ask reference · ₹',row.entry],['Stop-loss · ₹',row.stop],['Target 1 · 1R · ₹',row.target1],['Target 2 · 2R · ₹',row.target2],['Live option LTP · ₹',row.current],['Live exit bid · ₹',row.bid],['Outlay per lot · ₹',row.entry*row.lot],['Planned stop risk per lot · ₹',(row.entry-row.stop)*row.lot]]){const pair=node('div');pair.append(node('dt',label),node('dd',money(value)));dl.append(pair);}
      card.append(dl,node('p',`Index trigger ${money(row.indexEntry)} · index SL ${money(row.indexStop)} · index T1/T2 ${money(row.indexTarget1)} / ${money(row.indexTarget2)}. Index points are not option prices.`));
      card.append(node('p',`Five-minute trend breakout; no accuracy score is claimed. Premium levels ${row.monitor?'are frozen at the observed trigger':'update until confirmation'}; the armed index trigger stays fixed.`));
      if(row.triggeredAt)card.append(node('p','Observed trigger '+new Date(row.triggeredAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})+' IST · no fill assumed.'));
    }
    card.append(node('small','Exit: premium bid hits SL/T2, index invalidation, or method direction invalidation. T1 suggests a partial exit; time exit 30 minutes after trigger or 15:15 IST. Verify and execute in your broker.'));
    grid.append(card);
  }
  container.append(grid,node('p','The method refreshes with five-minute snapshots. Live ticks confirm a newly completed five-minute breakout and monitor levels; indicators are not recalculated on every tick. Disconnects and closed tabs end monitoring. Amounts exclude fees and slippage; stop execution is not guaranteed and the entire premium can be lost.'));
}
