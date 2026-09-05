use tauri::{Runtime, WebviewWindow};

use crate::domain::AppError;

pub(crate) fn show_and_focus_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), AppError> {
    window
        .show()
        .map_err(|_| AppError::integration_unavailable("The desktop window could not be shown."))?;
    window.set_focus().map_err(|_| {
        AppError::integration_unavailable("The desktop window could not receive focus.")
    })
}
