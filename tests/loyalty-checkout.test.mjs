import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {basketShoppingContext,normaliseShoppingContext} from '../webshop-office-context.js';
const bundle=fs.readFileSync(new URL('../webshop-full-bundle.jsx',import.meta.url),'utf8');
const code=transformSync(bundle.slice(bundle.indexOf('function CheckoutWizard('),bundle.indexOf('function CheckoutStep1(')),{loader:'jsx'}).code;
const adapter=fs.readFileSync(new URL('../webshop-orders-api.jsx',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(node) {return node && typeof node==='object' ? [node,...(node.children||[]).flat(Infinity).flatMap(nodes)] : [];}
function setup({method='shop',rejectFirst=true}={}) {
 const states=[];let index=0,quotes=0;const calls=[],confirmed=[],payments=[];
 let failure=rejectFirst ? new Error('Connection lost') : null;
 const useState=initial=>{const i=index++;if(!(i in states)) states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];};
 const React={useState,useEffect:()=>{},createElement:(type,props,...children)=>({type,props:props||{},children})};
 const quote={loyalty_reward:{id:4,line_index:0,discount:'4.00'},totals:{gross_after_discount:method==='shop'?'0.00':'1.00'}};
 const props={open:true,shop:{id:1,name:'Shop A'},mode:'collect',basket:[{line:'a',productId:1,qty:1}],quoteState:{status:'ready',quote},
  user:{id:10,email:'customer@example.invalid'},loyaltyReward:{id:4,line_index:0},onPlaced:result=>confirmed.push(result),onLogin:()=>{},onClose:()=>{}};
 const window={WSI18n:{getLang:()=> 'pl'},WSQuote:{quote:async()=>{quotes++;return quote;}},WSOrders:{
  place:async payload=>{calls.push(JSON.parse(JSON.stringify(payload)));if(failure){const error=failure;failure=null;throw error;}return {orderRef:'WEB-TEST',total:method==='shop'?0:1,paymentType:method};},
  pay:async ref=>{payments.push(ref);return {status:'paid'};}}};
 const context={React,useState,useEffect:()=>{},window,basketShoppingContext,normaliseShoppingContext,
  wsUseT:()=>({t:key=>key}),wsText:key=>key,wsMessage:v=>v,wsCurrency:String,wsNumber:String,
  wsQuoteTotals:q=>q?{bon:0,sousTotal:Number(q.totals.gross_after_discount),total:Number(q.totals.gross_after_discount)}:null,
  wsCheckoutQuoteComparable:q=>q,wsSelectedAutomaticPromotionId:()=>null,wsTap:fn=>({onClick:fn}),usePaymentMethods:()=>[{id:'stripe',method:'stripe',family:'stripe',label:'Card'}],
  CheckoutStep1:'CheckoutStep1',CheckoutStep2:'CheckoutStep2',CheckoutStep3:'CheckoutStep3',Pict:'Pict'};
 vm.createContext(context);vm.runInContext(code,context);
 const render=()=>{index=0;return context.CheckoutWizard(props);};
 const find=predicate=>nodes(render()).find(predicate);
 const next=()=>find(n=>n.props.className==='ws-cta ws-cta--block').props.onClick();
 async function submit(){next();find(n=>n.type==='CheckoutStep2').props.setSlot({id:'slot1',label:'10:00–11:00'});next();find(n=>n.type==='CheckoutStep3').props.setPayment(method);next();await flush();}
 return {props,calls,confirmed,payments,submit,find,render,quotes:()=>quotes,setFailure:e=>{failure=e;}};
}
test('lost creation response replays exact reward request without quoting a reserved reward',async()=>{
 const h=setup();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.quotes(),1);
 h.props.basket[0].qty=5;h.props.shop={id:2,name:'Shop B'};h.props.quoteState={status:'error',quote:null};
 const retry=h.find(n=>n.children.includes('loyaltyUse.retryOrder'));assert.ok(retry);await retry.props.onClick();
 assert.equal(h.quotes(),1);assert.deepEqual(h.calls[1],h.calls[0]);assert.equal(h.calls[1].basket[0].qty,1);
 assert.equal(h.confirmed.length,1);assert.equal(h.confirmed[0].total,0);assert.deepEqual(h.payments,[]);
});
test('pending order cannot be replayed by another account or turned into an editable basket',async()=>{
 const h=setup();await h.submit();h.props.user={id:11};
 assert.equal(h.find(n=>n.children.includes('loyaltyUse.retryOrder')),undefined);
 assert.ok(h.find(n=>n.children.includes('loyaltyUse.sameAccount')));
 assert.equal(h.find(n=>n.type==='CheckoutStep3'),undefined);assert.equal(h.calls.length,1);
});
test('known initial rejection restores checkout, but rejection after an unknown outcome preserves retry',async()=>{
 const h=setup();h.setFailure(Object.assign(new Error('Expired'),{orderRejected:true}));await h.submit();
 assert.ok(h.find(n=>n.type==='CheckoutStep3'));assert.equal(h.confirmed.length,0);
 const pending=setup();await pending.submit();pending.setFailure(Object.assign(new Error('Unauthorized'),{orderRejected:true}));
 await pending.find(n=>n.children.includes('loyaltyUse.retryOrder')).props.onClick();
 assert.ok(pending.find(n=>n.children.includes('loyaltyUse.retryOrder')));assert.equal(pending.quotes(),1);
});
test('paid remainder resumes Stripe only after recovering the saved order',async()=>{
 const h=setup({method:'stripe'});await h.submit();assert.deepEqual(h.payments,[]);
 await h.find(n=>n.children.includes('loyaltyUse.retryOrder')).props.onClick();
 assert.deepEqual(h.payments,['WEB-TEST']);assert.equal(h.confirmed.length,1);assert.equal(h.quotes(),1);
});
test('order transport distinguishes confirmed rejection from unknown HTTP/body outcome',async()=>{
 for(const [status,body,rejected] of [[422,{error:'Invalid reward'},true],[500,{error:'Failure'},false],[408,{},false],[200,{},undefined],[200,null,undefined]]) {
  const window={WSAuth:{authHeaders:()=>({})}};
  vm.runInNewContext(adapter,{window,fetch:async()=>({ok:status===200,status,json:async()=>body})});
  window.WSOrders.endpoint='https://api.example.invalid/orders';
  await assert.rejects(window.WSOrders.place({requestKey:'stable'}),error=>{assert.equal(error.orderRejected,rejected);return true;});
 }
});


test('checkout action handles click directly and reports stale pricing instead of silently returning',()=>{
 const h=setup({rejectFirst:false});
 const button=h.find(node=>node.props.className==='ws-cta ws-cta--block');
 assert.equal(button.props.type,'button');assert.equal(typeof button.props.onClick,'function');
 assert.equal(button.props.ref,undefined,'Finalization must not depend on the touch-event suppression helper');
 h.props.quoteState={status:'loading',quote:h.props.quoteState.quote};
 h.find(node=>node.props.className==='ws-cta ws-cta--block').props.onClick();
 assert.ok(h.find(node=>node.props.role==='alert'&&node.children.includes('error.quote')));
 assert.equal(h.calls.length,0);
});
