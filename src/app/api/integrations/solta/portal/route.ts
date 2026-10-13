import {createClient} from '@supabase/supabase-js';
import {receiveSoltaRead} from '@/modules/integrations/solta/receiver';
import {portalOperation} from '@/modules/integrations/solta/operations';
import {after} from 'next/server';
import {tryProjectEmails} from '@/modules/integrations/solta/notifications/dispatch';
export const runtime='nodejs';
export async function POST(request:Request){
 const config={enabled:process.env.SOLTA_PORTAL_RECEIVER_ENABLED,secret:process.env.SOLTA_PORTAL_SHARED_SECRET,databaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,databaseSecret:process.env.KP_INTEGRATION_SUPABASE_SECRET};
 return receiveSoltaRead(request,config,async(input,nonce)=>{
  const client=createClient(config.databaseUrl!,config.databaseSecret!,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await portalOperation(client,input,nonce);
  if(result)after(()=>tryProjectEmails(input.projectId));
  return result;
 });
}
