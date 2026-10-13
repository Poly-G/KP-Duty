import {randomUUID} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {getSoltaBilling} from '@/modules/integrations/solta/billing/actions';
import {ClientBilling} from './client-billing';
export async function SoltaBilling({projectId}:{projectId:string}){
 const connection=await getSoltaBilling(projectId),db=await createClient();
 const {data:pending}=await db.from('solta_payment_requests').select('id,title,amount,livemode').eq('project_id',projectId).eq('status','prepared').order('created_at');
 return <ClientBilling projectId={projectId} requestId={randomUUID()} connection={connection} pending={pending||[]}/>;
}
