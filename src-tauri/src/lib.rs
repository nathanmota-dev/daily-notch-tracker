use std::sync::Mutex;

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
    IntegrationStatus, MoveTasksInput, ShortcutDiagnostic, ShortcutStatus, Task, TaskBucket,
    TasksWindowIntent, UpdateTaskInput, WindowPlacementSnapshot,
};
pub use services::FocusScheduler;
pub use state::AppState;
pub use storage::{PersistedPayload, RecoveryDiagnostic, Repository, RepositoryError};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state =
                AppState::load(Repository::new(app_data_dir)).map_err(std::io::Error::other)?;
            app.manage(Mutex::new(state));
            app.manage(FocusScheduler::new());
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
            commands::open_settings_window,
            commands::open_external_release,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DailyNotch Linux");
}
