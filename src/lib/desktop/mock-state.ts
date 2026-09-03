import type { AppSnapshot } from "./contracts"
import {
  overlaySurfaceSearch,
  settingsSurfaceSearch,
  tasksSurfaceSearch,
} from "./window-intent"
import { cloneSnapshot } from "./mock-state-helpers"
import type { MockState } from "./mock-state-types"

export type { MockState } from "./mock-state-types"
export { cloneSnapshot } from "./mock-state-helpers"
export {
  addMockTask,
  deleteMockTask,
  moveMockTasks,
  toggleMockTask,
  updateMockTask,
} from "./mock-state-tasks"
export {
  pauseMockFocus,
  resumeMockFocus,
  setMockAutostart,
  startMockFocus,
  stopMockFocus,
  toggleMockFocus,
  updateMockSettings,
} from "./mock-state-focus"

export function createMockState(snapshot: AppSnapshot): MockState {
  const taskIdNumbers = snapshot.tasks
    .map((task) => /^mock-task-(\d+)$/.exec(task.id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
  const sessionIdNumbers = snapshot.sessions
    .map((session) => /^mock-session-(\d+)$/.exec(session.id)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
  const startedAt = snapshot.focus.startedAt
    ? Date.parse(snapshot.focus.startedAt)
    : Number.NaN

  return {
    snapshot: cloneSnapshot(snapshot),
    nextTaskId: Math.max(0, ...taskIdNumbers) + 1,
    nextSessionId: Math.max(0, ...sessionIdNumbers) + 1,
    runningSince:
      snapshot.focus.state === "running" && Number.isFinite(startedAt)
        ? startedAt
        : null,
    accumulatedFocusMs:
      snapshot.focus.state === "paused"
        ? Math.max(
            0,
            snapshot.focus.totalMs - (snapshot.focus.pausedRemainingMs ?? 0),
          )
        : 0,
  }
}

export function navigateBrowserToTasks(
  intent: Parameters<typeof tasksSurfaceSearch>[0],
) {
  if (typeof window === "undefined") {
    return
  }
  window.history.pushState(
    {},
    "",
    `${window.location.pathname || "/"}${tasksSurfaceSearch(intent)}`,
  )
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function navigateBrowserToOverlay() {
  if (typeof window === "undefined") {
    return
  }
  window.history.pushState(
    {},
    "",
    `${window.location.pathname || "/"}${overlaySurfaceSearch()}`,
  )
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function navigateBrowserToSettings() {
  if (typeof window === "undefined") {
    return
  }
  window.history.pushState(
    {},
    "",
    `${window.location.pathname || "/"}${settingsSurfaceSearch()}`,
  )
  window.dispatchEvent(new PopStateEvent("popstate"))
}
