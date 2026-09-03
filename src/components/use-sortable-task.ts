import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import type { SortableTaskItem } from "./task-reorder-types"

export function useSortableTask(
  taskId: string,
  disabled = false,
): SortableTaskItem {
  const sortable = useSortable({ disabled, id: taskId })

  return {
    attributes: sortable.attributes,
    isDragging: sortable.isDragging,
    isOver: sortable.isOver,
    listeners: sortable.listeners,
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    setNodeRef: sortable.setNodeRef,
    style: {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
    },
  }
}
