import type {
  AppDiagnostics,
  AppSnapshot,
  CreateTaskInput,
  DesktopEventMap,
  FocusSettingsPatch,
  MoveTasksInput,
  StartFocusInput,
  TasksWindowOrigin,
  TasksWindowIntent,
  UpdateTaskInput,
} from "./contracts"

export type DesktopEventName = keyof DesktopEventMap
export type DesktopUnlisten = () => void
export type DesktopEventListener<EventName extends DesktopEventName> = (
  payload: DesktopEventMap[EventName],
) => void

export interface DesktopApi {
  getSnapshot(): Promise<AppSnapshot>
  addTask(input: CreateTaskInput): Promise<AppSnapshot>
  updateTask(input: UpdateTaskInput): Promise<AppSnapshot>
  deleteTask(taskId: string): Promise<AppSnapshot>
  toggleTask(taskId: string): Promise<AppSnapshot>
  moveTasks(input: MoveTasksInput): Promise<AppSnapshot>
  startFocus(input: StartFocusInput): Promise<AppSnapshot>
  /** @deprecated Pass the complete duration payload instead. */
  startFocus(taskId: string | null): Promise<AppSnapshot>
  pauseFocus(): Promise<AppSnapshot>
  resumeFocus(): Promise<AppSnapshot>
  stopFocus(): Promise<AppSnapshot>
  toggleFocus(): Promise<AppSnapshot>
  updateSettings(patch: FocusSettingsPatch): Promise<AppSnapshot>
  getAppDiagnostics(): Promise<AppDiagnostics>
  setAutostart(enabled: boolean): Promise<AppSnapshot>
  openTasksWindow(
    intent?: TasksWindowIntent,
    origin?: TasksWindowOrigin,
  ): Promise<void>
  closeTasksWindow(): Promise<void>
  openSettingsWindow(): Promise<void>
  closeSettingsWindow(): Promise<void>
  returnToTasksWindow(): Promise<void>
  openExternalRelease(url: string): Promise<void>
  subscribe<EventName extends DesktopEventName>(
    eventName: EventName,
    listener: DesktopEventListener<EventName>,
  ): Promise<DesktopUnlisten>
}
