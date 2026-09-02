import { describe, expect, it } from "vitest"

import {
  durationPartsToSeconds,
  durationSecondsToParts,
  focusSessionDraftFromSeconds,
  formatFocusSessionDuration,
  getFocusSessionDurationError,
  normalizeFocusDurationParts,
  stepFocusDuration,
} from "./focus-session-model"

describe("focus session model", () => {
  it("converts seconds to the minutes and seconds shown by the picker", () => {
    expect(durationSecondsToParts(1_530)).toEqual({ minutes: 25, seconds: 30 })
    expect(focusSessionDraftFromSeconds(1_500)).toEqual({
      minutes: "25",
      seconds: "00",
    })
    expect(formatFocusSessionDuration(10_800)).toBe("180:00")
  })

  it("normalizes carry and borrow between the two fields", () => {
    expect(normalizeFocusDurationParts({ minutes: 1, seconds: 75 })).toEqual({
      minutes: 2,
      seconds: 15,
    })
    expect(stepFocusDuration({ minutes: 1, seconds: 59 }, "seconds", 1)).toEqual({
      minutes: 2,
      seconds: 0,
    })
    expect(stepFocusDuration({ minutes: 2, seconds: 0 }, "seconds", -1)).toEqual({
      minutes: 1,
      seconds: 59,
    })
    expect(durationPartsToSeconds({ minutes: 2, seconds: 15 })).toBe(135)
  })

  it("keeps the picker duration inside the inclusive runtime limits", () => {
    expect(getFocusSessionDurationError({ minutes: "0", seconds: "00" })).toMatch(
      /between 00:01 and 180:00/,
    )
    expect(getFocusSessionDurationError({ minutes: "180", seconds: "01" })).toMatch(
      /between 00:01 and 180:00/,
    )
    expect(getFocusSessionDurationError({ minutes: "25", seconds: "30" })).toBeUndefined()
    expect(getFocusSessionDurationError({ minutes: "25", seconds: "60" })).toMatch(
      /whole minutes and seconds/,
    )
  })
})
