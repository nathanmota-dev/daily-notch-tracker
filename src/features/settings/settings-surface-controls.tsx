import { useId } from "react"

import { Panel } from "../../components/panel"
import { Toggle } from "../../components/toggle"
import { Button } from "../../components/ui/button"
import { getStatusLabel } from "./settings-model"
import type {
  SettingsDiagnosticsProps,
  SettingsDurationControlProps,
  SettingsSectionProps,
  SettingsStatusRowProps,
  SettingsToggleRowProps,
} from "./settings-view-types"

export function SettingsSection({
  children,
  description,
  id,
  title,
}: SettingsSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="min-w-0 rounded-card border border-border bg-panel/80 p-4 shadow-panel"
      data-section={id}
      data-slot="settings-section"
    >
      <h2
        className="m-0 text-base font-semibold tracking-[-0.02em] text-content"
        id={`${id}-heading`}
      >
        {title}
      </h2>
      <p className="mt-1.5 text-caption text-muted">{description}</p>
      <div className="mt-4 divide-y divide-border">{children}</div>
    </section>
  )
}

export function SettingsToggleRow({
  checked,
  description,
  disabled = false,
  label,
  onCheckedChange,
  setting,
}: SettingsToggleRowProps) {
  const descriptionId = useId()

  return (
    <div
      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
      data-setting={setting}
      data-slot="settings-toggle-row"
    >
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium text-content">{label}</p>
        <p className="mt-1 text-caption text-muted" id={descriptionId}>
          {description}
        </p>
      </div>
      <Toggle
        aria-describedby={descriptionId}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

export function SettingsStatusRow({
  label,
  message,
  status,
}: SettingsStatusRowProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-t border-border py-3 last:pb-0"
      data-status={status}
      data-slot="settings-status-row"
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm text-content">
        <span className="font-medium">{getStatusLabel(status)}</span>
        {message && (
          <span className="mt-1 block max-w-[18rem] text-caption text-muted">
            {message}
          </span>
        )}
      </span>
    </div>
  )
}

export function SettingsDurationControl({
  draft,
  error,
  onChange,
  onCommit,
}: SettingsDurationControlProps) {
  const errorId = useId()

  return (
    <div
      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
      data-slot="settings-duration-control"
    >
      <div className="min-w-0">
        <label
          className="text-sm font-medium text-content"
          htmlFor="settings-focus-minutes"
        >
          Focus duration
        </label>
        <p className="mt-1 text-caption text-muted">
          Default for sessions without a task, from 1 to 180 minutes.
        </p>
        {error && (
          <p className="mt-1 text-caption text-danger" id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        aria-label="Focus duration (minutes)"
        className="h-9 w-24 rounded-control border border-border bg-canvas px-2.5 text-right text-sm text-content outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
        data-slot="settings-focus-minutes"
        id="settings-focus-minutes"
        inputMode="numeric"
        max={180}
        min={1}
        onBlur={onCommit}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onCommit()
          }
        }}
        step={1}
        type="number"
        value={draft}
      />
    </div>
  )
}

export function SettingsDiagnostics({
  diagnostics,
  diagnosticsError,
  diagnosticsLoading,
  onRetryDiagnostics,
}: SettingsDiagnosticsProps) {
  if (diagnosticsLoading) {
    return (
      <p
        className="py-3 text-sm text-muted"
        data-slot="settings-diagnostics-loading"
        role="status"
      >
        Loading diagnostics…
      </p>
    )
  }

  if (diagnosticsError || !diagnostics) {
    return (
      <Panel
        className="gap-3 border border-danger/30 bg-danger/5 p-3"
        data-slot="settings-diagnostics-error"
        variant="danger"
      >
        <p className="m-0 text-sm text-muted" role="alert">
          {diagnosticsError?.message ?? "Diagnostics are unavailable."}
        </p>
        <Button onClick={onRetryDiagnostics} size="sm" type="button" variant="outline">
          Retry diagnostics
        </Button>
      </Panel>
    )
  }

  return (
    <dl className="divide-y divide-border" data-slot="settings-diagnostics-details">
      <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
        <dt className="text-sm text-muted">Application version</dt>
        <dd className="m-0 text-sm text-content">{diagnostics.appVersion}</dd>
      </div>
      <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
        <dt className="text-sm text-muted">Data file</dt>
        <dd className="m-0 break-all font-mono text-xs text-content">
          {diagnostics.dataFilePath}
        </dd>
      </div>
    </dl>
  )
}
