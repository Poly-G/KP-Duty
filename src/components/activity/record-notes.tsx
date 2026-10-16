"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createNote, getNotes, type ActivityNote } from "@/modules/activity/actions";
import type { AddNoteInput } from "@/modules/activity/service";

type Target = Pick<AddNoteInput, "entityType" | "entityId">;

export function NoteHistory({ notes }: { notes: ActivityNote[] }) {
  return <ol className="divide-y divide-[var(--border)]">
    {notes.map(note => <li key={note.id} className="py-3">
      <p className="text-xs text-[var(--muted)]">
        {note.actor?.display_name || "KP teammate"} · <time dateTime={note.occurred_at}>
          {new Date(note.occurred_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{note.metadata.note}</p>
    </li>)}
  </ol>;
}

function NotesContent({ entityType, entityId }: Target) {
  const [notes, setNotes] = useState<ActivityNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ text: string; key: string } | null>(null);
  const labelId = useId();
  const readVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = ++readVersion.current;
    getNotes({ entityType, entityId }).then(rows => {
      if (!active || version !== readVersion.current) return;
      setNotes(rows); setMore(rows.length === 50); setLoaded(true);
    }).catch(() => { if (active && version === readVersion.current) setReadError("Notes couldn’t be loaded. Please retry."); });
    return () => { active = false; };
  }, [entityType, entityId]);

  async function load(reset = false) {
    const version = ++readVersion.current;
    setLoading(true); setReadError("");
    try {
      const rows = await getNotes({ entityType, entityId }, reset ? 0 : notes.length);
      if (version !== readVersion.current) return;
      setNotes(current => reset ? rows : [...current, ...rows.filter(row => !current.some(note => note.id === row.id))]);
      setMore(rows.length === 50); setLoaded(true);
    } catch { setReadError("Notes couldn’t be loaded. Please retry."); }
    finally { setLoading(false); }
  }

  return <div className="mt-3">
    <form onSubmit={async event => {
      event.preventDefault();
      const note = text.trim();
      if (!note || lock.current) return;
      lock.current = true; setSaving(true); setSaveError(""); setSaved(false);
      // Keep the request key when retrying the same draft after a lost response.
      if (attempt.current?.text !== note) attempt.current = { text: note, key: crypto.randomUUID() };
      try {
        await createNote({ entityType, entityId, note }, attempt.current.key);
        setText(""); attempt.current = null; setSaved(true);
        await load(true);
      } catch { setSaveError("The note couldn’t be saved. Your draft is still here; please retry."); }
      finally { lock.current = false; setSaving(false); }
    }}>
      <label htmlFor={labelId} className="text-xs font-medium">Add note</label>
      <textarea id={labelId} value={text} onChange={event => { setText(event.target.value); setSaved(false); }}
        required maxLength={20000} rows={3} disabled={saving}
        placeholder="Add context, an update, or a follow-up…"
        className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" />
      <button type="submit" disabled={saving || !text.trim()} className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
        {saving ? "Saving…" : "Add note"}
      </button>
      {saveError ? <p role="alert" className="mt-2 text-sm text-red-700">{saveError}</p> : null}
      {saved ? <p role="status" className="mt-2 text-xs text-[var(--muted)]">Note added.</p> : null}
    </form>
    <h3 className="mt-5 text-xs font-semibold">Notes history</h3>
    {!loaded && !readError ? <p role="status" className="mt-3 text-xs text-[var(--muted)]">Loading notes…</p> : null}
    {loaded && !notes.length ? <p className="mt-3 text-xs text-[var(--muted)]">No notes yet.</p> : null}
    <NoteHistory notes={notes} />
    {readError ? <p role="alert" className="mt-2 text-sm text-red-700">{readError}</p> : null}
    {readError || more ? <button type="button" disabled={loading || saving} onClick={() => void load(!!readError)} className="mt-2 text-xs underline underline-offset-4">{loading ? "Loading…" : readError ? "Retry loading notes" : "Load older notes"}</button> : null}
  </div>;
}

export function RecordNotes({ expanded = false, ...target }: Target & { expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  const [visited, setVisited] = useState(expanded);
  return <details open={open} onToggle={event => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setVisited(true); }} className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <summary className="cursor-pointer text-xs font-medium text-[var(--muted-strong)]">Notes · Add note</summary>
    {visited ? <NotesContent key={`${target.entityType}:${target.entityId}`} {...target} /> : null}
  </details>;
}
