import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react"

import {
  DEFAULT_FOCUS_SESSION_SECONDS,
  durationSecondsFromDraft,
  focusSessionDraftFromSeconds,
  getFocusSessionDurationError,
  isValidFocusSessionDraft,
  stepFocusDuration,
} from "./focus-session-model"
import { FocusSessionPanel } from "./focus-session-picker-parts"
import type { FocusSessionDraft, FocusSessionField, FocusSessionPickerProps } from "./focus-session-types"

export type { FocusSessionPickerProps } from "./focus-session-types"

function safeInitialDuration(seconds: number | undefined) {
  return Number.isFinite(seconds) && seconds !== undefined
    ? seconds
    : DEFAULT_FOCUS_SESSION_SECONDS
}

function useFocusPickerLifecycle({
  dialogRef,
  initialDurationSeconds,
  minutesRef,
  onCancel,
  open,
  setDraft,
}: {
  dialogRef: RefObject<HTMLDivElement | null>
  initialDurationSeconds?: number
  minutesRef: RefObject<HTMLInputElement | null>
  onCancel: () => void
  open: boolean
  setDraft: (draft: FocusSessionDraft) => void
}) {
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    if (!wasOpenRef.current) {
      setDraft(
        focusSessionDraftFromSeconds(
          safeInitialDuration(initialDurationSeconds),
        ),
      )
      const focusTimer = window.setTimeout(() => minutesRef.current?.focus(), 0)
      wasOpenRef.current = true
      return () => window.clearTimeout(focusTimer)
    }

    wasOpenRef.current = true
  }, [initialDurationSeconds, minutesRef, open, setDraft])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) {
        onCancel()
      }
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [dialogRef, onCancel, open])
}

function useFocusPickerControls({
  busy,
  draft,
  onCancel,
  onConfirm,
  setDraft,
}: {
  busy: boolean
  draft: FocusSessionDraft
  onCancel: () => void
  onConfirm: (durationSeconds: number) => void | Promise<void>
  setDraft: (draft: FocusSessionDraft) => void
}) {
  const updateField = useCallback(
    (field: FocusSessionField, value: string) => {
      setDraft({ ...draft, [field]: value })
    },
    [draft, setDraft],
  )
  const step = useCallback(
    (field: FocusSessionField, direction: -1 | 1) => {
      const minutes = Number.parseInt(draft.minutes, 10)
      const seconds = Number.parseInt(draft.seconds, 10)
      const next = stepFocusDuration(
        {
          minutes: Number.isFinite(minutes) ? minutes : 0,
          seconds: Number.isFinite(seconds) ? seconds : 0,
        },
        field,
        direction,
      )
      setDraft({
        minutes: String(next.minutes),
        seconds: String(next.seconds).padStart(2, "0"),
      })
    },
    [draft, setDraft],
  )
  const submit = useCallback(() => {
    const durationSeconds = durationSecondsFromDraft(draft.minutes, draft.seconds)
    if (durationSeconds === null || busy) {
      return
    }

    void onConfirm(durationSeconds)
  }, [busy, draft.minutes, draft.seconds, onConfirm])
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, field: FocusSessionField) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        step(field, event.key === "ArrowUp" ? 1 : -1)
      }

      if (event.key === "Enter") {
        event.preventDefault()
        submit()
      }
    },
    [step, submit],
  )

  return { onCancel, onChange: updateField, onKeyDown, onStep: step, onSubmit: submit }
}

export function FocusSessionPicker({
  busy = false,
  className,
  error: serverError = null,
  initialDurationSeconds,
  onCancel,
  onConfirm,
  open,
  taskTitle,
}: FocusSessionPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const generatedId = useId().replaceAll(":", "")
  const minutesId = `focus-session-minutes-${generatedId}`
  const secondsId = `focus-session-seconds-${generatedId}`
  const errorId = `focus-session-error-${generatedId}`
  const [draft, setDraft] = useState<FocusSessionDraft>(() =>
    focusSessionDraftFromSeconds(safeInitialDuration(initialDurationSeconds)),
  )
  const localError = getFocusSessionDurationError(draft)
  const visibleError = serverError ?? localError
  const invalid = !isValidFocusSessionDraft(draft)

  useFocusPickerLifecycle({
    dialogRef,
    initialDurationSeconds,
    minutesRef,
    onCancel,
    open,
    setDraft,
  })
  const controls = useFocusPickerControls({
    busy,
    draft,
    onCancel,
    onConfirm,
    setDraft,
  })

  if (!open) {
    return null
  }

  return (
    <FocusSessionPanel
      busy={busy}
      className={className}
      dialogRef={dialogRef}
      draft={draft}
      error={visibleError}
      errorId={errorId}
      invalid={invalid}
      minutesId={minutesId}
      onCancel={controls.onCancel}
      onChange={controls.onChange}
      onKeyDown={controls.onKeyDown}
      onStep={controls.onStep}
      onSubmit={controls.onSubmit}
      secondsId={secondsId}
      taskTitle={taskTitle}
    />
  )
}
