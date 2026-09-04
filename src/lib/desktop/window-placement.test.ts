import { describe, expect, it } from "vitest"

import {
  findWindowMonitor,
  normalizeWindowMonitorSnapshot,
  resolveWindowPlacement,
} from "./window-placement"
import type {
  WindowMonitorSnapshot,
  WindowPlacementSnapshot,
} from "./window-placement-contracts"

function monitor(
  overrides: Partial<WindowMonitorSnapshot> = {},
): WindowMonitorSnapshot {
  return {
    name: "primary",
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1,
    ...overrides,
  }
}

function placement(
  overrides: Partial<WindowPlacementSnapshot> = {},
): WindowPlacementSnapshot {
  return {
    revision: 3,
    windowLabel: "overlay",
    x: 2200,
    y: 100,
    width: 800,
    height: 550,
    scaleFactor: 1,
    monitor: monitor({
      name: "secondary",
      x: 1920,
      width: 1920,
    }),
    ...overrides,
  }
}

describe("window placement resolution", () => {
  it("normalizes the nested monitor shape returned by Tauri", () => {
    expect(
      normalizeWindowMonitorSnapshot({
        name: "secondary",
        position: { x: -1920, y: 0 },
        size: { width: 1920, height: 1080 },
        scaleFactor: 1.25,
      }),
    ).toEqual(
      monitor({
        name: "secondary",
        x: -1920,
        width: 1920,
        height: 1080,
        scaleFactor: 1.25,
      }),
    )
  })

  it("matches a saved monitor by name and preserves relative position and scale", () => {
    const currentSecondary = monitor({
      name: "secondary",
      x: 1920,
      width: 2560,
      height: 1440,
      scaleFactor: 1.5,
    })

    const resolved = resolveWindowPlacement(
      placement(),
      [monitor(), currentSecondary],
      monitor(),
    )

    expect(resolved?.monitor).toEqual(currentSecondary)
    expect(resolved?.size).toEqual({ width: 1200, height: 825 })
    expect(resolved?.position).toEqual({ x: 2293, y: 133 })
  })

  it("falls back to monitor geometry when the saved name changes", () => {
    const savedMonitor = monitor({
      name: "old-name",
      x: -1920,
      width: 1920,
      height: 1080,
    })
    const availableMonitor = monitor({
      name: "new-name",
      x: -1920,
      width: 1920,
      height: 1080,
    })

    expect(findWindowMonitor(savedMonitor, [availableMonitor])).toEqual(
      availableMonitor,
    )
  })

  it("uses the primary monitor when the saved display is disconnected", () => {
    const primary = monitor()
    const resolved = resolveWindowPlacement(
      placement({
        x: 2300,
        y: 500,
      }),
      [primary],
      primary,
    )

    expect(resolved).not.toBeNull()
    if (!resolved) {
      return
    }

    expect(resolved?.monitor).toEqual(primary)
    expect(resolved.position.x).toBeGreaterThanOrEqual(primary.x)
    expect(resolved.position.y).toBeGreaterThanOrEqual(primary.y)
    expect(resolved.position.x + resolved.size.width).toBeLessThanOrEqual(
      primary.x + primary.width,
    )
  })

  it("rejects invalid saved data and restores a bounded fallback size", () => {
    const primary = monitor()
    const resolved = resolveWindowPlacement(
      { windowLabel: "tasks", x: Number.NaN },
      [primary],
      primary,
      { width: 2400, height: 1400 },
    )

    expect(resolved).toEqual({
      monitor: primary,
      size: { width: primary.width, height: primary.height },
      position: { x: primary.x, y: primary.y },
    })
  })

  it("scales the default fallback size when no current window size is available", () => {
    const primary = monitor({ scaleFactor: 1.5 })

    expect(resolveWindowPlacement(null, [primary], primary)?.size).toEqual({
      width: 1200,
      height: 825,
    })
  })

  it("returns no placement when no monitor can be identified", () => {
    expect(resolveWindowPlacement(null, [], null)).toBeNull()
  })
})
