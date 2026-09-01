import type { AppSnapshot } from "../lib/desktop/contracts"
import type { DesktopApiError } from "../lib/desktop/errors"

export type SnapshotStoreState =
  | {
      status: "loading"
      revision: number
      snapshot: null
      error: null
    }
  | {
      status: "ready"
      revision: number
      snapshot: AppSnapshot
      error: null
    }
  | {
      status: "error"
      revision: number
      snapshot: null
      error: DesktopApiError
    }

export type SnapshotStoreAction =
  | { type: "reset" }
  | { type: "received"; snapshot: AppSnapshot }
  | { type: "failed"; error: DesktopApiError }

export function createInitialSnapshotStoreState(): SnapshotStoreState {
  return {
    status: "loading",
    revision: -1,
    snapshot: null,
    error: null,
  }
}

export function snapshotStoreReducer(
  state: SnapshotStoreState,
  action: SnapshotStoreAction,
): SnapshotStoreState {
  if (action.type === "reset") {
    return createInitialSnapshotStoreState()
  }

  if (action.type === "failed") {
    return state.status === "ready"
      ? state
      : {
          status: "error",
          revision: state.revision,
          snapshot: null,
          error: action.error,
        }
  }

  if (action.snapshot.revision <= state.revision) {
    return state
  }

  return {
    status: "ready",
    revision: action.snapshot.revision,
    snapshot: action.snapshot,
    error: null,
  }
}
