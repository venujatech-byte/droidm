# Droidm - Android ADB Cockpit

A fast, lightweight developer orchestrator, telemetry cockpit, and management suite for Android devices built with **Tauri 2** (Rust host runtime) and a custom **Nocturnal Command** developer dashboard.

---

## Features

- **Zero-Overhead Live Telemetry**: Single-session batch shell probes querying CPU, GPU, memory, thermals, battery, wireless, cellular, and processes without waking separate ADB subprocesses.
- **Deep Telephony & Subsystem Telemetry**: Real-time baseband state, SIM profiles, RF signal metrics (RSRP, RSRQ, SINR, ASU), high-resolution Bluetooth audio codecs (SSC, LDAC, aptX, AAC, SBC), and battery power estimation.
- **Communications Suite**: SMS conversation threads, recent call logs, contacts address book with instant dialing, and key event controls.
- **Diagnostics & Firmware Toolkit**: Root detection (Magisk, KernelSU, APatch), SELinux enforcement switcher, system partition remount, and fastboot flasher.
- **Screen Mirroring & Shell**: Low-latency `scrcpy` launch controls and interactive host terminal shell launcher.

---

## Prerequisites

- **Rust** & **Cargo** (1.75+)
- **ADB** (`android-tools` / Android SDK Platform-Tools)
- **scrcpy** (optional, for screen mirroring)

---

## Build & Check

### Verify compilation:
```bash
cargo check
```

### Run tests:
```bash
node tests/power-tab.cjs
node tests/calls-page.cjs
node tests/top-apps.cjs
```
