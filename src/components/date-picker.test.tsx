import { render, screen } from "@testing-library/react"
import { useState } from "react"

import { DatePicker } from "./date-picker"

function DatePickerHarness() {
  const [value, setValue] = useState("2026-09-02")

  return (
    <>
      <label htmlFor="date-picker">Date</label>
      <DatePicker id="date-picker" onValueChange={setValue} value={value} />
    </>
  )
}

describe("DatePicker", () => {
  it("formats its ISO value in the trigger", () => {
    render(<DatePickerHarness />)

    const trigger = screen.getByLabelText("Date")
    expect(trigger).toHaveAttribute("data-value", "2026-09-02")
    expect(trigger).toHaveTextContent("September 2nd, 2026")
  })
})
