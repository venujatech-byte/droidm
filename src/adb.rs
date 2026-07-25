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
