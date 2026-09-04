#[cfg(desktop)]
use tauri::{AppHandle, Runtime};

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[cfg(desktop)]
use super::global_shortcut_types::{ShortcutBackend, ShortcutBackendError};

#[cfg(desktop)]
pub(crate) struct TauriGlobalShortcutBackend<R: Runtime> {
    app: AppHandle<R>,
}

#[cfg(desktop)]
impl<R: Runtime> TauriGlobalShortcutBackend<R> {
    pub(crate) fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

#[cfg(desktop)]
impl<R: Runtime> ShortcutBackend for TauriGlobalShortcutBackend<R> {
    fn register(&self) -> Result<(), ShortcutBackendError> {
        self.app
            .global_shortcut()
            .register(shortcut_from_native_parts())
            .map_err(|_| ShortcutBackendError::Failed)
    }

    fn unregister(&self) -> Result<(), ShortcutBackendError> {
        self.app
            .global_shortcut()
            .unregister(shortcut_from_native_parts())
            .map_err(|_| ShortcutBackendError::Failed)
    }
}

#[cfg(desktop)]
pub(crate) fn shortcut_from_native_parts() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
}

#[cfg(test)]
use std::sync::Mutex;

#[cfg(test)]
#[derive(Debug, Default)]
pub(crate) struct MockShortcutBackend {
    state: Mutex<MockShortcutBackendState>,
}

#[cfg(test)]
#[derive(Debug, Default)]
struct MockShortcutBackendState {
    register_calls: usize,
    unregister_calls: usize,
    register_error: Option<ShortcutBackendError>,
    unregister_error: Option<ShortcutBackendError>,
}

#[cfg(test)]
impl MockShortcutBackend {
    pub(crate) fn set_register_error(&self, error: Option<ShortcutBackendError>) {
        self.state
            .lock()
            .expect("mock backend state should not be poisoned")
            .register_error = error;
    }

    pub(crate) fn set_unregister_error(&self, error: Option<ShortcutBackendError>) {
        self.state
            .lock()
            .expect("mock backend state should not be poisoned")
            .unregister_error = error;
    }

    pub(crate) fn register_calls(&self) -> usize {
        self.state
            .lock()
            .expect("mock backend state should not be poisoned")
            .register_calls
    }

    pub(crate) fn unregister_calls(&self) -> usize {
        self.state
            .lock()
            .expect("mock backend state should not be poisoned")
            .unregister_calls
    }
}

#[cfg(test)]
impl ShortcutBackend for MockShortcutBackend {
    fn register(&self) -> Result<(), ShortcutBackendError> {
        let mut state = self
            .state
            .lock()
            .expect("mock backend state should not be poisoned");
        state.register_calls += 1;
        match state.register_error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }

    fn unregister(&self) -> Result<(), ShortcutBackendError> {
        let mut state = self
            .state
            .lock()
            .expect("mock backend state should not be poisoned");
        state.unregister_calls += 1;
        match state.unregister_error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
