import test from 'node:test';
import assert from 'node:assert/strict';
import {paypal} from '../src/paypal.mjs';
const config={PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture'};
for(const stage of ['oauth','api'])test('PayPal '+stage+' redirects never forward credentials or parse hostile bodies',async()=>{
 for(const status of [301,302,307,308]){let calls=0;const transport=async(url,init)=>{calls++;assert.equal(init.redirect,'manual');if(stage==='api'&&calls===1)return Response.json({access_token:'fixture'});return new Response('<hostile-html>',{status,headers:{Location:'https://untrusted.example/steal'}});};
 const original=globalThis.fetch;globalThis.fetch=transport;try{await assert.rejects(paypal(config,'/v2/checkout/orders/ORDER123/capture','POST',{},'stable-fixture'),/PayPal sandbox/);}finally{globalThis.fetch=original;}
 assert.equal(calls,stage==='oauth'?1:2);}
});
