import type {
  ChangeEvent,
  FormEvent,
  RefObject,
} from "react"

import { FocusTimePicker } from "../../components/focus-time-picker"
import { cn } from "../../lib/utils"
import {
  countTaskCharacters,
  TASK_DURATION_PRESETS,
  TASK_NOTES_MAX_CHARS,
  TASK_TITLE_MAX_CHARS,
  type TaskDraft,
  type TaskDraftErrors,
  type TaskDraftField,
} from "./tasks-model"
import { TaskFormFooter, TaskFormHeader } from "./task-form-layout"

export type TaskFormProps = {
  mode: "create" | "edit"
  draft: TaskDraft
  errors: TaskDraftErrors
  busy: boolean
  titleRef: RefObject<HTMLInputElement | null>
  onChange: (field: TaskDraftField, value: string) => void
  onSubmit: () => void
  onCancel: () => void
  onDelete?: () => void
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

function CharacterCounter({
  count,
  id,
  label,
  limit,
  slot,
}: {
  count: number
  id: string
  label: string
  limit: number
  slot: string
}) {
  return (
    <p
      aria-live="polite"
      className="text-right text-caption text-muted"
      data-slot={slot}
      id={id}
    >
      <span className="sr-only">{label}: </span>
      {count} / {limit}
    </p>
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
    <div className="grid gap-4">
      <div className="grid gap-2">
        <LabeledField error={errors.title} id="task-title" label="Title" />
        <input
          aria-describedby={errors.title ? "task-title-error" : undefined}
          aria-invalid={Boolean(errors.title)}
          className={fieldClassName(errors.title)}
          id="task-title"
          autoFocus
          onChange={handleChange("title")}
          maxLength={TASK_TITLE_MAX_CHARS}
          ref={titleRef}
          required
          type="text"
          value={draft.title}
        />
        <CharacterCounter
          count={countTaskCharacters(draft.title)}
          id="task-title-count"
          label="Title character count"
          limit={TASK_TITLE_MAX_CHARS}
          slot="task-title-counter"
        />
        <FieldError error={errors.title} id="task-title-error" />
      </div>

      <div className="grid gap-2">
        <LabeledField error={errors.notes} id="task-notes" label="Notes" />
        <textarea
          aria-describedby={errors.notes ? "task-notes-error" : undefined}
          aria-invalid={Boolean(errors.notes)}
          className={`${fieldClassName(errors.notes)} min-h-28 resize-y`}
          id="task-notes"
          onChange={handleChange("notes")}
          maxLength={TASK_NOTES_MAX_CHARS}
          rows={5}
          value={draft.notes}
        />
        <CharacterCounter
          count={countTaskCharacters(draft.notes)}
          id="task-notes-count"
          label="Notes character count"
          limit={TASK_NOTES_MAX_CHARS}
          slot="task-notes-counter"
        />
        <FieldError error={errors.notes} id="task-notes-error" />
      </div>
    </div>
  )
}

function TaskScheduleFields({
  draft,
  errors,
  onChange,
}: Pick<TaskFormProps, "draft" | "errors" | "onChange">) {
  return (
    <div className="grid grid-cols-2 items-start gap-4 max-[640px]:grid-cols-1">
      <div className="grid min-w-0 content-start gap-2">
        <FocusTimePicker
          className="min-w-0"
          error={errors.estimateMinutes}
          id="task-duration"
          label="Duration (minutes)"
          onValueChange={(value) => onChange("estimateMinutes", value)}
          presets={TASK_DURATION_PRESETS}
          value={draft.estimateMinutes}
        />
      </div>

      <div className="grid min-w-0 content-start gap-2">
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
          className={cn(fieldClassName(errors.scheduledDate), "h-10 self-start")}
          id="task-date"
          onChange={(event) =>
            onChange("scheduledDate", event.currentTarget.value)
          }
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
  mode,
  onCancel,
  onChange,
  onDelete,
  onSubmit,
  titleRef,
}: TaskFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form
      aria-label={mode === "create" ? "Create task" : "Edit task"}
      className="min-h-0 w-full flex-[1_1_auto] overflow-y-auto rounded-panel border border-border bg-canvas p-[clamp(16px,3vw,28px)] shadow-panel"
      data-slot="task-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <TaskFormHeader busy={busy} mode={mode} onCancel={onCancel} />

      <div className="grid gap-4">
        <section className="rounded-control border border-border bg-canvas p-4">
          <TaskTextFields
            draft={draft}
            errors={errors}
            onChange={onChange}
            titleRef={titleRef}
          />
        </section>

        <section className="grid gap-4 rounded-control border border-border bg-canvas p-4">
          <TaskScheduleFields
            draft={draft}
            errors={errors}
            onChange={onChange}
          />
        </section>
      </div>

      <TaskFormFooter
        busy={busy}
        mode={mode}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </form>
  )
}
