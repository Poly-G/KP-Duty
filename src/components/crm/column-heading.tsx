"use client";

import { LockKeyhole, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameCrmColumn } from "@/modules/crm/column-actions";
import type { PipelineStage } from "@/modules/crm/types";

export function ColumnHeading({ stage, pipelineId, onRenamed }: {
  stage: PipelineStage;
  pipelineId: string;
  onRenamed: (stage: PipelineStage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editable = stage.kind === "open" && stage.slug === `custom-${stage.id}`;

  if (!editable) return <h2 className="flex items-center gap-1.5 break-words text-sm font-semibold">
    {stage.name}<span title="Built-in column — name is locked" aria-label="Built-in column, name locked"><LockKeyhole size={12} className="shrink-0 text-[var(--muted)]" /></span>
  </h2>;

  if (!editing) return <h2 className="min-w-0 text-sm font-semibold"><button type="button" aria-label={`Rename ${stage.name} column`} title="Rename column" onClick={() => { setName(stage.name); setError(""); setEditing(true); }} className="flex items-center gap-1.5 rounded text-left hover:bg-white">
    <span className="break-words">{stage.name}</span><Pencil size={12} className="shrink-0 text-[var(--muted)]" />
  </button></h2>;

  return <form className="min-w-0 flex-1" onSubmit={event => {
    event.preventDefault();
    if (pending || !name.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        const renamed = await renameCrmColumn(pipelineId, stage.id, stage.name, name);
        onRenamed(renamed); setEditing(false); router.refresh();
      } catch { setError("Couldn’t save. Your draft is kept; retry or refresh if someone else renamed this column."); }
    });
  }}>
    <input autoFocus required maxLength={80} aria-label="Column name" value={name} disabled={pending} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Escape" && !pending) { event.stopPropagation(); setEditing(false); } }} className="w-full rounded-lg border border-[var(--border)] bg-white p-2 text-sm" />
    <div className="mt-2 flex gap-2"><button type="submit" disabled={pending || !name.trim()} className="rounded bg-[var(--accent)] px-2 py-1 text-xs text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button><button type="button" disabled={pending} onClick={() => setEditing(false)} className="text-xs text-[var(--muted)]">Cancel</button></div>
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
  </form>;
}
