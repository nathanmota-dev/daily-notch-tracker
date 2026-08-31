import { ExpandIcon, ListIcon, PlusIcon } from "../icons"
import type { FocusSnapshot, Task } from "../lib/desktopApi"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { CompactTaskRow } from "./CompactTaskRow"
import { IconButton } from "./IconButton"
import { EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS } from "./expandedDashboard"

export type TodoPanelProps = {
  tasks: readonly Task[]
  focus: FocusSnapshot
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: () => void
  onOpenTasks: () => void
  onReorderStart: (taskId: string) => void
}

export function TodoPanel({
  focus,
  onAddTask,
  onOpenTasks,
  onReorderStart,
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
          onClick={onOpenTasks}
          size="sm"
          title="Open Tasks"
          type="button"
          variant="ghost"
        >
          <ExpandIcon aria-hidden="true" />
        </IconButton>
      </header>

      <ScrollArea
        aria-label="To Do tasks"
        className="todo-panel__scroll-area"
        data-overflow={hasOverflow ? "on" : "off"}
        data-visible-rows={EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS}
      >
        {tasks.length === 0 ? (
          <div
            className="todo-panel__empty"
            data-slot="todo-empty"
            role="status"
          >
            <span>No tasks yet</span>
            <span>Add your first task to get started.</span>
          </div>
        ) : (
          <div className="todo-panel__task-list">
            {tasks.map((task) => (
              <CompactTaskRow
                focus={focus}
                key={task.id}
                onReorderStart={onReorderStart}
                onToggleFocus={onToggleFocus}
                onToggleTask={onToggleTask}
                task={task}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Button
        className="todo-panel__add-button"
        data-slot="add-task"
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
