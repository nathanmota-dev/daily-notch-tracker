import { useCallback, useEffect, useState } from "react"

import { isValidTaskDate, type TasksTab } from "./tasks-model"
import type {
  TasksViewPreferences,
  TasksViewPreferencesController,
} from "./tasks-view-preferences-types"

export const TASKS_VIEW_PREFERENCES_STORAGE_KEY =
  "dailynotch.tasks-view-preferences"

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function readTasksViewPreferences(
  defaultDate: string,
  storage = getSessionStorage(),
): TasksViewPreferences {
  if (!storage) {
    return { activeTab: "day", selectedDate: defaultDate }
  }

  try {
    const value = JSON.parse(storage.getItem(TASKS_VIEW_PREFERENCES_STORAGE_KEY) ?? "null")
    const activeTab: TasksTab = value?.activeTab === "unscheduled" ? "unscheduled" : "day"
    const selectedDate =
      typeof value?.selectedDate === "string" &&
      isValidTaskDate(value.selectedDate)
        ? value.selectedDate
        : defaultDate

    return { activeTab, selectedDate }
  } catch {
    return { activeTab: "day", selectedDate: defaultDate }
  }
}

function writeTasksViewPreferences(preferences: TasksViewPreferences) {
  try {
    getSessionStorage()?.setItem(
      TASKS_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
  } catch {
    return
  }
}

export function useTasksViewPreferences(
  defaultDate: string,
): TasksViewPreferencesController {
  const [preferences, setPreferences] = useState(() =>
    readTasksViewPreferences(defaultDate),
  )

  useEffect(() => {
    writeTasksViewPreferences(preferences)
  }, [preferences])

  const setActiveTab = useCallback((activeTab: TasksTab) => {
    setPreferences((current) => ({ ...current, activeTab }))
  }, [])
  const setSelectedDate = useCallback((selectedDate: string) => {
    setPreferences((current) => ({ ...current, selectedDate }))
  }, [])

  return { ...preferences, setActiveTab, setSelectedDate }
}
