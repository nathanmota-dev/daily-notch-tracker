#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}! DailyNotch Linux is running with Rust.")
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greet_returns_a_rust_message() {
        assert_eq!(
            greet("DailyNotch"),
            "Hello, DailyNotch! DailyNotch Linux is running with Rust."
        );
    }
}
