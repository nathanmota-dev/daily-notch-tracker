use std::sync::Mutex;

use crate::domain::AppError;

use super::window_navigation_types::{
    OverlayPresentationMode, SurfaceLabel, WindowNavigationSnapshot,
};

#[derive(Debug, Default)]
pub(crate) struct WindowNavigationState {
    snapshot: Mutex<WindowNavigationSnapshot>,
}

impl WindowNavigationState {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn transition_to(
        &self,
        surface: SurfaceLabel,
        presentation_origin: Option<OverlayPresentationMode>,
    ) -> Result<WindowNavigationSnapshot, AppError> {
        self.with_snapshot(|snapshot| {
            snapshot.active_surface = surface;
            snapshot.presentation_origin = presentation_origin;
            snapshot.clone()
        })
    }

    pub(crate) fn presentation_origin(&self) -> Result<Option<OverlayPresentationMode>, AppError> {
        self.with_snapshot(|snapshot| snapshot.presentation_origin)
    }

    #[cfg(test)]
    pub(crate) fn snapshot(&self) -> Result<WindowNavigationSnapshot, AppError> {
        self.with_snapshot(|snapshot| snapshot.clone())
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
