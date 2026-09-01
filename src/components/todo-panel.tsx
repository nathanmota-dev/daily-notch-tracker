import { useState, type DragEvent } from "react"

import { ExpandIcon, ListIcon, PlusIcon } from "../icons"
import type { DesktopApiError, FocusSnapshot, Task } from "../lib/desktopApi"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { CompactTaskRow } from "./compact-task-row"
import { IconButton } from "./icon-button"
import {
  EXPANDED_DASHBOARD_MAX_VISIBLE_ROWS,
  reorderTaskIds,
} from "./expanded-dashboard-model"

export type TodoPanelProps = {
  tasks: readonly Task[]
  focus: FocusSnapshot
  onToggleTask: (taskId: string, isDone: boolean) => void
  onToggleFocus: (taskId: string) => void
  onAddTask: () => void
  onOpenTasks: () => void
  onOpenTask: (taskId: string) => void
  onReorder: (taskIds: string[]) => void
  dashboardError?: DesktopApiError | null
}

type TodoTaskListProps = Pick<
  TodoPanelProps,
  | "focus"
  | "onOpenTask"
  | "onReorder"
  | "onToggleFocus"
  | "onToggleTask"
  | "tasks"
>

function TodoTaskList({
  focus,
  onOpenTask,
  onReorder,
  onToggleFocus,
  onToggleTask,
  tasks,
}: TodoTaskListProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const taskIds = tasks.map((task) => task.id)

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move"
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetTaskId: string) {
    event.preventDefault()
    const sourceTaskId = event.dataTransfer?.getData("text/plain") || draggedTaskId
    setDraggedTaskId(null)

    if (!sourceTaskId) {
      return
    }

    const reorderedIds = reorderTaskIds(
      taskIds,
      sourceTaskId,
      targetTaskId,
    )

    if (reorderedIds.join("\u0000") !== taskIds.join("\u0000")) {
      onReorder(reorderedIds)
    }
  }

  return (
    <div className="todo-panel__task-list">
      {tasks.map((task) => (
        <CompactTaskRow
          focus={focus}
          key={task.id}
          onDragEnd={() => setDraggedTaskId(null)}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(event, task.id)}
          onOpenTask={onOpenTask}
          onReorderStart={setDraggedTaskId}
          onToggleFocus={onToggleFocus}
          onToggleTask={onToggleTask}
          task={task}
        />
      ))}
    </div>
  )
}

export function TodoPanel({
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
            onClick={onAddTask}
            type="button"
          >
            <span>No tasks yet</span>
            <span>Add your first task to get started.</span>
          </button>
        ) : (
          <TodoTaskList
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
