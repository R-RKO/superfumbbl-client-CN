//! Owner 10-22 ("Option A"): Settings > General > Client windows > "Allow a second client window" (`allowSecondClient`,
//! off by default). The public edition is single-instance (tauri-plugin-single-instance); with the setting on, a second
//! launch starts a normal second client instead of focusing the running one.
//!
//! The plugin has to be registered on the Builder BEFORE `build()` (and before every other plugin), so the decision is
//! made from settings.json read straight off disk at startup, before any webview exists. Its directory is resolved the
//! way Tauri's own `app_data_dir()` does it (`dirs::data_dir()` joined with the bundle identifier), since there is no
//! AppHandle yet. FAIL-SAFE: a missing / unreadable / unparsable file, an absent key or anything but JSON `true` keeps
//! single-instance ON. Only the page writes settings.json; this side only reads it.
//!
//! Edition-scoped (Astra 10-22): the fork and public builds share the identifier and so the settings file; the key
//! only counts when `allowSecondClientEdition` names THIS build's edition ("public" / "fork"), which the Settings
//! checkbox writes beside it. A mismatch keeps the guard on.
//!
//! JNLP with the guard off: a double-clicked game link is not forwarded to a running window; it starts a new client
//! that joins through the cold-start argv path. The Settings disclaimer says so; no behaviour change.

use std::path::{Path, PathBuf};

use tauri::Manager;

/// The settings.json keys the page writes (src/game/settings.ts).
pub const ALLOW_KEY: &str = "allowSecondClient";
pub const EDITION_KEY: &str = "allowSecondClientEdition";
/// Set = single-instance forced on (fork opt-in, unchanged); a second client can then never start.
pub const FORCE_ENV: &str = "FUMBBL_SINGLE_INSTANCE";

/// This build's edition, as the page names it (game/edition.ts: FORK_EDITION ? 'fork' : 'public').
pub fn running_edition() -> &'static str {
    if cfg!(public_edition) {
        "public"
    } else {
        "fork"
    }
}

/// True only when the settings text is a JSON object whose `allowSecondClient` is exactly `true` AND whose
/// `allowSecondClientEdition` is exactly `edition`.
pub fn allow_from_settings_text(text: &str, edition: &str) -> bool {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else { return false };
    value.get(ALLOW_KEY).and_then(|b| b.as_bool()) == Some(true)
        && value.get(EDITION_KEY).and_then(|e| e.as_str()) == Some(edition)
}

/// Reads `<dir>/settings.json` (same size-bounded reader as settings_load). Missing / unreadable → false.
pub fn allow_in_dir(dir: &Path, edition: &str) -> bool {
    super::read_settings_text(&dir.join(super::SETTINGS_FILE))
        .map(|text| allow_from_settings_text(&text, edition))
        .unwrap_or(false)
}

fn force_env_set() -> bool {
    std::env::var_os(FORCE_ENV).is_some()
}

/// The app data dir before the app is built: what Tauri's `app_data_dir()` resolves to (`dirs::data_dir()/<identifier>`).
pub fn boot_data_dir(identifier: &str) -> Option<PathBuf> {
    if identifier.is_empty() {
        return None;
    }
    dirs::data_dir().map(|dir| dir.join(identifier))
}

/// Whether the single-instance plugin is registered. FUMBBL_SINGLE_INSTANCE always forces it (fork two-coach testing
/// opt-in, unchanged); the public edition enforces it unless the setting allows a second client.
pub fn single_instance_enforced(public_edition: bool, env_forced: bool, allow_second: bool) -> bool {
    env_forced || (public_edition && !allow_second)
}

/// Startup read: the setting as saved on disk for this identifier. Any failure → false (single-instance stays on).
pub fn allow_at_boot(identifier: &str) -> bool {
    boot_data_dir(identifier).map(|dir| allow_in_dir(&dir, running_edition())).unwrap_or(false)
}

pub const FORCED_HINT: &str = "Single-instance mode is forced by the environment.";

/// Esc menu > "New client window". OPTIONAL command (shell-api.json `_about`): the page probes it with `probe: true` and
/// hides the row when the shell lacks it. A real call starts the current executable again with NO arguments (no JNLP,
/// no flags) - only when settings.json allows a second client, so a stray call can never open a second session against
/// the user's wish. Returns true when it launched (or, for a probe, that a second client CAN start: false while
/// FUMBBL_SINGLE_INSTANCE forces the guard, since the child would only forward to this window and exit).
#[tauri::command]
pub fn launch_second_instance(app: tauri::AppHandle, probe: Option<bool>) -> Result<bool, String> {
    if probe.unwrap_or(false) {
        return Ok(!force_env_set());
    }
    if force_env_set() {
        return Err(FORCED_HINT.into());
    }
    let dir = app.path().app_data_dir().map_err(|e| format!("no data dir: {e}"))?;
    if !allow_in_dir(&dir, running_edition()) {
        return Err("Turn on Settings > General > Allow a second client window first.".into());
    }
    // AppImage-aware (Linux: the .AppImage itself, not the mounted inner binary).
    let exe = tauri::process::current_binary(&app.env()).map_err(|e| format!("cannot find the client executable: {e}"))?;
    std::process::Command::new(exe)
        .spawn()
        .map(|_| true)
        .map_err(|e| format!("could not start a second client: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_keeps_single_instance_on() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!allow_in_dir(dir.path(), "public"));
        assert!(single_instance_enforced(true, false, allow_in_dir(dir.path(), "public")));
        assert!(!allow_in_dir(&dir.path().join("does-not-exist"), "public"));
    }

    #[test]
    fn key_true_turns_single_instance_off() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), r#"{ "coach": "x", "allowSecondClient": true, "allowSecondClientEdition": "public" }"#).unwrap();
        assert!(allow_in_dir(dir.path(), "public"));
        assert!(!single_instance_enforced(true, false, allow_in_dir(dir.path(), "public")));
    }

    #[test]
    fn anything_but_json_true_is_fail_safe() {
        for text in [
            "",
            "not json",
            "{}",
            r#"{"allowSecondClient": false}"#,
            r#"{"allowSecondClient": "true"}"#,
            r#"{"allowSecondClient": 1}"#,
            r#"{"allowSecondClient": null}"#,
            r#"[true]"#,
            "true",
        ] {
            assert!(!allow_from_settings_text(text, "public"), "{text}");
        }
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), "{ \"allowSecondClient\": tru").unwrap();
        assert!(!allow_in_dir(dir.path(), "public"));
    }

    #[test]
    fn edition_mismatch_keeps_the_guard_on() {
        let dir = tempfile::tempdir().unwrap();
        // the fork build turned it on; the public build sharing the identifier must not honour it
        std::fs::write(dir.path().join("settings.json"), r#"{"allowSecondClient": true, "allowSecondClientEdition": "fork"}"#).unwrap();
        assert!(!allow_in_dir(dir.path(), "public"));
        assert!(single_instance_enforced(true, false, allow_in_dir(dir.path(), "public")));
        assert!(allow_in_dir(dir.path(), "fork"));
        // edition key absent / wrong type: off
        assert!(!allow_from_settings_text(r#"{"allowSecondClient": true}"#, "public"));
        assert!(!allow_from_settings_text(r#"{"allowSecondClient": true, "allowSecondClientEdition": 1}"#, "public"));
        assert!(["public", "fork"].contains(&running_edition()));
    }

    #[test]
    fn env_var_still_forces_and_fork_stays_multi() {
        assert!(single_instance_enforced(false, true, true));
        assert!(single_instance_enforced(true, true, true));
        assert!(!single_instance_enforced(false, false, false));
        assert!(single_instance_enforced(true, false, false));
    }

    #[test]
    fn boot_dir_matches_identifier() {
        assert_eq!(boot_data_dir(""), None);
        if let Some(dir) = boot_data_dir("com.fumbbl40k.app") {
            assert!(dir.ends_with("com.fumbbl40k.app"));
        }
    }
}
