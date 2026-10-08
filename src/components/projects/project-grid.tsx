"use client";

import { ExternalLink, X } from "lucide-react";
import { useState, useTransition } from "react";
import { setProjectStatus } from "@/modules/projects/actions";
import type {
  ProjectRecord,
  ProjectStatus,
} from "@/modules/projects/types";

const statusLabel: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  waiting: "Waiting",
  blocked: "Blocked",
  complete: "Complete",
  cancelled: "Cancelled",
};

const healthLabel: Record<ProjectRecord["health"], string> = {
  on_track: "On track",
  needs_attention: "Needs attention",
  at_risk: "At risk",
  complete: "Complete",
};

function ProjectDetail({
  project,
  onClose,
  onStatus,
}: {
  project: ProjectRecord;
  onClose: () => void;
  onStatus: (status: ProjectStatus) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/15" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--muted)]">
              {project.business.name}
            </p>
            <h2 className="text-xl font-semibold leading-7">{project.name}</h2>
            {project.organization ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {project.organization.name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close project details"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-4 rounded-xl bg-[var(--surface-subtle)] p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
              Status
            </p>
            <p className="mt-1 text-sm">{statusLabel[project.status]}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
              Health
            </p>
            <p className="mt-1 text-sm">{healthLabel[project.health]}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
              Phase
            </p>
            <p className="mt-1 text-sm">{project.phase || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
              Owner
            </p>
            <p className="mt-1 text-sm">
              {project.owner?.display_name || "Unassigned"}
            </p>
          </div>
        </div>

        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Next milestone
          </p>
          <p className="mt-2 text-sm leading-6">
            {project.next_milestone || "No next milestone yet."}
          </p>
        </section>

        <div className="mt-7 flex flex-wrap gap-2">
          {(["active", "waiting", "blocked", "complete"] as ProjectStatus[]).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => onStatus(status)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-subtle)]"
              >
                {statusLabel[status]}
              </button>
            ),
          )}
        </div>

        {project.external_project_url ? (
          <a
            href={project.external_project_url}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
          >
            Open detailed project
            <ExternalLink size={14} />
          </a>
        ) : null}
      </aside>
    </div>
  );
}

export function ProjectGrid({
  initialProjects,
}: {
  initialProjects: ProjectRecord[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [selected, setSelected] = useState<ProjectRecord | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState("");

  const handleStatus = (project: ProjectRecord, status: ProjectStatus) => {
    if (isPending) return;
    setSaveError("");
    const nextHealth = status === "complete" ? "complete" : project.health;
    const nextProject = { ...project, status, health: nextHealth } as ProjectRecord;

    setProjects((current) =>
      current.map((candidate) =>
        candidate.id === project.id ? nextProject : candidate,
      ),
    );
    setSelected(nextProject);

    startTransition(async () => {
      try {
        const saved = await setProjectStatus(project.id, status);
        const confirmed = { ...project, ...saved };
        setProjects((current) => current.map((candidate) => candidate.id === project.id ? confirmed : candidate));
        setSelected(confirmed);
      } catch {
        setSaveError("The change couldn’t be saved. Please try again.");
        setProjects((current) => current.map(candidate => candidate.id === project.id ? project : candidate));
        setSelected(project);
      }
    });
  };

  if (!projects.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
        No projects yet.
      </p>
    );
  }

  return (
    <fieldset disabled={isPending} className="contents">
      {isPending ? <p role="status">Saving…</p> : null}
      {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => setSelected(project)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-neutral-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--muted-strong)]">
                {project.business.name}
              </span>
              <span className="text-[10px] font-medium text-[var(--muted)]">
                {healthLabel[project.health]}
              </span>
            </div>
            <h2 className="mt-4 text-sm font-semibold">{project.name}</h2>
            {project.organization ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {project.organization.name}
              </p>
            ) : null}
            <div className="mt-5 border-t border-[var(--border)] pt-3">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                Next milestone
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-strong)]">
                {project.next_milestone || "Not set"}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <ProjectDetail
          project={selected}
          onClose={() => setSelected(null)}
          onStatus={(status) => handleStatus(selected, status)}
        />
      ) : null}
    </fieldset>
  );
}
