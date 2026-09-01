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
#[path = "repository-tests.rs"]
mod tests;
