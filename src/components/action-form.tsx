"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ActionForm({ action, children, className, errorMessage }: {
  action: (data: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  errorMessage?: string;
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const router = useRouter();
  return (
    <form className={className} onSubmit={(event) => {
      event.preventDefault();
      if (submitting.current) return;
      const form = event.currentTarget;
      for (const element of Array.from(form.elements)) {
        if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.required && !element.value.trim()) {
          setError("Please fill in the required fields with more than spaces.");
          element.focus();
          return;
        }
      }
      const data = new FormData(form);
      submitting.current = true;
      setError("");
      setSaved(false);
      startTransition(async () => {
        try {
          await action(data);
          form.reset();
          setSaved(true);
          router.refresh();
        } catch {
          setError(errorMessage || "We couldn’t save this. Check the fields and try again.");
        } finally {
          submitting.current = false;
        }
      });
    }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {pending ? <p role="status" className="text-sm sm:col-span-2">Saving…</p> : null}
      {saved ? <p role="status" className="text-sm sm:col-span-2">Saved.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </form>
  );
}
