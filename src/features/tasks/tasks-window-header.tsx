import { CloseIcon, ListIcon } from "../../icons"
import { IconButton } from "../../components/icon-button"
import type { TasksWindowHeaderProps } from "./tasks-view-types"

export function TasksWindowHeader({
  busy,
  onClose,
  openTaskCount,
}: TasksWindowHeaderProps) {
  return (
    <header
      className="flex min-h-7 shrink-0 items-center justify-between gap-3"
      data-slot="tasks-window-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ListIcon aria-hidden="true" className="size-4 shrink-0 text-content" />
        <h1 className="m-0 truncate text-[1rem] font-semibold leading-none tracking-[-0.02em] text-content">
          Tasks
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <span
          aria-label={`${openTaskCount} open ${openTaskCount === 1 ? "task" : "tasks"}`}
          className="text-[0.68rem] text-muted"
          data-slot="tasks-open-count"
        >
          {openTaskCount} open
        </span>
        <IconButton
          aria-label="Close Tasks"
          className="size-7 rounded-full bg-panel-hover p-0 text-muted hover:bg-white/[0.12] hover:text-content"
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
