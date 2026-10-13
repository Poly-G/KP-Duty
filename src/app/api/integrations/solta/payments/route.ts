import {createClient} from '@supabase/supabase-js';
import {BillingError,paymentEvent,paymentPath,signedBillingBody} from '@/modules/integrations/solta/billing/contract';
import {after} from 'next/server';
import {tryProjectEmails} from '@/modules/integrations/solta/notifications/dispatch';
export const runtime='nodejs';
export async function POST(request:Request){
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 const secret=process.env.SOLTA_PORTAL_SHARED_SECRET,url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.KP_INTEGRATION_SUPABASE_SECRET;
 if(process.env.SOLTA_PORTAL_RECEIVER_ENABLED!=='true'||!secret||secret.length<32||!url||!key)return reply({error:'Payment connection unavailable'},503);
 try{
  const {data,nonce}=await signedBillingBody(request,secret,paymentPath);const event=paymentEvent.safeParse(data);if(!event.success)throw new BillingError(400,'Invalid payment event');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data:result,error}=await db.rpc('kp_receive_solta_payment',{p_event:event.data,p_nonce:nonce});
  if(error)throw new BillingError(['P0001','23505','23514'].includes(error.code)?409:503,'Payment needs reconciliation.');
  after(()=>tryProjectEmails(event.data.projectId));return reply(result);
 }catch(error){if(error instanceof BillingError)return reply({error:error.message},error.status);return reply({error:'Payment sync unavailable'},503);}
}
