use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager, Runtime};

use crate::domain::{AppSnapshot, FocusState, IntegrationStatus, ShortcutStatus, TrayDiagnostic};
#[cfg(desktop)]
use crate::services::desktop_session::graphical_session_available;

#[cfg(desktop)]
use crate::domain::TasksWindowIntent;

pub(crate) const TRAY_ID: &str = "daily-notch-tray";
pub(crate) const OPEN_TASKS_MENU_ID: &str = "open-tasks";
pub(crate) const TOGGLE_FOCUS_MENU_ID: &str = "toggle-focus";
pub(crate) const OPEN_SETTINGS_MENU_ID: &str = "open-settings";
pub(crate) const HOTKEY_STATUS_MENU_ID: &str = "hotkey-status";
pub(crate) const ABOUT_UPDATE_MENU_ID: &str = "about-update";
pub(crate) const QUIT_MENU_ID: &str = "quit";

const TRAY_ERROR_MESSAGE: &str = "System tray integration could not be initialized.";

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TrayMenuItemPresentation {
    pub(crate) text: String,
    pub(crate) enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct TrayMenuPresentation {
    pub(crate) open_tasks: TrayMenuItemPresentation,
    pub(crate) toggle_focus: TrayMenuItemPresentation,
    pub(crate) open_settings: TrayMenuItemPresentation,
    pub(crate) hotkey_status: TrayMenuItemPresentation,
    pub(crate) about_update: TrayMenuItemPresentation,
    pub(crate) quit: TrayMenuItemPresentation,
}

impl TrayMenuPresentation {
    pub(crate) fn from_snapshot(snapshot: &AppSnapshot, app_version: &str) -> Self {
        let focus_label = match snapshot.focus.state {
            FocusState::Idle => "Start focus",
            FocusState::Running | FocusState::Paused => "Stop focus",
        };
        let hotkey_label = match snapshot.shortcut_status {
            ShortcutStatus::Registered => "Registered",
            ShortcutStatus::Unavailable => "Unavailable",
            ShortcutStatus::Error => "Error",
        };

        Self {
            open_tasks: menu_item("Open Tasks", true),
            toggle_focus: menu_item(focus_label, true),
            open_settings: menu_item("Settings", true),
            hotkey_status: menu_item(format!("Hotkey: {hotkey_label}"), false),
            about_update: menu_item(format!("About / Update — v{app_version}"), false),
            quit: menu_item("Quit DailyNotch", true),
        }
    }
}

fn menu_item(text: impl Into<String>, enabled: bool) -> TrayMenuItemPresentation {
    TrayMenuItemPresentation {
        text: text.into(),
        enabled,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum TrayMenuAction {
    OpenTasks,
    ToggleFocus,
    OpenSettings,
    HotkeyStatus,
    AboutUpdate,
    Quit,
}

pub(crate) fn tray_menu_action(id: &str) -> Option<TrayMenuAction> {
    match id {
        OPEN_TASKS_MENU_ID => Some(TrayMenuAction::OpenTasks),
        TOGGLE_FOCUS_MENU_ID => Some(TrayMenuAction::ToggleFocus),
        OPEN_SETTINGS_MENU_ID => Some(TrayMenuAction::OpenSettings),
        HOTKEY_STATUS_MENU_ID => Some(TrayMenuAction::HotkeyStatus),
        ABOUT_UPDATE_MENU_ID => Some(TrayMenuAction::AboutUpdate),
        QUIT_MENU_ID => Some(TrayMenuAction::Quit),
        _ => None,
    }
}

#[derive(Debug)]
pub(crate) struct TrayRuntimeState {
    diagnostic: Mutex<TrayDiagnostic>,
}

impl Default for TrayRuntimeState {
    fn default() -> Self {
        Self {
            diagnostic: Mutex::new(TrayDiagnostic::default()),
        }
    }
}

impl TrayRuntimeState {
    pub(crate) fn diagnostic(&self) -> TrayDiagnostic {
        match self.diagnostic.lock() {
            Ok(diagnostic) => diagnostic.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        }
    }

    pub(crate) fn set_diagnostic(&self, diagnostic: TrayDiagnostic) {
        match self.diagnostic.lock() {
            Ok(mut current) => *current = diagnostic,
            Err(poisoned) => *poisoned.into_inner() = diagnostic,
        }
    }
}

pub(crate) fn current_tray_diagnostic<R: Runtime>(app: &AppHandle<R>) -> TrayDiagnostic {
    app.try_state::<TrayRuntimeState>()
        .map(|state| state.diagnostic())
        .unwrap_or_default()
}

#[cfg(desktop)]
use tauri::{tray::TrayIconBuilder, App};

#[cfg(desktop)]
#[path = "tray-menu.rs"]
mod tray_menu;

#[cfg(desktop)]
use tray_menu::{build_tray_menu, TrayMenuState};

#[cfg(desktop)]
pub(crate) fn initialize_tray<R: Runtime>(app: &mut App<R>) {
    initialize_tray_for_session(app, graphical_session_available());
}

#[cfg(desktop)]
fn initialize_tray_for_session<R: Runtime>(app: &mut App<R>, graphical_session: bool) {
    if !graphical_session {
        set_tray_diagnostic(app.handle(), unavailable_diagnostic());
        return;
    }

    let Some(snapshot) = snapshot_for_tray(app) else {
        set_tray_diagnostic(app.handle(), error_diagnostic());
        return;
    };
    let version = app.package_info().version.to_string();
    let presentation = TrayMenuPresentation::from_snapshot(&snapshot, &version);
    let Ok((menu, menu_state)) = build_tray_menu(app, &presentation) else {
        set_tray_diagnostic(app.handle(), error_diagnostic());
        return;
    };
    let Some(icon) = app.default_window_icon().cloned() else {
        set_tray_diagnostic(app.handle(), error_diagnostic());
        return;
    };

    let result = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(handle_tray_menu_event)
        .build(app);

    if result.is_err() {
        set_tray_diagnostic(app.handle(), error_diagnostic());
        return;
    }

    app.manage(Arc::new(Mutex::new(menu_state)));
    set_tray_diagnostic(app.handle(), available_diagnostic());
    sync_tray_menu(app.handle(), &snapshot);
}

#[cfg(not(desktop))]
pub(crate) fn initialize_tray<R: Runtime>(_app: &mut tauri::App<R>) {}

#[cfg(desktop)]
pub(crate) fn sync_tray_menu<R: Runtime>(app: &AppHandle<R>, snapshot: &AppSnapshot) {
    let Some(menu_state) = app.try_state::<Arc<Mutex<TrayMenuState<R>>>>() else {
        return;
    };
    let version = app.package_info().version.to_string();
    let presentation = TrayMenuPresentation::from_snapshot(snapshot, &version);
    let update_succeeded = match menu_state.lock() {
        Ok(menu_state) => menu_state.apply(&presentation),
        Err(_) => false,
    };

    if !update_succeeded {
        set_tray_diagnostic(app, error_diagnostic());
    }
}

#[cfg(not(desktop))]
pub(crate) fn sync_tray_menu<R: Runtime>(_app: &AppHandle<R>, _snapshot: &AppSnapshot) {}

#[cfg(desktop)]
fn snapshot_for_tray<R: Runtime>(app: &App<R>) -> Option<AppSnapshot> {
    let state = app.try_state::<Mutex<crate::state::AppState>>()?;
    state.lock().ok().map(|state| state.snapshot())
}

#[cfg(desktop)]
fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let Some(action) = tray_menu_action(event.id().as_ref()) else {
        return;
    };
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        let result = match action {
            TrayMenuAction::OpenTasks => {
                crate::commands::open_tasks_window(app.clone(), Some(TasksWindowIntent::List))
                    .await
                    .map(|_| ())
            }
            TrayMenuAction::ToggleFocus => {
                crate::commands::toggle_focus(app.clone()).await.map(|_| ())
            }
            TrayMenuAction::OpenSettings => {
                crate::commands::open_settings_window(app.clone()).await
            }
            TrayMenuAction::HotkeyStatus | TrayMenuAction::AboutUpdate => Ok(()),
            TrayMenuAction::Quit => {
                super::request_quit(&app);
                Ok(())
            }
        };

        let _ = result;
    });
}

fn set_tray_diagnostic<R: Runtime>(app: &AppHandle<R>, diagnostic: TrayDiagnostic) {
    if let Some(state) = app.try_state::<TrayRuntimeState>() {
        state.set_diagnostic(diagnostic);
    }
}

fn available_diagnostic() -> TrayDiagnostic {
    TrayDiagnostic {
        status: IntegrationStatus::Available,
        message: None,
    }
}

fn unavailable_diagnostic() -> TrayDiagnostic {
    TrayDiagnostic::default()
}

fn error_diagnostic() -> TrayDiagnostic {
    TrayDiagnostic {
        status: IntegrationStatus::Error,
        message: Some(TRAY_ERROR_MESSAGE.to_owned()),
    }
}

#[cfg(test)]
#[path = "tray-tests.rs"]
mod tests;
