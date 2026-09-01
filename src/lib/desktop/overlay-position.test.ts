import { describe, expect, it } from "vitest"

import {
  calculateOverlayPosition,
  normalizeOverlayDisplayMetrics,
  OVERLAY_PANEL_HEIGHT,
  OVERLAY_PANEL_MARGIN,
  type OverlayDisplayMetrics,
} from "./overlay-position"

const monitor: OverlayDisplayMetrics = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  scaleFactor: 1,
  workArea: {
    position: { x: 0, y: 32 },
    size: { width: 1920, height: 1048 },
  },
}

describe("normalizeOverlayDisplayMetrics", () => {
  it("normalizes finite monitor values and keeps the work area", () => {
    expect(
      normalizeOverlayDisplayMetrics({
        name: "DP-1",
        position: { x: -1920, y: -40 },
        size: { width: 2560, height: 1440 },
        scaleFactor: 1.25,
        workArea: {
          position: { x: -1920, y: 0 },
          size: { width: 2560, height: 1400 },
        },
      }),
    ).toEqual({
      name: "DP-1",
      position: { x: -1920, y: -40 },
      size: { width: 2560, height: 1440 },
      scaleFactor: 1.25,
      workArea: {
        position: { x: -1920, y: 0 },
        size: { width: 2560, height: 1400 },
      },
    })
  })

  it("falls back to scale one and accepts an absent work area", () => {
    expect(
      normalizeOverlayDisplayMetrics({
        position: { x: 0, y: 0 },
        size: { width: 1280, height: 720 },
        scaleFactor: Number.NaN,
      }),
    ).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
      scaleFactor: 1,
    })
  })

  it("ignores an incomplete work area and rejects invalid monitor metrics", () => {
    expect(
      normalizeOverlayDisplayMetrics({
        position: { x: 0, y: 0 },
        size: { width: 1280, height: 720 },
        scaleFactor: 2,
        workArea: { position: { x: 0, y: 32 } },
      }),
    ).toEqual({
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
      scaleFactor: 2,
    })

    expect(
      normalizeOverlayDisplayMetrics({
        position: { x: 0, y: 0 },
        size: { width: 0, height: 720 },
        scaleFactor: 1,
      }),
    ).toBeNull()
  })
})

describe("calculateOverlayPosition", () => {
  it("centers the overlay below the work area top", () => {
    expect(
      calculateOverlayPosition(monitor, { width: 360, height: 72 }),
    ).toEqual({ x: 780, y: 38 })
  })

  it("can convert a logical overlay size using a fractional display scale", () => {
    expect(
      calculateOverlayPosition(monitor, { width: 360, height: 72 }, 1.25),
    ).toEqual({ x: 735, y: 38 })
  })

  it("uses the configurable panel fallback without a work area", () => {
    expect(
      calculateOverlayPosition(
        { ...monitor, workArea: undefined },
        { width: 360, height: 72 },
      ),
    ).toEqual({
      x: 780,
      y: OVERLAY_PANEL_HEIGHT + OVERLAY_PANEL_MARGIN,
    })
  })

  it("keeps negative monitor origins and rounds fractional physical pixels", () => {
    expect(
      calculateOverlayPosition(
        {
          position: { x: -1920, y: -80 },
          size: { width: 2560, height: 1440 },
          scaleFactor: 1.25,
        },
        { width: 775, height: 257.5 },
      ),
    ).toEqual({ x: -1027, y: -42 })
  })

  it("clamps an overlay that is larger than the available screen", () => {
    expect(
      calculateOverlayPosition(
        {
          ...monitor,
          workArea: {
            position: { x: 0, y: 32 },
            size: { width: 1920, height: 1048 },
          },
        },
        { width: 2400, height: 1400 },
      ),
    ).toEqual({ x: 0, y: 32 })

    expect(
      calculateOverlayPosition(
        { ...monitor, workArea: undefined },
        { width: 2400, height: 1400 },
      ),
    ).toEqual({ x: 0, y: 0 })
  })

  it("does not emit non-finite coordinates for invalid overlay dimensions", () => {
    const position = calculateOverlayPosition(monitor, {
      width: Number.NaN,
      height: Number.POSITIVE_INFINITY,
    })

    expect(position).toEqual({ x: 960, y: 38 })
    expect(Number.isFinite(position.x)).toBe(true)
    expect(Number.isFinite(position.y)).toBe(true)
  })

  it("returns a safe origin for invalid monitor dimensions", () => {
    expect(
      calculateOverlayPosition(
        {
          position: { x: Number.NaN, y: 0 },
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
        { width: 360, height: 72 },
      ),
    ).toEqual({ x: 0, y: 0 })
  })
})
