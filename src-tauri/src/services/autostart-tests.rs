use std::sync::Arc;

use super::*;
use crate::domain::{AppErrorCode, IntegrationStatus};
use crate::services::{AutostartBackendError, MockAutostartBackend, UnavailableAutostartBackend};

#[test]
fn service_enable_confirms_the_effective_backend_state() {
    let backend = Arc::new(MockAutostartBackend::default());
    let service = AutostartService::new(Arc::clone(&backend) as Arc<_>);

    assert!(service.set_enabled(true).expect("autostart should enable"));
    assert_eq!(backend.enable_calls(), 1);
    assert_eq!(backend.is_enabled_calls(), 1);
}

#[test]
fn service_disable_confirms_the_effective_backend_state() {
    let backend = Arc::new(MockAutostartBackend::with_enabled(true));
    let service = AutostartService::new(Arc::clone(&backend) as Arc<_>);

    assert!(!service
        .set_enabled(false)
        .expect("autostart should disable"));
    assert_eq!(backend.disable_calls(), 1);
    assert_eq!(backend.is_enabled_calls(), 1);
}

#[test]
fn service_diagnostics_reads_enabled_state_without_using_saved_settings() {
    let backend = Arc::new(MockAutostartBackend::with_enabled(true));
    let service = AutostartService::new(Arc::clone(&backend) as Arc<_>);

    let diagnostic = service.diagnostic();

    assert!(diagnostic.enabled);
    assert_eq!(diagnostic.status, IntegrationStatus::Available);
    assert_eq!(diagnostic.message, None);
}

#[test]
fn unavailable_backend_returns_a_sanitized_unavailable_diagnostic() {
    let service = AutostartService::new(Arc::new(UnavailableAutostartBackend));

    let diagnostic = service.diagnostic();

    assert_eq!(diagnostic, crate::domain::AutostartDiagnostic::default());
}

#[test]
fn permission_errors_are_exposed_as_permission_denied_without_backend_details() {
    let backend = Arc::new(MockAutostartBackend::default());
    backend.set_enable_error(Some(AutostartBackendError::PermissionDenied));
    let service = AutostartService::new(Arc::clone(&backend) as Arc<_>);

    let error = service
        .set_enabled(true)
        .expect_err("permission errors should be returned");
    let app_error = error.app_error();

    assert_eq!(app_error.code, AppErrorCode::PermissionDenied);
    assert!(!app_error.message.contains("/"));
}

#[test]
fn generic_status_errors_are_reported_as_error_diagnostics() {
    let backend = Arc::new(MockAutostartBackend::default());
    backend.set_is_enabled_error(Some(AutostartBackendError::Failed));
    let service = AutostartService::new(Arc::clone(&backend) as Arc<_>);

    let diagnostic = service.diagnostic();

    assert_eq!(diagnostic.status, IntegrationStatus::Error);
    assert!(!diagnostic.enabled);
    assert_eq!(
        diagnostic.message.as_deref(),
        Some(AUTOSTART_STATUS_ERROR_MESSAGE)
    );
}

#[cfg(desktop)]
#[test]
fn native_permission_errors_are_sanitized_before_reaching_the_service() {
    let error = tauri_plugin_autostart::Error::Io(std::io::Error::new(
        std::io::ErrorKind::PermissionDenied,
        "permission denied for /home/private/.config/autostart",
    ));

    assert_eq!(
        crate::services::autostart_adapter::map_tauri_autostart_error(error),
        AutostartBackendError::PermissionDenied
    );
}
