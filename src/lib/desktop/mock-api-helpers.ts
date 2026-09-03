import type { DesktopEventName } from "./api"
import type {
  AppSnapshot,
  DesktopEventMap,
  StartFocusInput,
} from "./contracts"
import {
  DesktopApiError,
  normalizeDesktopApiError,
} from "./errors"
import {
  cloneDesktopValue,
} from "./fixtures"
import {
  cloneSnapshot,
  createMockState,
} from "./mock-state"
import type {
  AnyEventPayload,
  MockDesktopApiContext,
  MockDesktopOperation,
  MockSnapshotHandler,
} from "./mock-api-types"

export function configuredFailure(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation | "subscribe",
) {
  const failure = context.options.failures?.[operation]
  if (!failure) {
    return null
  }
  if (failure instanceof DesktopApiError) {
    return failure
  }

  return new DesktopApiError({
    operation,
    code: failure,
    message: `The mock ${operation} operation failed.`,
  })
}

export function emitMockEvent<EventName extends DesktopEventName>(
  context: MockDesktopApiContext,
  eventName: EventName,
  payload: DesktopEventMap[EventName],
) {
  const eventListeners = context.listeners.get(eventName)
  if (!eventListeners) {
    return
  }

  const eventPayload = cloneDesktopValue(payload) as AnyEventPayload
  eventListeners.forEach((listener) => listener(eventPayload))
}

export function emitSnapshotChange(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  before: AppSnapshot,
  after: AppSnapshot,
) {
  const persistedStateChanged =
    JSON.stringify(before.tasks) !== JSON.stringify(after.tasks) ||
    JSON.stringify(before.sessions) !== JSON.stringify(after.sessions) ||
    JSON.stringify(before.settings) !== JSON.stringify(after.settings)
  const focusOperation =
    operation === "startFocus" ||
    operation === "pauseFocus" ||
    operation === "resumeFocus" ||
    operation === "stopFocus" ||
    operation === "toggleFocus"

  if (focusOperation) {
    emitMockEvent(context, "focus-changed", after)
    if (persistedStateChanged) {
      emitMockEvent(context, "store-changed", after)
    }
    return
  }

  if (operation === "updateSettings") {
    emitMockEvent(context, "store-changed", after)
    emitMockEvent(context, "settings-changed", after)
    return
  }

  if (operation === "setAutostart") {
    emitMockEvent(context, "store-changed", after)
    return
  }

  if (
    operation === "addTask" ||
    operation === "updateTask" ||
    operation === "deleteTask" ||
    operation === "toggleTask" ||
    operation === "moveTasks"
  ) {
    emitMockEvent(context, "store-changed", after)
  }
}

export function adoptSnapshot(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  snapshot: AppSnapshot,
  previousSnapshot = context.state.snapshot,
) {
  const before = cloneSnapshot(previousSnapshot)
  const nextSnapshot = cloneSnapshot(snapshot)
  nextSnapshot.revision = Math.max(
    before.revision + 1,
    Number.isFinite(nextSnapshot.revision) ? nextSnapshot.revision : 0,
  )
  context.state = createMockState(nextSnapshot)
  emitSnapshotChange(context, operation, before, nextSnapshot)
  return cloneSnapshot(nextSnapshot)
}

export function runMockOperation<Result>(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  callback: () => Promise<Result> | Result,
) {
  const failure = configuredFailure(context, operation)
  if (failure) {
    return Promise.reject(failure)
  }

  return Promise.resolve()
    .then(callback)
    .catch((error) => {
      throw normalizeDesktopApiError(error, operation)
    })
}

export function runSnapshotOperation(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  handler: MockSnapshotHandler,
  fallback: () => AppSnapshot,
) {
  return runMockOperation(context, operation, async () => {
    const previousSnapshot = cloneSnapshot(context.state.snapshot)
    const snapshot = handler ? await handler() : fallback()
    return adoptSnapshot(context, operation, snapshot, previousSnapshot)
  })
}

export function normalizeStartFocusInput(
  input: StartFocusInput | string | null,
): StartFocusInput {
  if (typeof input === "object" && input !== null) {
    return input
  }

  return { taskId: input, durationSeconds: null }
}
