use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, RunEvent, Runtime, WebviewWindow, Window, WindowEvent};

use super::FocusScheduler;
use crate::domain::AppError;

/// Tracks shutdown progress shared by the application lifecycle and future tray actions.
#[derive(Debug, Default)]
pub struct AppLifecycleState {
    shutting_down: AtomicBool,
    cleanup_started: AtomicBool,
}

impl AppLifecycleState {
    /// Creates lifecycle state in the running state.
    pub fn new() -> Self {
        Self::default()
    }

    /// Marks the application as shutting down and reports whether this was the first request.
    pub(crate) fn request_shutdown(&self) -> bool {
        !self.shutting_down.swap(true, Ordering::AcqRel)
    }

    /// Returns whether the application has begun shutting down.
    pub fn is_shutting_down(&self) -> bool {
        self.shutting_down.load(Ordering::Acquire)
    }

    /// Marks cleanup as started and reports whether the caller owns the cleanup pass.
    pub(crate) fn start_cleanup(&self) -> bool {
        !self.cleanup_started.swap(true, Ordering::AcqRel)
    }

    /// Returns whether the cleanup pass has started.
    pub fn is_cleanup_started(&self) -> bool {
        self.cleanup_started.load(Ordering::Acquire)
    }
}

/// Shows and focuses Tasks when it already exists, otherwise the overlay.
pub(crate) fn focus_tasks_or_overlay<R: Runtime>(app: &AppHandle<R>) -> Result<(), AppError> {
    if let Some(label) = preferred_focus_window_label(app) {
        if let Some(window) = app.get_webview_window(label) {
            if show_and_focus_window(&window).is_ok() {
                return Ok(());
            }
        }
    }

    let Some(overlay_window) = app.get_webview_window("overlay") else {
        return Err(AppError::integration_unavailable(
            "The overlay window could not be focused.",
        ));
    };

    show_and_focus_window(&overlay_window)
}

fn preferred_focus_window_label<R: Runtime>(app: &AppHandle<R>) -> Option<&'static str> {
    if app.get_webview_window("tasks").is_some() {
        return Some("tasks");
    }

    app.get_webview_window("overlay").map(|_| "overlay")
}

/// Shows a reusable window and brings it to the foreground.
pub(crate) fn show_and_focus_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), AppError> {
    window
        .show()
        .map_err(|_| AppError::integration_unavailable("The desktop window could not be shown."))?;
    window.set_focus().map_err(|_| {
        AppError::integration_unavailable("The desktop window could not receive focus.")
    })?;
    Ok(())
}

/// Hides a reusable window without destroying its webview or application state.
pub(crate) fn close_reusable_window<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    error_message: &str,
) -> Result<(), AppError> {
    let Some(window) = app.get_webview_window(label) else {
        return Ok(());
    };

    window
        .hide()
        .map_err(|_| AppError::integration_unavailable(error_message))?;

    if let Some(overlay_window) = app.get_webview_window("overlay") {
        let _ = overlay_window.show();
        let _ = overlay_window.set_focus();
    }

    Ok(())
}

/// Prevents close on reusable windows and hides them instead.
pub(crate) fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if !matches!(window.label(), "tasks" | "settings") {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

/// Requests an explicit application exit, allowing only the first request through.
pub fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    let should_exit = app
        .try_state::<AppLifecycleState>()
        .map(|lifecycle| lifecycle.request_shutdown())
        .unwrap_or(true);

    if should_exit {
        app.exit(0);
    }
}

/// Cancels runtime work exactly once when the event loop is exiting.
pub(crate) fn cleanup_before_exit<R: Runtime>(app: &AppHandle<R>) {
    let should_cleanup = match app.try_state::<AppLifecycleState>() {
        Some(lifecycle) => {
            lifecycle.request_shutdown();
            lifecycle.start_cleanup()
        }
        None => true,
    };

    if !should_cleanup {
        return;
    }

    if let Some(scheduler) = app.try_state::<FocusScheduler>() {
        scheduler.cancel();
    }
}

/// Handles application-level events that need lifecycle cleanup.
pub(crate) fn handle_run_event<R: Runtime>(app: &AppHandle<R>, event: RunEvent) {
    if matches!(event, RunEvent::Exit) {
        cleanup_before_exit(app);
    }
}
