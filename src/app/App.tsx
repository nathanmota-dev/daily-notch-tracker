import { useEffect, useRef, useState } from "react"

import { CollapsedFocusWidget } from "../components/collapsed-focus-widget"
import {
  ExpandedDashboard,
  type ExpandedDashboardCallbacks,
} from "../components/expanded-dashboard"
import {
  ErrorShell,
  LoadingShell,
  SurfacePlaceholder,
} from "./AppStates"

import {
  desktopApi,
  normalizeDesktopApiError,
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type SurfaceLabel,
} from "../lib/desktopApi"

export type PresentationMode = "collapsed" | "expanded"

type PresentationCallbacks = Partial<ExpandedDashboardCallbacks>

type AppProps = {
  api?: DesktopApi
  surface?: SurfaceLabel
  presentationMode?: PresentationMode
} & PresentationCallbacks

type ShellState =
  | { status: "loading" }
  | { status: "ready"; snapshot: AppSnapshot }
  | { status: "error"; error: DesktopApiError }

type AppShellProps = {
  snapshot: AppSnapshot
  presentationMode?: PresentationMode
} & PresentationCallbacks

export function AppShell({
  presentationMode = "collapsed",
  snapshot,
  ...callbacks
}: AppShellProps) {
  const isExpanded = presentationMode === "expanded"

  return (
    <main
      className={
        isExpanded
          ? "expanded-dashboard-surface"
          : "collapsed-focus-surface"
      }
      data-presentation-mode={presentationMode}
      data-surface="overlay"
    >
      {isExpanded ? (
        <ExpandedDashboard snapshot={snapshot} {...callbacks} />
      ) : (
        <CollapsedFocusWidget
          focus={snapshot.focus}
          settings={snapshot.settings}
        />
      )}
    </main>
  )
}

function renderSurface(
  surface: SurfaceLabel,
  snapshot: AppSnapshot,
  presentationMode: PresentationMode,
  callbacks: PresentationCallbacks,
) {
  if (surface === "overlay") {
    return (
      <AppShell
        presentationMode={presentationMode}
        snapshot={snapshot}
        {...callbacks}
      />
    )
  }

  return <SurfacePlaceholder snapshot={snapshot} surface={surface} />
}

function acceptSnapshot(
  snapshot: AppSnapshot,
  latestRevision: { current: number },
) {
  if (snapshot.revision < latestRevision.current) {
    return false
  }

  latestRevision.current = snapshot.revision
  return true
}

export function App({
  api = desktopApi,
  presentationMode = "collapsed",
  surface = "overlay",
  ...callbacks
}: AppProps) {
  const [reloadKey, setReloadKey] = useState(0)
  const latestRevision = useRef(-1)
  const [shellState, setShellState] = useState<ShellState>({
    status: "loading",
  })

  useEffect(() => {
    let active = true
    latestRevision.current = -1
    setShellState({ status: "loading" })

    api.getSnapshot().then(
      (snapshot) => {
        if (active && acceptSnapshot(snapshot, latestRevision)) {
          setShellState({ status: "ready", snapshot })
        }
      },
      (error: unknown) => {
        if (active) {
          setShellState({
            status: "error",
            error: normalizeDesktopApiError(error, "getSnapshot"),
          })
        }
      },
    )

    return () => {
      active = false
    }
  }, [api, reloadKey])

  useEffect(() => {
    if (surface !== "overlay") {
      return
    }

    let active = true
    const eventNames = ["focus-changed", "settings-changed"] as const
    const unlistenPromises = eventNames.map((eventName) =>
      api
        .subscribe(eventName, (snapshot) => {
          if (active && acceptSnapshot(snapshot, latestRevision)) {
            setShellState({ status: "ready", snapshot })
          }
        })
        .catch(() => undefined),
    )

    return () => {
      active = false
      void Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten?.())
      })
    }
  }, [api, surface])

  if (shellState.status === "loading") {
    return <LoadingShell surface={surface} />
  }

  if (shellState.status === "error") {
    return (
      <ErrorShell
        error={shellState.error}
        onRetry={() => setReloadKey((currentKey) => currentKey + 1)}
        surface={surface}
      />
    )
  }

  return renderSurface(
    surface,
    shellState.snapshot,
    presentationMode,
    callbacks,
  )
}
