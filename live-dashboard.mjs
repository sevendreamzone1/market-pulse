import {renderLivePanel} from './live-panel.mjs';
import {LiveSetups} from './live-setups.mjs';
const panel=document.getElementById('live-setups');
let last=null,received=0,source=null,snapshot={items:[],options:[]};
const offline=new LiveSetups();
function render(){
  const connected=last?.connected&&Date.now()-received<=5000&&Date.now()-last.sentAt<=5000;
  renderLivePanel(panel,connected?last.rows:offline.evaluate(snapshot,false),connected);
  globalThis.dispatchEvent(new CustomEvent('marketpulse-quotes',{detail:connected?last.quotes:[]}));
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
