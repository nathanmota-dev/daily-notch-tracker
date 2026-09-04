import type {
  OverlayPresentationMode,
  TasksWindowIntent,
} from "./contracts"
import {
  isTasksWindowIntent,
  OVERLAY_PRESENTATION_QUERY_PARAMETER,
} from "./window-navigation-contracts"

export { isTasksWindowIntent }

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

export function serializeTasksWindowIntent(intent: TasksWindowIntent) {
  switch (intent.kind) {
    case "add":
      return "intent=add"
    case "task":
      return `intent=task&taskId=${encodeURIComponent(intent.taskId)}`
    case "list":
      return "intent=list"
  }
}

export function tasksSurfaceSearch(intent: TasksWindowIntent) {
  return `?surface=tasks&${serializeTasksWindowIntent(intent)}`
}

export function overlaySurfaceSearch(
  presentationMode?: OverlayPresentationMode,
) {
  const presentationQuery = presentationMode
    ? `&${OVERLAY_PRESENTATION_QUERY_PARAMETER}=${presentationMode}`
    : ""

  return `?surface=overlay${presentationQuery}`
}

export function settingsSurfaceSearch() {
  return "?surface=settings"
}
