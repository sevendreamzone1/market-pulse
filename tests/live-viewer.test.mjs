import assert from 'node:assert/strict';
class Element{
  constructor(){this.textContent='';this.value='';this.children=[];this.listeners={};this.disabled=false;this.className='';}
  addEventListener(name,fn){this.listeners[name]=fn;}
  append(...values){this.children.push(...values);}
  replaceChildren(){this.children=[];}
}
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(){return new Element();}};
const pageEvents={};globalThis.addEventListener=(name,fn)=>{pageEvents[name]=fn;};
const realInterval=globalThis.setInterval;globalThis.setInterval=()=>0;
const sockets=[];
class Socket{
  static OPEN=1;static CONNECTING=0;static CLOSED=3;
  constructor(url){this.url=url;this.readyState=0;sockets.push(this);}
  send(bytes){this.sent=bytes;}
  close(){this.readyState=3;this.closed=true;}
}
globalThis.WebSocket=Socket;
const calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>String(url).includes('/authorize')?{data:{authorized_redirect_uri:'wss://wsfeed.upstox.com/feed?code=fixture'}}:{items:[{ticker:'RELIANCE.NS',instrument_key:'NSE_EQ|FIXTURE'}],options:[]}};};
await import('../live.js');
const $=id=>document.getElementById(id);
const submit=()=>$('connection-form').listeners.submit({preventDefault(){}});
$('credential-mode').value='socket';$('credential').value='wss://wsfeed.upstox.com/feed?code=fixture';
await submit();assert.equal(sockets.length,1);assert.equal($('credential').value,'');
const current=sockets[0];current.readyState=1;current.onopen();
const subscription=JSON.parse(new TextDecoder().decode(current.sent));
assert.equal(subscription.method,'sub');assert.equal(subscription.data.mode,'ltpc');
assert.ok(subscription.data.instrumentKeys.includes('NSE_EQ|FIXTURE'));
assert.ok(current.sent instanceof Uint8Array);
assert.match($('connection-status').textContent,/waiting for broker quotes/);
$('disconnect').listeners.click();assert.equal(current.closed,true);assert.equal($('disconnect').disabled,true);
assert.match($('packet-time').textContent,/Waiting for a connection/);
$('credential-mode').value='token';$('credential').value='fixture-token-not-real';await submit();
const request=calls.find(call=>String(call.url).includes('/authorize'));
assert.equal(request.options.headers.Authorization,'Bearer fixture-token-not-real');
assert.equal(request.options.credentials,'omit');assert.equal($('credential').value,'');
assert.equal(sockets.length,2);const authorized=sockets[1];authorized.readyState=1;authorized.onopen();
authorized.onmessage({data:new Uint8Array([18,99]).buffer});
assert.equal(authorized.closed,true);assert.match($('connection-status').textContent,/Could not decode/);
$('credential-mode').value='socket';$('credential').value='wss://evil.example/feed';await submit();
assert.equal(sockets.length,2);assert.match($('connection-status').textContent,/official Upstox/);
assert.equal($('credential').value,'');
pageEvents.pagehide();assert.match($('connection-status').textContent,/session cleared/);
globalThis.setInterval=realInterval;
console.log('Live viewer checks passed: binary subscription, metadata loading, direct authorization, credential clearing, disconnect, malformed-feed handling, and host validation.');
