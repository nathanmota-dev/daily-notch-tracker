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

export function createMockDesktopApi(
  options: MockDesktopApiOptions = {},
): MockDesktopApiController {
  let currentSnapshot = cloneDesktopValue(
    options.snapshot ?? createEmptyAppSnapshot(),
  )
  const diagnostics = cloneDesktopValue(
    options.diagnostics ?? createBrowserDiagnostics(),
  )
  const listeners = new Map<DesktopEventName, Set<AnyEventListener>>()

  function configuredFailure(operation: MockDesktopOperation | "subscribe") {
    const failure = options.failures?.[operation]

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

  async function run<Result>(
    operation: MockDesktopOperation,
    callback: () => Promise<Result>,
  ): Promise<Result> {
    const failure = configuredFailure(operation)

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
    operation: MockDesktopOperation,
    handler?: () => Promise<AppSnapshot>,
  ) {
    return run(operation, async () =>
      cloneDesktopValue(handler ? await handler() : currentSnapshot),
    )
  }

  function voidResult(
    operation: MockDesktopOperation,
    handler?: () => Promise<void>,
  ) {
    return run(operation, async () => {
      await handler?.()
    })
  }

  async function subscribe<EventName extends DesktopEventName>(
    eventName: EventName,
    listener: DesktopEventListener<EventName>,
  ): Promise<DesktopUnlisten> {
    const failure = configuredFailure("subscribe")

    if (failure) {
      throw failure
    }

    const eventListeners =
      listeners.get(eventName) ?? new Set<AnyEventListener>()
    const storedListener = listener as AnyEventListener
    eventListeners.add(storedListener)
    listeners.set(eventName, eventListeners)

    let listening = true

    return () => {
      if (!listening) {
        return
      }

      eventListeners.delete(storedListener)
      listening = false
    }
  }

  const api: DesktopApi = {
    getSnapshot: () =>
      snapshotResult("getSnapshot", options.handlers?.getSnapshot),
    addTask: (input) =>
      snapshotResult(
        "addTask",
        options.handlers?.addTask
          ? () => options.handlers!.addTask!(input)
          : undefined,
      ),
    updateTask: (input) =>
      snapshotResult(
        "updateTask",
        options.handlers?.updateTask
          ? () => options.handlers!.updateTask!(input)
          : undefined,
      ),
    deleteTask: (taskId) =>
      snapshotResult(
        "deleteTask",
        options.handlers?.deleteTask
          ? () => options.handlers!.deleteTask!(taskId)
          : undefined,
      ),
    toggleTask: (taskId) =>
      snapshotResult(
        "toggleTask",
        options.handlers?.toggleTask
          ? () => options.handlers!.toggleTask!(taskId)
          : undefined,
      ),
    moveTasks: (input) =>
      snapshotResult(
        "moveTasks",
        options.handlers?.moveTasks
          ? () => options.handlers!.moveTasks!(input)
          : undefined,
      ),
    startFocus: (taskId) =>
      snapshotResult(
        "startFocus",
        options.handlers?.startFocus
          ? () => options.handlers!.startFocus!(taskId)
          : undefined,
      ),
    pauseFocus: () =>
      snapshotResult("pauseFocus", options.handlers?.pauseFocus),
    resumeFocus: () =>
      snapshotResult("resumeFocus", options.handlers?.resumeFocus),
    stopFocus: () => snapshotResult("stopFocus", options.handlers?.stopFocus),
    toggleFocus: () =>
      snapshotResult("toggleFocus", options.handlers?.toggleFocus),
    updateSettings: (patch) =>
      snapshotResult(
        "updateSettings",
        options.handlers?.updateSettings
          ? () => options.handlers!.updateSettings!(patch)
          : undefined,
      ),
    getAppDiagnostics: () =>
      run("getAppDiagnostics", async () =>
        cloneDesktopValue(
          options.handlers?.getAppDiagnostics
            ? await options.handlers.getAppDiagnostics()
            : diagnostics,
        ),
      ),
    setAutostart: (enabled) =>
      snapshotResult(
        "setAutostart",
        options.handlers?.setAutostart
          ? () => options.handlers!.setAutostart!(enabled)
          : undefined,
      ),
    openTasksWindow: (intent) =>
      voidResult(
        "openTasksWindow",
        options.handlers?.openTasksWindow
          ? () => options.handlers!.openTasksWindow!(intent)
          : undefined,
      ),
    openSettingsWindow: () =>
      voidResult("openSettingsWindow", options.handlers?.openSettingsWindow),
    openExternalRelease: (url) =>
      voidResult(
        "openExternalRelease",
        options.handlers?.openExternalRelease
          ? () => options.handlers!.openExternalRelease!(url)
          : undefined,
      ),
    subscribe,
  }

  return {
    api,
    emit(eventName, payload) {
      const eventListeners = listeners.get(eventName)

      if (!eventListeners) {
        return
      }

      const eventPayload = cloneDesktopValue(payload) as AnyEventPayload
      eventListeners.forEach((listener) => listener(eventPayload))
    },
    getSnapshot() {
      return cloneDesktopValue(currentSnapshot)
    },
    setSnapshot(snapshot) {
      currentSnapshot = cloneDesktopValue(snapshot)
    },
  }
}
