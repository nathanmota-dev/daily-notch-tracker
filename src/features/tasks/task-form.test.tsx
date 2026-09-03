import { createRef, useRef, useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createEmptyTaskDraft,
  type TaskDraft,
  type TaskDraftErrors,
} from "./tasks-model"
import { TaskForm, type TaskFormProps } from "./task-form"

function FormHarness({
  errors = {},
  initialDraft = createEmptyTaskDraft("2026-09-02"),
  ...props
}: Partial<TaskFormProps> & {
  errors?: TaskDraftErrors
  initialDraft?: TaskDraft
}) {
  const [draft, setDraft] = useState(initialDraft)
  const titleRef = useRef<HTMLInputElement>(null)

  return (
    <TaskForm
      busy={false}
      draft={draft}
      errors={errors}
      mode="create"
      onCancel={vi.fn()}
      onChange={(field, value) =>
        setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
      }
      onSubmit={vi.fn()}
      titleRef={titleRef}
      {...props}
    />
  )
}

describe("TaskForm", () => {
  it("renders fields, limits, counters, and focuses the title", () => {
    const titleRef = createRef<HTMLInputElement>()

    render(
      <TaskForm
        busy={false}
        draft={createEmptyTaskDraft("2026-09-02")}
        errors={{}}
        mode="create"
        onCancel={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        titleRef={titleRef}
      />,
    )

    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveFocus()
    expect(screen.getByLabelText("Title")).toHaveAttribute("maxLength", "150")
    expect(screen.getByLabelText("Notes")).toHaveAttribute("maxLength", "500")
    expect(screen.getByText("0 / 150")).toBeInTheDocument()
    expect(screen.getByText("0 / 500")).toBeInTheDocument()
    expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(25)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-09-02")
  })

  it("uses presets and one-minute controls while preserving typed text", async () => {
    const user = userEvent.setup()
    render(<FormHarness />)

    const duration = screen.getByRole("spinbutton", {
      name: "Duration (minutes)",
    })
    await user.click(screen.getByRole("button", { name: "50 min" }))
    expect(duration).toHaveValue(50)

    await user.click(screen.getByRole("button", { name: "Aumentar tempo de foco" }))
    expect(duration).toHaveValue(51)
    await user.click(screen.getByRole("button", { name: "Reduzir tempo de foco" }))
    expect(duration).toHaveValue(50)

    await user.clear(duration)
    await user.type(duration, "181")
    expect(duration).toHaveValue(181)
  })

  it("counts Unicode text and exposes external field errors accessibly", async () => {
    const user = userEvent.setup()
    render(
      <FormHarness
        errors={{ estimateMinutes: "Duration must be between 1 and 180 minutes." }}
      />,
    )

    await user.type(screen.getByLabelText("Title"), "🙂é")
    await user.type(screen.getByLabelText("Notes"), "界")

    expect(screen.getByText("2 / 150")).toBeInTheDocument()
    expect(screen.getByText("1 / 500")).toBeInTheDocument()

    const duration = screen.getByRole("spinbutton", {
      name: "Duration (minutes)",
    })
    expect(duration).toHaveAttribute("aria-invalid", "true")
    expect(duration).toHaveAttribute("aria-describedby", "task-duration-error")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Duration must be between 1 and 180 minutes.",
    )
  })

  it("uses Add for creation and invokes submit and cancel actions", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSubmit = vi.fn()

    render(
      <TaskForm
        busy={false}
        draft={{ ...createEmptyTaskDraft(), title: "Task" }}
        errors={{}}
        mode="create"
        onCancel={onCancel}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        titleRef={createRef<HTMLInputElement>()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Add task" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("renders edit-only controls and uses Save for existing tasks", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onDelete = vi.fn()
    const onDoneChange = vi.fn()

    render(
      <TaskForm
        busy={false}
        draft={{
          ...createEmptyTaskDraft(),
          id: "task-1",
          title: "Existing task",
        }}
        errors={{}}
        mode="edit"
        onCancel={onCancel}
        onChange={vi.fn()}
        onDelete={onDelete}
        onDoneChange={onDoneChange}
        onSubmit={vi.fn()}
        titleRef={createRef<HTMLInputElement>()}
      />,
    )

    expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument()
    expect(screen.queryByText("Task details")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Start focus for Existing task" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Back to list" })).toHaveAttribute(
      "title",
      "Back to list",
    )
    expect(screen.getByRole("button", { name: "Save task" })).toBeInTheDocument()
    await user.click(
      screen.getByRole("checkbox", { name: /Mark task as complete/ }),
    )
    await user.click(screen.getByRole("button", { name: "Delete task" }))
    await user.click(screen.getByRole("button", { name: "Back to list" }))

    expect(onDoneChange).toHaveBeenCalledWith(true)
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
