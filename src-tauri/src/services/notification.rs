use tauri::{AppHandle, Manager, Runtime};

use super::notification_types::{
    NotificationBackendError, NotificationPermissionState, NotificationRequest,
    SharedNotificationBackend,
};
use crate::domain::{AppSnapshot, FocusSession};

pub(crate) const FOCUS_COMPLETION_NOTIFICATION_TITLE: &str = "Focus block complete";

/// Sends focus-completion notifications without coupling the focus engine to Tauri.
pub(crate) struct NotificationService {
    backend: SharedNotificationBackend,
}

impl NotificationService {
    pub(crate) fn new(backend: SharedNotificationBackend) -> Self {
        Self { backend }
    }

    pub(crate) fn notify_focus_completion(&self, before: &AppSnapshot, after: &AppSnapshot) {
        if !after.settings.notifications_enabled {
            return;
        }

        let Some(request) = focus_completion_request(before, after) else {
            return;
        };

        let permission = match self.backend.permission_state() {
            Ok(permission) => permission,
            Err(NotificationBackendError::Unavailable | NotificationBackendError::Failed) => {
                return;
            }
        };
        let permission = match permission {
            NotificationPermissionState::Prompt => match self.backend.request_permission() {
                Ok(permission) => permission,
                Err(NotificationBackendError::Unavailable | NotificationBackendError::Failed) => {
                    return
                }
            },
            permission => permission,
        };

        if permission != NotificationPermissionState::Granted {
            return;
        }

        let _ = self.backend.send(&request);
    }
}

pub(crate) fn notify_focus_completion<R: Runtime>(
    app: &AppHandle<R>,
    before: &AppSnapshot,
    after: &AppSnapshot,
) {
    let Some(service) = app.try_state::<NotificationService>() else {
        return;
    };

    service.notify_focus_completion(before, after);
}

fn focus_completion_request(
    before: &AppSnapshot,
    after: &AppSnapshot,
) -> Option<NotificationRequest> {
    let session = after.sessions.iter().find(|session| {
        session.completed
            && session.focused_seconds > 0
            && session.ended_at >= session.started_at
            && !before
                .sessions
                .iter()
                .any(|previous| previous.id == session.id)
    })?;

    Some(NotificationRequest {
        title: FOCUS_COMPLETION_NOTIFICATION_TITLE.to_owned(),
        body: completed_task_title(before, after, session),
    })
}

fn completed_task_title(
    before: &AppSnapshot,
    after: &AppSnapshot,
    session: &FocusSession,
) -> Option<String> {
    let task_id = session.task_id?;
    if before.focus.active_task_id == Some(task_id) {
        if let Some(title) = before.focus.active_task_title.clone() {
            return Some(title);
        }
    }

    after
        .tasks
        .iter()
        .find(|task| task.id == task_id)
        .map(|task| task.title.clone())
}

#[cfg(test)]
#[path = "notification-tests.rs"]
mod tests;
