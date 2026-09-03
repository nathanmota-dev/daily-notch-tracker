import { useEffect, useState } from "react"

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"

import { reorderTaskIds } from "./expanded-dashboard-model"

export type UseTaskReorderOptions = {
  disabled?: boolean
  taskIds: readonly string[]
  onReorder: (taskIds: string[]) => void
}

export function useTaskReorder({
  disabled = false,
  onReorder,
  taskIds,
}: UseTaskReorderOptions) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (draggedTaskId && !taskIds.includes(draggedTaskId)) {
      setDraggedTaskId(null)
    }
  }, [draggedTaskId, taskIds])

  function handleDragStart(event: DragStartEvent) {
    if (!disabled) {
      setDraggedTaskId(String(event.active.id))
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const sourceTaskId = String(event.active.id)
    const targetTaskId = event.over ? String(event.over.id) : null
    setDraggedTaskId(null)

    if (!targetTaskId || disabled) {
      return
    }

    const reorderedTaskIds = reorderTaskIds(taskIds, sourceTaskId, targetTaskId)
    if (reorderedTaskIds.join("\u0000") !== taskIds.join("\u0000")) {
      onReorder(reorderedTaskIds)
    }
  }

  function handleDragCancel() {
    setDraggedTaskId(null)
  }

  return {
    draggedTaskId,
    onDragCancel: handleDragCancel,
    onDragEnd: handleDragEnd,
    onDragStart: handleDragStart,
  }
}
