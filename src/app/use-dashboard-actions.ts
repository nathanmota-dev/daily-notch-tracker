import { useCallback } from "react"

import {
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type TasksWindowIntent,
} from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"
import { useDesktopMutations } from "./use-desktop-mutations"

type DashboardActionCallbacks = {
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: () => void
  onOpenTasks: () => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
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
  error: DesktopApiError | null
}

export function useDashboardActions({
  api,
  applySnapshot,
  now,
  refreshSnapshot,
  snapshot,
}: UseDashboardActionsOptions): UseDashboardActionsResult {
  const { error, runMutation } = useDesktopMutations({
    applySnapshot,
    refreshSnapshot,
  })

  const onToggleTask = useCallback(
    (taskId: string) => {
      void runMutation("toggleTask", () => api.toggleTask(taskId))
    },
    [api, runMutation],
  )

  const onToggleFocus = useCallback(
    (taskId: string) => {
      const focus = snapshot?.focus
      const isActiveTask = focus?.activeTaskId === taskId

      if (isActiveTask && focus?.state === "running") {
        void runMutation("pauseFocus", () => api.pauseFocus())
        return
      }

      if (isActiveTask && focus?.state === "paused") {
        void runMutation("resumeFocus", () => api.resumeFocus())
        return
      }

      void runMutation("startFocus", () => api.startFocus(taskId))
    },
    [api, runMutation, snapshot],
  )

  const openTasksWindow = useCallback(
    (intent: TasksWindowIntent) => {
      void runMutation("openTasksWindow", () => api.openTasksWindow(intent))
    },
    [api, runMutation],
  )

  const onAddTask = useCallback(() => {
    openTasksWindow({ kind: "add" })
  }, [openTasksWindow])

  const onOpenTasks = useCallback(() => {
    openTasksWindow({ kind: "list" })
  }, [openTasksWindow])

  const onOpenTask = useCallback(
    (taskId: string) => {
      openTasksWindow({ kind: "task", taskId })
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
    callbacks: {
      onAddTask,
      onOpenTask,
      onOpenTasks,
      onReorder,
      onToggleFocus,
      onToggleTask,
    },
    error,
  }
}
