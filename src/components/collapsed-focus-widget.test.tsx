import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  COLLAPSED_WIDGET_FIXTURE_NAMES,
  createCollapsedWidgetFixtureSnapshot,
  createEmptyAppSnapshot,
} from "../lib/desktopApi"
import { CollapsedFocusWidget } from "./CollapsedFocusWidget"
import {
  deriveCollapsedFocusPresentation,
  formatFocusTime,
  getFocusProgress,
} from "./collapsedFocus"

const FIXTURE_NOW = Date.parse("2026-08-31T12:00:00.000Z")

function renderSnapshot(
  fixture: (typeof COLLAPSED_WIDGET_FIXTURE_NAMES)[number],
  now = Date.now(),
) {
  const snapshot = createCollapsedWidgetFixtureSnapshot(fixture, now)

  return render(
    <CollapsedFocusWidget
      focus={snapshot.focus}
      settings={snapshot.settings}
    />,
  )
}

describe("formatFocusTime", () => {
  it.each([
    { milliseconds: 0, expected: "00:00" },
    { milliseconds: 5_000, expected: "00:05" },
    { milliseconds: 65_001, expected: "01:06" },
    { milliseconds: 180 * 60 * 1000, expected: "180:00" },
    { milliseconds: -1_000, expected: "00:00" },
    { milliseconds: Number.NaN, expected: "00:00" },
  ])(
    "formats $milliseconds milliseconds as $expected",
    ({ milliseconds, expected }) => {
      expect(formatFocusTime(milliseconds)).toBe(expected)
    },
  )
})

describe("focus presentation", () => {
  it.each([
    { totalMs: 100, remainingMs: 100, expected: 0 },
    { totalMs: 100, remainingMs: 50, expected: 0.5 },
    { totalMs: 100, remainingMs: 0, expected: 1 },
    { totalMs: 100, remainingMs: 150, expected: 0 },
    { totalMs: 100, remainingMs: -1, expected: 1 },
    { totalMs: 0, remainingMs: 0, expected: 0 },
  ])(
    "clamps $remainingMs remaining milliseconds to $expected progress",
    ({ totalMs, remainingMs, expected }) => {
      expect(getFocusProgress(totalMs, remainingMs)).toBe(expected)
    },
  )

  it("keeps the empty title presentation valid", () => {
    const snapshot = createEmptyAppSnapshot()
    const focus = {
      ...snapshot.focus,
      state: "running" as const,
      activeTaskId: null,
      activeTaskTitle: "   ",
      startedAt: new Date(FIXTURE_NOW).toISOString(),
      endAt: new Date(FIXTURE_NOW + 60_000).toISOString(),
      totalMs: 60_000,
    }

    const presentation = deriveCollapsedFocusPresentation(
      focus,
      snapshot.settings,
      FIXTURE_NOW,
    )

    expect(presentation.title).toBe("Foco sem tarefa")
    expect(presentation.isVisible).toBe(true)
  })
})

describe("CollapsedFocusWidget", () => {
  it.each([
    { fixture: "running" as const, state: "running", mode: "normal" },
    { fixture: "paused" as const, state: "paused", mode: "normal" },
    { fixture: "no-task" as const, state: "running", mode: "normal" },
    { fixture: "long-title" as const, state: "running", mode: "normal" },
    { fixture: "minimal" as const, state: "running", mode: "minimal" },
    {
      fixture: "timeline-off" as const,
      state: "running",
      mode: "timeline-off",
    },
    { fixture: "rgb" as const, state: "running", mode: "rgb" },
  ])("renders the $fixture fixture", ({ fixture, state, mode }) => {
    renderSnapshot(fixture)

    const widget = screen.getByRole("group")

    expect(widget).toHaveAttribute("data-state", state)
    expect(widget).toHaveAttribute("data-mode", mode)
    expect(widget).toHaveClass("collapsed-focus-widget")

    if (fixture === "minimal") {
      expect(screen.queryByRole("timer")).not.toBeInTheDocument()
      expect(
        document.querySelector('[data-slot="focus-task-title"]'),
      ).not.toBeInTheDocument()
    } else {
      expect(screen.getByRole("timer")).toBeInTheDocument()
      expect(
        document.querySelector('[data-slot="focus-task-title"]'),
      ).toBeInTheDocument()
    }

    if (fixture === "timeline-off") {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
      expect(widget).toHaveAttribute("data-timeline", "off")
    } else {
      expect(screen.getByRole("progressbar")).toBeInTheDocument()
    }

    if (fixture === "rgb") {
      expect(widget.querySelector('[data-slot="progress-tray"]')).toHaveAttribute(
        "data-rainbow",
        "on",
      )
    }
  })

  it("renders the no-task fallback and truncates long titles", () => {
    const { unmount } = renderSnapshot("no-task")

    expect(screen.getByText("Foco sem tarefa")).toBeInTheDocument()
    unmount()

    renderSnapshot("long-title")

    const title = document.querySelector('[data-slot="focus-task-title"]')
    expect(title).toHaveClass("collapsed-focus-widget__task-title")
    expect(title).toHaveAttribute(
      "title",
      "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone",
    )
  })

  it("hides the idle presentation without rendering a progress bar", () => {
    const snapshot = createEmptyAppSnapshot()

    render(
      <CollapsedFocusWidget
        focus={snapshot.focus}
        settings={snapshot.settings}
      />,
    )

    const widget = document.querySelector(
      '[data-slot="collapsed-focus-widget"]',
    )

    expect(widget).toHaveAttribute("data-state", "idle")
    expect(widget).toHaveAttribute("hidden")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })
})

describe("CollapsedFocusWidget countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXTURE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("updates the visual seconds without changing the widget shell", () => {
    renderSnapshot("running")

    const widget = screen.getByRole("group")
    expect(screen.getByRole("timer")).toHaveTextContent("14:32")

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByRole("timer")).toHaveTextContent("14:31")
    expect(screen.getByRole("group")).toHaveClass(
      "collapsed-focus-widget",
    )
    expect(screen.getByRole("group")).toHaveAttribute(
      "data-mode",
      "normal",
    )
    expect(widget).toHaveAttribute("data-state", "running")
  })

  it("returns to idle when the session expires under the pointer", () => {
    const start = FIXTURE_NOW
    const snapshot = createEmptyAppSnapshot()
    const focus = {
      ...snapshot.focus,
      state: "running" as const,
      startedAt: new Date(start).toISOString(),
      endAt: new Date(start + 1_000).toISOString(),
      totalMs: 1_000,
    }

    render(
      <CollapsedFocusWidget
        focus={focus}
        settings={snapshot.settings}
      />,
    )

    fireEvent.pointerEnter(screen.getByRole("group"))

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    const idleWidget = document.querySelector(
      '[data-slot="collapsed-focus-widget"]',
    )
    expect(idleWidget).toHaveAttribute("data-state", "idle")
    expect(idleWidget).toHaveAttribute("hidden")
    expect(screen.queryByRole("timer")).not.toBeInTheDocument()
  })
})
