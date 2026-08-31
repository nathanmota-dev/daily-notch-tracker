import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { SurfaceRouter } from "./app/surfaceRouter"
import "./styles/index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SurfaceRouter />
  </StrictMode>,
)
