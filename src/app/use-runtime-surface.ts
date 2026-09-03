import { useSyncExternalStore } from "react"

import { getRuntimeSurfaceLabel } from "./surfaceResolver"
import type { SurfaceLabel } from "../lib/desktopApi"

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
