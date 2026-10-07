import { createTask } from "@/modules/work/actions";
import type {
  WorkBusinessOption,
  WorkProfileOption,
} from "@/modules/work/queries";

export function NewTaskForm({
  businesses,
  profiles,
  isAdmin,
  currentUserId,
}: {
  businesses: WorkBusinessOption[];
  profiles: WorkProfileOption[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  return (
    <details className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        + Add task
      </summary>

      <form
        action={createTask}
        className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Task
          <input
            required
            name="title"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="What needs to get done?"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Business
          <select
            name="business_id"
            defaultValue=""
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">KP / Shared</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
                {business.is_active ? "" : " — parked"}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Priority
          <select
            name="priority"
            defaultValue="normal"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>

        {isAdmin ? (
          <label className="text-xs font-medium text-[var(--muted-strong)]">
            Owner
            <select
              name="owner_id"
              defaultValue={currentUserId}
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            >
              <option value="">Needs an owner</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name || "Team member"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label
          className={
            isAdmin
              ? "text-xs font-medium text-[var(--muted-strong)]"
              : "text-xs font-medium text-[var(--muted-strong)] sm:col-span-2"
          }
        >
          Do this next
          <input
            name="next_action"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="Immediate next action"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add task
          </button>
        </div>
      </form>
    </details>
  );
}
