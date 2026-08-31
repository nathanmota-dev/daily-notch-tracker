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
  SurfaceLabel,
  Task,
  TaskBucket,
  TasksWindowIntent,
  UpdateTaskInput,
  WindowPlacementSnapshot,
} from "./desktop/contracts"
export { isSurfaceLabel, SURFACE_LABELS } from "./desktop/contracts"
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
  createBrowserDiagnostics,
  createCollapsedWidgetFixtureSnapshot,
  createEmptyAppSnapshot,
  isCollapsedWidgetFixture,
  resolveCollapsedWidgetFixture,
  type CollapsedWidgetFixture,
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
