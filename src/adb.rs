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
