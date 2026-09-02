import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_SNAPSHOT_RESYNC_INTERVAL_MS,
  useSnapshotResync,
} from "./use-snapshot-resync"

function ResyncProbe({
  active,
  enabled = true,
  intervalMs,
  refreshSnapshot,
}: {
  active?: boolean
  enabled?: boolean
  intervalMs?: number
  refreshSnapshot: () => Promise<unknown>
}) {
  useSnapshotResync({
    active,
    enabled,
    intervalMs,
    refreshSnapshot,
  })

  return null
}

async function flushPromises() {
  await act(async () => {})
}

describe("useSnapshotResync", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("polls only while focus is active", async () => {
    const refreshSnapshot = vi.fn(async () => undefined)
    const view = render(
      <ResyncProbe refreshSnapshot={refreshSnapshot} />,
    )

    act(() => vi.advanceTimersByTime(DEFAULT_SNAPSHOT_RESYNC_INTERVAL_MS))
    await flushPromises()
    expect(refreshSnapshot).not.toHaveBeenCalled()

    view.rerender(<ResyncProbe active refreshSnapshot={refreshSnapshot} />)
    act(() => vi.advanceTimersByTime(DEFAULT_SNAPSHOT_RESYNC_INTERVAL_MS - 1))
    await flushPromises()
    expect(refreshSnapshot).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    await flushPromises()
    expect(refreshSnapshot).toHaveBeenCalledOnce()
  })

  it("refreshes when the window regains focus or visibility", async () => {
    const refreshSnapshot = vi.fn(async () => undefined)
    render(<ResyncProbe refreshSnapshot={refreshSnapshot} />)

    fireEvent(window, new Event("focus"))
    await flushPromises()
    expect(refreshSnapshot).toHaveBeenCalledOnce()

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    })
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    })
    fireEvent(document, new Event("visibilitychange"))
    await flushPromises()
    expect(refreshSnapshot).toHaveBeenCalledOnce()

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    })
    fireEvent(document, new Event("visibilitychange"))
    await flushPromises()
    expect(refreshSnapshot).toHaveBeenCalledTimes(2)
  })

  it("deduplicates concurrent wake-up requests and retries after failure", async () => {
    let rejectRefresh: ((reason?: unknown) => void) | undefined
    const refreshSnapshot = vi.fn(
      () =>
        new Promise<unknown>((_, reject) => {
          rejectRefresh = reject
        }),
    )
    render(<ResyncProbe refreshSnapshot={refreshSnapshot} />)

    fireEvent(window, new Event("focus"))
    fireEvent(window, new Event("focus"))
    await flushPromises()
    expect(refreshSnapshot).toHaveBeenCalledOnce()

    await act(async () => {
      rejectRefresh?.(new Error("transient"))
    })

    fireEvent(window, new Event("focus"))
    await flushPromises()
    expect(refreshSnapshot).toHaveBeenCalledTimes(2)
  })

  it("cleans timers and listeners when unmounted", async () => {
    const refreshSnapshot = vi.fn(async () => undefined)
    const view = render(
      <ResyncProbe active intervalMs={1_000} refreshSnapshot={refreshSnapshot} />,
    )

    fireEvent(window, new Event("focus"))
    view.unmount()
    await flushPromises()
    act(() => vi.advanceTimersByTime(2_000))
    fireEvent(window, new Event("focus"))
    await flushPromises()

    expect(refreshSnapshot).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("does not listen while disabled", async () => {
    const refreshSnapshot = vi.fn(async () => undefined)
    render(<ResyncProbe enabled={false} refreshSnapshot={refreshSnapshot} />)

    fireEvent(window, new Event("focus"))
    act(() => vi.advanceTimersByTime(DEFAULT_SNAPSHOT_RESYNC_INTERVAL_MS))
    await flushPromises()

    expect(refreshSnapshot).not.toHaveBeenCalled()
  })
})
