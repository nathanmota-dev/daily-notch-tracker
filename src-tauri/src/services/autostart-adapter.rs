#[cfg(desktop)]
use std::io::ErrorKind;
#[cfg(test)]
use std::sync::Mutex;

#[cfg(desktop)]
use tauri::{AppHandle, Runtime};
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt;

use super::autostart_types::{AutostartBackend, AutostartBackendError};

#[cfg(desktop)]
use tauri_plugin_autostart::Error as TauriAutostartError;

#[cfg(desktop)]
pub(crate) struct TauriAutostartBackend<R: Runtime> {
    app: AppHandle<R>,
}

#[cfg(desktop)]
pub(crate) fn make_tauri_autostart_backend<R: Runtime>(
    app: AppHandle<R>,
) -> TauriAutostartBackend<R> {
    TauriAutostartBackend { app }
}

#[cfg(desktop)]
impl<R: Runtime> AutostartBackend for TauriAutostartBackend<R> {
    fn enable(&self) -> Result<(), AutostartBackendError> {
        self.app
            .autolaunch()
            .enable()
            .map_err(map_tauri_autostart_error)
    }

    fn disable(&self) -> Result<(), AutostartBackendError> {
        self.app
            .autolaunch()
            .disable()
            .map_err(map_tauri_autostart_error)
    }

    fn is_enabled(&self) -> Result<bool, AutostartBackendError> {
        self.app
            .autolaunch()
            .is_enabled()
            .map_err(map_tauri_autostart_error)
    }
}

#[cfg(desktop)]
pub(crate) fn map_tauri_autostart_error(error: TauriAutostartError) -> AutostartBackendError {
    if is_permission_error(&error) {
        AutostartBackendError::PermissionDenied
    } else {
        AutostartBackendError::Failed
    }
}

#[cfg(desktop)]
fn is_permission_error(error: &TauriAutostartError) -> bool {
    if matches!(error, TauriAutostartError::Io(error) if error.kind() == ErrorKind::PermissionDenied)
    {
        return true;
    }

    let message = error.to_string().to_ascii_lowercase();
    [
        "permission denied",
        "access denied",
        "operation not permitted",
    ]
    .iter()
    .any(|part| message.contains(part))
}

#[cfg(test)]
#[derive(Debug, Default)]
pub(crate) struct MockAutostartBackend {
    state: Mutex<MockAutostartBackendState>,
}

#[cfg(test)]
#[derive(Debug, Default)]
struct MockAutostartBackendState {
    enabled: bool,
    enable_calls: usize,
    disable_calls: usize,
    is_enabled_calls: usize,
    enable_error: Option<AutostartBackendError>,
    disable_error: Option<AutostartBackendError>,
    is_enabled_error: Option<AutostartBackendError>,
}

#[cfg(test)]
impl MockAutostartBackend {
    pub(crate) fn with_enabled(enabled: bool) -> Self {
        let backend = Self::default();
        backend.set_enabled(enabled);
        backend
    }

    pub(crate) fn set_enabled(&self, enabled: bool) {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .enabled = enabled;
    }

    pub(crate) fn set_enable_error(&self, error: Option<AutostartBackendError>) {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .enable_error = error;
    }

    pub(crate) fn set_disable_error(&self, error: Option<AutostartBackendError>) {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .disable_error = error;
    }

    pub(crate) fn set_is_enabled_error(&self, error: Option<AutostartBackendError>) {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .is_enabled_error = error;
    }

    pub(crate) fn enable_calls(&self) -> usize {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .enable_calls
    }

    pub(crate) fn disable_calls(&self) -> usize {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .disable_calls
    }

    pub(crate) fn is_enabled_calls(&self) -> usize {
        self.state
            .lock()
            .expect("mock autostart state should not be poisoned")
            .is_enabled_calls
    }
}

#[cfg(test)]
impl AutostartBackend for MockAutostartBackend {
    fn enable(&self) -> Result<(), AutostartBackendError> {
        let mut state = self
            .state
            .lock()
            .expect("mock autostart state should not be poisoned");
        state.enable_calls += 1;
        if let Some(error) = state.enable_error {
            return Err(error);
        }
        state.enabled = true;
        Ok(())
    }

    fn disable(&self) -> Result<(), AutostartBackendError> {
        let mut state = self
            .state
            .lock()
            .expect("mock autostart state should not be poisoned");
        state.disable_calls += 1;
        if let Some(error) = state.disable_error {
            return Err(error);
        }
        state.enabled = false;
        Ok(())
    }

    fn is_enabled(&self) -> Result<bool, AutostartBackendError> {
        let mut state = self
            .state
            .lock()
            .expect("mock autostart state should not be poisoned");
        state.is_enabled_calls += 1;
        if let Some(error) = state.is_enabled_error {
            return Err(error);
        }
        Ok(state.enabled)
    }
}
