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
    TaskBucket, TasksWindowIntent, TrayDiagnostic, UpdateTaskInput, WindowPlacementSnapshot,
};
pub use services::AppLifecycleState;
pub use services::FocusScheduler;
pub use state::AppState;
pub use storage::{PersistedPayload, RecoveryDiagnostic, Repository, RepositoryError};

use services::{
    focus_tasks_or_overlay, handle_run_event, handle_window_event, initialize_global_shortcut,
    initialize_tray, NotificationService, TauriNotificationBackend, TrayRuntimeState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .manage(AppLifecycleState::new())
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = focus_tasks_or_overlay(app);
        }));
    }

    builder
        .on_window_event(handle_window_event)
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
            initialize_global_shortcut(app);
            initialize_tray(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
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
            commands::open_tasks_window,
            commands::close_tasks_window,
            commands::open_settings_window,
            commands::close_settings_window,
            commands::open_external_release,
        ])
        .build(tauri::generate_context!())
        .expect("error while building DailyNotch Linux")
        .run(handle_run_event);
}
