import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type Announcements,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

import { useTaskReorder } from "./use-task-reorder"
import type { TaskReorderProps, TaskReorderSensor } from "./task-reorder-types"

const taskReorderAnnouncements: Announcements = {
  onDragCancel({ active }) {
    return `Dragging task ${active.id} was cancelled.`
  },
  onDragEnd({ active, over }) {
    return over
      ? `Task ${active.id} was dropped after task ${over.id}.`
      : `Task ${active.id} was dropped.`
  },
  onDragOver({ active, over }) {
    return over
      ? `Task ${active.id} is over task ${over.id}.`
      : `Task ${active.id} is no longer over a task.`
  },
  onDragStart({ active }) {
    return `Picked up task ${active.id}. Use the arrow keys to move it, Space to drop, or Escape to cancel.`
  },
}

const taskReorderScreenReaderInstructions = {
  draggable:
    "To pick up a task, press Space. While dragging, use the arrow keys to move the task. Press Space again to drop it, or press Escape to cancel.",
}

export function TaskReorder({
  children,
  disabled = false,
  onReorder,
  taskIds,
}: TaskReorderProps) {
  const sensors: TaskReorderSensor[] = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const taskReorder = useTaskReorder({ disabled, onReorder, taskIds })

  return (
    <DndContext
      accessibility={{
        announcements: taskReorderAnnouncements,
        screenReaderInstructions: taskReorderScreenReaderInstructions,
      }}
      collisionDetection={closestCenter}
      onDragCancel={taskReorder.onDragCancel}
      onDragEnd={taskReorder.onDragEnd}
      onDragStart={taskReorder.onDragStart}
      sensors={sensors}
    >
      <SortableContext
        disabled={disabled}
        items={[...taskIds]}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  )
}
