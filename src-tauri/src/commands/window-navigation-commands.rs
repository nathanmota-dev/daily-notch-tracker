use tauri::{AppHandle, Runtime};

use crate::domain::{AppError, TasksWindowIntent};
use crate::services::{
    close_reusable_window, close_tasks_window_and_restore, hide_reusable_window,
    remember_tasks_window_origin, TasksWindowOrigin,
};

use super::window_dimensions::SETTINGS_WINDOW_DIMENSIONS;
use super::{open_tasks_window_with_intent, open_window};

#[tauri::command]
pub async fn open_tasks_window<R: Runtime>(
    app: AppHandle<R>,
    intent: Option<TasksWindowIntent>,
    origin: Option<TasksWindowOrigin>,
) -> Result<(), AppError> {
    let intent = intent.unwrap_or(TasksWindowIntent::List);
    super::validate_tasks_window_intent(Some(&intent))?;
    remember_tasks_window_origin(&app, origin)?;
    open_tasks_window_with_intent(&app, &intent)
}

#[tauri::command]
pub async fn close_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    close_tasks_window_and_restore(&app)
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
pub async fn return_to_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    open_tasks_window_with_intent(&app, &TasksWindowIntent::List)?;
    hide_reusable_window(&app, "settings", "The Settings window could not be hidden.")
}
