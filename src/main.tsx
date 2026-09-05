import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { SurfaceRouter } from "./app/surfaceRouter"
import {
  createWidgetFixtureSnapshot,
  createMockDesktopApi,
  isExpandedDashboardFixture,
  resolveWidgetFixture,
} from "./lib/desktopApi"
import "./styles/index.css"

const developmentFixture = import.meta.env.DEV
  ? resolveWidgetFixture(
      window.location.search,
      import.meta.env.VITE_WIDGET_FIXTURE,
    )
  : null
const fixtureApi = developmentFixture
  ? createMockDesktopApi({
      snapshot: createWidgetFixtureSnapshot(developmentFixture),
    }).api
  : undefined
const presentationMode =
  developmentFixture
    ? isExpandedDashboardFixture(developmentFixture)
      ? "expanded"
      : "peek"
    : "collapsed"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SurfaceRouter api={fixtureApi} presentationMode={presentationMode} />
  </StrictMode>,
)
