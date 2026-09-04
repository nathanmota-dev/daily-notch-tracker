use tauri::{
    menu::{Menu, MenuItem},
    App, Runtime,
};

use super::{
    TrayMenuItemPresentation, TrayMenuPresentation, ABOUT_UPDATE_MENU_ID, HOTKEY_STATUS_MENU_ID,
    OPEN_SETTINGS_MENU_ID, OPEN_TASKS_MENU_ID, QUIT_MENU_ID, TOGGLE_FOCUS_MENU_ID,
};

pub(crate) struct TrayMenuState<R: Runtime> {
    open_tasks: MenuItem<R>,
    toggle_focus: MenuItem<R>,
    open_settings: MenuItem<R>,
    hotkey_status: MenuItem<R>,
    about_update: MenuItem<R>,
    quit: MenuItem<R>,
}

impl<R: Runtime> TrayMenuState<R> {
    pub(crate) fn apply(&self, presentation: &TrayMenuPresentation) -> bool {
        let mut update_succeeded = true;
        update_succeeded =
            update_menu_item(&self.open_tasks, &presentation.open_tasks) && update_succeeded;
        update_succeeded =
            update_menu_item(&self.toggle_focus, &presentation.toggle_focus) && update_succeeded;
        update_succeeded =
            update_menu_item(&self.open_settings, &presentation.open_settings) && update_succeeded;
        update_succeeded =
            update_menu_item(&self.hotkey_status, &presentation.hotkey_status) && update_succeeded;
        update_succeeded =
            update_menu_item(&self.about_update, &presentation.about_update) && update_succeeded;
        update_menu_item(&self.quit, &presentation.quit) && update_succeeded
    }
}

fn update_menu_item<R: Runtime>(
    item: &MenuItem<R>,
    presentation: &TrayMenuItemPresentation,
) -> bool {
    let text_succeeded = item.set_text(&presentation.text).is_ok();
    let enabled_succeeded = item.set_enabled(presentation.enabled).is_ok();
    text_succeeded && enabled_succeeded
}

pub(crate) fn build_tray_menu<R: Runtime>(
    app: &App<R>,
    presentation: &TrayMenuPresentation,
) -> tauri::Result<(Menu<R>, TrayMenuState<R>)> {
    let open_tasks = MenuItem::with_id(
        app,
        OPEN_TASKS_MENU_ID,
        &presentation.open_tasks.text,
        presentation.open_tasks.enabled,
        None::<&str>,
    )?;
    let toggle_focus = MenuItem::with_id(
        app,
        TOGGLE_FOCUS_MENU_ID,
        &presentation.toggle_focus.text,
        presentation.toggle_focus.enabled,
        None::<&str>,
    )?;
    let open_settings = MenuItem::with_id(
        app,
        OPEN_SETTINGS_MENU_ID,
        &presentation.open_settings.text,
        presentation.open_settings.enabled,
        None::<&str>,
    )?;
    let hotkey_status = MenuItem::with_id(
        app,
        HOTKEY_STATUS_MENU_ID,
        &presentation.hotkey_status.text,
        presentation.hotkey_status.enabled,
        None::<&str>,
    )?;
    let about_update = MenuItem::with_id(
        app,
        ABOUT_UPDATE_MENU_ID,
        &presentation.about_update.text,
        presentation.about_update.enabled,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(
        app,
        QUIT_MENU_ID,
        &presentation.quit.text,
        presentation.quit.enabled,
        None::<&str>,
    )?;
    let menu = Menu::with_items(
        app,
        &[
            &open_tasks,
            &toggle_focus,
            &open_settings,
            &hotkey_status,
            &about_update,
            &quit,
        ],
    )?;

    Ok((
        menu,
        TrayMenuState {
            open_tasks,
            toggle_focus,
            open_settings,
            hotkey_status,
            about_update,
            quit,
        },
    ))
}
