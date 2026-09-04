use std::sync::{Arc, Mutex, MutexGuard};

use thiserror::Error;

use crate::domain::ShortcutStatus;

/// The two lifecycle events emitted by the native shortcut backend.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ShortcutEventState {
    Pressed,
    Released,
}

/// Sanitized failures returned by a shortcut backend.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
pub(crate) enum ShortcutBackendError {
    #[error("the global shortcut backend is unavailable")]
    Unavailable,
    #[error("the global shortcut operation failed")]
    Failed,
}

impl ShortcutBackendError {
    pub(crate) fn status(self) -> ShortcutStatus {
        match self {
            Self::Unavailable => ShortcutStatus::Unavailable,
            Self::Failed => ShortcutStatus::Error,
        }
    }
}

/// Operations required by the global shortcut service.
pub(crate) trait ShortcutBackend: Send + Sync {
    fn register(&self) -> Result<(), ShortcutBackendError>;
    fn unregister(&self) -> Result<(), ShortcutBackendError>;
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct ShortcutRuntimeState {
    pub(crate) registered: bool,
    pub(crate) pressed: bool,
}

pub(crate) type SharedShortcutBackend = Arc<dyn ShortcutBackend>;

pub(crate) fn lock_runtime_state(
    state: &Mutex<ShortcutRuntimeState>,
) -> MutexGuard<'_, ShortcutRuntimeState> {
    state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}
