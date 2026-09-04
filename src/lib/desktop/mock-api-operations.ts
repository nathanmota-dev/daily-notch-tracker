import type {
  DesktopApi,
  DesktopEventListener,
  DesktopEventName,
  DesktopUnlisten,
} from "./api"
import { cloneDesktopValue } from "./fixtures"
import {
  addMockTask,
  cloneSnapshot,
  deleteMockTask,
  moveMockTasks,
  navigateBrowserToOverlay,
  navigateBrowserToSettings,
  navigateBrowserToTasks,
  pauseMockFocus,
  resumeMockFocus,
  setMockAutostart,
  startMockFocus,
  stopMockFocus,
  toggleMockFocus,
  toggleMockTask,
  updateMockSettings,
  updateMockTask,
} from "./mock-state"
import {
  configuredFailure,
  normalizeStartFocusInput,
  runMockOperation,
  runSnapshotOperation,
} from "./mock-api-helpers"
import type {
  AnyEventListener,
  MockDesktopApiContext,
} from "./mock-api-types"

function createMockTaskOperations(context: MockDesktopApiContext): Pick<
  DesktopApi,
  "addTask" | "updateTask" | "deleteTask" | "toggleTask" | "moveTasks"
> {
  const handlers = context.options.handlers

  return {
    addTask: (input) =>
      runSnapshotOperation(
        context,
        "addTask",
        handlers?.addTask ? () => handlers.addTask!(input) : undefined,
        () => addMockTask(context.state, input),
      ),
    updateTask: (input) =>
      runSnapshotOperation(
        context,
        "updateTask",
        handlers?.updateTask ? () => handlers.updateTask!(input) : undefined,
        () => updateMockTask(context.state, input),
      ),
    deleteTask: (taskId) =>
      runSnapshotOperation(
        context,
        "deleteTask",
        handlers?.deleteTask ? () => handlers.deleteTask!(taskId) : undefined,
        () => deleteMockTask(context.state, taskId),
      ),
    toggleTask: (taskId) =>
      runSnapshotOperation(
        context,
        "toggleTask",
        handlers?.toggleTask ? () => handlers.toggleTask!(taskId) : undefined,
        () => toggleMockTask(context.state, taskId),
      ),
    moveTasks: (input) =>
      runSnapshotOperation(
        context,
        "moveTasks",
        handlers?.moveTasks ? () => handlers.moveTasks!(input) : undefined,
        () => moveMockTasks(context.state, input),
      ),
  }
}

function createMockFocusOperations(context: MockDesktopApiContext): Pick<
  DesktopApi,
  "startFocus" | "pauseFocus" | "resumeFocus" | "stopFocus" | "toggleFocus"
> {
  const handlers = context.options.handlers

  return {
    startFocus: (input) => {
      const normalizedInput = normalizeStartFocusInput(input)
      return runSnapshotOperation(
        context,
        "startFocus",
        handlers?.startFocus
          ? () => handlers.startFocus!(normalizedInput)
          : undefined,
        () => startMockFocus(context.state, normalizedInput),
      )
    },
    pauseFocus: () =>
      runSnapshotOperation(
        context,
        "pauseFocus",
        handlers?.pauseFocus ? () => handlers.pauseFocus!() : undefined,
        () => pauseMockFocus(context.state),
      ),
    resumeFocus: () =>
      runSnapshotOperation(
        context,
        "resumeFocus",
        handlers?.resumeFocus ? () => handlers.resumeFocus!() : undefined,
        () => resumeMockFocus(context.state),
      ),
    stopFocus: () =>
      runSnapshotOperation(
        context,
        "stopFocus",
        handlers?.stopFocus ? () => handlers.stopFocus!() : undefined,
        () => stopMockFocus(context.state),
      ),
    toggleFocus: () =>
      runSnapshotOperation(
        context,
        "toggleFocus",
        handlers?.toggleFocus ? () => handlers.toggleFocus!() : undefined,
        () => toggleMockFocus(context.state),
      ),
  }
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
    getSnapshot: () =>
      runMockOperation(context, "getSnapshot", async () =>
        cloneSnapshot(
          handlers?.getSnapshot
            ? await handlers.getSnapshot()
            : context.state.snapshot,
        ),
      ),
    ...createMockTaskOperations(context),
    ...createMockFocusOperations(context),
    updateSettings: (patch) =>
      runSnapshotOperation(
        context,
        "updateSettings",
        handlers?.updateSettings
          ? () => handlers.updateSettings!(patch)
          : undefined,
        () => updateMockSettings(context.state, patch),
      ),
    setAutostart: (enabled) =>
      runSnapshotOperation(
        context,
        "setAutostart",
        handlers?.setAutostart
          ? () => handlers.setAutostart!(enabled)
          : undefined,
        () => setMockAutostart(context.state, enabled),
      ),
  }
}

function createMockSystemOperations(
  context: MockDesktopApiContext,
): Pick<
  DesktopApi,
  | "getAppDiagnostics"
  | "openTasksWindow"
  | "closeTasksWindow"
  | "openSettingsWindow"
  | "closeSettingsWindow"
  | "returnToTasksWindow"
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
    openTasksWindow: (intent, origin) =>
      runMockOperation(context, "openTasksWindow", async () => {
        context.state.tasksWindowOrigin = origin ?? null
        if (handlers?.openTasksWindow) {
          await handlers.openTasksWindow(intent, origin)
          return
        }
        navigateBrowserToTasks(intent ?? { kind: "list" })
      }),
    closeTasksWindow: () =>
      runMockOperation(context, "closeTasksWindow", async () => {
        const origin = context.state.tasksWindowOrigin
        context.state.tasksWindowOrigin = null
        if (handlers?.closeTasksWindow) {
          await handlers.closeTasksWindow()
          return
        }
        navigateBrowserToOverlay(origin?.presentationMode)
      }),
    openSettingsWindow: () =>
      runMockOperation(context, "openSettingsWindow", async () => {
        if (handlers?.openSettingsWindow) {
          await handlers.openSettingsWindow()
          return
        }
        navigateBrowserToSettings()
      }),
    closeSettingsWindow: () =>
      runMockOperation(context, "closeSettingsWindow", async () => {
        context.state.tasksWindowOrigin = null
        if (handlers?.closeSettingsWindow) {
          await handlers.closeSettingsWindow()
          return
        }
        navigateBrowserToOverlay()
      }),
    returnToTasksWindow: () =>
      runMockOperation(context, "returnToTasksWindow", async () => {
        if (handlers?.returnToTasksWindow) {
          await handlers.returnToTasksWindow()
          return
        }
        navigateBrowserToTasks({ kind: "list" })
      }),
    openExternalRelease: (url) =>
      runMockOperation(context, "openExternalRelease", async () => {
        await handlers?.openExternalRelease?.(url)
      }),
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

export function createMockApi(context: MockDesktopApiContext): DesktopApi {
  return {
    ...createMockSnapshotOperations(context),
    ...createMockSystemOperations(context),
    subscribe: (eventName, listener) =>
      subscribeToMockEvent(context, eventName, listener),
  }
}
