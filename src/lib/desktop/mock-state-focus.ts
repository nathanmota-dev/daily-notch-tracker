import type { AppSnapshot, StartFocusInput } from "./contracts"
import { createEmptyAppSnapshot } from "./base-snapshot"
import { getLocalDateString } from "../local-date"
import {
  cloneSnapshot,
  commitSnapshot,
  nextRevision,
  stateError,
} from "./mock-state-helpers"
import type { MockState } from "./mock-state-types"

function focusElapsedMs(state: MockState, now: number, snapshot = state.snapshot) {
  if (snapshot.focus.state === "paused") {
    return state.accumulatedFocusMs
  }
  if (snapshot.focus.state !== "running" || state.runningSince === null) {
    return 0
  }
  const endAt = snapshot.focus.endAt ? Date.parse(snapshot.focus.endAt) : now
  return state.accumulatedFocusMs + Math.max(0, Math.min(now, endAt) - state.runningSince)
}

export function finishMockFocus(
  state: MockState,
  snapshot: AppSnapshot,
  completed: boolean,
  now: number,
) {
  const focus = snapshot.focus
  if (focus.state === "idle") {
    return
  }
  const startedAt = focus.startedAt ? Date.parse(focus.startedAt) : now
  const elapsedMs = focusElapsedMs(state, now, snapshot)
  const focusedSeconds = Math.floor(elapsedMs / 1000)
  const endedAt = Math.max(
    startedAt,
    focus.endAt ? Math.min(now, Date.parse(focus.endAt)) : now,
  )
  if (focusedSeconds > 0) {
    const sessionId = `mock-session-${state.nextSessionId++}`
    snapshot.sessions.push({
      id: sessionId,
      taskId: focus.activeTaskId,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      focusedSeconds,
      completed,
    })
    const task = snapshot.tasks.find((item) => item.id === focus.activeTaskId)
    if (task) {
      task.focusedSeconds += focusedSeconds
    }
  }
  snapshot.focus = createEmptyAppSnapshot().focus
  state.runningSince = null
  state.accumulatedFocusMs = 0
}

function durationForTask(snapshot: AppSnapshot, taskId: string | null) {
  const task = taskId
    ? snapshot.tasks.find((item) => item.id === taskId)
    : undefined
  return (task?.estimateMinutes ?? snapshot.settings.focusMinutes) * 60_000
}

function validateCustomDuration(durationSeconds: number | null, operation: string) {
  if (
    durationSeconds !== null &&
    (!Number.isSafeInteger(durationSeconds) ||
      durationSeconds < 1 ||
      durationSeconds > 10_800)
  ) {
    stateError(
      operation,
      "validation",
      "The focus duration must be between 1 and 10,800 seconds.",
      "durationSeconds",
    )
  }
}

export function startMockFocus(state: MockState, input: StartFocusInput) {
  validateCustomDuration(input.durationSeconds, "startFocus")
  const task = input.taskId
    ? state.snapshot.tasks.find((item) => item.id === input.taskId)
    : undefined
  if (input.taskId && !task) {
    stateError("startFocus", "not-found", "The task was not found.", "taskId")
  }
  if (task?.isDone) {
    stateError("startFocus", "conflict", "Completed tasks cannot be focused.", "taskId")
  }
  if (
    state.snapshot.focus.state !== "idle" &&
    state.snapshot.focus.activeTaskId === input.taskId
  ) {
    stateError(
      "startFocus",
      "conflict",
      "A focus is already active for this task.",
    )
  }
  const snapshot = cloneSnapshot(state.snapshot)
  const now = Date.now()
  if (snapshot.focus.state !== "idle") {
    finishMockFocus(state, snapshot, false, now)
  }
  const totalMs =
    input.durationSeconds === null
      ? durationForTask(snapshot, input.taskId)
      : input.durationSeconds * 1000
  const startedAt = new Date(now).toISOString()
  snapshot.focus = {
    state: "running",
    activeTaskId: input.taskId,
    activeTaskTitle: task?.title ?? null,
    startedAt,
    endAt: new Date(now + totalMs).toISOString(),
    pausedRemainingMs: null,
    totalMs,
  }
  state.runningSince = now
  state.accumulatedFocusMs = 0
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function pauseMockFocus(state: MockState) {
  if (state.snapshot.focus.state !== "running") {
    stateError("pauseFocus", "conflict", "Only a running focus can be paused.")
  }
  const snapshot = cloneSnapshot(state.snapshot)
  const now = Date.now()
  const elapsedMs = focusElapsedMs(state, now)
  const remainingMs = snapshot.focus.totalMs - elapsedMs
  if (remainingMs <= 0) {
    finishMockFocus(state, snapshot, true, now)
  } else {
    state.accumulatedFocusMs = elapsedMs
    state.runningSince = null
    snapshot.focus.state = "paused"
    snapshot.focus.endAt = null
    snapshot.focus.pausedRemainingMs = remainingMs
  }
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function resumeMockFocus(state: MockState) {
  const focus = state.snapshot.focus
  if (focus.state !== "paused") {
    stateError("resumeFocus", "conflict", "Only a paused focus can be resumed.")
  }
  const remainingMs = focus.pausedRemainingMs ?? 0
  if (remainingMs <= 0) {
    stateError("resumeFocus", "conflict", "The paused focus has no remaining time.")
  }
  const snapshot = cloneSnapshot(state.snapshot)
  const now = Date.now()
  snapshot.focus.state = "running"
  snapshot.focus.endAt = new Date(now + remainingMs).toISOString()
  snapshot.focus.pausedRemainingMs = null
  state.runningSince = now
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function stopMockFocus(state: MockState) {
  if (state.snapshot.focus.state === "idle") {
    stateError("stopFocus", "conflict", "There is no active focus to stop.")
  }
  const snapshot = cloneSnapshot(state.snapshot)
  const now = Date.now()
  const completed =
    snapshot.focus.state === "running" &&
    Boolean(snapshot.focus.endAt && now >= Date.parse(snapshot.focus.endAt))
  finishMockFocus(state, snapshot, completed, now)
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function toggleMockFocus(state: MockState) {
  if (state.snapshot.focus.state !== "idle") {
    return stopMockFocus(state)
  }
  const today = getLocalDateString()
  const task = state.snapshot.tasks.find(
    (item) => item.scheduledDate === today && !item.isDone,
  )
  return startMockFocus(state, {
    taskId: task?.id ?? null,
    durationSeconds: null,
  })
}

export function updateMockSettings(
  state: MockState,
  patch: Partial<AppSnapshot["settings"]>,
) {
  const snapshot = cloneSnapshot(state.snapshot)
  snapshot.settings = { ...snapshot.settings, ...patch }
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}

export function setMockAutostart(state: MockState, enabled: boolean) {
  const snapshot = cloneSnapshot(state.snapshot)
  snapshot.settings.launchAtLogin = enabled
  snapshot.revision = nextRevision(state)
  return commitSnapshot(state, snapshot)
}
