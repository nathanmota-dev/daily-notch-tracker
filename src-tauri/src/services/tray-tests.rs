use super::*;
use crate::domain::ShortcutStatus;
use crate::state::AppState;
use std::sync::{Arc, Mutex};

fn snapshot_with_focus(focus_state: FocusState) -> AppSnapshot {
    let mut snapshot = AppState::default().snapshot();
    snapshot.focus.state = focus_state;
    snapshot
}

#[test]
fn idle_menu_presentation_offers_start_focus() {
    let presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Idle), "0.1.0");

    assert_eq!(presentation.toggle_focus.text, "Start focus");
    assert!(presentation.toggle_focus.enabled);
}

#[test]
fn running_menu_presentation_offers_stop_focus() {
    let presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Running), "0.1.0");

    assert_eq!(presentation.toggle_focus.text, "Stop focus");
}

#[test]
fn paused_menu_presentation_offers_stop_focus() {
    let presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Paused), "0.1.0");

    assert_eq!(presentation.toggle_focus.text, "Stop focus");
}

#[test]
fn menu_presentation_contains_stable_actions_and_disabled_information() {
    let presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Idle), "0.1.0");

    assert_eq!(presentation.open_tasks.text, "Open Tasks");
    assert_eq!(presentation.open_settings.text, "Settings");
    assert_eq!(presentation.about_update.text, "About / Update — v0.1.0");
    assert_eq!(presentation.quit.text, "Quit DailyNotch");
    assert!(!presentation.hotkey_status.enabled);
    assert!(!presentation.about_update.enabled);
}

#[test]
fn menu_presentation_reflects_each_shortcut_status() {
    let mut snapshot = snapshot_with_focus(FocusState::Idle);
    assert_eq!(
        TrayMenuPresentation::from_snapshot(&snapshot, "0.1.0")
            .hotkey_status
            .text,
        "Hotkey: Unavailable"
    );

    snapshot.shortcut_status = ShortcutStatus::Registered;
    assert_eq!(
        TrayMenuPresentation::from_snapshot(&snapshot, "0.1.0")
            .hotkey_status
            .text,
        "Hotkey: Registered"
    );

    snapshot.shortcut_status = ShortcutStatus::Error;
    assert_eq!(
        TrayMenuPresentation::from_snapshot(&snapshot, "0.1.0")
            .hotkey_status
            .text,
        "Hotkey: Error"
    );
}

#[cfg(desktop)]
#[test]
fn native_menu_builds_and_applies_dynamic_presentation() {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");
    let idle_presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Idle), "0.1.0");
    let (menu, menu_state) =
        tray_menu::build_tray_menu(&app, &idle_presentation).expect("tray menu should build");

    assert_eq!(
        menu.items()
            .expect("tray menu items should be readable")
            .len(),
        6
    );
    assert!(menu_state.apply(&TrayMenuPresentation::from_snapshot(
        &snapshot_with_focus(FocusState::Running),
        "0.1.0",
    )));
}

#[cfg(desktop)]
#[test]
fn tray_initialization_reports_unavailable_without_a_graphical_session() {
    let mut app = tauri::test::mock_builder()
        .manage(TrayRuntimeState::default())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");

    initialize_tray_for_session(&mut app, false);

    assert_eq!(
        app.try_state::<TrayRuntimeState>()
            .expect("tray state should be managed")
            .diagnostic()
            .status,
        IntegrationStatus::Unavailable
    );
}

#[cfg(desktop)]
#[test]
fn tray_initialization_reports_error_when_the_default_icon_is_missing() {
    let mut app = tauri::test::mock_builder()
        .manage(Mutex::new(AppState::default()))
        .manage(TrayRuntimeState::default())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");

    initialize_tray_for_session(&mut app, true);

    assert_eq!(
        app.try_state::<TrayRuntimeState>()
            .expect("tray state should be managed")
            .diagnostic()
            .status,
        IntegrationStatus::Error
    );
}

#[cfg(desktop)]
#[test]
fn tray_operations_are_no_ops_when_runtime_state_is_not_managed() {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");

    set_tray_diagnostic(&app.handle().clone(), error_diagnostic());
    sync_tray_menu(
        &app.handle().clone(),
        &snapshot_with_focus(FocusState::Idle),
    );
    assert_eq!(
        current_tray_diagnostic(&app.handle().clone()).status,
        IntegrationStatus::Unavailable
    );

    let app_with_state = tauri::test::mock_builder()
        .manage(TrayRuntimeState::default())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");
    assert_eq!(
        current_tray_diagnostic(&app_with_state.handle().clone()).status,
        IntegrationStatus::Unavailable
    );
}

#[cfg(desktop)]
#[test]
fn tray_initialization_reports_error_when_application_state_is_missing() {
    let mut app = tauri::test::mock_builder()
        .manage(TrayRuntimeState::default())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");

    initialize_tray_for_session(&mut app, true);

    assert_eq!(
        app.try_state::<TrayRuntimeState>()
            .expect("tray state should be managed")
            .diagnostic()
            .status,
        IntegrationStatus::Error
    );
}

#[cfg(all(desktop, target_os = "linux"))]
#[test]
fn graphical_session_requires_x11_or_wayland() {
    assert!(!graphical_session_available_for(false, false));
    assert!(graphical_session_available_for(true, false));
    assert!(graphical_session_available_for(false, true));
    assert!(graphical_session_available_for(true, true));
}

#[cfg(desktop)]
#[test]
fn tray_sync_updates_managed_native_menu_items() {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");
    let initial_presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Idle), "0.1.0");
    let (_, menu_state) =
        tray_menu::build_tray_menu(&app, &initial_presentation).expect("tray menu should build");
    app.manage(Arc::new(Mutex::new(menu_state)));

    sync_tray_menu(
        &app.handle().clone(),
        &snapshot_with_focus(FocusState::Paused),
    );
    assert!(app
        .try_state::<Arc<Mutex<tray_menu::TrayMenuState<tauri::test::MockRuntime>>>>()
        .is_some());
}

#[cfg(desktop)]
#[test]
fn tray_sync_reports_errors_from_a_poisoned_menu_state() {
    let app = tauri::test::mock_builder()
        .manage(TrayRuntimeState::default())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");
    let initial_presentation =
        TrayMenuPresentation::from_snapshot(&snapshot_with_focus(FocusState::Idle), "0.1.0");
    let (_, menu_state) =
        tray_menu::build_tray_menu(&app, &initial_presentation).expect("tray menu should build");
    let managed_menu_state = Arc::new(Mutex::new(menu_state));
    app.manage(Arc::clone(&managed_menu_state));

    let state_for_thread = Arc::clone(&managed_menu_state);
    std::thread::spawn(move || {
        let _guard = state_for_thread
            .lock()
            .expect("menu state lock should be available");
        panic!("poison the menu state lock for the recovery test");
    })
    .join()
    .expect_err("the recovery thread should panic");

    sync_tray_menu(
        &app.handle().clone(),
        &snapshot_with_focus(FocusState::Running),
    );
    assert_eq!(
        app.try_state::<TrayRuntimeState>()
            .expect("tray state should be managed")
            .diagnostic()
            .status,
        IntegrationStatus::Error
    );
}

#[cfg(desktop)]
#[test]
fn tray_event_handler_ignores_unknown_ids_and_accepts_known_ids() {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app should build");

    handle_tray_menu_event(
        &app.handle().clone(),
        tauri::menu::MenuEvent {
            id: tauri::menu::MenuId::new("unknown"),
        },
    );
    handle_tray_menu_event(
        &app.handle().clone(),
        tauri::menu::MenuEvent {
            id: tauri::menu::MenuId::new(HOTKEY_STATUS_MENU_ID),
        },
    );
}

#[test]
fn poisoned_tray_diagnostic_lock_remains_recoverable() {
    let state = Arc::new(TrayRuntimeState::default());
    let state_for_thread = Arc::clone(&state);
    std::thread::spawn(move || {
        let _guard = state_for_thread
            .diagnostic
            .lock()
            .expect("diagnostic lock should be available");
        panic!("poison the diagnostic lock for the recovery test");
    })
    .join()
    .expect_err("the recovery thread should panic");

    assert_eq!(state.diagnostic().status, IntegrationStatus::Unavailable);
    state.set_diagnostic(available_diagnostic());
    assert_eq!(state.diagnostic().status, IntegrationStatus::Available);
}

#[test]
fn menu_ids_route_to_their_expected_actions() {
    assert_eq!(
        tray_menu_action(OPEN_TASKS_MENU_ID),
        Some(TrayMenuAction::OpenTasks)
    );
    assert_eq!(
        tray_menu_action(TOGGLE_FOCUS_MENU_ID),
        Some(TrayMenuAction::ToggleFocus)
    );
    assert_eq!(
        tray_menu_action(OPEN_SETTINGS_MENU_ID),
        Some(TrayMenuAction::OpenSettings)
    );
    assert_eq!(
        tray_menu_action(HOTKEY_STATUS_MENU_ID),
        Some(TrayMenuAction::HotkeyStatus)
    );
    assert_eq!(
        tray_menu_action(ABOUT_UPDATE_MENU_ID),
        Some(TrayMenuAction::AboutUpdate)
    );
    assert_eq!(tray_menu_action(QUIT_MENU_ID), Some(TrayMenuAction::Quit));
}

#[test]
fn unknown_menu_ids_are_ignored() {
    assert_eq!(tray_menu_action("unknown"), None);
}

#[test]
fn tray_runtime_diagnostic_starts_unavailable() {
    let state = TrayRuntimeState::default();
    let diagnostic = state.diagnostic();

    assert_eq!(diagnostic.status, IntegrationStatus::Unavailable);
    assert!(diagnostic.message.is_some());
}

#[test]
fn tray_runtime_diagnostic_can_report_availability_and_errors() {
    let state = TrayRuntimeState::default();
    state.set_diagnostic(available_diagnostic());
    assert_eq!(state.diagnostic().status, IntegrationStatus::Available);

    state.set_diagnostic(error_diagnostic());
    assert_eq!(state.diagnostic().status, IntegrationStatus::Error);
}
