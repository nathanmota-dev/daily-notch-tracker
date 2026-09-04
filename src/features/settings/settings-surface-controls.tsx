import { useId } from "react"

import { MinusIcon, PlusIcon } from "../../icons"
import { Panel } from "../../components/panel"
import { Toggle } from "../../components/toggle"
import { Button } from "../../components/ui/button"
import { cn } from "../../lib/utils"
import {
  getStatusLabel,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
  parseFocusMinutes,
} from "./settings-model"
import type {
  SettingsDiagnosticsProps,
  SettingsDurationControlProps,
  SettingsDurationPresetsProps,
  SettingsDurationStepperProps,
  SettingsSectionProps,
  SettingsStatusRowProps,
  SettingsToggleRowProps,
} from "./settings-view-types"

const FOCUS_DURATION_PRESETS = [15, 25, 30, 45, 60] as const

function SettingsDurationPresets({
  currentValue,
  error,
  onChange,
  onCommit,
}: SettingsDurationPresetsProps) {
  return (
    <div
      aria-label="Common focus durations"
      className="grid grid-cols-5 gap-1.5"
      role="group"
    >
      {FOCUS_DURATION_PRESETS.map((preset) => {
        const selected = currentValue === preset && !error

        return (
          <Button
            aria-pressed={selected}
            aria-label={`${preset} minutes`}
            className={cn(
              "h-7 w-full border-white/[0.16] px-1 text-xs text-content hover:border-white/[0.3] hover:bg-white/[0.08]",
              selected &&
                "border-accent bg-accent text-canvas hover:border-accent hover:bg-accent/85",
            )}
            key={preset}
            onClick={() => {
              const nextDraft = String(preset)
              onChange(nextDraft)
              onCommit(nextDraft)
            }}
            size="xs"
            type="button"
            variant={selected ? "default" : "outline"}
          >
            {preset} min
          </Button>
        )
      })}
    </div>
  )
}

export function SettingsSection({
  children,
  description,
  id,
  title,
}: SettingsSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="min-w-0 rounded-card border border-white/[0.12] bg-black p-4 shadow-none"
      data-section={id}
      data-slot="settings-section"
    >
      <h2
        className="m-0 text-base font-semibold tracking-[-0.02em] text-content"
        id={`${id}-heading`}
      >
        {title}
      </h2>
      <p className="mt-1.5 break-words text-caption text-muted">{description}</p>
      <div className="mt-4 min-w-0 divide-y divide-border">{children}</div>
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
      className="flex min-w-0 flex-wrap items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 max-[640px]:flex-col"
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
        className="shrink-0 data-checked:border-content data-checked:bg-content"
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
      className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-border py-3 last:pb-0 max-[640px]:flex-col"
      data-status={status}
      data-slot="settings-status-row"
    >
      <span className="min-w-0 max-w-full text-sm text-muted">{label}</span>
      <span className="min-w-0 max-w-full break-words text-right text-sm text-content max-[640px]:text-left">
        <span className="font-medium">{getStatusLabel(status)}</span>
        {message && (
          <span className="mt-1 block max-w-full break-words text-caption text-muted">
            {message}
          </span>
        )}
      </span>
    </div>
  )
}

function SettingsDurationStepper({
  draft,
  error,
  currentValue,
  errorId,
  onChange,
  onCommit,
}: SettingsDurationStepperProps) {
  function changeBy(direction: -1 | 1) {
    const nextValue = Math.min(
      MAX_FOCUS_MINUTES,
      Math.max(MIN_FOCUS_MINUTES, currentValue + direction),
    )
    const nextDraft = String(nextValue)

    onChange(nextDraft)
    onCommit(nextDraft)
  }

  return (
    <div className="flex w-full max-w-[18rem] shrink-0 flex-col gap-2.5 max-[640px]:max-w-none">
      <div className="flex items-center gap-2">
        <Button
          aria-label="Decrease focus duration"
          className="size-9 border-accent/35 p-0 text-accent hover:border-accent/70 hover:bg-accent/10 hover:text-accent"
          disabled={currentValue <= MIN_FOCUS_MINUTES}
          onClick={() => changeBy(-1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <MinusIcon aria-hidden="true" />
        </Button>
        <div
          className={
            "flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-control border border-accent/35 bg-accent/[0.06] px-2 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 " +
            (error ? "border-danger focus-within:border-danger focus-within:ring-danger/30" : "")
          }
        >
          <input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
            aria-label="Focus duration (minutes)"
            className="h-full w-16 min-w-0 bg-transparent text-center text-lg font-semibold tabular-nums text-content outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            data-slot="settings-focus-minutes"
            id="settings-focus-minutes"
            inputMode="numeric"
            max={MAX_FOCUS_MINUTES}
            min={MIN_FOCUS_MINUTES}
            onBlur={() => onCommit()}
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
          <span className="text-caption font-medium text-muted">min</span>
        </div>
        <Button
          aria-label="Increase focus duration"
          className="size-9 border-accent/35 p-0 text-accent hover:border-accent/70 hover:bg-accent/10 hover:text-accent"
          disabled={currentValue >= MAX_FOCUS_MINUTES}
          onClick={() => changeBy(1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>
      <SettingsDurationPresets
        currentValue={currentValue}
        error={error}
        onChange={onChange}
        onCommit={onCommit}
      />
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
  const currentValue = parseFocusMinutes(draft) ?? MIN_FOCUS_MINUTES

  return (
    <div
      className="flex min-w-0 flex-wrap items-start justify-between gap-5 py-3 first:pt-0 last:pb-0 max-[640px]:flex-col"
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
      <SettingsDurationStepper
        currentValue={currentValue}
        draft={draft}
        error={error}
        errorId={errorId}
        onChange={onChange}
        onCommit={onCommit}
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
        className="min-w-0 gap-3 border border-danger/30 bg-danger/5 p-3"
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
    <dl className="min-w-0 divide-y divide-border" data-slot="settings-diagnostics-details">
      <div className="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
        <dt className="min-w-0 text-sm text-muted">Application version</dt>
        <dd className="m-0 min-w-0 break-words text-sm text-content">
          {diagnostics.appVersion}
        </dd>
      </div>
      <div className="grid min-w-0 gap-1 py-3 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
        <dt className="min-w-0 text-sm text-muted">Data file</dt>
        <dd className="m-0 break-all font-mono text-xs text-content">
          {diagnostics.dataFilePath}
        </dd>
      </div>
      <SettingsStatusRow
        label="System tray"
        message={diagnostics.tray.message}
        status={diagnostics.tray.status}
      />
    </dl>
  )
}
