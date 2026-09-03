import type { KeyboardEvent } from "react"

import { ChevronDownIcon, ChevronUpIcon } from "../icons"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { IconButton } from "./icon-button"
import type {
  FocusSessionDurationColumnProps,
  FocusSessionDurationProps,
  FocusSessionPanelProps,
  FocusSessionPickerProps,
} from "./focus-session-types"

function DurationColumn({
  disabled,
  errorId,
  field,
  inputId,
  invalid,
  label,
  onChange,
  onKeyDown,
  onStep,
  value,
}: FocusSessionDurationColumnProps) {
  return (
    <div className="grid justify-items-center gap-1">
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <IconButton
        aria-label={`Increase ${field}`}
        className="size-6 text-muted hover:text-content"
        disabled={disabled}
        onClick={() => onStep(1)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ChevronUpIcon aria-hidden="true" />
      </IconButton>
      <input
        aria-describedby={invalid ? errorId : undefined}
        aria-invalid={invalid}
        aria-label={`Focus ${field}`}
        className={cn(
          "h-16 w-[5.5rem] rounded-control border border-transparent bg-panel-hover px-2 text-center font-mono text-[2rem] font-bold tabular-nums text-content outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-2 focus:ring-ring/40",
          invalid && "border-danger focus:border-danger focus:ring-danger/40",
        )}
        disabled={disabled}
        id={inputId}
        inputMode="numeric"
        maxLength={field === "minutes" ? 3 : 2}
        onChange={onChange}
        onKeyDown={onKeyDown}
        type="text"
        value={value}
      />
      <IconButton
        aria-label={`Decrease ${field}`}
        className="size-6 text-muted hover:text-content"
        disabled={disabled}
        onClick={() => onStep(-1)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ChevronDownIcon aria-hidden="true" />
      </IconButton>
    </div>
  )
}

export function FocusSessionDuration({
  draft,
  disabled,
  errorId,
  invalid,
  minutesId,
  onChange,
  onKeyDown,
  onStep,
  secondsId,
}: FocusSessionDurationProps) {
  return (
    <div
      aria-describedby={invalid ? errorId : undefined}
      className="mt-4 flex items-center justify-center gap-2"
      data-slot="focus-session-duration"
    >
      <DurationColumn
        disabled={disabled}
        errorId={errorId}
        field="minutes"
        inputId={minutesId}
        invalid={invalid}
        label="Min"
        onChange={(event) => onChange("minutes", event.currentTarget.value)}
        onKeyDown={(event) => onKeyDown(event, "minutes")}
        onStep={(direction) => onStep("minutes", direction)}
        value={draft.minutes}
      />
      <span aria-hidden="true" className="mt-5 text-2xl font-semibold text-muted">
        :
      </span>
      <DurationColumn
        disabled={disabled}
        errorId={errorId}
        field="seconds"
        inputId={secondsId}
        invalid={invalid}
        label="Sec"
        onChange={(event) => onChange("seconds", event.currentTarget.value)}
        onKeyDown={(event) => onKeyDown(event, "seconds")}
        onStep={(direction) => onStep("seconds", direction)}
        value={draft.seconds}
      />
    </div>
  )
}

function PickerHeader({
  taskTitle,
  onCancel,
}: Pick<FocusSessionPickerProps, "taskTitle" | "onCancel">) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Focus session
        </p>
        {taskTitle && (
          <p className="m-0 mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[0.8rem] text-content">
            {taskTitle}
          </p>
        )}
      </div>
      <button
        aria-label="Cancel focus session"
        className="rounded-control border-0 bg-transparent p-1 text-muted outline-none hover:bg-panel-hover hover:text-content focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onCancel}
        type="button"
      >
        ×
      </button>
    </header>
  )
}

function PickerFooter({
  busy,
  invalid,
  onCancel,
  onSubmit,
}: Pick<FocusSessionPickerProps, "busy" | "onCancel"> & {
  invalid: boolean
  onSubmit: () => void
}) {
  return (
    <footer className="mt-4 flex justify-end gap-2">
      <Button disabled={busy} onClick={onCancel} size="sm" type="button" variant="ghost">
        Cancel
      </Button>
      <Button
        disabled={busy || invalid}
        onClick={onSubmit}
        size="sm"
        type="button"
      >
        Start focus
      </Button>
    </footer>
  )
}

export function FocusSessionPanel({
  busy,
  className,
  dialogRef,
  draft,
  error,
  errorId,
  invalid,
  minutesId,
  onCancel,
  onChange,
  onKeyDown,
  onStep,
  onSubmit,
  secondsId,
  taskTitle,
}: FocusSessionPanelProps) {
  return (
    <div
      aria-label={`Focus session${taskTitle ? ` for ${taskTitle}` : ""}`}
      aria-modal="false"
      className={cn(
        "z-30 w-[17rem] rounded-panel border border-border-strong bg-canvas p-4 shadow-panel",
        className,
      )}
      data-invalid={invalid || undefined}
      data-slot="focus-session-picker"
      onPointerDown={(event) => event.stopPropagation()}
      ref={dialogRef}
      role="dialog"
    >
      <PickerHeader onCancel={onCancel} taskTitle={taskTitle} />
      <FocusSessionDuration
        draft={draft}
        disabled={busy}
        errorId={errorId}
        invalid={invalid}
        minutesId={minutesId}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onStep={onStep}
        secondsId={secondsId}
      />
      {error && (
        <p className="m-0 mt-3 text-[0.7rem] leading-[1.3] text-danger" id={errorId} role="alert">
          {error}
        </p>
      )}
      <PickerFooter
        busy={busy}
        invalid={invalid}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  )
}

export type FocusSessionKeyboardHandler = (
  event: KeyboardEvent<HTMLInputElement>,
  field: "minutes" | "seconds",
) => void
