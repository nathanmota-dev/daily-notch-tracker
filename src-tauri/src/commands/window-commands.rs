use tauri::{
    AppHandle, LogicalSize, LogicalUnit, Manager, Runtime, WebviewWindow, WindowSizeConstraints,
};

use crate::domain::AppError;
use crate::services::{focus_overlay, SurfaceLabel};

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

pub(super) fn is_allowed_release_url(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed == url && trimmed.starts_with("https://") && trimmed["https://".len()..].contains('.')
}
