import Link from 'next/link';
import {schedulerHealth} from '@/modules/integrations/solta/notifications/health';
import {createClient} from '@/lib/supabase/server';
/** Render only inside the authenticated admin shell. Never dispatch mail while rendering. */
export async function EmailHealthAlert(){
 const db=await createClient();
 const [scheduler,events]=await Promise.all([
  db.from('solta_email_scheduler').select('enabled,last_scan_at,last_started_at,last_completed_at,error_code').eq('id','solta').maybeSingle(),
  db.from('solta_notification_events').select('id,project_id,error_code,attempts').in('status',['pending','sending']).or('attempts.gte.3,error_code.eq.DELIVERY_NEEDS_REVIEW').limit(10),
 ]);
 if(scheduler.error||events.error)return <aside role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Email delivery status is temporarily unavailable.</aside>;
 const s=scheduler.data;
 const unhealthy=schedulerHealth(s);
 if(!events.data?.length&&!unhealthy)return null;
 const projects=[...new Set(events.data?.map(e=>e.project_id))];
 return <aside role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-semibold">Project emails need attention</h2><p className="mt-1">{unhealthy?'Automatic email retries need checking. ':''}{events.data?.length?'Some emails have been delayed or require a delivery review. Open the project’s email section for details.':''}</p>{projects.length?<ul className="mt-2 flex flex-wrap gap-4">{projects.map((id,index)=><li key={id}><Link className="underline underline-offset-2" href={`/businesses/solta/projects/${id}`}>Check project{projects.length>1?` ${index+1}`:''} emails</Link></li>)}</ul>:null}</aside>;
}
