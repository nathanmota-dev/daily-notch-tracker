import type {
  AppDiagnostics,
  AppSnapshot,
  DesktopApi,
  DesktopApiError,
  FocusSettings,
  IntegrationStatus,
  ShortcutStatus,
} from "../../lib/desktopApi"
import type { SnapshotMutation } from "../../app/use-desktop-mutations"
import type {
  AutostartControlState,
  SettingsToggleKey,
} from "./settings-model"

export type SettingsSurfaceProps = {
  api: DesktopApi
  applySnapshot: (snapshot: AppSnapshot) => void
  refreshSnapshot: () => Promise<AppSnapshot>
  snapshot: AppSnapshot
}

export type SettingsMutationRunner = (
  operation: string,
  mutation: SnapshotMutation,
  onError?: (error: DesktopApiError) => void,
) => void

export type SettingsSectionProps = {
  children: React.ReactNode
  description: string
  id: string
  title: string
}

export type SettingsToggleRowProps = {
  checked: boolean
  description: string
  disabled?: boolean
  label: string
  setting?: SettingsToggleKey
  onCheckedChange: (checked: boolean) => void
}

export type SettingsStatusRowProps = {
  message: string | null
  label: string
  status: IntegrationStatus | ShortcutStatus
}

export type SettingsSurfaceContentProps = {
  autostart: AutostartControlState
  diagnostics: AppDiagnostics | null
  diagnosticsError: DesktopApiError | null
  diagnosticsLoading: boolean
  durationError: string | null
  focusMinutesDraft: string
  mutationError: DesktopApiError | null
  mutationBusy: boolean
  onAutostartChange: (enabled: boolean) => void
  onBack: () => void
  onClose: () => void
  onCommitFocusMinutes: (value?: string) => void
  onFocusMinutesChange: (value: string) => void
  onRetryDiagnostics: () => void
  onRetryMutation: (() => void) | null
  onToggle: (key: SettingsToggleKey, checked: boolean) => void
  settings: FocusSettings
  shortcutMessage: string | null
  shortcutStatus: ShortcutStatus
}

export type SettingsDurationControlProps = {
  draft: string
  error: string | null
  onChange: (value: string) => void
  onCommit: (value?: string) => void
}

export type SettingsDurationStepperProps = Pick<
  SettingsDurationControlProps,
  "draft" | "error" | "onChange" | "onCommit"
> & {
  currentValue: number
  errorId: string
}

export type SettingsDurationPresetsProps = Pick<
  SettingsDurationControlProps,
  "onChange" | "onCommit"
> &
  Pick<SettingsDurationStepperProps, "currentValue" | "error">

export type SettingsDiagnosticsProps = Pick<
  SettingsSurfaceContentProps,
  "diagnostics" | "diagnosticsError" | "diagnosticsLoading" | "onRetryDiagnostics"
>

export type SettingsMutationErrorProps = Pick<
  SettingsSurfaceContentProps,
  "mutationBusy" | "mutationError" | "onRetryMutation"
>

export type SettingsHeaderProps = Pick<
  SettingsSurfaceContentProps,
  "mutationBusy" | "onBack" | "onClose"
>
