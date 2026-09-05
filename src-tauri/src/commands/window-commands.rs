use tauri::{
    AppHandle, Emitter, LogicalSize, LogicalUnit, Manager, PhysicalPosition, PhysicalSize, Runtime,
    WebviewWindow, WindowSizeConstraints,
};

use crate::domain::{AppError, WindowMonitorSnapshot, WindowPlacementSnapshot};
use crate::services::{SurfaceLabel, WindowNavigationState};

use super::window_dimensions::{WindowDimensionContract, CONTENT_WINDOW_DIMENSIONS};

const CONTENT_WINDOW_GAP: i64 = 8;

fn window_size_constraints(dimensions: WindowDimensionContract) -> WindowSizeConstraints {
    WindowSizeConstraints {
        min_width: Some(LogicalUnit::new(dimensions.minimum.width).into()),
        min_height: Some(LogicalUnit::new(dimensions.minimum.height).into()),
        max_width: Some(LogicalUnit::new(dimensions.maximum.width).into()),
        max_height: Some(LogicalUnit::new(dimensions.maximum.height).into()),
    }
}

fn overlay_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, AppError> {
    app.get_webview_window("overlay").ok_or_else(|| {
        AppError::integration_unavailable("The overlay window could not be focused.")
    })
}

pub(super) fn content_window<R: Runtime>(
    app: &AppHandle<R>,
    surface: SurfaceLabel,
) -> Result<WebviewWindow<R>, AppError> {
    let label = match surface {
        SurfaceLabel::Tasks => "tasks",
        SurfaceLabel::Settings => "settings",
        SurfaceLabel::Overlay => return overlay_window(app),
    };

    app.get_webview_window(label)
        .ok_or_else(|| AppError::integration_unavailable("The content window could not be opened."))
}

pub(super) fn configure_content_window<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<(), AppError> {
    window
        .set_size_constraints(window_size_constraints(CONTENT_WINDOW_DIMENSIONS))
        .map_err(|_| {
            AppError::integration_unavailable("The content window could not be resized.")
        })?;
    window
        .set_size(LogicalSize::new(
            CONTENT_WINDOW_DIMENSIONS.preferred.width,
            CONTENT_WINDOW_DIMENSIONS.preferred.height,
        ))
        .map_err(|_| AppError::integration_unavailable("The content window could not be resized."))
}

fn clamp_axis(value: i64, minimum: i64, maximum: i64) -> i32 {
    let upper_bound = maximum.max(minimum);
    value.clamp(minimum, upper_bound) as i32
}

fn preferred_content_position(
    overlay_position: PhysicalPosition<i32>,
    overlay_size: PhysicalSize<u32>,
    content_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let overlay_center_x = i64::from(overlay_position.x) + i64::from(overlay_size.width) / 2;
    let position_y =
        i64::from(overlay_position.y) + i64::from(overlay_size.height) + CONTENT_WINDOW_GAP;

    PhysicalPosition::new(
        (overlay_center_x - i64::from(content_size.width) / 2) as i32,
        position_y as i32,
    )
}

fn stacked_content_position(
    overlay_position: PhysicalPosition<i32>,
    overlay_size: PhysicalSize<u32>,
    content_size: PhysicalSize<u32>,
    work_area_position: PhysicalPosition<i32>,
    work_area_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let preferred = preferred_content_position(overlay_position, overlay_size, content_size);
    let content_width = i64::from(content_size.width);
    let content_height = i64::from(content_size.height);
    let work_area_x = i64::from(work_area_position.x);
    let work_area_y = i64::from(work_area_position.y);
    let work_area_width = i64::from(work_area_size.width);
    let work_area_height = i64::from(work_area_size.height);

    PhysicalPosition::new(
        clamp_axis(
            i64::from(preferred.x),
            work_area_x,
            work_area_x + work_area_width - content_width,
        ),
        clamp_axis(
            i64::from(preferred.y),
            work_area_y,
            work_area_y + work_area_height - content_height,
        ),
    )
}

pub(super) fn position_content_window<R: Runtime>(
    overlay: &WebviewWindow<R>,
    content: &WebviewWindow<R>,
) -> Result<(), AppError> {
    let overlay_position = overlay
        .inner_position()
        .map_err(|_| AppError::integration_unavailable("The overlay position is unavailable."))?;
    let overlay_size = overlay
        .inner_size()
        .map_err(|_| AppError::integration_unavailable("The overlay size is unavailable."))?;
    let content_size = content
        .inner_size()
        .map_err(|_| AppError::integration_unavailable("The content size is unavailable."))?;
    let monitor = overlay
        .current_monitor()
        .map_err(|_| AppError::integration_unavailable("The primary monitor is unavailable."))?
        .or(overlay.primary_monitor().map_err(|_| {
            AppError::integration_unavailable("The primary monitor is unavailable.")
        })?);
    let position = monitor
        .map(|monitor| {
            let work_area = monitor.work_area();
            stacked_content_position(
                overlay_position,
                overlay_size,
                content_size,
                work_area.position,
                work_area.size,
            )
        })
        .unwrap_or_else(|| {
            preferred_content_position(overlay_position, overlay_size, content_size)
        });

    content.set_position(position).map_err(|_| {
        AppError::integration_unavailable("The content window could not be positioned.")
    })
}

fn capture_window_placement<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<WindowPlacementSnapshot, AppError> {
    let position = window
        .inner_position()
        .map_err(|_| AppError::integration_unavailable("The window position is unavailable."))?;
    let size = window
        .inner_size()
        .map_err(|_| AppError::integration_unavailable("The window size is unavailable."))?;
    let scale_factor = window
        .scale_factor()
        .map_err(|_| AppError::integration_unavailable("The window scale is unavailable."))?;
    let monitor = window
        .current_monitor()
        .map_err(|_| AppError::integration_unavailable("The current monitor is unavailable."))?
        .ok_or_else(|| AppError::integration_unavailable("The current monitor is unavailable."))?;

    Ok(WindowPlacementSnapshot {
        revision: 0,
        window_label: "overlay".to_owned(),
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        scale_factor,
        monitor: WindowMonitorSnapshot {
            name: monitor.name().cloned(),
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
            scale_factor: monitor.scale_factor(),
        },
    })
}

#[tauri::command]
pub async fn get_window_placement<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<WindowPlacementSnapshot>, AppError> {
    super::with_state(&app, |state| Ok(state.window_placement())).await
}

#[tauri::command]
pub async fn save_window_placement<R: Runtime>(
    app: AppHandle<R>,
) -> Result<WindowPlacementSnapshot, AppError> {
    let navigation = app
        .try_state::<WindowNavigationState>()
        .ok_or_else(|| AppError::internal("The window navigation state is unavailable."))?;
    let surface = navigation.active_surface()?;
    if !matches!(surface, SurfaceLabel::Tasks | SurfaceLabel::Settings) {
        let _ = overlay_window(&app)?;
        return Err(AppError::integration_unavailable(
            "Window placement is available only for extended surfaces.",
        ));
    }
    let window = content_window(&app, surface)?;
    let placement = capture_window_placement(&window)?;
    persist_window_placement(app, placement).await
}

pub(super) async fn persist_window_placement<R: Runtime>(
    app: AppHandle<R>,
    placement: WindowPlacementSnapshot,
) -> Result<WindowPlacementSnapshot, AppError> {
    let saved =
        super::with_state(&app, move |state| state.save_window_placement(placement)).await?;

    let _ = app.emit(super::WINDOW_PLACEMENT_CHANGED_EVENT, &saved);
    Ok(saved)
}

pub(super) fn is_allowed_release_url(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed == url && trimmed.starts_with("https://") && trimmed["https://".len()..].contains('.')
}
