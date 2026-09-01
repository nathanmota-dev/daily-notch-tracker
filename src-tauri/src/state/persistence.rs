use super::AppState;
use crate::domain::{AppError, AppSnapshot, DomainResult, FocusSnapshot, ShortcutStatus};
use crate::storage::{PersistedPayload, RecoveryDiagnostic, Repository};

impl AppState {
    pub(super) fn with_payload(
        payload: PersistedPayload,
        repository: Option<Repository>,
        recovery_diagnostic: Option<RecoveryDiagnostic>,
    ) -> Self {
        let confirmed_payload = payload.clone();

        Self {
            revision: 0,
            tasks: payload.tasks,
            sessions: payload.sessions,
            settings: payload.settings,
            focus: FocusSnapshot::default(),
            shortcut_status: ShortcutStatus::default(),
            repository,
            confirmed_payload,
            recovery_diagnostic,
        }
    }

    pub(super) fn ensure_revision_available(&self) -> DomainResult<()> {
        if self.revision == u64::MAX {
            return Err(AppError::internal("The application revision is exhausted."));
        }

        Ok(())
    }

    pub(super) fn commit(&mut self) -> DomainResult<AppSnapshot> {
        let payload = self.current_payload();
        let persistence_error = match self.repository.as_mut() {
            Some(repository) => repository.save(&payload).err(),
            None => None,
        };

        if let Some(error) = persistence_error {
            self.restore_confirmed_payload();
            return Err(AppError::persistence(format!(
                "Unable to persist local data: {error}"
            )));
        }

        self.confirmed_payload = payload;
        self.revision += 1;
        Ok(self.snapshot())
    }

    fn current_payload(&self) -> PersistedPayload {
        PersistedPayload::from_parts(
            self.tasks.clone(),
            self.sessions.clone(),
            self.settings.clone(),
        )
    }

    fn restore_confirmed_payload(&mut self) {
        self.tasks = self.confirmed_payload.tasks.clone();
        self.sessions = self.confirmed_payload.sessions.clone();
        self.settings = self.confirmed_payload.settings.clone();
    }

    #[cfg(test)]
    pub(crate) fn fail_next_persistence_write(&mut self) {
        if let Some(repository) = self.repository.as_mut() {
            repository.fail_next_write();
        }
    }

    #[cfg(test)]
    pub(crate) fn fail_next_persistence_rename(&mut self) {
        if let Some(repository) = self.repository.as_mut() {
            repository.fail_next_rename();
        }
    }
}
