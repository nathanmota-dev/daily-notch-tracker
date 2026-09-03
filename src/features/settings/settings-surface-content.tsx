import { CloseIcon, SettingsIcon } from "../../icons"
import { BackButton } from "../../components/back-button"
import { IconButton } from "../../components/icon-button"
import { Panel } from "../../components/panel"
import { Button } from "../../components/ui/button"
import {
  SettingsPrimarySections,
  SettingsSupportSections,
} from "./settings-surface-sections"
import type {
  SettingsHeaderProps,
  SettingsMutationErrorProps,
  SettingsSurfaceContentProps,
} from "./settings-view-types"

function SettingsHeader({ mutationBusy, onBack, onClose }: SettingsHeaderProps) {
  return (
    <header
      className="flex items-start justify-between gap-4"
      data-slot="settings-window-header"
    >
      <div className="flex min-w-0 items-start gap-2">
        <BackButton
          ariaLabel="Back to tasks"
          className="mt-0.5"
          disabled={mutationBusy}
          onClick={onBack}
          title="Back to tasks"
        />
        <div className="flex min-w-0 items-start gap-3">
          <SettingsIcon
            aria-hidden="true"
            className="mt-1 size-5 shrink-0 text-accent"
          />
          <div className="min-w-0">
            <p className="m-0 text-caption font-medium uppercase tracking-[0.2em] text-muted">
              DailyNotch Linux
            </p>
            <h1 className="m-0 mt-1 text-[clamp(1.75rem,5vw,2.35rem)] font-bold leading-[1.05] tracking-[-0.045em] text-content">
              Settings
            </h1>
            <p className="mt-2 max-w-xl text-body text-muted">
              Tune focus behavior and inspect the desktop integrations.
            </p>
          </div>
        </div>
      </div>
      <IconButton
        aria-label="Close Settings"
        className="size-8 rounded-full bg-panel-hover p-0 text-muted hover:bg-white/[0.12] hover:text-content"
        disabled={mutationBusy}
        onClick={onClose}
        size="sm"
        title="Close Settings"
        type="button"
        variant="ghost"
      >
        <CloseIcon aria-hidden="true" />
      </IconButton>
    </header>
  )
}

function SettingsMutationError({
  mutationBusy,
  mutationError,
  onRetryMutation,
}: SettingsMutationErrorProps) {
  if (!mutationError) {
    return null
  }

  return (
    <Panel
      className="gap-3 border border-danger/30 bg-danger/5 p-4"
      data-slot="settings-mutation-error"
      role="alert"
      variant="danger"
    >
      <div>
        <p className="m-0 text-sm font-medium text-danger">
          Could not save this setting.
        </p>
        <p className="mt-1 text-caption text-muted">{mutationError.message}</p>
      </div>
      {onRetryMutation && (
        <Button
          disabled={mutationBusy}
          onClick={onRetryMutation}
          size="sm"
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      )}
    </Panel>
  )
}

export function SettingsSurfaceContent({
  autostart,
  diagnostics,
  diagnosticsError,
  diagnosticsLoading,
  durationError,
  focusMinutesDraft,
  mutationError,
  mutationBusy,
  onAutostartChange,
  onBack,
  onClose,
  onCommitFocusMinutes,
  onFocusMinutesChange,
  onRetryDiagnostics,
  onRetryMutation,
  onToggle,
  settings,
  shortcutMessage,
  shortcutStatus,
}: SettingsSurfaceContentProps) {
  return (
    <main
      className="min-h-screen overflow-y-auto bg-canvas px-4 py-5 text-content sm:px-7 sm:py-7"
      data-surface="settings"
      data-slot="settings-surface"
    >
      <div className="mx-auto max-w-3xl">
        <SettingsHeader
          mutationBusy={mutationBusy}
          onBack={onBack}
          onClose={onClose}
        />
        <div className="mt-5 grid gap-3">
          <SettingsMutationError
            mutationBusy={mutationBusy}
            mutationError={mutationError}
            onRetryMutation={onRetryMutation}
          />
          <SettingsPrimarySections
            durationError={durationError}
            focusMinutesDraft={focusMinutesDraft}
            mutationBusy={mutationBusy}
            onCommitFocusMinutes={onCommitFocusMinutes}
            onFocusMinutesChange={onFocusMinutesChange}
            onToggle={onToggle}
            settings={settings}
          />
          <SettingsSupportSections
            autostart={autostart}
            diagnostics={diagnostics}
            diagnosticsError={diagnosticsError}
            diagnosticsLoading={diagnosticsLoading}
            mutationBusy={mutationBusy}
            onAutostartChange={onAutostartChange}
            onRetryDiagnostics={onRetryDiagnostics}
            shortcutMessage={shortcutMessage}
            shortcutStatus={shortcutStatus}
          />
        </div>
      </div>
    </main>
  )
}
