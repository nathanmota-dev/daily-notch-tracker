//! Application services used by the desktop runtime.

#[path = "focus-runtime.rs"]
mod focus_runtime;
#[path = "focus-scheduler.rs"]
mod focus_scheduler;

pub(crate) use focus_runtime::sync_focus_scheduler;
pub use focus_scheduler::FocusScheduler;
