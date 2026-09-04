import type {
  AppSnapshot,
  TasksWindowOrigin,
  WindowPlacementSnapshot,
} from "./contracts"

export type MockState = {
  snapshot: AppSnapshot
  nextTaskId: number
  nextSessionId: number
  runningSince: number | null
  accumulatedFocusMs: number
  tasksWindowOrigin: TasksWindowOrigin | null
  windowPlacement: WindowPlacementSnapshot | null
}
