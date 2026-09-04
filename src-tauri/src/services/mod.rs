//! Application services used by the desktop runtime.

#[path = "app-lifecycle.rs"]
mod app_lifecycle;
#[path = "focus-runtime.rs"]
mod focus_runtime;
#[path = "focus-scheduler.rs"]
mod focus_scheduler;
#[path = "tray.rs"]
mod tray;

pub use app_lifecycle::request_quit;
pub use app_lifecycle::AppLifecycleState;
pub(crate) use app_lifecycle::{
    close_reusable_window, focus_tasks_or_overlay, handle_run_event, handle_window_event,
    show_and_focus_window,
};
pub(crate) use focus_runtime::sync_focus_scheduler;
pub use focus_scheduler::FocusScheduler;
pub(crate) use tray::{current_tray_diagnostic, initialize_tray, sync_tray_menu, TrayRuntimeState};
