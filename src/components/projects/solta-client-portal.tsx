import {randomUUID} from 'node:crypto';
import {getClientPortalStatus} from '@/modules/integrations/solta/onboarding/actions';
import {ClientPortalSetup} from './client-portal-setup';
export async function SoltaClientPortal({projectId,companyName}:{projectId:string;companyName:string}){
 const connection=await getClientPortalStatus(projectId);
 return <ClientPortalSetup projectId={projectId} companyName={companyName} requestId={randomUUID()} connection={connection}/>;
}
