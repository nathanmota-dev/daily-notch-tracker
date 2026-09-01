import tauriConfig from "../../../src-tauri/tauri.conf.json"
import defaultCapability from "../../../src-tauri/capabilities/default.json"

const [overlayWindow] = tauriConfig.app.windows

describe("Tauri overlay window configuration", () => {
  it("declares exactly one overlay window", () => {
    expect(tauriConfig.app.windows).toHaveLength(1)
    expect(overlayWindow.label).toBe("overlay")
  })

  it("configures the compact transparent window behavior", () => {
    expect(overlayWindow).toMatchObject({
      width: 360,
      height: 72,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      shadow: false,
      fullscreen: false,
      visible: true,
    })
  })

  it("does not retain normal-window size constraints", () => {
    expect(overlayWindow).not.toHaveProperty("minWidth")
    expect(overlayWindow).not.toHaveProperty("minHeight")
  })

  it("keeps the overlay capability scoped to its current permissions", () => {
    expect(defaultCapability.windows).toEqual(["overlay"])
    expect(defaultCapability.permissions).toEqual([
      "core:default",
      "core:window:allow-set-size",
      "core:window:allow-set-position",
      "core:window:allow-show",
      "core:window:allow-hide",
    ])
  })
})
