import tauriConfig from "../../../src-tauri/tauri.conf.json"
import defaultCapability from "../../../src-tauri/capabilities/default.json"
import { WINDOW_DIMENSIONS } from "./window-dimensions"

const [overlayWindow, tasksWindow, settingsWindow] = tauriConfig.app.windows

describe("Tauri overlay window configuration", () => {
  it("declares the overlay and stacked content windows", () => {
    expect(tauriConfig.app.windows).toHaveLength(3)
    expect(overlayWindow.label).toBe("overlay")
    expect(tasksWindow.label).toBe("tasks")
    expect(settingsWindow.label).toBe("settings")
  })

  it("configures the compact transparent window behavior", () => {
    expect(overlayWindow).toMatchObject({
      width: WINDOW_DIMENSIONS.overlay.idle.width,
      height: WINDOW_DIMENSIONS.overlay.idle.height,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
      shadow: false,
      fullscreen: false,
      visible: false,
    })
  })

  it("does not retain normal-window size constraints", () => {
    expect(overlayWindow).not.toHaveProperty("minWidth")
    expect(overlayWindow).not.toHaveProperty("minHeight")
  })

  it("keeps every native surface inside the current permissions", () => {
    expect(defaultCapability.windows).toEqual(["overlay", "tasks", "settings"])
    expect(defaultCapability.permissions).toEqual([
      "core:default",
      "core:window:allow-set-size",
      "core:window:allow-set-position",
      "core:window:allow-set-size-constraints",
      "core:window:allow-show",
      "core:window:allow-hide",
      "core:window:allow-start-dragging",
      "core:window:allow-available-monitors",
      "core:window:allow-primary-monitor",
      "notification:default",
      "autostart:default",
      "global-shortcut:allow-register",
      "global-shortcut:allow-unregister",
    ])
  })

  it("uses the default capability for every native surface view", () => {
    expect(tauriConfig.app.security.capabilities).toEqual(["default"])
    expect(defaultCapability.windows).toEqual(["overlay", "tasks", "settings"])
  })

  it("keeps content windows hidden until a navigation command opens them", () => {
    expect(tasksWindow).toMatchObject({
      width: WINDOW_DIMENSIONS.tasks.preferred.width,
      height: WINDOW_DIMENSIONS.tasks.preferred.height,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      visible: false,
    })
    expect(settingsWindow).toMatchObject({
      width: WINDOW_DIMENSIONS.settings.preferred.width,
      height: WINDOW_DIMENSIONS.settings.preferred.height,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      visible: false,
    })
  })
})

describe("Tauri Linux bundle configuration", () => {
  it("enables only the AppImage and Debian targets", () => {
    expect(tauriConfig.bundle.active).toBe(true)
    expect(tauriConfig.bundle.targets).toEqual(["appimage", "deb"])
  })

  it("preserves the application metadata and Linux icon set", () => {
    expect(tauriConfig).toMatchObject({
      productName: "DailyNotch Linux",
      identifier: "com.dailynotch.linux",
      bundle: {
        category: "Utility",
        shortDescription: "A focused task tracker for Linux",
        longDescription:
          "DailyNotch is a local-first focus and task tracker for Linux.",
        icon: [
          "icons/32x32.png",
          "icons/64x64.png",
          "icons/128x128.png",
          "icons/128x128@2x.png",
          "icons/icon.png",
        ],
      },
    })
  })

  it("does not bundle the multimedia framework in the AppImage", () => {
    expect(tauriConfig.bundle.linux.appimage.bundleMediaFramework).toBe(false)
  })
})
