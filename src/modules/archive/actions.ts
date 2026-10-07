'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
export async function archiveRecord(form:FormData){
 await requireAdminIdentity();if(form.get('verified')!=='on')throw new Error('Confirm that you reviewed the affected record.');
 const db=await createClient();const {error}=await db.rpc('kp_archive_record',{p_type:z.enum(['organization','person','opportunity','project','task']).parse(form.get('entity_type')),p_id:z.string().uuid().parse(form.get('entity_id')),p_operation:z.enum(['archive','restore']).parse(form.get('operation')),p_confirmation:z.string().max(1000).parse(form.get('confirmation')),p_reason:z.string().trim().min(5).max(2000).parse(form.get('reason'))});if(error)throw new Error(error.message);
 revalidatePath('/','layout');
}
