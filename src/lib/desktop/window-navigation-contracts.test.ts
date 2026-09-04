import { describe, expect, it } from "vitest"

import {
  isOverlayPresentationMode,
  isSurfaceChangedPayload,
  isTasksWindowIntent,
} from "./window-navigation-contracts"

describe("native surface event contract", () => {
  it("accepts every supported surface payload", () => {
    expect(
      isSurfaceChangedPayload({
        surface: "overlay",
        intent: null,
        presentationMode: "expanded",
      }),
    ).toBe(true)
    expect(
      isSurfaceChangedPayload({
        surface: "tasks",
        intent: { kind: "task", taskId: "task-1" },
        presentationMode: null,
      }),
    ).toBe(true)
    expect(
      isSurfaceChangedPayload({
        surface: "settings",
        intent: null,
        presentationMode: null,
      }),
    ).toBe(true)
  })

  it("rejects malformed surfaces, intents, and presentation modes", () => {
    expect(
      isSurfaceChangedPayload({
        surface: "main",
        intent: null,
        presentationMode: null,
      }),
    ).toBe(false)
    expect(
      isSurfaceChangedPayload({
        surface: "tasks",
        intent: { kind: "task", taskId: " " },
        presentationMode: null,
      }),
    ).toBe(false)
    expect(
      isSurfaceChangedPayload({
        surface: "overlay",
        intent: null,
        presentationMode: "maximized",
      }),
    ).toBe(false)
    expect(isSurfaceChangedPayload(null)).toBe(false)
  })

  it("validates the reusable intent and presentation primitives", () => {
    expect(isTasksWindowIntent({ kind: "list" })).toBe(true)
    expect(isTasksWindowIntent({ kind: "add" })).toBe(true)
    expect(isTasksWindowIntent({ kind: "task", taskId: "task-1" })).toBe(true)
    expect(isTasksWindowIntent({ kind: "task", taskId: "" })).toBe(false)
    expect(isOverlayPresentationMode("collapsed")).toBe(true)
    expect(isOverlayPresentationMode("expanded")).toBe(true)
    expect(isOverlayPresentationMode("unknown")).toBe(false)
  })
})
