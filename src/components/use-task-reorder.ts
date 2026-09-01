import { useState, type DragEvent } from "react"

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

    if (!sourceTaskId || disabled) {
      return
    }

    const reorderedTaskIds = reorderTaskIds(taskIds, sourceTaskId, targetTaskId)
    if (reorderedTaskIds.join("\u0000") !== taskIds.join("\u0000")) {
      onReorder(reorderedTaskIds)
    }
  }

  return {
    handleDragOver,
    handleDrop,
    onReorderEnd: () => setDraggedTaskId(null),
    onReorderStart: setDraggedTaskId,
  }
}
