use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::domain::{AppError, ShortcutStatus};
use crate::services::sync_tray_menu;
use crate::state::AppState;

pub(crate) fn publish_shortcut_status<R: Runtime>(
    app: &AppHandle<R>,
    status: ShortcutStatus,
) -> Result<(), AppError> {
    let state = app
        .try_state::<Mutex<AppState>>()
        .ok_or_else(|| AppError::internal("The application state is unavailable."))?;
    let snapshot = state
        .lock()
        .map_err(|_| AppError::internal("The application state is unavailable."))?
        .set_shortcut_status(status)?;

    let Some(snapshot) = snapshot else {
        return Ok(());
    };

    let _ = app.emit("shortcut-changed", &snapshot);
    sync_tray_menu(app, &snapshot);
    Ok(())
}
