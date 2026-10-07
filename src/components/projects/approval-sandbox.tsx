'use client';
import {useState} from 'react';
import {clientDeliverables} from '@/modules/deliverables/types';
import type {DeliverableVersion,Review,ReviewOutcome} from '@/modules/deliverables/types';
import {DeliverableClientView} from './deliverable-client-view';
const field='rounded-lg border border-[var(--border)] p-3';
const button='rounded-lg border border-[var(--border)] p-3 text-sm disabled:opacity-40';
export function ApprovalSandbox(){
 const [versions,setVersions]=useState<DeliverableVersion[]>([]);
 const [notice,setNotice]=useState('');
 const current=versions.at(-1);
 const internal=current?.reviews.find(r=>r.lane==='internal');
 const client=current?.reviews.find(r=>r.lane==='client_record');
 function review(lane:'internal'|'client_record',outcome:ReviewOutcome,note:string,evidence:string|null=null){
  if(!current)return;
  const record:Review={id:crypto.randomUUID(),version_id:current.id,lane,outcome,note,evidence,client_name:lane==='client_record'?'Sample client':null,recorded_by:'practice',recorded_at:new Date().toISOString(),actor:{display_name:'Practice teammate'}};
  setVersions(items=>items.map(v=>v.id===current.id?{...v,reviews:[...v.reviews,record]}:v));
  setNotice(`Version ${current.version}: ${outcome==='approved'?'approved':'changes requested'}. ${lane==='internal'?'Publication is a separate action.':'Response recorded against this version only.'}`);
 }
 return <section className="mt-7 rounded-2xl border border-[var(--border)] p-5"><h2 className="text-xl font-medium">Practice version approvals</h2><p className="mt-2 text-sm text-[var(--muted)]">Browser-only practice. No live records or emails. Direct client login comes last; staff record actual client responses with evidence.</p>
 <form className="mt-4 grid gap-3" onSubmit={e=>{e.preventDefault();const description=String(new FormData(e.currentTarget).get('summary')||'').trim();if(!description)return;const number=versions.length+1;setVersions(items=>[...items,{id:crypto.randomUUID(),deliverable_id:'practice',version:number,description,created_at:new Date().toISOString(),created_by:'practice',file_ids:[],published_at:null,reviews:[]}]);e.currentTarget.reset();setNotice(`Version ${number} saved privately. It needs its own internal review.`);}}>
 <label className="grid gap-2 text-sm">Practice deliverable summary<textarea required name="summary" maxLength={10000} className={field}/></label><button type="submit" className={button}>Save practice deliverable version</button></form>
 {current?<><p className="mt-4 text-sm">Current version {current.version} · {internal?.outcome==='approved'?'Internally approved':internal?.outcome==='changes_requested'?'Changes requested':'Awaiting internal review'}</p>
 {!internal?<div className="mt-3 flex gap-3"><button className={button} onClick={()=>review('internal','approved','Practice internal approval')}>Approve current practice version internally</button><button className={button} onClick={()=>review('internal','changes_requested','Update the sample design before review.')}>Request practice changes internally</button></div>:null}
 <button className={`${button} mt-3`} disabled={internal?.outcome!=='approved'||!!current.published_at} onClick={()=>{setVersions(items=>items.map(v=>v.id===current.id?{...v,published_at:new Date().toISOString()}:v));setNotice(`Version ${current.version} published. Notifications stay held; project activation stays separate.`);}}>Publish current practice deliverable</button>
 {current.published_at&&!client?<form className="mt-4 grid gap-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);const note=String(data.get('feedback')||'').trim();const evidence=String(data.get('evidence')||'').trim();if(!note||!evidence)return;review('client_record',data.get('outcome')==='changes_requested'?'changes_requested':'approved',note,evidence);}}><label className="grid gap-2 text-sm">Practice client outcome<select name="outcome" className={field}><option value="approved">Approved</option><option value="changes_requested">Changes requested</option></select></label><label className="grid gap-2 text-sm">Practice client feedback<textarea required name="feedback" className={field}/></label><label className="grid gap-2 text-sm">Practice response evidence · internal only<textarea required name="evidence" className={field}/></label><button className={button} type="submit">Record practice client response</button></form>:null}
 {versions.length>1?<button className={`${button} mt-3`} onClick={()=>setNotice('Blocked: an earlier version cannot receive a new review after a newer version is saved.')}>Try reviewing an earlier practice version</button>:null}</>:null}
 {notice?<p role="status" className="mt-4 text-sm">{notice}</p>:null}
 <div role="region" aria-label="Practice published deliverables" className="mt-5 rounded-xl bg-white p-4 text-slate-900"><h3 className="font-medium">Client view · published versions only</h3><DeliverableClientView practice files={[]} deliverables={clientDeliverables([{id:'practice',project_id:'practice',title:'Sample design',kind:'general',reviewer_id:'practice',reviewer:null,requirement_key:null,current_version:versions.length,versions}])}/></div>
 </section>;
}
