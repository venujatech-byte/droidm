mod config;
pub mod adb;
pub mod tauri_app;
pub mod theme;

#[cfg(target_os = "linux")]
pub fn ensure_linux_desktop_integration() {
    let home = match std::env::var("HOME") {
        Ok(h) => std::path::PathBuf::from(h),
        Err(_) => return,
    };

    let icon_512_bytes = include_bytes!("../assets/icon.png");
    let icon_96_bytes = include_bytes!("../assets/icon_96.png");

    let icon_sizes = ["512x512", "256x256", "128x128", "64x64", "48x48", "32x32"];
    for size in icon_sizes {
        let size_dir = home.join(format!(".local/share/icons/hicolor/{}/apps", size));
        if std::fs::create_dir_all(&size_dir).is_ok() {
            let _ = std::fs::write(size_dir.join("droidm.png"), icon_512_bytes);
        }
    }

    let dir_96 = home.join(".local/share/icons/hicolor/96x96/apps");
    if std::fs::create_dir_all(&dir_96).is_ok() {
        let _ = std::fs::write(dir_96.join("droidm.png"), icon_96_bytes);
    }

    let base_icon_dir = home.join(".local/share/icons");
    if std::fs::create_dir_all(&base_icon_dir).is_ok() {
        let _ = std::fs::write(base_icon_dir.join("droidm.png"), icon_512_bytes);
    }

    let pixmaps_dir = home.join(".local/share/pixmaps");
    if std::fs::create_dir_all(&pixmaps_dir).is_ok() {
        let _ = std::fs::write(pixmaps_dir.join("droidm.png"), icon_512_bytes);
    }

    let primary_icon_path = home.join(".local/share/icons/hicolor/512x512/apps/droidm.png");

    let _ = std::process::Command::new("gtk-update-icon-cache")
        .args(["-f", "-t", &home.join(".local/share/icons/hicolor").to_string_lossy()])
        .output();

    let current_exe = std::env::current_exe().unwrap_or_else(|_| std::path::PathBuf::from("droidm"));
    let local_bin_dir = home.join(".local/bin");
    let target_bin = local_bin_dir.join("droidm");

    let is_system_install = current_exe.starts_with("/usr") || current_exe.starts_with("/opt");
    let is_local_bin = current_exe == target_bin;

    let exec_path = if !is_system_install && !is_local_bin {
        let _ = std::fs::create_dir_all(&local_bin_dir);
        if std::fs::copy(&current_exe, &target_bin).is_ok() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&target_bin, std::fs::Permissions::from_mode(0o755));
            }
            target_bin
        } else {
            current_exe.clone()
        }
    } else {
        current_exe.clone()
    };

    let desktop_content = format!(
        "[Desktop Entry]\n\
Version=1.0\n\
Type=Application\n\
Name=Android Cockpit\n\
GenericName=Android ADB Cockpit\n\
Comment=Developer Android Cockpit & Real-time Telemetry Dashboard\n\
Exec=\"{}\" %u\n\
Icon={}\n\
Terminal=false\n\
Categories=Development;Utility;System;\n\
StartupWMClass=droidm\n\
StartupNotify=true\n\
Keywords=adb;android;scrcpy;terminal;shell;telemetry;\n\
X-GNOME-UsesNotifications=true\n",
        exec_path.display(),
        primary_icon_path.display()
    );

    let apps_dir = home.join(".local/share/applications");
    if std::fs::create_dir_all(&apps_dir).is_ok() {
        let app_desktop_file = apps_dir.join("droidm.desktop");
        let _ = std::fs::write(&app_desktop_file, &desktop_content);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&app_desktop_file, std::fs::Permissions::from_mode(0o755));
        }

        let _ = std::process::Command::new("update-desktop-database")
            .arg(&apps_dir)
            .output();
    }

    let desktop_dir = home.join("Desktop");
    if desktop_dir.is_dir() {
        let desktop_file = desktop_dir.join("droidm.desktop");
        let _ = std::fs::write(&desktop_file, &desktop_content);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&desktop_file, std::fs::Permissions::from_mode(0o755));
        }

        let _ = std::process::Command::new("gio")
            .args(["set", &desktop_file.to_string_lossy(), "metadata::trusted", "true"])
            .output();
    }
}

#[cfg(not(target_os = "linux"))]
pub fn ensure_linux_desktop_integration() {}

fn main() {
    #[cfg(target_os = "linux")]
    ensure_linux_desktop_integration();

    let set_serial = |serial: &str| {
        std::env::set_var("DROIDM_ADB_SERIAL", serial);
        std::env::set_var("SERVER_LAUNCHER_ADB_SERIAL", serial);
    };

    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Some(index) = args.iter().position(|arg| arg == "--adb-cockpit" || arg.starts_with("--adb-cockpit=") || arg == "--serial" || arg.starts_with("--serial=")) {
        if let Some(serial) = args[index].strip_prefix("--adb-cockpit=") {
            set_serial(serial);
        } else if let Some(serial) = args[index].strip_prefix("--serial=") {
            set_serial(serial);
        } else if let Some(serial) = args.get(index + 1) {
            set_serial(serial);
        }
    } else if let Some(first_arg) = args.first() {
        if !first_arg.starts_with('-') {
            set_serial(first_arg);
        }
    }

    tauri_app::run();
}
