import { cn } from "../lib/utils"
import { IconButton } from "./icon-button"
import type { DragHandleProps } from "./task-reorder-types"

export type { DragHandleProps } from "./task-reorder-types"

export function DragHandle({
  attributes,
  className,
  disabled = false,
  listeners,
  setActivatorNodeRef,
  taskTitle,
}: DragHandleProps) {
  return (
    <IconButton
      {...attributes}
      aria-label={"Reorder " + taskTitle}
      className={cn(
        "cursor-grab text-muted active:cursor-grabbing",
        className,
      )}
      data-slot="drag-handle"
      disabled={disabled}
      ref={setActivatorNodeRef}
      size="sm"
      type="button"
      variant="ghost"
      {...listeners}
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
