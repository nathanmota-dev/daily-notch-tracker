//! Domain models and rules shared by the desktop application.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub mod focus;
pub mod session;
pub mod settings;
pub mod streak;
pub mod task;

pub use focus::{
    validate_duration_seconds, StartFocusInput, MAX_FOCUS_DURATION_SECONDS,
    MIN_FOCUS_DURATION_SECONDS,
};
pub use session::{
    activity_by_local_date, activity_by_offset, local_date, total_focused_seconds, FocusSession,
};
pub use settings::{FocusSettings, FocusSettingsPatch};
pub use streak::{
    calculate_streak, streak_from_activity, streak_from_sessions, streak_from_sessions_at_offset,
};
pub use task::{
    clamp_minutes, parse_scheduled_date, parse_task_id, CreateTaskInput, MoveTasksInput, Task,
    TaskBucket, UpdateTaskInput,
};

pub type DomainResult<T> = Result<T, AppError>;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AppErrorCode {
    Validation,
    NotFound,
    Conflict,
    Persistence,
    PermissionDenied,
    IntegrationUnavailable,
    InvalidUrl,
    CommandUnavailable,
    Internal,
}

#[derive(Clone, Debug, Eq, Error, PartialEq, Serialize)]
#[error("{message}")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

impl AppError {
    pub fn validation(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Validation,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn validation_without_field(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Validation,
            message: message.into(),
            field: None,
        }
    }

    pub fn not_found(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::NotFound,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn conflict(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Conflict,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn conflict_without_field(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Conflict,
            message: message.into(),
            field: None,
        }
    }

    pub fn persistence(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Persistence,
            message: message.into(),
            field: None,
        }
    }

    pub fn integration_unavailable(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::IntegrationUnavailable,
            message: message.into(),
            field: None,
        }
    }

    pub fn invalid_url(message: impl Into<String>, field: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::InvalidUrl,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::Internal,
            message: message.into(),
            field: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FocusState {
    #[default]
    Idle,
    Running,
    Paused,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSnapshot {
    pub state: FocusState,
    pub active_task_id: Option<Uuid>,
    pub active_task_title: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub end_at: Option<DateTime<Utc>>,
    pub paused_remaining_ms: Option<u64>,
    pub total_ms: u64,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ShortcutStatus {
    Registered,
    #[default]
    Unavailable,
    Error,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum IntegrationStatus {
    Available,
    #[default]
    Unavailable,
    Error,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutDiagnostic {
    pub status: ShortcutStatus,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartDiagnostic {
    pub enabled: bool,
    pub message: Option<String>,
    pub status: IntegrationStatus,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDiagnostics {
    pub app_version: String,
    pub data_file_path: String,
    pub shortcut: ShortcutDiagnostic,
    pub autostart: AutostartDiagnostic,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TasksWindowIntent {
    List,
    Add,
    Task {
        #[serde(rename = "taskId")]
        task_id: String,
    },
}

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
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    /// Monotonic runtime revision used to reject stale cross-window updates.
    pub revision: u64,
    pub tasks: Vec<Task>,
    pub sessions: Vec<FocusSession>,
    pub settings: FocusSettings,
    pub focus: FocusSnapshot,
    pub shortcut_status: ShortcutStatus,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ipc_boundary_types_serialize_with_camel_case_fields() {
        let diagnostics = AppDiagnostics {
            app_version: "0.1.0".to_owned(),
            data_file_path: "/tmp/dailynotch.json".to_owned(),
            shortcut: ShortcutDiagnostic {
                status: ShortcutStatus::Unavailable,
                message: None,
            },
            autostart: AutostartDiagnostic {
                enabled: false,
                status: IntegrationStatus::Unavailable,
                message: Some("not available".to_owned()),
            },
        };
        let intent = TasksWindowIntent::Task {
            task_id: "11111111-1111-4111-8111-111111111111".to_owned(),
        };
        let placement = WindowPlacementSnapshot {
            revision: 4,
            window_label: "overlay".to_owned(),
            x: 10,
            y: 20,
            width: 360,
            height: 72,
            scale_factor: 1.25,
        };

        let diagnostics_json =
            serde_json::to_value(diagnostics).expect("diagnostics should serialize");
        let intent_json = serde_json::to_value(intent).expect("intent should serialize");
        let placement_json =
            serde_json::to_value(placement).expect("window placement should serialize");

        assert_eq!(diagnostics_json["appVersion"], "0.1.0");
        assert_eq!(diagnostics_json["dataFilePath"], "/tmp/dailynotch.json");
        assert_eq!(diagnostics_json["autostart"]["status"], "unavailable");
        assert_eq!(intent_json["kind"], "task");
        assert_eq!(
            intent_json["taskId"],
            "11111111-1111-4111-8111-111111111111"
        );
        assert_eq!(placement_json["windowLabel"], "overlay");
        assert_eq!(placement_json["scaleFactor"], 1.25);
    }
}
