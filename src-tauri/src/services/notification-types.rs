use std::sync::Arc;

use thiserror::Error;

/// Permission states exposed by a native notification backend.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(crate) enum NotificationPermissionState {
    Granted,
    Denied,
    #[default]
    Prompt,
}

/// The only data allowed to cross the notification integration boundary.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct NotificationRequest {
    pub(crate) title: String,
    pub(crate) body: Option<String>,
}

/// Sanitized failures returned by a notification backend.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
pub(crate) enum NotificationBackendError {
    #[error("the notification backend is unavailable")]
    Unavailable,
    #[error("the notification operation failed")]
    Failed,
}

/// Operations required by the focus-completion notification service.
pub(crate) trait NotificationBackend: Send + Sync {
    fn permission_state(&self) -> Result<NotificationPermissionState, NotificationBackendError>;
    fn request_permission(&self) -> Result<NotificationPermissionState, NotificationBackendError>;
    fn send(&self, request: &NotificationRequest) -> Result<(), NotificationBackendError>;
}

pub(crate) type SharedNotificationBackend = Arc<dyn NotificationBackend>;
