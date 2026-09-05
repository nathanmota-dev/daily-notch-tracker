import { act, renderHook } from "@testing-library/react"
import { vi } from "vitest"

import { createEmptyAppSnapshot } from "../lib/desktopApi"
import { useDesktopMutations } from "./use-desktop-mutations"

describe("useDesktopMutations", () => {
  it("ignores null returned by void Tauri commands", async () => {
    const applySnapshot = vi.fn()
    const refreshSnapshot = vi.fn(async () => createEmptyAppSnapshot())
    const { result } = renderHook(() =>
      useDesktopMutations({ applySnapshot, refreshSnapshot }),
    )

    await act(async () => {
      expect(
        await result.current.runMutation("openSettingsWindow", async () => null),
      ).toBeNull()
    })

    expect(applySnapshot).not.toHaveBeenCalled()
    expect(refreshSnapshot).not.toHaveBeenCalled()
  })

  it("applies snapshots returned by state-changing commands", async () => {
    const applySnapshot = vi.fn()
    const refreshSnapshot = vi.fn(async () => createEmptyAppSnapshot())
    const snapshot = createEmptyAppSnapshot()
    snapshot.revision = 1
    const { result } = renderHook(() =>
      useDesktopMutations({ applySnapshot, refreshSnapshot }),
    )

    await act(async () => {
      expect(
        await result.current.runMutation("toggleFocus", async () => snapshot),
      ).toBe(snapshot)
    })

    expect(applySnapshot).toHaveBeenCalledWith(snapshot)
    expect(refreshSnapshot).not.toHaveBeenCalled()
  })
})
