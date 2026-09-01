import type {
  DesktopApi,
  DesktopEventListener,
  DesktopEventName,
  DesktopUnlisten,
} from "./api"
import type {
  AppDiagnostics,
  AppSnapshot,
  DesktopEventMap,
} from "./contracts"
import {
  DesktopApiError,
  type DesktopApiErrorCode,
  normalizeDesktopApiError,
} from "./errors"
import {
  cloneDesktopValue,
  createBrowserDiagnostics,
  createEmptyAppSnapshot,
} from "./fixtures"

export type MockDesktopOperation = Exclude<keyof DesktopApi, "subscribe">
export type MockDesktopApiHandlers = Partial<
  Pick<DesktopApi, MockDesktopOperation>
>
export type MockDesktopFailure = DesktopApiError | DesktopApiErrorCode

export type MockDesktopApiOptions = {
  snapshot?: AppSnapshot
  diagnostics?: AppDiagnostics
  handlers?: MockDesktopApiHandlers
  failures?: Partial<
    Record<MockDesktopOperation | "subscribe", MockDesktopFailure>
  >
}

export type MockDesktopApiController = {
  api: DesktopApi
  emit<EventName extends DesktopEventName>(
    eventName: EventName,
    payload: DesktopEventMap[EventName],
  ): void
  getSnapshot(): AppSnapshot
  setSnapshot(snapshot: AppSnapshot): void
}

type AnyEventPayload = DesktopEventMap[DesktopEventName]
type AnyEventListener = (payload: AnyEventPayload) => void

type MockDesktopApiContext = {
  options: MockDesktopApiOptions
  currentSnapshot: AppSnapshot
  diagnostics: AppDiagnostics
  listeners: Map<DesktopEventName, Set<AnyEventListener>>
}

function configuredFailure(
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

async function runMockOperation<Result>(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  callback: () => Promise<Result>,
): Promise<Result> {
  const failure = configuredFailure(context, operation)

  if (failure) {
    throw failure
  }

  try {
    return await callback()
  } catch (error) {
    throw normalizeDesktopApiError(error, operation)
  }
}

function snapshotResult(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  handler?: () => Promise<AppSnapshot>,
) {
  return runMockOperation(context, operation, async () =>
    cloneDesktopValue(handler ? await handler() : context.currentSnapshot),
  )
}

function voidResult(
  context: MockDesktopApiContext,
  operation: MockDesktopOperation,
  handler?: () => Promise<void>,
) {
  return runMockOperation(context, operation, async () => {
    await handler?.()
  })
}

function createMockSnapshotOperations(
  context: MockDesktopApiContext,
): Pick<
  DesktopApi,
  | "getSnapshot"
  | "addTask"
  | "updateTask"
  | "deleteTask"
  | "toggleTask"
  | "moveTasks"
  | "startFocus"
  | "pauseFocus"
  | "resumeFocus"
  | "stopFocus"
  | "toggleFocus"
  | "updateSettings"
  | "setAutostart"
> {
  const handlers = context.options.handlers

  return {
    getSnapshot: () => snapshotResult(context, "getSnapshot", handlers?.getSnapshot),
    addTask: (input) =>
      snapshotResult(
        context,
        "addTask",
        handlers?.addTask ? () => handlers.addTask!(input) : undefined,
      ),
    updateTask: (input) =>
      snapshotResult(
        context,
        "updateTask",
        handlers?.updateTask ? () => handlers.updateTask!(input) : undefined,
      ),
    deleteTask: (taskId) =>
      snapshotResult(
        context,
        "deleteTask",
        handlers?.deleteTask ? () => handlers.deleteTask!(taskId) : undefined,
      ),
    toggleTask: (taskId) =>
      snapshotResult(
        context,
        "toggleTask",
        handlers?.toggleTask ? () => handlers.toggleTask!(taskId) : undefined,
      ),
    moveTasks: (input) =>
      snapshotResult(
        context,
        "moveTasks",
        handlers?.moveTasks ? () => handlers.moveTasks!(input) : undefined,
      ),
    startFocus: (taskId) =>
      snapshotResult(
        context,
        "startFocus",
        handlers?.startFocus ? () => handlers.startFocus!(taskId) : undefined,
      ),
    pauseFocus: () => snapshotResult(context, "pauseFocus", handlers?.pauseFocus),
    resumeFocus: () =>
      snapshotResult(context, "resumeFocus", handlers?.resumeFocus),
    stopFocus: () => snapshotResult(context, "stopFocus", handlers?.stopFocus),
    toggleFocus: () =>
      snapshotResult(context, "toggleFocus", handlers?.toggleFocus),
    updateSettings: (patch) =>
      snapshotResult(
        context,
        "updateSettings",
        handlers?.updateSettings
          ? () => handlers.updateSettings!(patch)
          : undefined,
      ),
    setAutostart: (enabled) =>
      snapshotResult(
        context,
        "setAutostart",
        handlers?.setAutostart
          ? () => handlers.setAutostart!(enabled)
          : undefined,
      ),
  }
}

function createMockSystemOperations(
  context: MockDesktopApiContext,
): Pick<
  DesktopApi,
  | "getAppDiagnostics"
  | "openTasksWindow"
  | "openSettingsWindow"
  | "openExternalRelease"
> {
  const handlers = context.options.handlers

  return {
    getAppDiagnostics: () =>
      runMockOperation(context, "getAppDiagnostics", async () =>
        cloneDesktopValue(
          handlers?.getAppDiagnostics
            ? await handlers.getAppDiagnostics()
            : context.diagnostics,
        ),
      ),
    openTasksWindow: (intent) =>
      voidResult(
        context,
        "openTasksWindow",
        handlers?.openTasksWindow
          ? () => handlers.openTasksWindow!(intent)
          : undefined,
      ),
    openSettingsWindow: () =>
      voidResult(context, "openSettingsWindow", handlers?.openSettingsWindow),
    openExternalRelease: (url) =>
      voidResult(
        context,
        "openExternalRelease",
        handlers?.openExternalRelease
          ? () => handlers.openExternalRelease!(url)
          : undefined,
      ),
  }
}

async function subscribeToMockEvent<EventName extends DesktopEventName>(
  context: MockDesktopApiContext,
  eventName: EventName,
  listener: DesktopEventListener<EventName>,
): Promise<DesktopUnlisten> {
  const failure = configuredFailure(context, "subscribe")

  if (failure) {
    throw failure
  }

  const eventListeners =
    context.listeners.get(eventName) ?? new Set<AnyEventListener>()
  const storedListener = listener as AnyEventListener
  eventListeners.add(storedListener)
  context.listeners.set(eventName, eventListeners)

  let listening = true

  return () => {
    if (!listening) {
      return
    }

    eventListeners.delete(storedListener)
    listening = false
  }
}

function createMockApi(context: MockDesktopApiContext): DesktopApi {
  return {
    ...createMockSnapshotOperations(context),
    ...createMockSystemOperations(context),
    subscribe: (eventName, listener) =>
      subscribeToMockEvent(context, eventName, listener),
  }
}

function emitMockEvent<EventName extends DesktopEventName>(
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

export function createMockDesktopApi(
  options: MockDesktopApiOptions = {},
): MockDesktopApiController {
  const context: MockDesktopApiContext = {
    options,
    currentSnapshot: cloneDesktopValue(
      options.snapshot ?? createEmptyAppSnapshot(),
    ),
    diagnostics: cloneDesktopValue(
      options.diagnostics ?? createBrowserDiagnostics(),
    ),
    listeners: new Map<DesktopEventName, Set<AnyEventListener>>(),
  }

  return {
    api: createMockApi(context),
    emit: (eventName, payload) => emitMockEvent(context, eventName, payload),
    getSnapshot: () => cloneDesktopValue(context.currentSnapshot),
    setSnapshot: (snapshot) => {
      context.currentSnapshot = cloneDesktopValue(snapshot)
    },
  }
}
