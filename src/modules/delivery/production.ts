import type {DeliveryService} from './templates';
export const productionStageLabels={visual:'Visual production',build:'Build',qa:'QA',launch:'Launch review',handoff:'Handoff',complete:'Complete'} as const;
export const productionGateLabels={brand_direction:'Brand direction',copy:'Copy confirmation',qa:'QA checks',launch:'Launch approval',handoff:'Handoff acceptance'} as const;
export type ProductionStage=keyof typeof productionStageLabels;
export type ProductionGate=keyof typeof productionGateLabels;
export type ProductionState={stage:ProductionStage|null;sequence:number;stages:ProductionStage[];gates:Record<ProductionGate,string|null>;issues:Record<ProductionStage,string[]>;context:string;required:boolean};
export type ProductionApproval={id:string;kind:ProductionGate;revision:number;version_id:string;scope_id:string;evidence:string;recorded_at:string;actor:{display_name:string|null}|null};
export type ProductionEvent={id:string;sequence:number;stage:ProductionStage;scope_id:string;evidence:string;recorded_at:string;actor:{display_name:string|null}|null};
export const qaChecks=['Functional checks and agreed acceptance criteria passed','Mobile and accessibility checks completed where applicable','Forms, links, integrations and failure paths checked where applicable','Access, privacy and required client dependencies verified','Release package and rollback or recovery plan checked'];
export function stagesForService(service:DeliveryService):ProductionStage[]{return service==='website'?['visual','build','qa','launch','handoff','complete']:service==='branding'?['visual','qa','launch','handoff','complete']:['build','qa','launch','handoff','complete'];}
