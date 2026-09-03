import { ExpandIcon, ListIcon, PlusIcon } from "../icons"
import type { DesktopApiError, FocusSnapshot, Task } from "../lib/desktopApi"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { CompactTaskRow } from "./compact-task-row"
import { IconButton } from "./icon-button"
import { EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS } from "./expanded-dashboard-model"
import { TaskReorder } from "./task-reorder"

export type TodoPanelProps = {
  tasks: readonly Task[]
  focus: FocusSnapshot
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: () => void
  onOpenTasks: () => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
  busy?: boolean
  dashboardError?: DesktopApiError | null
}

type TodoTaskListProps = Pick<
  TodoPanelProps,
  | "focus"
  | "busy"
  | "onOpenTask"
  | "onReorder"
  | "onToggleFocus"
  | "onToggleTask"
  | "tasks"
>

function TodoTaskList({
  busy = false,
  focus,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TodoTaskListProps) {
  const taskIds = tasks.map((task) => task.id)

  return (
    <TaskReorder disabled={busy} onReorder={onReorder} taskIds={taskIds}>
      <div className="grid min-w-0 gap-[var(--expanded-task-row-gap)]">
        {tasks.map((task) => (
          <CompactTaskRow
            busy={busy}
            focus={focus}
            key={task.id}
            onOpenTask={onOpenTask}
            onToggleFocus={onToggleFocus}
            onToggleTask={onToggleTask}
            task={task}
          />
        ))}
      </div>
    </TaskReorder>
  )
}

type TodoPanelTaskContentProps = Pick<
  TodoPanelProps,
  | "focus"
  | "onAddTask"
  | "onOpenTask"
  | "onReorder"
  | "onToggleFocus"
  | "onToggleTask"
  | "tasks"
> & {
  busy: boolean
  hasOverflow: boolean
}

function TodoPanelTaskContent({
  busy,
  focus,
  hasOverflow,
  onAddTask,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TodoPanelTaskContentProps) {
  return (
    <ScrollArea
      aria-label="To Do tasks"
      className={
        "mt-2 h-[calc((var(--expanded-task-row-height)*2)+var(--expanded-task-row-gap))] max-h-[calc((var(--expanded-task-row-height)*2)+var(--expanded-task-row-gap))] min-h-0 flex-[0_1_auto] [&_[data-slot=scroll-area-viewport]]:[scrollbar-width:none] [&_[data-slot=scroll-area-viewport]::-webkit-scrollbar]:hidden [&_[data-slot=scroll-area-scrollbar]]:hidden"
      }
      data-overflow={hasOverflow ? "on" : "off"}
      data-visible-rows={EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS}
    >
      {tasks.length === 0 ? (
        <button
          aria-label="Add your first task"
          className="flex h-full min-h-[76px] w-full cursor-pointer flex-col items-start justify-center gap-[3px] border-0 bg-transparent p-0 text-left text-[0.76rem] text-muted outline-none focus-visible:rounded-control focus-visible:shadow-[0_0_0_2px_var(--ring)]"
          data-slot="todo-empty"
          disabled={busy}
          onClick={onAddTask}
          type="button"
        >
          <span className="font-semibold text-content">No tasks yet</span>
          <span className="text-[0.68rem]">
            Add your first task to get started.
          </span>
        </button>
      ) : (
        <TodoTaskList
          busy={busy}
          focus={focus}
          onOpenTask={onOpenTask}
          onReorder={onReorder}
          onToggleFocus={onToggleFocus}
          onToggleTask={onToggleTask}
          tasks={tasks}
        />
      )}
    </ScrollArea>
  )
}

export function TodoPanel({
  busy = false,
  focus,
  dashboardError = null,
  onAddTask,
  onOpenTask,
  onOpenTasks,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TodoPanelProps) {
  const hasOverflow = tasks.length > EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS

  return (
    <section
      aria-labelledby="expanded-dashboard-todo-title"
      className="flex min-h-0 min-w-0 flex-col"
      data-slot="todo-panel"
    >
      <header className="flex min-h-7 items-center justify-between gap-3">
        <div className="inline-flex min-w-0 items-center gap-2">
          <ListIcon
            aria-hidden="true"
            className="size-[15px] shrink-0 text-accent"
          />
          <h2
            className="m-0 text-[0.95rem] font-[650] leading-[1.2] tracking-[-0.01em] text-content"
            id="expanded-dashboard-todo-title"
          >
            To Do
          </h2>
          <span className="inline-flex min-w-5 items-center justify-center rounded-pill bg-white/[0.08] text-[0.68rem] leading-5 text-muted">
            {tasks.length}
          </span>
        </div>
        <IconButton
          aria-label="Open Tasks"
          className="text-muted"
          data-slot="open-tasks"
          disabled={busy}
          onClick={onOpenTasks}
          size="sm"
          title="Open Tasks"
          type="button"
          variant="ghost"
        >
          <ExpandIcon aria-hidden="true" />
        </IconButton>
      </header>

      {dashboardError && (
        <p
          className="m-0 mt-1.5 text-[0.67rem] leading-[1.25] text-danger"
          data-slot="dashboard-error"
          role="alert"
        >
          Could not update the dashboard. Code: {dashboardError.code}.
        </p>
      )}

      <TodoPanelTaskContent
        busy={busy}
        focus={focus}
        hasOverflow={hasOverflow}
        onAddTask={onAddTask}
        onOpenTask={onOpenTask}
        onReorder={onReorder}
        onToggleFocus={onToggleFocus}
        onToggleTask={onToggleTask}
        tasks={tasks}
      />

      <Button
        className="mt-[5px] min-h-7 w-fit justify-start gap-1.5 px-2 text-[0.75rem] text-accent [&_svg]:size-3.5"
        data-slot="add-task"
        disabled={busy}
        onClick={onAddTask}
        type="button"
        variant="ghost"
      >
        <PlusIcon aria-hidden="true" />
        Add a task
      </Button>
    </section>
  )
}
