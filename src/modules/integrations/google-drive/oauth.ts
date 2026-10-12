import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

export const DRIVE_ACCOUNT='soltafilms@gmail.com';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const DRIVE_CALLBACK='https://kp-duty.vercel.app/api/integrations/google-drive/callback';
export const STATE_COOKIE='__Secure-solta-drive-state';
export const STATE_PATH='/api/integrations/google-drive';
export const STATE_TTL=600;
export type DriveConfig={clientId:string;clientSecret:string};
export function driveConfig():DriveConfig{
 const clientId=process.env.GOOGLE_DRIVE_CLIENT_ID,clientSecret=process.env.GOOGLE_DRIVE_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw new Error('Google Drive credentials are not configured.');
 return {clientId,clientSecret};
}
export function newState(){return randomBytes(32).toString('base64url');}
export function hashState(state:string){return createHash('sha256').update(state).digest('hex');}
export function matchesState(state:string,cookie:string|undefined){
 if(!cookie||! /^[A-Za-z0-9_-]{43}$/.test(state)||! /^[A-Za-z0-9_-]{43}$/.test(cookie))return false;
 return timingSafeEqual(Buffer.from(state),Buffer.from(cookie));
}
export function authorizationUrl(config:DriveConfig,state:string){
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:DRIVE_CALLBACK,response_type:'code',scope:`openid email ${DRIVE_SCOPE}`,state,access_type:'offline',prompt:'consent',login_hint:DRIVE_ACCOUNT,include_granted_scopes:'false'}).toString();
 return url.toString();
}
function key(secret:string){return createHash('sha256').update('solta-drive-refresh-token:v1\0'+secret).digest();}
export function sealToken(token:string,secret:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);cipher.setAAD(Buffer.from(DRIVE_ACCOUNT));
 const ciphertext=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function openToken(value:string,secret:string){
 const [version,iv,tag,ciphertext,...rest]=value.split('.');
 if(version!=='v1'||!iv||!tag||!ciphertext||rest.length)throw new Error('Drive connection must be reconnected.');
 const decipher=createDecipheriv('aes-256-gcm',key(secret),Buffer.from(iv,'base64url'));decipher.setAAD(Buffer.from(DRIVE_ACCOUNT));decipher.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64url')),decipher.final()]).toString('utf8');
}
async function tokenRequest(config:DriveConfig,parameters:Record<string,string>,fetcher:typeof fetch=fetch){
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...parameters}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Google authorization failed. Start the connection again.');
 return response.json() as Promise<{access_token?:string;refresh_token?:string;scope?:string;token_type?:string}>;
}
export async function exchangeCode(config:DriveConfig,code:string,fetcher:typeof fetch=fetch){
 const token=await tokenRequest(config,{code,redirect_uri:DRIVE_CALLBACK,grant_type:'authorization_code'},fetcher);
 if(!token.access_token||!token.refresh_token||!token.scope?.split(' ').includes(DRIVE_SCOPE))throw new Error('Google did not grant the required file connection.');
 const response=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Google account could not be verified.');
 const user=await response.json() as {email?:string;email_verified?:boolean};
 if(user.email!==DRIVE_ACCOUNT||user.email_verified!==true)throw new Error('Connect the Solta Google account.');
 return {email:DRIVE_ACCOUNT,encryptedRefreshToken:sealToken(token.refresh_token,config.clientSecret)};
}
export async function refreshAccessToken(config:DriveConfig,encryptedToken:string,fetcher:typeof fetch=fetch){
 const token=await tokenRequest(config,{refresh_token:openToken(encryptedToken,config.clientSecret),grant_type:'refresh_token'},fetcher);
 if(!token.access_token)throw new Error('Google Drive needs to be reconnected.');
 return token.access_token;
}
