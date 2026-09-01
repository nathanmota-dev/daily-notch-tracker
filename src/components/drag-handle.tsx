import type { DragEvent } from "react"

import { IconButton } from "./icon-button"

export type DragHandleProps = {
  taskId: string
  taskTitle: string
  onReorderStart: (taskId: string) => void
  onReorderEnd: () => void
}

export function DragHandle({
  onReorderStart,
  onReorderEnd,
  taskId,
  taskTitle,
}: DragHandleProps) {
  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    event.dataTransfer?.setData("text/plain", taskId)

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
    }

    onReorderStart(taskId)
  }

  return (
    <IconButton
      aria-label={"Reorder " + taskTitle}
      className="expanded-task-row__drag-handle"
      data-slot="drag-handle"
      draggable
      onDragEnd={onReorderEnd}
      onDragStart={handleDragStart}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span
        aria-hidden="true"
        className="expanded-task-row__drag-dots"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <span
            aria-hidden="true"
            className="expanded-task-row__drag-dot"
            data-slot="drag-dot"
            key={"drag-dot-" + index}
          />
        ))}
      </span>
    </IconButton>
  )
}
