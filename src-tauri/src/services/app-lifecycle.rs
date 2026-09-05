use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, RunEvent, Runtime};

use super::{cleanup_global_shortcut, show_and_focus_window, FocusScheduler};
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

/// Shows and focuses the persistent native overlay window.
pub(crate) fn focus_overlay<R: Runtime>(app: &AppHandle<R>) -> Result<(), AppError> {
    let Some(window) = app.get_webview_window("overlay") else {
        return Err(AppError::integration_unavailable(
            "The overlay window could not be focused.",
        ));
    };

    show_and_focus_window(&window)
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

    cleanup_global_shortcut(app);

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

#[cfg(test)]
#[path = "app-lifecycle-tests.rs"]
mod tests;
