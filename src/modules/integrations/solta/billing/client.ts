import 'server-only';
import {randomUUID} from 'node:crypto';
import {BillingError,billingPath,billingRequest,billingSignature,billingStatus,type BillingRequest} from './contract';
export async function soltaBillingRequest(input:BillingRequest){
 if(process.env.VERCEL_ENV!=='production')throw new BillingError(503,'Use KP’s live website for client payments.');
 const secret=process.env.SOLTA_PORTAL_SHARED_SECRET;if(!secret||secret.length<32)throw new BillingError(503,'Billing connection unavailable.');
 const raw=JSON.stringify(billingRequest.parse(input)),timestamp=String(Math.floor(Date.now()/1000)),nonce=randomUUID();
 const response=await fetch('https://www.soltaworks.com'+billingPath,{method:'POST',headers:{'Content-Type':'application/json','X-Billing-Timestamp':timestamp,'X-Billing-Nonce':nonce,'X-Billing-Signature':billingSignature(secret,billingPath,timestamp,nonce,raw)},body:raw,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 const text=await response.text();if(Buffer.byteLength(text)>262144)throw new BillingError(503,'Invalid billing response.');
 let data;try{data=JSON.parse(text);}catch{throw new BillingError(503,'Billing connection unavailable.');}
 if(!response.ok)throw new BillingError(response.status,typeof data.error==='string'&&data.error.length<300?data.error:'Billing connection unavailable.');return billingStatus.parse(data);
}
