import {requireAdminIdentity} from "@/lib/auth/current-user";
import {PageHeading} from "@/components/page-heading";
import {DocumentEditor} from "@/components/knowledge/document-editor";
export default async function NewGuide(){await requireAdminIdentity();return <><PageHeading title="Add a guide" description="Keep proposals as drafts until the responsible owner approves them."/><DocumentEditor/></>;}
