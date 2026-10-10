import {createClient} from '@supabase/supabase-js';
import {receiveSoltaRead} from '@/modules/integrations/solta/receiver';
export const runtime='nodejs';
export async function POST(request:Request){
 const config={enabled:process.env.SOLTA_PORTAL_RECEIVER_ENABLED,secret:process.env.SOLTA_PORTAL_SHARED_SECRET,databaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,databaseSecret:process.env.KP_INTEGRATION_SUPABASE_SECRET};
 return receiveSoltaRead(request,config,async(input,nonce)=>{
  const client=createClient(config.databaseUrl!,config.databaseSecret!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.rpc('kp_read_solta_portal',{p_project:input.projectId,p_company:input.organizationId,p_portal_project:input.portalProjectId,p_actor:input.actorId,p_nonce:nonce});
  if(error)throw new Error('Portal read failed');return data;
 });
}
