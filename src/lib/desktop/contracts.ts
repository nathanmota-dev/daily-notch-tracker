import type { StartFocusInput } from "./focus-contracts"
import type { SurfaceChangedPayload, TasksWindowOrigin } from "./window-navigation-contracts"
import type { WindowPlacementSnapshot } from "./window-placement-contracts"

export type { StartFocusInput } from "./focus-contracts"
export type {
  OverlayPresentationMode,
  SurfaceChangedEvent,
  SurfaceChangedPayload,
  TasksWindowOrigin,
} from "./window-navigation-contracts"
export type {
  WindowMonitorSnapshot,
  WindowPlacementSnapshot,
} from "./window-placement-contracts"

export type IsoDateString = string
export type IsoDateTimeString = string

export type FocusState = "idle" | "running" | "paused"
export type ShortcutStatus = "registered" | "unavailable" | "error"
export type IntegrationStatus = "available" | "unavailable" | "error"

export const SURFACE_LABELS = ["overlay", "tasks", "settings"] as const
export type SurfaceLabel = (typeof SURFACE_LABELS)[number]

export function isSurfaceLabel(value: unknown): value is SurfaceLabel {
  return (
    typeof value === "string" &&
    (SURFACE_LABELS as readonly string[]).includes(value)
  )
}

export type Task = {
  id: string
  title: string
  notes: string
  scheduledDate: IsoDateString | null
  estimateMinutes: number
  isDone: boolean
  createdAt: IsoDateTimeString
  focusedSeconds: number
  sortOrder: number
}

export type FocusSession = {
  id: string
  taskId: string | null
  startedAt: IsoDateTimeString
  endedAt: IsoDateTimeString
  focusedSeconds: number
  completed: boolean
}

export type FocusSettings = {
  focusMinutes: number
  notificationsEnabled: boolean
  showTimeline: boolean
  rainbowTimeline: boolean
  minimalMode: boolean
  launchAtLogin: boolean
}

export type FocusSnapshot = {
  state: FocusState
  activeTaskId: string | null
  activeTaskTitle: string | null
  startedAt: IsoDateTimeString | null
  endAt: IsoDateTimeString | null
  pausedRemainingMs: number | null
  totalMs: number
}

export type AppSnapshot = {
  /** Monotonic runtime revision used to reject stale cross-window updates. */
  revision: number
  tasks: Task[]
  sessions: FocusSession[]
  settings: FocusSettings
  focus: FocusSnapshot
  shortcutStatus: ShortcutStatus
}

export type CreateTaskInput = Pick<
  Task,
  "title" | "notes" | "scheduledDate" | "estimateMinutes"
>

export type UpdateTaskInput = Pick<
  Task,
  "id" | "title" | "notes" | "scheduledDate" | "estimateMinutes" | "isDone"
>

export type TaskBucket = {
  scheduledDate: IsoDateString | null
}

export type MoveTasksInput = {
  taskIds: string[]
  source: TaskBucket
  destination: TaskBucket
}

export type FocusSettingsPatch = Partial<
  Omit<FocusSettings, "launchAtLogin">
>

export type TasksWindowIntent =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "task"; taskId: string }

export type ShortcutDiagnostic = {
  status: ShortcutStatus
  message: string | null
}

export type AutostartDiagnostic = {
  enabled: boolean
  status: IntegrationStatus
  message: string | null
}

export type TrayDiagnostic = {
  status: IntegrationStatus
  message: string | null
}

export type AppDiagnostics = {
  appVersion: string
  dataFilePath: string
  shortcut: ShortcutDiagnostic
  autostart: AutostartDiagnostic
  tray: TrayDiagnostic
}

export type DesktopCommandMap = {
  get_snapshot: {
    args: undefined
    result: AppSnapshot
  }
  get_window_placement: {
    args: undefined
    result: WindowPlacementSnapshot | null
  }
  save_window_placement: {
    args: undefined
    result: WindowPlacementSnapshot
  }
  add_task: {
    args: { input: CreateTaskInput }
    result: AppSnapshot
  }
  update_task: {
    args: { input: UpdateTaskInput }
    result: AppSnapshot
  }
  delete_task: {
    args: { taskId: string }
    result: AppSnapshot
  }
  toggle_task: {
    args: { taskId: string }
    result: AppSnapshot
  }
  move_tasks: {
    args: { input: MoveTasksInput }
    result: AppSnapshot
  }
  start_focus: {
    args: StartFocusInput
    result: AppSnapshot
  }
  pause_focus: {
    args: undefined
    result: AppSnapshot
  }
  resume_focus: {
    args: undefined
    result: AppSnapshot
  }
  stop_focus: {
    args: undefined
    result: AppSnapshot
  }
  toggle_focus: {
    args: undefined
    result: AppSnapshot
  }
  update_settings: {
    args: { patch: FocusSettingsPatch }
    result: AppSnapshot
  }
  get_app_diagnostics: {
    args: undefined
    result: AppDiagnostics
  }
  set_autostart: {
    args: { enabled: boolean }
    result: AppSnapshot
  }
  open_tasks_window: {
    args: {
      intent: TasksWindowIntent | null
      origin: TasksWindowOrigin | null
    }
    result: void
  }
  close_tasks_window: {
    args: undefined
    result: void
  }
  open_settings_window: {
    args: undefined
    result: void
  }
  close_settings_window: {
    args: undefined
    result: void
  }
  return_to_tasks_window: {
    args: undefined
    result: void
  }
  open_external_release: {
    args: { url: string }
    result: void
  }
}

export type DesktopEventMap = {
  "store-changed": AppSnapshot
  "focus-changed": AppSnapshot
  "settings-changed": AppSnapshot
  "shortcut-changed": AppSnapshot
  "surface-changed": SurfaceChangedPayload
  "window-placement-changed": WindowPlacementSnapshot
}
