import { useEffect, useState } from "react"

import type { DesktopApi, TasksWindowIntent } from "../../lib/desktopApi"
import {
  isTasksWindowIntent as isValidTasksWindowIntent,
  parseTasksWindowIntent as parseWindowIntent,
} from "../../lib/desktop/window-intent"

export const parseTasksWindowIntent = parseWindowIntent
export const isTasksWindowIntent = isValidTasksWindowIntent

export function useTasksWindowIntent(
  _api: DesktopApi,
  search?: string,
) {
  const [intent, setIntent] = useState<TasksWindowIntent>(() =>
    parseTasksWindowIntent(
      search ?? (typeof window === "undefined" ? "" : window.location.search),
    ),
  )

  useEffect(() => {
    const updateFromLocation = () => {
      if (search === undefined) {
        setIntent(parseTasksWindowIntent(window.location.search))
      }
    }

    if (search === undefined && typeof window !== "undefined") {
      window.addEventListener("popstate", updateFromLocation)
      window.addEventListener("hashchange", updateFromLocation)
    }

    return () => {
      if (search === undefined && typeof window !== "undefined") {
        window.removeEventListener("popstate", updateFromLocation)
        window.removeEventListener("hashchange", updateFromLocation)
      }
    }
  }, [_api, search])

  return intent
}
