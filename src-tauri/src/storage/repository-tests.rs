use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::*;
use crate::domain::{FocusSettings, WindowMonitorSnapshot, WindowPlacementSnapshot};

struct TestDirectory {
    path: PathBuf,
}

impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("dailynotch-storage-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("test directory should be created");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn sample_payload(title: &str, focus_minutes: u32) -> PersistedPayload {
    let task_id =
        Uuid::parse_str("11111111-1111-4111-8111-111111111111").expect("test UUID should be valid");
    let task = crate::domain::Task {
        id: task_id,
        title: title.to_owned(),
        notes: "Notes".to_owned(),
        scheduled_date: None,
        estimate_minutes: 25,
        is_done: false,
        created_at: DateTime::parse_from_rfc3339("2026-08-31T12:34:56Z")
            .expect("test timestamp should be valid")
            .with_timezone(&Utc),
        focused_seconds: 10,
        sort_order: 0,
    };
    let session = crate::domain::FocusSession {
        id: Uuid::parse_str("22222222-2222-4222-8222-222222222222")
            .expect("test UUID should be valid"),
        task_id: Some(task_id),
        started_at: DateTime::parse_from_rfc3339("2026-08-31T13:00:00Z")
            .expect("test timestamp should be valid")
            .with_timezone(&Utc),
        ended_at: DateTime::parse_from_rfc3339("2026-08-31T13:25:00Z")
            .expect("test timestamp should be valid")
            .with_timezone(&Utc),
        focused_seconds: 1_500,
        completed: true,
    };
    let settings = FocusSettings {
        focus_minutes,
        ..FocusSettings::default()
    };

    PersistedPayload::from_parts_with_extended_window_placement(
        vec![task],
        vec![session],
        settings,
        Some(WindowPlacementSnapshot {
            revision: 1,
            window_label: "overlay".to_owned(),
            x: 120,
            y: 80,
            width: 800,
            height: 550,
            scale_factor: 1.0,
            monitor: WindowMonitorSnapshot {
                name: Some("primary".to_owned()),
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                scale_factor: 1.0,
            },
        }),
    )
}

fn backup_paths(directory: &Path) -> Vec<PathBuf> {
    fs::read_dir(directory)
        .expect("test directory should be readable")
        .filter_map(|entry| {
            let path = entry.expect("directory entry should be valid").path();
            let name = path.file_name()?.to_str()?;
            name.starts_with("dailynotch.json.recovery-")
                .then_some(path)
        })
        .collect()
}

fn temporary_paths(directory: &Path) -> Vec<PathBuf> {
    fs::read_dir(directory)
        .expect("test directory should be readable")
        .filter_map(|entry| {
            let path = entry.expect("directory entry should be valid").path();
            let name = path.file_name()?.to_str()?;
            name.starts_with(".dailynotch.json.").then_some(path)
        })
        .collect()
}

#[test]
fn first_load_creates_the_data_directory_and_returns_empty_payload() {
    let test_directory = TestDirectory::new();
    let data_directory = test_directory.path().join("nested");
    let mut repository = Repository::new(&data_directory);

    let loaded = repository.load().expect("missing repository should load");

    assert!(data_directory.is_dir());
    assert_eq!(loaded.payload, PersistedPayload::empty());
    assert!(loaded.recovery_diagnostic.is_none());
    assert!(!repository.path().exists());
}

#[test]
fn repository_roundtrip_preserves_the_complete_payload() {
    let test_directory = TestDirectory::new();
    let payload = sample_payload("Roundtrip", 50);
    let mut repository = Repository::new(test_directory.path());

    repository.save(&payload).expect("payload should save");
    let loaded = repository.load().expect("saved payload should load");

    assert_eq!(loaded.payload, payload);
}

#[test]
fn invalid_json_preserves_original_bytes_and_records_a_diagnostic() {
    let test_directory = TestDirectory::new();
    let original_bytes = b"{not valid json".to_vec();
    let mut repository = Repository::new(test_directory.path());
    fs::write(repository.path(), &original_bytes).expect("invalid JSON should be written");

    let loaded = repository
        .load()
        .expect("invalid JSON should be recoverable");

    assert_eq!(loaded.payload, PersistedPayload::empty());
    assert!(loaded.recovery_diagnostic.is_some());
    assert_eq!(
        fs::read(repository.path()).expect("original should remain"),
        original_bytes
    );
    assert!(backup_paths(test_directory.path()).is_empty());
}

#[test]
fn unknown_schema_preserves_original_bytes_without_loading_future_data() {
    let test_directory = TestDirectory::new();
    let original_bytes = br#"{
            "schema_version": 99,
            "tasks": [{"title": "future task"}],
            "sessions": [],
            "settings": {}
        }"#;
    let mut repository = Repository::new(test_directory.path());
    fs::write(repository.path(), original_bytes).expect("future payload should be written");

    let loaded = repository
        .load()
        .expect("unknown schema should be recoverable");

    assert_eq!(loaded.payload, PersistedPayload::empty());
    assert_eq!(
        fs::read(repository.path()).expect("original should remain"),
        original_bytes
    );
    assert!(loaded
        .recovery_diagnostic
        .expect("diagnostic should exist")
        .reason
        .contains("not supported"));
}

#[test]
fn first_recovery_save_creates_one_backup_before_replacing_original_data() {
    let test_directory = TestDirectory::new();
    let original_bytes = b"invalid original bytes".to_vec();
    let mut repository = Repository::new(test_directory.path());
    fs::write(repository.path(), &original_bytes).expect("invalid data should be written");
    repository
        .load()
        .expect("invalid data should be recoverable");

    repository
        .save(&sample_payload("Recovered", 25))
        .expect("recovery payload should save");

    let backups = backup_paths(test_directory.path());
    assert_eq!(backups.len(), 1);
    assert_eq!(
        fs::read(&backups[0]).expect("backup should be readable"),
        original_bytes
    );
    assert_ne!(
        fs::read(repository.path()).expect("new payload should be readable"),
        original_bytes
    );

    repository
        .save(&sample_payload("Recovered again", 30))
        .expect("second save should succeed");
    assert_eq!(backup_paths(test_directory.path()).len(), 1);
}

#[test]
fn simulated_write_failure_keeps_the_last_valid_json() {
    let test_directory = TestDirectory::new();
    let first_payload = sample_payload("First", 25);
    let mut repository = Repository::new(test_directory.path());
    repository
        .save(&first_payload)
        .expect("initial payload should save");
    let original_bytes = fs::read(repository.path()).expect("initial JSON should be readable");
    repository.fail_next_write();

    let error = repository
        .save(&sample_payload("Failed", 50))
        .expect_err("simulated write should fail");

    assert!(error.to_string().contains("simulated write failure"));
    assert_eq!(
        fs::read(repository.path()).expect("last JSON should remain"),
        original_bytes
    );
    assert!(temporary_paths(test_directory.path()).is_empty());
}

#[test]
fn simulated_rename_failure_keeps_the_last_valid_json_and_cleans_the_temp_file() {
    let test_directory = TestDirectory::new();
    let first_payload = sample_payload("First", 25);
    let mut repository = Repository::new(test_directory.path());
    repository
        .save(&first_payload)
        .expect("initial payload should save");
    let original_bytes = fs::read(repository.path()).expect("initial JSON should be readable");
    repository.fail_next_rename();

    let error = repository
        .save(&sample_payload("Failed", 50))
        .expect_err("simulated rename should fail");

    assert!(error.to_string().contains("simulated rename failure"));
    assert_eq!(
        fs::read(repository.path()).expect("last JSON should remain"),
        original_bytes
    );
    assert!(temporary_paths(test_directory.path()).is_empty());
}

#[test]
fn atomic_write_leaves_no_temporary_file_in_the_data_directory() {
    let test_directory = TestDirectory::new();
    let mut repository = Repository::new(test_directory.path());

    repository
        .save(&sample_payload("Atomic", 25))
        .expect("payload should save atomically");

    assert!(repository.path().parent() == Some(test_directory.path()));
    assert!(temporary_paths(test_directory.path()).is_empty());
}
