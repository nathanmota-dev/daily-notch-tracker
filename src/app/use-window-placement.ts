import { useEffect } from "react"

import type { DesktopApi, SurfaceLabel } from "../lib/desktopApi"
import {
  resolveWindowPlacement,
  type WindowPlacementGeometry,
} from "../lib/desktop/window-placement"
import type {
  OverlayPhysicalSize,
  OverlayWindowAdapter,
  OverlayWindowUnlisten,
} from "../lib/desktop/overlay-window"

export const DEFAULT_WINDOW_PLACEMENT_SAVE_DEBOUNCE_MS = 250

export type UseWindowPlacementOptions = {
  api: DesktopApi
  adapter?: OverlayWindowAdapter | null
  surface: SurfaceLabel
  debounceMs?: number
}

function isExtendedSurface(surface: SurfaceLabel) {
  return surface === "tasks" || surface === "settings"
}

function safeDebounceMs(value: number | undefined) {
  return Number.isFinite(value) && value !== undefined && value >= 0
    ? value
    : DEFAULT_WINDOW_PLACEMENT_SAVE_DEBOUNCE_MS
}

function safelyUnlisten(unlisten: OverlayWindowUnlisten) {
  try {
    unlisten()
  } catch {
    return
  }
}

async function resolveValue<Value>(
  operation: () => Promise<Value>,
  fallback: Value,
): Promise<Value> {
  try {
    return await operation()
  } catch {
    return fallback
  }
}

async function restoreWindowPlacement(
  adapter: OverlayWindowAdapter,
  api: DesktopApi,
  isActive: () => boolean,
): Promise<void> {
  const [savedPlacement, availableMonitors, primaryMonitor, currentSize] =
    await Promise.all([
      resolveValue(() => api.getWindowPlacement(), null),
      resolveValue(
        () => adapter.availableMonitors?.() ?? Promise.resolve([]),
        [],
      ),
      resolveValue(() => adapter.primaryMonitor(), null),
      resolveValue<OverlayPhysicalSize | undefined>(
        () => adapter.innerSize(),
        undefined,
      ),
    ])

  if (!isActive()) {
    return
  }

  const geometry = resolveWindowPlacement(
    savedPlacement,
    availableMonitors,
    primaryMonitor,
    currentSize,
  )

  if (!geometry) {
    return
  }

  await applyWindowPlacement(adapter, geometry, isActive)
}

async function applyWindowPlacement(
  adapter: OverlayWindowAdapter,
  geometry: WindowPlacementGeometry,
  isActive: () => boolean,
) {
  try {
    await adapter.setSize(geometry.size)
  } catch {
    // A saved size should not prevent the content window from opening.
  }

  if (!isActive()) {
    return
  }

  try {
    await adapter.setPosition(geometry.position)
  } catch {
    // A saved position should not prevent the content window from opening.
  }
}

/** Restores and persists the shared physical placement of extended surfaces. */
export function useWindowPlacement({
  adapter,
  api,
  debounceMs,
  surface,
}: UseWindowPlacementOptions) {
  useEffect(() => {
    if (!isExtendedSurface(surface) || !adapter) {
      return
    }

    let active = true
    let restoring = true
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    let moveUnlisten: OverlayWindowUnlisten | null = null
    const delay = safeDebounceMs(debounceMs)

    const clearSaveTimer = () => {
      if (saveTimer === null) {
        return
      }

      clearTimeout(saveTimer)
      saveTimer = null
    }

    const savePlacement = () => {
      if (!active || restoring) {
        return
      }

      saveTimer = null
      void api.saveWindowPlacement().catch(() => undefined)
    }

    const scheduleSave = () => {
      if (!active || restoring) {
        return
      }

      clearSaveTimer()
      saveTimer = setTimeout(savePlacement, delay)
    }

    const subscribeToMoves = async () => {
      if (!adapter.subscribeToWindowMoves) {
        return
      }

      try {
        const unlisten = await adapter.subscribeToWindowMoves(scheduleSave)
        if (active) {
          moveUnlisten = unlisten
        } else {
          safelyUnlisten(unlisten)
        }
      } catch {
        return
      }
    }

    void Promise.all([
      subscribeToMoves(),
      restoreWindowPlacement(adapter, api, () => active),
    ]).finally(() => {
      if (active) {
        restoring = false
      }
    })

    return () => {
      active = false
      restoring = true
      clearSaveTimer()
      if (moveUnlisten) {
        safelyUnlisten(moveUnlisten)
      }
      moveUnlisten = null
    }
  }, [adapter, api, debounceMs, surface])
}
