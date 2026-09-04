use std::sync::Arc;

use tauri::{AppHandle, Manager, Runtime};

#[cfg(desktop)]
use super::autostart_adapter::make_tauri_autostart_backend;
use super::autostart_types::{
    AutostartBackendError, SharedAutostartBackend, UnavailableAutostartBackend,
    AUTOSTART_STATUS_ERROR_MESSAGE,
};
use crate::domain::{AppError, AutostartDiagnostic, IntegrationStatus};

const AUTOSTART_APP_NAME: &str = "dailynotch";
const AUTOSTART_ARGUMENT: &str = "--autostart";

/// Coordinates native autostart operations and translates their state to diagnostics.
pub(crate) struct AutostartService {
    backend: SharedAutostartBackend,
}

impl AutostartService {
    pub(crate) fn new(backend: SharedAutostartBackend) -> Self {
        Self { backend }
    }

    pub(crate) fn set_enabled(&self, enabled: bool) -> Result<bool, AutostartBackendError> {
        if enabled {
            self.backend.enable()?;
        } else {
            self.backend.disable()?;
        }

        self.backend.is_enabled()
    }

    pub(crate) fn diagnostic(&self) -> AutostartDiagnostic {
        match self.backend.is_enabled() {
            Ok(enabled) => AutostartDiagnostic {
                enabled,
                status: IntegrationStatus::Available,
                message: None,
            },
            Err(error) => error.diagnostic(),
        }
    }
}

#[cfg(desktop)]
pub(crate) fn initialize_autostart<R: Runtime>(app: &mut tauri::App<R>) {
    let plugin = tauri_plugin_autostart::Builder::new()
        .app_name(AUTOSTART_APP_NAME)
        .arg(AUTOSTART_ARGUMENT)
        .build();

    let backend: SharedAutostartBackend = match app.handle().plugin(plugin) {
        Ok(()) => Arc::new(make_tauri_autostart_backend(app.handle().clone())),
        Err(_) => Arc::new(UnavailableAutostartBackend),
    };

    app.manage(AutostartService::new(backend));
}

#[cfg(not(desktop))]
pub(crate) fn initialize_autostart<R: Runtime>(app: &mut tauri::App<R>) {
    app.manage(AutostartService::new(Arc::new(UnavailableAutostartBackend)));
}

pub(crate) async fn current_autostart_diagnostic<R: Runtime>(
    app: &AppHandle<R>,
) -> AutostartDiagnostic {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        app.try_state::<AutostartService>()
            .map(|service| service.diagnostic())
            .unwrap_or_default()
    })
    .await
    .unwrap_or_else(|_| AutostartDiagnostic {
        enabled: false,
        status: IntegrationStatus::Error,
        message: Some(AUTOSTART_STATUS_ERROR_MESSAGE.to_owned()),
    })
}

pub(crate) async fn set_autostart_entry<R: Runtime>(
    app: &AppHandle<R>,
    enabled: bool,
) -> Result<(), AppError> {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let service = app
            .try_state::<AutostartService>()
            .ok_or_else(|| AutostartBackendError::Unavailable.app_error())?;
        service
            .set_enabled(enabled)
            .map(|_| ())
            .map_err(AutostartBackendError::app_error)
    })
    .await
    .map_err(|_| AppError::internal("The autostart operation could not be completed."))?
}

#[cfg(test)]
#[path = "autostart-tests.rs"]
mod tests;
