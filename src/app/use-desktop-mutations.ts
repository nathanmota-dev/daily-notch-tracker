import { useCallback, useRef, useState } from "react"

import {
  normalizeDesktopApiError,
  type AppSnapshot,
  type DesktopApiError,
} from "../lib/desktopApi"

export type SnapshotMutation = () => Promise<AppSnapshot | void>
export type SnapshotMutationErrorHandler = (error: DesktopApiError) => void

export type UseDesktopMutationsOptions = {
  applySnapshot: (snapshot: AppSnapshot) => void
  refreshSnapshot: () => Promise<AppSnapshot>
}

export type UseDesktopMutationsResult = {
  busy: boolean
  error: DesktopApiError | null
  runMutation: (
    operation: string,
    mutation: SnapshotMutation,
    onError?: SnapshotMutationErrorHandler,
  ) => Promise<AppSnapshot | void | null>
}

async function reconcileSnapshot(
  refreshSnapshot: () => Promise<AppSnapshot>,
) {
  try {
    await refreshSnapshot()
  } catch {
    return
  }
}

export function useDesktopMutations({
  applySnapshot,
  refreshSnapshot,
}: UseDesktopMutationsOptions): UseDesktopMutationsResult {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<DesktopApiError | null>(null)
  const busyRef = useRef(false)

  const runMutation = useCallback(
    async (
      operation: string,
      mutation: SnapshotMutation,
      onError?: SnapshotMutationErrorHandler,
    ) => {
      if (busyRef.current) {
        return null
      }

      busyRef.current = true
      setBusy(true)
      setError(null)

      try {
        const result = await mutation()
        if (result !== undefined) {
          applySnapshot(result)
        }
        return result
      } catch (value) {
        const mutationError = normalizeDesktopApiError(value, operation)
        await reconcileSnapshot(refreshSnapshot)
        setError(mutationError)
        onError?.(mutationError)
        return null
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [applySnapshot, refreshSnapshot],
  )

  return { busy, error, runMutation }
}
