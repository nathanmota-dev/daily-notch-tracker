use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::Manager;

use super::*;
use crate::domain::{AppSnapshot, FocusState};
#[cfg(target_os = "linux")]
use crate::services::desktop_session::graphical_session_available_for;
use crate::services::global_shortcut_adapter::MockShortcutBackend;
use crate::services::global_shortcut_types::{ShortcutBackendError, ShortcutEventState};
use crate::state::AppState;

fn test_app(backend: Arc<MockShortcutBackend>) -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(crate::services::FocusScheduler::new())
        .manage(GlobalShortcutService::new(backend))
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn test_app_without_shortcut() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(crate::services::FocusScheduler::new())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build")
}

fn registered_service() -> (Arc<MockShortcutBackend>, GlobalShortcutService) {
    let backend = Arc::new(MockShortcutBackend::default());
    let service = GlobalShortcutService::new(backend.clone());
    service.register().expect("shortcut should register");
    (backend, service)
}

fn wait_for_focus_state(
    handle: &tauri::AppHandle<tauri::test::MockRuntime>,
    expected: FocusState,
) -> AppSnapshot {
    let deadline = Instant::now() + Duration::from_secs(1);
    loop {
        let snapshot =
            tauri::async_runtime::block_on(crate::commands::get_snapshot(handle.clone()))
                .expect("snapshot should load");
        if snapshot.focus.state == expected {
            return snapshot;
        }
        assert!(
            Instant::now() < deadline,
            "focus state did not become {expected:?}"
        );
        thread::sleep(Duration::from_millis(5));
    }
}

#[test]
fn default_shortcut_uses_control_shift_and_space() {
    let shortcut = default_shortcut();

    assert!(shortcut.mods.ctrl() && shortcut.mods.shift());
    assert_eq!(shortcut.key, tauri_plugin_global_shortcut::Code::Space);
}

#[test]
fn registration_failure_is_retryable_and_success_is_idempotent() {
    let backend = Arc::new(MockShortcutBackend::default());
    backend.set_register_error(Some(ShortcutBackendError::Failed));
    let service = GlobalShortcutService::new(backend.clone());

    assert_eq!(
        service.register().expect_err("registration should fail"),
        ShortcutBackendError::Failed
    );
    assert_eq!(backend.register_calls(), 1);

    backend.set_register_error(None);
    service.register().expect("retry should register");
    service
        .register()
        .expect("second registration should be a no-op");

    assert_eq!(backend.register_calls(), 2);
    assert!(service.runtime_state().registered);
}

#[test]
fn backend_errors_map_to_sanitized_shortcut_statuses() {
    assert_eq!(
        ShortcutBackendError::Unavailable.status(),
        crate::domain::ShortcutStatus::Unavailable
    );
    assert_eq!(
        ShortcutBackendError::Failed.status(),
        crate::domain::ShortcutStatus::Error
    );
}

#[test]
fn unregister_is_idempotent_after_a_successful_registration() {
    let (backend, service) = registered_service();

    service.unregister().expect("shortcut should unregister");
    service
        .unregister()
        .expect("repeated cleanup should be a no-op");

    assert_eq!(backend.unregister_calls(), 1);
    assert!(!service.runtime_state().registered);
}

#[test]
fn press_debounce_releases_only_after_the_native_release_event() {
    let (_backend, service) = registered_service();

    assert!(service.accept_press());
    assert!(!service.accept_press());
    service.release_press();
    assert!(service.accept_press());
}

#[test]
fn unregistered_service_rejects_a_press() {
    let backend = Arc::new(MockShortcutBackend::default());
    let service = GlobalShortcutService::new(backend);

    assert!(!service.accept_press());
}

#[test]
fn shortcut_events_are_ignored_without_a_registered_service() {
    let app = test_app_without_shortcut();
    let handle = app.handle().clone();

    handle_shortcut_event(&handle, ShortcutEventState::Pressed);
    handle_shortcut_event(&handle, ShortcutEventState::Released);

    let snapshot = tauri::async_runtime::block_on(crate::commands::get_snapshot(handle))
        .expect("snapshot should load");
    assert_eq!(snapshot.focus.state, FocusState::Idle);
}

#[test]
fn repeated_pressed_events_are_ignored_until_release() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app(backend);
    app.state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");
    let handle = app.handle().clone();

    handle_shortcut_event(&handle, ShortcutEventState::Pressed);
    wait_for_focus_state(&handle, FocusState::Running);
    handle_shortcut_event(&handle, ShortcutEventState::Pressed);

    let snapshot = tauri::async_runtime::block_on(crate::commands::get_snapshot(handle.clone()))
        .expect("snapshot should load");
    assert_eq!(snapshot.focus.state, FocusState::Running);

    handle_shortcut_event(&handle, ShortcutEventState::Released);
}

#[test]
fn shortcut_press_starts_focus_from_idle() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app(backend);
    app.state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");
    let handle = app.handle().clone();

    handle_shortcut_event(&handle, ShortcutEventState::Pressed);
    let snapshot = wait_for_focus_state(&handle, FocusState::Running);

    assert_eq!(snapshot.focus.state, FocusState::Running);
}

#[test]
fn shortcut_press_stops_running_focus() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app(backend);
    app.state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");
    let handle = app.handle().clone();
    handle_shortcut_event(&handle, ShortcutEventState::Pressed);
    wait_for_focus_state(&handle, FocusState::Running);
    handle_shortcut_event(&handle, ShortcutEventState::Released);

    handle_shortcut_event(&handle, ShortcutEventState::Pressed);
    let snapshot = wait_for_focus_state(&handle, FocusState::Idle);

    assert_eq!(snapshot.focus.state, FocusState::Idle);
}

#[test]
fn shortcut_press_stops_paused_focus() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app(backend);
    app.state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");
    let handle = app.handle().clone();
    let state = handle.state::<Mutex<AppState>>();
    let mut state = state
        .lock()
        .expect("application state should not be poisoned");
    state
        .start_focus_at(None, chrono::Utc::now())
        .expect("focus should start");
    state
        .pause_focus_at(chrono::Utc::now())
        .expect("focus should pause");
    drop(state);
    handle_shortcut_event(&handle, ShortcutEventState::Pressed);

    let snapshot = wait_for_focus_state(&handle, FocusState::Idle);

    assert_eq!(snapshot.focus.state, FocusState::Idle);
}

#[test]
fn native_shortcut_press_and_release_events_toggle_focus() {
    let backend = Arc::new(MockShortcutBackend::default());
    let app = test_app(backend);
    app.state::<GlobalShortcutService>()
        .register()
        .expect("shortcut should register");
    let handle = app.handle().clone();

    handle_native_shortcut_event(
        &handle,
        tauri_plugin_global_shortcut::ShortcutState::Pressed,
    );
    wait_for_focus_state(&handle, FocusState::Running);
    handle_native_shortcut_event(
        &handle,
        tauri_plugin_global_shortcut::ShortcutState::Released,
    );
    handle_native_shortcut_event(
        &handle,
        tauri_plugin_global_shortcut::ShortcutState::Pressed,
    );

    let snapshot = wait_for_focus_state(&handle, FocusState::Idle);
    assert_eq!(snapshot.focus.state, FocusState::Idle);
}

#[cfg(target_os = "linux")]
#[test]
fn graphical_session_requires_x11_or_wayland_environment() {
    assert!(!graphical_session_available_for(false, false));
    assert!(graphical_session_available_for(true, false));
    assert!(graphical_session_available_for(false, true));
}

#[cfg(target_os = "linux")]
#[test]
fn global_shortcut_requires_x11_or_xwayland_display() {
    assert!(!crate::services::desktop_session::global_shortcut_session_available_for(false, false));
    assert!(!crate::services::desktop_session::global_shortcut_session_available_for(false, true));
    assert!(crate::services::desktop_session::global_shortcut_session_available_for(true, false));
    assert!(crate::services::desktop_session::global_shortcut_session_available_for(true, true));
}
