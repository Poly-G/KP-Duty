export const serviceTemplates = {
 website: {label:"Website",fields:{website_pages:"Pages and features needed",content_owner:"Who supplies copy and images?"}},
 branding: {label:"Branding",fields:{audience:"Who is the audience?",brand_deliverables:"Brand deliverables needed"}},
 less_office: {label:"Less Office",fields:{systems:"Current tools and systems",workflow:"Workflow to improve"}},
 care: {label:"Care",fields:{site_url:"Website URL",care_priorities:"Care priorities"}},
 snd: {label:"Sent & Delivered",fields:{systems:"Email platform and connected systems",agreed_plan:"Agreed engagement plan",measurement:"Measurement and success criteria"}},
} as const;
export type DeliveryService = keyof typeof serviceTemplates;
export const commonFields = {goal:"What should this project achieve?",approver_email:"Client approver email"};
const expandedCommon = {business_facts:"Business name, services and accurate contact facts",client_contact:"Primary contact and role",agreed_scope:"Agreed deliverables and boundaries",dependencies:"Known dependencies, timing and client actions"};
const expandedFields:Record<DeliveryService,Record<string,string>>={
 website:{customer_path:"Who should visit the website and what should they do?",proof:"Accurate claims, differentiators and proof",existing_brand:"Current logo, colors and brand materials",assets:"Available images and assets; what is missing?",domain:"Domain ownership and current website",contact_method:"Where should enquiries go?",branding_included:"Is branding included in the agreed scope? (yes/no)"},
 branding:{brand_context:"Business context and current brand",brand_constraints:"Direction, preferences and constraints",brand_uses:"Where will the brand be used?",assets:"Existing brand files and references"},
 less_office:{trigger:"What starts this workflow?",workflow_steps:"Current steps and who owns them",sanitized_example:"Sanitized example without personal data or secrets",exceptions:"Exceptions and approval points",desired_result:"Desired result and handoff owner"},
 care:{ownership:"Website/platform owner and safe access plan",handoff:"Existing handoff notes and support boundaries",known_issues:"Known issues and recent changes"},
 snd:{audience_signals:"Audience, lifecycle stage and relevant signals",baseline:"Current baseline and available measurement",access_plan:"Required access and safe ownership plan",asset_inventory:"Existing campaigns, content and related assets",handoff_owner:"Who will own the system after handoff?"},
};
export function onboardingFields(service:DeliveryService,version=1,answers:Record<string,string>={}):Record<string,string>{
 const base={...commonFields,...serviceTemplates[service].fields};
 if(version===1)return base;
 return {...base,...expandedCommon,...expandedFields[service],...(service==='website'&&answers.branding_included==='yes'?{brand_context:"Brand context and direction needed",brand_constraints:"Brand constraints and intended uses"}:{}) ,optional_notes:"Anything else? (optional)"};
}
export function requiredOnboardingKeys(service:DeliveryService,version=1,answers:Record<string,string>={}):string[]{return Object.keys(onboardingFields(service,version,answers)).filter(key=>key!=='optional_notes');}
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
