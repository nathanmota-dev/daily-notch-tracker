use std::sync::Mutex;

use tauri::{AppHandle, Emitter, State};

use crate::domain::{
    AppError, AppSnapshot, CreateTaskInput, FocusSettingsPatch, MoveTasksInput, UpdateTaskInput,
};
use crate::state::AppState;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! DailyNotch Linux is running with Rust.")
}

#[tauri::command]
pub fn get_snapshot(state: State<'_, Mutex<AppState>>) -> Result<AppSnapshot, AppError> {
    let state = state
        .lock()
        .map_err(|_| AppError::internal("The application state is unavailable."))?;
    Ok(state.snapshot())
}

#[tauri::command]
pub fn add_task(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    input: CreateTaskInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(&app, state, "store-changed", |state| state.add_task(input))
}

#[tauri::command]
pub fn update_task(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    input: UpdateTaskInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(&app, state, "store-changed", |state| {
        state.update_task(input)
    })
}

#[tauri::command]
pub fn delete_task(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    task_id: String,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(&app, state, "store-changed", |state| {
        state.delete_task(&task_id)
    })
}

#[tauri::command]
pub fn toggle_task(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    task_id: String,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(&app, state, "store-changed", |state| {
        state.toggle_task(&task_id)
    })
}

#[tauri::command]
pub fn move_tasks(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    input: MoveTasksInput,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(&app, state, "store-changed", |state| {
        state.move_tasks(input)
    })
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    patch: FocusSettingsPatch,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(&app, state, "settings-changed", |state| {
        state.update_settings(patch)
    })
}

fn mutate_and_emit<F>(
    app: &AppHandle,
    state: State<'_, Mutex<AppState>>,
    event_name: &str,
    mutation: F,
) -> Result<AppSnapshot, AppError>
where
    F: FnOnce(&mut AppState) -> Result<AppSnapshot, AppError>,
{
    let snapshot = {
        let mut state = state
            .lock()
            .map_err(|_| AppError::internal("The application state is unavailable."))?;
        mutation(&mut state)?
    };

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
