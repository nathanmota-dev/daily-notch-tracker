use tauri::{
    AppHandle, Emitter, LogicalSize, LogicalUnit, Manager, Runtime, WebviewWindow,
    WindowSizeConstraints,
};

use crate::domain::{AppError, WindowMonitorSnapshot, WindowPlacementSnapshot};
use crate::services::{focus_overlay, SurfaceLabel, WindowNavigationState};

use super::window_dimensions::{
    WindowDimensionContract, CONTENT_WINDOW_DIMENSIONS, OVERLAY_WINDOW_DIMENSIONS,
};

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

pub(super) fn resize_overlay_for_surface<R: Runtime>(
    app: &AppHandle<R>,
    surface: SurfaceLabel,
) -> Result<(), AppError> {
    let window = overlay_window(app)?;
    let dimensions = match surface {
        SurfaceLabel::Overlay => OVERLAY_WINDOW_DIMENSIONS,
        SurfaceLabel::Tasks | SurfaceLabel::Settings => CONTENT_WINDOW_DIMENSIONS,
    };

    let constraints = if surface == SurfaceLabel::Overlay {
        WindowSizeConstraints::default()
    } else {
        window_size_constraints(dimensions)
    };

    window.set_size_constraints(constraints).map_err(|_| {
        AppError::integration_unavailable("The desktop window could not be resized.")
    })?;
    window
        .set_size(LogicalSize::new(
            dimensions.preferred.width,
            dimensions.preferred.height,
        ))
        .map_err(|_| {
            AppError::integration_unavailable("The desktop window could not be resized.")
        })?;
    focus_overlay(app)
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
    let window = overlay_window(&app)?;
    let navigation = app
        .try_state::<WindowNavigationState>()
        .ok_or_else(|| AppError::internal("The window navigation state is unavailable."))?;
    if !matches!(
        navigation.active_surface()?,
        SurfaceLabel::Tasks | SurfaceLabel::Settings
    ) {
        return Err(AppError::integration_unavailable(
            "Window placement is available only for extended surfaces.",
        ));
    }
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
