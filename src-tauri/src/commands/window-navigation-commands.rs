use tauri::{AppHandle, Emitter, EventTarget, Manager, Runtime, WebviewWindow};

use crate::domain::{AppError, TasksWindowIntent};
use crate::services::{
    show_and_focus_window, OverlayChildWindowChangedPayload, OverlayPresentationMode,
    SurfaceChangedPayload, SurfaceLabel, TasksWindowOrigin, WindowNavigationState,
    OVERLAY_CHILD_WINDOW_CHANGED_EVENT, SURFACE_CHANGED_EVENT,
};

use super::window_commands::{configure_content_window, content_window, position_content_window};

fn current_presentation_origin<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<OverlayPresentationMode>, AppError> {
    app.try_state::<WindowNavigationState>()
        .ok_or_else(|| AppError::internal("The window navigation state is unavailable."))?
        .presentation_origin()
}

fn transition_to<R: Runtime>(
    app: &AppHandle<R>,
    surface: SurfaceLabel,
    presentation_origin: Option<OverlayPresentationMode>,
) -> Result<(), AppError> {
    app.try_state::<WindowNavigationState>()
        .ok_or_else(|| AppError::internal("The window navigation state is unavailable."))?
        .transition_to(surface, presentation_origin)?;
    Ok(())
}

fn publish_surface_changed<R: Runtime>(
    window: &WebviewWindow<R>,
    surface: SurfaceLabel,
    intent: Option<TasksWindowIntent>,
    presentation_mode: Option<OverlayPresentationMode>,
) -> Result<(), AppError> {
    window
        .emit_to(
            EventTarget::webview_window(window.label()),
            SURFACE_CHANGED_EVENT,
            SurfaceChangedPayload::new(surface, intent, presentation_mode),
        )
        .map_err(|_| {
            AppError::integration_unavailable("The surface change could not be published.")
        })
}

fn publish_overlay_child_state<R: Runtime>(
    overlay: &WebviewWindow<R>,
    open: bool,
) -> Result<(), AppError> {
    overlay
        .emit_to(
            EventTarget::webview_window(overlay.label()),
            OVERLAY_CHILD_WINDOW_CHANGED_EVENT,
            OverlayChildWindowChangedPayload::new(open),
        )
        .map_err(|_| {
            AppError::integration_unavailable(
                "The overlay child-window state could not be published.",
            )
        })
}

fn hide_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), AppError> {
    window
        .hide()
        .map_err(|_| AppError::integration_unavailable("The desktop window could not be hidden."))
}

fn show_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), AppError> {
    window
        .show()
        .map_err(|_| AppError::integration_unavailable("The desktop window could not be shown."))
}

fn hide_optional_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> Result<(), AppError> {
    if let Some(window) = app.get_webview_window(label) {
        hide_window(&window)?;
    }

    Ok(())
}

fn keep_overlay_expanded(origin: Option<OverlayPresentationMode>) -> bool {
    origin == Some(OverlayPresentationMode::Expanded)
}

fn open_content_window<R: Runtime>(
    app: &AppHandle<R>,
    surface: SurfaceLabel,
    other_window_label: &str,
    intent: Option<TasksWindowIntent>,
    presentation_origin: Option<OverlayPresentationMode>,
) -> Result<(), AppError> {
    let overlay = content_window(app, SurfaceLabel::Overlay)?;
    let content = content_window(app, surface)?;

    hide_optional_window(app, other_window_label)?;
    configure_content_window(&content)?;
    position_content_window(&overlay, &content)?;
    transition_to(app, surface, presentation_origin)?;
    show_window(&overlay)?;
    if keep_overlay_expanded(presentation_origin) {
        publish_surface_changed(
            &overlay,
            SurfaceLabel::Overlay,
            None,
            Some(OverlayPresentationMode::Expanded),
        )?;
        publish_overlay_child_state(&overlay, true)?;
    }

    show_and_focus_window(&content)?;
    publish_surface_changed(&content, surface, intent, None)
}

fn close_content_windows<R: Runtime>(
    app: &AppHandle<R>,
    window_labels: &[&str],
) -> Result<(), AppError> {
    let presentation_mode = current_presentation_origin(app)?;
    let overlay = content_window(app, SurfaceLabel::Overlay)?;

    for label in window_labels {
        hide_optional_window(app, label)?;
    }
    transition_to(app, SurfaceLabel::Overlay, None)?;
    show_and_focus_window(&overlay)?;
    publish_surface_changed(
        &overlay,
        SurfaceLabel::Overlay,
        None,
        Some(presentation_mode.unwrap_or(OverlayPresentationMode::Collapsed)),
    )?;
    publish_overlay_child_state(&overlay, false)
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
    open_content_window(
        &app,
        SurfaceLabel::Tasks,
        "settings",
        Some(intent),
        presentation_origin,
    )
}

#[tauri::command]
pub async fn close_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    close_content_windows(&app, &["tasks", "settings"])
}

#[tauri::command]
pub async fn close_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let _settings = content_window(&app, SurfaceLabel::Settings)?;
    close_content_windows(&app, &["settings"])
}

#[tauri::command]
pub async fn open_settings_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let presentation_origin = current_presentation_origin(&app)?;
    open_content_window(
        &app,
        SurfaceLabel::Settings,
        "tasks",
        None,
        presentation_origin,
    )
}

#[tauri::command]
pub async fn return_to_tasks_window<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let presentation_origin = current_presentation_origin(&app)?;
    let overlay = content_window(&app, SurfaceLabel::Overlay)?;
    let tasks = content_window(&app, SurfaceLabel::Tasks)?;

    hide_optional_window(&app, "settings")?;
    configure_content_window(&tasks)?;
    position_content_window(&overlay, &tasks)?;
    transition_to(&app, SurfaceLabel::Tasks, presentation_origin)?;
    show_and_focus_window(&tasks)?;
    publish_surface_changed(
        &tasks,
        SurfaceLabel::Tasks,
        Some(TasksWindowIntent::List),
        None,
    )
}
