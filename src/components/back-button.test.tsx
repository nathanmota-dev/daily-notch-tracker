import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { BackButton } from "./back-button"

describe("BackButton", () => {
  it("renders a reusable labelled button and invokes its action", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <BackButton
        ariaLabel="Back to tasks"
        onClick={onClick}
        title="Back to tasks"
      />,
    )

    const button = screen.getByRole("button", { name: "Back to tasks" })
    expect(button).toHaveAttribute("data-slot", "back-button")
    expect(button).toHaveAttribute("title", "Back to tasks")

    await user.click(button)

    expect(onClick).toHaveBeenCalledOnce()
  })
})
