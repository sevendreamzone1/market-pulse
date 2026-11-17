// Minimal LTPC decoder for Upstox's official V3 Protobuf schema:
// https://github.com/upstox/upstox-python/blob/master/upstox_client/feeder/proto/MarketDataFeedV3.proto
// LTPC and full feeds. Unknown fields are skipped with bounds checks.
function fields(bytes){
  const result=[];let pos=0;
  const varint=()=>{let value=0n,shift=0n;for(let i=0;i<10;i++){if(pos>=bytes.length)throw Error('Truncated varint');const b=bytes[pos++];value|=BigInt(b&127)<<shift;if(!(b&128)){if(value>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Unsafe integer');return Number(value);}shift+=7n;}throw Error('Invalid varint');};
  while(pos<bytes.length){const tag=varint(),number=Math.floor(tag/8),wire=tag&7;if(!number)throw Error('Invalid tag');let value;
    if(wire===0)value=varint();
    else if(wire===1){if(pos+8>bytes.length)throw Error('Truncated fixed64');value=new DataView(bytes.buffer,bytes.byteOffset+pos,8).getFloat64(0,true);pos+=8;}
    else if(wire===2){const size=varint();if(size>bytes.length-pos)throw Error('Truncated bytes');value=bytes.subarray(pos,pos+size);pos+=size;}
    else if(wire===5){if(pos+4>bytes.length)throw Error('Truncated fixed32');pos+=4;continue;}
    else throw Error('Unsupported wire type');
    result.push({number,wire,value});
  }return result;
}
export function decodeFeed(buffer){
  const root=fields(buffer instanceof Uint8Array?buffer:new Uint8Array(buffer));
  const quotes=[];let currentTs=null,type=0;
  for(const field of root){
    if(field.number===1&&field.wire===0)type=field.value;
    if(field.number===3&&field.wire===0)currentTs=field.value;
    if(field.number!==2||field.wire!==2)continue;
    let key,feed;
    for(const entry of fields(field.value)){if(entry.number===1&&entry.wire===2)key=new TextDecoder('utf-8',{fatal:true}).decode(entry.value);if(entry.number===2&&entry.wire===2)feed=entry.value;}
    if(!key||!feed)continue;
    const feedFields=fields(feed);let container=feedFields,market=false;
    const full=feedFields.find(f=>f.number===2&&f.wire===2);
    if(full){const union=fields(full.value).find(f=>[1,2].includes(f.number)&&f.wire===2);if(!union)continue;container=fields(union.value);market=union.number===1;}
    const ltpc=container.find(f=>f.number===1&&f.wire===2);
    if(!ltpc)continue;
    const quote={key,ltp:null,ltt:null,ltq:0,cp:null};
    for(const item of fields(ltpc.value)){
      if(item.number===1&&item.wire===1)quote.ltp=item.value;
      if(item.number===2&&item.wire===0)quote.ltt=item.value;
      if(item.number===3&&item.wire===0)quote.ltq=item.value;
      if(item.number===4&&item.wire===1)quote.cp=item.value;
    }
    if(market){
      const level=container.find(f=>f.number===2&&f.wire===2);
      const first=level&&fields(level.value).find(f=>f.number===1&&f.wire===2);
      if(first){
        const depth=fields(first.value),get=(n,w)=>depth.find(f=>f.number===n&&f.wire===w)?.value;
        quote.bidQty=get(1,0)??0;quote.bid=get(2,1)??0;quote.askQty=get(3,0)??0;quote.ask=get(4,1)??0;
      }
      quote.volume=container.find(f=>f.number===6&&f.wire===0)?.value??0;
    }
    if(Number.isFinite(quote.ltp)&&quote.ltp>0)quotes.push(quote);
  }return {quotes,currentTs,type};
}
export function validatedSocketURL(value){
  const url=new URL(value);
  if(url.protocol!=='wss:'||!url.hostname.endsWith('.upstox.com')||url.username||url.password||url.hash)throw Error('Use an official Upstox secure WebSocket URL.');
  return url.href;
}
export function quoteStatus(quote,now=Date.now()){
  if(!quote)return 'Waiting';
  const age=now-quote.ltt;
  if(!Number.isFinite(quote.ltt)||quote.ltt<=0)return 'Trade time unavailable';
  if(age< -5000)return 'Invalid future trade time';
  return age<=30000?'Fresh trade':'Stale trade';
}
