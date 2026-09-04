#[cfg(desktop)]
pub(crate) fn graphical_session_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        graphical_session_available_for(
            std::env::var_os("DISPLAY").is_some(),
            std::env::var_os("WAYLAND_DISPLAY").is_some(),
        )
    }

    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

#[cfg(desktop)]
pub(crate) fn global_shortcut_session_available() -> bool {
    #[cfg(target_os = "linux")]
    {
        global_shortcut_session_available_for(
            std::env::var("DISPLAY")
                .map(|display| !display.is_empty())
                .unwrap_or(false),
            std::env::var_os("WAYLAND_DISPLAY").is_some(),
        )
    }

    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

#[cfg(all(desktop, target_os = "linux"))]
pub(crate) fn graphical_session_available_for(display: bool, wayland: bool) -> bool {
    display || wayland
}

#[cfg(all(desktop, target_os = "linux"))]
pub(crate) fn global_shortcut_session_available_for(display: bool, _wayland: bool) -> bool {
    // global-hotkey 0.8 uses its X11 backend on Linux. A Wayland session can
    // still provide Xwayland through DISPLAY, but WAYLAND_DISPLAY alone is
    // not enough to register this shortcut.
    display
}
