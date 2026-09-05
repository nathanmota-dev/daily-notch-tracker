import { act, renderHook } from "@testing-library/react"

import {
  readTasksViewPreferences,
  TASKS_VIEW_PREFERENCES_STORAGE_KEY,
  useTasksViewPreferences,
} from "./tasks-view-preferences"

describe("tasks view preferences", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("falls back safely when the session value is invalid", () => {
    window.sessionStorage.setItem(TASKS_VIEW_PREFERENCES_STORAGE_KEY, "not-json")

    expect(readTasksViewPreferences("2026-09-05")).toEqual({
      activeTab: "day",
      selectedDate: "2026-09-05",
    })
  })

  it("restores the selected list and date after the surface reloads", () => {
    const firstRender = renderHook(() => useTasksViewPreferences("2026-09-05"))

    act(() => {
      firstRender.result.current.setActiveTab("unscheduled")
      firstRender.result.current.setSelectedDate("2026-09-04")
    })
    firstRender.unmount()

    const restoredRender = renderHook(() =>
      useTasksViewPreferences("2026-09-05"),
    )

    expect(restoredRender.result.current.activeTab).toBe("unscheduled")
    expect(restoredRender.result.current.selectedDate).toBe("2026-09-04")
  })
})
