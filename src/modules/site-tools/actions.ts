"use server";

import { z } from "zod";
import { addActivityNote, type AddNoteInput } from "@/modules/activity/service";
import {
  createDecisionRecord,
  resolveDecisionRecord,
  setDecisionStatusRecord,
  type CreateDecisionInput,
} from "@/modules/decisions/service";
import { listDecisions } from "@/modules/decisions/queries";
import {
  createOpportunityRecord,
  createOrganizationRecord,
  createPersonRecord,
  moveOpportunityToStageSlug,
  updateOpportunity,
  type CreateOpportunityInput,
  type CreateOrganizationInput,
  type CreatePersonInput,
} from "@/modules/crm/service";
import { getBusinessPipeline, searchCrm } from "@/modules/crm/queries";
import {
  createProjectRecord,
  updateProjectRecord,
  type CreateProjectInput,
} from "@/modules/projects/service";
import {
  listProjects,
  listRecentActivity,
} from "@/modules/projects/queries";
import {
  assignTask,
  createTaskRecord,
  setOwnedTaskStage,
  updateOwnedTask,
  type CreateTaskInput,
} from "@/modules/work/service";
import {
  listActiveTeamMembers,
  listMyWork,
  listTeamWork,
} from "@/modules/work/queries";
import type {
  TaskAvailability,
  TaskPriority,
  TaskStage,
} from "@/modules/work/types";

const uuid = z.string().uuid();

function shapeTask(task: Awaited<ReturnType<typeof listMyWork>>[number]) {
  return {
    id: task.id,
    referenceCode: task.reference_code,
    title: task.title,
    stage: task.stage,
    availability: task.availability,
    priority: task.priority,
    dueAt: task.due_at,
    nextAction: task.next_action,
    waitingOn: task.waiting_on,
    finishedAt: task.finished_at,
    business: task.business
      ? {
          id: task.business.id,
          slug: task.business.slug,
          name: task.business.name,
        }
      : null,
  };
}

export async function getMyWorkForSiteTool() {
  const tasks = await listMyWork();
  return {
    scope: "current_kp_user",
    tasks: tasks.map(shapeTask),
  };
}

export async function getTeamWorkForSiteTool() {
  const tasks = await listTeamWork();
  return {
    scope: "kp_team_admin",
    tasks: tasks.map((task) => ({
      ...shapeTask(task),
      owner: task.owner,
    })),
  };
}

export async function getTeamMembersForSiteTool() {
  const members = await listActiveTeamMembers();
  return {
    members: members.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      role: member.role,
    })),
  };
}

export async function createTaskForSiteTool(
  requestKey: string,
  input: CreateTaskInput,
) {
  return createTaskRecord({
    source: "site_tools",
    requestKey,
    input,
  });
}

export async function completeTaskForSiteTool(taskId: string) {
  const task = await setOwnedTaskStage(uuid.parse(taskId), "finished");
  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      stage: task.stage,
      finishedAt: task.finished_at,
    },
  };
}

export async function updateTaskForSiteTool(
  taskId: string,
  patch: {
    stage?: TaskStage;
    availability?: TaskAvailability;
    priority?: TaskPriority;
    dueAt?: string | null;
    nextAction?: string | null;
    waitingOn?: string | null;
    notes?: string | null;
  },
) {
  const id = uuid.parse(taskId);
  const parsed = z
    .object({
      stage: z.enum(["todo", "working", "finished"]).optional(),
      availability: z.enum(["yes", "waiting", "blocked", "parked"]).optional(),
      priority: z.enum(["critical", "high", "normal", "low"]).optional(),
      dueAt: z.string().datetime({ offset: true }).nullable().optional(),
      nextAction: z.string().trim().nullable().optional(),
      waitingOn: z.string().trim().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
    })
    .parse(patch);

  let result = null;

  if (parsed.stage !== undefined) {
    result = await setOwnedTaskStage(id, parsed.stage);
  }

  const details = {
    availability: parsed.availability,
    priority: parsed.priority,
    dueAt: parsed.dueAt,
    nextAction: parsed.nextAction,
    waitingOn: parsed.waitingOn,
    notes: parsed.notes,
  };

  const hasDetails = Object.values(details).some(
    (value) => value !== undefined,
  );

  if (hasDetails) {
    result = await updateOwnedTask(id, details);
  }

  if (!result) {
    throw new Error("No task changes were provided.");
  }

  return result;
}

export async function assignTaskForSiteTool(
  taskId: string,
  ownerId: string | null,
) {
  return assignTask(uuid.parse(taskId), ownerId);
}

export async function searchCrmForSiteTool(query: string) {
  return searchCrm(query);
}

export async function getPipelineForSiteTool(businessSlug: string) {
  const pipeline = await getBusinessPipeline(businessSlug);
  if (!pipeline) throw new Error("Business pipeline not found.");

  return {
    business: pipeline.business,
    pipeline: pipeline.pipeline,
    stages: pipeline.stages,
    opportunities: pipeline.opportunities.map((opportunity) => ({
      id: opportunity.id,
      referenceCode: opportunity.reference_code,
      name: opportunity.name,
      stageId: opportunity.stage_id,
      organization: opportunity.organization,
      owner: opportunity.owner,
      priority: opportunity.priority,
      nextAction: opportunity.next_action,
      nextActionAt: opportunity.next_action_at,
      source: opportunity.source,
    })),
  };
}

export async function createOrganizationForSiteTool(
  requestKey: string,
  input: CreateOrganizationInput,
) {
  return createOrganizationRecord({
    source: "site_tools",
    requestKey,
    input,
  });
}

export async function createPersonForSiteTool(
  requestKey: string,
  input: CreatePersonInput,
) {
  return createPersonRecord({
    source: "site_tools",
    requestKey,
    input,
  });
}

export async function createOpportunityForSiteTool(
  requestKey: string,
  input: CreateOpportunityInput,
) {
  return createOpportunityRecord({
    source: "site_tools",
    requestKey,
    input,
  });
}

export async function updateOpportunityForSiteTool(
  opportunityId: string,
  patch: {
    stageSlug?: string;
    priority?: TaskPriority;
    nextAction?: string | null;
    nextActionAt?: string | null;
  },
) {
  const id = uuid.parse(opportunityId);
  const parsed = z
    .object({
      stageSlug: z.string().trim().min(1).optional(),
      priority: z.enum(["critical", "high", "normal", "low"]).optional(),
      nextAction: z.string().trim().nullable().optional(),
      nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .parse(patch);

  let result = null;

  if (parsed.stageSlug !== undefined) {
    result = await moveOpportunityToStageSlug(id, parsed.stageSlug);
  }

  const details = {
    priority: parsed.priority,
    nextAction: parsed.nextAction,
    nextActionAt: parsed.nextActionAt,
  };

  if (Object.values(details).some((value) => value !== undefined)) {
    result = await updateOpportunity(id, details);
  }

  if (!result) throw new Error("No opportunity changes were provided.");
  return result;
}

export async function getProjectsForSiteTool() {
  const projects = await listProjects();
  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      phase: project.phase,
      health: project.health,
      nextMilestone: project.next_milestone,
      nextMilestoneAt: project.next_milestone_at,
      business: project.business,
      organization: project.organization,
      owner: project.owner,
    })),
  };
}

export async function createProjectForSiteTool(
  requestKey: string,
  input: CreateProjectInput,
) {
  return createProjectRecord({
    source: "site_tools",
    requestKey,
    input,
  });
}

export async function updateProjectForSiteTool(
  projectId: string,
  patch: Parameters<typeof updateProjectRecord>[1],
) {
  return updateProjectRecord(uuid.parse(projectId), patch);
}

export async function getDecisionsForSiteTool() {
  const decisions = await listDecisions();
  return {
    decisions: decisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      domain: decision.domain,
      mode: decision.mode,
      status: decision.status,
      priority: decision.priority,
      neededBy: decision.needed_by,
      context: decision.context,
      recommendation: decision.recommendation,
      finalDecision: decision.final_decision,
      effectiveDate: decision.effective_date,
      revisitTrigger: decision.revisit_trigger,
      business: decision.business,
      owner: decision.owner,
    })),
  };
}

export async function createDecisionForSiteTool(
  requestKey: string,
  input: CreateDecisionInput,
) {
  return createDecisionRecord({
    source: "site_tools",
    requestKey,
    input,
  });
}

export async function updateDecisionStatusForSiteTool(
  decisionId: string,
  status: "open" | "discussing" | "deferred" | "superseded",
) {
  return setDecisionStatusRecord(uuid.parse(decisionId), status);
}

export async function resolveDecisionForSiteTool(
  decisionId: string,
  finalDecision: string,
  effectiveDate?: string | null,
) {
  return resolveDecisionRecord(
    uuid.parse(decisionId),
    finalDecision,
    effectiveDate,
  );
}

export async function getRecentActivityForSiteTool(limit = 12) {
  const events = await listRecentActivity(
    z.number().int().min(1).max(50).parse(limit),
  );

  return {
    events: events.map((event) => ({
      id: event.id,
      eventType: event.event_type,
      source: event.source,
      summary: event.summary,
      occurredAt: event.occurred_at,
      business: event.business,
      actor: event.actor,
      organization: event.organization,
      projectId: event.project_id,
      opportunityId: event.opportunity_id,
      taskId: event.task_id,
      decisionId: event.decision_id,
    })),
  };
}

export async function addNoteForSiteTool(
  requestKey: string,
  input: AddNoteInput,
) {
  return addActivityNote({
    source: "site_tools",
    requestKey,
    input,
  });
}
