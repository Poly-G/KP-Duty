import {NextResponse} from 'next/server';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {authorizationUrl,driveConfig,newState,hashState,isDriveStartRequest,STATE_COOKIE,STATE_PATH,STATE_TTL} from '@/modules/integrations/google-drive/oauth';
import {driveDatabase,drivePage} from '@/modules/integrations/google-drive/server';
export const runtime='nodejs';
export async function GET(){
 await requireAdminIdentity();
 try{driveConfig();const {data,error}=await driveDatabase().from('solta_drive_connection').select('account_email').eq('id','solta').maybeSingle();
  if(error)return drivePage('The connection database is not ready yet.',false,503);
  return drivePage(data?'Solta Google Drive is connected. Use the button below to renew access after changing Google’s app settings.':'Connect soltafilms@gmail.com to store project files. Clients will continue using their portal.',true);
 }catch{return drivePage('Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to KP’s Production environment before connecting.',false,503);}
}
export async function POST(request:Request){
 if(!isDriveStartRequest(request))return drivePage('Open this connection page on KP’s production website.',false,403);
 const {user}=await requireAdminIdentity();
 try{
  const config=driveConfig(),state=newState();
  const {error}=await driveDatabase().from('solta_drive_oauth_states').insert({state_hash:hashState(state),actor_id:user.id,expires_at:new Date(Date.now()+STATE_TTL*1000).toISOString()});
  if(error)return drivePage('The connection could not be started. Please retry.',false,503);
  const response=NextResponse.redirect(authorizationUrl(config,state),303);
  response.cookies.set(STATE_COOKIE,state,{httpOnly:true,secure:true,sameSite:'lax',path:STATE_PATH,maxAge:STATE_TTL});
  response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{return drivePage('The Google connection settings are unavailable.',false,503);}
}
