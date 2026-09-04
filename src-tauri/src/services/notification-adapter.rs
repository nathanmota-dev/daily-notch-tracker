use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

use super::notification_types::{
    NotificationBackend, NotificationBackendError, NotificationPermissionState, NotificationRequest,
};

/// Adapts the Tauri notification plugin to the internal notification contract.
pub(crate) struct TauriNotificationBackend<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriNotificationBackend<R> {
    pub(crate) fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> NotificationBackend for TauriNotificationBackend<R> {
    fn permission_state(&self) -> Result<NotificationPermissionState, NotificationBackendError> {
        self.app
            .notification()
            .permission_state()
            .map(map_permission_state)
            .map_err(|_| NotificationBackendError::Unavailable)
    }

    fn request_permission(&self) -> Result<NotificationPermissionState, NotificationBackendError> {
        self.app
            .notification()
            .request_permission()
            .map(map_permission_state)
            .map_err(|_| NotificationBackendError::Failed)
    }

    fn send(&self, request: &NotificationRequest) -> Result<(), NotificationBackendError> {
        let mut builder = self
            .app
            .notification()
            .builder()
            .title(request.title.clone())
            .silent();
        if let Some(body) = request.body.as_deref() {
            builder = builder.body(body.to_owned());
        }

        builder.show().map_err(|_| NotificationBackendError::Failed)
    }
}

fn map_permission_state(
    state: tauri_plugin_notification::PermissionState,
) -> NotificationPermissionState {
    match state {
        tauri_plugin_notification::PermissionState::Granted => NotificationPermissionState::Granted,
        tauri_plugin_notification::PermissionState::Denied => NotificationPermissionState::Denied,
        tauri_plugin_notification::PermissionState::Prompt
        | tauri_plugin_notification::PermissionState::PromptWithRationale => {
            NotificationPermissionState::Prompt
        }
    }
}

#[cfg(test)]
use std::sync::{Mutex, MutexGuard};

#[cfg(test)]
#[derive(Debug)]
pub(crate) struct MockNotificationBackend {
    state: Mutex<MockNotificationBackendState>,
}

#[cfg(test)]
#[derive(Debug)]
struct MockNotificationBackendState {
    permission_state: NotificationPermissionState,
    requested_permission_state: NotificationPermissionState,
    permission_state_calls: usize,
    request_permission_calls: usize,
    sent_requests: Vec<NotificationRequest>,
    permission_state_error: Option<NotificationBackendError>,
    request_permission_error: Option<NotificationBackendError>,
    send_error: Option<NotificationBackendError>,
}

#[cfg(test)]
impl Default for MockNotificationBackend {
    fn default() -> Self {
        Self {
            state: Mutex::new(MockNotificationBackendState {
                permission_state: NotificationPermissionState::Granted,
                requested_permission_state: NotificationPermissionState::Granted,
                permission_state_calls: 0,
                request_permission_calls: 0,
                sent_requests: Vec::new(),
                permission_state_error: None,
                request_permission_error: None,
                send_error: None,
            }),
        }
    }
}

#[cfg(test)]
impl MockNotificationBackend {
    pub(crate) fn set_permission_state(&self, state: NotificationPermissionState) {
        self.lock_state().permission_state = state;
    }

    pub(crate) fn set_requested_permission_state(&self, state: NotificationPermissionState) {
        self.lock_state().requested_permission_state = state;
    }

    pub(crate) fn set_permission_state_error(&self, error: Option<NotificationBackendError>) {
        self.lock_state().permission_state_error = error;
    }

    pub(crate) fn set_request_permission_error(&self, error: Option<NotificationBackendError>) {
        self.lock_state().request_permission_error = error;
    }

    pub(crate) fn set_send_error(&self, error: Option<NotificationBackendError>) {
        self.lock_state().send_error = error;
    }

    pub(crate) fn permission_state_calls(&self) -> usize {
        self.lock_state().permission_state_calls
    }

    pub(crate) fn request_permission_calls(&self) -> usize {
        self.lock_state().request_permission_calls
    }

    pub(crate) fn sent_requests(&self) -> Vec<NotificationRequest> {
        self.lock_state().sent_requests.clone()
    }

    fn lock_state(&self) -> MutexGuard<'_, MockNotificationBackendState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
impl NotificationBackend for MockNotificationBackend {
    fn permission_state(&self) -> Result<NotificationPermissionState, NotificationBackendError> {
        let mut state = self.lock_state();
        state.permission_state_calls += 1;
        if let Some(error) = state.permission_state_error {
            return Err(error);
        }

        Ok(state.permission_state)
    }

    fn request_permission(&self) -> Result<NotificationPermissionState, NotificationBackendError> {
        let mut state = self.lock_state();
        state.request_permission_calls += 1;
        if let Some(error) = state.request_permission_error {
            return Err(error);
        }

        state.permission_state = state.requested_permission_state;
        Ok(state.permission_state)
    }

    fn send(&self, request: &NotificationRequest) -> Result<(), NotificationBackendError> {
        let mut state = self.lock_state();
        if let Some(error) = state.send_error {
            return Err(error);
        }

        state.sent_requests.push(request.clone());
        Ok(())
    }
}
