import type { AppSnapshot, TasksWindowOrigin } from "./contracts"

export type MockState = {
  snapshot: AppSnapshot
  nextTaskId: number
  nextSessionId: number
  runningSince: number | null
  accumulatedFocusMs: number
  tasksWindowOrigin: TasksWindowOrigin | null
}
