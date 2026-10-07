'use client';
import {useState} from 'react';
import {ActionForm} from '@/components/action-form';
import {saveProjectProgress} from '@/modules/project-collaboration/actions';
import type {Milestone,Progress} from '@/modules/project-collaboration/queries';
export function ProgressEditor({id,business,draft}:{id:string;business:string;draft:Progress|null}){
 const [milestones,setMilestones]=useState<Milestone[]>(draft?.milestones||[]);
 return <ActionForm action={saveProjectProgress} className="mt-4 space-y-4"><input type="hidden" name="id" value={id}/><input type="hidden" name="business" value={business}/><input type="hidden" name="revision" value={draft?.revision||0}/><input type="hidden" name="milestones" value={JSON.stringify(milestones)}/>
 <label className="grid gap-2 text-sm">Current work<textarea name="current_work" maxLength={5000} rows={3} defaultValue={draft?.current_work||''} className="rounded-lg border border-[var(--border)] p-3"/></label>
 <label className="grid gap-2 text-sm">Client’s next action<textarea name="next_action" maxLength={5000} rows={2} defaultValue={draft?.next_action||''} className="rounded-lg border border-[var(--border)] p-3"/></label>
 {milestones.map((m,i)=><div key={i} className="flex flex-wrap gap-2"><label className="grid flex-1 gap-1 text-sm">Milestone {i+1}<input required maxLength={200} value={m.title} onChange={e=>setMilestones(items=>items.map((item,n)=>n===i?{...item,title:e.target.value}:item))} className="rounded-lg border border-[var(--border)] p-2"/></label><label className="grid gap-1 text-sm">Milestone {i+1} status<select value={m.status} onChange={e=>setMilestones(items=>items.map((item,n)=>n===i?{...item,status:e.target.value as Milestone['status']}:item))} className="rounded-lg border border-[var(--border)] p-2"><option value="pending">Upcoming</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select></label><button type="button" onClick={()=>setMilestones(items=>items.filter((_,n)=>n!==i))} className="text-sm underline" aria-label={`Remove milestone ${i+1}`}>Remove</button></div>)}
 <button type="button" disabled={milestones.length>=20} onClick={()=>setMilestones(items=>[...items,{title:'',status:'pending'}])} className="mr-4 text-sm underline disabled:opacity-40">Add milestone</button><button type="submit" className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm text-white">Save progress draft</button></ActionForm>;
}
