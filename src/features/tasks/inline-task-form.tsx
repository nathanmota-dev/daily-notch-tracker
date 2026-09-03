import type { ChangeEvent, FormEvent } from "react"

import { Button } from "../../components/ui/button"
import {
  TASK_NOTES_MAX_CHARS,
  TASK_TITLE_MAX_CHARS,
  countTaskCharacters,
  validateTaskDraft,
} from "./tasks-model"
import type { InlineTaskFormProps } from "./tasks-view-types"

function inputClassName(error?: string) {
  return `min-w-0 rounded-control border bg-canvas px-2.5 text-[0.78rem] text-content outline-none placeholder:text-muted/80 focus:border-ring focus:ring-2 focus:ring-ring/30 ${error ? "border-danger" : "border-border"}`
}

function InlineFieldError({ error, id }: { error?: string; id: string }) {
  return error ? (
    <p className="sr-only" id={id} role="alert">
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
    <>
      <div className="col-start-1 row-start-1 min-w-0">
        <label className="sr-only" htmlFor="inline-task-title">
          Title
        </label>
        <input
          aria-describedby={errors.title ? "inline-task-title-error" : undefined}
          aria-invalid={Boolean(errors.title)}
          className={`${inputClassName(errors.title)} h-11 w-full`}
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
      </div>
      <div className="col-start-1 row-start-2 min-w-0">
        <label className="sr-only" htmlFor="inline-task-notes">
          Notes
        </label>
        <textarea
          aria-describedby={errors.notes ? "inline-task-notes-error" : undefined}
          aria-invalid={Boolean(errors.notes)}
          className={`${inputClassName(errors.notes)} h-11 w-full resize-none py-2`}
          id="inline-task-notes"
          maxLength={TASK_NOTES_MAX_CHARS}
          onChange={handleChange("notes")}
          placeholder="Notes (optional)"
          rows={1}
          value={draft.notes}
        />
        <span className="sr-only">
          {countTaskCharacters(draft.title)} / {TASK_TITLE_MAX_CHARS} title
          characters. {countTaskCharacters(draft.notes)} / {TASK_NOTES_MAX_CHARS}{" "}
          notes characters.
        </span>
        <InlineFieldError error={errors.notes} id="inline-task-notes-error" />
      </div>
    </>
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
  const visibleErrors = { ...draftValidationErrors, ...errors }
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
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem] grid-rows-[44px_44px] gap-2.5"
      data-slot="inline-task-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <TextInputFields
        draft={draft}
        errors={visibleErrors}
        onChange={onChange}
        titleRef={titleRef}
      />
      <Button
        aria-label="Add task"
        className="col-start-2 row-start-1 h-11 w-full px-2 text-[0.78rem]"
        disabled={busy || !canSubmit}
        type="submit"
      >
        Add
      </Button>
      <Button
        className="col-start-2 row-start-2 h-11 w-full px-2 text-[0.78rem]"
        disabled={busy}
        onClick={onCancel}
        type="button"
        variant="secondary"
      >
        Cancel
      </Button>
    </form>
  )
}
