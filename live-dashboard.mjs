import {renderLivePanel} from './live-panel.mjs';
import {LiveSetups,indexKeys,indexNames} from './live-setups.mjs';
const panel=document.getElementById('live-setups');
let last=null,received=0,source=null,snapshot={items:[],options:[]};
const offline=new LiveSetups();
function renderHomeQuotes(quotes,connected){
  const body=document.getElementById('home-live-rows'),status=document.getElementById('home-live-status');
  if(!body||!status)return;
  const names=new Map(Object.entries(indexKeys).map(([ticker,key])=>[key,indexNames[ticker]]));
  for(const item of snapshot.items)if(typeof item.instrument_key==='string')names.set(item.instrument_key,item.name||item.ticker||item.instrument_key);
  for(const row of last?.rows||[])if(row.key&&row.contract)names.set(row.key,row.contract);
  for(const row of snapshot.options||[])if(row.premium?.instrument_key)names.set(row.premium.instrument_key,row.premium.trading_symbol||row.premium.instrument_key);
  const byKey=new Map(quotes.map(q=>[q.key,q]));
  for(const key of byKey.keys())if(!names.has(key))names.set(key,key);
  const number=value=>new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  body.replaceChildren();
  for(const [key,name] of names){
    const quote=byKey.get(key),row=document.createElement('tr');
    const change=quote&&Number.isFinite(quote.cp)&&quote.cp>0?(quote.ltp/quote.cp-1)*100:null;
    const pct=Number.isFinite(change)?change:null;
    const time=quote?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(quote.ltt)):'—';
    for(const [value,cls] of [[name,''],[quote?number(quote.ltp):'—',''],[pct===null?'—':(pct>=0?'+':'')+number(pct)+'%',pct===null?'':pct>=0?'positive':'negative'],[time,''],[quote?'Fresh trade':connected?'Waiting for fresh trade':'Disconnected',quote?'positive':'muted']]){
      const cell=document.createElement('td');cell.textContent=value;cell.className=cls;row.append(cell);
    }
    body.append(row);
  }
  status.textContent=quotes.length?'LIVE · '+quotes.length+' '+(quotes.length===1?'instrument':'instruments')+' with fresh trades. Prices update automatically.':connected?'Live tab connected · waiting for fresh broker trades. Old or initial quotes are not shown as live.':'Live feed disconnected · open Connect live feed, authorize Upstox, and keep that tab open. Snapshot prices remain labeled below.';
}
function render(){
  const connected=last?.connected&&Date.now()-received<=5000&&Date.now()-last.sentAt<=5000;
  const now=Date.now();
  const quotes=connected?last.quotes.filter(q=>q&&typeof q.key==='string'&&q.live===true&&Number.isFinite(q.ltp)&&q.ltp>0&&Number.isFinite(q.ltt)&&now-q.ltt>=0&&now-q.ltt<=30000&&Number.isFinite(q.receivedAt)&&now-q.receivedAt>=0&&now-q.receivedAt<=5000):[];
  renderLivePanel(panel,connected?last.rows:offline.evaluate(snapshot,false),connected);
  renderHomeQuotes(quotes,connected);
  globalThis.dispatchEvent(new CustomEvent('marketpulse-quotes',{detail:quotes}));
}
globalThis.addEventListener('marketpulse-snapshot',event=>{if(event.detail&&Array.isArray(event.detail.items)){snapshot=event.detail;render();}});
if('BroadcastChannel' in globalThis){
  const channel=new BroadcastChannel('marketpulse-live-v1');
  channel.onmessage=({data})=>{
    if(data?.type!=='marketpulse-live-v1'||typeof data.source!=='string'||!Number.isFinite(data.sentAt)||Date.now()-data.sentAt>5000||data.sentAt>Date.now()+1000||!Array.isArray(data.rows)||!Array.isArray(data.quotes))return;
    if(source&&data.source!==source&&Date.now()-received<=5000)return;
    source=data.source;last=data;received=Date.now();render();
  };
  globalThis.addEventListener('pagehide',()=>channel.close());
}
render();globalThis.dispatchEvent(new CustomEvent('marketpulse-request-snapshot',{detail:null}));setInterval(render,1000);
