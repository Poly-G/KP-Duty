import {z} from 'zod';
import {onboardingFields,requiredOnboardingKeys} from '../delivery/templates.ts';
export const soltaServices=['website','branding','less_office','care'] as const;
const draftSchema=z.object({version:z.literal(1),service:z.enum(soltaServices),answers:z.record(z.string(),z.string().max(10000))});
export function readOnboardingDraft(value:unknown){
 const parsed=draftSchema.safeParse(value);
 if(!parsed.success)return null;
 const fields=onboardingFields(parsed.data.service,2,parsed.data.answers);
 return {...parsed.data,answers:Object.fromEntries(Object.keys(fields).map(key=>[key,parsed.data.answers[key]||'']))};
}
export function onboardingProblems(value:unknown):string[]{
 const draft=readOnboardingDraft(value);
 if(!draft)return ['Choose a service and enter valid answers.'];
 const fields=onboardingFields(draft.service,2,draft.answers);
 const problems=requiredOnboardingKeys(draft.service,2,draft.answers).filter(key=>!draft.answers[key]?.trim()).map(key=>`Complete: ${fields[key]}`);
 if(draft.answers.approver_email&&!z.email().safeParse(draft.answers.approver_email.trim()).success)problems.push('Enter a valid contact email.');
 if(draft.service==='website'&&!['yes','no'].includes(draft.answers.branding_included))problems.push('Choose whether branding is included.');
 return problems;
}
export type ClientRequestKind='feature'|'bug';
export type RequestPolicy={feature:'included'|'quote_required'|'unconfigured';bug:'included'|'quote_required'|'unconfigured'};
export function requestDisposition(kind:ClientRequestKind,policy:RequestPolicy){
 const rule=policy[kind];
 return rule==='included'?'review_included':rule==='quote_required'?'review_quote':'review_plan';
}
