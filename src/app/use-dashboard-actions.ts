import { useCallback, useState } from "react"

import {
  normalizeDesktopApiError,
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type TasksWindowIntent,
} from "../lib/desktopApi"
import { getLocalDateString } from "../lib/local-date"

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

type SnapshotAction = () => Promise<AppSnapshot | void>

async function reconcileSnapshot(
  refreshSnapshot: () => Promise<AppSnapshot>,
) {
  try {
    await refreshSnapshot()
  } catch {
    return
  }
}

export function useDashboardActions({
  api,
  applySnapshot,
  now,
  refreshSnapshot,
  snapshot,
}: UseDashboardActionsOptions): UseDashboardActionsResult {
  const [error, setError] = useState<DesktopApiError | null>(null)

  const runAction = useCallback(
    async (operation: string, action: SnapshotAction) => {
      setError(null)

      try {
        const result = await action()
        if (result !== undefined) {
          applySnapshot(result)
        }
      } catch (value) {
        const actionError = normalizeDesktopApiError(value, operation)
        await reconcileSnapshot(refreshSnapshot)
        setError(actionError)
      }
    },
    [applySnapshot, refreshSnapshot],
  )

  const onToggleTask = useCallback(
    (taskId: string) => {
      void runAction("toggleTask", () => api.toggleTask(taskId))
    },
    [api, runAction],
  )

  const onToggleFocus = useCallback(
    (taskId: string) => {
      const focus = snapshot?.focus
      const isActiveTask = focus?.activeTaskId === taskId

      if (isActiveTask && focus?.state === "running") {
        void runAction("pauseFocus", () => api.pauseFocus())
        return
      }

      if (isActiveTask && focus?.state === "paused") {
        void runAction("resumeFocus", () => api.resumeFocus())
        return
      }

      void runAction("startFocus", () => api.startFocus(taskId))
    },
    [api, runAction, snapshot],
  )

  const openTasksWindow = useCallback(
    (intent: TasksWindowIntent) => {
      void runAction("openTasksWindow", () => api.openTasksWindow(intent))
    },
    [api, runAction],
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

      void runAction("moveTasks", () =>
        api.moveTasks({
          taskIds,
          source: bucket,
          destination: bucket,
        }),
      )
    },
    [api, now, runAction],
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
