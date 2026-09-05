//! Application services used by the desktop runtime.

#[path = "app-lifecycle.rs"]
mod app_lifecycle;
#[path = "autostart.rs"]
mod autostart;
#[path = "autostart-adapter.rs"]
mod autostart_adapter;
#[path = "autostart-types.rs"]
mod autostart_types;
#[path = "desktop-session.rs"]
mod desktop_session;
#[path = "focus-runtime.rs"]
mod focus_runtime;
#[path = "focus-scheduler.rs"]
mod focus_scheduler;
#[path = "global-shortcut.rs"]
mod global_shortcut;
#[path = "global-shortcut-adapter.rs"]
mod global_shortcut_adapter;
#[path = "global-shortcut-types.rs"]
mod global_shortcut_types;
#[path = "notification.rs"]
mod notification;
#[path = "notification-adapter.rs"]
mod notification_adapter;
#[path = "notification-types.rs"]
mod notification_types;
#[path = "tray.rs"]
mod tray;
#[path = "window.rs"]
mod window;
#[path = "window-navigation.rs"]
mod window_navigation;
#[path = "window-navigation-types.rs"]
mod window_navigation_types;

pub use app_lifecycle::request_quit;
pub use app_lifecycle::AppLifecycleState;
pub(crate) use app_lifecycle::{focus_overlay, handle_run_event};
#[cfg(test)]
pub(crate) use autostart::AutostartService;
pub(crate) use autostart::{
    current_autostart_diagnostic, initialize_autostart, set_autostart_entry,
};
#[cfg(test)]
pub(crate) use autostart_adapter::MockAutostartBackend;
#[cfg(test)]
pub(crate) use autostart_types::{AutostartBackendError, UnavailableAutostartBackend};
pub(crate) use focus_runtime::sync_focus_scheduler;
pub use focus_scheduler::FocusScheduler;
#[cfg(test)]
pub(crate) use global_shortcut::GlobalShortcutService;
pub(crate) use global_shortcut::{cleanup_global_shortcut, initialize_global_shortcut};
#[cfg(test)]
pub(crate) use global_shortcut_adapter::MockShortcutBackend;
pub(crate) use notification::{notify_focus_completion, NotificationService};
#[cfg(test)]
pub(crate) use notification_adapter::MockNotificationBackend;
pub(crate) use notification_adapter::TauriNotificationBackend;
#[cfg(test)]
pub(crate) use notification_types::{NotificationBackendError, NotificationPermissionState};
pub(crate) use tray::{current_tray_diagnostic, initialize_tray, sync_tray_menu, TrayRuntimeState};
pub(crate) use window::show_and_focus_window;
pub(crate) use window_navigation::WindowNavigationState;
pub(crate) use window_navigation_types::{
    OverlayChildWindowChangedPayload, OverlayPresentationMode, SurfaceChangedPayload, SurfaceLabel,
    TasksWindowOrigin, OVERLAY_CHILD_WINDOW_CHANGED_EVENT, SURFACE_CHANGED_EVENT,
};
