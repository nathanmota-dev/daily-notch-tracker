use std::sync::Mutex;

use tauri::{Manager, WindowEvent};

pub mod commands;
pub mod domain;
pub mod services;
pub mod state;
pub mod storage;

pub use commands::greet;
pub use domain::{
    AppDiagnostics, AppError, AppErrorCode, AppSnapshot, AutostartDiagnostic, CreateTaskInput,
    DomainResult, FocusSession, FocusSettings, FocusSettingsPatch, FocusSnapshot, FocusState,
    IntegrationStatus, MoveTasksInput, ShortcutDiagnostic, ShortcutStatus, StartFocusInput, Task,
    TaskBucket, TasksWindowIntent, UpdateTaskInput, WindowPlacementSnapshot,
};
pub use services::FocusScheduler;
pub use state::AppState;
pub use storage::{PersistedPayload, RecoveryDiagnostic, Repository, RepositoryError};

fn handle_window_event<R: tauri::Runtime>(window: &tauri::Window<R>, event: &WindowEvent) {
    if window.label() != "tasks" {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        // Closing Tasks should only hide its reusable window. The app state,
        // scheduler, and any active focus session must continue running.
        api.prevent_close();
        let _ = window.hide();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(handle_window_event)
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state =
                AppState::load(Repository::new(app_data_dir)).map_err(std::io::Error::other)?;
            app.manage(Mutex::new(state));
            app.manage(FocusScheduler::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::add_task,
            commands::update_task,
            commands::delete_task,
            commands::toggle_task,
            commands::move_tasks,
            commands::start_focus,
            commands::pause_focus,
            commands::resume_focus,
            commands::stop_focus,
            commands::toggle_focus,
            commands::update_settings,
            commands::get_app_diagnostics,
            commands::set_autostart,
            commands::open_tasks_window,
            commands::close_tasks_window,
            commands::open_settings_window,
            commands::open_external_release,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DailyNotch Linux");
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::handle_window_event;
    use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

    #[test]
    fn tasks_window_close_is_intercepted_without_removing_the_window() {
        let app = tauri::test::mock_builder()
            .on_window_event(handle_window_event)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("mock app should build");
        let tasks = WebviewWindowBuilder::new(&app, "tasks", WebviewUrl::App("index.html".into()))
            .build()
            .expect("tasks window should build");
        let settings =
            WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html".into()))
                .build()
                .expect("settings window should build");

        let tasks_window = tasks.as_ref().window();
        let settings_window = settings.as_ref().window();
        handle_window_event(&tasks_window, &WindowEvent::Focused(true));
        handle_window_event(&settings_window, &WindowEvent::Focused(true));

        let app_handle = app.handle().clone();
        let close_tasks = tasks.clone();
        let closer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(10));
            close_tasks.close().expect("tasks window should close");
        });

        let exit_code = app.run_return(move |handle, event| {
            if let RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { .. },
                ..
            } = event
            {
                if label == "tasks" {
                    handle
                        .get_webview_window("tasks")
                        .expect("prevented tasks window should still exist")
                        .destroy()
                        .expect("tasks window should be destroyable in the test");
                    handle
                        .get_webview_window("settings")
                        .expect("settings window should still exist")
                        .close()
                        .expect("settings window should close");
                }
            }
        });

        closer.join().expect("window closer should finish");
        assert_eq!(exit_code, 0);
        assert!(app_handle.get_webview_window("tasks").is_some());
    }
}
