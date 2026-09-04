use serde::{Deserialize, Serialize};

use crate::domain::TasksWindowIntent;

pub(crate) const SURFACE_CHANGED_EVENT: &str = "surface-changed";

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OverlayPresentationMode {
    Collapsed,
    Expanded,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksWindowOrigin {
    pub presentation_mode: OverlayPresentationMode,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum SurfaceLabel {
    #[default]
    Overlay,
    Tasks,
    Settings,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SurfaceChangedPayload {
    pub(crate) surface: SurfaceLabel,
    pub(crate) intent: Option<TasksWindowIntent>,
    pub(crate) presentation_mode: Option<OverlayPresentationMode>,
}

impl SurfaceChangedPayload {
    pub(crate) fn new(
        surface: SurfaceLabel,
        intent: Option<TasksWindowIntent>,
        presentation_mode: Option<OverlayPresentationMode>,
    ) -> Self {
        Self {
            surface,
            intent,
            presentation_mode,
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct WindowNavigationSnapshot {
    pub(crate) active_surface: SurfaceLabel,
    pub(crate) presentation_origin: Option<OverlayPresentationMode>,
}
