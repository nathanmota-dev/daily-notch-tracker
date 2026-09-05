import { CollapsedFocusWidget } from "../components/collapsed-focus-widget"
import {
  ExpandedDashboard,
  type ExpandedDashboardCallbacks,
} from "../components/expanded-dashboard"
import {
  ErrorShell,
  LoadingShell,
} from "./AppStates"
import { SettingsSurface } from "../features/settings/settings-surface"
import { TasksSurface } from "../features/tasks/tasks-surface"

import {
  desktopApi,
  type AppSnapshot,
  type DesktopApi,
  type DesktopApiError,
  type OverlayPresentationMode,
  type SurfaceLabel,
  type TasksWindowIntent,
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
import { useWindowPlacement } from "./use-window-placement"
import { useAppSnapshot } from "./use-app-snapshot"
import { useDashboardActions } from "./use-dashboard-actions"
import { cn } from "../lib/utils"
import { StackedContentSurface } from "./stacked-content-surface"

export type PresentationMode = OverlayPresentationMode

type PresentationCallbacks = Partial<ExpandedDashboardCallbacks>

type AppProps = {
  api?: DesktopApi
  overlayWindowAdapter?: OverlayWindowAdapter | null
  surface?: SurfaceLabel
  presentationMode?: PresentationMode
  tasksIntent?: TasksWindowIntent
} & PresentationCallbacks

type AppShellProps = {
  api?: DesktopApi
  snapshot: AppSnapshot
  presentationMode?: PresentationMode
  overlayWindowAdapter?: OverlayWindowAdapter | null
  busy?: boolean
  dashboardError?: DesktopApiError | null
} & PresentationCallbacks

type SurfaceRenderOptions = {
  applySnapshot: (snapshot: AppSnapshot) => void
  refreshSnapshot: () => Promise<AppSnapshot>
}

export function AppShell({
  api,
  busy = false,
  presentationMode = "collapsed",
  snapshot,
  overlayWindowAdapter,
  dashboardError,
  ...callbacks
}: AppShellProps) {
  const overlayWindow = useOverlayWindowAdapter(overlayWindowAdapter)
  const interaction = useOverlayInteraction({
    adapter: overlayWindow,
    api,
    focusState: snapshot.focus.state,
    initialPresentationMode: presentationMode,
  })
  const { presentationMode: effectivePresentationMode } = interaction
  const origin = { presentationMode: effectivePresentationMode }
  const overlayCallbacks: PresentationCallbacks = {
    ...callbacks,
    onAddTask: () => callbacks.onAddTask?.(origin),
    onOpenTask: (taskId) => callbacks.onOpenTask?.(taskId, origin),
    onOpenTasks: () => callbacks.onOpenTasks?.(origin),
  }
  const isExpanded = effectivePresentationMode === "expanded"
  const isPeek = effectivePresentationMode === "peek"
  const { isResizing, surfaceRef } = useOverlayResize({
    adapter: overlayWindow,
    focusState: snapshot.focus.state,
    minimalMode: snapshot.settings.minimalMode,
    presentationMode: effectivePresentationMode,
    showTimeline: snapshot.settings.showTimeline,
  })

  return (
    <OverlayInteractionProvider value={interaction}>
      <main
        ref={surfaceRef}
        className={cn(
          "grid min-h-screen min-w-0 w-screen place-items-center overflow-hidden bg-transparent transition-opacity duration-[240ms] ease-[ease] data-[resizing=true]:opacity-[0.98]",
          isExpanded && "py-2",
        )}
        data-presentation-mode={effectivePresentationMode}
        data-resizing={isResizing ? "true" : "false"}
        data-surface="overlay"
        onFocus={interaction.onFocus}
        onClick={interaction.onClick}
        onPointerEnter={interaction.onPointerEnter}
        onPointerLeave={interaction.onPointerLeave}
      >
        {isExpanded ? (
          <ExpandedDashboard
            busy={busy}
            dashboardError={dashboardError}
            snapshot={snapshot}
            {...overlayCallbacks}
          />
        ) : (
          <CollapsedFocusWidget
            focus={snapshot.focus}
            sessions={snapshot.sessions}
            settings={snapshot.settings}
            tasks={snapshot.tasks}
            visible={isPeek}
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
  dashboardBusy: boolean,
  overlayWindowAdapter?: OverlayWindowAdapter | null,
  api?: DesktopApi,
  snapshotOptions?: SurfaceRenderOptions,
  tasksIntent?: TasksWindowIntent,
) {
  if (surface === "overlay") {
    return (
      <AppShell
        api={api}
        overlayWindowAdapter={overlayWindowAdapter}
        presentationMode={presentationMode}
        busy={dashboardBusy}
        dashboardError={dashboardError}
        snapshot={snapshot}
        {...callbacks}
      />
    )
  }

  if ((surface === "tasks" || surface === "settings") && api && snapshotOptions) {
    return (
      <StackedContentSurface
        activeSurface={surface}
        dashboardProps={{
          ...callbacks,
          busy: dashboardBusy,
          dashboardError,
          snapshot,
        }}
        settings={<SettingsSurface
          api={api}
          applySnapshot={snapshotOptions.applySnapshot}
          refreshSnapshot={snapshotOptions.refreshSnapshot}
          snapshot={snapshot}
        />}
        tasks={<TasksSurface
          api={api}
          applySnapshot={snapshotOptions.applySnapshot}
          refreshSnapshot={snapshotOptions.refreshSnapshot}
          snapshot={snapshot}
          initialIntent={tasksIntent}
        />}
      />
    )
  }

  return <LoadingShell surface={surface} />
}

export function App({
  api = desktopApi,
  overlayWindowAdapter,
  presentationMode = "collapsed",
  surface = "overlay",
  tasksIntent,
  ...callbacks
}: AppProps) {
  const {
    applySnapshot,
    refreshSnapshot,
    retry,
    state,
  } = useAppSnapshot(api)
  const resolvedOverlayWindowAdapter = useOverlayWindowAdapter(
    overlayWindowAdapter,
  )
  useWindowPlacement({
    adapter: resolvedOverlayWindowAdapter,
    api,
    surface,
  })
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
    dashboardActions.busy,
    resolvedOverlayWindowAdapter,
    api,
    { applySnapshot, refreshSnapshot },
    tasksIntent,
  )
}
