import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"

import {
  isSurfaceLabel,
  type SurfaceLabel,
} from "../lib/desktopApi"
import { isTauriRuntime } from "../lib/desktop/tauri"

export const SURFACE_QUERY_PARAMETER = "surface"
export const DEFAULT_SURFACE: SurfaceLabel = "overlay"

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
