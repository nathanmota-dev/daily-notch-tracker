import { useEffect, useState, useSyncExternalStore } from "react"

import {
  getRuntimeSurfaceState,
  getRuntimePresentationMode,
  resolveRuntimeSurfaceState,
} from "./surfaceResolver"
import { desktopApi, type DesktopApi } from "../lib/desktopApi"
import { isTauriRuntime } from "../lib/desktop/tauri"
import type {
  OverlayPresentationMode,
  SurfaceChangedPayload,
} from "../lib/desktopApi"
import { isSurfaceChangedPayload } from "../lib/desktopApi"
import type { DesktopUnlisten } from "../lib/desktopApi"

function subscribeToRuntimeHistory(onStoreChange: () => void) {
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

function safelyUnlisten(unlisten: DesktopUnlisten) {
  try {
    unlisten()
  } catch {
    return
  }
}

function surfaceStateFromPayload(
  payload: SurfaceChangedPayload,
): ReturnType<typeof getRuntimeSurfaceState> {
  return {
    surface: payload.surface,
    intent: payload.intent,
    presentationMode:
      payload.surface === "overlay"
        ? payload.presentationMode ?? "collapsed"
        : null,
  }
}

export type UseRuntimeSurfaceOptions = {
  api?: DesktopApi
  enabled?: boolean
  fallbackPresentationMode?: OverlayPresentationMode
}

export function useRuntimeSurface({
  api = desktopApi,
  enabled = true,
  fallbackPresentationMode = "collapsed",
}: UseRuntimeSurfaceOptions = {}) {
  const [runtimeState, setRuntimeState] = useState(() =>
    getRuntimeSurfaceState(fallbackPresentationMode),
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    let active = true
    let unlisten: DesktopUnlisten | null = null
    const nativeRuntime = isTauriRuntime()

    const updateFromLocation = () => {
      if (!active || typeof window === "undefined") {
        return
      }

      setRuntimeState(
        resolveRuntimeSurfaceState({
          fallbackPresentationMode,
          runtime: "browser",
          search: window.location.search,
        }),
      )
    }

    if (!nativeRuntime && typeof window !== "undefined") {
      window.addEventListener("popstate", updateFromLocation)
      window.addEventListener("hashchange", updateFromLocation)
    }

    void api
      .subscribe("surface-changed", (payload) => {
        if (active && isSurfaceChangedPayload(payload)) {
          setRuntimeState(surfaceStateFromPayload(payload))
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
      if (!nativeRuntime && typeof window !== "undefined") {
        window.removeEventListener("popstate", updateFromLocation)
        window.removeEventListener("hashchange", updateFromLocation)
      }
    }
  }, [api, enabled, fallbackPresentationMode])

  return runtimeState
}

export function useRuntimePresentationMode(
  fallback: OverlayPresentationMode = "collapsed",
): OverlayPresentationMode {
  return useSyncExternalStore(
    subscribeToRuntimeHistory,
    () => getRuntimePresentationMode(fallback),
    () => fallback,
  )
}
