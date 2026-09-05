import { invoke as tauriInvoke, isTauri } from "@tauri-apps/api/core"
import { listen as tauriListen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"

import type {
  DesktopApi,
  DesktopEventListener,
  DesktopEventName,
  DesktopUnlisten,
} from "./api"
import type {
  DesktopCommandMap,
  DesktopEventMap,
  StartFocusInput,
} from "./contracts"
import { normalizeDesktopApiError } from "./errors"
import { isSurfaceChangedPayload } from "./window-navigation-contracts"

export interface TauriTransport {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
  listen(
    eventName: string,
    listener: (payload: unknown) => void,
  ): Promise<DesktopUnlisten>
}

const defaultTauriTransport: TauriTransport = {
  invoke: (command, args) => tauriInvoke(command, args),
  listen: (eventName, listener) =>
    tauriListen<unknown>(eventName, (event) => listener(event.payload), {
      target: {
        kind: "WebviewWindow",
        label: getCurrentWindow().label,
      },
    }),
}

type DesktopCommandName = keyof DesktopCommandMap

type StartFocusRequest = StartFocusInput | string | null

function normalizeStartFocusInput(input: StartFocusRequest): StartFocusInput {
  if (typeof input === "object" && input !== null) {
    return input
  }

  // Keep callers compiled against the original task-id-only API compatible;
  // Rust applies the null custom-duration default when the field is absent.
  return { taskId: input } as StartFocusInput
}

export function isTauriRuntime() {
  return isTauri()
}

export function getTauriWindowLabel() {
  if (!isTauriRuntime()) {
    return undefined
  }

  try {
    return getCurrentWindow().label
  } catch {
    return undefined
  }
}

export function createTauriDesktopApi(
  transport: TauriTransport = defaultTauriTransport,
): DesktopApi {
  async function execute<CommandName extends DesktopCommandName>(
    operation: string,
    commandName: CommandName,
    args: DesktopCommandMap[CommandName]["args"],
  ): Promise<DesktopCommandMap[CommandName]["result"]> {
    try {
      return (await transport.invoke(
        commandName,
        args === undefined
          ? undefined
          : (args as Record<string, unknown>),
      )) as DesktopCommandMap[CommandName]["result"]
    } catch (error) {
      throw normalizeDesktopApiError(error, operation)
    }
  }

  async function subscribe<EventName extends DesktopEventName>(
    eventName: EventName,
    listener: DesktopEventListener<EventName>,
  ): Promise<DesktopUnlisten> {
    try {
      return await transport.listen(eventName, (payload) => {
        if (eventName === "surface-changed" && !isSurfaceChangedPayload(payload)) {
          return
        }

        listener(payload as DesktopEventMap[EventName])
      })
    } catch (error) {
      throw normalizeDesktopApiError(error, `subscribe:${eventName}`)
    }
  }

  return {
    getSnapshot: () => execute("getSnapshot", "get_snapshot", undefined),
    getWindowPlacement: () =>
      execute("getWindowPlacement", "get_window_placement", undefined),
    saveWindowPlacement: () =>
      execute("saveWindowPlacement", "save_window_placement", undefined),
    addTask: (input) => execute("addTask", "add_task", { input }),
    updateTask: (input) => execute("updateTask", "update_task", { input }),
    deleteTask: (taskId) => execute("deleteTask", "delete_task", { taskId }),
    toggleTask: (taskId) => execute("toggleTask", "toggle_task", { taskId }),
    moveTasks: (input) => execute("moveTasks", "move_tasks", { input }),
    startFocus: (input) =>
      execute(
        "startFocus",
        "start_focus",
        normalizeStartFocusInput(input),
      ),
    pauseFocus: () => execute("pauseFocus", "pause_focus", undefined),
    resumeFocus: () => execute("resumeFocus", "resume_focus", undefined),
    stopFocus: () => execute("stopFocus", "stop_focus", undefined),
    toggleFocus: () => execute("toggleFocus", "toggle_focus", undefined),
    updateSettings: (patch) =>
      execute("updateSettings", "update_settings", { patch }),
    getAppDiagnostics: () =>
      execute("getAppDiagnostics", "get_app_diagnostics", undefined),
    setAutostart: (enabled) =>
      execute("setAutostart", "set_autostart", { enabled }),
    openTasksWindow: (intent, origin) =>
      execute("openTasksWindow", "open_tasks_window", {
        intent: intent ?? null,
        origin: origin ?? null,
      }),
    closeTasksWindow: () =>
      execute("closeTasksWindow", "close_tasks_window", undefined),
    openSettingsWindow: () =>
      execute("openSettingsWindow", "open_settings_window", undefined),
    closeSettingsWindow: () =>
      execute("closeSettingsWindow", "close_settings_window", undefined),
    returnToTasksWindow: () =>
      execute(
        "returnToTasksWindow",
        "return_to_tasks_window",
        undefined,
      ),
    openExternalRelease: (url) =>
      execute("openExternalRelease", "open_external_release", { url }),
    subscribe,
  }
}
