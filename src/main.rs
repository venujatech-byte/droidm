mod app;
mod config;
mod modals;
mod remote;
mod scanner;
mod service;
mod tauri_app;
pub mod adb;
pub mod autostart;
pub mod bluetooth;
pub mod commands;
pub mod lucide;
pub mod power;
pub mod procmgr;
pub mod scripts;
pub mod sensors;
pub mod systemd;
pub mod theme;
pub mod wifi;

use app::LauncherApp;
use config::ConfigFile;
use eframe::egui;
use theme::ThemeMode;

pub fn load_app_icon() -> Option<egui::IconData> {
    let png_bytes = include_bytes!("../assets/icon.png");
    if let Ok(img) = image::load_from_memory(png_bytes) {
        let rgba = img.to_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        Some(egui::IconData {
            rgba: rgba.into_raw(),
            width,
            height,
        })
    } else {
        None
    }
}

#[cfg(target_os = "linux")]
pub fn ensure_linux_desktop_integration() {
    let home = match std::env::var("HOME") {
        Ok(h) => std::path::PathBuf::from(h),
        Err(_) => return,
    };

    let icon_512_bytes = include_bytes!("../assets/icon.png");
    let icon_96_bytes = include_bytes!("../assets/icon_96.png");

    // 1. Install icons into all standard XDG icon theme and pixmap locations.
    // This ensures GNOME, KDE, XFCE, Cinnamon, and custom themes (such as MacTahoe)
    // find the icon regardless of lookup method or icon size requested.
    let icon_sizes = ["512x512", "256x256", "128x128", "64x64", "48x48", "32x32"];
    for size in icon_sizes {
        let size_dir = home.join(format!(".local/share/icons/hicolor/{}/apps", size));
        if std::fs::create_dir_all(&size_dir).is_ok() {
            let _ = std::fs::write(size_dir.join("server_launcher.png"), icon_512_bytes);
        }
    }
