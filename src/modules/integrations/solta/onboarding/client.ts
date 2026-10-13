import 'server-only';
import {randomUUID} from 'node:crypto';
import {OnboardingError,onboardingPath,onboardingRequest,onboardingSignature,type OnboardingRequest} from './contract';
export async function soltaSetupRequest(input:OnboardingRequest){
 if(process.env.VERCEL_ENV!=='production')throw new OnboardingError(503,'Use KP’s live website to set up client access.');
 const secret=process.env.SOLTA_PORTAL_SHARED_SECRET;if(!secret||secret.length<32)throw new OnboardingError(503,'Client setup connection is not configured.');
 const raw=JSON.stringify(onboardingRequest.parse(input)),timestamp=String(Math.floor(Date.now()/1000)),nonce=randomUUID();
 const response=await fetch('https://www.soltaworks.com'+onboardingPath,{method:'POST',headers:{'Content-Type':'application/json','X-KP-Timestamp':timestamp,'X-KP-Nonce':nonce,'X-KP-Signature':onboardingSignature(secret,timestamp,nonce,raw)},body:raw,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
 const text=await response.text();if(Buffer.byteLength(text)>32768)throw new OnboardingError(503,'Client setup returned an invalid response.');
 let result;try{result=JSON.parse(text);}catch{throw new OnboardingError(503,'Client setup connection is unavailable.');}
 if(!response.ok){if([400,404,409,503].includes(response.status)&&typeof result.error==='string'&&result.error.length<300)throw new OnboardingError(response.status,result.error);throw new OnboardingError(503,'Client setup connection is unavailable.');}
 return result;
}
