//! Application services used by the desktop runtime.

#[path = "focus-scheduler.rs"]
mod focus_scheduler;

pub use focus_scheduler::FocusScheduler;
