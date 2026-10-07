/// <reference types="webmcp-types" />

"use client";

import { useEffect } from "react";
import {
  completeTaskForSiteTool,
  getMyWorkForSiteTool,
} from "@/modules/site-tools/actions";

const noInputSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const completeTaskSchema = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description:
        "The KP Duty UUID of the task to finish. Use an ID returned by get_my_work.",
    },
  },
  required: ["taskId"],
  additionalProperties: false,
} as const;

export function KPSiteTools() {
  useEffect(() => {
    const modelContext = document.modelContext;

    if (!modelContext || typeof modelContext.registerTool !== "function") {
      return;
    }

    const registerTool = modelContext.registerTool.bind(modelContext);
    const controller = new AbortController();

    async function registerTools() {
      await registerTool(
        {
          name: "get_my_work",
          title: "Get my KP work",
          description:
            "Read the current signed-in KP Duty user's visible work queue. Team members receive their own tasks; admins can also see unassigned work surfaced by the KP Work view. Use this before modifying a task so you have the current KP task ID and state.",
          inputSchema: noInputSchema,
          annotations: {
            readOnlyHint: true,
            untrustedContentHint: true,
            consequentialHint: false,
          },
          execute: async () => getMyWorkForSiteTool(),
        },
        { signal: controller.signal },
      );

      await registerTool(
        {
          name: "complete_task",
          title: "Complete KP task",
          description:
            "Mark one task owned by the current signed-in KP Duty user as finished. This changes KP Duty state and records the authenticated user through the existing Supabase session and activity triggers. The task can be reopened later in KP Duty.",
          inputSchema: completeTaskSchema,
          annotations: {
            readOnlyHint: false,
            untrustedContentHint: true,
            consequentialHint: false,
          },
          execute: async ({ taskId }) => completeTaskForSiteTool(taskId),
        },
        { signal: controller.signal },
      );
    }

    void registerTools().catch((error) => {
      controller.abort();

      if (process.env.NODE_ENV !== "production") {
        console.error("Unable to register KP Duty site tools", error);
      }
    });

    return () => controller.abort();
  }, []);

  return null;
}
