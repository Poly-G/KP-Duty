import {z} from 'zod';

export const officeTaskKinds = {
 inquiry: {label:'New inquiry → customer list',trigger:'One new inquiry from the agreed form',result:'Create or update one contact and notify the business',tests:['A valid inquiry creates or updates the correct contact and sends one staff notification.','A duplicate inquiry does not create a second contact or notification.','Missing required contact details stop the run and are visible for staff review.']},
 reminder: {label:'Appointment → reminder',trigger:'One appointment scheduled in the agreed calendar',result:'Send one approved reminder at the agreed time',tests:['A confirmed appointment sends the approved reminder with the correct local date and time.','A cancelled or rescheduled appointment does not send an outdated reminder.','Missing contact details or permission prevent sending and are visible for staff review.']},
 review: {label:'Completed job → review request',trigger:'One job marked complete in the agreed system',result:'Send one approved request with the correct review link',tests:['An eligible completed job sends one approved request with the correct review link.','A duplicate completion event does not send another request.','An opted-out contact does not receive a request; no satisfaction or rating filter is used.']},
} as const;
export type OfficeTaskKind=keyof typeof officeTaskKinds;
export const officeScopeInput=z.object({
 kind:z.enum(['inquiry','reminder','review']),toolsConfirmed:z.literal(true),costsConfirmed:z.literal(true),sourceTool:z.string().trim().min(2).max(120),destinationTool:z.string().trim().min(2).max(120),
 thirdTool:z.string().trim().max(120).default(''),details:z.string().trim().min(10).max(3000),softwareCosts:z.string().trim().min(5).max(1000),
 message:z.string().trim().max(2000).default(''),
}).strict();
export type OfficeScopeInput=z.infer<typeof officeScopeInput>;
export function officeScope(value:OfficeScopeInput){
 const input=officeScopeInput.parse(value),task=officeTaskKinds[input.kind];
 const tools=[input.sourceTool,input.destinationTool,input.thirdTool].filter(Boolean);
 return {
  deliverables:['Standard Less Office Work: '+task.label,'Starting event: '+task.trigger,'Agreed tools: '+tools.join(' → '),'Outcome: '+task.result,'Client-specific setup: '+input.details,input.message?'Message wording for client approval: '+input.message:'Message wording must be approved before sending.','Acceptance tests:',...task.tests.map((test,index)=>(index+1)+'. '+test)].join('\n'),
  exclusions:'One task, one primary starting event, up to three supported tools and two simple conditions. No custom application, two-way sync, migration, data cleanup, multi-channel campaign or ongoing monitoring. Multiple tasks and broader work require a separate quote. The client owns the accounts, supplies accurate business facts and contact permissions, provides access safely, names one final approver, and approves message wording. No passwords or secrets in project notes.',
  commercial_terms:'$799 USD one-time, payable in full after approval of this exact scope and before delivery starts. No monthly fee from Solta. Provider subscriptions and usage are paid directly by the client. Agreed software costs: '+input.softwareCosts+'. Full refund before the project-start notice; if the work does not fit Standard before starting, choose a full refund or credit toward a separately approved quote.',
  timing:'Typically 5–10 business days after payment, reviewed onboarding, required access and capacity are ready. Includes the main path and two exception tests, two consolidated revision/testing rounds, written handoff notes, a recorded walkthrough, go-live and a 30-day workmanship warranty. Timeline pauses while waiting on the client. A revision of scope requires fresh approval.',
  change_reason:'Initial Standard office task scope prepared for client review.',
 };
}
