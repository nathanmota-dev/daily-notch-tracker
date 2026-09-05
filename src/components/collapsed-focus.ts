import type {
  FocusSettings,
  FocusSnapshot,
  FocusState,
} from "../lib/desktopApi"

import { clampProgress } from "./progress"

export const EMPTY_FOCUS_TASK_TITLE = "Foco sem tarefa"
export const READY_FOCUS_TITLE = "Ready to focus"

export type CollapsedFocusMode =
  | "idle"
  | "normal"
  | "minimal"
  | "timeline-off"
  | "rgb"

export type CollapsedFocusPresentation = {
  mode: CollapsedFocusMode
  state: FocusState
  isVisible: boolean
  remainingMs: number
  progress: number
  title: string
  showTimeline: boolean
  rainbowTimeline: boolean
}

function finiteNonNegative(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, value as number) : 0
}

export function formatFocusTime(remainingMs: number) {
  const totalSeconds = Math.ceil(finiteNonNegative(remainingMs) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function getFocusRemainingMs(
  focus: FocusSnapshot,
  now = Date.now(),
) {
  if (focus.state === "idle") {
    return 0
  }

  if (focus.state === "paused") {
    return finiteNonNegative(focus.pausedRemainingMs ?? focus.totalMs)
  }

  const endAt = focus.endAt ? Date.parse(focus.endAt) : Number.NaN

  if (Number.isFinite(endAt) && Number.isFinite(now)) {
    return Math.max(0, endAt - now)
  }

  return finiteNonNegative(focus.totalMs)
}

export function getFocusProgress(totalMs: number, remainingMs: number) {
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return 0
  }

  return clampProgress(
    (totalMs - finiteNonNegative(remainingMs)) / totalMs,
  )
}

export function deriveCollapsedFocusPresentation(
  focus: FocusSnapshot,
  settings: Pick<FocusSettings, "minimalMode" | "rainbowTimeline" | "showTimeline">,
  now = Date.now(),
): CollapsedFocusPresentation {
  const remainingMs = getFocusRemainingMs(focus, now)
  const sessionActive = focus.state !== "idle"
  const isVisible = sessionActive && remainingMs > 0
  const title = focus.activeTaskTitle?.trim() || EMPTY_FOCUS_TASK_TITLE
  const mode: CollapsedFocusMode = settings.minimalMode
    ? "minimal"
    : !settings.showTimeline
      ? "timeline-off"
      : settings.rainbowTimeline
        ? "rgb"
        : "normal"

  return {
    mode,
    state: isVisible ? focus.state : "idle",
    isVisible,
    remainingMs,
    progress: getFocusProgress(focus.totalMs, remainingMs),
    title,
    showTimeline: settings.showTimeline,
    rainbowTimeline: settings.showTimeline && settings.rainbowTimeline,
  }
}

export function getIdleFocusRemainingMs(
  focusMinutes: number,
  taskEstimateMinutes?: number,
) {
  const minutes = taskEstimateMinutes ?? focusMinutes

  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 0
}
