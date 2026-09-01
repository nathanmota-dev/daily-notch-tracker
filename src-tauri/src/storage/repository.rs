use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use thiserror::Error;
use uuid::Uuid;

use super::schema::{PersistedPayload, SchemaParseError};

pub const DATA_FILE_NAME: &str = "dailynotch.json";

/// Details retained when a repository starts from recoverable invalid data.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryDiagnostic {
    pub data_path: PathBuf,
    pub reason: String,
}

impl fmt::Display for RecoveryDiagnostic {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.data_path.display(), self.reason)
    }
}

/// Result of loading a repository, including an optional recovery diagnostic.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepositoryLoad {
    pub payload: PersistedPayload,
    pub recovery_diagnostic: Option<RecoveryDiagnostic>,
}

#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("failed to {operation} `{path}`: {source}")]
    Io {
        operation: &'static str,
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error("failed to serialize the persisted payload: {source}")]
    Serialization {
        #[source]
        source: serde_json::Error,
    },
}

#[derive(Debug)]
struct PendingRecovery {
    original_bytes: Vec<u8>,
    backup_created: bool,
}

#[derive(Debug)]
pub struct Repository {
    data_dir: PathBuf,
    data_path: PathBuf,
    recovery_diagnostic: Option<RecoveryDiagnostic>,
    pending_recovery: Option<PendingRecovery>,
    #[cfg(test)]
    test_failure: Option<TestFailure>,
}

impl Repository {
    /// Creates a repository rooted at a Tauri application data directory.
    pub fn new(app_data_dir: impl AsRef<Path>) -> Self {
        let data_dir = app_data_dir.as_ref().to_path_buf();
        let data_path = data_dir.join(DATA_FILE_NAME);

        Self {
            data_dir,
            data_path,
            recovery_diagnostic: None,
            pending_recovery: None,
            #[cfg(test)]
            test_failure: None,
        }
    }

    pub fn path(&self) -> &Path {
        &self.data_path
    }

    pub fn recovery_diagnostic(&self) -> Option<&RecoveryDiagnostic> {
        self.recovery_diagnostic.as_ref()
    }

    /// Loads the current payload, treating invalid JSON and unknown schemas as recoverable.
    pub fn load(&mut self) -> Result<RepositoryLoad, RepositoryError> {
        self.ensure_data_dir()?;

        let bytes = match fs::read(&self.data_path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                self.clear_recovery_state();
                return Ok(RepositoryLoad {
                    payload: PersistedPayload::empty(),
                    recovery_diagnostic: None,
                });
            }
            Err(error) => {
                return Err(Self::io_error("read", &self.data_path, error));
            }
        };

        match PersistedPayload::parse(&bytes) {
            Ok(payload) => {
                self.clear_recovery_state();
                Ok(RepositoryLoad {
                    payload,
                    recovery_diagnostic: None,
                })
            }
            Err(error) => Ok(self.recover_from_invalid_payload(bytes, error)),
        }
    }

    /// Persists a payload with a synced temporary file and an atomic same-directory rename.
    pub fn save(&mut self, payload: &PersistedPayload) -> Result<(), RepositoryError> {
        self.ensure_data_dir()?;
        let bytes = serde_json::to_vec_pretty(payload)
            .map_err(|source| RepositoryError::Serialization { source })?;

        if self.pending_recovery.is_some() {
            self.create_recovery_backup()?;
        }

        self.write_atomically(&bytes)?;
        self.pending_recovery = None;
        Ok(())
    }

    fn ensure_data_dir(&self) -> Result<(), RepositoryError> {
        fs::create_dir_all(&self.data_dir).map_err(|error| {
            Self::io_error(
                "create the application data directory",
                &self.data_dir,
                error,
            )
        })
    }

    fn recover_from_invalid_payload(
        &mut self,
        original_bytes: Vec<u8>,
        error: SchemaParseError,
    ) -> RepositoryLoad {
        let diagnostic = RecoveryDiagnostic {
            data_path: self.data_path.clone(),
            reason: error.to_string(),
        };
        eprintln!("DailyNotch persistence recovery: {diagnostic}");
        self.recovery_diagnostic = Some(diagnostic.clone());
        self.pending_recovery = Some(PendingRecovery {
            original_bytes,
            backup_created: false,
        });

        RepositoryLoad {
            payload: PersistedPayload::empty(),
            recovery_diagnostic: Some(diagnostic),
        }
    }

    fn clear_recovery_state(&mut self) {
        self.recovery_diagnostic = None;
        self.pending_recovery = None;
    }

    fn create_recovery_backup(&mut self) -> Result<(), RepositoryError> {
        let Some(pending_recovery) = self.pending_recovery.as_ref() else {
            return Ok(());
        };

        if pending_recovery.backup_created {
            return Ok(());
        }

        let backup_path = self
            .data_dir
            .join(format!("{DATA_FILE_NAME}.recovery-{}.bak", Uuid::new_v4()));
        let original_bytes = pending_recovery.original_bytes.clone();
        let result = self.write_new_synced_file(&backup_path, &original_bytes);

        if let Err(error) = result {
            let _ = fs::remove_file(&backup_path);
            return Err(error);
        }

        if let Some(pending_recovery) = self.pending_recovery.as_mut() {
            pending_recovery.backup_created = true;
        }

        Ok(())
    }

    fn write_atomically(&mut self, bytes: &[u8]) -> Result<(), RepositoryError> {
        let temporary_path = self
            .data_dir
            .join(format!(".{DATA_FILE_NAME}.{}.tmp", Uuid::new_v4()));

        let result = (|| {
            self.write_new_synced_file(&temporary_path, bytes)?;

            #[cfg(test)]
            if self.consume_test_failure(TestFailure::Rename) {
                return Err(Self::io_error(
                    "rename the temporary data file",
                    &self.data_path,
                    io::Error::other("simulated rename failure"),
                ));
            }

            fs::rename(&temporary_path, &self.data_path).map_err(|error| {
                Self::io_error("rename the temporary data file", &self.data_path, error)
            })
        })();

        if result.is_err() {
            let _ = fs::remove_file(&temporary_path);
        }

        result
    }

    fn write_new_synced_file(&mut self, path: &Path, bytes: &[u8]) -> Result<(), RepositoryError> {
        #[cfg(test)]
        if self.consume_test_failure(TestFailure::Write) {
            return Err(Self::io_error(
                "write the data file",
                path,
                io::Error::other("simulated write failure"),
            ));
        }

        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|error| Self::io_error("open the temporary data file", path, error))?;
        file.write_all(bytes)
            .map_err(|error| Self::io_error("write the temporary data file", path, error))?;
        file.sync_all()
            .map_err(|error| Self::io_error("sync the temporary data file", path, error))?;
        Ok(())
    }

    fn io_error(operation: &'static str, path: &Path, source: io::Error) -> RepositoryError {
        RepositoryError::Io {
            operation,
            path: path.to_path_buf(),
            source,
        }
    }

    #[cfg(test)]
    pub(crate) fn fail_next_write(&mut self) {
        self.test_failure = Some(TestFailure::Write);
    }

    #[cfg(test)]
    pub(crate) fn fail_next_rename(&mut self) {
        self.test_failure = Some(TestFailure::Rename);
    }

    #[cfg(test)]
    fn consume_test_failure(&mut self, expected: TestFailure) -> bool {
        if self.test_failure == Some(expected) {
            self.test_failure = None;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TestFailure {
    Write,
    Rename,
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    use super::*;
    use crate::domain::FocusSettings;

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
        let task_id = Uuid::parse_str("11111111-1111-4111-8111-111111111111")
            .expect("test UUID should be valid");
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

        PersistedPayload::from_parts(vec![task], vec![session], settings)
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
}
