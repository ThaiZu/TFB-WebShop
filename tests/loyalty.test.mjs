import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateLoyaltyPage,readLoyaltyPage} from '../webshop-loyalty-api.js';

const card={id:1,name:'Pain',required:10,balance:-2,progress:0,debt:2,pendingEvents:1,accepting:false,shops:[{id:2,name:'Shop'}]};
const page=items=>({status:'available',asOf:'2026-10-29T12:00:00Z',items,nextCursor:null});

test('signed debt and pending activity remain distinct from an empty card',()=>{
 assert.equal(validateLoyaltyPage(page([card]),'cards').items[0].debt,2);
 assert.deepEqual(validateLoyaltyPage(page([]),'cards').items,[]);
});
test('missing and malformed responses cannot become zero balances',()=>{
 for(const data of [null,{},[],{...page([]),status:'unavailable'},page([{...card,balance:null}]),page([{...card,progress:2}]),page([{...card,shops:null}]),page([card,card])]) assert.throws(()=>validateLoyaltyPage(data,'cards'));
});
test('only READY awards carry a genuine reward code',()=>{
 const reward={id:1,status:'READY',code:'A'.repeat(32),earnedAt:'2026-10-01T12:00:00Z',expiresAt:null};
 assert.equal(validateLoyaltyPage(page([reward]),'rewards').items[0].code,reward.code);
 for(const changes of [{code:'https://old-pwa.invalid'},{status:'RESERVED'},{status:'EXPIRED'},{code:null}]) assert.throws(()=>validateLoyaltyPage(page([{...reward,...changes}]),'rewards'));
 assert.equal(validateLoyaltyPage(page([{...reward,status:'REVOKED',code:null}]),'rewards').items[0].code,null);
});
test('history keeps signed deltas and full BIGINT identifiers',()=>{
 const row={id:'9223372036854775806',kind:'CORRECTION',delta:-2,balanceAfter:-1,occurredAt:'2026-10-29T12:00:00Z'};
 assert.equal(validateLoyaltyPage(page([row]),'history').items[0].id,row.id);
 assert.throws(()=>validateLoyaltyPage(page([{...row,kind:'UNKNOWN'}]),'history'));
});
test('transport uses shared authenticated JSON and no-store without a client identity parameter',async()=>{
 globalThis.__WS_API_BASE_URL__='https://api.example.invalid/api/v1';
 let request;
 globalThis.window={WSAuth:{authenticatedJson:async(url,options)=>{request={url,options};return {response:{ok:true},data:page([card])};}}};
 const controller=new AbortController();
 await readLoyaltyPage('cards',{shopId:2},controller.signal);
 assert.equal(request.url,'https://api.example.invalid/api/v1/webshop/loyalty/cards?shopId=2');
 assert.equal(request.options.cache,'no-store');assert.equal(request.options.signal,controller.signal);
});
test('503 and 401 remain failures, never an empty successful list',async()=>{
 globalThis.__WS_API_BASE_URL__='https://api.example.invalid/api/v1';
 for(const status of [503,401]) {
  globalThis.window={WSAuth:{authenticatedJson:async()=>({response:{ok:false,status},data:{error:'unavailable'}})}};
  await assert.rejects(readLoyaltyPage('cards',{shopId:2}),error=>error.status===status);
 }
});

test('program details validate scope, explicit products, portions and unlimited reward validity',async()=>{
 const {validateLoyaltyProgram,readLoyaltyProgram}=await import('../webshop-loyalty-api.js');
 const data={status:'available',asOf:'2026-10-30T12:00:00Z',id:7,startsAt:'2026-10-01T00:00:00Z',endsAt:null,rewardValidityDays:0,products:[{id:11,name:'Pain'}],categories:[],excludedProducts:[],rewardChoices:[{id:3,name:'Tarte',portion:'1/2'}]};
 assert.equal(validateLoyaltyProgram(data,7),data);
 for(const change of [{id:8},{products:null},{rewardChoices:[{id:3,name:'Tarte'}]},{endsAt:'broken'},{rewardValidityDays:-1}]) assert.throws(()=>validateLoyaltyProgram({...data,...change},7));
 let request;
 globalThis.window={WSAuth:{authenticatedJson:async(url,options)=>{request={url,options};return {response:{ok:true},data};}}};
 await readLoyaltyProgram({shopId:2,cardId:7});
 assert.equal(request.url,'https://api.example.invalid/api/v1/webshop/loyalty/program?shopId=2&cardId=7');assert.equal(request.options.cache,'no-store');
});
