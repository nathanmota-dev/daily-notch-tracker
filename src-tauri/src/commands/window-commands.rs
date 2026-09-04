use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::domain::{AppError, TasksWindowIntent};
use crate::services::show_and_focus_window;

use super::{calculate_content_window_position, window_dimensions::WindowDimensionContract};
use super::{window_dimensions::TASKS_WINDOW_DIMENSIONS, TASKS_WINDOW_INTENT_EVENT};

pub(super) fn open_tasks_window_with_intent<R: Runtime>(
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
        .inner_size(
            TASKS_WINDOW_DIMENSIONS.preferred.width,
            TASKS_WINDOW_DIMENSIONS.preferred.height,
        )
        .min_inner_size(
            TASKS_WINDOW_DIMENSIONS.minimum.width,
            TASKS_WINDOW_DIMENSIONS.minimum.height,
        )
        .max_inner_size(
            TASKS_WINDOW_DIMENSIONS.maximum.width,
            TASKS_WINDOW_DIMENSIONS.maximum.height,
        )
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|_| {
            AppError::integration_unavailable("The desktop window could not be opened.")
        })?,
    };

    position_content_window_below_overlay(app, &window)?;
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

fn position_content_window_below_overlay<R: Runtime>(
    app: &AppHandle<R>,
    content_window: &WebviewWindow<R>,
) -> Result<(), AppError> {
    let Some(overlay_window) = app.get_webview_window("overlay") else {
        return Ok(());
    };
    let (Ok(overlay_position), Ok(overlay_size), Ok(content_window_size)) = (
        overlay_window.outer_position(),
        overlay_window.outer_size(),
        content_window.outer_size(),
    ) else {
        return Ok(());
    };
    let work_area = overlay_window
        .current_monitor()
        .ok()
        .flatten()
        .map(|monitor| *monitor.work_area());
    let position = calculate_content_window_position(
        overlay_position,
        overlay_size,
        content_window_size,
        work_area,
    );

    content_window
        .set_position(PhysicalPosition::new(position.x, position.y))
        .map_err(|_| {
            AppError::integration_unavailable("The content window could not be positioned.")
        })
}

pub(super) fn tasks_window_url(intent: &TasksWindowIntent) -> String {
    let intent_query = match intent {
        TasksWindowIntent::List => "list".to_owned(),
        TasksWindowIntent::Add => "add".to_owned(),
        TasksWindowIntent::Task { task_id } => format!("task&taskId={task_id}"),
    };

    format!("index.html?surface=tasks&intent={intent_query}")
}

pub(super) fn open_window<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    title: &str,
    dimensions: WindowDimensionContract,
) -> Result<(), AppError> {
    let window = match app.get_webview_window(label) {
        Some(window) => window,
        None => WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
            .title(title)
            .inner_size(dimensions.preferred.width, dimensions.preferred.height)
            .min_inner_size(dimensions.minimum.width, dimensions.minimum.height)
            .max_inner_size(dimensions.maximum.width, dimensions.maximum.height)
            .resizable(true)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .skip_taskbar(true)
            .visible(false)
            .build()
            .map_err(|_| {
                AppError::integration_unavailable("The desktop window could not be opened.")
            })?,
    };

    position_content_window_below_overlay(app, &window)?;
    show_and_focus_window(&window)?;
    Ok(())
}

pub(super) fn is_allowed_release_url(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed == url && trimmed.starts_with("https://") && trimmed["https://".len()..].contains('.')
}
