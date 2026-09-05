import type { TasksTab } from "./tasks-model"

export type TasksViewPreferences = {
  activeTab: TasksTab
  selectedDate: string
}

export type TasksViewPreferencesController = TasksViewPreferences & {
  setActiveTab: (activeTab: TasksTab) => void
  setSelectedDate: (selectedDate: string) => void
}
