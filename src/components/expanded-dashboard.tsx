import type { AppSnapshot } from "../lib/desktopApi"
import { cn } from "../lib/utils"
import { ProgressTray } from "./ProgressTray"
import { Panel } from "./Panel"
import { ActivityPanel } from "./ActivityPanel"
import { TodoPanel } from "./TodoPanel"
import {
  getExpandedDashboardProgress,
  sortTasksForDashboard,
} from "./expandedDashboard"

export type ExpandedDashboardCallbacks = {
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: () => void
  onOpenTasks: () => void
  onReorderStart: (taskId: string) => void
}

export type ExpandedDashboardProps = {
  snapshot: AppSnapshot
  className?: string
} & Partial<ExpandedDashboardCallbacks>

const noop = () => undefined

export function ExpandedDashboard({
  className,
  onAddTask = noop,
  onOpenTasks = noop,
  onReorderStart = noop,
  onToggleFocus = noop,
  onToggleTask = noop,
  snapshot,
}: ExpandedDashboardProps) {
  const orderedTasks = sortTasksForDashboard(snapshot.tasks)

  return (
    <ProgressTray
      aria-label="Focus timeline"
      className={cn("expanded-dashboard", className)}
      data-focus-state={snapshot.focus.state}
      data-slot="expanded-dashboard-tray"
      progress={getExpandedDashboardProgress(snapshot.focus)}
      rainbowTimeline={snapshot.settings.rainbowTimeline}
      showTimeline
    >
      <Panel
        aria-label="Expanded dashboard"
        className="expanded-dashboard__panel"
        data-dashboard-state={snapshot.focus.state}
        data-slot="expanded-dashboard"
        role="region"
      >
        <div className="expanded-dashboard__grid">
          <TodoPanel
            focus={snapshot.focus}
            onAddTask={onAddTask}
            onOpenTasks={onOpenTasks}
            onReorderStart={onReorderStart}
            onToggleFocus={onToggleFocus}
            onToggleTask={onToggleTask}
            tasks={orderedTasks}
          />
          <ActivityPanel />
        </div>
      </Panel>
    </ProgressTray>
  )
}
