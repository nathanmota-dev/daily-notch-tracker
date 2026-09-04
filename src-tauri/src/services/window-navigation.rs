use std::sync::Mutex;

use crate::domain::AppError;

use super::window_navigation_types::{
    ManagedWindowLabel, TasksWindowOrigin, WindowNavigationSnapshot,
};

#[derive(Debug, Default)]
pub(crate) struct WindowNavigationState {
    snapshot: Mutex<WindowNavigationSnapshot>,
}

impl WindowNavigationState {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn remember_tasks_origin(
        &self,
        origin: Option<TasksWindowOrigin>,
    ) -> Result<(), AppError> {
        self.with_snapshot(|snapshot| {
            snapshot.tasks_window_origin = origin;
        })
    }

    pub(crate) fn record_shown_and_focused(&self, label: &str) -> Result<(), AppError> {
        self.record_visible(label, true)
    }

    pub(crate) fn record_focused(&self, label: &str) -> Result<(), AppError> {
        self.record_visible(label, true)
    }

    pub(crate) fn record_hidden(&self, label: &str) -> Result<(), AppError> {
        self.with_window_label(label, |snapshot, label| {
            snapshot.visible_windows.remove(&label);
            if snapshot.focused_window == Some(label) {
                snapshot.focused_window = None;
            }
        })
    }

    pub(crate) fn tasks_window_origin(&self) -> Result<Option<TasksWindowOrigin>, AppError> {
        self.with_snapshot(|snapshot| snapshot.tasks_window_origin)
    }

    pub(crate) fn clear_tasks_window_origin(&self) -> Result<(), AppError> {
        self.with_snapshot(|snapshot| {
            snapshot.tasks_window_origin = None;
        })
    }

    #[cfg(test)]
    pub(crate) fn snapshot(&self) -> Result<WindowNavigationSnapshot, AppError> {
        self.with_snapshot(|snapshot| snapshot.clone())
    }

    #[cfg(test)]
    pub(crate) fn register_visible_window(&self, label: &str) -> Result<(), AppError> {
        self.record_visible(label, false)
    }

    fn record_visible(&self, label: &str, focused: bool) -> Result<(), AppError> {
        self.with_window_label(label, |snapshot, label| {
            snapshot.visible_windows.insert(label);
            if focused {
                snapshot.focused_window = Some(label);
            }
        })
    }

    fn with_window_label(
        &self,
        label: &str,
        update: impl FnOnce(&mut WindowNavigationSnapshot, ManagedWindowLabel),
    ) -> Result<(), AppError> {
        let Some(label) = ManagedWindowLabel::from_label(label) else {
            return Ok(());
        };

        self.with_snapshot(|snapshot| update(snapshot, label))
    }

    fn with_snapshot<T>(
        &self,
        update: impl FnOnce(&mut WindowNavigationSnapshot) -> T,
    ) -> Result<T, AppError> {
        let mut snapshot = self
            .snapshot
            .lock()
            .map_err(|_| AppError::internal("The window navigation state is unavailable."))?;
        Ok(update(&mut snapshot))
    }
}

#[cfg(test)]
#[path = "window-navigation-tests.rs"]
mod tests;
