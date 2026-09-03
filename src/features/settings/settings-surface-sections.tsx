import {
  getTimelineControlState,
} from "./settings-model"
import {
  SettingsDiagnostics,
  SettingsDurationControl,
  SettingsSection,
  SettingsStatusRow,
  SettingsToggleRow,
} from "./settings-surface-controls"
import type { SettingsSurfaceContentProps } from "./settings-view-types"

export function SettingsPrimarySections({
  mutationBusy,
  onCommitFocusMinutes,
  onFocusMinutesChange,
  onToggle,
  settings,
  focusMinutesDraft,
  durationError,
}: Pick<
  SettingsSurfaceContentProps,
  | "durationError"
  | "focusMinutesDraft"
  | "mutationBusy"
  | "onCommitFocusMinutes"
  | "onFocusMinutesChange"
  | "onToggle"
  | "settings"
>) {
  const timeline = getTimelineControlState(settings)

  return (
    <>
      <SettingsSection
        description="Choose the default length for a task-free focus session."
        id="timer"
        title="Timer"
      >
        <SettingsDurationControl
          draft={focusMinutesDraft}
          error={durationError}
          onChange={onFocusMinutesChange}
          onCommit={onCommitFocusMinutes}
        />
      </SettingsSection>

      <SettingsSection
        description="Control the feedback you receive during focus."
        id="alerts"
        title="Alerts"
      >
        <SettingsToggleRow
          checked={settings.notificationsEnabled}
          description="Show desktop notifications for focus transitions."
          disabled={mutationBusy}
          label="Notifications"
          onCheckedChange={(checked) => onToggle("notificationsEnabled", checked)}
          setting="notificationsEnabled"
        />
        <SettingsToggleRow
          checked={settings.playSound}
          description="Play a sound when a focus session changes state."
          disabled={mutationBusy}
          label="Play sound"
          onCheckedChange={(checked) => onToggle("playSound", checked)}
          setting="playSound"
        />
      </SettingsSection>

      <SettingsSection
        description="Shape the notch and expanded dashboard appearance."
        id="appearance"
        title="Appearance"
      >
        <SettingsToggleRow
          checked={settings.showTimeline}
          description="Show the progress timeline around focus surfaces."
          disabled={mutationBusy}
          label="Show timeline"
          onCheckedChange={(checked) => onToggle("showTimeline", checked)}
          setting="showTimeline"
        />
        <SettingsToggleRow
          checked={timeline.rainbowTimeline}
          description={
            timeline.showTimeline
              ? "Use animated RGB colors on the timeline."
              : "Enable the timeline before using RGB colors."
          }
          disabled={mutationBusy || !timeline.showTimeline}
          label="RGB timeline"
          onCheckedChange={(checked) => onToggle("rainbowTimeline", checked)}
          setting="rainbowTimeline"
        />
        <SettingsToggleRow
          checked={settings.minimalMode}
          description="Keep the collapsed focus widget to its minimal shape."
          disabled={mutationBusy}
          label="Minimal mode"
          onCheckedChange={(checked) => onToggle("minimalMode", checked)}
          setting="minimalMode"
        />
      </SettingsSection>
    </>
  )
}

export function SettingsSupportSections({
  autostart,
  diagnostics,
  diagnosticsError,
  diagnosticsLoading,
  mutationBusy,
  onAutostartChange,
  onRetryDiagnostics,
  shortcutMessage,
  shortcutStatus,
}: Pick<
  SettingsSurfaceContentProps,
  | "autostart"
  | "diagnostics"
  | "diagnosticsError"
  | "diagnosticsLoading"
  | "mutationBusy"
  | "onAutostartChange"
  | "onRetryDiagnostics"
  | "shortcutMessage"
  | "shortcutStatus"
>) {
  return (
    <>
      <SettingsSection
        description="Connect DailyNotch to your desktop session."
        id="startup"
        title="Startup"
      >
        <SettingsToggleRow
          checked={autostart.checked}
          description={autostart.message ?? "Start DailyNotch when you sign in."}
          disabled={mutationBusy || autostart.disabled}
          label="Launch at login"
          onCheckedChange={onAutostartChange}
        />
        <SettingsStatusRow
          label="Autostart integration"
          message={autostart.message}
          status={autostart.status}
        />
      </SettingsSection>

      <SettingsSection
        description="Review the current global shortcut integration."
        id="shortcut"
        title="Shortcut"
      >
        <SettingsStatusRow
          label="Global shortcut"
          message={shortcutMessage}
          status={shortcutStatus}
        />
      </SettingsSection>

      <SettingsSection
        description="Safe, local information to include when asking for support."
        id="diagnostics"
        title="Diagnostics"
      >
        <SettingsDiagnostics
          diagnostics={diagnostics}
          diagnosticsError={diagnosticsError}
          diagnosticsLoading={diagnosticsLoading}
          onRetryDiagnostics={onRetryDiagnostics}
        />
      </SettingsSection>
    </>
  )
}
