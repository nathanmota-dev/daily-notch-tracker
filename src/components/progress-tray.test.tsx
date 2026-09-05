import { render, screen } from "@testing-library/react"

import { ProgressTray } from "./progress-tray"
import { clampProgress } from "./progress"

describe("clampProgress", () => {
  it.each([
    { input: -0.25, expected: 0 },
    { input: 0, expected: 0 },
    { input: 0.5, expected: 0.5 },
    { input: 1, expected: 1 },
    { input: 1.25, expected: 1 },
    { input: Number.NaN, expected: 0 },
    { input: Number.POSITIVE_INFINITY, expected: 0 },
    { input: Number.NEGATIVE_INFINITY, expected: 0 },
  ])("clamps $input to $expected", ({ input, expected }) => {
    expect(clampProgress(input)).toBe(expected)
  })
})

describe("ProgressTray", () => {
  it.each([
    { progress: 0, offset: "1", percentage: "0" },
    { progress: 0.5, offset: "0.5", percentage: "50" },
    { progress: 1, offset: "0", percentage: "100" },
  ])(
    "renders a stable timeline at $percentage%",
    ({ progress, offset, percentage }) => {
      render(<ProgressTray progress={progress} />)

      const root = document.querySelector('[data-slot="progress-tray"]')
      const timeline = screen.getByRole("progressbar", {
        name: "Progresso do foco",
      })
      const fill = document.querySelector(
        '[data-slot="progress-tray-fill"]',
      )

      expect(root).toHaveAttribute("data-progress", progress.toString())
      expect(timeline).toHaveAttribute("aria-valuemin", "0")
      expect(timeline).toHaveAttribute("aria-valuemax", "100")
      expect(timeline).toHaveAttribute("aria-valuenow", percentage)
      expect(timeline).toHaveAttribute("aria-valuetext", `${percentage}%`)
      expect(timeline).toHaveAttribute("viewBox", "0 0 100 100")
      expect(timeline).toHaveClass("overflow-hidden")
      expect(fill).toHaveAttribute("pathLength", "1")
      expect(fill).toHaveAttribute("stroke-dasharray", "1")
      expect(fill).toHaveAttribute("stroke-dashoffset", offset)
    },
  )

  it("clamps the rendered value before updating the SVG fill", () => {
    render(<ProgressTray progress={4} />)

    const root = document.querySelector('[data-slot="progress-tray"]')
    const fill = document.querySelector(
      '[data-slot="progress-tray-fill"]',
    )

    expect(root).toHaveAttribute("data-progress", "1")
    expect(fill).toHaveAttribute("stroke-dashoffset", "0")
  })

  it("renders the track and fill with rounded, non-scaling geometry", () => {
    render(
      <ProgressTray className="custom-tray" progress={0.25}>
        <span>Focus content</span>
      </ProgressTray>,
    )

    const root = document.querySelector('[data-slot="progress-tray"]')
    const track = document.querySelector(
      '[data-slot="progress-tray-track"]',
    )
    const fill = document.querySelector(
      '[data-slot="progress-tray-fill"]',
    )

    expect(screen.getByText("Focus content")).toBeInTheDocument()
    expect(root).toHaveClass("relative", "custom-tray")
    expect(track).toHaveAttribute("stroke-linecap", "round")
    expect(track).toHaveAttribute("stroke-linejoin", "round")
    expect(track).toHaveAttribute("vector-effect", "non-scaling-stroke")
    expect(fill).toHaveAttribute("d", expect.stringContaining("A 24 24"))
  })

  it("uses RGB gradient and glow only when the timeline is enabled", () => {
    const { rerender } = render(
      <ProgressTray progress={0.5} rainbowTimeline />,
    )

    let root = document.querySelector('[data-slot="progress-tray"]')
    let fill = document.querySelector(
      '[data-slot="progress-tray-fill"]',
    )
    const gradient = document.querySelector("linearGradient")

    expect(root).toHaveAttribute("data-rainbow", "on")
    expect(fill).toHaveAttribute("data-rainbow", "on")
    expect(fill).toHaveClass(
      "animate-[progress-tray-rainbow_6s_linear_infinite]",
    )
    expect(fill?.getAttribute("stroke")).toMatch(
      /^url\(#progress-tray-gradient-/,
    )
    expect(gradient).toBeInTheDocument()

    rerender(
      <ProgressTray
        progress={0.5}
        rainbowTimeline
        showTimeline={false}
      />,
    )

    root = document.querySelector('[data-slot="progress-tray"]')
    fill = document.querySelector('[data-slot="progress-tray-fill"]')

    expect(root).toHaveAttribute("data-timeline", "off")
    expect(root).toHaveAttribute("data-rainbow", "off")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(document.querySelector("svg")).not.toBeInTheDocument()
    expect(fill).not.toBeInTheDocument()
  })

  it("keeps an accessible custom label", () => {
    render(
      <ProgressTray aria-label="Progresso da tarefa" progress={0.25} />,
    )

    expect(
      screen.getByRole("progressbar", { name: "Progresso da tarefa" }),
    ).toBeInTheDocument()
  })
})
