import {notFound} from "next/navigation";
import Link from "next/link";
import {requireActiveIdentity} from "@/lib/auth/current-user";
import {PageHeading} from "@/components/page-heading";
import {DeliverySandbox} from "@/components/projects/delivery-sandbox";
export default async function PreviewPage({params}:{params:Promise<{business:string}>}){
 await requireActiveIdentity();const {business}=await params;if(!["solta","snd"].includes(business))notFound();
 return <><Link href={`/businesses/${business}`} className="mb-4 inline-block text-sm text-[var(--muted)]">← Business workspace</Link><PageHeading eyebrow="Staff practice area" title="Try a sample client project" description="Test onboarding and readiness without changing live work."/><DeliverySandbox business={business}/></>;
}
