import { describe, expect, it } from "vitest"

import {
  clampFocusMinutes,
  DEFAULT_FOCUS_MINUTES,
  getAutostartControlState,
  getStatusLabel,
  getTimelineControlState,
  MAX_FOCUS_MINUTES,
  MIN_FOCUS_MINUTES,
  parseFocusMinutes,
  settingsTogglePatch,
} from "./settings-model"
import { createBrowserDiagnostics, createEmptyAppSnapshot } from "../../lib/desktopApi"

describe("settings model", () => {
  it("keeps the default duration at 25 minutes", () => {
    expect(DEFAULT_FOCUS_MINUTES).toBe(25)
    expect(createEmptyAppSnapshot().settings.focusMinutes).toBe(
      DEFAULT_FOCUS_MINUTES,
    )
  })

  it.each([
    { value: "", expected: null },
    { value: "0", expected: null },
    { value: "181", expected: null },
    { value: "1.5", expected: null },
    { value: "25", expected: 25 },
    { value: " 180 ", expected: 180 },
  ])("parses $value as $expected", ({ value, expected }) => {
    expect(parseFocusMinutes(value)).toBe(expected)
  })

  it.each([
    { value: -10, expected: MIN_FOCUS_MINUTES },
    { value: 1, expected: MIN_FOCUS_MINUTES },
    { value: 25.9, expected: 25 },
    { value: MAX_FOCUS_MINUTES, expected: MAX_FOCUS_MINUTES },
    { value: 200, expected: MAX_FOCUS_MINUTES },
    { value: Number.NaN, expected: DEFAULT_FOCUS_MINUTES },
  ])("clamps $value to $expected", ({ value, expected }) => {
    expect(clampFocusMinutes(value)).toBe(expected)
  })

  it("creates a patch without exposing the saved autostart preference", () => {
    expect(settingsTogglePatch("showTimeline", false)).toEqual({
      showTimeline: false,
    })
    expect(settingsTogglePatch("rainbowTimeline", true)).toEqual({
      rainbowTimeline: true,
    })
  })

  it("gates RGB by the saved timeline preference", () => {
    const settings = createEmptyAppSnapshot().settings
    settings.rainbowTimeline = true

    expect(getTimelineControlState({ ...settings, showTimeline: false })).toEqual({
      showTimeline: false,
      rainbowTimeline: false,
    })
    expect(getTimelineControlState(settings)).toEqual({
      showTimeline: true,
      rainbowTimeline: true,
    })
  })

  it("uses the effective diagnostics state for autostart", () => {
    const diagnostics = createBrowserDiagnostics()
    diagnostics.autostart.enabled = true

    expect(getAutostartControlState(diagnostics)).toMatchObject({
      checked: false,
      disabled: true,
      status: "unavailable",
    })
    expect(getAutostartControlState(null, true).message).toContain("Checking")
    expect(getStatusLabel("registered")).toBe("Available")
    expect(getStatusLabel("error")).toBe("Error")
  })
})
