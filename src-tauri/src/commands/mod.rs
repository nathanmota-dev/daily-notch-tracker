use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

use crate::domain::{
    AppError, AppSnapshot, CreateTaskInput, FocusSettingsPatch, MoveTasksInput, UpdateTaskInput,
};
use crate::state::AppState;

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
pub async fn get_snapshot(app: AppHandle) -> Result<AppSnapshot, AppError> {
    with_state(&app, |state| Ok(state.snapshot())).await
}

#[tauri::command]
pub async fn add_task(app: AppHandle, input: CreateTaskInput) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, "store-changed", move |state| state.add_task(input)).await
}

#[tauri::command]
pub async fn update_task(app: AppHandle, input: UpdateTaskInput) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, "store-changed", move |state| state.update_task(input)).await
}

#[tauri::command]
pub async fn delete_task(app: AppHandle, task_id: String) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, "store-changed", move |state| {
        state.delete_task(&task_id)
    })
    .await
}

#[tauri::command]
pub async fn toggle_task(app: AppHandle, task_id: String) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, "store-changed", move |state| {
        state.toggle_task(&task_id)
    })
    .await
}

#[tauri::command]
pub async fn move_tasks(app: AppHandle, input: MoveTasksInput) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, "store-changed", move |state| state.move_tasks(input)).await
}

#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    patch: FocusSettingsPatch,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, "settings-changed", move |state| {
        state.update_settings(patch)
    })
    .await
}

async fn with_state<T, F>(app: &AppHandle, operation: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(&mut AppState) -> Result<T, AppError> + Send + 'static,
{
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state
            .lock()
            .map_err(|_| AppError::internal("The application state is unavailable."))?;
        operation(&mut state)
    })
    .await
    .map_err(|error| AppError::internal(format!("The state operation failed: {error}")))?
}

async fn mutate_and_emit<F>(
    app: AppHandle,
    event_name: &'static str,
    mutation: F,
) -> Result<AppSnapshot, AppError>
where
    F: FnOnce(&mut AppState) -> Result<AppSnapshot, AppError> + Send + 'static,
{
    let snapshot = with_state(&app, mutation).await?;

    // A disappearing window must not turn a successful in-memory mutation into a failure.
    let _ = app.emit(event_name, &snapshot);
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greet_returns_a_rust_message() {
        assert_eq!(
            greet("DailyNotch"),
            "Hello, DailyNotch! DailyNotch Linux is running with Rust."
        );
    }
}
