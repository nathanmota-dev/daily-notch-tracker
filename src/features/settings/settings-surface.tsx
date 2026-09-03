import { useCallback, useEffect, useRef, useState } from "react"

import { useDesktopMutations } from "../../app/use-desktop-mutations"
import {
  normalizeDesktopApiError,
  type AppDiagnostics,
  type DesktopApiError,
} from "../../lib/desktopApi"
import {
  FOCUS_MINUTES_ERROR,
  getAutostartControlState,
  parseFocusMinutes,
  settingsTogglePatch,
  type SettingsToggleKey,
} from "./settings-model"
import { SettingsSurfaceContent } from "./settings-surface-content"
import type {
  SettingsMutationRunner,
  SettingsSurfaceProps,
} from "./settings-view-types"

function useSettingsDiagnostics(api: SettingsSurfaceProps["api"]) {
  const [diagnostics, setDiagnostics] = useState<AppDiagnostics | null>(null)
  const [diagnosticsError, setDiagnosticsError] = useState<DesktopApiError | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true)
  const diagnosticsRequestRef = useRef(0)

  const loadDiagnostics = useCallback(() => {
    const requestId = diagnosticsRequestRef.current + 1
    diagnosticsRequestRef.current = requestId
    setDiagnosticsLoading(true)
    setDiagnosticsError(null)

    void api
      .getAppDiagnostics()
      .then((nextDiagnostics) => {
        if (diagnosticsRequestRef.current !== requestId) {
          return
        }
        setDiagnostics(nextDiagnostics)
      })
      .catch((value) => {
        if (diagnosticsRequestRef.current !== requestId) {
          return
        }
        setDiagnosticsError(normalizeDesktopApiError(value, "getAppDiagnostics"))
      })
      .finally(() => {
        if (diagnosticsRequestRef.current === requestId) {
          setDiagnosticsLoading(false)
        }
      })
  }, [api])

  useEffect(() => {
    loadDiagnostics()
    return () => {
      diagnosticsRequestRef.current += 1
    }
  }, [loadDiagnostics])

  return { diagnostics, diagnosticsError, diagnosticsLoading, loadDiagnostics }
}

function useSettingsMutationRunner(
  runMutation: ReturnType<typeof useDesktopMutations>["runMutation"],
) {
  const [retryMutation, setRetryMutation] = useState<(() => void) | null>(null)

  const runSettingsMutation = useCallback<SettingsMutationRunner>(
    (operation, mutation) => {
      const retry = () => {
        setRetryMutation(() => retry)
        void runMutation(operation, mutation).then((result) => {
          if (result !== null) {
            setRetryMutation(null)
          }
        })
      }

      retry()
    },
    [runMutation],
  )

  return { retryMutation, runSettingsMutation }
}

function useSettingsDuration(
  snapshot: SettingsSurfaceProps["snapshot"],
  api: SettingsSurfaceProps["api"],
  runSettingsMutation: SettingsMutationRunner,
) {
  const [focusMinutesDraft, setFocusMinutesDraft] = useState(
    String(snapshot.settings.focusMinutes),
  )
  const [durationError, setDurationError] = useState<string | null>(null)
  const durationSubmissionRef = useRef<number | null>(null)

  useEffect(() => {
    setFocusMinutesDraft(String(snapshot.settings.focusMinutes))
    setDurationError(null)
    durationSubmissionRef.current = null
  }, [snapshot.settings.focusMinutes])

  const onFocusMinutesChange = useCallback((value: string) => {
    setFocusMinutesDraft(value)
    setDurationError(null)
    durationSubmissionRef.current = null
  }, [])

  const onCommitFocusMinutes = useCallback(() => {
    const parsedMinutes = parseFocusMinutes(focusMinutesDraft)
    if (parsedMinutes === null) {
      setDurationError(FOCUS_MINUTES_ERROR)
      return
    }

    setFocusMinutesDraft(String(parsedMinutes))
    setDurationError(null)
    if (
      parsedMinutes === snapshot.settings.focusMinutes ||
      parsedMinutes === durationSubmissionRef.current
    ) {
      return
    }

    durationSubmissionRef.current = parsedMinutes
    runSettingsMutation("updateSettings", () =>
      api.updateSettings({ focusMinutes: parsedMinutes }),
    )
  }, [api, focusMinutesDraft, runSettingsMutation, snapshot.settings.focusMinutes])

  return {
    durationError,
    focusMinutesDraft,
    onCommitFocusMinutes,
    onFocusMinutesChange,
  }
}

export function SettingsSurface({
  api,
  applySnapshot,
  refreshSnapshot,
  snapshot,
}: SettingsSurfaceProps) {
  const mutations = useDesktopMutations({ applySnapshot, refreshSnapshot })
  const { diagnostics, diagnosticsError, diagnosticsLoading, loadDiagnostics } =
    useSettingsDiagnostics(api)
  const { retryMutation, runSettingsMutation } = useSettingsMutationRunner(
    mutations.runMutation,
  )
  const {
    durationError,
    focusMinutesDraft,
    onCommitFocusMinutes,
    onFocusMinutesChange,
  } = useSettingsDuration(snapshot, api, runSettingsMutation)

  const handleToggle = useCallback(
    (key: SettingsToggleKey, checked: boolean) => {
      runSettingsMutation("updateSettings", () =>
        api.updateSettings(settingsTogglePatch(key, checked)),
      )
    },
    [api, runSettingsMutation],
  )

  const handleAutostartChange = useCallback(
    (enabled: boolean) => {
      runSettingsMutation("setAutostart", async () => {
        const result = await api.setAutostart(enabled)
        loadDiagnostics()
        return result
      })
    },
    [api, loadDiagnostics, runSettingsMutation],
  )

  const handleClose = useCallback(() => {
    runSettingsMutation("closeSettingsWindow", () => api.closeSettingsWindow())
  }, [api, runSettingsMutation])

  return (
    <SettingsSurfaceContent
      autostart={getAutostartControlState(diagnostics, diagnosticsLoading)}
      diagnostics={diagnostics}
      diagnosticsError={diagnosticsError}
      diagnosticsLoading={diagnosticsLoading}
      durationError={durationError}
      focusMinutesDraft={focusMinutesDraft}
      mutationError={mutations.error}
      mutationBusy={mutations.busy}
      onAutostartChange={handleAutostartChange}
      onClose={handleClose}
      onCommitFocusMinutes={onCommitFocusMinutes}
      onFocusMinutesChange={onFocusMinutesChange}
      onRetryDiagnostics={loadDiagnostics}
      onRetryMutation={retryMutation}
      onToggle={handleToggle}
      settings={snapshot.settings}
      shortcutMessage={diagnostics?.shortcut.message ?? diagnosticsError?.message ?? null}
      shortcutStatus={diagnostics?.shortcut.status ?? snapshot.shortcutStatus}
    />
  )
}
