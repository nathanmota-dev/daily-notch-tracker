import {
  getCurrentWindow,
  PhysicalPosition as TauriPhysicalPosition,
  PhysicalSize as TauriPhysicalSize,
  primaryMonitor as tauriPrimaryMonitor,
  type Window as TauriWindow,
} from "@tauri-apps/api/window"

import {
  getOverlayDisplayMetricsKey,
  normalizeOverlayDisplayMetrics,
  type OverlayDisplayMetrics,
} from "./overlay-position"
import type {
  OverlayPhysicalPosition,
  OverlayPhysicalSize,
  OverlayWindowAdapter,
  OverlayWindowUnlisten,
} from "./overlay-window"

type TauriWindowAdapter = Pick<
  TauriWindow,
  | "innerSize"
  | "innerPosition"
  | "scaleFactor"
  | "setSize"
  | "setPosition"
  | "show"
  | "hide"
> &
  Partial<Pick<TauriWindow, "onScaleChanged">>

export type TauriOverlayWindowAdapterOptions = {
  monitorReader?: () => Promise<unknown>
  displayPollIntervalMs?: number
}

export const OVERLAY_DISPLAY_POLL_INTERVAL_MS = 1000

function createDisplayChangeSubscription(
  appWindow: TauriWindowAdapter,
  readPrimaryMonitor: () => Promise<OverlayDisplayMetrics | null>,
  pollIntervalMs: number,
) {
  return async (listener: () => void): Promise<OverlayWindowUnlisten> => {
    let active = true
    let checking = false
    let refreshQueued = false
    let lastMetricsKey: string | undefined

    function notify() {
      if (!active) {
        return
      }

      try {
        listener()
      } catch {
        // A display notification should not break the native polling loop.
      }
    }

    async function refresh(notifyForSameMetrics: boolean) {
      if (!active) {
        return
      }

      if (checking) {
        refreshQueued = true
        return
      }

      checking = true

      try {
        const metrics = await readPrimaryMonitor()

        if (!active) {
          return
        }

        const nextMetricsKey = getOverlayDisplayMetricsKey(metrics)
        const metricsChanged =
          lastMetricsKey !== undefined && lastMetricsKey !== nextMetricsKey
        lastMetricsKey = nextMetricsKey

        if (notifyForSameMetrics || metricsChanged) {
          notify()
        }
      } finally {
        checking = false

        if (active && refreshQueued) {
          refreshQueued = false
          void refresh(false)
        }
      }
    }

    await refresh(false)

    if (!active) {
      return () => undefined
    }

    let scaleUnlistenPromise: Promise<OverlayWindowUnlisten | undefined>

    if (appWindow.onScaleChanged) {
      try {
        scaleUnlistenPromise = appWindow
          .onScaleChanged(() => {
            notify()
            void refresh(false)
          })
          .then((unlisten) => unlisten)
          .catch(() => undefined)
      } catch {
        scaleUnlistenPromise = Promise.resolve(undefined)
      }
    } else {
      scaleUnlistenPromise = Promise.resolve(undefined)
    }

    const pollHandle = setInterval(() => {
      void refresh(false)
    }, pollIntervalMs)
    let cleaned = false

    return () => {
      if (cleaned) {
        return
      }

      cleaned = true
      active = false
      clearInterval(pollHandle)
      void scaleUnlistenPromise.then((unlisten) => unlisten?.())
    }
  }
}

export function createTauriOverlayWindowAdapter(
  appWindow: TauriWindowAdapter = getCurrentWindow(),
  options: TauriOverlayWindowAdapterOptions = {},
): OverlayWindowAdapter {
  const monitorReader = options.monitorReader ?? (() => tauriPrimaryMonitor())
  const pollIntervalMs =
    options.displayPollIntervalMs !== undefined &&
    Number.isFinite(options.displayPollIntervalMs) &&
    options.displayPollIntervalMs > 0
      ? options.displayPollIntervalMs
      : OVERLAY_DISPLAY_POLL_INTERVAL_MS

  async function readPrimaryMonitor(): Promise<OverlayDisplayMetrics | null> {
    try {
      return normalizeOverlayDisplayMetrics(await monitorReader())
    } catch {
      return null
    }
  }

  return {
    innerSize: async () => {
      const size = await appWindow.innerSize()
      return { width: size.width, height: size.height }
    },
    innerPosition: async () => {
      const position = await appWindow.innerPosition()
      return { x: position.x, y: position.y }
    },
    scaleFactor: () => appWindow.scaleFactor(),
    primaryMonitor: readPrimaryMonitor,
    setSize: (size: OverlayPhysicalSize) =>
      appWindow.setSize(new TauriPhysicalSize(size.width, size.height)),
    setPosition: (position: OverlayPhysicalPosition) =>
      appWindow.setPosition(
        new TauriPhysicalPosition(position.x, position.y),
      ),
    show: () => appWindow.show(),
    hide: () => appWindow.hide(),
    subscribeToDisplayChanges: createDisplayChangeSubscription(
      appWindow,
      readPrimaryMonitor,
      pollIntervalMs,
    ),
  }
}
