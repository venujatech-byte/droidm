use serde_json::{json, Value};

async fn on_worker<T, F>(work: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| format!("ADB worker failed: {error}"))?
}

#[tauri::command]
async fn adb_devices() -> Result<Vec<crate::adb::AdbDeviceInfo>, String> {
    on_worker(|| {
        crate::adb::adb_cmd(None, &["version"])?;
        Ok(crate::adb::list_devices())
    })
    .await
}

#[tauri::command]
fn adb_initial_serial() -> Option<String> {
    std::env::var("SERVER_LAUNCHER_ADB_SERIAL").ok()
}

#[derive(serde::Serialize)]
struct AdbThemeInfo {
    theme: String,
    is_dark: bool,
    bg: String,
    side: String,
    surface: String,
    surface2: String,
    well: String,
    line: String,
    text: String,
    muted: String,
    dim: String,
    accent: String,
    accent_strong: String,
    accent_soft: String,
    accent_text: String,
}

#[tauri::command]
fn adb_theme_info() -> AdbThemeInfo {
    let config = crate::config::ConfigFile::load_from_file(&crate::config::ConfigFile::default_path());
    let theme_mode = config.theme
        .as_deref()
        .map(crate::theme::ThemeMode::from_id_str)
        .unwrap_or(crate::theme::ThemeMode::NocturnalCommand);
    let mut palette = theme_mode.palette();

    if let Some(ref acc_str) = config.accent_color {
        if acc_str == "system" || acc_str == "gtk4" {
            palette.apply_accent(crate::theme::current_gtk4_accent_color());
        } else if let Some(c) = crate::theme::parse_hex_color(acc_str) {
            palette.apply_accent(c);
        }
    } else {
        palette.apply_accent(crate::theme::current_gtk4_accent_color());
    }

    if let Ok(theme_id) = std::env::var("SERVER_LAUNCHER_ADB_THEME") {
        let tm = crate::theme::ThemeMode::from_id_str(&theme_id);
        palette = tm.palette();
    }
    if let Ok(env_acc) = std::env::var("SERVER_LAUNCHER_ADB_ACCENT") {
        if let Some(c) = crate::theme::parse_hex_color(&env_acc) {
            palette.apply_accent(c);
        }
    }
    if let Ok(env_bg) = std::env::var("SERVER_LAUNCHER_ADB_BG") {
        if let Some(c) = crate::theme::parse_hex_color(&env_bg) {
            palette.bg_app = c;
            palette.bg_main = c;
        }
    }
    if let Ok(env_sb) = std::env::var("SERVER_LAUNCHER_ADB_SIDEBAR") {
        if let Some(c) = crate::theme::parse_hex_color(&env_sb) {
            palette.bg_sidebar = c;
        }
    }
    if let Ok(env_card) = std::env::var("SERVER_LAUNCHER_ADB_CARD") {
        if let Some(c) = crate::theme::parse_hex_color(&env_card) {
            palette.bg_card = c;
        }
    }
    if let Ok(env_btn) = std::env::var("SERVER_LAUNCHER_ADB_BUTTON") {
        if let Some(c) = crate::theme::parse_hex_color(&env_btn) {
            palette.bg_button = c;
        }
    }
    if let Ok(env_well) = std::env::var("SERVER_LAUNCHER_ADB_WELL") {
        if let Some(c) = crate::theme::parse_hex_color(&env_well) {
