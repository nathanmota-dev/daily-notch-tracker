import { render, screen } from "@testing-library/react"

import { App } from "./App"

describe("App", () => {
  it("renders the DailyNotch starter screen", () => {
    render(<App />)

    expect(screen.getByText("DailyNotch Linux")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Verificar a fundação" })).toBeInTheDocument()
  })
})
