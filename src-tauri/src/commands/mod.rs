use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::domain::{
    parse_task_id, AppDiagnostics, AppError, AppSnapshot, CreateTaskInput, FocusSettingsPatch,
    MoveTasksInput, StartFocusInput, TasksWindowIntent, UpdateTaskInput,
};
use crate::services::{
    close_reusable_window, current_autostart_diagnostic, current_tray_diagnostic,
    notify_focus_completion, set_autostart_entry, sync_focus_scheduler, sync_tray_menu,
};
use crate::state::AppState;

#[path = "window-placement.rs"]
mod window_placement;
use window_placement::calculate_tasks_window_position;
#[path = "window-dimensions.rs"]
mod window_dimensions;
use window_dimensions::SETTINGS_WINDOW_DIMENSIONS;
#[path = "window-commands.rs"]
mod window_commands;
use window_commands::{is_allowed_release_url, open_tasks_window_with_intent, open_window};
#[path = "global-shortcut.rs"]
mod global_shortcut;
pub(crate) use global_shortcut::publish_shortcut_status;

const STORE_EVENTS: &[&str] = &["store-changed"];
const SETTINGS_EVENTS: &[&str] = &["store-changed", "settings-changed"];
const FOCUS_EVENTS: &[&str] = &["focus-changed"];
const TASKS_WINDOW_INTENT_EVENT: &str = "tasks-window-intent";

#[tauri::command]
pub fn greet(name: &str) -> String {
    const PREFIX: &str = "Hello, ";
    const SUFFIX: &str = "! DailyNotch Linux is running with Rust.";

    let mut greeting = String::with_capacity(PREFIX.len() + name.len() + SUFFIX.len());
    greeting.push_str(PREFIX);
    greeting.push_str(name);
    greeting.push_str(SUFFIX);
    greeting
}

#[tauri::command]
pub async fn get_snapshot<R: Runtime>(app: AppHandle<R>) -> Result<AppSnapshot, AppError> {
    with_state(&app, |state| Ok(state.snapshot())).await
}

#[tauri::command]
pub async fn add_task<R: Runtime>(
    app: AppHandle<R>,
    input: CreateTaskInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.add_task(input)).await
}

#[tauri::command]
pub async fn update_task<R: Runtime>(
    app: AppHandle<R>,
    input: UpdateTaskInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.update_task(input)).await
}

#[tauri::command]
pub async fn delete_task<R: Runtime>(
    app: AppHandle<R>,
    task_id: String,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.delete_task(&task_id)).await
}

#[tauri::command]
pub async fn toggle_task<R: Runtime>(
    app: AppHandle<R>,
    task_id: String,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.toggle_task(&task_id)).await
}

#[tauri::command]
pub async fn move_tasks<R: Runtime>(
    app: AppHandle<R>,
    input: MoveTasksInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.move_tasks(input)).await
}

#[tauri::command]
pub async fn update_settings<R: Runtime>(
    app: AppHandle<R>,
    patch: FocusSettingsPatch,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, SETTINGS_EVENTS, move |state| {
        state.update_settings(patch)
    })
    .await
}

#[tauri::command]
pub async fn start_focus<R: Runtime>(
    app: AppHandle<R>,
    input: StartFocusInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, move |state| state.start_focus(input)).await
}

#[tauri::command]
pub async fn pause_focus<R: Runtime>(app: AppHandle<R>) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.pause_focus()).await
}

#[tauri::command]
pub async fn resume_focus<R: Runtime>(app: AppHandle<R>) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.resume_focus()).await
}

#[tauri::command]
pub async fn stop_focus<R: Runtime>(app: AppHandle<R>) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.stop_focus()).await
}

#[tauri::command]
pub async fn toggle_focus<R: Runtime>(app: AppHandle<R>) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.toggle_focus()).await
}

#[tauri::command]
pub async fn get_app_diagnostics<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AppDiagnostics, AppError> {
    let app_version = app.package_info().version.to_string();
    let autostart_diagnostic = current_autostart_diagnostic(&app).await;
    let tray_diagnostic = current_tray_diagnostic(&app);
    with_state(&app, move |state| {
        Ok(state.diagnostics(app_version, autostart_diagnostic, tray_diagnostic))
    })
    .await
}

#[tauri::command]
pub async fn set_autostart<R: Runtime>(
    app: AppHandle<R>,
    enabled: bool,
) -> Result<AppSnapshot, AppError> {
    set_autostart_entry(&app, enabled).await?;
    with_state(&app, |state| Ok(state.snapshot())).await
}

#[tauri::command]
pub async fn open_tasks_window<R: Runtime>(
    app: AppHandle<R>,
    intent: Option<TasksWindowIntent>,
) -> Result<(), AppError> {
    let intent = intent.unwrap_or(TasksWindowIntent::List);
    validate_tasks_window_intent(Some(&intent))?;
    open_tasks_window_with_intent(&app, &intent)
}

#[tauri::command]
pub async fn close_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    close_reusable_window(&app, "tasks", "The Tasks window could not be hidden.")
}

#[tauri::command]
pub async fn close_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    close_reusable_window(&app, "settings", "The Settings window could not be hidden.")
}

#[tauri::command]
pub async fn open_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    open_window(&app, "settings", "Settings", SETTINGS_WINDOW_DIMENSIONS)
}

#[tauri::command]
pub async fn open_external_release(url: String) -> Result<(), AppError> {
    if !is_allowed_release_url(&url) {
        return Err(AppError::invalid_url(
            "The release URL must use HTTPS.",
            "url",
        ));
    }

    Err(AppError::integration_unavailable(
        "External release links are not available yet.",
    ))
}

async fn with_state<R, T, F>(app: &AppHandle<R>, operation: F) -> Result<T, AppError>
where
    R: Runtime,
    T: Send + 'static,
    F: FnOnce(&mut AppState) -> Result<T, AppError> + Send + 'static,
{
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app
            .try_state::<Mutex<AppState>>()
            .ok_or_else(|| AppError::internal("The application state is unavailable."))?;
        let mut state = state
            .lock()
            .map_err(|_| AppError::internal("The application state is unavailable."))?;
        operation(&mut state)
    })
    .await
    .map_err(|_| AppError::internal("The state operation could not be completed."))?
}

async fn mutate_and_emit<R, F>(
    app: AppHandle<R>,
    event_names: &'static [&'static str],
    mutation: F,
) -> Result<AppSnapshot, AppError>
where
    R: Runtime,
    F: FnOnce(&mut AppState) -> Result<AppSnapshot, AppError> + Send + 'static,
{
    let scheduler_app = app.clone();
    let (before, snapshot) = with_state(&app, move |state| {
        let before = state.snapshot();
        let snapshot = mutation(state)?;
        let schedule = state.focus_schedule();
        sync_focus_scheduler(&scheduler_app, schedule);
        Ok((before, snapshot))
    })
    .await?;

    // A disappearing window must not turn a successful in-memory mutation into a failure.
    for &event_name in event_names {
        let _ = app.emit(event_name, &snapshot);
    }

    if !event_names.contains(&"focus-changed") && before.focus != snapshot.focus {
        let _ = app.emit("focus-changed", &snapshot);
    }

    if !event_names.contains(&"store-changed") && persisted_state_changed(&before, &snapshot) {
        let _ = app.emit("store-changed", &snapshot);
    }

    sync_tray_menu(&app, &snapshot);
    notify_focus_completion(&app, &before, &snapshot);

    Ok(snapshot)
}

fn persisted_state_changed(before: &AppSnapshot, after: &AppSnapshot) -> bool {
    before.tasks != after.tasks
        || before.sessions != after.sessions
        || before.settings != after.settings
}

fn validate_tasks_window_intent(intent: Option<&TasksWindowIntent>) -> Result<(), AppError> {
    let Some(TasksWindowIntent::Task { task_id }) = intent else {
        return Ok(());
    };

    parse_task_id(task_id, "intent.taskId").map(|_| ())
}

#[cfg(test)]
#[path = "../commands-tests.rs"]
mod tests;
