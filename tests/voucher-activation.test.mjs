import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../webshop-voucher-activation.js',import.meta.url),'utf8')
  .replace(/^import .*\n/,'').replace(/export /g,'');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(request) {
  const refs=[],effects=[],events={},changes=[],errors=[],calls=[];let index=0,timer;
  const context={__WS_API_BASE_URL__:'https://api.example.invalid/api/v1',AbortController,document:{hidden:false},
    useRef:initial=>{const i=index++;return refs[i] ||= {current:initial};},useState:initial=>[initial,()=>{}],useCallback:fn=>fn,
    useEffect:(fn,deps)=>{const i=index++;if(!effects[i] || JSON.stringify(effects[i].deps)!==JSON.stringify(deps)){
      effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};}},
    setInterval:fn=>{timer=fn;return 1;},clearInterval:()=>{},window:{
      addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name],
      WSAuth:{authenticatedJson:async(url,options)=>{calls.push({url,...options});return {response:{ok:true},data:await request(url,options)};}}
    }};
  vm.createContext(context);vm.runInContext(source,context);
  const render=(client=7,shop=2)=>{index=0;return context.useVoucherActivation(client,shop,value=>changes.push(value),error=>errors.push(error));};
  return {context,render,changes,errors,calls,poll:()=>timer(),events};
}
const state=(revision=1,code='GIFT')=>({revision,code,reserved:false,name:'Reward'});

test('server activation is restored without a write; selection sends the current revision',async()=>{
  const h=setup(async(url,options)=>options.method==='POST'?state(2,JSON.parse(options.body).code):state());
  const hook=h.render();await flush();
  assert.equal(h.changes.at(-1).code,'GIFT');assert.equal(h.calls.length,1);
  assert.equal(await hook.select(null),true);
  assert.deepEqual(JSON.parse(h.calls.at(-1).body),{shopId:2,code:null,revision:1});
  assert.equal(h.changes.at(-1).code,null);
});
test('a late read cannot replace a newer accepted activation',async()=>{
  let finish,reads=0;
  const h=setup(async(url,options)=>{
    if(options.method==='POST')return state(2,'NEW');
    if(++reads===1)return state();
    return new Promise(resolve=>finish=resolve);
  });
  const hook=h.render();await flush();h.poll();await flush();
  await hook.select('NEW');finish(state());await flush();
  assert.equal(h.changes.at(-1).code,'NEW');
});
test('a response for a previous customer cannot restore their activation',async()=>{
  let finish;
  const h=setup(()=>new Promise(resolve=>finish=resolve));
  h.render();h.render(null);finish(state());await flush();
  assert.equal(h.changes.at(-1),null);
  assert.equal(h.calls.filter(call=>call.method==='POST').length,0);
});
test('session end clears the browser cache without clearing the server selection',async()=>{
  const h=setup(async()=>state());h.render();await flush();h.events['ws:session-ended']();
  assert.equal(h.changes.at(-1),null);
  assert.equal(h.calls.length,1);
});
test('malformed server activation is rejected',()=>{
  const h=setup(async()=>state());
  assert.throws(()=>h.context.validateActivation({revision:-1,code:'GIFT',reserved:false}));
  assert.throws(()=>h.context.validateActivation({revision:1,code:'',reserved:false}));
});

test('a reserved activation keeps its business error code for the translated message',async()=>{
  const h=setup(async()=>state());
  h.context.window.WSAuth.authenticatedJson=async()=>({response:{ok:false,status:409},data:{code:'VOUCHER_ACTIVATION_RESERVED'}});
  await assert.rejects(h.context.requestActivation(2,{code:null,revision:1}),error=>error.status===409 && error.code==='VOUCHER_ACTIVATION_RESERVED');
});
