import { describe, expect, it } from "vitest"

import { createEmptyAppSnapshot, DesktopApiError } from "../lib/desktopApi"
import {
  createInitialSnapshotStoreState,
  snapshotStoreReducer,
} from "./snapshot-store"

function snapshot(revision: number) {
  return { ...createEmptyAppSnapshot(), revision }
}

describe("snapshotStoreReducer", () => {
  it("accepts a snapshot with a newer revision", () => {
    const state = snapshotStoreReducer(createInitialSnapshotStoreState(), {
      type: "received",
      snapshot: snapshot(3),
    })

    expect(state).toMatchObject({ status: "ready", revision: 3 })
  })

  it("ignores duplicate revisions", () => {
    const first = snapshot(3)
    const state = snapshotStoreReducer(
      snapshotStoreReducer(createInitialSnapshotStoreState(), {
        type: "received",
        snapshot: first,
      }),
      { type: "received", snapshot: snapshot(3) },
    )

    expect(state.snapshot).toBe(first)
  })

  it("ignores snapshots that arrive out of order", () => {
    const current = snapshot(5)
    const state = snapshotStoreReducer(
      snapshotStoreReducer(createInitialSnapshotStoreState(), {
        type: "received",
        snapshot: current,
      }),
      { type: "received", snapshot: snapshot(4) },
    )

    expect(state.snapshot).toBe(current)
  })

  it("does not replace a ready snapshot with a later loading error", () => {
    const currentState = snapshotStoreReducer(
      createInitialSnapshotStoreState(),
      { type: "received", snapshot: snapshot(1) },
    )

    const state = snapshotStoreReducer(currentState, {
      type: "failed",
      error: new DesktopApiError({
        operation: "getSnapshot",
        code: "internal",
        message: "The desktop operation could not be completed.",
      }),
    })

    expect(state).toBe(currentState)
  })
})
