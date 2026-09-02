import { CloseIcon, ListIcon, SettingsIcon } from "../../icons"
import { IconButton } from "../../components/icon-button"
import { Button } from "../../components/ui/button"
import type { TasksWindowHeaderProps } from "./tasks-view-types"

export function TasksWindowHeader({
  activeTab,
  busy,
  onClose,
  onOpenSettings,
  onTabChange,
  openTaskCount,
}: TasksWindowHeaderProps) {
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-5 border-b border-border pb-4"
      data-slot="tasks-window-header"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ListIcon aria-hidden="true" className="size-5 shrink-0 text-accent" />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[1.35rem] font-bold tracking-[-0.03em] text-content">
            Tasks
          </h1>
          <p className="m-0 mt-0.5 text-[0.72rem] text-muted">
            {openTaskCount} open {openTaskCount === 1 ? "task" : "tasks"}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-label="Task lists"
          className="inline-flex rounded-control border border-border bg-panel p-0.5"
          data-slot="tasks-segmented-control"
          role="tablist"
        >
          <button
            aria-selected={activeTab === "day"}
            className="min-h-7 cursor-pointer rounded-[6px] border-0 bg-transparent px-3 text-[0.75rem] font-semibold text-muted outline-none transition-colors hover:text-content aria-selected:bg-panel-hover aria-selected:text-content focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onTabChange("day")}
            role="tab"
            type="button"
          >
            Day
          </button>
          <button
            aria-selected={activeTab === "unscheduled"}
            className="min-h-7 cursor-pointer rounded-[6px] border-0 bg-transparent px-3 text-[0.75rem] font-semibold text-muted outline-none transition-colors hover:text-content aria-selected:bg-panel-hover aria-selected:text-content focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onTabChange("unscheduled")}
            role="tab"
            type="button"
          >
            Unscheduled
          </button>
        </div>
        <Button
          aria-label="Settings"
          disabled={busy}
          onClick={onOpenSettings}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <SettingsIcon aria-hidden="true" />
        </Button>
        <IconButton
          aria-label="Close Tasks"
          className="text-muted"
          disabled={busy}
          onClick={onClose}
          size="sm"
          title="Close Tasks"
          type="button"
          variant="ghost"
        >
          <CloseIcon aria-hidden="true" />
        </IconButton>
      </div>
    </header>
  )
}
