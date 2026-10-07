'use client';
import {useState} from 'react';
import {ActionForm} from './action-form';
import {changeStaff} from '@/modules/team/actions';
import type {StaffMember} from '@/modules/team/types';
export function TeamMemberEditor({member,self}:{member:StaffMember;self:boolean}){
 const [open,setOpen]=useState(false),[role,setRole]=useState(member.role),[status,setStatus]=useState(member.status),[reason,setReason]=useState(''),[typed,setTyped]=useState(''),[verified,setVerified]=useState(false);
 const phrase=`UPDATE ${member.display_name||member.id}`;
 const input='rounded-lg border border-[var(--border)] p-3';
 if(!open)return <button className={`${input} mt-3 text-sm`} onClick={()=>setOpen(true)}>Manage {member.display_name||member.email}</button>;
 return <div className="mt-4 rounded-xl border border-[var(--border)] p-4"><p className="text-sm text-[var(--muted)]">Active staff can read shared company work in all businesses. Members manage their own tasks and collaborate on projects. Admins also manage assignments, approvals, the team and recoverable removal. Disabling access keeps all work and ownership; reassign unfinished work separately.</p>{self?<p className="mt-2 text-sm">Another admin must change your own role or access.</p>:null}
 <ActionForm key={member.revision} action={changeStaff} className="mt-4 grid gap-3" errorMessage="Couldn’t save this staff change. Reload if the record changed; activation requires a confirmed login, and another admin must change your own access.">
 <input type="hidden" name="id" value={member.id}/><input type="hidden" name="revision" value={member.revision}/>
 <label className="grid gap-2 text-sm">Display name<input name="name" defaultValue={member.display_name||''} required maxLength={120} className={input}/></label>
 <label className="grid gap-2 text-sm">Role<select name="role" value={role} disabled={self} onChange={e=>{setRole(e.target.value as StaffMember['role']);setVerified(false);}} className={input}><option value="team_member">Team member</option><option value="admin">Admin</option></select></label>{self?<input type="hidden" name="role" value={role}/>:null}
 <label className="grid gap-2 text-sm">Access<select name="status" value={status} disabled={self} onChange={e=>{setStatus(e.target.value as StaffMember['status']);setVerified(false);}} className={input}><option value="active" disabled={!member.confirmed||!member.login_available}>Active</option><option value="disabled">Disabled / awaiting activation</option></select></label>{self?<input type="hidden" name="status" value={status}/>:null}
 {role==='admin'&&member.role!=='admin'?<p className="text-sm">Admin access includes shared company records, team access and approval authority. Verify that this person should have those permissions.</p>:null}
 {status==='disabled'?<p className="text-sm">{member.open_tasks} unfinished tasks and {member.open_projects} open projects remain assigned to this person. Their history and records will be retained.</p>:null}
 <label className="grid gap-2 text-sm">Reason for change<textarea name="reason" required minLength={5} maxLength={2000} className={input} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <label className="grid gap-2 text-sm">Type exactly: {phrase}<input name="confirmation" required autoComplete="off" className={input} value={typed} onChange={e=>setTyped(e.target.value)}/></label>
 <label className="flex gap-2 text-sm"><input type="checkbox" name="verified" checked={verified} onChange={e=>setVerified(e.target.checked)}/>I verified this person and the requested access.</label>
 <button disabled={typed!==phrase||reason.trim().length<5||!verified} className="rounded-lg bg-[var(--text)] p-3 text-sm text-white disabled:opacity-40">Save staff change</button>
 </ActionForm><button className="mt-3 text-sm underline" onClick={()=>{setOpen(false);setRole(member.role);setStatus(member.status);setReason('');setTyped('');setVerified(false);}}>Cancel</button></div>;
}
