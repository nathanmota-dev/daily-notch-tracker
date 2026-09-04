use serde::{Deserialize, Serialize};

/// Physical geometry and identity for a monitor used by a saved window placement.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowMonitorSnapshot {
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// Physical placement for the shared extended overlay window.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowPlacementSnapshot {
    pub revision: u64,
    pub window_label: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub monitor: WindowMonitorSnapshot,
}

impl WindowPlacementSnapshot {
    pub fn is_valid(&self) -> bool {
        self.window_label == "overlay"
            && self.width > 0
            && self.height > 0
            && self.scale_factor.is_finite()
            && self.scale_factor > 0.0
            && self.monitor.width > 0
            && self.monitor.height > 0
            && self.monitor.scale_factor.is_finite()
            && self.monitor.scale_factor > 0.0
    }
}
