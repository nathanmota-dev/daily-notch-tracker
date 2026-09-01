//! Versioned JSON persistence for the local application state.

mod repository;
mod schema;

pub use repository::{
    RecoveryDiagnostic, Repository, RepositoryError, RepositoryLoad, DATA_FILE_NAME,
};
pub use schema::{PersistedPayload, SchemaParseError, CURRENT_SCHEMA_VERSION};
