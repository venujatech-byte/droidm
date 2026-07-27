//! ADB (Android Debug Bridge) Management Suite & Device Controller.
//!
//! Provides comprehensive enterprise controls for Android devices:
//! - Device discovery (USB & Wireless TCP/IP)
//! - Real-time device telemetry & hardware status
//! - Screen mirroring integration (scrcpy) with fine-tuned video parameters
//! - Bidirectional clipboard sharing & live text injection
//! - Interactive shell terminal access with logcat & system presets
//! - Remote storage explorer, file transfer (push/pull), and APK package installer
//! - Firmware & Recovery toolkits (OTA sideload, fastboot flashing, reboot targets, bugreports)
//! - Hardware input simulation (power, volume, navigation, screenshot capture)

use std::collections::HashMap;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

#[derive(Debug, Clone, PartialEq, Eq, Default, serde::Serialize)]
pub struct AdbDeviceInfo {
    pub serial: String,
    pub state: String, // "device", "offline", "unauthorized", "recovery", "bootloader"
    pub model: String,
    pub product: String,
    pub device: String,
    pub transport_id: String,
}

#[derive(Debug, Clone, PartialEq, Default, serde::Serialize)]
pub struct AdbDeviceTelemetry {
    pub model: String,
    pub manufacturer: String,
    pub brand: String,
    pub android_version: String,
    pub api_level: u32,
    pub security_patch: String,
    pub build_id: String,
    pub battery_pct: Option<f32>,
    pub battery_status: Option<String>,
    pub battery_temp_c: Option<f32>,
    pub cpu_abi: String,
    pub screen_res: String,
    pub screen_dpi: String,
    pub selinux: String,
    pub is_rooted: bool,
    pub storage_internal_free_gb: Option<f32>,
    pub storage_internal_total_gb: Option<f32>,
    pub storage_sdcard_free_gb: Option<f32>,
    pub storage_sdcard_total_gb: Option<f32>,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbSensorProcess {
    pub pid: u32,
    pub uid: Option<u32>,
    pub name: String,
    pub cpu_pct: Option<f32>,
    pub memory: String,
    pub memory_kb: Option<u64>,
    pub disk_rate_bps: Option<f64>,
    pub network_bytes: Option<u64>,
    pub gpu_memory_bytes: Option<u64>,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbCpuCounters {
    pub name: String,
    pub total: u64,
    pub idle: u64,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbDiskCounters {
    pub name: String,
    pub read_sectors: u64,
    pub written_sectors: u64,
}

/// One row of `dumpsys batterystats` power attribution. `mah` is charge drained
/// since the last full charge, which is the unit the platform reports in.
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbPowerAttribution {
    pub label: String,
    pub mah: f32,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbNetworkInterface {
    pub name: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbSimSlot {
    pub slot: usize,
    pub operator: String,
    pub state: String,
    pub network_type: String,
    pub numeric: String,
    pub country: String,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbTemperatureSensor {
    pub name: String,
    pub temp_c: f32,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbSensorReading {
    pub name: String,
    pub values: Vec<f64>,
    pub time: String,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct AdbDeviceSensors {
    pub cpu_model: String,
    pub cpu_cores: usize,
    pub cpu_usage_pct: Option<f32>,
    pub cpu_counters: Vec<AdbCpuCounters>,
    pub cpu_frequencies_mhz: Vec<u64>,
    pub top_processes: Vec<AdbSensorProcess>,
    pub mem_total_kb: Option<u64>,
    pub mem_available_kb: Option<u64>,
    pub mem_free_kb: Option<u64>,
    pub mem_buffers_kb: Option<u64>,
    pub mem_cached_kb: Option<u64>,
    pub mem_dirty_kb: Option<u64>,
    pub swap_total_kb: Option<u64>,
    pub swap_free_kb: Option<u64>,
    pub storage_internal_total_kb: Option<u64>,
    pub storage_internal_free_kb: Option<u64>,
    pub storage_shared_total_kb: Option<u64>,
    pub storage_shared_free_kb: Option<u64>,
    pub disk_counters: Vec<AdbDiskCounters>,
    pub gpu_renderer: String,
    pub gpu_platform: String,
    pub battery_voltage_mv: Option<u64>,
    pub battery_health: String,
    pub battery_plugged: String,
    pub battery_pct: Option<f32>,
    pub battery_status: String,
    pub battery_temp_c: Option<f32>,
    pub battery_current_ua: Option<i64>,
    pub battery_charge_counter_uah: Option<u64>,
    pub battery_charge_full_uah: Option<u64>,
    pub battery_charge_full_design_uah: Option<u64>,
    pub battery_cycle_count: Option<u64>,
    pub battery_technology: Option<String>,
    pub cpu_governor: Option<String>,
    pub cpu_available_governors: Vec<String>,
    /// Platform power attribution; empty when batterystats has no history yet.
    pub power_attribution: Vec<AdbPowerAttribution>,
    /// Seconds covered by the batterystats window, used to turn mAh into watts.
    pub power_attribution_secs: Option<f64>,
    pub wifi_enabled: Option<bool>,
    pub bluetooth_enabled: Option<bool>,
    pub bluetooth_name: Option<String>,
    pub bluetooth_address: Option<String>,
    pub bluetooth_state: Option<String>,
    pub bluetooth_scan_mode: Option<String>,
    pub bluetooth_connection_state: Option<String>,
    pub bluetooth_class: Option<String>,
    pub bluetooth_uptime: Option<String>,
    pub bluetooth_max_audio_devices: Option<u32>,
    pub bluetooth_a2dp_offload: Option<bool>,
    pub bluetooth_active_device: Option<String>,
    pub bluetooth_profiles: Vec<String>,
    pub bluetooth_bonded_devices: Vec<String>,
    pub network_interfaces: Vec<AdbNetworkInterface>,
    pub temperatures: Vec<AdbTemperatureSensor>,
    pub sensor_names: Vec<String>,
    pub uptime_secs: Option<u64>,
    pub socket_total: usize,
    pub socket_tcp: usize,
    pub socket_udp: usize,
    pub cellular_operator: String,
    pub sim_operator: String,
    pub sim_state: String,
    pub sim_slots: Vec<AdbSimSlot>,
    pub cellular_network_type: String,
    pub cellular_numeric: String,
    pub cellular_country: String,
    pub baseband_version: String,
    pub ril_impl: String,
    pub mobile_data_enabled: Option<bool>,
    pub data_roaming_enabled: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbFileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub permissions: String,
    pub modified: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbPackageInfo {
    pub name: String,
    pub is_system: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbNotification {
    pub id: String,
    pub package: String,
    pub app_name: String,
    pub title: String,
    pub text: String,
    pub subtext: String,
    pub time_str: String,
    pub key: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdbCallType {
    Incoming,
    Outgoing,
    Missed,
}

impl AdbCallType {
    pub fn label(&self) -> &'static str {
        match self {
            AdbCallType::Incoming => "Incoming",
            AdbCallType::Outgoing => "Outgoing",
            AdbCallType::Missed => "Missed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbCallLogEntry {
    pub id: String,
    pub number: String,
    pub name: String,
    pub call_type: AdbCallType,
    pub time_str: String,
    pub duration_str: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbSmsMessage {
    pub id: String,
    pub address: String,
    pub contact_name: String,
    pub text: String,
    pub time_str: String,
    pub is_outgoing: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbPhotoItem {
    pub name: String,
    pub path: String,
    pub size_str: String,
    pub date_str: String,
}

/// Executes an adb command with optional device serial target.
pub fn adb_cmd(serial: Option<&str>, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("adb");
    if let Some(s) = serial {
        if !s.is_empty() {
            cmd.arg("-s").arg(s);
        }
    }
    cmd.args(args);
    cmd.stdin(Stdio::null());

    match cmd.output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout.trim().to_string())
            } else {
                let err = if !stderr.trim().is_empty() {
                    stderr.trim().to_string()
                } else if !stdout.trim().is_empty() {
                    stdout.trim().to_string()
                } else {
                    format!("Command exited with code {}", out.status.code().unwrap_or(-1))
                };
                Err(err)
            }
        }
        Err(e) => Err(format!("Failed to execute adb: {}", e)),
    }
}

fn parse_android_df_line(line: &str) -> Option<(String, u64, u64)> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 6 { return None; }
    Some((
        fields.last()?.to_string(),
        fields.get(1)?.parse().ok()?,
        fields.get(3)?.parse().ok()?,
    ))
}

fn parse_sim_slots(operator: &str, state: &str, network_type: &str, numeric: &str, country: &str) -> Vec<AdbSimSlot> {
    let values = [operator, state, network_type, numeric, country].map(|value| {
        value.split(',').map(str::trim).map(str::to_string).collect::<Vec<_>>()
    });
    let count = if values.iter().any(|items| items.iter().any(|item| !item.is_empty())) {
        values.iter().map(Vec::len).max().unwrap_or(0).min(2)
    } else { 0 };
    (0..count).map(|index| AdbSimSlot {
        slot: index + 1,
        operator: values[0].get(index).cloned().unwrap_or_default(),
        state: values[1].get(index).cloned().unwrap_or_default(),
        network_type: values[2].get(index).cloned().unwrap_or_default(),
        numeric: values[3].get(index).cloned().unwrap_or_default(),
        country: values[4].get(index).cloned().unwrap_or_default(),
    }).collect()
}

/// Parses output from `adb devices -l` and returns all attached devices.
pub fn list_devices() -> Vec<AdbDeviceInfo> {
    let mut devices = Vec::new();
    let output = match adb_cmd(None, &["devices", "-l"]) {
        Ok(s) => s,
        Err(_) => return devices,
    };

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("List of devices") || line.starts_with("* daemon") {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        let serial = parts[0].to_string();
        let state = parts[1].to_string();

        let mut product = String::new();
        let mut model = String::new();
        let mut device = String::new();
        let mut transport_id = String::new();

        for p in &parts[2..] {
            if let Some(val) = p.strip_prefix("product:") {
                product = val.to_string();
            } else if let Some(val) = p.strip_prefix("model:") {
                model = val.replace('_', " ");
            } else if let Some(val) = p.strip_prefix("device:") {
                device = val.to_string();
            } else if let Some(val) = p.strip_prefix("transport_id:") {
                transport_id = val.to_string();
            }
        }

        if model.is_empty() {
            model = if serial.contains(':') {
                format!("Wireless Device ({})", serial)
            } else {
                format!("USB Device ({})", serial)
            };
        }

        devices.push(AdbDeviceInfo {
            serial,
            state,
            model,
            product,
            device,
            transport_id,
        });
    }

    devices
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdbNetworkEndpoint {
    pub interface: String,
    pub ip: String,
    pub is_wifi: bool,
    pub label: String,
}

/// Discovers valid, routable network endpoints on an Android device (filtering dummy interfaces like ds-br, p2p, dummy).
pub fn discover_device_endpoints(serial: &str) -> Vec<AdbNetworkEndpoint> {
    let mut endpoints = Vec::new();
    let out = match adb_cmd(Some(serial), &["shell", "ip -f inet addr"]) {
        Ok(s) => s,
        Err(_) => return endpoints,
    };

    let mut current_iface = String::new();
    for line in out.lines() {
        let trimmed = line.trim();
        if !line.starts_with(' ') && !line.starts_with('\t') && line.contains(':') {
            if let Some(iface) = line.split(':').nth(1) {
                current_iface = iface.trim().to_string();
            }
        } else if trimmed.starts_with("inet ") {
            if let Some(cidr) = trimmed.split_whitespace().nth(1) {
                let ip = cidr.split('/').next().unwrap_or("").to_string();
                if ip.is_empty() || ip == "127.0.0.1" {
                    continue;
                }
                let iface_lower = current_iface.to_lowercase();
                if iface_lower.starts_with("dummy")
                    || iface_lower.starts_with("ds-br")
                    || iface_lower.starts_with("p2p")
                    || iface_lower.starts_with("lo")
                {
                    continue;
                }

                let is_wifi = iface_lower.starts_with("wlan") || iface_lower.starts_with("wifi");
                let label = if is_wifi {
                    format!("Wi-Fi ({})", current_iface)
                } else if iface_lower.starts_with("eth") {
                    format!("Ethernet ({})", current_iface)
                } else {
                    current_iface.clone()
                };

                if !endpoints.iter().any(|e: &AdbNetworkEndpoint| e.ip == ip) {
                    endpoints.push(AdbNetworkEndpoint {
                        interface: current_iface.clone(),
                        ip,
                        is_wifi,
                        label,
                    });
                }
            }
        }
    }

    endpoints.sort_by(|a, b| b.is_wifi.cmp(&a.is_wifi));
    endpoints
}

/// Connects to a wireless ADB target (IP:Port) with robust output verification.
pub fn connect_wireless(target: &str) -> Result<String, String> {
    let target = target.trim();
    let formatted = if !target.contains(':') {
        format!("{}:5555", target)
    } else {
        target.to_string()
    };
    match adb_cmd(None, &["connect", &formatted]) {
        Ok(out) => {
            let lower = out.to_lowercase();
            if lower.contains("failed")
                || lower.contains("cannot connect")
                || lower.contains("unable to connect")
                || lower.contains("connection refused")
            {
                Err(out)
            } else {
                Ok(out)
            }
        }
        Err(e) => Err(e),
    }
}

/// Disconnects a wireless ADB target (IP:Port).
pub fn disconnect_wireless(target: &str) -> Result<String, String> {
    adb_cmd(None, &["disconnect", target])
}

/// Restarts ADB daemon on target device listening on specified TCP port (typically 5555).
pub fn enable_tcpip(serial: &str, port: u16) -> Result<String, String> {
    let port_str = port.to_string();
    adb_cmd(Some(serial), &["tcpip", &port_str])
}

/// Reverts target device from TCP/IP mode back to USB debugging mode.
pub fn reset_to_usb(serial: &str) -> Result<String, String> {
    adb_cmd(Some(serial), &["usb"])
}

/// Pairs with an Android 11+ wireless debugging target using pairing code.
pub fn pair_wireless(target: &str, pairing_code: &str) -> Result<String, String> {
    adb_cmd(None, &["pair", target, pairing_code])
}

/// Queries comprehensive telemetry from an online Android device.
pub fn query_telemetry(serial: &str) -> AdbDeviceTelemetry {
    let mut telem = AdbDeviceTelemetry::default();

    // 1. Query Android build properties via getprop
    if let Ok(props_raw) = adb_cmd(Some(serial), &["shell", "getprop"]) {
        for line in props_raw.lines() {
            if let Some((k, v)) = parse_getprop_line(line) {
                match k {
                    "ro.product.model" => telem.model = v.to_string(),
                    "ro.product.manufacturer" => telem.manufacturer = v.to_string(),
                    "ro.product.brand" => telem.brand = v.to_string(),
                    "ro.build.version.release" => telem.android_version = v.to_string(),
                    "ro.build.version.sdk" => telem.api_level = v.parse::<u32>().unwrap_or(0),
                    "ro.build.version.security_patch" => telem.security_patch = v.to_string(),
                    "ro.build.display.id" => telem.build_id = v.to_string(),
                    "ro.product.cpu.abi" => telem.cpu_abi = v.to_string(),
                    _ => {}
                }
            }
        }
    }

    // 2. Query Battery telemetry via dumpsys battery
    if let Ok(bat_raw) = adb_cmd(Some(serial), &["shell", "dumpsys", "battery"]) {
        for line in bat_raw.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("level:") {
                telem.battery_pct = val.trim().parse::<f32>().ok();
            } else if let Some(val) = line.strip_prefix("temperature:") {
                if let Ok(t) = val.trim().parse::<f32>() {
                    let temp = if t.abs() > 150.0 { t / 10.0 } else { t };
                    telem.battery_temp_c = Some((temp * 10.0).round() / 10.0);
                }
            } else if let Some(val) = line.strip_prefix("status:") {
                telem.battery_status = match val.trim() {
                    "2" => Some("Charging (AC/USB)".to_string()),
                    "3" => Some("Discharging".to_string()),
                    "4" => Some("Not Charging".to_string()),
                    "5" => Some("Full (100%)".to_string()),
                    _ => Some("Unknown".to_string()),
                };
            }
        }
    }

    // 3. Screen display resolution & density
    if let Ok(wm_size) = adb_cmd(Some(serial), &["shell", "wm", "size"]) {
        if let Some(res) = wm_size.split(':').nth(1) {
            telem.screen_res = res.trim().to_string();
        }
    }
    if let Ok(wm_density) = adb_cmd(Some(serial), &["shell", "wm", "density"]) {
        if let Some(dpi) = wm_density.split(':').nth(1) {
            telem.screen_dpi = format!("{} DPI", dpi.trim());
        }
    }

    // 4. SELinux & Root status
    if let Ok(selinux) = adb_cmd(Some(serial), &["shell", "getenforce"]) {
        telem.selinux = selinux.trim().to_string();
    }
    telem.is_rooted = adb_cmd(Some(serial), &["shell", "su", "-c", "id"]).map(|s| s.contains("uid=0")).unwrap_or(false);

    // Query each mount independently; Samsung df may fail the whole multi-path request.
    for path in ["/data", "/storage/emulated/0", "/sdcard"] {
        if let Ok(df_raw) = adb_cmd(Some(serial), &["shell", "df", "-k", path]) {
            for line in df_raw.lines() {
                let Some((mount, total_kb, free_kb)) = parse_android_df_line(line) else { continue; };
                if mount.starts_with("/data") && telem.storage_internal_total_gb.is_none() {
                    telem.storage_internal_total_gb = Some((total_kb as f32 / (1024.0 * 1024.0) * 10.0).round() / 10.0);
                    telem.storage_internal_free_gb = Some((free_kb as f32 / (1024.0 * 1024.0) * 10.0).round() / 10.0);
                } else if mount.starts_with("/storage/emulated") && telem.storage_sdcard_total_gb.is_none() {
                    telem.storage_sdcard_total_gb = Some((total_kb as f32 / (1024.0 * 1024.0) * 10.0).round() / 10.0);
                    telem.storage_sdcard_free_gb = Some((free_kb as f32 / (1024.0 * 1024.0) * 10.0).round() / 10.0);
                }
            }
        }
    }
    if telem.storage_sdcard_total_gb.is_none() && telem.storage_internal_total_gb.is_some() {
        telem.storage_sdcard_total_gb = telem.storage_internal_total_gb;
        telem.storage_sdcard_free_gb = telem.storage_internal_free_gb;
    }

    // 6. System Uptime
    if let Ok(up_raw) = adb_cmd(Some(serial), &["shell", "cat", "/proc/uptime"]) {
        if let Some(first) = up_raw.split_whitespace().next() {
            if let Ok(secs) = first.parse::<f64>() {
                telem.uptime_secs = secs as u64;
            }
        }
    }

    telem
}

// Prefer global component totals; older Android versions report CPU/GPS only inside UID rows.
fn parse_power_attribution(text: &str) -> Vec<AdbPowerAttribution> {
    fn label(name: &str) -> &str {
        match name {
            "cpu" | "Cpu" => "CPU",
            "wifi" | "Wifi" => "Wi-Fi",
            "radio" | "mobile_radio" => "Cell standby",
            "gps" | "gnss" | "Gps" => "GPS",
            "sensor" | "sensors" => "Sensors",
            "bluetooth" => "Bluetooth",
            "camera" => "Camera",
            "flashlight" => "Flashlight",
            "audio" => "Audio",
            "video" => "Video",
            "screen" => "Screen",
            "wakelock" => "Wake locks",
            "phone" => "Phone",
            other => other,
        }
    }
    let mut totals = std::collections::BTreeMap::<String, f32>::new();
    let mut uid_totals = std::collections::BTreeMap::<String, f32>::new();
    let modern = text.lines().any(|line| line.trim() == "Global");
    let has_battery_states = text.contains("(on battery,");
    let mut on_battery = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if modern {
            if trimmed.starts_with("UID ") { break; }
            if trimmed.starts_with('(') {
                on_battery = trimmed.starts_with("(on battery,");
                continue;
            }
            // State subtotals partition the global total; never add both or include charger use.
            if has_battery_states && !on_battery { continue; }
            if !has_battery_states && line.len() - line.trim_start().len() > 4 { continue; }
        }
        let Some((name, rest)) = line.trim().split_once(':') else { continue };
        if name == "Capacity" { continue; }
        let Some(mah) = rest.split_whitespace().next().and_then(|v| v.parse::<f32>().ok())
            .filter(|v| v.is_finite() && *v >= 0.0) else { continue };
        if name.starts_with("Uid ") {
            let mut accounted = 0.0;
            // Ignore the later "Including smearing" block: it redistributes existing power.
            if let Some((_, components)) = rest.split_once('(') {
                for component in components.split(')').next().unwrap_or("").split_whitespace() {
                    let Some((key, value)) = component.split_once('=') else { continue };
                    let Some(value) = value.parse::<f32>().ok().filter(|v| v.is_finite() && *v >= 0.0) else { continue };
                    if key == "proportional" { continue; }
                    *uid_totals.entry(label(key).to_string()).or_default() += value;
                    accounted += value;
                }
            }
            if mah - accounted > 0.00001 {
                *uid_totals.entry("Other apps / services".to_string()).or_default() += mah - accounted;
            }
        } else {
            *totals.entry(label(name).to_string()).or_default() += mah;
        }
    }
    for (name, mah) in uid_totals {
        totals.entry(name).or_insert(mah);
    }
    totals.into_iter().map(|(label, mah)| AdbPowerAttribution { label, mah }).collect()
}

// Android durations may contain days and milliseconds, with or without spaces.
fn parse_battery_time(line: &str) -> Option<f64> {
    let (_, rest) = line.split_once("Time on battery:")?;
    let (duration, _) = rest.split_once('(')?;
    let mut rest = duration.trim();
    let mut seconds = 0.0;
    while !rest.is_empty() {
        let end = rest.find(|c: char| !c.is_ascii_digit())?;
        let value = rest[..end].parse::<u64>().ok()? as f64;
        rest = &rest[end..];
        let (unit, scale) = [("ms", 0.001), ("d", 86400.0), ("h", 3600.0), ("m", 60.0), ("s", 1.0)]
            .into_iter()
            .find(|(unit, _)| rest.starts_with(unit))?;
        seconds += value * scale;
        rest = rest[unit.len()..].trim_start();
    }
    (seconds.is_finite() && seconds > 0.0).then_some(seconds)
}

#[cfg(test)]
mod power_time_tests {
    use super::{parse_android_df_line, parse_battery_time, parse_power_attribution, parse_sensor_inventory, parse_sensor_readings, parse_sim_slots, process_disk_rates};

    #[test]
    fn parses_sim_slots_from_android_property_lists() {
        let sims = parse_sim_slots("Hutch,Dialog", "READY,ABSENT", "LTE,Unknown", "41308,41302", "lk,lk");
        assert_eq!(sims.len(), 2);
        assert_eq!(sims[0].operator, "Hutch");
        assert_eq!(sims[1].state, "ABSENT");
        assert_eq!(sims[1].numeric, "41302");
    }

    #[test]
    fn reads_sensor_names_and_fingerprint_feature() {
        let sensors = parse_sensor_inventory("0x0001 (handle=1) BMI270 Accelerometer | vendor\nfeature:android.hardware.fingerprint\n__FEATURES__");
        assert_eq!(sensors, ["BMI270 Accelerometer", "Fingerprint authentication"]);
    }

    #[test]
    fn parses_latest_sensor_event_values() {
        let dump = "Recent Sensor events:\nAmbient Light: last 50 events\n 1 (ts=1.2, wall=10-20 19:26:33.676) 5.23, 0.00, 0.00,\n 2 (ts=2.2, wall=10-20 19:26:34.431) 5.88, 0.00, 0.00,\nAccelerometer: last 50 events\n 1 (ts=3.0, wall=10-20 19:26:35.000) -0.18, -0.16, 10.17,\nActive sensors:\n";
        let readings = parse_sensor_readings(dump);
        assert_eq!(readings.len(), 2);
        assert_eq!(readings[0].values, [5.88, 0.0, 0.0]);
        assert_eq!(readings[0].time, "10-20 19:26:34.431");
        assert_eq!(readings[1].values, [-0.18, -0.16, 10.17]);
    }

    #[test]
    fn parses_android_df_rows_with_emulated_mount_aliases() {
        assert_eq!(
            parse_android_df_line("/dev/block/dm-61 237828076 201474160 36222844 85% /data/user/0"),
            Some(("/data/user/0".into(), 237828076, 36222844))
        );
        assert_eq!(
            parse_android_df_line("/dev/fuse 234000000 190000000 44000000 82% /storage/emulated"),
            Some(("/storage/emulated".into(), 234000000, 44000000))
        );
        assert_eq!(parse_android_df_line("Filesystem 1K-blocks Used Available Use% Mounted on"), None);
    }

    #[test]
    fn includes_uid_components_without_smearing_or_double_counting() {
        let rows = parse_power_attribution("Capacity: 5000\nUid 1000: 3 ( cpu=2 gps=1 ) Including smearing: 8 ( proportional=5 )\nCPU: 4\nWi-Fi: 0.2\nScreen: 1\nUid 1001: 0.5\nGPU: NaN");
        let values: std::collections::BTreeMap<_, _> = rows.into_iter().map(|r| (r.label, r.mah)).collect();
        assert_eq!(values["CPU"], 4.0);
        assert_eq!(values["GPS"], 1.0);
        assert_eq!(values["Wi-Fi"], 0.2);
        assert_eq!(values["Other apps / services"], 0.5);
        assert!(!values.contains_key("GPU"));
        assert!(!values.contains_key("Capacity"));
        let cpu = parse_power_attribution("Uid 0: 1 ( cpu=1 )\nUid u0a10: 2 ( cpu=2 )");
        assert_eq!(cpu[0].label, "CPU");
        assert_eq!(cpu[0].mah, 3.0);
    }

    #[test]
    fn parses_modern_on_battery_states_without_global_or_uid_duplicates() {
        let rows = parse_power_attribution("    Global\n    cpu: 100 apps: 90\n      (on battery, screen on)\n      cpu: 30 apps: 25\n      (on battery, screen off/doze)\n      cpu: 20 apps: 20\n      (not on battery, screen on)\n      cpu: 50 apps: 45\n  UID 1000: 90\n      cpu=90");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].label, "CPU");
        assert_eq!(rows[0].mah, 50.0);
    }

    #[test]
    fn parses_battery_realtime_only() {
        assert_eq!(parse_battery_time("Time on battery: 3s 872ms (0.1%) realtime, 1s (100%) uptime"), Some(3.872));
        assert_eq!(parse_battery_time("Time on battery: 1d2h3m4s5ms (10%) realtime"), Some(93784.005));
        for value in ["", "Time on battery: 0ms (0%) realtime", "Time on battery: unknown (0%)", "Time on battery: 1x (0%)"] {
            assert_eq!(parse_battery_time(value), None);
        }
    }

    #[test]
    fn computes_process_disk_rate_from_counter_deltas() {
        let mut counters = std::collections::HashMap::from([(42, (100, 200))]);
        assert!(process_disk_rates("test-device", &counters).is_empty());
        counters.insert(42, (1100, 1200));
        assert!(process_disk_rates("test-device", &counters).get(&42).is_some_and(|rate| *rate > 0.0));
    }
}

/// Reads Android hardware and resource sensor data in one device shell session.
pub fn query_device_sensors(serial: &str) -> Result<AdbDeviceSensors, String> {
    let script = r#"
echo __CPUINFO__; cat /proc/cpuinfo
echo __CPU_STAT__; cat /proc/stat
echo __CPU_FREQ__; for freq in /sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_cur_freq; do [ -r "$freq" ] && cat "$freq"; done
echo __MEMINFO__; cat /proc/meminfo
echo __TOP__; top -b -n 1 -m 120
echo __PROCESS_UID__; ps -A -o UID,PID
echo __PROC_IO__; su -c 'top -b -n 1 -m 120 | while read -r pid rest; do case "$pid" in ""|*[!0-9]*) continue;; esac; r=0; w=0; while read -r key value; do case "$key" in read_bytes:) r=$value;; write_bytes:) w=$value;; esac; done 2>/dev/null < "/proc/$pid/io"; echo "$pid $r $w"; done' 2>/dev/null
echo __GPU_MEM__; su -c 'gpu_proc=/sys/kernel/debug/kgsl/proc; [ -d "$gpu_proc" ] || gpu_proc=/d/kgsl/proc; [ -d "$gpu_proc" ] || exit 0; echo AVAILABLE; for d in "$gpu_proc"/*; do [ -r "$d/mem" ] || continue; echo "GPU_PID ${d##*/}"; cat "$d/mem"; done' 2>/dev/null
echo __NET_UID__; dumpsys netstats detail 2>/dev/null | awk '/ident=.*uid=/ {uid=""; for(i=1;i<=NF;i++) if($i ~ /^uid=/) {split($i,a,"="); uid=a[2]}} /st=.*rb=.*tb=/ && uid ~ /^[0-9]+$/ {rb=0;tb=0;for(i=1;i<=NF;i++){if($i~/^rb=/){split($i,a,"=");rb=a[2]} if($i~/^tb=/){split($i,a,"=");tb=a[2]}} total[uid]+=rb+tb} END {for(uid in total) print uid,total[uid]}'
echo __BATTERY__; dumpsys battery; cat /sys/class/power_supply/battery/uevent 2>/dev/null; su -c cat /sys/class/power_supply/battery/uevent 2>/dev/null
battery_stats=$(dumpsys batterystats --charged 2>/dev/null)
echo __BATTERYSTATS__; printf '%s\n' "$battery_stats" | sed -n '/Estimated power use/,/^$/p'
echo __BATTERYSTATS_TIME__; printf '%s\n' "$battery_stats" | grep -m1 -E 'Time on battery:'
echo __GOVERNOR__; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null; cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors 2>/dev/null
echo __NETDEV__; cat /proc/net/dev
echo __DISKSTATS__; cat /proc/diskstats
echo __DF__; df -k /data 2>/dev/null; df -k /storage/emulated/0 2>/dev/null; df -k /sdcard 2>/dev/null
echo __THERMAL_ZONES__; for zone in /sys/class/thermal/thermal_zone*; do if [ -r "$zone/temp" ]; then printf '%s ' "$(cat "$zone/type" 2>/dev/null)"; cat "$zone/temp"; fi; done
echo __WIFI__; settings get global wifi_on
echo __BLUETOOTH__; settings get global bluetooth_on; dumpsys bluetooth_manager 2>/dev/null | sed -n '1,/^AdapterState:/p'; dumpsys bluetooth_manager 2>/dev/null | grep -E -m 20 '(Profile: |  mActiveDevice:)'
echo __GPU__; getprop ro.hardware.egl; getprop ro.board.platform
echo __SOCKSTAT__; cat /proc/net/sockstat
echo __UPTIME__; cat /proc/uptime
echo __TELEPHONY__; getprop gsm.operator.alpha; getprop gsm.sim.operator.alpha; getprop gsm.sim.state; getprop gsm.network.type; getprop gsm.operator.numeric; getprop gsm.operator.iso-country; getprop gsm.version.baseband; getprop gsm.version.ril-impl; settings get global mobile_data 2>/dev/null; settings get global data_roaming 2>/dev/null
"#;
    let output = adb_cmd(Some(serial), &["shell", script])?;
    let mut sections = HashMap::new();
    let mut current = "";
    for line in output.lines() {
        if let Some(name) = line.strip_prefix("__").and_then(|line| line.strip_suffix("__")) {
            current = name;
            sections.entry(current).or_insert_with(String::new);
        } else if !current.is_empty() {
            let section: &mut String = sections.get_mut(current).expect("section was inserted");
            section.push_str(line);
            section.push('\n');
        }
    }
    let section = |name: &str| sections.get(name).map(String::as_str).unwrap_or("");

    let mem_value = |name: &str| {
        section("MEMINFO")
            .lines()
            .find_map(|line| line.strip_prefix(&format!("{name}:")))
            .and_then(|value| value.split_whitespace().next())
            .and_then(|value| value.parse::<u64>().ok())
    };
    let cpu_lines: Vec<&str> = section("CPUINFO").lines().collect();
    let cpu_model = ["Hardware", "model name", "Processor"]
        .iter()
        .find_map(|key| {
            cpu_lines.iter().find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.trim().eq_ignore_ascii_case(key).then_some(value.trim())
            })
        })
        .unwrap_or("")
        .to_string();
    let cpu_cores = cpu_lines
        .iter()
        .filter(|line| line.trim_start().starts_with("processor"))
        .count();
    let cpu_counters = section("CPU_STAT")
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let name = fields.next()?;
            if !name.starts_with("cpu") {
                return None;
            }
            let values: Vec<u64> = fields.filter_map(|field| field.parse().ok()).collect();
            let idle = *values.get(3)? + values.get(4).copied().unwrap_or(0);
            Some(AdbCpuCounters {
                name: name.to_string(),
                total: values.iter().sum(),
                idle,
            })
        })
        .collect();
    let cpu_frequencies_mhz = section("CPU_FREQ")
        .lines()
        .filter_map(|line| line.trim().parse::<u64>().ok())
        .map(|khz| khz / 1000)
        .collect();

    let uid_by_pid: HashMap<u32, u32> = section("PROCESS_UID")
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
        })
        .collect();
    let network_by_uid: HashMap<u32, u64> = section("NET_UID")
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
        })
        .collect();
    let disk_counters_by_pid: HashMap<u32, (u64, u64)> = section("PROC_IO")
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            Some((fields.next()?.parse().ok()?, (fields.next()?.parse().ok()?, fields.next()?.parse().ok()?)))
        })
        .collect();
    let disk_rates_by_pid = process_disk_rates(serial, &disk_counters_by_pid);
    let gpu_section = section("GPU_MEM");
    let gpu_data_available = gpu_section.lines().any(|line| line.trim() == "AVAILABLE");
    let mut gpu_memory_by_pid = HashMap::<u32, u64>::new();
    let mut gpu_pid = None;
    for line in gpu_section.lines() {
        let line = line.trim();
        if let Some(pid) = line.strip_prefix("GPU_PID ").and_then(|pid| pid.parse::<u32>().ok()) {
            gpu_pid = Some(pid);
        } else if let (Some(pid), Some(bytes)) = (gpu_pid, line.split_whitespace().nth(2).and_then(|value| value.parse::<u64>().ok())) {
            *gpu_memory_by_pid.entry(pid).or_default() += bytes;
        }
    }

    let top_processes = section("TOP")
        .lines()
        .filter_map(|line| {
            let columns: Vec<&str> = line.split_whitespace().collect();
            let pid = columns.first()?.parse::<u32>().ok()?;
            if columns.len() < 9 {
                return None;
            }
            let cpu_pct = columns[8]
                .trim_end_matches('%')
                .parse::<f32>()
                .ok()
                .map(|p| (p * 10.0).round() / 10.0);
            Some(AdbSensorProcess {
                pid,
                uid: uid_by_pid.get(&pid).copied(),
                name: columns.get(11..).unwrap_or(&[]).join(" ").trim().to_string(),
                cpu_pct,
                memory: columns.get(5).copied().unwrap_or("").to_string(),
                memory_kb: columns
                    .get(5)
                    .and_then(|value| parse_top_memory_kb(value)),
                disk_rate_bps: disk_rates_by_pid.get(&pid).copied(),
                network_bytes: uid_by_pid.get(&pid).and_then(|uid| network_by_uid.get(uid)).copied(),
                gpu_memory_bytes: gpu_data_available.then(|| gpu_memory_by_pid.get(&pid).copied().unwrap_or(0)),
            })
        })
        .filter(|process| !process.name.is_empty() && !process.name.starts_with("top ") && !process.name.starts_with("sh "))
        .take(150)
        .collect();
    let cpu_usage_pct = section("TOP")
        .lines()
        .find(|line| line.to_ascii_lowercase().contains("%cpu"))
        .and_then(|line| {
            let columns: Vec<&str> = line.split_whitespace().collect();
            let total = columns.first()?.trim_end_matches("%cpu").parse::<f32>().ok()?;
            let idle = columns.iter().find_map(|part| {
                part.strip_suffix("%idle")?.parse::<f32>().ok()
            })?;
            (total > 0.0).then_some((((total - idle) / total * 100.0).clamp(0.0, 100.0) * 10.0).round() / 10.0)
        });

    let network_interfaces = section("NETDEV")
        .lines()
        .skip(2)
        .filter_map(|line| {
            let (name, counters) = line.split_once(':')?;
            let counters: Vec<&str> = counters.split_whitespace().collect();
            Some(AdbNetworkInterface {
                name: name.trim().to_string(),
                rx_bytes: counters.first()?.parse().ok()?,
                tx_bytes: counters.get(8)?.parse().ok()?,
            })
        })
        .collect();

    let disk_counters = section("DISKSTATS")
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let name = *fields.get(2)?;
            Some(AdbDiskCounters {
                name: name.to_string(),
                read_sectors: fields.get(5)?.parse().ok()?,
                written_sectors: fields.get(9)?.parse().ok()?,
            })
        })
        .collect();
    let mut storage_internal = None;
    let mut storage_shared = None;
    for line in section("DF").lines() {
        let Some((mount, total, free)) = parse_android_df_line(line) else { continue; };
        if mount.starts_with("/data") && storage_internal.is_none() {
            storage_internal = Some((total, free));
        } else if mount.starts_with("/storage/emulated") && storage_shared.is_none() {
            storage_shared = Some((total, free));
        }
    }

    let temperatures = section("THERMAL_ZONES").lines().filter_map(|line| {
        let (name, value) = line.rsplit_once(char::is_whitespace)?;
        let mut temp_c = value.trim().parse::<f32>().ok()?;
        if temp_c.abs() > 200.0 {
            temp_c /= 1000.0;
        }
        temp_c = (temp_c * 10.0).round() / 10.0;
        Some(AdbTemperatureSensor {
            name: if name.trim().is_empty() { "Thermal zone" } else { name.trim() }.to_string(),
            temp_c,
        })
    }).collect();

    let parse_toggle = |name: &str| {
        let raw = section(name).trim();
        match raw {
            "1" => Some(true),
            "0" => Some(false),
            _ if raw.lines().any(|line| line.trim() == "enabled: true" || line.trim() == "state: ON") => Some(true),
            _ if raw.lines().any(|line| line.trim() == "enabled: false" || line.trim() == "state: OFF") => Some(false),
            _ => None,
        }
    };
    let battery_uevent_val = |key: &str| {
        section("BATTERY")
            .lines()
            .find_map(|line| line.trim().strip_prefix(&format!("POWER_SUPPLY_{key}=")))
            .map(str::trim)
    };
    let battery_value = |prefix: &str| {
        section("BATTERY")
            .lines()
            .find_map(|line| line.trim().strip_prefix(prefix))
            .map(str::trim)
    };
    let gpu: Vec<&str> = section("GPU").lines().map(str::trim).filter(|line| !line.is_empty()).collect();
    let battery_plugged = ["AC", "USB", "Wireless"]
        .iter()
        .find(|source| battery_value(&format!("{source} powered:")) == Some("true"))
        .map(|source| source.to_string())
        .unwrap_or_else(|| "Not charging".to_string());
    let uptime_secs = section("UPTIME")
        .split_whitespace()
        .next()
        .and_then(|value| value.parse::<f64>().ok())
        .map(|seconds| seconds as u64);
    let battery_status = battery_value("status:")
        .and_then(|status| match status {
            "2" => Some("Charging"),
            "3" => Some("Discharging"),
            "4" => Some("Not charging"),
            "5" => Some("Full"),
            _ => None,
        })
        .or_else(|| battery_uevent_val("STATUS").map(|s| match s {
            "Charging" => "Charging",
            "Discharging" => "Discharging",
            "Not charging" => "Not charging",
            "Full" => "Full",
            other => other,
        }))
        .unwrap_or("Unavailable")
        .to_string();

    let battery_current_ua = battery_uevent_val("CURRENT_NOW")
        .and_then(|val| val.parse::<i64>().ok())
        .or_else(|| {
            battery_value("current now:")
                .and_then(|val| val.parse::<i64>().ok())
        });
    let battery_charge_counter_uah = battery_uevent_val("CHARGE_COUNTER")
        .and_then(|val| val.parse::<u64>().ok())
        .or_else(|| {
            battery_value("Charge counter:")
                .or_else(|| battery_value("charge counter:"))
                .and_then(|val| val.parse::<u64>().ok())
        });
    let battery_charge_full_uah = battery_uevent_val("CHARGE_FULL")
        .and_then(|val| val.parse::<u64>().ok());
    let battery_charge_full_design_uah = battery_uevent_val("CHARGE_FULL_DESIGN")
        .and_then(|val| val.parse::<u64>().ok());
    let battery_cycle_count = battery_uevent_val("BATTERY_CYCLE")
        .and_then(|val| val.parse::<u64>().ok())
        .or_else(|| {
            battery_value("mSavedBatteryUsage:")
                .and_then(|val| val.parse::<u64>().ok())
                .map(|usage| usage / 100)
        })
        .or_else(|| battery_uevent_val("CYCLE_COUNT").and_then(|val| val.parse::<u64>().ok()));
    let battery_technology = battery_uevent_val("TECHNOLOGY")
        .map(str::to_string)
        .or_else(|| battery_value("technology:").map(str::to_string))
        .or_else(|| Some("Li-ion".to_string()));

    let power_attribution = parse_power_attribution(section("BATTERYSTATS"));

    let power_attribution_secs = parse_battery_time(section("BATTERYSTATS_TIME"));

    let governor_lines: Vec<&str> = section("GOVERNOR").lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    let cpu_governor = governor_lines.first().map(|s| s.to_string());
    let cpu_available_governors = governor_lines
        .get(1)
        .map(|s| s.split_whitespace().map(str::to_string).collect())
        .unwrap_or_default();

    let battery_health_raw = battery_uevent_val("HEALTH")
        .or_else(|| battery_value("health:"))
        .unwrap_or("");
    let battery_health = match battery_health_raw {
        "2" | "Good" | "good" => "Good",
        "3" | "Overheat" | "overheat" => "Overheat",
        "4" | "Dead" | "dead" => "Dead",
        "5" | "Over voltage" | "over_voltage" => "Over Voltage",
        "6" | "Unspecified failure" => "Failure",
        "7" | "Cold" | "cold" => "Cold",
        other if !other.is_empty() => other,
        _ => "Good",
    }.to_string();

    let mut socket_total = 0;
    let mut socket_tcp = 0;
    let mut socket_udp = 0;
    for line in section("SOCKSTAT").lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if line.starts_with("sockets:") {
            if parts.len() >= 3 {
                socket_total = parts[2].parse().unwrap_or(0);
            }
        } else if line.starts_with("TCP:") {
            for (i, &p) in parts.iter().enumerate() {
                if p == "inuse" || p == "alloc" {
                    if let Some(&val) = parts.get(i + 1) {
                        socket_tcp = val.parse().unwrap_or(socket_tcp);
                    }
                }
            }
        } else if line.starts_with("UDP:") {
            for (i, &p) in parts.iter().enumerate() {
                if p == "inuse" {
                    if let Some(&val) = parts.get(i + 1) {
                        socket_udp = val.parse().unwrap_or(socket_udp);
                    }
                }
            }
        }
    }

    let bt_section = section("BLUETOOTH");
    let mut bt_name = None;
    let mut bt_address = None;
    let mut bt_state = None;
    let mut bt_scan_mode = None;
    let mut bt_conn_state = None;
    let mut bt_class = None;
    let mut bt_uptime = None;
    let mut bt_max_audio = None;
    let mut bt_a2dp_offload = None;
    let mut bt_active_dev = None;
    let mut bt_profiles = Vec::new();
    let mut bt_bonded = Vec::new();
    let mut in_bonded = false;

    for line in bt_section.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if in_bonded { in_bonded = false; }
            continue;
        }

        if trimmed.starts_with("mSnoopLog") || trimmed.starts_with("AdapterState:") {
            in_bonded = false;
        }

        if in_bonded {
            if trimmed.contains(':') && trimmed.len() >= 17 {
                bt_bonded.push(trimmed.to_string());
            }
        }

        if trimmed == "Bonded devices:" {
            in_bonded = true;
            continue;
        }

        if let Some(val) = trimmed.strip_prefix("name: ").or_else(|| trimmed.strip_prefix("Name: ")) {
            if bt_name.is_none() && !val.is_empty() && val != "null" {
                bt_name = Some(val.to_string());
            }
        } else if let Some(val) = trimmed.strip_prefix("address: ").or_else(|| trimmed.strip_prefix("Address: ")) {
            if bt_address.is_none() && !val.is_empty() && val != "null" {
                bt_address = Some(val.to_string());
            }
        } else if let Some(val) = trimmed.strip_prefix("state: ").or_else(|| trimmed.strip_prefix("State: ")) {
            if bt_state.is_none() && !val.is_empty() {
                bt_state = Some(val.to_string());
            }
        } else if let Some(val) = trimmed.strip_prefix("ScanMode: ") {
            bt_scan_mode = Some(val.to_string());
        } else if let Some(val) = trimmed.strip_prefix("ConnectionState: ") {
            bt_conn_state = Some(val.to_string());
        } else if let Some(val) = trimmed.strip_prefix("BluetoothClass: ") {
            bt_class = Some(val.to_string());
