import type {
  FocusSessionDraft,
  FocusSessionField,
  FocusSessionParts,
} from "./focus-session-types"

export const MIN_FOCUS_SESSION_SECONDS = 1
export const MAX_FOCUS_SESSION_SECONDS = 10_800
export const DEFAULT_FOCUS_SESSION_SECONDS = 1_500
export const MAX_FOCUS_SESSION_MINUTES = 180
export const MAX_FOCUS_SESSION_SECONDS_PART = 59

function finiteInteger(value: number) {
  return Number.isSafeInteger(value) ? value : 0
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function parseDraftNumber(value: string | number) {
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) {
    return null
  }

  const numericValue = Number(text)
  return Number.isSafeInteger(numericValue) ? numericValue : null
}

export function clampFocusDurationSeconds(value: number) {
  return clamp(
    finiteInteger(value),
    0,
    MAX_FOCUS_SESSION_SECONDS,
  )
}

export function durationSecondsToParts(seconds: number): FocusSessionParts {
  const safeSeconds = clampFocusDurationSeconds(seconds)

  return {
    minutes: Math.floor(safeSeconds / 60),
    seconds: safeSeconds % 60,
  }
}

export const secondsToDurationParts = durationSecondsToParts

export function durationPartsToSeconds(
  parts: Pick<FocusSessionParts, "minutes" | "seconds">,
) {
  const minutes = finiteInteger(parts.minutes)
  const seconds = finiteInteger(parts.seconds)

  return minutes * 60 + seconds
}

export const focusDurationToSeconds = durationPartsToSeconds

export function normalizeFocusDurationParts(
  parts: Pick<FocusSessionParts, "minutes" | "seconds">,
) {
  return durationSecondsToParts(durationPartsToSeconds(parts))
}

export function stepFocusDuration(
  parts: Pick<FocusSessionParts, "minutes" | "seconds">,
  field: FocusSessionField,
  direction: -1 | 1,
) {
  const increment = field === "minutes" ? 60 : 1
  const nextSeconds = clampFocusDurationSeconds(
    durationPartsToSeconds(parts) + increment * direction,
  )

  return durationSecondsToParts(nextSeconds)
}

export const stepDuration = stepFocusDuration

export function focusSessionDraftFromSeconds(
  seconds: number,
): FocusSessionDraft {
  const parts = durationSecondsToParts(seconds)

  return {
    minutes: String(parts.minutes),
    seconds: String(parts.seconds).padStart(2, "0"),
  }
}

export function parseFocusSessionDraft(
  draft: Pick<FocusSessionDraft, "minutes" | "seconds">,
) {
  const minutes = parseDraftNumber(draft.minutes)
  const seconds = parseDraftNumber(draft.seconds)

  if (minutes === null || seconds === null) {
    return null
  }

  return durationPartsToSeconds({ minutes, seconds })
}

export function getFocusSessionDurationError(
  draft: Pick<FocusSessionDraft, "minutes" | "seconds">,
) {
  const minutes = parseDraftNumber(draft.minutes)
  const seconds = parseDraftNumber(draft.seconds)

  if (
    minutes === null ||
    seconds === null ||
    minutes > MAX_FOCUS_SESSION_MINUTES ||
    seconds > MAX_FOCUS_SESSION_SECONDS_PART
  ) {
    return "Use whole minutes and seconds between 00:00 and 180:00."
  }

  const totalSeconds = durationPartsToSeconds({ minutes, seconds })
  if (
    totalSeconds < MIN_FOCUS_SESSION_SECONDS ||
    totalSeconds > MAX_FOCUS_SESSION_SECONDS
  ) {
    return "Choose a focus duration between 00:01 and 180:00."
  }

  return undefined
}

export function isValidFocusSessionDraft(
  draft: Pick<FocusSessionDraft, "minutes" | "seconds">,
) {
  return getFocusSessionDurationError(draft) === undefined
}

export function formatFocusSessionDuration(seconds: number) {
  const parts = durationSecondsToParts(seconds)

  return `${String(parts.minutes).padStart(2, "0")}:${String(parts.seconds).padStart(2, "0")}`
}

export function durationSecondsFromDraft(
  minutes: string,
  seconds: string,
) {
  return parseFocusSessionDraft({ minutes, seconds })
}
