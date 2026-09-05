import type { DesktopApi } from "./desktop/api"
import type { AppSnapshot } from "./desktop/contracts"
import { createMockDesktopApi } from "./desktop/mock"
import {
  createTauriDesktopApi,
  isTauriRuntime,
} from "./desktop/tauri"

export type DesktopApiFactoryOptions = {
  browserSnapshot?: AppSnapshot
  runtimeDetector?: () => boolean
}

export function createDesktopApi(
  options: DesktopApiFactoryOptions = {},
): DesktopApi {
  const runtimeDetector = options.runtimeDetector ?? isTauriRuntime

  if (runtimeDetector()) {
    return createTauriDesktopApi()
  }

  return createMockDesktopApi({ snapshot: options.browserSnapshot }).api
}

export const desktopApi = createDesktopApi()

export type {
  DesktopApi,
  DesktopEventListener,
  DesktopEventName,
  DesktopUnlisten,
} from "./desktop/api"
export type {
  AppDiagnostics,
  AppSnapshot,
  AutostartDiagnostic,
  CreateTaskInput,
  DesktopCommandMap,
  DesktopEventMap,
  FocusSession,
  FocusSettings,
  FocusSettingsPatch,
  FocusSnapshot,
  FocusState,
  IntegrationStatus,
  IsoDateString,
  IsoDateTimeString,
  MoveTasksInput,
  ShortcutDiagnostic,
  ShortcutStatus,
  StartFocusInput,
  SurfaceChangedEvent,
  SurfaceChangedPayload,
  SurfaceLabel,
  Task,
  TaskBucket,
  OverlayPresentationMode,
  TasksWindowOrigin,
  TasksWindowIntent,
  TrayDiagnostic,
  UpdateTaskInput,
  WindowPlacementSnapshot,
  WindowMonitorSnapshot,
} from "./desktop/contracts"
export {
  isSurfaceLabel,
  SURFACE_LABELS,
} from "./desktop/contracts"
export {
  isOverlayChildWindowChangedPayload,
  isOverlayPresentationMode,
  isSurfaceChangedPayload,
  isTasksWindowIntent,
} from "./desktop/window-navigation-contracts"
export {
  DesktopApiError,
  desktopOperationErrorCodes,
  isDesktopApiError,
  normalizeDesktopApiError,
  type DesktopApiErrorCode,
  type DesktopApiErrorOptions,
  type DesktopApiOperation,
} from "./desktop/errors"
export {
  COLLAPSED_WIDGET_FIXTURE_NAMES,
  EXPANDED_DASHBOARD_FIXTURE_NAMES,
  WIDGET_FIXTURE_NAMES,
  createBrowserDiagnostics,
  createCollapsedWidgetFixtureSnapshot,
  createExpandedDashboardFixtureSnapshot,
  createEmptyAppSnapshot,
  createWidgetFixtureSnapshot,
  isCollapsedWidgetFixture,
  isExpandedDashboardFixture,
  isWidgetFixture,
  resolveCollapsedWidgetFixture,
  resolveWidgetFixture,
  type CollapsedWidgetFixture,
  type ExpandedDashboardFixture,
  type WidgetFixture,
} from "./desktop/fixtures"
export {
  createMockDesktopApi,
  type MockDesktopApiController,
  type MockDesktopApiHandlers,
  type MockDesktopApiOptions,
  type MockDesktopFailure,
  type MockDesktopOperation,
} from "./desktop/mock"
export { createTauriDesktopApi, type TauriTransport } from "./desktop/tauri"
export {
  clampWindowPosition,
  findWindowMonitor,
  normalizeWindowMonitorSnapshot,
  normalizeWindowPlacementSnapshot,
  resolveWindowPlacement,
  DEFAULT_EXTENDED_WINDOW_SIZE,
  type ResolvedWindowPlacement,
  type WindowPlacementGeometry,
} from "./desktop/window-placement"
