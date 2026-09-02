import type { AppSnapshot } from "./contracts"

export type MockState = {
  snapshot: AppSnapshot
  nextTaskId: number
  nextSessionId: number
  runningSince: number | null
  accumulatedFocusMs: number
}
