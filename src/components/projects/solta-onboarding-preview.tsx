'use client';
import {useState} from 'react';
import {onboardingFields,serviceTemplates} from '@/modules/delivery/templates';
import {readOnboardingDraft,onboardingProblems,soltaServices,requestDisposition} from '@/modules/client-portal/onboarding';

const storageKey='solta-portal-design-draft-v1';
const field='mt-2 w-full rounded-lg border border-[#4a4f5c] bg-white p-3 text-[#111318]';
const button='min-h-11 rounded-lg bg-[#354f8f] px-5 py-3 font-semibold text-white disabled:opacity-50';
export function SoltaOnboardingPreview(){
 const [service,setService]=useState<(typeof soltaServices)[number]>('website');
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [status,setStatus]=useState('');
 const [problems,setProblems]=useState<string[]>([]);
 const [step,setStep]=useState<'details'|'review'>('details');
 const [kind,setKind]=useState<'feature'|'bug'>('feature');
 const [title,setTitle]=useState(''); const [details,setDetails]=useState('');
 const [requests,setRequests]=useState<{id:number;kind:string;title:string;details:string;route:string}[]>([]);
 function restore(){try{const raw=localStorage.getItem(storageKey);const draft=raw?readOnboardingDraft(JSON.parse(raw)):null;if(draft){setService(draft.service);setAnswers(draft.answers);setStep('details');setProblems([]);setStatus('Your sample draft was restored.');}else setStatus('No valid sample draft found in this browser.');}catch{setStatus('Saved drafts are unavailable in this browser.');}}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,service,answers}));setStatus('Sample draft saved on this browser.');}catch{setStatus('Could not save. Keep this page open to retain your answers.');}}
 const fields=onboardingFields(service,2,answers);
 return <>
  <section id="onboarding" className="mt-10 rounded-xl bg-[#f5f0e8] p-5 sm:p-8">
   <h2 className="text-3xl font-bold">Tell us about your project</h2><p className="mt-3">Design preview: use sample information only. Drafts stay in this browser; nothing is sent to your team.</p>
   <button type="button" className="mt-4 underline" onClick={restore}>Restore saved draft</button>
   <label className="mt-5 block">Sample service<select className={field} value={service} onChange={e=>{setService(e.target.value as typeof service);setAnswers({});setStep('details');setProblems([]);setStatus('Service changed. Save to replace your browser draft.');}}>{soltaServices.map(s=><option key={s} value={s}>{s==='less_office'?'Less Office Work':serviceTemplates[s].label}</option>)}</select></label>
   {step==='details'?<form className="mt-6 space-y-5" onSubmit={e=>{e.preventDefault();const errors=onboardingProblems({version:1,service,answers});setProblems(errors);if(!errors.length){setStep('review');setStatus('Review your sample answers before finishing.');}}}>
    {Object.entries(fields).map(([key,label])=><label key={key} className="block">{label}{key==='branding_included'?<select required className={field} value={answers[key]||''} onChange={e=>setAnswers(a=>({...a,[key]:e.target.value}))}><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select>:key==='approver_email'?<input required type="email" maxLength={320} className={field} value={answers[key]||''} onChange={e=>setAnswers(a=>({...a,[key]:e.target.value}))}/>:<textarea required={key!=='optional_notes'} maxLength={10000} rows={3} className={field} value={answers[key]||''} onChange={e=>setAnswers(a=>({...a,[key]:e.target.value}))}/>}</label>)}
    <div className="flex flex-wrap gap-4"><button type="submit" className={button}>Review your answers</button><button type="button" className="underline" onClick={save}>Save draft</button></div>
   </form>:<div className="mt-6"><dl className="space-y-4">{Object.entries(fields).map(([key,label])=><div key={key}><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{answers[key]?.trim()||'Not supplied'}</dd></div>)}</dl><div className="mt-6 flex flex-wrap gap-4"><button className={button} onClick={()=>{save();setStatus('Sample onboarding complete. No live submission, payment or delivery start has occurred.');}}>Finish sample onboarding</button><button className="underline" onClick={()=>setStep('details')}>Edit answers</button></div></div>}
   {problems.length?<ul role="alert" className="mt-4 list-disc pl-5">{problems.map(p=><li key={p}>{p}</li>)}</ul>:null}<p role="status" className="mt-4">{status}</p>
  </section>
  <section id="requests" className="mt-10 p-5 sm:p-8"><h2 className="text-3xl font-bold">Need something changed?</h2><p className="mt-3">Tell us what you need. Your plan’s allowances still need to be confirmed. Requests go to review; they don’t approve extra work or charges.</p>
   <form className="mt-6 space-y-5" onSubmit={e=>{e.preventDefault();if(!title.trim()||!details.trim())return;setRequests(r=>[...r,{id:Date.now(),kind,title:title.trim(),details:details.trim(),route:requestDisposition(kind,{feature:'unconfigured',bug:'unconfigured'})}]);setTitle('');setDetails('');}}>
    <label className="block">What do you need?<select className={field} value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="feature">Request a change or feature</option><option value="bug">Report something broken</option></select></label>
    <label className="block">Short description<input required maxLength={200} value={title} className={field} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="block">{kind==='bug'?'What happened, and what did you expect?':'What would you like changed, and why?'}<textarea required maxLength={10000} rows={4} value={details} className={field} onChange={e=>setDetails(e.target.value)}/></label>
    <button className={button}>Try sample request</button><p className="text-sm">Sample requests last until you leave or refresh. Nothing is sent.</p>
   </form><div aria-live="polite" className="mt-6 space-y-4">{requests.map(r=><article key={r.id} className="rounded-lg bg-[#f5f0e8] p-5"><h3 className="font-semibold">{r.title}</h3><p className="mt-2 whitespace-pre-wrap break-words">{r.details}</p><p className="mt-3 text-sm">Sample received · Plan review needed</p></article>)}</div>
  </section>
 </>;
}
