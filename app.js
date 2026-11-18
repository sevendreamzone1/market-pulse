const universe = [
  {symbol:'NSE:RELIANCE',ticker:'RELIANCE.NS',name:'Reliance Industries',exchange:'NSE'},
  {symbol:'NSE:TCS',ticker:'TCS.NS',name:'Tata Consultancy Services',exchange:'NSE'},
  {symbol:'NSE:HDFCBANK',ticker:'HDFCBANK.NS',name:'HDFC Bank',exchange:'NSE'},
  {symbol:'NSE:INFY',ticker:'INFY.NS',name:'Infosys',exchange:'NSE'},
  {symbol:'NSE:ICICIBANK',ticker:'ICICIBANK.NS',name:'ICICI Bank',exchange:'NSE'},
  {symbol:'NSE:BHARTIARTL',ticker:'BHARTIARTL.NS',name:'Bharti Airtel',exchange:'NSE'},
  {symbol:'BSE:SBIN',ticker:'SBIN.BO',name:'State Bank of India',exchange:'BSE'},
  {symbol:'BSE:ITC',ticker:'ITC.BO',name:'ITC',exchange:'BSE'},
];
const indices = [{ticker:'^NSEI',name:'NIFTY 50',exchange:'NSE'},{ticker:'^NSEBANK',name:'BANK NIFTY',exchange:'NSE'},{ticker:'^BSESN',name:'SENSEX',exchange:'BSE'}];
const $ = id => document.getElementById(id);
const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value) : '—';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))+' IST' : 'Unavailable';
let snapshot = {items:[]}, selected = universe[0], exchange = 'ALL', demo = false, previousSnapshot = null, refreshing = false, widgetTimer;
const fresh = item => { const age=Date.now()-Date.parse(item?.candle_end); return Number.isFinite(age) && age>=0 && age<=20*60*1000; };
let liveQuotes=new Map();
const rawFind=ticker=>snapshot.items.find(item=>item.ticker===ticker);
function find(ticker){
  const item=rawFind(ticker);if(demo)return item;
  const canonical={'^NSEI':'NSE_INDEX|Nifty 50','^NSEBANK':'NSE_INDEX|Nifty Bank','^BSESN':'BSE_INDEX|SENSEX'};
  const quote=liveQuotes.get(item?.instrument_key||canonical[ticker]);
  const age=Date.now()-quote?.ltt,received=Date.now()-quote?.receivedAt;
  if(!quote||!Number.isFinite(quote.ltp)||quote.ltp<=0||!Number.isFinite(age)||age<0||age>30000||!Number.isFinite(received)||received<0||received>5000)return item;
  return {...item,price:quote.ltp,change_pct:quote.cp>0?(quote.ltp/quote.cp-1)*100:null,live:true,trade_time:new Date(quote.ltt).toISOString()};
}
globalThis.addEventListener?.('marketpulse-quotes',event=>{liveQuotes=new Map((event.detail||[]).filter(q=>q&&typeof q.key==='string').map(q=>[q.key,q]));render(true);});
function publishSnapshot(){if(typeof CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('marketpulse-snapshot',{detail:demo?(previousSnapshot||{items:[]}):snapshot}));}
globalThis.addEventListener?.('marketpulse-request-snapshot',publishSnapshot);
function change(item){if(!Number.isFinite(item?.change_pct))return '<span>Change unavailable</span>';const positive=item.change_pct>=0;return `<span class="${positive?'positive':'negative'}">${positive?'↗ +':'↘ '}${item.change_pct.toFixed(2)}% <span class="muted">vs prev. close</span></span>`;}
function tick(){
  $('clock').textContent = new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())+' IST';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const minute=Number(parts.hour)*60+Number(parts.minute), open=!['Sat','Sun'].includes(parts.weekday)&&minute>=555&&minute<930;
  $('session').textContent = open?'● Regular session*':'○ Outside regular hours*';
  $('session').title = 'Weekdays 09:15–15:30 IST. Exchange holidays and special sessions are not checked.';
}
function render(pricesOnly=false){
  $('live-setups').hidden=demo;
  if(pricesOnly!==true)renderOptions();
  $('indices').innerHTML=indices.map(index=>{const item=find(index.ticker);const closes=item?.recent_closes?.filter(Number.isFinite)||[];let spark='';if(closes.length>1){const min=Math.min(...closes),range=Math.max(...closes)-min||1;const points=closes.map((v,i)=>`${i/(closes.length-1)*85},${32-(v-min)/range*28}`).join(' ');spark=`<svg viewBox="0 0 85 35" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${item.change_pct>=0?'#91d8ae':'#f19c92'}" stroke-width="1.5"/></svg>`;}return `<div class="index-card"><div class="index-top"><span>${index.name}</span><span>${index.exchange}</span></div><div class="index-price">${money(item?.price)}</div><div class="index-change">${change(item)}</div>${spark}<div class="signal-time">${item?.live?'LIVE · '+dateTime(item.trade_time):item?(demo?'DEMO · ':'')+dateTime(item.candle_end):'Awaiting first snapshot'}${item&&!fresh(item)?' · strategy snapshot stale':''}</div></div>`;}).join('');
  const stocks=universe.filter(stock=>(exchange==='ALL'||stock.exchange===exchange)&&`${stock.name} ${stock.symbol}`.toLowerCase().includes($('search').value.toLowerCase().trim()));
  $('watch-count').textContent=stocks.length;
  $('watchlist').innerHTML=stocks.length?stocks.map(stock=>{const item=find(stock.ticker);return `<button class="stock-row ${selected.symbol===stock.symbol?'current':''}" data-symbol="${stock.symbol}" aria-label="View ${stock.name} chart"><span><span class="stock-name">${stock.symbol.split(':')[1]}</span><span class="stock-sub">${stock.name} · ${stock.exchange}</span></span><span class="stock-price">${money(item?.price)}<small>${change(item)}</small><small class="muted">${item?(demo?'DEMO':item.live?'Live API quote':fresh(item)?'Snapshot':'Stale snapshot'):'Awaiting data'}</small></span></button>`;}).join(''):'<div class="empty">No matching companies.</div>';
  const filter=$('signal-filter').value;
  const cards=universe.map(stock=>({stock,item:find(stock.ticker)})).filter(({item})=>filter==='all'||((demo||fresh(item))&&item?.signal===filter));
  $('signal-grid').innerHTML=cards.length?cards.map(({stock,item})=>{
    const usable=item&&(demo||fresh(item))&&item.signal, label=usable?item.signal:item?'Stale data':'Awaiting data';
    return `<article class="signal-card"><div class="signal-top"><span class="signal-symbol">${stock.symbol.split(':')[1]}</span><span class="pill ${usable?escape(item.signal):''}">${escape(label)}${demo?' · DEMO':''}</span></div><div class="signal-name">${stock.name} · ${stock.exchange}</div><p class="signal-rule">${usable?escape(item.reason):item?'Signal withheld. Refresh the snapshot and check the candle time before reviewing this setup.':'No market snapshot yet. Run the GitHub deployment workflow to fetch the first dataset.'}</p><div class="indicator-pair"><span>EMA 9 / 21 &nbsp; <strong>${money(item?.ema9)} / ${money(item?.ema21)}</strong></span><span>RSI 14 &nbsp; <strong>${money(item?.rsi14)}</strong></span></div><div class="signal-time">${demo?'DEMO · ':''}Candle ended ${dateTime(item?.candle_end)}${item?.source&&!demo?' · '+escape(item.source):''}</div></article>`;
  }).join(''):'<div class="empty">No fresh signals match this filter. Try All signals or refresh the data.</div>';
  const notice=$('data-notice');notice.classList.toggle('demo',demo);
  if(demo)notice.textContent='DEMO MODE · All prices and signals shown here are fictional examples. The TradingView chart continues to use its own market feed.';
  else if(!snapshot.items.length)notice.textContent='Waiting for the first snapshot. Charts can be explored now; prices and signals will appear after the GitHub workflow fetches market data.';
  else {const count=universe.filter(stock=>fresh(find(stock.ticker))).length;notice.textContent=`Indicative snapshots · ${count} of ${universe.length} stocks have candles within 20 minutes. ${count?'Signals use completed 5-minute candles.':'Signals are withheld until fresh candles arrive.'} Provider data may be delayed.${snapshot.errors?.length?' Some symbols failed to refresh; check the workflow logs.':''}`;}
  if(snapshot.loadError&&!demo)notice.textContent=`Refresh failed: ${snapshot.loadError}. ${snapshot.items.length?'Showing the last loaded snapshot with freshness checks.':'Check the deployment and try again.'}`;
  if(!demo&&snapshot.items.length&&snapshot.source)notice.textContent+=' Feed: '+snapshot.source+'.';
  if(!demo&&snapshot.feed?.preferred==='upstox'&&snapshot.feed.status==='awaiting_credentials')notice.textContent+=' Upstox connection pending; the current feed remains active until connected.';
  $('updated').textContent=demo?'DEMO · Fictional dataset':snapshot.generated_at?'Snapshot built '+dateTime(snapshot.generated_at):'No snapshot loaded';
  $('demo-toggle').textContent=demo?'Leave demo and return to market snapshots →':'Explore with clearly labeled demo data →';
}
function analysisWindow(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const minute=Number(parts.hour)*60+Number(parts.minute);
  return !['Sat','Sun'].includes(parts.weekday)&&minute>=570&&minute<885;
}
function renderOptions(){
  const rows=demo?indices.map((index,i)=>{const item=find(index.ticker);const entry=item.price,stop=entry+(i===1?60:-60);return {ticker:index.ticker,status:i===2?'no_trade':'conditional',side:i===1?'PE':'CE',reason:i===2?'Demo: EMA and RSI do not align; wait for a directional setup.':i===1?'Demo: bearish EMA alignment with RSI 43; wait for downside confirmation.':'Demo: bullish EMA alignment with RSI 58; wait for upside confirmation.',entry,stop,target1:entry+(i===1?-60:60),target2:entry+(i===1?-120:120),candle_end:item.candle_end,premium:{status:'unavailable',reason:'Demo illustrates underlying levels only.'}};}):snapshot.options||[];
  const open=demo||analysisWindow();
  $('options-summary').textContent=demo?'DEMO · Fictional examples; no option-chain quotes.':open?'Five-minute snapshot · Analysis built '+dateTime(snapshot.generated_at)+' · Entry window 09:30–14:45 IST. Confirm current broker prices.':'Outside the new-entry research window. Levels are withheld; time exit remains 15:15 IST. Exchange holidays are not checked.';
  $('options-grid').innerHTML=indices.map(index=>{
    const row=rows.find(r=>r.ticker===index.ticker),item=find(index.ticker);
    const age=Date.now()-Date.parse(row?.candle_end),valid=demo||(Number.isFinite(age)&&age>=0&&age<=600000);
    if(!row||!open||!valid||row.status!=='conditional'){
      const message=!row?'Waiting for the next analysis snapshot.':!valid?'Strategy analysis is stale or has an invalid timestamp. Entry levels are withheld. Run the market-data refresh workflow; live ticks cannot refresh strategy categories.':!open?'No new entry outside 09:30–14:45 IST.':row.reason;
      const label=!row?'WAIT FOR ANALYSIS':!valid?'STALE ANALYSIS':!open?'OUTSIDE ENTRY WINDOW':'NO TRADE';
      return `<article class="panel option-card"><div class="signal-top"><h2>${index.name}</h2><span class="pill">${demo?'DEMO · ':''}${label}</span></div><p class="signal-rule">${escape(message)}</p>${valid?strategyMarkup(row?.strategy_report):''}<div class="signal-time">Index candle ended ${dateTime(row?.candle_end)}</div></article>`;
    }
    const call=row.side==='CE',premium=row.premium,quoteAge=Date.now()-Date.parse(premium?.fetched_at);
    const quoted=!demo&&premium?.status==='available'&&Number.isFinite(quoteAge)&&quoteAge>=0&&quoteAge<=300000;
    const levels=(data,prefix)=>`<dl class="option-levels"><div><dt>${prefix} entry reference</dt><dd>${money(data.entry)}</dd></div><div><dt>Stop / invalidation</dt><dd class="negative">${money(data.stop)}</dd></div><div><dt>Target 1 · 1R</dt><dd class="positive">${money(data.target1)}</dd></div><div><dt>Target 2 · 2R</dt><dd class="positive">${money(data.target2)}</dd></div></dl>`;
    return `<article class="panel option-card"><div class="signal-top"><h2>${index.name}</h2><span class="pill ${call?'Bullish':'Bearish'}">${demo?'DEMO · ':''}${row.side} SETUP</span></div><p class="signal-rule">${escape(row.reason)}</p>${strategyMarkup(row.strategy_report)}<div class="option-caption">UNDERLYING INDEX POINTS · OPTION PREMIUMS BELOW</div>${levels(row,'Index')}<p class="entry-rule"><strong>Conditional buy criterion:</strong> a new completed five-minute candle must close ${call?'above':'below'} ${money(row.entry)} while category confluence remains ${call?'bullish':'bearish'}. Verify again at entry; skip if invalidated first. Wait for a new setup if the move has already run.</p><div class="premium-block"><h3>Option premium scenario</h3>${quoted?`<p>${escape(premium.trading_symbol)} · ${money(premium.strike)} ${row.side}<br>Expiry ${escape(premium.expiry)} · Lot ${escape(premium.lot_size)}</p>${levels(premium,'Ask')}<p>Bid ₹${money(premium.bid)} / ask ₹${money(premium.ask)}. Reference outlay per lot ₹${money(premium.premium_outlay)}; planned stop risk ₹${money(premium.planned_risk)} before costs. Maximum premium loss can be the full outlay.</p><p>${escape(premium.rule)} Recalculate from actual fill. Quote retrieved ${dateTime(premium.fetched_at)}; exchange timestamp unavailable—verify broker quotes before considering entry.</p>`:`<p>${escape(premium?.status==='available'?'Quote retrieval is over five minutes old; premium entry and targets are withheld.':premium?.reason||'Option-chain quotes unavailable.')} Index levels above are not option buy prices.</p>`}</div><div class="exit-rule"><strong>Exit criteria</strong><ul><li>Stop reached or index crosses ${money(row.stop)} ${call?'downward':'upward'}.</li><li>Category confluence reverses or drops below its entry threshold.</li><li>Consider partial exit at T1; remainder at T2.</li><li>30 minutes after entry or 15:15 IST, whichever comes first.</li></ul><p>Exits need live broker monitoring; this dashboard neither tracks fills nor places orders.</p></div><div class="signal-time">${demo?'DEMO · ':''}Index candle ended ${dateTime(row.candle_end)} · ${escape(item?.source||snapshot.source||'Fictional example')}</div></article>`;
  }).join('');
}
function strategyMarkup(report){
  if(!report?.rows?.length)return '<p class="strategy-note">Strategy catalog awaits a new market snapshot. No legacy EMA-only recommendation is inferred.</p>';
  const grouped=new Map();
  for(const row of report.rows){if(!grouped.has(row.category))grouped.set(row.category,[]);grouped.get(row.category).push(row);}
  const result=report.consensus;
  return `<div class="strategy-catalog">${result?`<div class="confluence-score"><strong>${escape(result.bullish_categories)} bullish · ${escape(result.bearish_categories)} bearish</strong><span>${escape(result.agreement_pct)}% category agreement · ${escape(result.available_categories)} available categories</span><small>Agreement measures rule alignment, not win probability. Correlated categories can still share risk.</small></div>`:''}${[...grouped].map(([category,rows])=>`<details><summary>${escape(category)} <span>${rows.filter(r=>r.vote!==null).length}/${rows.length}</span></summary>${rows.map(row=>`<div class="strategy-row"><div><strong>${escape(row.name)}</strong><span class="${row.state==='Bullish'?'positive':row.state==='Bearish'?'negative':''}">${escape(row.state)}</span></div><p>${escape(row.reason)}</p>${Object.keys(row.values||{}).length?`<p class="strategy-values">${Object.entries(row.values).map(([key,value])=>escape(key.replaceAll('_',' '))+': '+escape(Number.isFinite(value)?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(value):'Unavailable')).join(' · ')}</p>`:''}</div>`).join('')}</details>`).join('')}</div>`;
}
function switchView(view){
  const options=view==='options';
  $('view-label').textContent=options?'CE / PE analysis':'Market overview';
  $('overview-panel').hidden=options;$('options-panel').hidden=!options;
  for(const name of ['overview','options']){const active=(name==='options')===options;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).tabIndex=active?0:-1;$('nav-'+name).classList.toggle('active',active);}
}
for(const name of ['overview','options']){
  $('tab-'+name).addEventListener('click',()=>switchView(name));
  $('nav-'+name).addEventListener('click',()=>switchView(name));
  $('tab-'+name).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'overview':event.key==='End'?'options':name==='overview'?'options':'overview';switchView(next);$('tab-'+next).focus();}});
}
$('nav-signals').addEventListener('click',()=>switchView('overview'));
function chart(){
  clearTimeout(widgetTimer);
  $('chart-title').textContent=selected.name+' · '+selected.exchange;
  $('external-chart').href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(selected.symbol);
  const outer=$('tradingview');outer.replaceChildren();
  const container=document.createElement('div');container.className='tradingview-widget-container';
  const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';container.append(widget);
  const copyright=document.createElement('div');copyright.className='tradingview-widget-copyright';const link=document.createElement('a');link.href=$('external-chart').href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Explore '+selected.symbol+' on TradingView ↗';copyright.append(link);container.append(copyright);
  const script=document.createElement('script');script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';script.async=true;script.textContent=JSON.stringify({autosize:true,symbol:selected.symbol,interval:'5',timezone:'Asia/Kolkata',theme:'dark',style:'1',locale:'en',allow_symbol_change:false,calendar:false,hide_side_toolbar:false,support_host:'https://www.tradingview.com',backgroundColor:'#131a1b',gridColor:'rgba(55,65,60,0.3)'});
  const fallback=()=>{if(!container.querySelector('iframe')){widget.textContent='Chart could not load. Use “Open chart” above to view this symbol on TradingView.';widget.style.padding='30px';widget.style.color='#95a2a4';}};
  script.onerror=fallback;container.append(script);outer.append(container);widgetTimer=setTimeout(fallback,18000);
}
async function refresh(){
  if(refreshing||demo)return;refreshing=true;$('refresh').disabled=true;
  try {const response=await fetch(new URL('./data/market.json?v='+Date.now(),import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('HTTP '+response.status);const result=await response.json();if(!Array.isArray(result.items))throw new Error('Invalid snapshot format');if(demo)return;snapshot=result;}
  catch(error){if(!demo)snapshot={...snapshot,loadError:error.message};}
  finally{refreshing=false;$('refresh').disabled=demo;render();publishSnapshot();}
}
function makeDemo(){return {generated_at:null,items:[...universe,...indices].map((stock,i)=>{const price=[1282.4,3548.2,1712.6,1835.8,1280.5,1623.7,825.3,441.8,24850.4,53124.5,81530.8][i];const signal=['Bullish','Bearish','Neutral'][i%3];return {...stock,price,change_pct:[1.24,-.78,.31][i%3],candle_end:'2025-01-06T04:30:00+00:00',ema9:price*(signal==='Bullish'?1.001:.998),ema21:price, rsi14:[58.4,43.2,75.1][i%3],signal,reason:signal==='Bullish'?'EMA 9 is above EMA 21; RSI 14 is between 50 and 70. Upward momentum setup.':signal==='Bearish'?'EMA 9 is below EMA 21; RSI 14 is between 30 and 50. Downward momentum setup.':'Trend and momentum do not meet either directional rule. Wait for alignment.',recent_closes:Array.from({length:20},(_,n)=>price*(1+Math.sin(n*.7)*.002+(n-20)*.0002))};})};}
$('symbol-select').innerHTML=universe.map(stock=>`<option value="${stock.symbol}">${stock.symbol} · ${stock.name}</option>`).join('');
$('symbol-select').addEventListener('change',event=>{selected=universe.find(stock=>stock.symbol===event.target.value);chart();render();});
$('watchlist').addEventListener('click',event=>{const row=event.target.closest('[data-symbol]');if(!row)return;selected=universe.find(stock=>stock.symbol===row.dataset.symbol);$('symbol-select').value=selected.symbol;chart();render();});
document.querySelectorAll('[data-exchange]').forEach(button=>button.addEventListener('click',()=>{exchange=button.dataset.exchange;document.querySelectorAll('[data-exchange]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});render();}));
$('search').addEventListener('input',render);$('signal-filter').addEventListener('change',render);$('refresh').addEventListener('click',refresh);
$('demo-toggle').addEventListener('click',()=>{demo=!demo;if(demo){previousSnapshot=snapshot;snapshot=makeDemo();}else{snapshot=previousSnapshot||{items:[]};previousSnapshot=null;} $('refresh').disabled=demo;render();if(!demo)refresh();});
if(globalThis.location?.hash==='#options')switchView('options');
globalThis.addEventListener?.('hashchange',()=>switchView(globalThis.location.hash==='#options'?'options':'overview'));
tick();render();chart();refresh();setInterval(tick,1000);setInterval(()=>{if(!document.hidden)refresh();},60000);setInterval(render,30000);
