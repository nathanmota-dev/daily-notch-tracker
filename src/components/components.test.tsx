import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { vi } from "vitest"

import { Divider } from "@/components/Divider"
import {
  FocusTimePicker,
  type FocusTimePickerProps,
} from "@/components/FocusTimePicker"
import { IconButton } from "@/components/IconButton"
import { Panel } from "@/components/Panel"
import { Toggle } from "@/components/Toggle"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ClockIcon, SettingsIcon } from "@/icons"

function FocusTimePickerHarness({
  initialValue = 25,
  ...props
}: Partial<FocusTimePickerProps> & { initialValue?: number }) {
  const [value, setValue] = useState(initialValue)

  return (
    <FocusTimePicker
      id="focus-time"
      presets={[15, 25, 50]}
      value={value}
      onValueChange={setValue}
      {...props}
    />
  )
}

function CheckboxHarness({ disabled = false }: { disabled?: boolean }) {
  const [checked, setChecked] = useState(false)

  return (
    <Checkbox
      aria-label="Concluir tarefa"
      checked={checked}
      disabled={disabled}
      onCheckedChange={setChecked}
    />
  )
}

function ToggleHarness({ disabled = false }: { disabled?: boolean }) {
  const [checked, setChecked] = useState(false)

  return (
    <Toggle
      aria-label="Mostrar timeline"
      checked={checked}
      disabled={disabled}
      onCheckedChange={setChecked}
    />
  )
}

describe("UI primitives", () => {
  it("renders button variants and disabled state", () => {
    const { rerender } = render(<Button>Salvar</Button>)
    const button = screen.getByRole("button", { name: "Salvar" })

    expect(button).toHaveClass("bg-accent")
    expect(button).not.toBeDisabled()

    rerender(
      <Button disabled variant="destructive">
        Remover
      </Button>,
    )

    expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remover" })).toHaveClass(
      "bg-danger/10",
    )
  })

  it("requires and exposes an accessible IconButton label", () => {
    render(
      <IconButton aria-label="Abrir configurações">
        <SettingsIcon aria-hidden="true" />
      </IconButton>,
    )

    const button = screen.getByRole("button", {
      name: "Abrir configurações",
    })

    expect(button).toHaveAttribute("aria-label", "Abrir configurações")
    expect(button.querySelector("svg")).toBeInTheDocument()
  })

  it("renders normal and danger Panel variants", () => {
    render(
      <>
        <Panel>Normal</Panel>
        <Panel variant="danger">Perigo</Panel>
      </>,
    )

    expect(screen.getByText("Normal").closest("[data-slot=card]")).toHaveAttribute(
      "data-variant",
      "default",
    )
    expect(screen.getByText("Perigo").closest("[data-slot=card]")).toHaveClass(
      "bg-danger/5",
    )
  })

  it("supports checked, unchecked, and disabled Checkbox states", async () => {
    const user = userEvent.setup()
    render(
      <>
        <CheckboxHarness />
        <CheckboxHarness disabled />
      </>,
    )

    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes[0]).toHaveAttribute("aria-checked", "false")
    expect(checkboxes[0]).toHaveAttribute("tabindex", "0")
    expect(checkboxes[1]).toHaveAttribute("aria-disabled", "true")

    await user.click(checkboxes[0])

    expect(checkboxes[0]).toHaveAttribute("aria-checked", "true")

    checkboxes[0].focus()
    await user.keyboard(" ")

    expect(checkboxes[0]).toHaveAttribute("aria-checked", "false")
  })

  it("preserves Divider orientation and separator semantics", () => {
    const { rerender } = render(<Divider />)
    expect(screen.getByRole("separator")).toHaveAttribute(
      "data-orientation",
      "horizontal",
    )

    rerender(<Divider orientation="vertical" />)
    expect(screen.getByRole("separator")).toHaveAttribute(
      "data-orientation",
      "vertical",
    )
  })

  it("keeps ScrollArea content available to the keyboard", async () => {
    render(
      <ScrollArea className="h-24 w-48">
        <div className="h-96">Conteúdo rolável</div>
      </ScrollArea>,
    )

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]',
    )

    expect(screen.getByText("Conteúdo rolável")).toBeInTheDocument()
    await waitFor(() => expect(viewport).toHaveAttribute("tabindex", "0"))
  })

  it("controls Toggle through checked and onCheckedChange", async () => {
    const user = userEvent.setup()
    render(<ToggleHarness />)

    const toggle = screen.getByRole("switch", { name: "Mostrar timeline" })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(toggle).toHaveAttribute("tabindex", "0")

    await user.click(toggle)

    expect(toggle).toHaveAttribute("aria-checked", "true")
  })

  it("exposes the disabled Toggle state accessibly", () => {
    render(<ToggleHarness disabled />)

    expect(screen.getByRole("switch", { name: "Mostrar timeline" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("renders inline SVG icons from the semantic registry", () => {
    render(<ClockIcon aria-label="Relógio" data-testid="clock-icon" />)

    expect(screen.getByTestId("clock-icon").tagName).toBe("svg")
  })
})

describe("FocusTimePicker", () => {
  it("supports presets and one-minute increments", async () => {
    const user = userEvent.setup()
    render(<FocusTimePickerHarness />)

    const input = screen.getByRole("spinbutton", { name: "Tempo de foco" })
    expect(input).toHaveValue(25)

    await user.click(
      screen.getByRole("button", { name: "Aumentar tempo de foco" }),
    )
    expect(input).toHaveValue(26)

    await user.click(screen.getByRole("button", { name: "50 min" }))
    expect(input).toHaveValue(50)

    await user.click(
      screen.getByRole("button", { name: "Reduzir tempo de foco" }),
    )
    expect(input).toHaveValue(49)
  })

  it("disables the stepper at the default limits", () => {
    const onValueChange = vi.fn()
    const { rerender } = render(
      <FocusTimePicker
        id="focus-time"
        presets={[15, 25, 50]}
        value={1}
        onValueChange={onValueChange}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Reduzir tempo de foco" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Aumentar tempo de foco" }),
    ).not.toBeDisabled()

    rerender(
      <FocusTimePicker
        id="focus-time"
        presets={[15, 25, 50]}
        value={180}
        onValueChange={onValueChange}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Aumentar tempo de foco" }),
    ).toBeDisabled()
  })

  it("shows visual validation for values outside the limits", () => {
    render(<FocusTimePickerHarness initialValue={0} />)

    expect(screen.getByRole("spinbutton")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 e 180")
  })

  it("supports the disabled state for input, presets, and controls", () => {
    render(<FocusTimePickerHarness disabled />)

    expect(screen.getByRole("spinbutton")).toBeDisabled()
    expect(screen.getByRole("button", { name: "15 min" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Aumentar tempo de foco" }),
    ).toBeDisabled()
  })

  it("notifies callers when the value is changed from the field", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <FocusTimePicker
        id="focus-time"
        label="Duração"
        presets={[]}
        value={25}
        onValueChange={onValueChange}
      />,
    )

    const input = screen.getByRole("spinbutton", { name: "Duração" })
    await user.clear(input)
    await user.type(input, "30")

    expect(onValueChange).toHaveBeenLastCalledWith(30)
  })
})
