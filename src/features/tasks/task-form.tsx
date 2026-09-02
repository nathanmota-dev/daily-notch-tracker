import type {
  ChangeEvent,
  FormEvent,
  RefObject,
} from "react"

import { Checkbox } from "../../components/ui/checkbox"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import type { TaskDraft, TaskDraftErrors, TaskDraftField } from "./tasks-model"

export type TaskFormProps = {
  mode: "create" | "edit"
  draft: TaskDraft
  errors: TaskDraftErrors
  busy: boolean
  titleRef: RefObject<HTMLInputElement | null>
  focusActionLabel?: string
  onChange: (field: TaskDraftField, value: string) => void
  onDoneChange?: (isDone: boolean) => void
  onSubmit: () => void
  onCancel: () => void
  onDelete?: () => void
  onFocus?: () => void
}

type FieldProps = {
  error?: string
  id: string
  label: string
}

function FieldError({ error, id }: Pick<FieldProps, "error" | "id">) {
  if (!error) {
    return null
  }

  return (
    <p
      className="m-0 text-[0.78rem] leading-[1.4] text-danger"
      id={id}
      role="alert"
    >
      {error}
    </p>
  )
}

function fieldClassName(error?: string) {
  return cn(
    "min-h-10 w-full rounded-control border border-border bg-canvas px-2.5 py-2 text-content outline-none focus:border-ring focus:shadow-[0_0_0_2px_rgb(96_165_250_/_0.28)]",
    error && "border-danger",
  )
}

function LabeledField({ error, id, label }: FieldProps) {
  return (
    <label
      className="flex justify-between gap-3 text-[0.78rem] font-semibold text-muted"
      htmlFor={id}
    >
      <span>{label}</span>
      {error && (
        <span className="font-medium text-right text-danger">{error}</span>
      )}
    </label>
  )
}

function TaskTextFields({
  draft,
  errors,
  onChange,
  titleRef,
}: Pick<TaskFormProps, "draft" | "errors" | "onChange" | "titleRef">) {
  function handleChange(field: TaskDraftField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(field, event.currentTarget.value)
    }
  }

  return (
    <>
      <div className="mb-[18px] grid gap-2">
        <LabeledField error={errors.title} id="task-title" label="Title" />
        <input
          aria-describedby={errors.title ? "task-title-error" : undefined}
          aria-invalid={Boolean(errors.title)}
          className={fieldClassName(errors.title)}
          id="task-title"
          onChange={handleChange("title")}
          ref={titleRef}
          required
          type="text"
          value={draft.title}
        />
        <FieldError error={errors.title} id="task-title-error" />
      </div>

      <div className="mb-[18px] grid gap-2">
        <LabeledField error={errors.notes} id="task-notes" label="Notes" />
        <textarea
          aria-describedby={errors.notes ? "task-notes-error" : undefined}
          aria-invalid={Boolean(errors.notes)}
          className={`${fieldClassName(errors.notes)} min-h-28 resize-y`}
          id="task-notes"
          onChange={handleChange("notes")}
          rows={5}
          value={draft.notes}
        />
        <FieldError error={errors.notes} id="task-notes-error" />
      </div>
    </>
  )
}

function TaskScheduleFields({
  draft,
  errors,
  onChange,
}: Pick<TaskFormProps, "draft" | "errors" | "onChange">) {
  return (
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1 max-[640px]:gap-0">
      <div className="mb-[18px] grid gap-2">
        <LabeledField
          error={errors.estimateMinutes}
          id="task-duration"
          label="Duration (minutes)"
        />
        <input
          aria-describedby={
            errors.estimateMinutes ? "task-duration-error" : undefined
          }
          aria-invalid={Boolean(errors.estimateMinutes)}
          className={fieldClassName(errors.estimateMinutes)}
          id="task-duration"
          min={1}
          max={180}
          onChange={(event) => onChange("estimateMinutes", event.currentTarget.value)}
          type="number"
          value={draft.estimateMinutes}
        />
        <FieldError
          error={errors.estimateMinutes}
          id="task-duration-error"
        />
      </div>

      <div className="mb-[18px] grid gap-2">
        <LabeledField
          error={errors.scheduledDate}
          id="task-date"
          label="Date"
        />
        <input
          aria-describedby={
            errors.scheduledDate ? "task-date-error" : undefined
          }
          aria-invalid={Boolean(errors.scheduledDate)}
          className={fieldClassName(errors.scheduledDate)}
          id="task-date"
          onChange={(event) => onChange("scheduledDate", event.currentTarget.value)}
          type="date"
          value={draft.scheduledDate}
        />
        <FieldError error={errors.scheduledDate} id="task-date-error" />
      </div>
    </div>
  )
}

export function TaskForm({
  busy,
  draft,
  errors,
  focusActionLabel,
  mode,
  onCancel,
  onChange,
  onDelete,
  onDoneChange,
  onFocus,
  onSubmit,
  titleRef,
}: TaskFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form
      className="mt-5 min-h-0 w-full flex-[1_1_auto] overflow-y-auto rounded-panel border border-border bg-panel p-[clamp(20px,4vw,36px)] shadow-panel"
      onSubmit={handleSubmit}
    >
      <div className="mb-7 flex items-start justify-between gap-4 max-[640px]:flex-col">
        <div>
          <p className="m-0 mb-1.5 text-[0.7rem] font-[650] uppercase tracking-[0.16em] text-muted">
            Task details
          </p>
          <h2 className="m-0 text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.05] tracking-[-0.045em] text-content">
            {mode === "create" ? "New task" : "Edit task"}
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2 max-[640px]:justify-start">
          {onFocus && focusActionLabel && (
            <Button
              disabled={busy || draft.isDone}
              onClick={onFocus}
              type="button"
              variant="outline"
            >
              {focusActionLabel}
            </Button>
          )}
          <Button disabled={busy} onClick={onCancel} type="button" variant="ghost">
            Back to list
          </Button>
        </div>
      </div>

      <TaskTextFields
        draft={draft}
        errors={errors}
        onChange={onChange}
        titleRef={titleRef}
      />
      <TaskScheduleFields draft={draft} errors={errors} onChange={onChange} />

      {mode === "edit" && onDoneChange && (
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-[0.85rem] text-content">
          <Checkbox
            aria-label="Mark task as complete"
            checked={draft.isDone}
            disabled={busy}
            onCheckedChange={(checked) => {
              if (typeof checked === "boolean") {
                onDoneChange(checked)
              }
            }}
          />
          <span>Completed</span>
        </label>
      )}

      <footer className="mt-7 flex items-center gap-2 border-t border-border pt-5">
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
        <Button disabled={busy} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Save task"}
        </Button>
      </footer>
    </form>
  )
}
