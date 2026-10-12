import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {driveConfig,exchangeCode,hashState,matchesState,STATE_COOKIE,STATE_PATH,DRIVE_CALLBACK} from '@/modules/integrations/google-drive/oauth';
import {driveDatabase,drivePage} from '@/modules/integrations/google-drive/server';
export const runtime='nodejs';
export async function GET(request:Request){
 const {user}=await requireAdminIdentity();
 const url=new URL(request.url),state=url.searchParams.get('state')||'',cookieStore=await cookies();
 const cookie=cookieStore.get(STATE_COOKIE)?.value;
 cookieStore.set(STATE_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:STATE_PATH,maxAge:0});
 if(url.origin!==new URL(DRIVE_CALLBACK).origin||!matchesState(state,cookie))return drivePage('This connection attempt expired or is invalid. Start again from KP.',false,400);
 try{
  const db=driveDatabase();
  // Atomic consumption prevents a callback being exchanged or saved twice.
  const {data,error}=await db.from('solta_drive_oauth_states').delete().eq('state_hash',hashState(state)).eq('actor_id',user.id).gt('expires_at',new Date().toISOString()).select('actor_id').maybeSingle();
  if(error||!data)return drivePage('This connection attempt expired or was already used. Start again from KP.',false,400);
  const code=url.searchParams.get('code');
  if(url.searchParams.has('error')||!code)return drivePage('Google access was not granted. Start again when ready.',false,400);
  const connection=await exchangeCode(driveConfig(),code);
  const saved=await db.from('solta_drive_connection').upsert({id:'solta',account_email:connection.email,encrypted_refresh_token:connection.encryptedRefreshToken,connected_by:user.id,connected_at:new Date().toISOString()},{onConflict:'id'});
  if(saved.error)return drivePage('The connection could not be saved. Start again from KP.',false,503);
  const response=NextResponse.redirect(new URL('/api/integrations/google-drive',DRIVE_CALLBACK),303);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{return drivePage('The Google connection failed. Use soltafilms@gmail.com and start again from KP.',false,503);}
}
