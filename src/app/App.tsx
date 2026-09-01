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
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type SurfaceLabel,
} from "../lib/desktopApi"
import {
  type OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"
import {
  OverlayInteractionProvider,
  useOverlayInteraction,
} from "./use-overlay-interaction"
import {
  useOverlayResize,
  useOverlayWindowAdapter,
} from "./use-overlay-resize"
import { useAppSnapshot } from "./use-app-snapshot"
import { useDashboardActions } from "./use-dashboard-actions"

export type PresentationMode = "collapsed" | "expanded"

type PresentationCallbacks = Partial<ExpandedDashboardCallbacks>

type AppProps = {
  api?: DesktopApi
  overlayWindowAdapter?: OverlayWindowAdapter | null
  surface?: SurfaceLabel
  presentationMode?: PresentationMode
} & PresentationCallbacks

type AppShellProps = {
  snapshot: AppSnapshot
  presentationMode?: PresentationMode
  overlayWindowAdapter?: OverlayWindowAdapter | null
  dashboardError?: DesktopApiError | null
} & PresentationCallbacks

export function AppShell({
  presentationMode = "collapsed",
  snapshot,
  overlayWindowAdapter,
  dashboardError,
  ...callbacks
}: AppShellProps) {
  const overlayWindow = useOverlayWindowAdapter(overlayWindowAdapter)
  const interaction = useOverlayInteraction({
    adapter: overlayWindow,
    focusState: snapshot.focus.state,
    initialPresentationMode: presentationMode,
  })
  const { presentationMode: effectivePresentationMode } = interaction
  const isExpanded = effectivePresentationMode === "expanded"
  const { isResizing, surfaceRef } = useOverlayResize({
    adapter: overlayWindow,
    minimalMode: snapshot.settings.minimalMode,
    presentationMode: effectivePresentationMode,
    showTimeline: snapshot.settings.showTimeline,
  })

  return (
    <OverlayInteractionProvider value={interaction}>
      <main
        ref={surfaceRef}
        className={
          isExpanded
            ? "expanded-dashboard-surface"
            : "collapsed-focus-surface"
        }
        data-presentation-mode={effectivePresentationMode}
        data-resizing={isResizing ? "true" : "false"}
        data-surface="overlay"
        onPointerEnter={interaction.onPointerEnter}
        onPointerLeave={interaction.onPointerLeave}
      >
        {isExpanded ? (
          <ExpandedDashboard
            dashboardError={dashboardError}
            snapshot={snapshot}
            {...callbacks}
          />
        ) : (
          <CollapsedFocusWidget
            focus={snapshot.focus}
            settings={snapshot.settings}
          />
        )}
      </main>
    </OverlayInteractionProvider>
  )
}

function renderSurface(
  surface: SurfaceLabel,
  snapshot: AppSnapshot,
  presentationMode: PresentationMode,
  callbacks: PresentationCallbacks,
  dashboardError: DesktopApiError | null,
  overlayWindowAdapter?: OverlayWindowAdapter | null,
) {
  if (surface === "overlay") {
    return (
      <AppShell
        overlayWindowAdapter={overlayWindowAdapter}
        presentationMode={presentationMode}
        dashboardError={dashboardError}
        snapshot={snapshot}
        {...callbacks}
      />
    )
  }

  return <SurfacePlaceholder snapshot={snapshot} surface={surface} />
}

export function App({
  api = desktopApi,
  overlayWindowAdapter,
  presentationMode = "collapsed",
  surface = "overlay",
  ...callbacks
}: AppProps) {
  const {
    applySnapshot,
    refreshSnapshot,
    retry,
    state,
  } = useAppSnapshot(api)
  const dashboardActions = useDashboardActions({
    api,
    applySnapshot,
    refreshSnapshot,
    snapshot: state.status === "ready" ? state.snapshot : null,
  })

  if (state.status === "loading") {
    return <LoadingShell surface={surface} />
  }

  if (state.status === "error") {
    return (
      <ErrorShell
        error={state.error}
        onRetry={retry}
        surface={surface}
      />
    )
  }

  return renderSurface(
    surface,
    state.snapshot,
    presentationMode,
    { ...dashboardActions.callbacks, ...callbacks },
    dashboardActions.error,
    overlayWindowAdapter,
  )
}
