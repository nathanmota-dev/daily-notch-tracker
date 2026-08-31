export type IsoDateString = string
export type IsoDateTimeString = string

export type FocusState = "idle" | "running" | "paused"
export type ShortcutStatus = "registered" | "unavailable" | "error"
export type IntegrationStatus = "available" | "unavailable" | "error"
export type SurfaceLabel = "overlay" | "tasks" | "settings"

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
  playSound: boolean
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

export type AppDiagnostics = {
  appVersion: string
  dataFilePath: string
  shortcut: ShortcutDiagnostic
  autostart: AutostartDiagnostic
}

export type WindowPlacementSnapshot = {
  revision: number
  windowLabel: SurfaceLabel
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}

export type DesktopCommandMap = {
  get_snapshot: {
    args: undefined
    result: AppSnapshot
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
    args: { taskId: string | null }
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
    args: { intent: TasksWindowIntent | null }
    result: void
  }
  open_settings_window: {
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
  "window-placement-changed": WindowPlacementSnapshot
}
