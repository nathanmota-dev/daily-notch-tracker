import type {
  ChangeEvent,
  FormEvent,
  RefObject,
} from "react"

import { FocusTimePicker } from "../../components/focus-time-picker"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
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
    <>
      <div className="mb-[18px] grid gap-2">
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

      <div className="mb-[18px] grid gap-2">
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
        <FocusTimePicker
          error={errors.estimateMinutes}
          id="task-duration"
          label="Duration (minutes)"
          onValueChange={(value) => onChange("estimateMinutes", value)}
          presets={TASK_DURATION_PRESETS}
          value={draft.estimateMinutes}
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
      noValidate
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
          {busy
            ? mode === "create"
              ? "Adding…"
              : "Saving…"
            : mode === "create"
              ? "Add task"
              : "Save task"}
        </Button>
      </footer>
    </form>
  )
}
