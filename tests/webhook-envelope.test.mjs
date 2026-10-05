import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyWebhook} from '../src/paypal.mjs';
const env={PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture',PAYPAL_WEBHOOK_ID:'WH-fixture'};
const validHeaders=new Headers({'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-fixture','paypal-transmission-id':'transmission-fixture','paypal-transmission-sig':'fixture-signature','paypal-transmission-time':'2026-10-05T18:00:00Z'});
const event={id:'event-fixture',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'capture-fixture'}};
test('unsigned and malformed webhook envelopes never contact a provider',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('Must not call provider')};
 try{await assert.rejects(verifyWebhook(env,new Headers(),{}));const hostile=new Headers(validHeaders);hostile.set('paypal-cert-url','https://attacker.example/cert');await assert.rejects(verifyWebhook(env,hostile,event));await assert.rejects(verifyWebhook(env,validHeaders,{}));assert.equal(calls,0);}finally{globalThis.fetch=previous;}
});
test('well-formed webhook still requires provider signature success',async()=>{
 const previous=globalThis.fetch;let verification='FAILURE';globalThis.fetch=async(url)=>String(url).includes('oauth2/token')?Response.json({access_token:'fixture'}):Response.json({verification_status:verification});
 try{await assert.rejects(verifyWebhook(env,validHeaders,event),/Invalid webhook signature/);verification='SUCCESS';assert.equal(await verifyWebhook(env,validHeaders,event),true);}finally{globalThis.fetch=previous;}
});
