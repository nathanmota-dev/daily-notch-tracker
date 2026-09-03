import type {
  AppDiagnostics,
  FocusSettings,
  FocusSettingsPatch,
  IntegrationStatus,
  ShortcutStatus,
} from "../../lib/desktopApi"

export const MIN_FOCUS_MINUTES = 1
export const MAX_FOCUS_MINUTES = 180
export const DEFAULT_FOCUS_MINUTES = 25

export const FOCUS_MINUTES_ERROR =
  "Enter a whole number of minutes between 1 and 180."

export type SettingsToggleKey =
  | "notificationsEnabled"
  | "playSound"
  | "showTimeline"
  | "rainbowTimeline"
  | "minimalMode"

export type AutostartControlState = {
  checked: boolean
  disabled: boolean
  message: string | null
  status: IntegrationStatus
}

export function clampFocusMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_FOCUS_MINUTES
  }

  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.trunc(value)))
}

export function parseFocusMinutes(value: string) {
  const trimmedValue = value.trim()
  if (!/^\d+$/.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)
  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < MIN_FOCUS_MINUTES ||
    parsedValue > MAX_FOCUS_MINUTES
  ) {
    return null
  }

  return parsedValue
}

export function settingsTogglePatch(
  key: SettingsToggleKey,
  checked: boolean,
): FocusSettingsPatch {
  switch (key) {
    case "notificationsEnabled":
      return { notificationsEnabled: checked }
    case "playSound":
      return { playSound: checked }
    case "showTimeline":
      return { showTimeline: checked }
    case "rainbowTimeline":
      return { rainbowTimeline: checked }
    case "minimalMode":
      return { minimalMode: checked }
  }
}

export function getStatusLabel(status: IntegrationStatus | ShortcutStatus) {
  switch (status) {
    case "available":
    case "registered":
      return "Available"
    case "unavailable":
      return "Unavailable"
    case "error":
      return "Error"
  }
}

export function getAutostartControlState(
  diagnostics: AppDiagnostics | null,
  diagnosticsLoading = false,
): AutostartControlState {
  if (!diagnostics) {
    return {
      checked: false,
      disabled: true,
      message: diagnosticsLoading
        ? "Checking autostart status…"
        : "Autostart status is unavailable.",
      status: "unavailable",
    }
  }

  const { autostart } = diagnostics
  return {
    checked: autostart.status === "available" && autostart.enabled,
    disabled: autostart.status !== "available",
    message: autostart.message,
    status: autostart.status,
  }
}

export function getTimelineControlState(settings: FocusSettings) {
  return {
    showTimeline: settings.showTimeline,
    rainbowTimeline: settings.showTimeline && settings.rainbowTimeline,
  }
}
