import { z } from "zod";
import {
  callIdempotentDomainRpc,
  type DomainActionSource,
} from "@/modules/domain/action-rpc";

export const addNoteInputSchema = z.object({
  entityType: z.enum([
    "task",
    "opportunity",
    "project",
    "organization",
    "person",
    "decision",
  ]),
  entityId: z.string().uuid(),
  note: z.string().trim().min(1).max(20_000),
});

export type AddNoteInput = z.infer<typeof addNoteInputSchema>;

export type AddedNote = {
  id: string;
  entityType: AddNoteInput["entityType"];
  entityId: string;
  note: string;
  occurredAt: string;
};

export async function addActivityNote({
  input,
  source,
  requestKey,
}: {
  input: AddNoteInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<AddedNote> {
  return callIdempotentDomainRpc<AddedNote>({
    functionName: "kp_add_note",
    source,
    requestKey,
    payload: addNoteInputSchema.parse(input),
  });
}
