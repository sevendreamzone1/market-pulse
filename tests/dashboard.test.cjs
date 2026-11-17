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
  vm.runInContext(`snapshot.items[0].candle_end=new Date(Date.now()-60000).toISOString();snapshot.items[0].reason='<img src=x onerror=alert(1)>';render()`,context);
  assert.match(elements.get('signal-grid').innerHTML,/&lt;img/);
  assert.doesNotMatch(elements.get('signal-grid').innerHTML,/<img/);
  console.log('Dashboard smoke checks passed: empty state, demo isolation, filters, stale/future suppression, escaping.');
})().catch(error=>{console.error(error);process.exitCode=1;});
