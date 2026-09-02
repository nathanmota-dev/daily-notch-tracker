import { ClockIcon, PauseIcon } from "../icons"
import type { FocusSettings, FocusSnapshot } from "../lib/desktopApi"
import { cn } from "../lib/utils"
import { ProgressTray } from "./progress-tray"
import {
  deriveCollapsedFocusPresentation,
  formatFocusTime,
} from "./collapsed-focus"
import { useFocusCountdown } from "./use-focus-countdown"

export type CollapsedFocusWidgetProps = {
  focus: FocusSnapshot
  settings: Pick<FocusSettings, "minimalMode" | "rainbowTimeline" | "showTimeline">
  className?: string
  now?: Date | number
}

export function CollapsedFocusWidget({
  className,
  focus,
  now: controlledNow,
  settings,
}: CollapsedFocusWidgetProps) {
  const { now } = useFocusCountdown(focus, { now: controlledNow })
  const presentation = deriveCollapsedFocusPresentation(focus, settings, now)

  if (!presentation.isVisible) {
    return (
      <div
        aria-hidden="true"
        className={cn("hidden", className)}
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
      className={cn(
        "min-w-0 overflow-hidden rounded-pill bg-[var(--collapsed-widget-background)] text-content",
        "h-[var(--collapsed-widget-height)] w-[min(var(--collapsed-widget-width),calc(100vw-8px))]",
        !presentation.showTimeline && "h-[var(--collapsed-widget-height-off)]",
        presentation.mode === "minimal" &&
          "w-[min(var(--collapsed-widget-minimal-width),calc(100vw-8px))]",
        isPaused && "[--progress-fill:var(--danger)]",
        presentation.mode === "rgb" && "shadow-rgb-glow",
        className,
      )}
      data-mode={presentation.mode}
      data-slot="collapsed-focus-widget"
      data-state={presentation.state}
      data-timeline={presentation.showTimeline ? "on" : "off"}
      role="group"
    >
      <ProgressTray
        aria-label="Progresso do foco"
        className="h-full min-h-0"
        progress={presentation.progress}
        rainbowTimeline={presentation.rainbowTimeline}
        showTimeline={presentation.showTimeline}
      >
        {presentation.mode !== "minimal" && (
          <div
            className="relative z-[1] flex h-full w-full items-center gap-6 px-7"
            data-slot="collapsed-focus-widget-content"
          >
            <div className="inline-flex min-w-[9.25rem] flex-[0_0_9.25rem] items-center gap-2 text-[var(--progress-fill)]">
              <ClockIcon aria-hidden="true" className="size-[18px] shrink-0" />
              <time
                aria-label={`${formatFocusTime(presentation.remainingMs)} restantes`}
                className="inline-block min-w-[6ch] whitespace-nowrap font-mono text-[1.5rem] font-bold tabular-nums leading-none tracking-[0.04em]"
                data-slot="focus-timer"
                role="timer"
              >
                {formatFocusTime(presentation.remainingMs)}
              </time>
              {isPaused && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-flex items-center justify-center"
                  data-slot="focus-paused-indicator"
                >
                  <PauseIcon className="size-3.5" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-[1_1_auto] overflow-hidden">
              <span
                aria-label={presentation.title}
                className="block overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-content"
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
