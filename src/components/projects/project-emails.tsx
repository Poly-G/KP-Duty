import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {ActionForm} from '@/components/action-form';
import {retryProjectEmails} from '@/modules/integrations/solta/notifications/actions';
import {after} from 'next/server';
import {tryProjectEmails} from '@/modules/integrations/solta/notifications/dispatch';
export async function ProjectEmails({projectId}:{projectId:string}){
 const {profile}=await requireActiveIdentity();
 // Every authorized staff visit can drain this project's scoped queue; only admins see delivery controls.
 after(()=>tryProjectEmails(projectId));
 if(profile.role!=='admin')return null;
 const db=await createClient();
 const [control,events]=await Promise.all([
  db.from('solta_notification_control').select('enabled,allow_all_projects,allowed_projects').eq('id','solta').maybeSingle(),
  db.from('solta_notification_events').select('id,event_kind,status,created_at,attempts,error_code').eq('project_id',projectId).order('created_at',{ascending:false}).limit(20),
 ]);
 if(control.error||events.error)return <section className="mb-7 rounded-2xl border border-[var(--border)] p-5"><h2 className="font-medium">Project emails</h2><p className="mt-2 text-sm">Email status is temporarily unavailable.</p></section>;
 const enabled=control.data?.enabled&&(control.data.allow_all_projects||(Array.isArray(control.data.allowed_projects)&&control.data.allowed_projects.includes(projectId)));
 const labels:Record<string,string>={'message.created':'Client message','file.verified':'Client file','review.decided':'Client decision','payment.requested':'Payment request','payment.received':'Payment confirmed','message.shared':'Message to clients','progress.published':'Published progress','file.shared':'Shared file','preview.published':'Website preview','scope.published':'Scope ready for review'};
 return <section className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-medium">Project emails</h2><p className="mt-2 text-sm text-[var(--muted)]">{enabled?'Enabled project updates and payments send branded email alerts. Pending emails can be retried here.':'Project email alerts are not enabled for this project.'}</p><ul className="mt-4 space-y-3">{events.data?.map(event=><li key={event.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">{labels[event.event_kind]||'Project update'} · {event.error_code==='DELIVERY_NEEDS_REVIEW'?'Needs delivery review':event.status==='skipped'?'Superseded scope · email skipped':event.status==='sent'?'Accepted for email delivery':event.status==='sending'?'Sending':'Pending delivery'}<p className="mt-1 text-xs text-[var(--muted)]">{new Date(event.created_at).toLocaleDateString('en-US',{timeZone:'UTC'})}{event.error_code==='DELIVERY_NEEDS_REVIEW'?' · Check provider acceptance before sending again':event.error_code==='SCOPE_SUPERSEDED'?' · A newer scope needs review':event.error_code?' · Retry needed':''}</p></li>)}</ul>{enabled?<ActionForm action={retryProjectEmails} className="mt-4"><input type="hidden" name="project_id" value={projectId}/><button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm">Retry pending emails</button></ActionForm>:null}</section>;
}
