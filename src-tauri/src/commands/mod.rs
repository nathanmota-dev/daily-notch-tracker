use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::domain::{
    parse_task_id, AppDiagnostics, AppError, AppSnapshot, CreateTaskInput, FocusSettingsPatch,
    MoveTasksInput, TasksWindowIntent, UpdateTaskInput,
};
use crate::state::AppState;

const STORE_EVENTS: &[&str] = &["store-changed"];
const SETTINGS_EVENTS: &[&str] = &["store-changed", "settings-changed"];
const FOCUS_EVENTS: &[&str] = &["focus-changed"];

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
    mutate_and_emit(app, STORE_EVENTS, move |state| state.add_task(input)).await
}

#[tauri::command]
pub async fn update_task(app: AppHandle, input: UpdateTaskInput) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.update_task(input)).await
}

#[tauri::command]
pub async fn delete_task(app: AppHandle, task_id: String) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.delete_task(&task_id)).await
}

#[tauri::command]
pub async fn toggle_task(app: AppHandle, task_id: String) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.toggle_task(&task_id)).await
}

#[tauri::command]
pub async fn move_tasks(app: AppHandle, input: MoveTasksInput) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, STORE_EVENTS, move |state| state.move_tasks(input)).await
}

#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    patch: FocusSettingsPatch,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, SETTINGS_EVENTS, move |state| {
        state.update_settings(patch)
    })
    .await
}

#[tauri::command]
pub async fn start_focus(app: AppHandle, task_id: Option<String>) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, move |state| state.start_focus(task_id)).await
}

#[tauri::command]
pub async fn pause_focus(app: AppHandle) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.pause_focus()).await
}

#[tauri::command]
pub async fn resume_focus(app: AppHandle) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.resume_focus()).await
}

#[tauri::command]
pub async fn stop_focus(app: AppHandle) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.stop_focus()).await
}

#[tauri::command]
pub async fn toggle_focus(app: AppHandle) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, |state| state.toggle_focus()).await
}

#[tauri::command]
pub async fn get_app_diagnostics(app: AppHandle) -> Result<AppDiagnostics, AppError> {
    let app_version = app.package_info().version.to_string();
    with_state(&app, move |state| Ok(state.diagnostics(app_version))).await
}

#[tauri::command]
pub async fn set_autostart(_app: AppHandle, _enabled: bool) -> Result<AppSnapshot, AppError> {
    Err(AppError::integration_unavailable(
        "Autostart integration is not available yet.",
    ))
}

#[tauri::command]
pub async fn open_tasks_window(
    app: AppHandle,
    intent: Option<TasksWindowIntent>,
) -> Result<(), AppError> {
    validate_tasks_window_intent(intent.as_ref())?;
    open_window(&app, "tasks", "Tasks", 960.0, 720.0)
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle) -> Result<(), AppError> {
    open_window(&app, "settings", "Settings", 720.0, 640.0)
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

async fn with_state<T, F>(app: &AppHandle, operation: F) -> Result<T, AppError>
where
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

async fn mutate_and_emit<F>(
    app: AppHandle,
    event_names: &'static [&'static str],
    mutation: F,
) -> Result<AppSnapshot, AppError>
where
    F: FnOnce(&mut AppState) -> Result<AppSnapshot, AppError> + Send + 'static,
{
    let snapshot = with_state(&app, mutation).await?;

    // A disappearing window must not turn a successful in-memory mutation into a failure.
    for &event_name in event_names {
        let _ = app.emit(event_name, &snapshot);
    }
    Ok(snapshot)
}

fn validate_tasks_window_intent(intent: Option<&TasksWindowIntent>) -> Result<(), AppError> {
    let Some(TasksWindowIntent::Task { task_id }) = intent else {
        return Ok(());
    };

    parse_task_id(task_id, "intent.taskId").map(|_| ())
}

fn open_window(
    app: &AppHandle,
    label: &str,
    title: &str,
    width: f64,
    height: f64,
) -> Result<(), AppError> {
    let window = match app.get_webview_window(label) {
        Some(window) => window,
        None => WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
            .title(title)
            .inner_size(width, height)
            .center()
            .build()
            .map_err(|_| {
                AppError::integration_unavailable("The desktop window could not be opened.")
            })?,
    };

    window
        .show()
        .map_err(|_| AppError::integration_unavailable("The desktop window could not be shown."))?;
    window.set_focus().map_err(|_| {
        AppError::integration_unavailable("The desktop window could not receive focus.")
    })?;
    Ok(())
}

fn is_allowed_release_url(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed == url && trimmed.starts_with("https://") && trimmed["https://".len()..].contains('.')
}

#[cfg(test)]
mod tests {
    use super::{greet, is_allowed_release_url, validate_tasks_window_intent};
    use crate::domain::TasksWindowIntent;

    #[test]
    fn greet_returns_a_rust_message() {
        assert_eq!(
            greet("DailyNotch"),
            "Hello, DailyNotch! DailyNotch Linux is running with Rust."
        );
    }

    #[test]
    fn task_window_intent_accepts_list_and_add_modes() {
        assert!(validate_tasks_window_intent(Some(&TasksWindowIntent::List)).is_ok());
        assert!(validate_tasks_window_intent(Some(&TasksWindowIntent::Add)).is_ok());
    }

    #[test]
    fn task_window_intent_rejects_an_invalid_task_id() {
        let error = validate_tasks_window_intent(Some(&TasksWindowIntent::Task {
            task_id: "not-a-uuid".to_owned(),
        }))
        .expect_err("invalid task intent should fail");

        assert_eq!(error.code, crate::domain::AppErrorCode::Validation);
    }

    #[test]
    fn release_url_validation_requires_an_https_host() {
        assert!(is_allowed_release_url("https://github.com/example/release"));
        assert!(!is_allowed_release_url("http://github.com/example/release"));
        assert!(!is_allowed_release_url("https://release"));
    }
}
