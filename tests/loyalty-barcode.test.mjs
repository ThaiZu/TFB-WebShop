import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeLoyaltyBarcode,renderLoyaltyBarcode} from '../webshop-loyalty-barcode.js';
// Golden outputs generated independently with JsBarcode 3.11.6, CODE128B.
const vectors=[
  [
    "FID1-1-00000000000000000000000000000000",
    "2603ecdce2b7eb676d2127b1768cbeb2bef737f728d666c504781c257d8d0097"
  ],
  [
    "FID1-ZZZZZZ-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    "6b5b56381122daa67303a609f816f9d3491985efe0dff8ff0a15b687a5935914"
  ],
  [
    "FID1-9LT-30E96430E8273B6054110EA93CAB83A4",
    "2c98ed1e5339248a0b72d19e3c9207543c2b4282617dc23bf64f20cd4e7033e8"
  ],
  [
    "FID1-ABC123-0123456789ABCDEF0123456789ABCDEF",
    "57a975e94e15d9eeef69cc3188bb7849eff05edb6a0c79a10c107e98ba0732b6"
  ]
];
test('FID1 Code 128 agrees with independent reference vectors, including min/max length',()=>{
 for(const [code,hash] of vectors){const bits=encodeLoyaltyBarcode(code);assert.equal(createHash('sha256').update(bits).digest('hex'),hash);assert.equal(bits.length,11*(code.length+2)+13);}
});
test('SVG preserves every encoded bar and both ten-module quiet zones without displaying the identity',()=>{
 for(const [code] of vectors){
  const svg=renderLoyaltyBarcode(code),bits=encodeLoyaltyBarcode(code),width=bits.length+20;
  assert.ok(svg.includes('viewBox="0 0 '+width+' 112"'));assert.equal(svg.includes(code),false);
  const raster=Array(width).fill('0');
  for(const match of svg.matchAll(/<rect x="(\d+)" y="8" width="(\d+)" height="96"/g)){const start=Number(match[1]),count=Number(match[2]);raster.fill('1',start,start+count);}
  assert.equal(raster.join(''),'0'.repeat(10)+bits+'0'.repeat(10));
 }
});
test('invalid, oversized or injected values cannot render a barcode',()=>{
 for(const value of ['',null,{},'FID1-1-'+'A'.repeat(31),'FID1-1-'+'a'.repeat(32),'FID1-1234567-'+'A'.repeat(32),'<svg onload=alert(1)>'])assert.throws(()=>renderLoyaltyBarcode(value));
});

test('16-digit cards use Code 128 C and agree with independent JsBarcode vectors',()=>{
 const cases=[['9800000000000001','32dc6628365acbc1bbb6097e1b62e5cb954a71d5f7779bf1aca49c94410e45bd'],['9812345678901234','87dc8f154639a2ce2fe2cd77cf72f9c49ce7980d01a35ebefc285ab7b37f976a'],['9899999999999999','70f398336fbf34b7a534d0be5ac13e90cab7db229e7ce966dd8c3dbe85c8180e']];
 for(const [code,hash] of cases){const bits=encodeLoyaltyBarcode(code);assert.equal(bits.length,123);assert.equal(createHash('sha256').update(bits).digest('hex'),hash);assert.ok(renderLoyaltyBarcode(code).includes('viewBox="0 0 143 112"'));}
});
test('numeric identifiers must remain exact strings in the reserved format',()=>{
 for(const code of [9812345678901234,'980000000000001','98000000000000001','9700000000000001','9800000000000001\\n','980000000000000A'])assert.throws(()=>encodeLoyaltyBarcode(code));
});
