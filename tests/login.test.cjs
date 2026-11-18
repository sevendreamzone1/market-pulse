const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash,webcrypto}=require('node:crypto');
// Test the production flow with fictional account configuration, not the owner's password.
const fixturePassword='fixture-pass-for-tests';
const digest=createHash('sha256').update(fixturePassword).digest('hex');
const source=fs.readFileSync('login.js','utf8')
  .replace(/const LOGIN_USERNAME = '[^']+';/,"const LOGIN_USERNAME = 'owner@example.invalid';")
  .replace(/const PASSWORD_DIGEST = '[^']+';/,`const PASSWORD_DIGEST = '${digest}';`);
const key='marketpulse.ui-session.v2:/market-pulse/';
function page(path='login.html',options={}){
  const elements=new Map();
  for(const id of ['login-form','login-username','login-password','login-submit','login-status','ui-logout'])elements.set(id,{value:'',textContent:'',disabled:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},focus(){this.focused=true;}});
  const store=options.store||new Map(options.session?[[key,String(options.session)]]:[]),redirects=[],timers=[],listeners={};
  const document={readyState:'complete',documentElement:{hidden:false},getElementById:id=>elements.get(id),addEventListener(){}};
  const storage={getItem(k){if(options.blockStorage)throw Error('Unavailable');return store.get(k)??null;},setItem(k,v){if(options.blockStorage)throw Error('Unavailable');store.set(k,v);},removeItem(k){store.delete(k);}};
  const context=vm.createContext({URL,Date,Number,TextEncoder,Uint8Array,crypto:webcrypto,document,localStorage:storage,addEventListener:(name,fn)=>{listeners[name]=fn;},clearTimeout(){},location:{href:'https://example.github.io/market-pulse/'+path,replace:url=>redirects.push(url)},setTimeout:(fn,ms)=>timers.push({fn,ms})});
  vm.runInContext(source,context);
  return {elements,store,redirects,timers,document,listeners,async submit(username,password){elements.get('login-username').value=username;elements.get('login-password').value=password;await elements.get('login-form').listeners.submit({preventDefault(){}});}};
}
(async()=>{
  let p=page('index.html#options');assert.equal(p.document.documentElement.hidden,true);assert.match(p.redirects[0],/login\.html\?next=index\.html%23options$/);
  p=page('live.html');assert.match(p.redirects[0],/next=live\.html$/);
  p=page('index.html',{session:Date.now()-1});assert.match(p.redirects[0],/login\.html/);
  p=page('index.html',{session:Date.now()+60000});assert.equal(p.redirects.length,0);assert.equal(p.timers.length,1);p.timers[0].fn();assert.match(p.redirects[0],/login\.html/);
  p=page();await p.submit('owner@example.invalid','wrong-fixture-password');assert.match(p.elements.get('login-status').textContent,/Incorrect/);assert.equal(p.redirects.length,0);assert.equal(p.store.size,0);assert.equal(p.elements.get('login-password').value,'');
  p=page();await p.submit('other@example.invalid',fixturePassword);assert.match(p.elements.get('login-status').textContent,/Incorrect/);
  p=page();await p.submit(' Owner@Example.Invalid ',fixturePassword);assert.equal(p.redirects[0],'https://example.github.io/market-pulse/index.html');assert.equal(p.store.size,1);assert.ok(Number(p.store.get(key))>Date.now());assert.equal(p.elements.get('login-password').value,'');
  p=page('login.html?next=live.html');await p.submit('owner@example.invalid',fixturePassword);assert.match(p.redirects[0],/live\.html$/);
  p=page('login.html?next=index.html%23options');await p.submit('owner@example.invalid',fixturePassword);assert.match(p.redirects[0],/index\.html#options$/);
  for(const target of ['https://evil.invalid/','//evil.invalid/','javascript:alert(1)','../other-site/index.html']){
    p=page('login.html?next='+encodeURIComponent(target));await p.submit('owner@example.invalid',fixturePassword);assert.equal(p.redirects[0],'https://example.github.io/market-pulse/index.html');
  }
  p=page('login.html',{blockStorage:true});await p.submit('owner@example.invalid',fixturePassword);assert.match(p.elements.get('login-status').textContent,/allow browser storage/);assert.equal(p.redirects.length,0);assert.equal(p.elements.get('login-submit').disabled,false);
  p=page('login.html?next=live.html',{session:Date.now()+60000});assert.match(p.redirects[0],/live\.html$/);
  p=page('index.html',{session:Date.now()+60000});p.elements.get('ui-logout').listeners.click();assert.equal(p.store.size,0);assert.match(p.redirects[0],/login\.html$/);
  const shared=new Map();const login=page('login.html',{store:shared});await login.submit('owner@example.invalid',fixturePassword);
  const home=page('index.html',{store:shared}),live=page('live.html',{store:shared});
  assert.equal(home.redirects.length,0);assert.equal(live.redirects.length,0,'new live tab shares the one site sign-in');
  home.elements.get('ui-logout').listeners.click();live.listeners.storage({key});assert.match(live.redirects[0],/login\.html/,'logout in home signs out the live tab');
  const other=page('login.html?next=live.html',{store:shared});shared.set(key,String(Date.now()+60000));other.listeners.storage({key});assert.match(other.redirects[0],/live\.html$/,'login in another tab resumes an already-open login page');
  const active=page('index.html',{store:shared});active.listeners.storage({key:'unrelated'});assert.equal(active.redirects.length,0);
  shared.clear();active.listeners.storage({key:null});assert.match(active.redirects[0],/login\.html/,'cleared browser storage signs out');
  console.log('UI login checks passed: wrong/correct credentials, redirects, expiry, logout, cleared passwords and blocked storage. This is not server-side authentication.');
})().catch(error=>{console.error(error);process.exitCode=1;});
