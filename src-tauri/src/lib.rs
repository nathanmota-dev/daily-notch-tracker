use std::sync::{Arc, Mutex};

use tauri::Manager;

pub mod commands;
pub mod domain;
pub mod services;
pub mod state;
pub mod storage;

pub use commands::greet;
pub use domain::{
    AppDiagnostics, AppError, AppErrorCode, AppSnapshot, AutostartDiagnostic, CreateTaskInput,
    DomainResult, FocusSession, FocusSettings, FocusSettingsPatch, FocusSnapshot, FocusState,
    IntegrationStatus, MoveTasksInput, ShortcutDiagnostic, ShortcutStatus, StartFocusInput, Task,
    TaskBucket, TasksWindowIntent, TrayDiagnostic, UpdateTaskInput, WindowMonitorSnapshot,
    WindowPlacementSnapshot,
};
pub use services::AppLifecycleState;
pub use services::FocusScheduler;
pub use state::AppState;
pub use storage::{PersistedPayload, RecoveryDiagnostic, Repository, RepositoryError};

use services::{
    focus_overlay, handle_run_event, initialize_autostart, initialize_global_shortcut,
    initialize_tray, NotificationService, TauriNotificationBackend, TrayRuntimeState,
    WindowNavigationState,
};

#[cfg(target_os = "linux")]
fn should_prefer_x11_backend(
    has_wayland_display: bool,
    has_x11_display: bool,
    backend: Option<&str>,
) -> bool {
    let requested_backend = backend
        .and_then(|value| value.split(',').next())
        .map(str::trim);

    has_wayland_display && has_x11_display && requested_backend != Some("x11")
}

#[cfg(target_os = "linux")]
fn configure_positioned_overlay_backend() {
    let backend = std::env::var("GDK_BACKEND").ok();

    if should_prefer_x11_backend(
        std::env::var_os("WAYLAND_DISPLAY").is_some(),
        std::env::var_os("DISPLAY").is_some(),
        backend.as_deref(),
    ) {
        // A normal Wayland window cannot be placed at an absolute monitor
        // coordinate. XWayland keeps the overlay below the primary panel.
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    configure_positioned_overlay_backend();

    let mut builder = tauri::Builder::default()
        .manage(AppLifecycleState::new())
        .manage(WindowNavigationState::new())
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = focus_overlay(app);
        }));
    }

    builder
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state =
                AppState::load(Repository::new(app_data_dir)).map_err(std::io::Error::other)?;
            app.manage(Mutex::new(state));
            app.manage(FocusScheduler::new());
            app.manage(NotificationService::new(Arc::new(
                TauriNotificationBackend::new(app.handle().clone()),
            )));
            app.manage(TrayRuntimeState::default());
            initialize_autostart(app);
            initialize_global_shortcut(app);
            initialize_tray(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::window_commands::get_window_placement,
            commands::window_commands::save_window_placement,
            commands::add_task,
            commands::update_task,
            commands::delete_task,
            commands::toggle_task,
            commands::move_tasks,
            commands::start_focus,
            commands::pause_focus,
            commands::resume_focus,
            commands::stop_focus,
            commands::toggle_focus,
            commands::update_settings,
            commands::get_app_diagnostics,
            commands::set_autostart,
            commands::window_navigation_commands::open_tasks_window,
            commands::window_navigation_commands::close_tasks_window,
            commands::window_navigation_commands::open_settings_window,
            commands::window_navigation_commands::close_settings_window,
            commands::window_navigation_commands::return_to_tasks_window,
            commands::open_external_release,
        ])
        .build(tauri::generate_context!())
        .expect("error while building DailyNotch Linux")
        .run(handle_run_event);
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::should_prefer_x11_backend;

    #[test]
    fn prefers_x11_when_both_display_backends_are_available() {
        assert!(should_prefer_x11_backend(true, true, None));
    }

    #[test]
    fn keeps_wayland_when_xwayland_is_unavailable() {
        assert!(!should_prefer_x11_backend(true, false, None));
    }

    #[test]
    fn keeps_the_requested_x11_backend() {
        assert!(!should_prefer_x11_backend(true, true, Some("x11,wayland")));
    }

    #[test]
    fn prefers_x11_when_wayland_is_only_the_first_fallback() {
        assert!(should_prefer_x11_backend(true, true, Some("wayland,x11")));
    }

    #[test]
    fn keeps_the_wayland_fallback_without_a_wayland_session() {
        assert!(!should_prefer_x11_backend(false, true, None));
    }
}
