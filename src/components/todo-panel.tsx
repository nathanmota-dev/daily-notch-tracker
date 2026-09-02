import { ExpandIcon, ListIcon, PlusIcon } from "../icons"
import type { DesktopApiError, FocusSnapshot, Task } from "../lib/desktopApi"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { CompactTaskRow } from "./compact-task-row"
import { IconButton } from "./icon-button"
import { EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS } from "./expanded-dashboard-model"
import { useTaskReorder } from "./use-task-reorder"

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
  const taskReorder = useTaskReorder({ disabled: busy, onReorder, taskIds })

  return (
    <div className="todo-panel__task-list">
      {tasks.map((task) => (
        <CompactTaskRow
          busy={busy}
          focus={focus}
          key={task.id}
          onDragEnd={taskReorder.onReorderEnd}
          onDragOver={taskReorder.handleDragOver}
          onDrop={(event) => taskReorder.handleDrop(event, task.id)}
          onOpenTask={onOpenTask}
          onReorderStart={taskReorder.onReorderStart}
          onToggleFocus={onToggleFocus}
          onToggleTask={onToggleTask}
          task={task}
        />
      ))}
    </div>
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
      className="todo-panel"
      data-slot="todo-panel"
    >
      <header className="todo-panel__header">
        <div className="todo-panel__heading">
          <ListIcon aria-hidden="true" className="todo-panel__heading-icon" />
          <h2 id="expanded-dashboard-todo-title">To Do</h2>
          <span className="todo-panel__count">{tasks.length}</span>
        </div>
        <IconButton
          aria-label="Open Tasks"
          className="todo-panel__open-button"
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
        <p className="todo-panel__error" data-slot="dashboard-error" role="alert">
          Could not update the dashboard. Code: {dashboardError.code}.
        </p>
      )}

      <ScrollArea
        aria-label="To Do tasks"
        className="todo-panel__scroll-area"
        data-overflow={hasOverflow ? "on" : "off"}
        data-visible-rows={EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS}
      >
        {tasks.length === 0 ? (
          <button
            aria-label="Add your first task"
            className="todo-panel__empty"
            data-slot="todo-empty"
            disabled={busy}
            onClick={onAddTask}
            type="button"
          >
            <span>No tasks yet</span>
            <span>Add your first task to get started.</span>
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

      <Button
        className="todo-panel__add-button"
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
