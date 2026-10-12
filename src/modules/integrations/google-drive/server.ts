import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function driveDatabase(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.KP_INTEGRATION_SUPABASE_SECRET;
 if(!url||!secret)throw new Error('Drive connection storage is unavailable.');
 return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function drivePage(message:string,connect=false,status=200){
 // Only fixed application messages are passed here; no provider responses or credentials.
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solta Drive connection</title><body style="margin:0;background:#f5f0e8;color:#252830;font:18px system-ui"><main style="max-width:540px;margin:12vh auto;padding:32px"><h1>Solta file storage</h1><p>${message}</p>${connect?'<form method="post"><button style="background:#354f8f;color:white;border:0;border-radius:8px;padding:16px 24px;font:inherit">Connect Solta Google Drive</button></form>':''}<p><a href="/">Return to KP</a></p></main></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
