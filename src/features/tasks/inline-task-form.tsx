import type { ChangeEvent, FormEvent } from "react"

import { Button } from "../../components/ui/button"
import {
  TASK_MAX_DURATION_MINUTES,
  TASK_MIN_DURATION_MINUTES,
  TASK_NOTES_MAX_CHARS,
  TASK_TITLE_MAX_CHARS,
  countTaskCharacters,
  validateTaskDraft,
} from "./tasks-model"
import type { InlineTaskFormProps } from "./tasks-view-types"

function inputClassName(error?: string) {
  return `min-h-9 w-full rounded-control border bg-canvas px-2.5 text-[0.8rem] text-content outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 ${error ? "border-danger" : "border-border"}`
}

function InlineFieldError({ error, id }: { error?: string; id: string }) {
  return error ? (
    <p className="m-0 text-[0.68rem] text-danger" id={id} role="alert">
      {error}
    </p>
  ) : null
}

function TextInputFields({
  draft,
  errors,
  onChange,
  titleRef,
}: Pick<InlineTaskFormProps, "draft" | "errors" | "onChange" | "titleRef">) {
  const handleChange =
    (field: "title" | "notes") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(field, event.currentTarget.value)

  return (
    <div className="grid min-w-0 flex-[1_1_16rem] gap-1">
      <label className="sr-only" htmlFor="inline-task-title">
        Title
      </label>
      <input
        aria-describedby={errors.title ? "inline-task-title-error" : undefined}
        aria-invalid={Boolean(errors.title)}
        className={inputClassName(errors.title)}
        id="inline-task-title"
        maxLength={TASK_TITLE_MAX_CHARS}
        onChange={handleChange("title")}
        placeholder="Task title"
        ref={titleRef}
        required
        type="text"
        value={draft.title}
      />
      <InlineFieldError error={errors.title} id="inline-task-title-error" />
      <label className="sr-only" htmlFor="inline-task-notes">
        Notes
      </label>
      <textarea
        aria-describedby={errors.notes ? "inline-task-notes-error" : undefined}
        aria-invalid={Boolean(errors.notes)}
        className="min-h-9 w-full resize-none rounded-control border border-border bg-canvas px-2.5 py-2 text-[0.78rem] text-content outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        id="inline-task-notes"
        maxLength={TASK_NOTES_MAX_CHARS}
        onChange={handleChange("notes")}
        placeholder="Notes (optional)"
        rows={1}
        value={draft.notes}
      />
      <span className="sr-only">
        {countTaskCharacters(draft.notes)} / {TASK_NOTES_MAX_CHARS} characters
      </span>
      <InlineFieldError error={errors.notes} id="inline-task-notes-error" />
    </div>
  )
}

function InlineScheduleFields({
  draft,
  errors,
  onChange,
}: Pick<InlineTaskFormProps, "draft" | "errors" | "onChange">) {
  return (
    <div className="grid w-[8.5rem] shrink-0 gap-1.5">
      <label className="text-[0.68rem] font-semibold text-muted" htmlFor="inline-task-duration">
        Duration (minutes)
      </label>
      <input
        aria-invalid={Boolean(errors.estimateMinutes)}
        className={inputClassName(errors.estimateMinutes)}
        id="inline-task-duration"
        max={TASK_MAX_DURATION_MINUTES}
        min={TASK_MIN_DURATION_MINUTES}
        onChange={(event) => onChange("estimateMinutes", event.currentTarget.value)}
        type="number"
        value={draft.estimateMinutes}
      />
      <InlineFieldError
        error={errors.estimateMinutes}
        id="inline-task-duration-error"
      />
      <label className="text-[0.68rem] font-semibold text-muted" htmlFor="inline-task-date">
        Date
      </label>
      <input
        aria-invalid={Boolean(errors.scheduledDate)}
        className={inputClassName(errors.scheduledDate)}
        id="inline-task-date"
        onChange={(event) => onChange("scheduledDate", event.currentTarget.value)}
        type="date"
        value={draft.scheduledDate}
      />
      <InlineFieldError error={errors.scheduledDate} id="inline-task-date-error" />
    </div>
  )
}

export function InlineTaskForm({
  busy,
  draft,
  errors,
  onCancel,
  onChange,
  onSubmit,
  titleRef,
}: InlineTaskFormProps) {
  const draftValidationErrors = validateTaskDraft(draft)
  const visibleErrors = { ...errors, ...draftValidationErrors }
  const canSubmit = Object.keys(draftValidationErrors).length === 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSubmit) {
      onSubmit()
    }
  }

  return (
    <form
      aria-label="Create task"
      className="grid shrink-0 gap-3 rounded-card border border-border bg-panel p-3 shadow-panel"
      data-slot="inline-task-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-accent">
            New task
          </p>
          <h2 className="m-0 mt-0.5 text-[0.95rem] font-semibold text-content">
            New task
          </h2>
          <p className="m-0 mt-0.5 text-[0.72rem] text-muted">
            Keep the list visible while you add a task.
          </p>
        </div>
        <span className="text-[0.66rem] text-muted">
          {countTaskCharacters(draft.title)} / {TASK_TITLE_MAX_CHARS}
        </span>
      </div>
      <div className="flex min-w-0 items-start gap-3 max-[700px]:flex-col">
        <TextInputFields
          draft={draft}
          errors={visibleErrors}
          onChange={onChange}
          titleRef={titleRef}
        />
        <InlineScheduleFields
          draft={draft}
          errors={visibleErrors}
          onChange={onChange}
        />
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button disabled={busy} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={busy || !canSubmit} type="submit">
          {busy ? "Adding…" : "Add task"}
        </Button>
      </footer>
    </form>
  )
}
