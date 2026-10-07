import { z } from "zod";

export const integrationEntityTypeSchema = z.enum([
  "organization",
  "person",
  "relationship",
  "opportunity",
  "project",
  "task",
]);

export const eventEnvelopeSchema = z.object({
  event_id: z.string().trim().min(1).max(200),
  version: z.number().int().positive(),
  event_type: z
    .string()
    .trim()
    .regex(/^v\d+\.[a-z0-9_.-]+$/i, "Use a versioned event type such as v1.project.status_changed"),
  source_system: z.string().trim().min(1).max(100),
  occurred_at: z.string().datetime({ offset: true }),
  business_id: z.string().uuid().nullable().optional(),
  kp_entity: z
    .object({
      type: integrationEntityTypeSchema,
      id: z.string().uuid(),
    })
    .nullable()
    .optional(),
  external_entity_id: z.string().trim().min(1).max(300).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export function parseEventEnvelope(input: unknown): EventEnvelope {
  return eventEnvelopeSchema.parse(input);
}
