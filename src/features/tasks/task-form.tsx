import type {
  ChangeEvent,
  FormEvent,
  RefObject,
} from "react"

import { FocusTimePicker } from "../../components/focus-time-picker"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
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
    <p className="tasks-form__field-error" id={id} role="alert">
      {error}
    </p>
  )
}

function fieldClassName(error?: string) {
  return `tasks-form__input${error ? " tasks-form__input--invalid" : ""}`
}

function LabeledField({ error, id, label }: FieldProps) {
  return (
    <label className="tasks-form__label" htmlFor={id}>
      <span>{label}</span>
      {error && <span className="tasks-form__label-error">{error}</span>}
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
      <div className="tasks-form__field">
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

      <div className="tasks-form__field">
        <LabeledField error={errors.notes} id="task-notes" label="Notes" />
        <textarea
          aria-describedby={errors.notes ? "task-notes-error" : undefined}
          aria-invalid={Boolean(errors.notes)}
          className={`${fieldClassName(errors.notes)} tasks-form__textarea`}
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
    <div className="tasks-form__grid">
      <div className="tasks-form__field">
        <FocusTimePicker
          error={errors.estimateMinutes}
          id="task-duration"
          label="Duration (minutes)"
          onValueChange={(value) => onChange("estimateMinutes", value)}
          presets={TASK_DURATION_PRESETS}
          value={draft.estimateMinutes}
        />
      </div>

      <div className="tasks-form__field">
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
    <form className="tasks-form" noValidate onSubmit={handleSubmit}>
      <div className="tasks-form__heading">
        <div>
          <p className="tasks-form__eyebrow">Task details</p>
          <h2>{mode === "create" ? "New task" : "Edit task"}</h2>
        </div>
        <div className="tasks-form__heading-actions">
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
        <label className="tasks-form__done-control">
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

      <footer className="tasks-form__footer">
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
