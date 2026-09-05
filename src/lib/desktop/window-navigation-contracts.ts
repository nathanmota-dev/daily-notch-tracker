import { isSurfaceLabel, type SurfaceLabel, type TasksWindowIntent } from "./contracts"

export type OverlayPresentationMode = "collapsed" | "peek" | "expanded"

export const OVERLAY_PRESENTATION_QUERY_PARAMETER = "presentation"

export type TasksWindowOrigin = {
  presentationMode: OverlayPresentationMode
}

export type SurfaceChangedPayload = {
  surface: SurfaceLabel
  intent: TasksWindowIntent | null
  presentationMode: OverlayPresentationMode | null
}

export type SurfaceChangedEvent = SurfaceChangedPayload

export type OverlayChildWindowChangedPayload = {
  open: boolean
  presentationMode: OverlayPresentationMode
}

export function isOverlayPresentationMode(
  value: unknown,
): value is OverlayPresentationMode {
  return value === "collapsed" || value === "peek" || value === "expanded"
}

export function isOverlayChildWindowChangedPayload(
  value: unknown,
): value is OverlayChildWindowChangedPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { open?: unknown }).open === "boolean" &&
    isOverlayPresentationMode(
      (value as { presentationMode?: unknown }).presentationMode,
    )
  )
}

export function isTasksWindowIntent(
  value: unknown,
): value is TasksWindowIntent {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const intent = value as Record<string, unknown>
  if (intent.kind === "list" || intent.kind === "add") {
    return true
  }

  return (
    intent.kind === "task" &&
    typeof intent.taskId === "string" &&
    intent.taskId.trim().length > 0
  )
}

export function isSurfaceChangedPayload(
  value: unknown,
): value is SurfaceChangedPayload {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const payload = value as Record<string, unknown>

  return (
    isSurfaceLabel(payload.surface) &&
    (payload.intent === null || isTasksWindowIntent(payload.intent)) &&
    (payload.presentationMode === null ||
      isOverlayPresentationMode(payload.presentationMode))
  )
}
