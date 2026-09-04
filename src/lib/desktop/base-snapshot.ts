import type { AppSnapshot } from "./contracts"

export function createEmptyAppSnapshot(): AppSnapshot {
  return {
    revision: 0,
    tasks: [],
    sessions: [],
    settings: {
      focusMinutes: 25,
      notificationsEnabled: true,
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
