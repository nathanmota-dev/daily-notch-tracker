use std::path::PathBuf;

use super::AppState;
use crate::domain::{
    AppDiagnostics, AppError, AppSnapshot, AutostartDiagnostic, DomainResult, FocusSnapshot,
    ShortcutDiagnostic, ShortcutStatus, TrayDiagnostic, WindowPlacementSnapshot,
};
use crate::storage::{PersistedPayload, RecoveryDiagnostic, Repository};

impl AppState {
    pub(super) fn with_payload(
        payload: PersistedPayload,
        repository: Option<Repository>,
        recovery_diagnostic: Option<RecoveryDiagnostic>,
    ) -> Self {
        let confirmed_payload = payload.clone();
        let placement_revision = payload
            .extended_window_placement
            .as_ref()
            .map_or(0, |placement| placement.revision);

        Self {
            revision: 0,
            tasks: payload.tasks,
            sessions: payload.sessions,
            settings: payload.settings,
            window_placement: super::WindowPlacementState {
                snapshot: payload.extended_window_placement,
                revision: placement_revision,
            },
            focus: FocusSnapshot::default(),
            shortcut_status: ShortcutStatus::default(),
            repository,
            confirmed_payload,
            recovery_diagnostic,
            running_since: None,
            accumulated_focus_ms: 0,
            focus_token: 0,
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
        if self.persist_payload(&payload) {
            self.restore_confirmed_payload();
            return Err(AppError::persistence("Unable to persist local data."));
        }

        self.confirmed_payload = payload;
        self.revision += 1;
        Ok(self.snapshot())
    }

    fn current_payload(&self) -> PersistedPayload {
        PersistedPayload::from_parts_with_extended_window_placement(
            self.tasks.clone(),
            self.sessions.clone(),
            self.settings.clone(),
            self.window_placement.snapshot.clone(),
        )
    }

    fn persist_payload(&mut self, payload: &PersistedPayload) -> bool {
        match self.repository.as_mut() {
            Some(repository) => repository.save(payload).is_err(),
            None => false,
        }
    }

    fn restore_confirmed_payload(&mut self) {
        self.tasks = self.confirmed_payload.tasks.clone();
        self.sessions = self.confirmed_payload.sessions.clone();
        self.settings = self.confirmed_payload.settings.clone();
        self.window_placement.snapshot = self.confirmed_payload.extended_window_placement.clone();
        self.window_placement.revision = self
            .window_placement
            .snapshot
            .as_ref()
            .map_or(0, |placement| placement.revision);
    }

    pub(crate) fn save_window_placement(
        &mut self,
        mut placement: WindowPlacementSnapshot,
    ) -> DomainResult<WindowPlacementSnapshot> {
        if !placement.is_valid() {
            return Err(AppError::validation_without_field(
                "The window placement is invalid.",
            ));
        }
        if self.window_placement.revision == u64::MAX {
            return Err(AppError::internal(
                "The window placement revision is exhausted.",
            ));
        }

        let previous_placement = self.window_placement.snapshot.clone();
        let previous_revision = self.window_placement.revision;
        placement.revision = previous_revision + 1;
        self.window_placement.snapshot = Some(placement.clone());

        let payload = self.current_payload();
        if self.persist_payload(&payload) {
            self.window_placement.snapshot = previous_placement;
            self.window_placement.revision = previous_revision;
            return Err(AppError::persistence("Unable to persist local data."));
        }

        self.confirmed_payload = payload;
        self.window_placement.revision = placement.revision;
        Ok(placement)
    }

    pub fn data_file_path(&self) -> Option<PathBuf> {
        self.repository
            .as_ref()
            .map(|repository| repository.path().to_path_buf())
    }

    pub fn diagnostics(
        &self,
        app_version: String,
        autostart: AutostartDiagnostic,
        tray: TrayDiagnostic,
    ) -> AppDiagnostics {
        AppDiagnostics {
            app_version,
            data_file_path: self.data_file_path().map_or_else(
                || "unavailable".to_owned(),
                |path| path.display().to_string(),
            ),
            shortcut: ShortcutDiagnostic {
                status: self.shortcut_status,
                message: shortcut_message(self.shortcut_status),
            },
            autostart,
            tray,
        }
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

fn shortcut_message(status: ShortcutStatus) -> Option<String> {
    match status {
        ShortcutStatus::Registered => None,
        ShortcutStatus::Unavailable => {
            Some("Global shortcut integration is unavailable in this desktop session.".to_owned())
        }
        ShortcutStatus::Error => {
            Some("Global shortcut could not be registered. It may already be in use.".to_owned())
        }
    }
}
