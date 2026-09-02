import type { FocusSession } from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"
import {
  calculateActivityStreak,
  countSessionsByLocalDate,
  getActivityIntensity,
  getActivitySummary,
} from "./activity-model"

function localDate(
  year: number,
  month: number,
  day: number,
  hour = 12,
) {
  return new Date(year, month - 1, day, hour)
}

function session(
  id: string,
  startedAt: Date,
  completed: boolean,
  focusedSeconds = 0,
): FocusSession {
  return {
    id,
    taskId: null,
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + 60_000).toISOString(),
    focusedSeconds,
    completed,
  }
}

function activityOn(...dates: Date[]) {
  return Object.fromEntries(
    dates.map((date) => [getLocalDateString(date), 1]),
  )
}

describe("countSessionsByLocalDate", () => {
  it("counts completed and aborted sessions exactly once", () => {
    const startedAt = localDate(2026, 8, 15)

    expect(
      countSessionsByLocalDate([
        session("completed", startedAt, true, 0),
        session("aborted", startedAt, false, 3_600),
      ]),
    ).toEqual({
      [getLocalDateString(startedAt)]: 2,
    })
  })

  it("uses the local calendar date around midnight", () => {
    const beforeMidnight = localDate(2026, 8, 31, 23)
    beforeMidnight.setMinutes(59)
    const afterMidnight = localDate(2026, 9, 1, 0)
    afterMidnight.setMinutes(1)

    const countsByDate = countSessionsByLocalDate([
      session("before-midnight", beforeMidnight, true),
      session("after-midnight", afterMidnight, false),
    ])

    expect(countsByDate).toEqual({
      [getLocalDateString(beforeMidnight)]: 1,
      [getLocalDateString(afterMidnight)]: 1,
    })
    expect(getLocalDateString(beforeMidnight)).not.toBe(
      getLocalDateString(afterMidnight),
    )
  })

  it("keeps month and year transitions in separate full-date keys", () => {
    const newYearEve = localDate(2025, 12, 31)
    const newYear = localDate(2026, 1, 1)

    expect(
      countSessionsByLocalDate([
        session("new-year-eve", newYearEve, true),
        session("new-year", newYear, true),
      ]),
    ).toEqual({
      [getLocalDateString(newYearEve)]: 1,
      [getLocalDateString(newYear)]: 1,
    })
  })
})

describe("getActivityIntensity", () => {
  it.each([
    { count: 0, intensity: 0 },
    { count: 1, intensity: 1 },
    { count: 2, intensity: 2 },
    { count: 3, intensity: 3 },
    { count: 4, intensity: 4 },
    { count: 12, intensity: 4 },
  ])("maps $count sessions to intensity $intensity", ({ count, intensity }) => {
    expect(getActivityIntensity(count)).toBe(intensity)
  })
})

describe("calculateActivityStreak", () => {
  const today = localDate(2026, 8, 31)

  it("counts consecutive activity ending today", () => {
    expect(
      calculateActivityStreak(
        activityOn(
          today,
          localDate(2026, 8, 30),
          localDate(2026, 8, 29),
        ),
        today,
      ),
    ).toBe(3)
  })

  it("starts from yesterday when today is empty", () => {
    expect(
      calculateActivityStreak(
        activityOn(localDate(2026, 8, 30), localDate(2026, 8, 29)),
        today,
      ),
    ).toBe(2)
  })

  it("returns zero after two empty days", () => {
    expect(
      calculateActivityStreak(
        activityOn(localDate(2026, 8, 28)),
        today,
      ),
    ).toBe(0)
  })

  it("crosses month and year boundaries", () => {
    const januarySecond = localDate(2026, 1, 2)

    expect(
      calculateActivityStreak(
        activityOn(
          januarySecond,
          localDate(2026, 1, 1),
          localDate(2025, 12, 31),
        ),
        januarySecond,
      ),
    ).toBe(3)
  })
})

describe("getActivitySummary", () => {
  it("combines session counts and streak using the same local clock", () => {
    const today = localDate(2026, 8, 31)
    const sessions = [
      session("today-first", today, true),
      session("today-second", today, false),
      session("yesterday", localDate(2026, 8, 30), true),
    ]

    expect(getActivitySummary(sessions, today)).toEqual({
      countsByDate: {
        [getLocalDateString(today)]: 2,
        [getLocalDateString(localDate(2026, 8, 30))]: 1,
      },
      streak: 2,
    })
  })
})
