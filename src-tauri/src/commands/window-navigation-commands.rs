use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::domain::{AppError, TasksWindowIntent};
use crate::services::{
    OverlayPresentationMode, SurfaceChangedPayload, SurfaceLabel, TasksWindowOrigin,
    WindowNavigationState, SURFACE_CHANGED_EVENT,
};

use super::window_commands::resize_overlay_for_surface;

fn current_presentation_origin<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<OverlayPresentationMode>, AppError> {
    app.try_state::<WindowNavigationState>()
        .ok_or_else(|| AppError::internal("The window navigation state is unavailable."))?
        .presentation_origin()
}

fn transition_surface<R: Runtime>(
    app: &AppHandle<R>,
    surface: SurfaceLabel,
    intent: Option<TasksWindowIntent>,
    presentation_mode: Option<OverlayPresentationMode>,
    presentation_origin: Option<OverlayPresentationMode>,
) -> Result<(), AppError> {
    resize_overlay_for_surface(app, surface)?;

    let state = app
        .try_state::<WindowNavigationState>()
        .ok_or_else(|| AppError::internal("The window navigation state is unavailable."))?;
    state.transition_to(surface, presentation_origin)?;

    app.emit(
        SURFACE_CHANGED_EVENT,
        SurfaceChangedPayload::new(surface, intent, presentation_mode),
    )
    .map_err(|_| AppError::integration_unavailable("The surface change could not be published."))
}

fn transition_preserving_origin<R: Runtime>(
    app: &AppHandle<R>,
    surface: SurfaceLabel,
    intent: Option<TasksWindowIntent>,
) -> Result<(), AppError> {
    let presentation_origin = current_presentation_origin(app)?;
    transition_surface(app, surface, intent, None, presentation_origin)
}

#[tauri::command]
pub async fn open_tasks_window<R: Runtime>(
    app: AppHandle<R>,
    intent: Option<TasksWindowIntent>,
    origin: Option<TasksWindowOrigin>,
) -> Result<(), AppError> {
    let intent = intent.unwrap_or(TasksWindowIntent::List);
    super::validate_tasks_window_intent(Some(&intent))?;
    let presentation_origin = origin.map(|value| value.presentation_mode);

    transition_surface(
        &app,
        SurfaceLabel::Tasks,
        Some(intent),
        None,
        presentation_origin,
    )
}

#[tauri::command]
pub async fn close_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let presentation_mode = current_presentation_origin(&app)?;

    transition_surface(&app, SurfaceLabel::Overlay, None, presentation_mode, None)
}

#[tauri::command]
pub async fn close_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    transition_surface(&app, SurfaceLabel::Overlay, None, None, None)
}

#[tauri::command]
pub async fn open_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    transition_preserving_origin(&app, SurfaceLabel::Settings, None)
}

#[tauri::command]
pub async fn return_to_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    transition_preserving_origin(&app, SurfaceLabel::Tasks, Some(TasksWindowIntent::List))
}
