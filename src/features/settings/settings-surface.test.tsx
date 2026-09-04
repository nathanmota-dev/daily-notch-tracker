import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import {
  createBrowserDiagnostics,
  createEmptyAppSnapshot,
  createMockDesktopApi,
  DesktopApiError,
  type AppDiagnostics,
  type AppSnapshot,
  type FocusSettingsPatch,
  type MockDesktopApiHandlers,
} from "../../lib/desktopApi"
import { App } from "../../app/App"

function createDiagnostics(): AppDiagnostics {
  const diagnostics = createBrowserDiagnostics()
  diagnostics.appVersion = "0.1.0-test"
  diagnostics.dataFilePath = "/tmp/dailynotch-test.json"
  return diagnostics
}

function createAvailableIntegrationDiagnostics(): AppDiagnostics {
  const diagnostics = createDiagnostics()
  diagnostics.shortcut = { status: "registered", message: null }
  diagnostics.autostart = {
    enabled: true,
    status: "available",
    message: null,
  }
  diagnostics.tray = { status: "available", message: null }
  return diagnostics
}

function createSettingsSnapshot(overrides: Partial<AppSnapshot> = {}) {
  return {
    ...createEmptyAppSnapshot(),
    revision: 1,
    ...overrides,
  }
}

function renderSettings(
  options: {
    diagnostics?: AppDiagnostics
    handlers?: MockDesktopApiHandlers
    snapshot?: AppSnapshot
  } = {},
) {
  const controller = createMockDesktopApi({
    diagnostics: options.diagnostics ?? createDiagnostics(),
    handlers: options.handlers,
    snapshot: options.snapshot ?? createSettingsSnapshot(),
  })

  const view = render(<App api={controller.api} surface="settings" />)

  return { ...controller, view }
}

describe("Settings surface", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/")
  })

  afterEach(() => {
    window.history.replaceState({}, "", "/")
  })

  it("renders every settings section and safe integration states", async () => {
    const controller = renderSettings()

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.queryByText("DailyNotch Linux")).not.toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="settings-window-header"] > div > svg'),
    ).toHaveClass("text-accent")
    expect(screen.getByRole("heading", { name: "Timer" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Startup" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Shortcut" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Diagnostics" })).toBeInTheDocument()
    expect(await screen.findByText("0.1.0-test")).toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: "Play sound" })).not.toBeInTheDocument()

    const autostart = screen.getByRole("switch", { name: "Launch at login" })
    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveClass(
      "data-checked:bg-accent",
    )
    expect(autostart).toHaveAttribute("aria-disabled", "true")
    expect(autostart).not.toBeChecked()
    expect(screen.getAllByText("Autostart requires the desktop runtime.")).toHaveLength(2)
    expect(screen.getByText("System tray")).toBeInTheDocument()
    expect(
      screen.getByText("Tray integration requires the desktop runtime."),
    ).toBeInTheDocument()
    expect(controller.getSnapshot().settings.launchAtLogin).toBe(false)
  })

  it("persists boolean preferences immediately and restores them after remount", async () => {
    const controller = renderSettings()
    await screen.findByText("0.1.0-test")
    const user = userEvent.setup()
    const timeline = screen.getByRole("switch", { name: "Show timeline" })
    const notifications = screen.getByRole("switch", { name: "Notifications" })

    await user.click(timeline)

    await waitFor(() => {
      expect(controller.getSnapshot().settings.showTimeline).toBe(false)
      expect(timeline).not.toBeChecked()
    })

    await user.click(notifications)

    await waitFor(() => {
      expect(controller.getSnapshot().settings.notificationsEnabled).toBe(false)
      expect(notifications).not.toBeChecked()
    })

    const updatedSnapshot = controller.getSnapshot()
    controller.view.unmount()
    render(
      <App
        api={controller.api}
        surface="settings"
      />,
    )

    expect(await screen.findByRole("switch", { name: "Show timeline" })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "Notifications" })).not.toBeChecked()
    expect(updatedSnapshot.settings.showTimeline).toBe(false)
  })

  it("validates duration locally and saves valid values on blur or Enter", async () => {
    const controller = renderSettings()
    await screen.findByText("0.1.0-test")
    const updateSettings = vi.spyOn(controller.api, "updateSettings")
    const duration = screen.getByRole("spinbutton", {
      name: "Focus duration (minutes)",
    })

    fireEvent.change(duration, { target: { value: "181" } })
    fireEvent.blur(duration)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "between 1 and 180.",
    )
    expect(updateSettings).not.toHaveBeenCalled()

    fireEvent.change(duration, { target: { value: "50" } })
    fireEvent.keyDown(duration, { key: "Enter" })

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ focusMinutes: 50 })
      expect(controller.getSnapshot().settings.focusMinutes).toBe(50)
    })
    expect(duration).toHaveValue(50)
  })

  it("saves duration changes from the stepper and presets", async () => {
    const controller = renderSettings()
    await screen.findByText("0.1.0-test")
    const updateSettings = vi.spyOn(controller.api, "updateSettings")
    const user = userEvent.setup()

    expect(screen.getByRole("button", { name: "25 minutes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    await user.click(
      screen.getByRole("button", { name: "Increase focus duration" }),
    )

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ focusMinutes: 26 })
      expect(controller.getSnapshot().settings.focusMinutes).toBe(26)
    })

    await user.click(screen.getByRole("button", { name: "45 minutes" }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenLastCalledWith({ focusMinutes: 45 })
      expect(controller.getSnapshot().settings.focusMinutes).toBe(45)
    })
    expect(screen.getByRole("button", { name: "45 minutes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("uses the updated default for the next task-free focus session", async () => {
    const controller = renderSettings()
    await screen.findByText("0.1.0-test")

    await controller.api.updateSettings({ focusMinutes: 45 })
    const started = await controller.api.toggleFocus()

    expect(started.focus.activeTaskId).toBeNull()
    expect(started.focus.totalMs).toBe(45 * 60_000)
  })

  it("shows diagnostics loading and recovers from a diagnostics failure", async () => {
    let resolveDiagnostics: ((value: AppDiagnostics) => void) | undefined
    const diagnostics = createDiagnostics()
    const getAppDiagnostics = vi.fn(
      () =>
        new Promise<AppDiagnostics>((resolve) => {
          resolveDiagnostics = resolve
        }),
    )
    renderSettings({ handlers: { getAppDiagnostics } })

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="settings-diagnostics-loading"]')).toHaveTextContent(
      "Loading diagnostics",
    )
    await waitFor(() => {
      expect(getAppDiagnostics).toHaveBeenCalledOnce()
      expect(resolveDiagnostics).toBeDefined()
    })
    resolveDiagnostics!(diagnostics)
    expect(await screen.findByText("0.1.0-test")).toBeInTheDocument()
    expect(getAppDiagnostics).toHaveBeenCalledOnce()
  })

  it("offers a retry when diagnostics fail", async () => {
    let attempts = 0
    const diagnostics = createDiagnostics()
    const getAppDiagnostics = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new DesktopApiError({
          operation: "getAppDiagnostics",
          code: "integration-unavailable",
          message: "Diagnostics are temporarily unavailable.",
        })
      }
      return diagnostics
    })
    renderSettings({ handlers: { getAppDiagnostics } })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    )
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Retry diagnostics" }),
    )

    expect(await screen.findByText("0.1.0-test")).toBeInTheDocument()
    expect(getAppDiagnostics).toHaveBeenCalledTimes(2)
  })

  it("shows a recoverable mutation error and retries it", async () => {
    let attempts = 0
    const updateSettings = vi.fn(async (patch: FocusSettingsPatch) => {
      attempts += 1
      if (attempts === 1) {
        throw new DesktopApiError({
          operation: "updateSettings",
          code: "persistence",
          message: "Unable to persist this preference.",
        })
      }

      const snapshot = controller.getSnapshot()
      return {
        ...snapshot,
        revision: snapshot.revision + 1,
        settings: { ...snapshot.settings, ...patch },
      }
    })
    const controller = renderSettings({ handlers: { updateSettings } })
    await screen.findByText("0.1.0-test")

    await userEvent.setup().click(
      screen.getByRole("switch", { name: "Notifications" }),
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to persist this preference",
    )
    expect(controller.getSnapshot().settings.notificationsEnabled).toBe(true)

    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => {
      expect(controller.getSnapshot().settings.notificationsEnabled).toBe(false)
      expect(updateSettings).toHaveBeenCalledTimes(2)
    })
  })

  it("uses effective autostart diagnostics instead of the saved preference", async () => {
    const snapshot = createSettingsSnapshot({
      settings: {
        ...createEmptyAppSnapshot().settings,
        launchAtLogin: false,
      },
    })
    renderSettings({
      diagnostics: createAvailableIntegrationDiagnostics(),
      snapshot: { ...snapshot, shortcutStatus: "registered" },
    })

    await screen.findByText("0.1.0-test")
    const autostart = screen.getByRole("switch", { name: "Launch at login" })
    expect(autostart).toBeChecked()
    expect(autostart).not.toBeDisabled()
    expect(screen.getAllByText("Available")).toHaveLength(2)
    expect(screen.getByText("Registered")).toBeInTheDocument()
  })

  it("refreshes effective autostart diagnostics after a successful change", async () => {
    let effectiveEnabled = false
    const diagnostics = createDiagnostics()
    diagnostics.autostart = {
      enabled: effectiveEnabled,
      status: "available",
      message: null,
    }
    const getAppDiagnostics = vi.fn(async () => ({
      ...diagnostics,
      autostart: {
        ...diagnostics.autostart,
        enabled: effectiveEnabled,
      },
    }))
    const setAutostart = vi.fn(async (enabled: boolean) => {
      effectiveEnabled = enabled
      return controller.getSnapshot()
    })
    const controller = renderSettings({
      diagnostics,
      handlers: { getAppDiagnostics, setAutostart },
    })

    await screen.findByText("0.1.0-test")
    await userEvent.setup().click(
      screen.getByRole("switch", { name: "Launch at login" }),
    )

    await waitFor(() => {
      expect(setAutostart).toHaveBeenCalledWith(true)
      expect(getAppDiagnostics).toHaveBeenCalledTimes(2)
      expect(
        screen.getByRole("switch", { name: "Launch at login" }),
      ).toBeChecked()
    })
  })

  it("refreshes diagnostics after an autostart failure and retries successfully", async () => {
    let attempts = 0
    let effectiveDiagnostics: AppDiagnostics["autostart"] = {
      enabled: false,
      status: "available",
      message: null,
    }
    const diagnostics = createDiagnostics()
    diagnostics.autostart = effectiveDiagnostics
    const getAppDiagnostics = vi.fn(async () => ({
      ...diagnostics,
      autostart: effectiveDiagnostics,
    }))
    const setAutostart = vi.fn(async (enabled: boolean) => {
      attempts += 1
      if (attempts === 1) {
        effectiveDiagnostics = {
          enabled: false,
          status: "error",
          message: "Autostart status could not be read from the desktop session.",
        }
        throw new DesktopApiError({
          operation: "setAutostart",
          code: "integration-unavailable",
          message: "Autostart could not be updated in this desktop session.",
        })
      }

      effectiveDiagnostics = {
        enabled,
        status: "available",
        message: null,
      }
      return controller.getSnapshot()
    })
    const controller = renderSettings({
      diagnostics,
      handlers: { getAppDiagnostics, setAutostart },
    })

    await screen.findByText("0.1.0-test")
    await userEvent.setup().click(
      screen.getByRole("switch", { name: "Launch at login" }),
    )

    await waitFor(() => {
      expect(setAutostart).toHaveBeenCalledTimes(1)
      expect(getAppDiagnostics).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Error")).toBeInTheDocument()
    })
    expect(screen.getByRole("alert")).toHaveTextContent("could not be updated")

    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => {
      expect(setAutostart).toHaveBeenCalledTimes(2)
      expect(getAppDiagnostics).toHaveBeenCalledTimes(3)
      expect(
        screen.getByRole("switch", { name: "Launch at login" }),
      ).toBeChecked()
      expect(screen.getByText("Available")).toBeInTheDocument()
    })
  })

  it.each([
    {
      status: "unavailable" as const,
      message: "Global shortcut integration is unavailable in this desktop session.",
    },
    {
      status: "error" as const,
      message: "Global shortcut could not be registered. It may already be in use.",
    },
  ])("shows the $status shortcut status and message", async ({ status, message }) => {
    const diagnostics = createDiagnostics()
    diagnostics.shortcut = { status, message }
    renderSettings({
      diagnostics,
      snapshot: {
        ...createSettingsSnapshot(),
        shortcutStatus: status,
      },
    })

    await screen.findByText("0.1.0-test")

    const statusLabel = status === "error" ? "Error" : "Unavailable"
    expect(screen.getAllByText(statusLabel).length).toBeGreaterThan(0)
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("keeps the live snapshot shortcut status ahead of an older diagnostics response", async () => {
    const diagnostics = createDiagnostics()
    diagnostics.shortcut = {
      status: "unavailable",
      message: "Old unavailable diagnostic",
    }
    const controller = renderSettings({ diagnostics })
    await screen.findByText("0.1.0-test")

    controller.emit("shortcut-changed", {
      ...controller.getSnapshot(),
      revision: controller.getSnapshot().revision + 1,
      shortcutStatus: "error",
    })

    expect(await screen.findByText("Error")).toBeInTheDocument()
    expect(
      screen.getByText("Global shortcut could not be registered. It may already be in use."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Old unavailable diagnostic")).not.toBeInTheDocument()
  })

  it("shows tray initialization errors as recoverable diagnostics", async () => {
    const diagnostics = createDiagnostics()
    diagnostics.tray = {
      status: "error",
      message: "System tray integration could not be initialized.",
    }
    renderSettings({ diagnostics })

    await screen.findByText("0.1.0-test")
    expect(screen.getByText("System tray")).toBeInTheDocument()
    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(
      screen.getByText("System tray integration could not be initialized."),
    ).toBeInTheDocument()
  })

  it("calls the desktop close operation without closing the application", async () => {
    const closeSettingsWindow = vi.fn(async () => undefined)
    renderSettings({ handlers: { closeSettingsWindow } })
    await screen.findByText("0.1.0-test")

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Close Settings" }),
    )

    await waitFor(() => expect(closeSettingsWindow).toHaveBeenCalledOnce())
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
  })

  it("returns to Tasks from the back button", async () => {
    const returnToTasksWindow = vi.fn(async () => undefined)
    renderSettings({ handlers: { returnToTasksWindow } })
    await screen.findByText("0.1.0-test")

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Back to tasks" }),
    )

    await waitFor(() => expect(returnToTasksWindow).toHaveBeenCalledOnce())
  })
})
