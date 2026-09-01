import { useEffect, useState } from "react"

import type {
  DesktopApi,
  DesktopUnlisten,
  TasksWindowIntent,
} from "../../lib/desktopApi"

export function parseTasksWindowIntent(search = ""): TasksWindowIntent {
  const params = new URLSearchParams(search)
  const kind = params.get("intent")

  if (kind === "add") {
    return { kind: "add" }
  }

  if (kind === "task") {
    const taskId = params.get("taskId")?.trim()
    if (taskId) {
      return { kind: "task", taskId }
    }
  }

  return { kind: "list" }
}

export function isTasksWindowIntent(value: unknown): value is TasksWindowIntent {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const intent = value as Record<string, unknown>
  if (intent.kind === "list" || intent.kind === "add") {
    return true
  }

  return intent.kind === "task" && typeof intent.taskId === "string" && intent.taskId.length > 0
}

function safelyUnlisten(unlisten: DesktopUnlisten) {
  try {
    unlisten()
  } catch {
    return
  }
}

export function useTasksWindowIntent(
  api: DesktopApi,
  search = typeof window === "undefined" ? "" : window.location.search,
) {
  const [intent, setIntent] = useState<TasksWindowIntent>(() =>
    parseTasksWindowIntent(search),
  )

  useEffect(() => {
    let active = true
    let unlisten: DesktopUnlisten | null = null

    void api
      .subscribe("tasks-window-intent", (nextIntent) => {
        if (active && isTasksWindowIntent(nextIntent)) {
          setIntent(nextIntent)
        }
      })
      .then((cleanup) => {
        if (active) {
          unlisten = cleanup
        } else {
          safelyUnlisten(cleanup)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
      if (unlisten) {
        safelyUnlisten(unlisten)
      }
    }
  }, [api])

  return intent
}
