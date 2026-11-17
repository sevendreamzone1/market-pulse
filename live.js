import {decodeFeed,validatedSocketURL,quoteStatus} from './live-feed.mjs';
import {LiveSetups} from './live-setups.mjs';
import {renderLivePanel} from './live-panel.mjs';
const analysis=new LiveSetups();
let marketSnapshot={items:[],options:[]},snapshotLoading=false;
const channel='BroadcastChannel' in globalThis?new BroadcastChannel('marketpulse-live-v1'):null;
const source=crypto.randomUUID();let lastPublish=0;
const $=id=>document.getElementById(id);
const instruments=new Map([['NSE_INDEX|Nifty 50','NIFTY 50'],['NSE_INDEX|Nifty Bank','BANK NIFTY'],['BSE_INDEX|SENSEX','SENSEX']]);
const quotes=new Map();let socket=null,controller=null,attempt=0,packetAt=0,lastType=0,lastRender=0,instrumentLoad=Promise.resolve();
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value):'—';
const when=value=>Number.isFinite(value)&&value>0?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value)):'Unavailable';
function status(message,state=''){const node=$('connection-status');node.textContent=message;node.className='status '+state;}
function render(){
  lastRender=Date.now();
  const connected=socket?.readyState===WebSocket.OPEN;
  const rows=analysis.evaluate(marketSnapshot,connected);
  renderLivePanel($('live-setups'),rows,connected);
  if(Date.now()-lastPublish>=1000||!connected){lastPublish=Date.now();channel?.postMessage({type:'marketpulse-live-v1',source,sentAt:Date.now(),connected,rows,quotes:[...analysis.quotes.values()].filter(q=>q.live)});}
  const body=$('quote-rows');body.replaceChildren();
  for(const [key,label] of instruments){
    const quote=quotes.get(key),row=document.createElement('tr');
    const name=document.createElement('td');name.textContent=label;const sub=document.createElement('small');sub.textContent=key;name.append(sub);row.append(name);
    const price=document.createElement('td');price.textContent=number(quote?.ltp);row.append(price);
    const change=document.createElement('td');const pct=quote?.cp>0?(quote.ltp/quote.cp-1)*100:null;change.textContent=pct===null?'—':(pct>=0?'+':'')+number(pct)+'%';change.className=pct===null?'':pct>=0?'positive':'negative';row.append(change);
    const time=document.createElement('td');time.textContent=when(quote?.ltt);row.append(time);
    const freshness=document.createElement('td');freshness.textContent=quoteStatus(quote);freshness.className=freshness.textContent==='Fresh trade'?'positive':'stale';row.append(freshness);body.append(row);
  }
  $('packet-time').textContent=packetAt?'Last packet received '+when(packetAt)+' IST':'Waiting for a connection';
  if(socket?.readyState===WebSocket.OPEN&&packetAt){
    if(Date.now()-packetAt>15000)status('Connected · no quote packet for 15 seconds. Check individual exchange trade timestamps.');
    else status(lastType===1?'Receiving broker updates · verify each trade timestamp.':'Connected · initial quote snapshot received; waiting for market updates.',lastType===1?'receiving':'');
  }
}
function stop(message='Disconnected · session cleared.'){
  attempt++;controller?.abort();controller=null;
  if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;socket.close();socket=null;}
  quotes.clear();analysis.clear();packetAt=0;$('credential').value='';$('connect').disabled=false;$('disconnect').disabled=true;status(message);render();
}
$('credential-mode').addEventListener('change',()=>{
  $('credential').value='';const token=$('credential-mode').value==='token';
  $('credential-label').textContent=token?'Access token (not your API key)':'One-time Upstox authorized WebSocket URL';
  $('credential-help').textContent=token?'Use your own current access token. The GitHub Actions secret cannot be read by this browser.':'Get authorized_redirect_uri from Upstox’s official V3 authorize endpoint. The URL is a private single-use credential.';
});
$('disconnect').addEventListener('click',()=>stop());
$('connection-form').addEventListener('submit',async event=>{
  event.preventDefault();let credential=$('credential').value.trim();const mode=$('credential-mode').value;
  if(!credential)return;stop('Connecting to Upstox…');const ownAttempt=attempt;
  $('connect').disabled=true;$('disconnect').disabled=false;
  try{
    await instrumentLoad;
    if(ownAttempt!==attempt)return;
    let url;
    if(mode==='socket'){url=validatedSocketURL(credential);credential='';}
    else{
      controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),15000);
      let response;
      try{response=await fetch('https://api.upstox.com/v3/feed/market-data-feed/authorize',{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+credential},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});}
      finally{credential='';clearTimeout(timer);}
      if(ownAttempt!==attempt)return;
      if(!response.ok)throw Error(response.status===401||response.status===403?'Upstox rejected the access token or feed permissions. Renew the token.':'Upstox authorization returned HTTP '+response.status+'.');
      const data=await response.json();url=validatedSocketURL(data?.data?.authorized_redirect_uri);
    }
    if(ownAttempt!==attempt)return;
    const current=new WebSocket(url);url='';socket=current;current.binaryType='arraybuffer';
    const openingTimer=setTimeout(()=>{if(ownAttempt===attempt&&current.readyState!==WebSocket.OPEN)stop('Connection timed out. Obtain a new authorized URL or retry with a current token.');},15000);
    current.onopen=()=>{clearTimeout(openingTimer);if(ownAttempt!==attempt)return;current.send(new TextEncoder().encode(JSON.stringify({guid:crypto.randomUUID(),method:'sub',data:{mode:'full',instrumentKeys:[...instruments.keys()]}})));status('Connected · subscription sent; waiting for broker quotes.');};
    current.onmessage=event=>{if(ownAttempt!==attempt)return;try{if(typeof event.data==='string'){status('Broker returned a text response rather than quote data. Verify feed access.','error');return;}const data=decodeFeed(event.data);lastType=data.type;analysis.ingest(data.quotes,data.type);if(data.quotes.length){packetAt=Date.now();for(const quote of data.quotes){if(!instruments.has(quote.key))continue;const previous=quotes.get(quote.key);if(!previous||!previous.ltt||!quote.ltt||quote.ltt>=previous.ltt)quotes.set(quote.key,quote);}if(Date.now()-lastRender>=250)render();}}catch{stop('Could not decode the broker feed. Quotes cleared; reconnect after checking provider compatibility.');}};
    current.onerror=()=>{if(ownAttempt===attempt)stop('WebSocket connection failed. Check connectivity, token expiry, broker connection limits, and feed permissions.');};
    current.onclose=()=>{if(ownAttempt===attempt)stop('Broker disconnected. Quotes cleared; enter a current token or new one-time URL to reconnect.');};
  }catch(error){credential='';if(ownAttempt!==attempt)return;stop();if(mode==='token'&&(error instanceof TypeError||error.name==='AbortError'))$('socket-help').open=true;status(error instanceof TypeError||error.name==='AbortError'?'Browser authorization could not complete (network, timeout, or CORS). Open the PowerShell instructions under How it works, then select One-time authorized WebSocket URL. This page cannot bypass broker CORS.':error.message,'error');}
  finally{credential='';$('credential').value='';}
});
async function loadInstruments(){
  if(snapshotLoading)return;snapshotLoading=true;
  try{const response=await fetch('./data/market.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const data=await response.json();marketSnapshot=data;
    const desired=new Map([['NSE_INDEX|Nifty 50','NIFTY 50'],['NSE_INDEX|Nifty Bank','BANK NIFTY'],['BSE_INDEX|SENSEX','SENSEX']]);
    for(const item of data.items||[]){if(typeof item.instrument_key==='string'&&/^(NSE|BSE)_(EQ|INDEX)\|[^\s]+/.test(item.instrument_key))desired.set(item.instrument_key,item.ticker);}
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    for(const row of data.options||[]){const premium=row.premium;if(premium?.instrument_key&&premium.expiry>=today)desired.set(premium.instrument_key,premium.trading_symbol||premium.instrument_key);}
    for(const state of analysis.active.values())if(!state.exit)desired.set(state.key,state.contract);
    const added=[...desired.keys()].filter(key=>!instruments.has(key)),removed=[...instruments.keys()].filter(key=>!desired.has(key));
    for(const key of removed){instruments.delete(key);quotes.delete(key);analysis.quotes.delete(key);}
    for(const [key,label] of desired)instruments.set(key,label);
    if(socket?.readyState===WebSocket.OPEN){for(const [method,keys] of [['unsub',removed],['sub',added]])if(keys.length)socket.send(new TextEncoder().encode(JSON.stringify({guid:crypto.randomUUID(),method,data:{mode:'full',instrumentKeys:keys}})));}
  }catch{/* Existing metadata expires by its original timestamps. */}
  finally{snapshotLoading=false;}
  render();
}
globalThis.addEventListener('pagehide',()=>{stop();channel?.close();});
render();instrumentLoad=loadInstruments();setInterval(render,1000);setInterval(loadInstruments,60000);
