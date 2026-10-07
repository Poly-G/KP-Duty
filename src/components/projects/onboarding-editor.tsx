'use client';
import {useState} from 'react';
import {ActionForm} from '@/components/action-form';
import {saveClientDelivery} from '@/modules/delivery/actions';
import {onboardingFields} from '@/modules/delivery/templates';
import type {Engagement} from '@/modules/delivery/templates';
export function OnboardingEditor({engagement:e,business,companyName}:{engagement:Engagement;business:string;companyName:string}){
 const [answers,setAnswers]=useState<Record<string,string>>({...e.answers,...(e.template_version===2&&!e.answers.business_facts?{business_facts:companyName}:{})});
 const fields=onboardingFields(e.service,e.template_version,answers);
 return <ActionForm key={e.revision} action={saveClientDelivery} className="mt-5 grid gap-4 sm:grid-cols-2" errorMessage="Couldn’t save onboarding. Reload if a teammate changed it, then retry."><input type="hidden" name="id" value={e.id}/><input type="hidden" name="business" value={business}/><input type="hidden" name="revision" value={e.revision}/><input type="hidden" name="operation" value="answers"/>
 <p className="text-sm text-[var(--muted)] sm:col-span-2">Save partial answers and return later. “Not sure” is a valid answer for details that need team help; it does not mean the requirement has been accepted. Do not upload passwords or secrets.</p>
 {Object.entries(fields).map(([key,label])=><label key={key} className="grid gap-2 text-sm">{label}{key==='branding_included'?<select name={key} value={answers[key]||''} onChange={event=>setAnswers({...answers,[key]:event.target.value})} className="rounded-lg border border-[var(--border)] p-3"><option value="">Choose</option><option value="yes">Yes — included in agreed scope</option><option value="no">No — use existing brand</option></select>:key==='approver_email'?<input name={key} type="email" value={answers[key]||''} onChange={event=>setAnswers({...answers,[key]:event.target.value})} className="rounded-lg border border-[var(--border)] p-3"/>:<textarea name={key} value={answers[key]||''} onChange={event=>setAnswers({...answers,[key]:event.target.value})} maxLength={10000} rows={3} className="rounded-lg border border-[var(--border)] p-3"/>}</label>)}
 <button type="submit" className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm text-white">Save draft</button></ActionForm>;
}
