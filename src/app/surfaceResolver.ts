import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"

import {
  isSurfaceLabel,
  type OverlayPresentationMode,
  type SurfaceLabel,
} from "../lib/desktopApi"
import { isTauriRuntime } from "../lib/desktop/tauri"
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
  const candidate =
    runtime === "tauri"
      ? windowLabel
      : new URLSearchParams(search).get(SURFACE_QUERY_PARAMETER)

  return isSurfaceLabel(candidate) ? candidate : DEFAULT_SURFACE
}

export function getRuntimeSurfaceLabel(): SurfaceLabel {
  if (isTauriRuntime()) {
    return resolveSurfaceLabel({
      runtime: "tauri",
      windowLabel: getCurrentWebviewWindow().label,
    })
  }

  return resolveSurfaceLabel({
    runtime: "browser",
    search: typeof window === "undefined" ? "" : window.location.search,
  })
}

export type PresentationResolutionContext = {
  runtime: "browser" | "tauri"
  search?: string
  fallback?: OverlayPresentationMode
}

export function resolvePresentationMode({
  fallback = DEFAULT_PRESENTATION_MODE,
  runtime,
  search = "",
}: PresentationResolutionContext): OverlayPresentationMode {
  if (runtime === "tauri") {
    return fallback
  }

  const candidate = new URLSearchParams(search).get(
    OVERLAY_PRESENTATION_QUERY_PARAMETER,
  )

  return candidate === "collapsed" || candidate === "expanded"
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
