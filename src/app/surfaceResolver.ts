import {
  isSurfaceLabel,
  type OverlayPresentationMode,
  type SurfaceLabel,
} from "../lib/desktopApi"
import { getTauriWindowLabel, isTauriRuntime } from "../lib/desktop/tauri"
import {
  parseTasksWindowIntent,
} from "../lib/desktop/window-intent"
import { OVERLAY_PRESENTATION_QUERY_PARAMETER } from "../lib/desktop/window-navigation-contracts"

export const SURFACE_QUERY_PARAMETER = "surface"
export const DEFAULT_SURFACE: SurfaceLabel = "overlay"
export const DEFAULT_PRESENTATION_MODE: OverlayPresentationMode = "collapsed"

export type SurfaceResolutionContext = {
  runtime: "browser" | "tauri"
  search?: string
  windowLabel?: string
}

export function resolveSurfaceLabel({
  runtime,
  search = "",
  windowLabel,
}: SurfaceResolutionContext): SurfaceLabel {
  if (runtime === "tauri") {
    return isSurfaceLabel(windowLabel) ? windowLabel : DEFAULT_SURFACE
  }

  const candidate = new URLSearchParams(search).get(SURFACE_QUERY_PARAMETER)

  return isSurfaceLabel(candidate) ? candidate : DEFAULT_SURFACE
}

export function getRuntimeSurfaceLabel(): SurfaceLabel {
  return resolveSurfaceLabel({
    runtime: isTauriRuntime() ? "tauri" : "browser",
    search: typeof window === "undefined" ? "" : window.location.search,
    windowLabel: getTauriWindowLabel(),
  })
}

export type SurfaceStateResolutionContext = SurfaceResolutionContext & {
  fallbackPresentationMode?: OverlayPresentationMode
}

export type RuntimeSurfaceState = {
  surface: SurfaceLabel
  intent: ReturnType<typeof parseTasksWindowIntent> | null
  presentationMode: OverlayPresentationMode | null
}

export function resolveRuntimeSurfaceState({
  fallbackPresentationMode = DEFAULT_PRESENTATION_MODE,
  runtime,
  search = "",
  windowLabel,
}: SurfaceStateResolutionContext): RuntimeSurfaceState {
  const surface = resolveSurfaceLabel({ runtime, search, windowLabel })

  return {
    surface,
    intent: surface === "tasks" ? parseTasksWindowIntent(search) : null,
    presentationMode:
      surface === "overlay"
        ? resolvePresentationMode({
            fallback: fallbackPresentationMode,
            runtime,
            search,
          })
        : null,
  }
}

export function getRuntimeSurfaceState(
  fallbackPresentationMode = DEFAULT_PRESENTATION_MODE,
): RuntimeSurfaceState {
  const runtime = isTauriRuntime() ? "tauri" : "browser"

  return resolveRuntimeSurfaceState({
    fallbackPresentationMode,
    runtime,
    search: typeof window === "undefined" ? "" : window.location.search,
    windowLabel: getTauriWindowLabel(),
  })
}

export type PresentationResolutionContext = {
  runtime: "browser" | "tauri"
  search?: string
  fallback?: OverlayPresentationMode
}

export function resolvePresentationMode({
  fallback = DEFAULT_PRESENTATION_MODE,
  search = "",
}: PresentationResolutionContext): OverlayPresentationMode {
  const candidate = new URLSearchParams(search).get(
    OVERLAY_PRESENTATION_QUERY_PARAMETER,
  )

  return (
    candidate === "collapsed" ||
    candidate === "peek" ||
    candidate === "expanded"
  )
    ? candidate
    : fallback
}

export function getRuntimePresentationMode(
  fallback = DEFAULT_PRESENTATION_MODE,
): OverlayPresentationMode {
  return resolvePresentationMode({
    fallback,
    runtime: isTauriRuntime() ? "tauri" : "browser",
    search: typeof window === "undefined" ? "" : window.location.search,
  })
}
