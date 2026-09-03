import type { TasksWindowIntent } from "./contracts"

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

export function overlaySurfaceSearch() {
  return "?surface=overlay"
}
