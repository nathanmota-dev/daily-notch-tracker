use std::sync::Mutex;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::FocusScheduler;
use crate::domain::AppError;
use crate::state::AppState;

pub(crate) fn sync_focus_scheduler<R: Runtime>(
    app: &AppHandle<R>,
    schedule: Option<(DateTime<Utc>, u64)>,
) {
    let Some(scheduler) = app.try_state::<FocusScheduler>() else {
        return;
    };

    match schedule {
        Some((end_at, token)) => {
            let app = app.clone();
            scheduler.schedule(end_at, move || complete_scheduled_focus(app, token));
        }
        None => scheduler.cancel(),
    }
}

fn complete_scheduled_focus<R: Runtime>(app: AppHandle<R>, token: u64) {
    let Some(state) = app.try_state::<Mutex<AppState>>() else {
        return;
    };

    let result = match state.lock() {
        Ok(mut state) => {
            let result = state.complete_focus_if_due_at(token, Utc::now());
            let schedule = state.focus_schedule();
            match &result {
                Ok(None) => sync_focus_scheduler(&app, schedule),
                Err(_) if schedule.is_some() => schedule_focus_retry(&app, token),
                Ok(Some(_)) | Err(_) => {}
            }
            result
        }
        Err(_) => Err(AppError::internal("The application state is unavailable.")),
    };

    let Ok(Some(snapshot)) = result else {
        return;
    };

    super::sync_tray_menu(&app, &snapshot);
    let _ = app.emit("focus-changed", &snapshot);
    let _ = app.emit("store-changed", &snapshot);
}

fn schedule_focus_retry<R: Runtime>(app: &AppHandle<R>, token: u64) {
    let Some(scheduler) = app.try_state::<FocusScheduler>() else {
        return;
    };

    let app = app.clone();
    scheduler.schedule(Utc::now() + ChronoDuration::seconds(1), move || {
        complete_scheduled_focus(app, token);
    });
}
