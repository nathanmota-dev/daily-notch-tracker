import type {
  AppDiagnostics,
  AppSnapshot,
  FocusSnapshot,
  FocusState,
  Task,
} from "./contracts"
import { createEmptyAppSnapshot } from "./base-snapshot"
import {
  createExpandedDashboardFixtureSnapshot,
  EXPANDED_DASHBOARD_FIXTURE_NAMES,
  isExpandedDashboardFixture,
} from "./expanded-fixtures"
import { getLocalDateString } from "../local-date"

export {
  createExpandedDashboardFixtureSnapshot,
  EXPANDED_DASHBOARD_FIXTURE_NAMES,
  isExpandedDashboardFixture,
  type ExpandedDashboardFixture,
} from "./expanded-fixtures"
export { createEmptyAppSnapshot } from "./base-snapshot"

export const COLLAPSED_WIDGET_FIXTURE_NAMES = [
  "running",
  "paused",
  "no-task",
  "long-title",
  "minimal",
  "timeline-off",
  "rgb",
] as const

export type CollapsedWidgetFixture =
  (typeof COLLAPSED_WIDGET_FIXTURE_NAMES)[number]

export const WIDGET_FIXTURE_NAMES = [
  ...COLLAPSED_WIDGET_FIXTURE_NAMES,
  ...EXPANDED_DASHBOARD_FIXTURE_NAMES,
] as const

export type WidgetFixture = (typeof WIDGET_FIXTURE_NAMES)[number]

export function isCollapsedWidgetFixture(
  value: unknown,
): value is CollapsedWidgetFixture {
  return (
    typeof value === "string" &&
    (COLLAPSED_WIDGET_FIXTURE_NAMES as readonly string[]).includes(value)
  )
}

export function isWidgetFixture(value: unknown): value is WidgetFixture {
  return isCollapsedWidgetFixture(value) || isExpandedDashboardFixture(value)
}

export function resolveCollapsedWidgetFixture(
  search = "",
  environmentFixture?: string,
): CollapsedWidgetFixture | null {
  const queryFixture = new URLSearchParams(search).get("fixture")
  const candidate = queryFixture ?? environmentFixture

  return isCollapsedWidgetFixture(candidate) ? candidate : null
}

export function resolveWidgetFixture(
  search = "",
  environmentFixture?: string,
): WidgetFixture | null {
  const queryFixture = new URLSearchParams(search).get("fixture")
  const candidate = queryFixture ?? environmentFixture

  return isWidgetFixture(candidate) ? candidate : null
}

export function cloneDesktopValue<Value>(value: Value): Value {
  return structuredClone(value)
}

const FIXTURE_TOTAL_MS = 25 * 60 * 1000
const FIXTURE_REMAINING_MS = 14 * 60 * 1000 + 32 * 1000
const PAUSED_FIXTURE_REMAINING_MS = 9 * 60 * 1000 + 8 * 1000
const FIXTURE_TASK_ID = "fixture-task"

function fixtureTimestamp(milliseconds: number) {
  return new Date(milliseconds).toISOString()
}

function fixtureNow(milliseconds: number) {
  return Number.isFinite(milliseconds) ? milliseconds : Date.now()
}

function createFixtureTask(
  title: string,
  now: number,
  focusedSeconds: number,
): Task {
  return {
    id: FIXTURE_TASK_ID,
    title,
    notes: "",
    scheduledDate: getLocalDateString(now),
    estimateMinutes: 25,
    isDone: false,
    createdAt: fixtureTimestamp(
      now - (FIXTURE_TOTAL_MS - focusedSeconds * 1000),
    ),
    focusedSeconds,
    sortOrder: 0,
  }
}

function createFixtureFocus(
  state: FocusState,
  now: number,
  remainingMs: number,
  activeTaskTitle: string | null,
): FocusSnapshot {
  const elapsedMs = FIXTURE_TOTAL_MS - remainingMs

  return {
    state,
    activeTaskId: activeTaskTitle ? FIXTURE_TASK_ID : null,
    activeTaskTitle,
    startedAt: fixtureTimestamp(now - elapsedMs),
    endAt: state === "running" ? fixtureTimestamp(now + remainingMs) : null,
    pausedRemainingMs: state === "paused" ? remainingMs : null,
    totalMs: FIXTURE_TOTAL_MS,
  }
}

export function createCollapsedWidgetFixtureSnapshot(
  fixture: CollapsedWidgetFixture,
  now = Date.now(),
): AppSnapshot {
  const safeNow = fixtureNow(now)
  const snapshot = createEmptyAppSnapshot()
  const focusedSeconds = Math.floor(
    (FIXTURE_TOTAL_MS - FIXTURE_REMAINING_MS) / 1000,
  )
  const taskTitleByFixture: Partial<
    Record<CollapsedWidgetFixture, string>
  > = {
    running: "Plan the next focused block",
    paused: "Review the desktop contract",
    "long-title":
      "Review and refine the complete DailyNotch Linux focus workflow before the next implementation milestone",
    minimal: "Prepare the weekly planning session",
    "timeline-off": "Write the next product update",
    rgb: "Organize the release checklist",
  }
  const activeTaskTitle = taskTitleByFixture[fixture] ?? null
  const state: FocusState = fixture === "paused" ? "paused" : "running"
  const remainingMs =
    fixture === "paused" ? PAUSED_FIXTURE_REMAINING_MS : FIXTURE_REMAINING_MS

  snapshot.revision = 1
  snapshot.focus = createFixtureFocus(
    state,
    safeNow,
    remainingMs,
    activeTaskTitle,
  )

  if (fixture !== "no-task") {
    snapshot.tasks = [
      createFixtureTask(activeTaskTitle!, safeNow, focusedSeconds),
    ]
  }

  if (fixture === "minimal") {
    snapshot.settings.minimalMode = true
  }

  if (fixture === "timeline-off") {
    snapshot.settings.showTimeline = false
  }

  if (fixture === "rgb") {
    snapshot.settings.rainbowTimeline = true
  }

  return snapshot
}

export function createWidgetFixtureSnapshot(
  fixture: WidgetFixture,
  now = Date.now(),
): AppSnapshot {
  return isExpandedDashboardFixture(fixture)
    ? createExpandedDashboardFixtureSnapshot(fixture, now)
    : createCollapsedWidgetFixtureSnapshot(fixture, now)
}

export function createBrowserDiagnostics(): AppDiagnostics {
  return {
    appVersion: "0.1.0-browser",
    dataFilePath: "Browser mock does not persist data.",
    shortcut: {
      status: "unavailable",
      message: "Global shortcuts require the desktop runtime.",
    },
    autostart: {
      enabled: false,
      status: "unavailable",
      message: "Autostart requires the desktop runtime.",
    },
  }
}
