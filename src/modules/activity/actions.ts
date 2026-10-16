"use server";

import { z } from "zod";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { addActivityNote, addNoteInputSchema, type AddNoteInput } from "./service";

export type ActivityNote = {
  id: string;
  occurred_at: string;
  metadata: { note: string };
  actor: { display_name: string | null } | null;
};

export async function getNotes(input: Pick<AddNoteInput, "entityType" | "entityId">, offset = 0) {
  const target = addNoteInputSchema.pick({ entityType: true, entityId: true }).parse(input);
  const start = z.number().int().min(0).parse(offset);
  await requireActiveIdentity();
  const db = await createClient();
  const { data, error } = await db.from("activity_events")
    .select("id,occurred_at,metadata,actor:profiles!actor_user_id(display_name)")
    .eq("event_type", "note.added")
    .eq(`${target.entityType}_id`, target.entityId)
    // Related projects/people also carry organization/opportunity IDs.
    // Only show notes written directly on this record.
    .eq("metadata->>entityType", target.entityType)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + 49);
  if (error) throw new Error("Unable to load notes. Please try again.");
  return (data ?? []) as unknown as ActivityNote[];
}

export async function createNote(input: AddNoteInput, requestKey: string) {
  return addActivityNote({ input, requestKey, source: "ui" });
}
