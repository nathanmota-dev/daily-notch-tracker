import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { SurfaceRouter } from "./app/surfaceRouter"
import {
  createCollapsedWidgetFixtureSnapshot,
  createMockDesktopApi,
  resolveCollapsedWidgetFixture,
} from "./lib/desktopApi"
import "./styles/index.css"

const developmentFixture = import.meta.env.DEV
  ? resolveCollapsedWidgetFixture(
      window.location.search,
      import.meta.env.VITE_WIDGET_FIXTURE,
    )
  : null
const fixtureApi = developmentFixture
  ? createMockDesktopApi({
      snapshot: createCollapsedWidgetFixtureSnapshot(developmentFixture),
    }).api
  : undefined

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SurfaceRouter api={fixtureApi} />
  </StrictMode>,
)
