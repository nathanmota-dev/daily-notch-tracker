import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core"
import type { CSSProperties, ReactNode } from "react"

export type TaskReorderSensor = SensorDescriptor<SensorOptions>

export type TaskReorderProps = {
  children: ReactNode
  disabled?: boolean
  onReorder: (taskIds: string[]) => void
  taskIds: readonly string[]
}

export type SortableTaskItem = {
  attributes: DraggableAttributes
  isDragging: boolean
  isOver: boolean
  listeners: DraggableSyntheticListeners
  setActivatorNodeRef: (element: HTMLElement | null) => void
  setNodeAndActivatorRef: (element: HTMLElement | null) => void
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
}

export type DragHandleProps = {
  attributes?: DraggableAttributes
  className?: string
  disabled?: boolean
  interactive?: boolean
  listeners?: DraggableSyntheticListeners
  setActivatorNodeRef?: (element: HTMLElement | null) => void
  taskTitle: string
}
