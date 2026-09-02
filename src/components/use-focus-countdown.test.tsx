import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createCollapsedWidgetFixtureSnapshot,
  createEmptyAppSnapshot,
  type FocusSnapshot,
} from "../lib/desktopApi"
import {
  FOCUS_PRESENTATION_TICK_MS,
  useFocusCountdown,
} from "./use-focus-countdown"

const FIXTURE_NOW = Date.parse("2026-08-31T12:00:00.000Z")

function CountdownProbe({
  focus,
  now,
}: {
  focus: FocusSnapshot
  now?: Date | number
}) {
  const countdown = useFocusCountdown(focus, { now })

  return (
    <output
      data-expired={countdown.isExpired ? "true" : "false"}
      data-now={countdown.now}
      data-progress={countdown.progress}
      data-remaining={countdown.remainingMs}
    />
  )
}

function runningFocus(
  taskId: string,
  totalMs: number,
  remainingMs: number,
): FocusSnapshot {
  return {
    ...createEmptyAppSnapshot().focus,
    state: "running",
    activeTaskId: taskId,
    activeTaskTitle: taskId,
    startedAt: new Date(FIXTURE_NOW + remainingMs - totalMs).toISOString(),
    endAt: new Date(FIXTURE_NOW + remainingMs).toISOString(),
    totalMs,
  }
}

function outputValue(name: string) {
  return Number(document.querySelector("output")?.getAttribute(name))
}

describe("useFocusCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXTURE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("ticks a running focus and derives progress from the same clock", () => {
    const focus = createCollapsedWidgetFixtureSnapshot("running", FIXTURE_NOW).focus

    render(<CountdownProbe focus={focus} />)

    expect(outputValue("data-remaining")).toBe(872_000)
    expect(outputValue("data-progress")).toBeCloseTo(628 / 1_500, 8)

    act(() => vi.advanceTimersByTime(1_000))

    expect(outputValue("data-remaining")).toBe(871_000)
    expect(outputValue("data-progress")).toBeCloseTo(629 / 1_500, 8)
  })

  it.each([
    { state: "paused" as const, remainingMs: 548_000 },
    { state: "idle" as const, remainingMs: 0 },
  ])("does not keep a timer for $state focus", ({ state, remainingMs }) => {
    const snapshot = createEmptyAppSnapshot()
    const focus = {
      ...snapshot.focus,
      state,
      pausedRemainingMs: state === "paused" ? remainingMs : null,
      totalMs: state === "paused" ? 1_500_000 : 0,
    }

    render(<CountdownProbe focus={focus} />)

    expect(outputValue("data-remaining")).toBe(remainingMs)
    expect(vi.getTimerCount()).toBe(0)

    act(() => vi.advanceTimersByTime(10_000))

    expect(outputValue("data-remaining")).toBe(remainingMs)
  })

  it("restarts its timer when a paused focus resumes", () => {
    const snapshot = createEmptyAppSnapshot()
    const pausedFocus = {
      ...snapshot.focus,
      state: "paused" as const,
      activeTaskId: "task-1",
      activeTaskTitle: "task-1",
      pausedRemainingMs: 30_000,
      totalMs: 60_000,
    }
    const resumedFocus = runningFocus("task-1", 60_000, 30_000)
    const view = render(<CountdownProbe focus={pausedFocus} />)

    expect(vi.getTimerCount()).toBe(0)

    view.rerender(<CountdownProbe focus={resumedFocus} />)
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(1_000))
    expect(outputValue("data-remaining")).toBe(29_000)
  })

  it("switches tasks without carrying the previous deadline", () => {
    const firstFocus = runningFocus("task-1", 60_000, 60_000)
    const secondFocus = runningFocus("task-2", 120_000, 120_000)
    const view = render(<CountdownProbe focus={firstFocus} />)

    act(() => vi.advanceTimersByTime(10_000))
    view.rerender(<CountdownProbe focus={secondFocus} />)

    expect(outputValue("data-remaining")).toBe(110_000)
    expect(outputValue("data-now")).toBe(FIXTURE_NOW + 10_000)
  })

  it("stops ticking after a running focus expires", () => {
    const focus = runningFocus("task-1", 1_000, 1_000)

    render(<CountdownProbe focus={focus} />)

    act(() => vi.advanceTimersByTime(1_000))

    expect(outputValue("data-remaining")).toBe(0)
    expect(document.querySelector("output")).toHaveAttribute(
      "data-expired",
      "true",
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it("uses a controlled clock without installing a timer", () => {
    const focus = runningFocus("task-1", 60_000, 60_000)
    const view = render(
      <CountdownProbe focus={focus} now={new Date(FIXTURE_NOW + 5_000)} />,
    )

    expect(outputValue("data-now")).toBe(FIXTURE_NOW + 5_000)
    expect(outputValue("data-remaining")).toBe(55_000)
    expect(vi.getTimerCount()).toBe(0)

    view.rerender(<CountdownProbe focus={focus} now={FIXTURE_NOW + 15_000} />)
    expect(outputValue("data-remaining")).toBe(45_000)
  })

  it("keeps the presentation tick at 250 milliseconds", () => {
    expect(FOCUS_PRESENTATION_TICK_MS).toBe(250)
  })
})
