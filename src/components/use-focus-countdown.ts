import { useEffect, useState } from "react"

import type { FocusSnapshot } from "../lib/desktopApi"
import { getFocusProgress, getFocusRemainingMs } from "./collapsed-focus"

export const FOCUS_PRESENTATION_TICK_MS = 250

export type FocusCountdownOptions = {
  now?: Date | number
  tickMs?: number
}

export type FocusCountdownResult = {
  now: number
  remainingMs: number
  progress: number
  isExpired: boolean
}

type FocusCountdownInput = FocusCountdownOptions | Date | number | undefined

function toMilliseconds(value: Date | number | undefined) {
  return value instanceof Date ? value.getTime() : value
}

function resolveOptions(input: FocusCountdownInput): FocusCountdownOptions {
  if (input instanceof Date || typeof input === "number") {
    return { now: input }
  }

  return input ?? {}
}

function safeTickMs(value: number | undefined) {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? value
    : FOCUS_PRESENTATION_TICK_MS
}

export function useFocusCountdown(
  focus: FocusSnapshot,
  input?: FocusCountdownInput,
): FocusCountdownResult {
  const options = resolveOptions(input)
  const controlledNow = toMilliseconds(options.now)
  const tickMs = safeTickMs(options.tickMs)
  const [liveNow, setLiveNow] = useState(() => Date.now())
  const endAt = focus.endAt ? Date.parse(focus.endAt) : Number.NaN
  const shouldTick =
    controlledNow === undefined &&
    focus.state === "running" &&
    (!Number.isFinite(endAt) || endAt > liveNow)

  useEffect(() => {
    if (controlledNow !== undefined || !shouldTick) {
      return
    }

    const updateNow = () => setLiveNow(Date.now())
    updateNow()

    const interval = window.setInterval(updateNow, tickMs)

    return () => window.clearInterval(interval)
  }, [controlledNow, focus.activeTaskId, focus.endAt, focus.state, shouldTick, tickMs])

  const now = controlledNow ?? liveNow
  const remainingMs = getFocusRemainingMs(focus, now)

  return {
    now,
    remainingMs,
    progress: getFocusProgress(focus.totalMs, remainingMs),
    isExpired: focus.state === "running" && remainingMs <= 0,
  }
}
