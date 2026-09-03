use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::domain::AppError;
use crate::services::show_and_focus_window;

pub(super) fn open_window<R: Runtime>(
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

pub(super) fn is_allowed_release_url(url: &str) -> bool {
    let trimmed = url.trim();
    trimmed == url && trimmed.starts_with("https://") && trimmed["https://".len()..].contains('.')
}
