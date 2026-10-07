import Link from 'next/link';
import {getDeliverables} from '@/modules/deliverables/queries';
import {clientDeliverables} from '@/modules/deliverables/types';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {getDelivery} from '@/modules/delivery/queries';
import {getProjectCollaboration} from '@/modules/project-collaboration/queries';
import {ClientProjectView} from '@/components/projects/client-project-view';
export async function generateMetadata({params}:{params:Promise<{business:string}>}){const {business}=await params;return {title:business==='solta'?'Solta · Project':'Sent & Delivered · Project'};}
export default async function ClientPreview({params}:{params:Promise<{business:string;id:string}>}){
 await requireActiveIdentity();const {business,id}=await params;if(!['solta','snd'].includes(business)||!z.string().uuid().safeParse(id).success)notFound();
 const delivery=await getDelivery(id,business);if(!delivery)notFound();const [data,deliverables]=await Promise.all([getProjectCollaboration(id),getDeliverables(id)]);
 return <main className="mx-auto max-w-3xl p-5"><aside className="mb-4 rounded-xl border border-[var(--border)] p-4 text-sm">Staff preview · client login will be added later. <Link href={`/businesses/${business}/projects/${id}`} className="underline">Return to project</Link></aside><ClientProjectView business={business} name={delivery.project.name} progress={data.published} files={data.files} messages={data.messages} deliverables={clientDeliverables(deliverables)}/></main>;
}
