import type { AppSnapshot } from "./contracts"
import {
  cloneDesktopValue,
  createBrowserDiagnostics,
  createEmptyAppSnapshot,
} from "./fixtures"
import { createMockApi } from "./mock-api-operations"
import type {
  MockDesktopApiContext,
  MockDesktopApiController,
  MockDesktopApiOptions,
} from "./mock-api-types"
import { cloneSnapshot, createMockState } from "./mock-state"
import { emitMockEvent } from "./mock-api-helpers"

export type {
  MockDesktopApiController,
  MockDesktopApiHandlers,
  MockDesktopApiOptions,
  MockDesktopFailure,
  MockDesktopOperation,
} from "./mock-api-types"

export function createMockDesktopApi(
  options: MockDesktopApiOptions = {},
): MockDesktopApiController {
  const context: MockDesktopApiContext = {
    options,
    state: createMockState(options.snapshot ?? createEmptyAppSnapshot()),
    diagnostics: cloneDesktopValue(
      options.diagnostics ?? createBrowserDiagnostics(),
    ),
    listeners: new Map(),
  }

  return {
    api: createMockApi(context),
    emit: (eventName, payload) => emitMockEvent(context, eventName, payload),
    getSnapshot: () => cloneSnapshot(context.state.snapshot),
    setSnapshot: (snapshot: AppSnapshot) => {
      context.state = createMockState(snapshot)
    },
  }
}
