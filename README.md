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

## Downloadable packages

Run **Actions → Desktop packages → Run workflow**, or push a `v*` tag
(for example, `v0.1.0`). Download the packages from that run's **Artifacts**:

| System | Package |
| --- | --- |
| Linux portable | `.AppImage` (make executable before running) |
| Ubuntu, Debian, Kali, Linux Mint | `.deb` |
| Fedora | `.rpm` |
| Arch Linux | `.pkg.tar.zst` (install with `sudo pacman -U <file>`) |
| Windows portable | `droidm-windows-x64-portable.zip` (extract and run `droidm.exe`) |
| Windows installer | `.msi` |

All packages target x86-64. Versions come from `Cargo.toml` and
`tauri.conf.json`; update both before tagging. The workflow stores artifacts;
it does not publish a GitHub Release or an AUR entry.

Linux packages are built on Ubuntu 22.04 and require a compatible system
(glibc 2.35 or newer); older distribution releases are not supported. Native
packages also need WebKitGTK 4.1. AppImage may require FUSE on the host, or
can be launched with `--appimage-extract-and-run`.

Windows portable requires the Microsoft Edge WebView2 Runtime already
installed; the MSI installs it when missing and may need internet access.
Packages are unsigned. Install ADB separately and put it on `PATH`
(`adb` on Debian-based systems, `android-tools` on Fedora/Arch, or Google's
Platform-Tools on Windows). Install `scrcpy` separately for screen mirroring.
