import { useEffect, useReducer, useState } from "react"

import {
  normalizeDesktopApiError,
  type DesktopApi,
  type DesktopEventName,
  type DesktopUnlisten,
} from "../lib/desktopApi"
import {
  createInitialSnapshotStoreState,
  snapshotStoreReducer,
  type SnapshotStoreState,
} from "./snapshot-store"

const snapshotEventNames = [
  "focus-changed",
  "store-changed",
  "settings-changed",
  "shortcut-changed",
] as const satisfies readonly DesktopEventName[]

function safelyUnlisten(unlisten: DesktopUnlisten) {
  try {
    unlisten()
  } catch {
    return
  }
}

export function useAppSnapshot(api: DesktopApi): {
  state: SnapshotStoreState
  retry: () => void
} {
  const [reloadKey, setReloadKey] = useState(0)
  const [state, dispatch] = useReducer(
    snapshotStoreReducer,
    undefined,
    createInitialSnapshotStoreState,
  )

  useEffect(() => {
    let active = true
    let cleanupCompleted = false
    const unlisteners = new Set<DesktopUnlisten>()

    dispatch({ type: "reset" })

    const load = async () => {
      const subscriptionResults = await Promise.allSettled(
        snapshotEventNames.map((eventName) =>
          Promise.resolve().then(() =>
            api.subscribe(eventName, (snapshot) => {
              if (active) {
                dispatch({ type: "received", snapshot })
              }
            }),
          ),
        ),
      )

      subscriptionResults.forEach((result) => {
        if (result.status !== "fulfilled") {
          return
        }

        if (active && !cleanupCompleted) {
          unlisteners.add(result.value)
        } else {
          safelyUnlisten(result.value)
        }
      })

      if (!active) {
        return
      }

      try {
        const snapshot = await api.getSnapshot()
        if (active) {
          dispatch({ type: "received", snapshot })
        }
      } catch (error) {
        if (active) {
          dispatch({
            type: "failed",
            error: normalizeDesktopApiError(error, "getSnapshot"),
          })
        }
      }
    }

    void load()

    return () => {
      if (cleanupCompleted) {
        return
      }

      active = false
      cleanupCompleted = true
      const currentUnlisteners = Array.from(unlisteners)
      unlisteners.clear()
      currentUnlisteners.forEach(safelyUnlisten)
    }
  }, [api, reloadKey])

  return {
    state,
    retry: () => setReloadKey((currentKey) => currentKey + 1),
  }
}
