pub mod commands;
pub mod domain;
mod services;
pub mod state;

pub use commands::greet;
pub use domain::{
    AppError, AppErrorCode, AppSnapshot, CreateTaskInput, DomainResult, FocusSession,
    FocusSettings, FocusSettingsPatch, FocusSnapshot, FocusState, MoveTasksInput, ShortcutStatus,
    Task, TaskBucket, UpdateTaskInput,
};
pub use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(std::sync::Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::add_task,
            commands::update_task,
            commands::delete_task,
            commands::toggle_task,
            commands::move_tasks,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DailyNotch Linux");
}
