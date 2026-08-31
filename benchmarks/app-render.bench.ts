import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { bench, describe } from "vitest"

import { App } from "../src/app/App"

const benchmarkOptions = {
  time: 1_000,
  iterations: 20,
  warmupTime: 250,
  warmupIterations: 10,
}

describe("app render", () => {
  bench("starter screen to static markup", () => {
    renderToStaticMarkup(createElement(App))
  }, benchmarkOptions)
})
