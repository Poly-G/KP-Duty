export type ReviewLane = 'internal' | 'client_record';
export type ReviewOutcome = 'approved' | 'changes_requested';
export type DeliverableKind = 'general' | 'brand_direction' | 'copy' | 'launch';
export const deliverableKinds: Record<DeliverableKind, string> = {
  general: 'Deliverable', brand_direction: 'Brand direction', copy: 'Copy', launch: 'Launch / handoff',
};
export type Review = {
  id: string; version_id: string; lane: ReviewLane; outcome: ReviewOutcome; note: string;
  client_name: string | null; evidence: string | null; recorded_by: string; recorded_at: string;
  actor: {display_name: string | null} | null; source?: 'staff' | 'portal';
};
export type DeliverableVersion = {
  id: string; deliverable_id: string; version: number; description: string; created_at: string;
  created_by: string; file_ids: string[]; published_at: string | null; preview_url?: string | null; reviews: Review[];
};
export type Deliverable = {
  id: string; project_id: string; title: string; kind: DeliverableKind; reviewer_id: string;
  reviewer: {display_name: string | null} | null; requirement_key: string | null;
  current_version: number; versions: DeliverableVersion[];
};
// Client projection intentionally omits drafts, internal reviews, evidence and team assignments.
export type ClientDeliverable = {
  id: string; title: string;
  versions: {id: string; version: number; description: string; file_ids: string[];
    published_at: string; outcome: ReviewOutcome | null; feedback: string | null}[];
};
export function clientDeliverables(deliverables: Deliverable[]): ClientDeliverable[] {
  return deliverables.flatMap(d => {
    const versions = d.versions.filter(v => v.published_at).sort((a,b)=>b.version-a.version).map(v => {
      const review = v.reviews.find(r => r.lane === 'client_record');
      return {id:v.id,version:v.version,description:v.description,file_ids:v.file_ids,
        published_at:v.published_at!,outcome:review?.outcome || null,feedback:review?.note || null};
    });
    return versions.length ? [{id:d.id,title:d.title,versions}] : [];
  });
}

export type PortalDecision = {id:string;version_id:string;actor_id:string;actor_name:string;outcome:ReviewOutcome;note:string;created_at:string};
export function mergeVersionReviews(versionId:string,staff:Review[],portal:PortalDecision[]):Review[]{
 const decision=portal.find(r=>r.version_id===versionId);
 const reviews=staff.filter(r=>r.version_id===versionId&&(!decision||r.lane!=='client_record'));
 return decision?[...reviews,{id:decision.id,version_id:decision.version_id,lane:'client_record',outcome:decision.outcome,note:decision.note,client_name:decision.actor_name,evidence:`Authenticated client portal decision ${decision.id}`,recorded_by:decision.actor_id,recorded_at:decision.created_at,actor:{display_name:decision.actor_name},source:'portal'}]:reviews;
}
