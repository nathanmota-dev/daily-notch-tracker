import type { AppDiagnostics, AppSnapshot } from "./contracts"

export function cloneDesktopValue<Value>(value: Value): Value {
  return structuredClone(value)
}

export function createEmptyAppSnapshot(): AppSnapshot {
  return {
    revision: 0,
    tasks: [],
    sessions: [],
    settings: {
      focusMinutes: 25,
      notificationsEnabled: true,
      playSound: true,
      showTimeline: true,
      rainbowTimeline: false,
      minimalMode: false,
      launchAtLogin: false,
    },
    focus: {
      state: "idle",
      activeTaskId: null,
      activeTaskTitle: null,
      startedAt: null,
      endAt: null,
      pausedRemainingMs: null,
      totalMs: 0,
    },
    shortcutStatus: "unavailable",
  }
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
