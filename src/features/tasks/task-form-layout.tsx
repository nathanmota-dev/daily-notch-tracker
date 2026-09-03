import { BackButton } from "../../components/back-button"
import { Button } from "../../components/ui/button"
import type { TaskFormProps } from "./task-form"

export function TaskFormHeader({
  busy,
  mode,
  onCancel,
}: Pick<TaskFormProps, "busy" | "mode" | "onCancel">) {
  return (
    <header className="mb-5 flex items-start gap-3 border-b border-border pb-5">
      <BackButton
        ariaLabel="Back to list"
        className="mt-0.5"
        disabled={busy}
        onClick={onCancel}
        title="Back to list"
      />
      <div className="min-w-0">
        <h2 className="m-0 text-[clamp(1.35rem,3vw,1.85rem)] font-bold leading-[1.05] tracking-[-0.045em] text-content">
          {mode === "create" ? "New task" : "Edit task"}
        </h2>
        <p className="m-0 mt-1.5 text-[0.76rem] leading-[1.35] text-muted">
          {mode === "create" ? "Add something to your list." : "Update this task."}
        </p>
      </div>
    </header>
  )
}

export function TaskFormFooter({
  busy,
  mode,
  onCancel,
  onDelete,
}: Pick<TaskFormProps, "busy" | "mode" | "onCancel" | "onDelete">) {
  return (
    <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      {onDelete && (
        <Button
          className="mr-auto"
          disabled={busy}
          onClick={onDelete}
          type="button"
          variant="destructive"
        >
          Delete task
        </Button>
      )}
      <Button
        disabled={busy}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        Cancel
      </Button>
      <Button disabled={busy} type="submit">
        {busy
          ? mode === "create"
            ? "Adding…"
            : "Saving…"
          : mode === "create"
            ? "Add task"
            : "Save task"}
      </Button>
    </footer>
  )
}
