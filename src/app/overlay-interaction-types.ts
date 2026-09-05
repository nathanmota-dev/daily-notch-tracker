import type {
  DesktopApi,
  FocusState,
} from "../lib/desktopApi"
import type {
  OverlayPresentationMode,
  OverlayWindowAdapter,
} from "../lib/desktop/overlay-window"

export type UseOverlayInteractionOptions = {
  adapter?: OverlayWindowAdapter | null
  api?: DesktopApi
  focusState?: FocusState
  initialPresentationMode?: OverlayPresentationMode
}

export type OverlayInteraction = {
  presentationMode: OverlayPresentationMode
  onClick: () => void
  onFocus: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  acquireHold: () => () => void
}

export type InteractionRef<T> = { current: T }

export type CollapseState = {
  activeRef: InteractionRef<boolean>
  pointerInsideRef: InteractionRef<boolean>
  holdsRef: InteractionRef<number>
  childWindowOpenRef: InteractionRef<boolean>
  collapseTimerRef: InteractionRef<ReturnType<typeof setTimeout> | null>
  clearTimer: () => void
  setPresentationMode: (mode: OverlayPresentationMode) => void
  presentationModeRef: InteractionRef<OverlayPresentationMode>
}

export type OverlayInteractionState = {
  collapseState: CollapseState
  resolvedAdapter: OverlayWindowAdapter | null | undefined
  presentationMode: OverlayPresentationMode
  presentationModeRef: InteractionRef<OverlayPresentationMode>
  pointerInsideRef: InteractionRef<boolean>
  holdsRef: InteractionRef<number>
  childWindowOpenRef: InteractionRef<boolean>
  clearCollapseTimer: () => void
  updatePresentationMode: (mode: OverlayPresentationMode) => void
}
