use std::sync::Mutex;

use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::domain::{
    parse_task_id, AppDiagnostics, AppError, AppSnapshot, CreateTaskInput, FocusSettingsPatch,
    MoveTasksInput, TasksWindowIntent, UpdateTaskInput,
};
use crate::state::AppState;

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
    task_id: Option<String>,
) -> Result<AppSnapshot, AppError> {
    mutate_and_emit(app, FOCUS_EVENTS, move |state| state.start_focus(task_id)).await
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
    with_state(&app, move |state| Ok(state.diagnostics(app_version))).await
}

#[tauri::command]
pub async fn set_autostart<R: Runtime>(
    _app: AppHandle<R>,
    _enabled: bool,
) -> Result<AppSnapshot, AppError> {
    Err(AppError::integration_unavailable(
        "Autostart integration is not available yet.",
    ))
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
pub async fn open_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
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

fn open_tasks_window_with_intent<R: Runtime>(
    app: &AppHandle<R>,
    intent: &TasksWindowIntent,
) -> Result<(), AppError> {
    let existing_window = app.get_webview_window("tasks");
    let is_existing_window = existing_window.is_some();
    let window = match existing_window {
        Some(window) => window,
        None => WebviewWindowBuilder::new(
            app,
            "tasks",
            WebviewUrl::App(tasks_window_url(intent).into()),
        )
        .title("Tasks")
        .inner_size(960.0, 720.0)
        .center()
        .build()
        .map_err(|_| {
            AppError::integration_unavailable("The desktop window could not be opened.")
        })?,
    };

    show_and_focus_window(&window)?;

    if is_existing_window {
        window
            .emit(TASKS_WINDOW_INTENT_EVENT, intent.clone())
            .map_err(|_| {
                AppError::integration_unavailable("The Tasks window could not receive its intent.")
            })?;
    }

    Ok(())
}

fn tasks_window_url(intent: &TasksWindowIntent) -> String {
    let intent_query = match intent {
        TasksWindowIntent::List => "list".to_owned(),
        TasksWindowIntent::Add => "add".to_owned(),
        TasksWindowIntent::Task { task_id } => format!("task&taskId={task_id}"),
    };

    format!("index.html?surface=tasks&intent={intent_query}")
}

fn open_window<R: Runtime>(
    app: &AppHandle<R>,
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

    show_and_focus_window(&window)?;
    Ok(())
}

fn show_and_focus_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), AppError> {
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
#[path = "../commands-tests.rs"]
mod tests;
