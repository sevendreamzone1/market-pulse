// Exercise the actual app without network requests or third-party chart code.
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const elements = new Map();
class Element {
  constructor(){this.textContent='';this.innerHTML='';this.value='';this.children=[];this.listeners={};this.style={};this.dataset={};this.disabled=false;this.classList={toggle(){}};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
  querySelector(){return null;}
  setAttribute(){}
}
const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(){return new Element();},querySelectorAll(){return [];},hidden:false};
document.getElementById('signal-filter').value='all';
const source=readFileSync(path.join(__dirname,'../app.js'),'utf8').replaceAll('import.meta.url',JSON.stringify('https://example.github.io/market-pulse/app.js'));
const html=readFileSync(path.join(__dirname,'../index.html'),'utf8');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
for(const match of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(match[1]),'Missing HTML element: '+match[1]);
const fixture={generated_at:new Date().toISOString(),items:[]};
const context=vm.createContext({document,Intl,Date,URL,AbortSignal,setInterval(){},setTimeout(){},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>fixture}),console});
vm.runInContext(source,context);
(async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(elements.get('data-notice').textContent,/Waiting for the first snapshot/);
  assert.match(elements.get('watchlist').innerHTML,/RELIANCE/);
  assert.doesNotMatch(elements.get('watchlist').innerHTML,/1282/);
  elements.get('demo-toggle').listeners.click();
  assert.match(elements.get('data-notice').textContent,/DEMO MODE/);
  assert.match(elements.get('signal-grid').innerHTML,/Bullish · DEMO/);
  assert.equal(elements.get('refresh').disabled,true);
  elements.get('search').value='Infosys';elements.get('search').listeners.input();
  assert.match(elements.get('watchlist').innerHTML,/Infosys/);
  assert.doesNotMatch(elements.get('watchlist').innerHTML,/Reliance Industries/);
  elements.get('signal-filter').value='Bearish';elements.get('signal-filter').listeners.change();
  assert.match(elements.get('signal-grid').innerHTML,/Bearish · DEMO/);
  assert.doesNotMatch(elements.get('signal-grid').innerHTML,/Bullish · DEMO/);
  elements.get('demo-toggle').listeners.click();await new Promise(resolve=>setImmediate(resolve));
  elements.get('signal-filter').value='all';elements.get('search').value='';
  vm.runInContext(`snapshot={items:[{ticker:'RELIANCE.NS',price:1200,signal:'Bullish',reason:'Never show stale recommendation',candle_end:'2020-01-01T00:00:00Z'}]};render()`,context);
  assert.match(elements.get('signal-grid').innerHTML,/Signal withheld/);
  assert.doesNotMatch(elements.get('signal-grid').innerHTML,/Never show stale recommendation/);
  vm.runInContext(`snapshot.items[0].candle_end=new Date(Date.now()+600000).toISOString();render()`,context);
  assert.match(elements.get('signal-grid').innerHTML,/Signal withheld/);
  vm.runInContext(`snapshot.items[0].candle_end=new Date(Date.now()-60000).toISOString();snapshot.items[0].reason='<img src=x onerror=alert(1)>';snapshot.items[0].source='Upstox API v3';render()`,context);
  assert.match(elements.get('signal-grid').innerHTML,/&lt;img/);
  assert.doesNotMatch(elements.get('signal-grid').innerHTML,/<img/);
  assert.match(elements.get('signal-grid').innerHTML,/Upstox API v3/);
  vm.runInContext(`snapshot.feed={preferred:'upstox',active:'yahoo',status:'awaiting_credentials'};render()`,context);
  assert.match(elements.get('data-notice').textContent,/Upstox connection pending/);
  vm.runInContext(`snapshot.feed={preferred:'upstox',active:'upstox',status:'configured'};render()`,context);
  assert.doesNotMatch(elements.get('data-notice').textContent,/Upstox connection pending/);
  elements.get('tab-options').listeners.click();
  assert.equal(elements.get('overview-panel').hidden,true);
  assert.equal(elements.get('options-panel').hidden,false);
  vm.runInContext(`analysisWindow=()=>true;snapshot.options=[{ticker:'^NSEI',status:'conditional',side:'CE',reason:'Fixture bullish',entry:25000,stop:24950,target1:25050,target2:25100,candle_end:new Date(Date.now()-60000).toISOString(),premium:{status:'unavailable',reason:'No quote fixture'}}];render()`,context);
  assert.match(elements.get('options-grid').innerHTML,/CE SETUP/);
  assert.match(elements.get('options-grid').innerHTML,/25,050.00/);
  assert.match(elements.get('options-grid').innerHTML,/No quote fixture/);
  vm.runInContext(`snapshot.options[0].strategy_report={consensus:{bullish_categories:5,bearish_categories:1,agreement_pct:62.5,available_categories:8},rows:[{category:'Trend indicators',name:'EMA 9/21/50/200',vote:1,state:'Bullish',reason:'Fixture stack',values:{ema200:24900}},{category:'Volume',name:'OBV',vote:null,state:'Unavailable',reason:'No index volume',values:{}}]};render()`,context);
  assert.match(elements.get('options-grid').innerHTML,/EMA 9\/21\/50\/200/);
  assert.match(elements.get('options-grid').innerHTML,/No index volume/);
  assert.match(elements.get('options-grid').innerHTML,/not win probability/);
  vm.runInContext(`snapshot.options[0].candle_end='2020-01-01T00:00:00Z';render()`,context);
  assert.doesNotMatch(elements.get('options-grid').innerHTML,/25,050.00/);
  assert.match(elements.get('options-grid').innerHTML,/STALE ANALYSIS/);
  assert.doesNotMatch(elements.get('options-grid').innerHTML,/Fixture stack/);
  vm.runInContext(`snapshot.options[0].candle_end=new Date(Date.now()-60000).toISOString();snapshot.options[0].status='no_trade';snapshot.options[0].reason='Fresh category disagreement';render()`,context);
  assert.match(elements.get('options-grid').innerHTML,/NO TRADE/);
  assert.match(elements.get('options-grid').innerHTML,/Fresh category disagreement/);
  vm.runInContext(`snapshot.options[0].status='conditional';render()`,context);
  vm.runInContext(`analysisWindow=()=>false;render()`,context);
  assert.match(elements.get('options-grid').innerHTML,/No new entry outside/);
  elements.get('tab-overview').listeners.click();
  assert.equal(elements.get('options-panel').hidden,true);
  vm.runInContext(`liveQuotes=new Map([['NSE_INDEX|Nifty 50',{key:'NSE_INDEX|Nifty 50',ltp:25321.25,cp:25000,ltt:Date.now(),receivedAt:Date.now()}]]);render(true)`,context);
  assert.match(elements.get('indices').innerHTML,/25,321.25/);
  assert.match(elements.get('indices').innerHTML,/LIVE/);
  vm.runInContext(`liveQuotes.get('NSE_INDEX|Nifty 50').receivedAt=Date.now()-6000;render(true)`,context);
  assert.doesNotMatch(elements.get('indices').innerHTML,/25,321.25/);
  console.log('Dashboard smoke checks passed: empty state, demo isolation, filters, stale/future suppression, escaping.');
})().catch(error=>{console.error(error);process.exitCode=1;});
