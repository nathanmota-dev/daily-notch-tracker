use std::sync::Arc;

use thiserror::Error;

use crate::domain::{AppError, AutostartDiagnostic, IntegrationStatus};

pub(crate) const AUTOSTART_UNAVAILABLE_MESSAGE: &str =
    "Autostart integration is unavailable in this desktop session.";
pub(crate) const AUTOSTART_PERMISSION_DENIED_MESSAGE: &str =
    "Autostart permission was denied by the desktop session.";
pub(crate) const AUTOSTART_OPERATION_ERROR_MESSAGE: &str =
    "Autostart could not be updated in this desktop session.";
pub(crate) const AUTOSTART_STATUS_ERROR_MESSAGE: &str =
    "Autostart status could not be read from the desktop session.";

/// Sanitized failures exposed by an autostart backend.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
pub(crate) enum AutostartBackendError {
    #[error("the autostart backend is unavailable")]
    Unavailable,
    #[error("autostart permission was denied")]
    PermissionDenied,
    #[error("the autostart operation failed")]
    Failed,
}

impl AutostartBackendError {
    pub(crate) fn app_error(self) -> AppError {
        match self {
            Self::Unavailable => AppError::integration_unavailable(AUTOSTART_UNAVAILABLE_MESSAGE),
            Self::PermissionDenied => {
                AppError::permission_denied(AUTOSTART_PERMISSION_DENIED_MESSAGE)
            }
            Self::Failed => AppError::integration_unavailable(AUTOSTART_OPERATION_ERROR_MESSAGE),
        }
    }

    pub(crate) fn diagnostic(self) -> AutostartDiagnostic {
        match self {
            Self::Unavailable => AutostartDiagnostic::default(),
            Self::PermissionDenied => AutostartDiagnostic {
                enabled: false,
                status: IntegrationStatus::Error,
                message: Some(AUTOSTART_PERMISSION_DENIED_MESSAGE.to_owned()),
            },
            Self::Failed => AutostartDiagnostic {
                enabled: false,
                status: IntegrationStatus::Error,
                message: Some(AUTOSTART_STATUS_ERROR_MESSAGE.to_owned()),
            },
        }
    }
}

/// Operations required by the autostart service.
pub(crate) trait AutostartBackend: Send + Sync {
    fn enable(&self) -> Result<(), AutostartBackendError>;
    fn disable(&self) -> Result<(), AutostartBackendError>;
    fn is_enabled(&self) -> Result<bool, AutostartBackendError>;
}

pub(crate) type SharedAutostartBackend = Arc<dyn AutostartBackend>;

/// Backend used when the native autostart plugin could not be initialized.
#[derive(Debug, Default)]
pub(crate) struct UnavailableAutostartBackend;

impl AutostartBackend for UnavailableAutostartBackend {
    fn enable(&self) -> Result<(), AutostartBackendError> {
        Err(AutostartBackendError::Unavailable)
    }

    fn disable(&self) -> Result<(), AutostartBackendError> {
        Err(AutostartBackendError::Unavailable)
    }

    fn is_enabled(&self) -> Result<bool, AutostartBackendError> {
        Err(AutostartBackendError::Unavailable)
    }
}
