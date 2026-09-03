import { describe, expect, it, vi } from "vitest"
import {
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window"

import {
  calculateAnchoredGeometry,
  createOverlayWindowOperationQueue,
  createTauriOverlayWindowAdapter,
  getCollapsedOverlayLogicalSize,
  getExpandedDashboardLogicalSize,
  getOverlayTargetLogicalSize,
  logicalSizeToPhysical,
  type OverlayWindowAdapter,
} from "./overlay-window"

describe("overlay window dimensions", () => {
  it("uses the compact idle notch dimensions regardless of focus settings", () => {
    expect(getCollapsedOverlayLogicalSize({ focusState: "idle" })).toEqual({
      width: 204,
      height: 32,
    })
    expect(
      getOverlayTargetLogicalSize("collapsed", {
        focusState: "idle",
        minimalMode: true,
        showTimeline: false,
      }),
    ).toEqual({ width: 204, height: 32 })
  })

  it("returns the supported collapsed dimensions", () => {
    expect(getCollapsedOverlayLogicalSize()).toEqual({
      width: 360,
      height: 72,
    })
    expect(getCollapsedOverlayLogicalSize({ minimalMode: true })).toEqual({
      width: 104,
      height: 72,
    })
    expect(getCollapsedOverlayLogicalSize({ showTimeline: false })).toEqual({
      width: 360,
      height: 52,
    })
    expect(
      getCollapsedOverlayLogicalSize({ minimalMode: true, showTimeline: false }),
    ).toEqual({ width: 104, height: 52 })
  })

  it("adds the transparent vertical gutter to the measured dashboard", () => {
    expect(getExpandedDashboardLogicalSize(190)).toEqual({
      width: 620,
      height: 206,
    })
    expect(getExpandedDashboardLogicalSize(238, 10)).toEqual({
      width: 620,
      height: 258,
    })
  })

  it("falls back to positive dashboard dimensions for invalid measurements", () => {
    expect(getExpandedDashboardLogicalSize(0)).toEqual({
      width: 620,
      height: 206,
    })
    expect(getExpandedDashboardLogicalSize(Number.NaN)).toEqual({
      width: 620,
      height: 206,
    })
    expect(logicalSizeToPhysical({ width: 0, height: Number.NaN }, 2)).toEqual({
      width: 720,
      height: 144,
    })
  })

  it("selects the dashboard or collapsed target from presentation settings", () => {
    expect(
      getOverlayTargetLogicalSize("expanded", { measuredVisualHeight: 220 }),
    ).toEqual({ width: 620, height: 236 })
    expect(
      getOverlayTargetLogicalSize("collapsed", {
        minimalMode: true,
        showTimeline: false,
      }),
    ).toEqual({ width: 104, height: 52 })
  })
})

describe("calculateAnchoredGeometry", () => {
  it("expands around the current center without moving the top", () => {
    const geometry = calculateAnchoredGeometry(
      {
        size: { width: 360, height: 72 },
        position: { x: 100, y: 48 },
      },
      { width: 620, height: 206 },
      1,
    )

    expect(geometry.size).toEqual({ width: 620, height: 206 })
    expect(geometry.position).toEqual({ x: -30, y: 48 })
    expect(geometry.centerX).toBe(280)
  })

  it("re-collapses around the same center", () => {
    const geometry = calculateAnchoredGeometry(
      {
        size: { width: 620, height: 206 },
        position: { x: -2010, y: 72 },
      },
      { width: 360, height: 72 },
      1,
    )

    expect(geometry.position).toEqual({ x: -1880, y: 72 })
    expect(geometry.centerX).toBe(-1700)
  })

  it("keeps negative monitor origins and converts logical pixels", () => {
    const geometry = calculateAnchoredGeometry(
      {
        size: { width: 450, height: 90 },
        position: { x: -1880, y: -40 },
      },
      { width: 620, height: 206 },
      1.25,
    )

    expect(geometry.size).toEqual({ width: 775, height: 257.5 })
    expect(geometry.position.x).toBeCloseTo(-2042.5)
    expect(geometry.position.y).toBe(-40)
    expect(geometry.position.x + geometry.size.width / 2).toBeCloseTo(
      geometry.centerX,
    )
  })
})

describe("Tauri overlay window adapter", () => {
  it("uses physical DPI-aware values with the official window API", async () => {
    const appWindow = {
      innerSize: vi.fn(async () => new PhysicalSize(360, 72)),
      innerPosition: vi.fn(async () => new PhysicalPosition(-10, 24)),
      scaleFactor: vi.fn(async () => 1.5),
      setSize: vi.fn(async () => undefined),
      setPosition: vi.fn(async () => undefined),
      show: vi.fn(async () => undefined),
      hide: vi.fn(async () => undefined),
    }
    const adapter = createTauriOverlayWindowAdapter(appWindow)

    await expect(adapter.innerSize()).resolves.toEqual({ width: 360, height: 72 })
    await expect(adapter.innerPosition()).resolves.toEqual({ x: -10, y: 24 })
    await expect(adapter.scaleFactor()).resolves.toBe(1.5)

    await adapter.setSize({ width: 620, height: 206 })
    await adapter.setPosition({ x: -140, y: 24 })
    await adapter.show()
    await adapter.hide()

    expect(appWindow.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Physical", width: 620, height: 206 }),
    )
    expect(appWindow.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({ type: "Physical", x: -140, y: 24 }),
    )
    expect(appWindow.show).toHaveBeenCalledOnce()
    expect(appWindow.hide).toHaveBeenCalledOnce()
  })

  it("reads and normalizes the primary monitor", async () => {
    const appWindow = {
      innerSize: vi.fn(async () => new PhysicalSize(360, 72)),
      innerPosition: vi.fn(async () => new PhysicalPosition(0, 0)),
      scaleFactor: vi.fn(async () => 1),
      setSize: vi.fn(async () => undefined),
      setPosition: vi.fn(async () => undefined),
      show: vi.fn(async () => undefined),
      hide: vi.fn(async () => undefined),
    }
    const adapter = createTauriOverlayWindowAdapter(appWindow, {
      monitorReader: async () => ({
        position: { x: -1920, y: 0 },
        size: { width: 1920, height: 1080 },
        scaleFactor: 1.5,
        workArea: undefined,
      }),
    })

    await expect(adapter.primaryMonitor()).resolves.toEqual({
      position: { x: -1920, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1.5,
    })
  })

  it("notifies scale changes immediately and polls changed metrics until cleanup", async () => {
    vi.useFakeTimers()
    let currentMonitor = {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
    }
    let emitScaleChange: (() => void) | undefined
    const unlisten = vi.fn()
    const appWindow = {
      innerSize: vi.fn(async () => new PhysicalSize(360, 72)),
      innerPosition: vi.fn(async () => new PhysicalPosition(0, 0)),
      scaleFactor: vi.fn(async () => 1),
      setSize: vi.fn(async () => undefined),
      setPosition: vi.fn(async () => undefined),
      show: vi.fn(async () => undefined),
      hide: vi.fn(async () => undefined),
      onScaleChanged: vi.fn(async (handler: () => void) => {
        emitScaleChange = handler
        return unlisten
      }),
    }
    const adapter = createTauriOverlayWindowAdapter(appWindow, {
      monitorReader: async () => currentMonitor,
      displayPollIntervalMs: 20,
    })
    const listener = vi.fn()
    const cleanup = await adapter.subscribeToDisplayChanges(listener)

    expect(listener).not.toHaveBeenCalled()
    emitScaleChange?.()
    expect(listener).toHaveBeenCalledOnce()

    currentMonitor = {
      ...currentMonitor,
      position: { x: -1920, y: 0 },
      scaleFactor: 1.25,
    }
    await vi.advanceTimersByTimeAsync(20)
    expect(listener).toHaveBeenCalledTimes(2)

    cleanup()
    cleanup()
    await Promise.resolve()
    expect(unlisten).toHaveBeenCalledOnce()

    currentMonitor = {
      ...currentMonitor,
      position: { x: 0, y: 0 },
    }
    await vi.advanceTimersByTimeAsync(40)
    expect(listener).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe("overlay window operation queue", () => {
  it("serializes operations and keeps only the newest pending geometry", async () => {
    let releaseFirstSize: (() => void) | undefined
    const firstSize = new Promise<void>((resolve) => {
      releaseFirstSize = resolve
    })
    const adapter: OverlayWindowAdapter = {
      innerSize: vi.fn(async () => ({ width: 360, height: 72 })),
      innerPosition: vi.fn(async () => ({ x: 0, y: 0 })),
      scaleFactor: vi.fn(async () => 1),
      primaryMonitor: vi.fn(async () => null),
      setSize: vi
        .fn()
        .mockImplementationOnce(() => firstSize)
        .mockResolvedValue(undefined),
      setPosition: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
      hide: vi.fn().mockResolvedValue(undefined),
      subscribeToDisplayChanges: vi.fn(async () => vi.fn()),
    }
    const queue = createOverlayWindowOperationQueue(adapter)
    const first = {
      size: { width: 360, height: 72 },
      position: { x: 0, y: 0 },
    }
    const last = {
      size: { width: 620, height: 206 },
      position: { x: -130, y: 0 },
    }

    queue.enqueue(first)
    queue.enqueue({
      size: { width: 500, height: 100 },
      position: { x: -70, y: 0 },
    })
    queue.enqueue(last)

    expect(adapter.setSize).toHaveBeenCalledTimes(1)

    const idle = queue.whenIdle()
    releaseFirstSize?.()
    await idle

    expect(adapter.setSize).toHaveBeenNthCalledWith(1, first.size)
    expect(adapter.setSize).toHaveBeenNthCalledWith(2, last.size)
    expect(adapter.setPosition).toHaveBeenNthCalledWith(1, first.position)
    expect(adapter.setPosition).toHaveBeenNthCalledWith(2, last.position)
  })
})
