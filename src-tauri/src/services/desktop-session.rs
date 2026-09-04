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

#[cfg(all(desktop, target_os = "linux"))]
pub(crate) fn graphical_session_available_for(display: bool, wayland: bool) -> bool {
    display || wayland
}
