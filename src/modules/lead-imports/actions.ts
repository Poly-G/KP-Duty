'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {leadFileTable} from './files';
import {normalizeLeads,suggestBusiness} from './normalize';
import type {LeadRow} from './normalize';
export async function previewLeadImport(form:FormData){
 await requireActiveIdentity();const selected=z.enum(['solta','snd']).parse(form.get('business'));const file=form.get('file');
 if(!(file instanceof File)||file.size>2*1024*1024)throw new Error('Select a CSV or XLSX file up to 2 MB.');
 return {fileName:file.name.slice(0,200),rows:normalizeLeads(await leadFileTable(file.name,Buffer.from(await file.arrayBuffer())),selected)};
}
export async function commitLeadImport(id:string,fileName:string,rows:LeadRow[]){
 await requireActiveIdentity();z.string().uuid().parse(id);
 const rowSchema=z.object({company:z.string().trim().min(1).max(300),website:z.string().max(10000),domain:z.string().max(300),email:z.string().max(300),contact:z.string().max(300),phone:z.string().max(300),service:z.string().max(300),source:z.string().max(300),source_url:z.string().max(10000),notes:z.string().max(10000),business:z.enum(['solta','snd']),override_reason:z.string().max(2000)});
 const payload=z.array(rowSchema).min(1).max(500).parse(rows);
 for(const row of payload){
 const check=normalizeLeads([['company','website','email','service','source url'],[row.company,row.website,row.email,row.service,row.source_url]],row.business)[0];if(check.issue)throw new Error(check.issue);
 if(check.domain!==row.domain)throw new Error('Website/domain mismatch. Preview the file again.');
 const suggested=suggestBusiness(row.service);if(suggested&&suggested!==row.business&&row.override_reason.trim().length<5)throw new Error('Explain any service/business override.');
 }
 const db=await createClient();const {data,error}=await db.rpc('kp_import_lead_batch',{p_id:id,p_file:z.string().trim().min(1).max(200).parse(fileName),p_rows:payload});if(error)throw new Error(error.message);
 for(const business of ['solta','snd']){revalidatePath(`/businesses/${business}`);revalidatePath(`/crm/${business}`);}revalidatePath('/crm/companies');revalidatePath('/crm/people');
 return data as {added:number;skipped:number};
}
