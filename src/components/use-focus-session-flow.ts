import { useCallback, useMemo, useState } from "react"

import type {
  AppSnapshot,
  DesktopApi,
  DesktopApiError,
} from "../lib/desktopApi"
import type { UseDesktopMutationsResult } from "../app/use-desktop-mutations"
import {
  DEFAULT_FOCUS_SESSION_SECONDS,
  MAX_FOCUS_SESSION_SECONDS,
} from "./focus-session-model"
import type { FocusSessionPickerProps } from "./focus-session-types"

export type UseFocusSessionFlowOptions = {
  api: DesktopApi
  snapshot: AppSnapshot | null
  runMutation: UseDesktopMutationsResult["runMutation"]
  mutationBusy?: boolean
  mutationError?: DesktopApiError | null
}

export type FocusSessionFlow = {
  requestFocus: (taskId: string) => void
  picker: FocusSessionPickerProps
}

function initialDurationForTask(snapshot: AppSnapshot | null, taskId: string) {
  const task = snapshot?.tasks.find((item) => item.id === taskId)
  const estimateSeconds = task ? task.estimateMinutes * 60 : 0
  const settingsSeconds = snapshot ? snapshot.settings.focusMinutes * 60 : 0

  return Math.min(
    MAX_FOCUS_SESSION_SECONDS,
    estimateSeconds || settingsSeconds || DEFAULT_FOCUS_SESSION_SECONDS,
  )
}

export function useFocusSessionFlow({
  api,
  mutationBusy = false,
  mutationError = null,
  runMutation,
  snapshot,
}: UseFocusSessionFlowOptions): FocusSessionFlow {
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [pendingTaskTitle, setPendingTaskTitle] = useState<string | null>(null)
  const [initialDurationSeconds, setInitialDurationSeconds] = useState(
    DEFAULT_FOCUS_SESSION_SECONDS,
  )
  const [isOpen, setIsOpen] = useState(false)

  const cancel = useCallback(() => {
    setIsOpen(false)
    setPendingTaskId(null)
    setPendingTaskTitle(null)
  }, [])

  const requestFocus = useCallback(
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

      const task = snapshot?.tasks.find((item) => item.id === taskId)
      if (task?.isDone) {
        return
      }

      setPendingTaskId(taskId)
      setPendingTaskTitle(task?.title ?? "")
      setInitialDurationSeconds(initialDurationForTask(snapshot, taskId))
      setIsOpen(true)
    },
    [api, runMutation, snapshot],
  )

  const confirm = useCallback(
    async (durationSeconds: number) => {
      if (!pendingTaskId) {
        return
      }

      const result = await runMutation("startFocus", () =>
        api.startFocus({
          taskId: pendingTaskId,
          durationSeconds,
        }),
      )

      if (result) {
        cancel()
      }
    },
    [api, cancel, pendingTaskId, runMutation],
  )

  const picker = useMemo<FocusSessionPickerProps>(
    () => ({
      busy: mutationBusy,
      error: mutationError?.message ?? null,
      initialDurationSeconds,
      onCancel: cancel,
      onConfirm: confirm,
      open: isOpen,
      taskTitle: pendingTaskTitle,
    }),
    [
      cancel,
      confirm,
      initialDurationSeconds,
      isOpen,
      mutationBusy,
      mutationError,
      pendingTaskTitle,
    ],
  )

  return { picker, requestFocus }
}
