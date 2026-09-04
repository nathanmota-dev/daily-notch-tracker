import { describe, expect, it } from "vitest"

import {
  OVERLAY_VERTICAL_GUTTER,
  SETTINGS_WINDOW_DIMENSIONS,
  TASKS_WINDOW_DIMENSIONS,
  WINDOW_DIMENSIONS,
} from "./window-dimensions"

describe("desktop window dimension contracts", () => {
  it.each([
    ["tasks", TASKS_WINDOW_DIMENSIONS],
    ["settings", SETTINGS_WINDOW_DIMENSIONS],
  ] as const)("keeps the %s preferred size inside its limits", (_label, dimensions) => {
    expect(dimensions.minimum.width).toBeLessThanOrEqual(dimensions.preferred.width)
    expect(dimensions.minimum.height).toBeLessThanOrEqual(dimensions.preferred.height)
    expect(dimensions.preferred.width).toBeLessThanOrEqual(dimensions.maximum.width)
    expect(dimensions.preferred.height).toBeLessThanOrEqual(dimensions.maximum.height)
  })

  it("keeps Tasks within the agreed desktop range", () => {
    expect(TASKS_WINDOW_DIMENSIONS).toEqual({
      preferred: { width: 800, height: 550 },
      minimum: { width: 760, height: 480 },
      maximum: { width: 800, height: 550 },
    })
  })

  it("keeps Settings aligned with the Tasks window", () => {
    expect(SETTINGS_WINDOW_DIMENSIONS).toEqual({
      preferred: { width: 800, height: 550 },
      minimum: { width: 760, height: 480 },
      maximum: { width: 800, height: 550 },
    })
    expect(SETTINGS_WINDOW_DIMENSIONS).toEqual(TASKS_WINDOW_DIMENSIONS)
  })

  it("keeps the expanded overlay minimum inclusive of its transparent gutter", () => {
    expect(WINDOW_DIMENSIONS.overlay.expanded).toEqual({
      width: 620,
      minHeight: 190 + OVERLAY_VERTICAL_GUTTER * 2,
    })
  })

  it("keeps the overlay idle size separate from content windows", () => {
    expect(WINDOW_DIMENSIONS.overlay.idle).toEqual({ width: 204, height: 32 })
    expect(WINDOW_DIMENSIONS.overlay.idle).not.toEqual(
      TASKS_WINDOW_DIMENSIONS.preferred,
    )
    expect(WINDOW_DIMENSIONS.overlay.idle).not.toEqual(
      SETTINGS_WINDOW_DIMENSIONS.preferred,
    )
  })
})
