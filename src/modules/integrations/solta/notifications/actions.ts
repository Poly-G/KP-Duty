'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {getDelivery} from '@/modules/delivery/queries';
import {dispatchProjectEmails} from './dispatch';
export async function retryProjectEmails(form:FormData){
 await requireAdminIdentity();const id=z.uuid().parse(form.get('project_id'));
 if(!await getDelivery(id,'solta'))throw new Error('Project unavailable');
 const result=await dispatchProjectEmails(id,true);
 revalidatePath(`/businesses/solta/projects/${id}`);
 if(result.pending)throw new Error('Some emails are still pending. Retry later.');
}
