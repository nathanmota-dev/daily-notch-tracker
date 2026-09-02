import type { DragEvent } from "react"

import { IconButton } from "./icon-button"

export type DragHandleProps = {
  taskId: string
  taskTitle: string
  disabled?: boolean
  onReorderStart: (taskId: string) => void
  onReorderEnd: () => void
}

export function DragHandle({
  onReorderStart,
  onReorderEnd,
  taskId,
  taskTitle,
  disabled = false,
}: DragHandleProps) {
  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    if (disabled) {
      event.preventDefault()
      return
    }

    event.dataTransfer?.setData("text/plain", taskId)

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
    }

    onReorderStart(taskId)
  }

  return (
    <IconButton
      aria-label={"Reorder " + taskTitle}
      className="cursor-grab text-muted active:cursor-grabbing"
      data-slot="drag-handle"
      disabled={disabled}
      draggable={!disabled}
      onDragEnd={onReorderEnd}
      onDragStart={handleDragStart}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span
        aria-hidden="true"
        className="grid w-2.5 grid-cols-[repeat(2,3px)] grid-rows-[repeat(3,3px)] gap-x-[3px] gap-y-0.5"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <span
            aria-hidden="true"
            className="size-[3px] rounded-full bg-current"
            data-slot="drag-dot"
            key={"drag-dot-" + index}
          />
        ))}
      </span>
    </IconButton>
  )
}
