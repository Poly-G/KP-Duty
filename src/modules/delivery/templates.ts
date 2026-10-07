export const serviceTemplates = {
 website: {label:"Website",fields:{website_pages:"Pages and features needed",content_owner:"Who supplies copy and images?"}},
 branding: {label:"Branding",fields:{audience:"Who is the audience?",brand_deliverables:"Brand deliverables needed"}},
 less_office: {label:"Less Office",fields:{systems:"Current tools and systems",workflow:"Workflow to improve"}},
 care: {label:"Care",fields:{site_url:"Website URL",care_priorities:"Care priorities"}},
 snd: {label:"Sent & Delivered",fields:{systems:"Email platform and connected systems",agreed_plan:"Agreed engagement plan",measurement:"Measurement and success criteria"}},
} as const;
export type DeliveryService = keyof typeof serviceTemplates;
export const commonFields = {goal:"What should this project achieve?",approver_email:"Client approver email"};
export function onboardingFields(service:DeliveryService):Record<string,string>{return {...commonFields,...serviceTemplates[service].fields};}
export type Engagement = {id:string;service:DeliveryService;template_version:number;revision:number;answers:Record<string,string>;submitted_at:string|null;onboarding_reviewed:boolean;scope_approved:boolean;payment_required:boolean;payment_evidence:string|null;access_ready:boolean;capacity_ready:boolean;started_at:string|null;started_by:string|null};
export function readinessIssues(e:Engagement):string[]{
 const issues:string[]=[];
 if(!e.scope_approved)issues.push("Approve scope and terms");
 if(!e.submitted_at)issues.push("Submit onboarding");
 if(!e.onboarding_reviewed)issues.push("Review onboarding");
 if(e.payment_required&&!e.payment_evidence?.trim())issues.push("Verify required payment with evidence");
 if(!e.access_ready)issues.push("Confirm required access and dependencies");
 if(!e.capacity_ready)issues.push("Confirm delivery capacity");
 return issues;
}
