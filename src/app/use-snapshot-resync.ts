import { useCallback, useEffect, useRef } from "react"

export const DEFAULT_SNAPSHOT_RESYNC_INTERVAL_MS = 5_000

export type UseSnapshotResyncOptions = {
  active?: boolean
  enabled?: boolean
  intervalMs?: number
  refreshSnapshot: () => Promise<unknown>
}

function isDocumentVisible() {
  return (
    typeof document === "undefined" ||
    (document.visibilityState === "visible" && !document.hidden)
  )
}

function safeIntervalMs(value: number | undefined) {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? value
    : DEFAULT_SNAPSHOT_RESYNC_INTERVAL_MS
}

export function useSnapshotResync({
  active = false,
  enabled = true,
  intervalMs,
  refreshSnapshot,
}: UseSnapshotResyncOptions) {
  const refreshSnapshotRef = useRef(refreshSnapshot)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    refreshSnapshotRef.current = refreshSnapshot
  }, [refreshSnapshot])

  const resync = useCallback(() => {
    if (!mountedRef.current || inFlightRef.current) {
      return
    }

    inFlightRef.current = true
    void Promise.resolve()
      .then(() =>
        mountedRef.current ? refreshSnapshotRef.current() : undefined,
      )
      .catch(() => undefined)
      .finally(() => {
        inFlightRef.current = false
      })
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      mountedRef.current = false
      return
    }

    mountedRef.current = true

    const refreshWhenVisible = () => {
      if (isDocumentVisible()) {
        resync()
      }
    }

    window.addEventListener("focus", refreshWhenVisible)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    const interval = active
      ? window.setInterval(refreshWhenVisible, safeIntervalMs(intervalMs))
      : null

    return () => {
      mountedRef.current = false
      window.removeEventListener("focus", refreshWhenVisible)
      document.removeEventListener("visibilitychange", refreshWhenVisible)

      if (interval !== null) {
        window.clearInterval(interval)
      }
    }
  }, [active, enabled, intervalMs, resync])

  return { resync }
}
