import { useSyncExternalStore } from "react"

import {
  getRuntimePresentationMode,
  getRuntimeSurfaceLabel,
} from "./surfaceResolver"
import type {
  OverlayPresentationMode,
  SurfaceLabel,
} from "../lib/desktopApi"

function subscribeToRuntimeSurface(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  window.addEventListener("popstate", onStoreChange)
  window.addEventListener("hashchange", onStoreChange)

  return () => {
    window.removeEventListener("popstate", onStoreChange)
    window.removeEventListener("hashchange", onStoreChange)
  }
}

export function useRuntimeSurface(): SurfaceLabel {
  return useSyncExternalStore(
    subscribeToRuntimeSurface,
    getRuntimeSurfaceLabel,
    () => "overlay",
  )
}

export function useRuntimePresentationMode(
  fallback: OverlayPresentationMode = "collapsed",
): OverlayPresentationMode {
  return useSyncExternalStore(
    subscribeToRuntimeSurface,
    () => getRuntimePresentationMode(fallback),
    () => fallback,
  )
}
