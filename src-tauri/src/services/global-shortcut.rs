use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime};

#[cfg(desktop)]
use super::desktop_session::graphical_session_available;
use super::global_shortcut_types::{
    lock_runtime_state, SharedShortcutBackend, ShortcutBackendError, ShortcutEventState,
    ShortcutRuntimeState,
};

#[cfg(desktop)]
use super::global_shortcut_adapter::{shortcut_from_native_parts, TauriGlobalShortcutBackend};
#[cfg(desktop)]
use crate::domain::ShortcutStatus;

/// Coordinates registration, cleanup, and press debouncing for the app shortcut.
pub(crate) struct GlobalShortcutService {
    backend: SharedShortcutBackend,
    state: Mutex<ShortcutRuntimeState>,
}

impl GlobalShortcutService {
    pub(crate) fn new(backend: SharedShortcutBackend) -> Self {
        Self {
            backend,
            state: Mutex::new(ShortcutRuntimeState::default()),
        }
    }

    pub(crate) fn register(&self) -> Result<(), ShortcutBackendError> {
        let mut state = lock_runtime_state(&self.state);
        if state.registered {
            return Ok(());
        }

        self.backend.register()?;
        state.registered = true;
        state.pressed = false;
        Ok(())
    }

    pub(crate) fn unregister(&self) -> Result<(), ShortcutBackendError> {
        let mut state = lock_runtime_state(&self.state);
        if !state.registered {
            state.pressed = false;
            return Ok(());
        }

        let result = self.backend.unregister();
        state.pressed = false;
        if result.is_ok() {
            state.registered = false;
        }
        result
    }

    fn accept_press(&self) -> bool {
        let mut state = lock_runtime_state(&self.state);
        if !state.registered || state.pressed {
            return false;
        }

        state.pressed = true;
        true
    }

    fn release_press(&self) {
        lock_runtime_state(&self.state).pressed = false;
    }

    #[cfg(test)]
    fn runtime_state(&self) -> ShortcutRuntimeState {
        lock_runtime_state(&self.state).clone()
    }
}

#[cfg(desktop)]
pub(crate) fn initialize_global_shortcut<R: Runtime>(app: &mut tauri::App<R>) {
    if !graphical_session_available() {
        let _ = crate::commands::publish_shortcut_status(
            app.handle(),
            ShortcutBackendError::Unavailable.status(),
        );
        return;
    }

    if app.try_state::<GlobalShortcutService>().is_none() {
        let plugin = tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if shortcut == &default_shortcut() {
                    handle_native_shortcut_event(app, event.state());
                }
            })
            .build();

        if app.handle().plugin(plugin).is_err() {
            let _ = crate::commands::publish_shortcut_status(app.handle(), ShortcutStatus::Error);
            return;
        }

        let backend = TauriGlobalShortcutBackend::new(app.handle().clone());
        app.manage(GlobalShortcutService::new(std::sync::Arc::new(backend)));
    }

    let status = app
        .try_state::<GlobalShortcutService>()
        .map(|service| match service.register() {
            Ok(()) => ShortcutStatus::Registered,
            Err(error) => error.status(),
        })
        .unwrap_or(ShortcutStatus::Error);
    let _ = crate::commands::publish_shortcut_status(app.handle(), status);
}

#[cfg(not(desktop))]
pub(crate) fn initialize_global_shortcut<R: Runtime>(app: &mut tauri::App<R>) {
    let _ = crate::commands::publish_shortcut_status(
        app.handle(),
        crate::domain::ShortcutStatus::Unavailable,
    );
}

#[cfg(desktop)]
pub(crate) fn cleanup_global_shortcut<R: Runtime>(app: &AppHandle<R>) {
    if let Some(service) = app.try_state::<GlobalShortcutService>() {
        let _ = service.unregister();
    }
}

#[cfg(not(desktop))]
pub(crate) fn cleanup_global_shortcut<R: Runtime>(_app: &AppHandle<R>) {}

#[cfg(desktop)]
pub(crate) fn handle_native_shortcut_event<R: Runtime>(
    app: &AppHandle<R>,
    state: tauri_plugin_global_shortcut::ShortcutState,
) {
    let event_state = match state {
        tauri_plugin_global_shortcut::ShortcutState::Pressed => ShortcutEventState::Pressed,
        tauri_plugin_global_shortcut::ShortcutState::Released => ShortcutEventState::Released,
    };
    handle_shortcut_event(app, event_state);
}

pub(crate) fn handle_shortcut_event<R: Runtime>(app: &AppHandle<R>, state: ShortcutEventState) {
    let Some(service) = app.try_state::<GlobalShortcutService>() else {
        return;
    };

    match state {
        ShortcutEventState::Pressed => {
            if !service.accept_press() {
                return;
            }

            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::commands::toggle_focus(app).await;
            });
        }
        ShortcutEventState::Released => service.release_press(),
    }
}

#[cfg(desktop)]
pub(crate) fn default_shortcut() -> tauri_plugin_global_shortcut::Shortcut {
    shortcut_from_native_parts()
}

#[cfg(test)]
#[path = "global-shortcut-tests.rs"]
mod tests;
