use serde::{Deserialize, Serialize};

use super::task::clamp_minutes;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FocusSettings {
    pub focus_minutes: u32,
    pub notifications_enabled: bool,
    pub play_sound: bool,
    pub show_timeline: bool,
    pub rainbow_timeline: bool,
    pub minimal_mode: bool,
    pub launch_at_login: bool,
}

impl Default for FocusSettings {
    fn default() -> Self {
        Self {
            focus_minutes: 25,
            notifications_enabled: true,
            play_sound: true,
            show_timeline: true,
            rainbow_timeline: false,
            minimal_mode: false,
            launch_at_login: false,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct FocusSettingsPatch {
    pub focus_minutes: Option<i64>,
    pub notifications_enabled: Option<bool>,
    pub play_sound: Option<bool>,
    pub show_timeline: Option<bool>,
    pub rainbow_timeline: Option<bool>,
    pub minimal_mode: Option<bool>,
}

impl FocusSettings {
    pub fn apply_patch(&mut self, patch: FocusSettingsPatch) {
        if let Some(focus_minutes) = patch.focus_minutes {
            self.focus_minutes = clamp_minutes(focus_minutes);
        }
        if let Some(notifications_enabled) = patch.notifications_enabled {
            self.notifications_enabled = notifications_enabled;
        }
        if let Some(play_sound) = patch.play_sound {
            self.play_sound = play_sound;
        }
        if let Some(show_timeline) = patch.show_timeline {
            self.show_timeline = show_timeline;
        }
        if let Some(rainbow_timeline) = patch.rainbow_timeline {
            self.rainbow_timeline = rainbow_timeline;
        }
        if let Some(minimal_mode) = patch.minimal_mode {
            self.minimal_mode = minimal_mode;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_initial_focus_contract() {
        assert_eq!(
            FocusSettings::default(),
            FocusSettings {
                focus_minutes: 25,
                notifications_enabled: true,
                play_sound: true,
                show_timeline: true,
                rainbow_timeline: false,
                minimal_mode: false,
                launch_at_login: false,
            }
        );
    }

    #[test]
    fn partial_patch_keeps_unmentioned_values_and_clamps_focus_minutes() {
        let mut settings = FocusSettings::default();
        settings.apply_patch(FocusSettingsPatch {
            focus_minutes: Some(999),
            play_sound: Some(false),
            ..FocusSettingsPatch::default()
        });

        assert_eq!(settings.focus_minutes, 180);
        assert!(!settings.play_sound);
        assert!(settings.notifications_enabled);
        assert!(settings.show_timeline);
    }

    #[test]
    fn settings_serialization_uses_camel_case_fields() {
        let json =
            serde_json::to_value(FocusSettings::default()).expect("settings should serialize");

        assert_eq!(json["focusMinutes"], 25);
        assert_eq!(json["notificationsEnabled"], true);
        assert_eq!(json["playSound"], true);
        assert_eq!(json["showTimeline"], true);
        assert_eq!(json["rainbowTimeline"], false);
        assert_eq!(json["minimalMode"], false);
        assert_eq!(json["launchAtLogin"], false);
    }
}
