import { useCallback } from "react"

import {
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type TasksWindowOrigin,
  type TasksWindowIntent,
} from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"
import { useFocusSessionFlow } from "../components/use-focus-session-flow"
import type { FocusSessionPickerProps } from "../components/focus-session-picker"
import { useDesktopMutations } from "./use-desktop-mutations"

type DashboardActionCallbacks = {
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: (origin?: TasksWindowOrigin) => void
  onOpenTasks: (origin?: TasksWindowOrigin) => void
  onOpenTask: (taskId: string, origin?: TasksWindowOrigin) => void
  onReorder: (taskIds: string[]) => void
  focusSessionPicker: FocusSessionPickerProps
}

type UseDashboardActionsOptions = {
  api: DesktopApi
  snapshot: AppSnapshot | null
  applySnapshot: (snapshot: AppSnapshot) => void
  refreshSnapshot: () => Promise<AppSnapshot>
  now?: Date | number
}

type UseDashboardActionsResult = {
  callbacks: DashboardActionCallbacks
  busy: boolean
  error: DesktopApiError | null
}

export function useDashboardActions({
  api,
  applySnapshot,
  now,
  refreshSnapshot,
  snapshot,
}: UseDashboardActionsOptions): UseDashboardActionsResult {
  const { busy, error, runMutation } = useDesktopMutations({
    applySnapshot,
    refreshSnapshot,
  })
  const focusSession = useFocusSessionFlow({
    api,
    mutationBusy: busy,
    mutationError: error,
    runMutation,
    snapshot,
  })

  const onToggleTask = useCallback(
    (taskId: string) => {
      void runMutation("toggleTask", () => api.toggleTask(taskId))
    },
    [api, runMutation],
  )

  const onToggleFocus = useCallback(
    (taskId: string) => {
      focusSession.requestFocus(taskId)
    },
    [focusSession],
  )

  const openTasksWindow = useCallback(
    (intent: TasksWindowIntent, origin?: TasksWindowOrigin) => {
      void runMutation("openTasksWindow", () =>
        api.openTasksWindow(intent, origin),
      )
    },
    [api, runMutation],
  )

  const onAddTask = useCallback((origin?: TasksWindowOrigin) => {
    openTasksWindow({ kind: "add" }, origin)
  }, [openTasksWindow])

  const onOpenTasks = useCallback((origin?: TasksWindowOrigin) => {
    openTasksWindow({ kind: "list" }, origin)
  }, [openTasksWindow])

  const onOpenTask = useCallback(
    (taskId: string, origin?: TasksWindowOrigin) => {
      openTasksWindow({ kind: "task", taskId }, origin)
    },
    [openTasksWindow],
  )

  const onReorder = useCallback(
    (taskIds: string[]) => {
      const scheduledDate = getLocalDateString(now)
      const bucket = { scheduledDate }

      void runMutation("moveTasks", () =>
        api.moveTasks({
          taskIds,
          source: bucket,
          destination: bucket,
        }),
      )
    },
    [api, now, runMutation],
  )

  return {
    busy,
    callbacks: {
      onAddTask,
      onOpenTask,
      onOpenTasks,
      onReorder,
      onToggleFocus,
      onToggleTask,
      focusSessionPicker: focusSession.picker,
    },
    error,
  }
}
