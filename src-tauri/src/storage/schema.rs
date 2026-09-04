use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::domain::{FocusSession, FocusSettings, Task};

/// The only payload version understood by the current application.
pub const CURRENT_SCHEMA_VERSION: u32 = 1;

/// The data stored in the local repository.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PersistedPayload {
    pub schema_version: u32,
    #[serde(default)]
    pub tasks: Vec<Task>,
    #[serde(default)]
    pub sessions: Vec<FocusSession>,
    #[serde(default)]
    pub settings: FocusSettings,
}

impl PersistedPayload {
    pub fn empty() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            tasks: Vec::new(),
            sessions: Vec::new(),
            settings: FocusSettings::default(),
        }
    }

    pub fn from_parts(
        tasks: Vec<Task>,
        sessions: Vec<FocusSession>,
        settings: FocusSettings,
    ) -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            tasks,
            sessions,
            settings,
        }
    }

    pub fn parse(bytes: &[u8]) -> Result<Self, SchemaParseError> {
        let value = serde_json::from_slice::<serde_json::Value>(bytes)
            .map_err(|error| SchemaParseError::InvalidJson(error.to_string()))?;
        let Some(schema_version) = value
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
        else {
            return Err(SchemaParseError::MissingSchemaVersion);
        };

        if schema_version != u64::from(CURRENT_SCHEMA_VERSION) {
            return Err(SchemaParseError::UnsupportedSchemaVersion(schema_version));
        }

        serde_json::from_value(value)
            .map_err(|error| SchemaParseError::InvalidPayload(error.to_string()))
    }
}

impl Default for PersistedPayload {
    fn default() -> Self {
        Self::empty()
    }
}

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum SchemaParseError {
    #[error("the JSON document is invalid: {0}")]
    InvalidJson(String),
    #[error("schema_version is missing or is not an unsigned integer")]
    MissingSchemaVersion,
    #[error("schema_version {0} is not supported")]
    UnsupportedSchemaVersion(u64),
    #[error("the payload does not match schema_version 1: {0}")]
    InvalidPayload(String),
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    use super::*;

    fn sample_task() -> Task {
        Task {
            id: Uuid::parse_str("11111111-1111-4111-8111-111111111111")
                .expect("test UUID should be valid"),
            title: "Persisted task".to_owned(),
            notes: "Notes".to_owned(),
            scheduled_date: Some("2026-08-31".parse().expect("test date should be valid")),
            estimate_minutes: 45,
            is_done: false,
            created_at: DateTime::parse_from_rfc3339("2026-08-31T12:34:56Z")
                .expect("test timestamp should be valid")
                .with_timezone(&Utc),
            focused_seconds: 12,
            sort_order: 2,
        }
    }

    fn sample_session() -> FocusSession {
        FocusSession {
            id: Uuid::parse_str("22222222-2222-4222-8222-222222222222")
                .expect("test UUID should be valid"),
            task_id: Some(
                Uuid::parse_str("11111111-1111-4111-8111-111111111111")
                    .expect("test UUID should be valid"),
            ),
            started_at: DateTime::parse_from_rfc3339("2026-08-31T13:00:00Z")
                .expect("test timestamp should be valid")
                .with_timezone(&Utc),
            ended_at: DateTime::parse_from_rfc3339("2026-08-31T13:25:00Z")
                .expect("test timestamp should be valid")
                .with_timezone(&Utc),
            focused_seconds: 1_500,
            completed: true,
        }
    }

    #[test]
    fn empty_payload_uses_the_current_schema_and_domain_defaults() {
        let payload = PersistedPayload::empty();

        assert_eq!(payload.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(payload.tasks.is_empty());
        assert!(payload.sessions.is_empty());
        assert_eq!(payload.settings, FocusSettings::default());
    }

    #[test]
    fn payload_roundtrip_preserves_tasks_sessions_and_settings() {
        let settings = FocusSettings {
            focus_minutes: 50,
            minimal_mode: true,
            ..FocusSettings::default()
        };
        let payload =
            PersistedPayload::from_parts(vec![sample_task()], vec![sample_session()], settings);

        let bytes = serde_json::to_vec(&payload).expect("payload should serialize");
        let decoded = PersistedPayload::parse(&bytes).expect("payload should parse");

        assert_eq!(decoded, payload);
    }

    #[test]
    fn payload_serialization_keeps_schema_version_and_domain_camel_case() {
        let payload = PersistedPayload::from_parts(
            vec![sample_task()],
            vec![sample_session()],
            FocusSettings::default(),
        );
        let json = serde_json::to_value(payload).expect("payload should serialize");

        assert_eq!(json["schema_version"], 1);
        assert_eq!(json["tasks"][0]["scheduledDate"], "2026-08-31");
        assert_eq!(json["tasks"][0]["createdAt"], "2026-08-31T12:34:56Z");
        assert_eq!(json["tasks"][0]["focusedSeconds"], 12);
        assert_eq!(
            json["sessions"][0]["taskId"],
            "11111111-1111-4111-8111-111111111111"
        );
        assert_eq!(json["sessions"][0]["focusedSeconds"], 1_500);
        assert_eq!(json["settings"]["focusMinutes"], 25);
    }

    #[test]
    fn missing_settings_fields_receive_focus_settings_defaults() {
        let payload = PersistedPayload::parse(
            br#"{
                "schema_version": 1,
                "tasks": [],
                "sessions": [],
                "settings": {"focusMinutes": 50}
            }"#,
        )
        .expect("partial settings should parse");

        assert_eq!(payload.settings.focus_minutes, 50);
        assert!(payload.settings.notifications_enabled);
        assert!(payload.settings.show_timeline);
        assert!(!payload.settings.rainbow_timeline);
        assert!(!payload.settings.minimal_mode);
        assert!(!payload.settings.launch_at_login);
    }

    #[test]
    fn legacy_play_sound_setting_is_ignored_and_not_written_back() {
        let payload = PersistedPayload::parse(
            br#"{
                "schema_version": 1,
                "tasks": [],
                "sessions": [],
                "settings": {
                    "focusMinutes": 25,
                    "notificationsEnabled": true,
                    "playSound": false
                }
            }"#,
        )
        .expect("legacy settings should remain readable");

        assert!(payload.settings.notifications_enabled);
        let json = serde_json::to_value(payload).expect("payload should serialize");
        assert!(json["settings"].get("playSound").is_none());
    }

    #[test]
    fn unsupported_schema_versions_are_rejected_before_deserialization() {
        let error = PersistedPayload::parse(
            br#"{
                "schema_version": 2,
                "tasks": [{"title": "future data"}],
                "sessions": [],
                "settings": {}
            }"#,
        )
        .expect_err("future schema should not be loaded");

        assert_eq!(error, SchemaParseError::UnsupportedSchemaVersion(2));
    }
}
