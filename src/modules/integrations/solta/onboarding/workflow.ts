import {onboardingStatus,type OnboardingRequest,type SetupPeople} from './contract.ts';
type Context=Omit<Extract<OnboardingRequest,{operation:'commit'}>,'operation'|'requestId'|'portalProjectId'>;
// Durable steps deliberately keep Solta access closed until KP links and storage are ready.
export async function runClientSetup(context:Context,requestId:string,people:SetupPeople,steps:{prepare:()=>Promise<{portalProjectId:string;projectId:string;organizationId:string}>,link:(id:string)=>Promise<void>,complete:(id:string)=>Promise<void>,remote:(request:OnboardingRequest)=>Promise<unknown>}){
 const prepared=await steps.prepare();if(prepared.projectId!==context.projectId||prepared.organizationId!==context.organizationId)throw new Error('Setup identity mismatch');
 const portalProjectId=prepared.portalProjectId;
 const staged=await steps.remote({...context,operation:'prepare',requestId,portalProjectId,people}) as {prepared?:boolean;portalProjectId?:string};
 if(!staged?.prepared||staged.portalProjectId!==portalProjectId)throw new Error('Setup preparation failed');
 await steps.link(portalProjectId);
 const ready=onboardingStatus.parse(await steps.remote({...context,operation:'commit',requestId,portalProjectId}));
 if(!ready.ready||ready.portalProjectId!==portalProjectId)throw new Error('Client access is not ready');
 await steps.complete(portalProjectId);return ready;
}
