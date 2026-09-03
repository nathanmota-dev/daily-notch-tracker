import type {
  ChangeEvent,
  KeyboardEvent,
  RefObject,
} from "react"

export type FocusSessionField = "minutes" | "seconds"

export type FocusSessionParts = {
  minutes: number
  seconds: number
}

export type FocusSessionDraft = {
  minutes: string
  seconds: string
}

export type FocusSessionPickerProps = {
  open: boolean
  taskTitle: string | null
  initialDurationSeconds?: number
  busy?: boolean
  error?: string | null
  onConfirm: (durationSeconds: number) => void | Promise<void>
  onCancel: () => void
  className?: string
}

export type FocusSessionDurationColumnProps = {
  field: FocusSessionField
  label: string
  value: string
  disabled: boolean
  inputId: string
  errorId: string
  invalid: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onStep: (direction: -1 | 1) => void
}

export type FocusSessionDurationProps = {
  draft: FocusSessionDraft
  disabled: boolean
  errorId: string
  invalid: boolean
  minutesId: string
  secondsId: string
  onChange: (field: FocusSessionField, value: string) => void
  onKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    field: FocusSessionField,
  ) => void
  onStep: (field: FocusSessionField, direction: -1 | 1) => void
}

export type FocusSessionPanelProps = {
  className?: string
  dialogRef: RefObject<HTMLDivElement | null>
  errorId: string
  invalid: boolean
  minutesId: string
  secondsId: string
  draft: FocusSessionDraft
  error: string | undefined
  busy: boolean
  taskTitle: string | null
  onCancel: () => void
  onChange: (field: FocusSessionField, value: string) => void
  onKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    field: FocusSessionField,
  ) => void
  onStep: (field: FocusSessionField, direction: -1 | 1) => void
  onSubmit: () => void
}
