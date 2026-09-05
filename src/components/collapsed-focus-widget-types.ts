import type {
  FocusSession,
  FocusSettings,
  FocusSnapshot,
  Task,
} from "../lib/desktopApi"

export type CollapsedFocusWidgetProps = {
  focus: FocusSnapshot
  settings: Pick<
    FocusSettings,
    "focusMinutes" | "minimalMode" | "rainbowTimeline" | "showTimeline"
  >
  sessions?: readonly FocusSession[]
  tasks?: readonly Task[]
  className?: string
  now?: Date | number
  visible?: boolean
}

export type CollapsedFocusContentProps = {
  isPaused: boolean
  remainingMs: number
  streak: number
  title: string
}
