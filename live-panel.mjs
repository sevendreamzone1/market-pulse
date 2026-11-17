const money=value=>Number.isFinite(value)?new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value):'—';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function renderLivePanel(container,rows,connected){
  container.replaceChildren();
  container.append(node('h2','Live CE / PE trade scenarios'));
  container.append(node('p',connected?'Live feed connected · levels below are research scenarios; no orders or fills are tracked.':'Connect Live API quotes in another tab and keep it open. Credentials stay in that tab.'));
  const grid=node('div',undefined,'live-setup-grid');
  for(const row of rows){
    const card=node('article',undefined,'live-setup-card');
    card.append(node('h3',row.name),node('strong',row.state,'live-setup-state'),node('p',row.reason));
    if(row.contract){
      card.append(node('p',`${row.contract} · ${row.expiry} · lot ${row.lot}`));
      const dl=node('dl',undefined,'live-setup-levels');
      for(const [label,value] of [['Buy ask reference · ₹',row.entry],['Stop-loss · ₹',row.stop],['Target 1 · 1R · ₹',row.target1],['Target 2 · 2R · ₹',row.target2],['Live option LTP · ₹',row.current],['Live exit bid · ₹',row.bid],['Outlay per lot · ₹',row.entry*row.lot],['Planned stop risk per lot · ₹',(row.entry-row.stop)*row.lot]]){const pair=node('div');pair.append(node('dt',label),node('dd',money(value)));dl.append(pair);}
      card.append(dl,node('p',`Index trigger ${money(row.indexEntry)} · index SL ${money(row.indexStop)} · index T1/T2 ${money(row.indexTarget1)} / ${money(row.indexTarget2)}. Index points are not option prices.`));
      card.append(node('p',`${money(row.agreement)}% category agreement from completed-candle analysis; not win probability. Premium levels ${row.monitor?'are frozen at the observed trigger':'update until confirmation'}.`));
      if(row.triggeredAt)card.append(node('p','Observed trigger '+new Date(row.triggeredAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})+' IST · no fill assumed.'));
    }
    card.append(node('small','Exit: premium bid hits SL/T2, index invalidation, or confluence loss. T1 suggests a partial exit; time exit 30 minutes after trigger or 15:15 IST. Verify and execute in your broker.'));
    grid.append(card);
  }
  container.append(grid,node('p','Full strategy categories refresh with five-minute snapshots. Live ticks confirm a newly completed five-minute breakout and monitor levels; indicators are not recalculated on every tick. Disconnects and closed tabs end monitoring. Amounts exclude fees and slippage; stop execution is not guaranteed and the entire premium can be lost.'));
}
