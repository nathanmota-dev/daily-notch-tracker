import { ExpandedDashboard } from "../components/expanded-dashboard"
import { cn } from "../lib/utils"
import type { StackedContentSurfaceProps } from "./stacked-content-surface-types"

export function StackedContentSurface({
  activeSurface,
  dashboardProps,
  settings,
  tasks,
}: StackedContentSurfaceProps) {
  const surfaceEntries = [
    { content: tasks, surface: "tasks" as const },
    { content: settings, surface: "settings" as const },
  ]

  return (
    <div
      className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden bg-transparent"
      data-slot="stacked-content-surface"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none grid min-h-0 place-items-center py-2"
        data-slot="stacked-dashboard"
        inert
      >
        <ExpandedDashboard {...dashboardProps} onOpenTasks={() => undefined} />
      </div>
      <div
        className="relative min-h-0"
        data-slot="stacked-content-body"
      >
        {surfaceEntries.map(({ content, surface }) => {
          const active = surface === activeSurface

          return (
            <div
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 [&>[data-surface]]:!h-full [&>[data-surface]]:!min-h-0",
                active ? "z-10" : "pointer-events-none z-0",
              )}
              data-active={active ? "true" : "false"}
              data-content-surface={surface}
              inert={!active}
              key={surface}
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
