import type { DesktopApi, DesktopEventName } from "./api"
import type {
  AppDiagnostics,
  AppSnapshot,
  DesktopEventMap,
  WindowPlacementSnapshot,
} from "./contracts"
import { DesktopApiError, type DesktopApiErrorCode } from "./errors"
import type { MockState } from "./mock-state"

export type MockDesktopOperation = Exclude<keyof DesktopApi, "subscribe">

export type MockDesktopApiHandlers = Partial<
  Pick<DesktopApi, MockDesktopOperation>
>

export type MockDesktopFailure = DesktopApiError | DesktopApiErrorCode

export type MockDesktopApiOptions = {
  snapshot?: AppSnapshot
  windowPlacement?: WindowPlacementSnapshot | null
  diagnostics?: AppDiagnostics
  handlers?: MockDesktopApiHandlers
  failures?: Partial<
    Record<MockDesktopOperation | "subscribe", MockDesktopFailure>
  >
}

export type MockDesktopApiController = {
  api: DesktopApi
  emit<EventName extends DesktopEventName>(
    eventName: EventName,
    payload: DesktopEventMap[EventName],
  ): void
  getSnapshot(): AppSnapshot
  setSnapshot(snapshot: AppSnapshot): void
}

export type AnyEventPayload = DesktopEventMap[DesktopEventName]
export type AnyEventListener = (payload: AnyEventPayload) => void

export type MockDesktopApiContext = {
  options: MockDesktopApiOptions
  state: MockState
  diagnostics: AppDiagnostics
  listeners: Map<DesktopEventName, Set<AnyEventListener>>
}

export type MockSnapshotHandler =
  | (() => Promise<AppSnapshot>)
  | undefined
