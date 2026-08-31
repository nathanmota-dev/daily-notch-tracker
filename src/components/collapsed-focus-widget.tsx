import { useEffect, useState } from "react"

import { ClockIcon, PauseIcon } from "../icons"
import type { FocusSettings, FocusSnapshot } from "../lib/desktopApi"
import { cn } from "../lib/utils"
import { ProgressTray } from "./ProgressTray"
import {
  deriveCollapsedFocusPresentation,
  formatFocusTime,
} from "./collapsedFocus"

const PRESENTATION_TICK_MS = 250

export type CollapsedFocusWidgetProps = {
  focus: FocusSnapshot
  settings: Pick<FocusSettings, "minimalMode" | "rainbowTimeline" | "showTimeline">
  className?: string
}

function usePresentationNow(focus: FocusSnapshot) {
  const [now, setNow] = useState(() => Date.now())
  const endAt = focus.endAt ? Date.parse(focus.endAt) : Number.NaN
  const hasPresentationTime =
    focus.state === "running" &&
    (!Number.isFinite(endAt) || endAt > now)

  useEffect(() => {
    if (!hasPresentationTime) {
      return
    }

    setNow(Date.now())
    const interval = window.setInterval(
      () => setNow(Date.now()),
      PRESENTATION_TICK_MS,
    )

    return () => window.clearInterval(interval)
  }, [hasPresentationTime])

  return now
}

export function CollapsedFocusWidget({
  className,
  focus,
  settings,
}: CollapsedFocusWidgetProps) {
  const now = usePresentationNow(focus)
  const presentation = deriveCollapsedFocusPresentation(focus, settings, now)

  if (!presentation.isVisible) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "collapsed-focus-widget collapsed-focus-widget--idle",
          className,
        )}
        data-mode="idle"
        data-slot="collapsed-focus-widget"
        data-state="idle"
        data-timeline="off"
        hidden
      />
    )
  }

  const isPaused = presentation.state === "paused"

  return (
    <div
      aria-label={isPaused ? "Foco pausado" : "Foco em andamento"}
      className={cn("collapsed-focus-widget", className)}
      data-mode={presentation.mode}
      data-slot="collapsed-focus-widget"
      data-state={presentation.state}
      data-timeline={presentation.showTimeline ? "on" : "off"}
      role="group"
    >
      <ProgressTray
        aria-label="Progresso do foco"
        className="collapsed-focus-widget__tray"
        progress={presentation.progress}
        rainbowTimeline={presentation.rainbowTimeline}
        showTimeline={presentation.showTimeline}
      >
        {presentation.mode !== "minimal" && (
          <div
            className="collapsed-focus-widget__content"
            data-slot="collapsed-focus-widget-content"
          >
            <div className="collapsed-focus-widget__timer">
              <ClockIcon aria-hidden="true" />
              <time
                aria-label={`${formatFocusTime(presentation.remainingMs)} restantes`}
                className="collapsed-focus-widget__timer-value"
                data-slot="focus-timer"
                role="timer"
              >
                {formatFocusTime(presentation.remainingMs)}
              </time>
              {isPaused && (
                <span
                  aria-hidden="true"
                  className="collapsed-focus-widget__paused-indicator"
                  data-slot="focus-paused-indicator"
                >
                  <PauseIcon />
                </span>
              )}
            </div>

            <div className="collapsed-focus-widget__task">
              <span
                aria-label={presentation.title}
                className="collapsed-focus-widget__task-title"
                data-slot="focus-task-title"
                title={presentation.title}
              >
                {presentation.title}
              </span>
            </div>
          </div>
        )}
      </ProgressTray>
    </div>
  )
}
