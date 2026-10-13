import type {OnboardingStatus} from './contract.ts';
/** Setup remains complete if a provider fails; each person's durable invite can be retried. */
export async function sendSetupWelcomes(status:OnboardingStatus,send:(email:string)=>Promise<void>){
 if(!status.ready||!status.jobId)throw new Error('Finish client setup first');
 const recipients=[...new Set(status.inviteEmails)].filter(email=>!status.welcomeAccepted.includes(email));
 const pending:string[]=[];
 // Avoid a burst of ten provider requests when a company has several teammates.
 for(let offset=0;offset<recipients.length;offset+=2){
  const group=recipients.slice(offset,offset+2),results=await Promise.allSettled(group.map(email=>send(email)));
  pending.push(...group.filter((_,index)=>results[index].status==='rejected'));
 }
 return pending;
}
