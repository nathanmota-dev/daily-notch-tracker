import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCallback } from "react"

import type { SortableTaskItem } from "./task-reorder-types"

export function useSortableTask(
  taskId: string,
  disabled = false,
): SortableTaskItem {
  const sortable = useSortable({ disabled, id: taskId })
  const { setActivatorNodeRef, setNodeRef } = sortable
  const setNodeAndActivatorRef = useCallback(
    (element: HTMLElement | null) => {
      setNodeRef(element)
      setActivatorNodeRef(element)
    },
    [setActivatorNodeRef, setNodeRef],
  )

  return {
    attributes: sortable.attributes,
    isDragging: sortable.isDragging,
    isOver: sortable.isOver,
    listeners: sortable.listeners,
    setActivatorNodeRef,
    setNodeAndActivatorRef,
    setNodeRef,
    style: {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
    },
  }
}
