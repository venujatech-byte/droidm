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
            palette.bg_subtle = c;
        }
    }
    if let Ok(env_at) = std::env::var("SERVER_LAUNCHER_ADB_ACCENT_TEXT") {
        if let Some(c) = crate::theme::parse_hex_color(&env_at) {
            palette.accent_text = c;
        }
    }

    let hex = |c: egui::Color32| format!("#{:02x}{:02x}{:02x}", c.r(), c.g(), c.b());
    let rgba = |c: egui::Color32, a: f32| format!("rgba({}, {}, {}, {:.2})", c.r(), c.g(), c.b(), a);

    AdbThemeInfo {
        theme: theme_mode.id_str().to_string(),
        is_dark: palette.is_dark,
        bg: hex(palette.bg_app),
        side: hex(palette.bg_sidebar),
        surface: hex(palette.bg_card),
        surface2: hex(palette.bg_button),
        well: hex(palette.bg_subtle),
        line: "transparent".into(),
        text: hex(palette.text_primary),
        muted: hex(palette.text_secondary),
        dim: hex(palette.text_muted),
        accent: hex(palette.accent),
        accent_strong: hex(palette.accent_hover),
        accent_soft: rgba(palette.accent, 0.16),
        accent_text: hex(palette.accent_text),
    }
}

#[tauri::command]
fn adb_accent_color() -> Option<String> {
    std::env::var("SERVER_LAUNCHER_ADB_ACCENT").ok()
}

#[tauri::command]
async fn adb_telemetry(serial: String) -> Result<crate::adb::AdbDeviceTelemetry, String> {
    on_worker(move || Ok(crate::adb::query_telemetry(&serial))).await
}

#[tauri::command]
async fn adb_data(serial: String, section: String, path: Option<String>) -> Result<Value, String> {
    on_worker(move || {
        let serial = serial.as_str();
        let data = match section.as_str() {
            "messages" => json!(crate::adb::get_sms_messages(Some(serial)).into_iter().map(|m| json!({
                "id":m.id,"address":m.address,"contact":m.contact_name,"text":m.text,"time":m.time_str,"outgoing":m.is_outgoing
            })).collect::<Vec<_>>()),
            "calls" => json!(crate::adb::get_call_logs(Some(serial)).into_iter().map(|c| json!({
                "id":c.id,"number":c.number,"name":c.name,"kind":c.call_type.label(),"time":c.time_str,"duration":c.duration_str
            })).collect::<Vec<_>>()),
            "contacts" => json!(crate::adb::get_contacts(Some(serial))?.into_iter().map(|c| json!({
                "id":c.id,"name":c.name,"number":c.number
            })).collect::<Vec<_>>()),
            "photos" => json!(crate::adb::list_photos(Some(serial)).into_iter().map(|p| json!({
                "name":p.name,"path":p.path,"size":p.size_str,"date":p.date_str
            })).collect::<Vec<_>>()),
            "notifications" => json!(crate::adb::get_notifications(Some(serial)).into_iter().map(|n| json!({
                "id":n.id,"package":n.package,"app":n.app_name,"title":n.title,"text":n.text,"time":n.time_str
            })).collect::<Vec<_>>()),
            "apps" => json!(crate::adb::list_packages(serial, true).into_iter().map(|p| json!({"name":p.name,"system":p.is_system})).collect::<Vec<_>>()),
            "files" => {
                let path = path.unwrap_or_else(|| "/sdcard".to_string());
                json!(crate::adb::list_directory(serial, &path)?.into_iter().map(|f| json!({
                    "name":f.name,"directory":f.is_dir,"bytes":f.size_bytes,"permissions":f.permissions,"modified":f.modified
                })).collect::<Vec<_>>())
            }
            "endpoints" => json!(crate::adb::discover_device_endpoints(serial).into_iter().map(|e| json!({
                "interface":e.interface,"ip":e.ip,"wifi":e.is_wifi,"label":e.label
            })).collect::<Vec<_>>()),
            "sensors" => json!(crate::adb::query_device_sensors(serial)?),
            "sensor_inventory" => json!(crate::adb::query_device_sensor_inventory(serial)?),
            "sensor_readings" => json!(crate::adb::query_device_sensor_readings(serial)?),
            _ => return Err("Unsupported ADB data section".to_string()),
        };
        Ok(data)
    }).await
}

#[tauri::command]
async fn adb_storage_volumes(serial: String) -> Result<Value, String> {
    on_worker(move || Ok(json!(crate::adb::list_storage_volumes(&serial).into_iter().map(|(name, path, total_kb, free_kb)| json!({
        "name": name, "path": path, "total_kb": total_kb, "free_kb": free_kb
    })).collect::<Vec<_>>()))).await
}

#[tauri::command]
async fn adb_screenshot(serial: String) -> Result<String, String> {
    on_worker(move || {
        use base64::Engine;
        let png = crate::adb::capture_screen_raw(&serial)?;
        Ok(format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png)
        ))
    })
    .await
}

#[tauri::command]
async fn adb_photo_preview(serial: String, path: String) -> Result<String, String> {
    on_worker(move || {
        use base64::Engine;
        let bytes = crate::adb::read_remote_file(&serial, &path)?;
        let mime = match std::path::Path::new(&path)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str()
        {
            "png" => "image/png",
            "webp" => "image/webp",
            "gif" => "image/gif",
            _ => "image/jpeg",
        };
        Ok(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        ))
    })
    .await
}

#[tauri::command]
async fn adb_photos_page(serial: String, cursor: Option<String>) -> Result<Value, String> {
    on_worker(move || {
        let (items, next_cursor) = crate::adb::list_photos_page(Some(&serial), cursor.as_deref(), 10);
        Ok(json!({
            "items": items.into_iter().map(|photo| json!({
                "name": photo.name, "path": photo.path, "size": photo.size_str, "date": photo.date_str
            })).collect::<Vec<_>>(),
            "next_cursor": next_cursor
        }))
    }).await
}

#[tauri::command]
async fn adb_photos_count(serial: String) -> Result<usize, String> {
    on_worker(move || Ok(crate::adb::count_photos(Some(&serial)))).await
}

#[tauri::command]
async fn adb_photo_thumbnail(serial: String, path: String) -> Result<String, String> {
    on_worker(move || {
        use base64::Engine;
        let bytes = crate::adb::read_remote_file(&serial, &path)?;
        let image = image::load_from_memory(&bytes).map_err(|error| format!("Could not decode photo: {error}"))?;
        let thumbnail = image.thumbnail(480, 360);
        let mut encoded = std::io::Cursor::new(Vec::new());
        thumbnail.write_to(&mut encoded, image::ImageFormat::Jpeg)
            .map_err(|error| format!("Could not create photo thumbnail: {error}"))?;
        Ok(format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(encoded.into_inner())))
    }).await
}

#[tauri::command]
async fn adb_action(
    serial: String,
    action: String,
    value: Option<String>,
    extra: Option<String>,
) -> Result<String, String> {
    on_worker(move || {
        let value = value.unwrap_or_default();
        let extra = extra.unwrap_or_default();
        match action.as_str() {
            "key_back" => crate::adb::send_keyevent(&serial, 4).map(|_| "Back sent".into()),
            "key_home" => crate::adb::send_keyevent(&serial, 3).map(|_| "Home sent".into()),
            "key_recents" => crate::adb::send_keyevent(&serial, 187).map(|_| "Recents sent".into()),
            "key_power" => crate::adb::send_keyevent(&serial, 26).map(|_| "Power sent".into()),
            "key_volume_up" => crate::adb::volume_up(Some(&serial)),
            "key_volume_down" => crate::adb::volume_down(Some(&serial)),
            "reboot" => crate::adb::reboot_device(&serial, &value),
            "shell" => crate::adb::adb_cmd(Some(&serial), &["shell", &value]),
            "external_adb_shell" => crate::adb::launch_external_adb_terminal(&serial).map(|_| "External ADB shell opened".into()),
            "send_text" => crate::adb::send_text(&serial, &value).map(|_| "Text sent".into()),
            "call" => crate::adb::start_phone_call(Some(&serial), &value),
            "answer_call" => crate::adb::send_keyevent(&serial, 79).map(|_| "Answer command sent. Android handles it only when a call is ringing.".into()),
            "hangup" => crate::adb::end_phone_call(Some(&serial)),
            "send_sms" => crate::adb::send_sms(Some(&serial), &value, &extra),
            "clipboard_get" => crate::adb::get_clipboard(&serial),
            "clipboard_set" => {
                crate::adb::set_clipboard(&serial, &value).map(|_| "Clipboard sent".into())
            }
            "launch_app" => crate::adb::launch_app(&serial, &value).map(|_| "App launched".into()),
            "stop_app" => crate::adb::force_stop_app(&serial, &value).map(|_| "App stopped".into()),
            "kill_process" => {
                let pid = value.parse::<u32>().map_err(|_| "Invalid process ID".to_string())?;
                crate::adb::adb_cmd(Some(&serial), &["shell", "kill", "-9", &pid.to_string()]).map(|_| "Process terminated".into())
            }
