import type {
  ChangeEvent,
  FormEvent,
  RefObject,
} from "react"

import { Checkbox } from "../../components/ui/checkbox"
import { Button } from "../../components/ui/button"
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
          onChange={handleChange("title")}
          ref={titleRef}
          required
          type="text"
          value={draft.title}
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
    <div className="tasks-form__grid">
      <div className="tasks-form__field">
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
    <form className="tasks-form" onSubmit={handleSubmit}>
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
          {busy ? "Saving…" : "Save task"}
        </Button>
      </footer>
    </form>
  )
}
