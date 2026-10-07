'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
const name=z.string().trim().min(1).max(120),reason=z.string().trim().min(5).max(2000);
export async function prepareStaff(form:FormData){
 await requireAdminIdentity();
 const data=z.object({id:z.string().uuid(),email:z.string().trim().email().max(254),name,reason}).parse(Object.fromEntries(form));
 const db=await createClient();const {error}=await db.rpc('kp_prepare_staff',{p_id:data.id,p_email:data.email,p_name:data.name,p_reason:data.reason});if(error)throw new Error(error.message);revalidatePath('/team');
}
export async function changeStaff(form:FormData){
 await requireAdminIdentity();
 const data=z.object({id:z.string().uuid(),revision:z.coerce.number().int().positive(),name,role:z.enum(['admin','team_member']),status:z.enum(['active','disabled']),reason,confirmation:z.string().min(1),verified:z.literal('on')}).parse(Object.fromEntries(form));
 const db=await createClient();const {error}=await db.rpc('kp_change_staff',{p_target:data.id,p_revision:data.revision,p_name:data.name,p_role:data.role,p_status:data.status,p_reason:data.reason,p_confirmation:data.confirmation});if(error)throw new Error(error.message);revalidatePath('/','layout');
}
export async function cancelStaffPreparation(form:FormData){
 await requireAdminIdentity();
 const data=z.object({id:z.string().uuid(),reason,confirmation:z.string().min(1),verified:z.literal('on')}).parse(Object.fromEntries(form));
 const db=await createClient();const {error}=await db.rpc('kp_cancel_staff_preparation',{p_id:data.id,p_confirmation:data.confirmation,p_reason:data.reason});if(error)throw new Error(error.message);revalidatePath('/team');
}
