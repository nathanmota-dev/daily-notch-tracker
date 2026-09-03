import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { vi } from "vitest"

import {
  finishPointerTaskDrag,
  mockSortableRects,
  movePointerTaskDrag,
  pressSortableKey,
  startPointerTaskDrag,
} from "../test/task-reorder-helpers"
import { DragHandle } from "./drag-handle"
import { TaskReorder } from "./task-reorder"
import { useSortableTask } from "./use-sortable-task"

type ReorderHarnessProps = {
  disabled?: boolean
  onReorder?: (taskIds: string[]) => void
}

function SortableTestRow({
  disabled,
  taskId,
}: {
  disabled: boolean
  taskId: string
}) {
  const sortable = useSortableTask(taskId, disabled)

  return (
    <article
      data-dragging={sortable.isDragging ? "true" : "false"}
      data-over={sortable.isOver ? "true" : "false"}
      data-task-id={taskId}
      ref={sortable.setNodeRef}
      style={sortable.style}
    >
      <DragHandle
        attributes={sortable.attributes}
        disabled={disabled}
        listeners={sortable.listeners}
        setActivatorNodeRef={sortable.setActivatorNodeRef}
        taskTitle={taskId}
      />
    </article>
  )
}

function ReorderHarness({
  disabled = false,
  onReorder = vi.fn(),
}: ReorderHarnessProps) {
  const [taskIds, setTaskIds] = useState(["first", "second", "third"])

  return (
    <TaskReorder
      disabled={disabled}
      onReorder={(nextTaskIds) => {
        onReorder(nextTaskIds)
        setTaskIds(nextTaskIds)
      }}
      taskIds={taskIds}
    >
      <div>
        {taskIds.map((taskId) => (
          <SortableTestRow disabled={disabled} key={taskId} taskId={taskId} />
        ))}
      </div>
    </TaskReorder>
  )
}

describe("TaskReorder", () => {
  it("reorders with a pointer from the handle and highlights the active item", async () => {
    const onReorder = vi.fn()
    render(<ReorderHarness onReorder={onReorder} />)
    mockSortableRects()

    const source = screen.getByRole("button", { name: "Reorder first" })
    startPointerTaskDrag(source)

    await waitFor(() =>
      expect(document.querySelector('[data-task-id="first"]')).toHaveAttribute(
        "data-dragging",
        "true",
      ),
    )

    movePointerTaskDrag(100)
    await waitFor(() =>
      expect(document.querySelector('[data-task-id="third"]')).toHaveAttribute(
        "data-over",
        "true",
      ),
    )
    await finishPointerTaskDrag()

    await waitFor(() =>
      expect(onReorder).toHaveBeenCalledWith(["second", "third", "first"]),
    )
    expect(document.querySelector('[data-task-id="first"]')).toHaveAttribute(
      "data-dragging",
      "false",
    )
  })

  it("reorders with the keyboard and exposes sortable instructions", async () => {
    const onReorder = vi.fn()
    render(<ReorderHarness onReorder={onReorder} />)
    mockSortableRects()
    const source = screen.getByRole("button", { name: "Reorder first" })

    expect(source).toHaveAttribute("aria-roledescription", "sortable")
    expect(source).toHaveAttribute("aria-describedby")

    source.focus()
    await pressSortableKey(source, "Space", " ")
    await pressSortableKey(source, "ArrowDown")
    await pressSortableKey(source, "Space", " ")

    await waitFor(() =>
      expect(onReorder).toHaveBeenCalledWith(["second", "first", "third"]),
    )
  })

  it("cancels a drag without changing order and ignores a busy list", async () => {
    const onReorder = vi.fn()
    const { rerender } = render(<ReorderHarness onReorder={onReorder} />)
    mockSortableRects()
    const user = userEvent.setup()
    const source = screen.getByRole("button", { name: "Reorder first" })

    startPointerTaskDrag(source)
    await waitFor(() =>
      expect(document.querySelector('[data-task-id="first"]')).toHaveAttribute(
        "data-dragging",
        "true",
      ),
    )
    await user.keyboard("{Escape}")

    expect(onReorder).not.toHaveBeenCalled()
    expect(
      Array.from(document.querySelectorAll("[data-task-id]")).map((row) =>
        row.getAttribute("data-task-id"),
      ),
    ).toEqual(["first", "second", "third"])

    rerender(<ReorderHarness disabled onReorder={onReorder} />)
    expect(screen.getByRole("button", { name: "Reorder first" })).toBeDisabled()
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reorder first" }))
    fireEvent.pointerMove(document, { clientX: 20, clientY: 100, buttons: 1 })
    fireEvent.pointerUp(document)

    expect(onReorder).not.toHaveBeenCalled()
  })
})
