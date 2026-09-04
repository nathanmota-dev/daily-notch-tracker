use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

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

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) enum ManagedWindowLabel {
    Overlay,
    Tasks,
    Settings,
}

impl ManagedWindowLabel {
    pub(crate) fn from_label(label: &str) -> Option<Self> {
        match label {
            "overlay" => Some(Self::Overlay),
            "tasks" => Some(Self::Tasks),
            "settings" => Some(Self::Settings),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct WindowNavigationSnapshot {
    pub(crate) visible_windows: BTreeSet<ManagedWindowLabel>,
    pub(crate) focused_window: Option<ManagedWindowLabel>,
    pub(crate) tasks_window_origin: Option<TasksWindowOrigin>,
}
