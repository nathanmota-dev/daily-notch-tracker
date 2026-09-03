import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { FocusSessionPicker } from "./focus-session-picker"

function PickerHarness() {
  const [open, setOpen] = useState(true)
  const [confirmedDuration, setConfirmedDuration] = useState<number | null>(null)

  return (
    <>
      <FocusSessionPicker
        initialDurationSeconds={1_530}
        onCancel={() => setOpen(false)}
        onConfirm={(durationSeconds) => {
          setConfirmedDuration(durationSeconds)
          setOpen(false)
        }}
        open={open}
        taskTitle="Write docs"
      />
      <output data-testid="confirmed-duration">
        {confirmedDuration ?? ""}
      </output>
    </>
  )
}

describe("FocusSessionPicker", () => {
  it("shows the task estimate and supports keyboard stepping and confirmation", async () => {
    const user = userEvent.setup()
    render(<PickerHarness />)

    expect(
      screen.getByRole("dialog", { name: "Focus session for Write docs" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Focus minutes")).toHaveValue("25")
    expect(screen.getByLabelText("Focus seconds")).toHaveValue("30")

    await user.click(screen.getByLabelText("Focus seconds"))
    await user.keyboard("{ArrowUp}")
    expect(screen.getByLabelText("Focus seconds")).toHaveValue("31")
    await user.keyboard("{ArrowDown}")
    expect(screen.getByLabelText("Focus seconds")).toHaveValue("30")

    await user.click(screen.getByRole("button", { name: "Increase minutes" }))
    expect(screen.getByLabelText("Focus minutes")).toHaveValue("26")
    await user.click(screen.getByRole("button", { name: "Decrease minutes" }))
    expect(screen.getByLabelText("Focus minutes")).toHaveValue("25")

    await user.clear(screen.getByLabelText("Focus minutes"))
    await user.type(screen.getByLabelText("Focus minutes"), "5")
    await user.clear(screen.getByLabelText("Focus seconds"))
    await user.type(screen.getByLabelText("Focus seconds"), "45")
    await user.keyboard("{Enter}")

    await waitFor(() =>
      expect(screen.getByTestId("confirmed-duration")).toHaveTextContent("345"),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("reports invalid zero durations and closes on outside click or Escape", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()

    render(
      <FocusSessionPicker
        initialDurationSeconds={1_500}
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        taskTitle="Write docs"
      />,
    )

    await user.clear(screen.getByLabelText("Focus minutes"))
    await user.type(screen.getByLabelText("Focus minutes"), "0")
    await user.clear(screen.getByLabelText("Focus seconds"))
    await user.type(screen.getByLabelText("Focus seconds"), "0")

    expect(screen.getByRole("alert")).toHaveTextContent(
      "between 00:01 and 180:00",
    )
    expect(screen.getByRole("button", { name: "Start focus" })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.pointerDown(document.body)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("cancels when Escape is pressed", () => {
    const onCancel = vi.fn()

    render(
      <FocusSessionPicker
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open
        taskTitle="Write docs"
      />,
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("renders server errors and disables controls while busy", async () => {
    const onCancel = vi.fn()
    render(
      <FocusSessionPicker
        busy
        error="The focus service is unavailable."
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open
        taskTitle={null}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The focus service is unavailable.",
    )
    expect(screen.getByLabelText("Focus minutes")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Start focus" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Cancel focus session" }),
    )
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
