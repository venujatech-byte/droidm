use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AdbDeviceConfig {
    pub id: String,
    pub name: String,
    pub serial: String,
    #[serde(default)]
    pub is_wireless: bool,
    #[serde(default)]
    pub ip_port: Option<String>,
    #[serde(default)]
    pub scrcpy_max_fps: Option<u32>,
    #[serde(default)]
    pub scrcpy_bitrate_mbps: Option<u32>,
    #[serde(default)]
    pub scrcpy_stay_awake: bool,
    #[serde(default)]
    pub scrcpy_turn_screen_off: bool,
    #[serde(default)]
    pub scrcpy_no_audio: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConfigFile {
    #[serde(default)]
    pub adb_devices: Vec<AdbDeviceConfig>,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub accent_color: Option<String>,
}

impl ConfigFile {
    pub fn default_path() -> PathBuf {
        let local_path = PathBuf::from("servers.json");
        if local_path.exists() {
            return local_path;
        }

        let parent_path = PathBuf::from("../servers.json");
        if parent_path.exists() {
            return parent_path;
        }

        local_path
    }

    pub fn load_from_file(path: &Path) -> Self {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str::<ConfigFile>(&content) {
                return cfg;
            }
        }
        Self::default()
    }

    #[allow(dead_code)]
    pub fn save_to_file(&self, path: &Path) -> Result<(), String> {
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(path, content).map_err(|e| format!("Write error: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_load_default() {
        let cfg = ConfigFile::load_from_file(Path::new("non_existent_config.json"));
        assert!(cfg.adb_devices.is_empty());
        assert!(cfg.theme.is_none());
    }

    #[test]
    fn test_config_roundtrip() {
        let cfg = ConfigFile {
            adb_devices: vec![AdbDeviceConfig {
                id: "dev1".into(),
                name: "Phone".into(),
                serial: "12345".into(),
                is_wireless: false,
                ip_port: None,
                scrcpy_max_fps: Some(60),
                scrcpy_bitrate_mbps: Some(8),
                scrcpy_stay_awake: true,
                scrcpy_turn_screen_off: false,
                scrcpy_no_audio: false,
            }],
            theme: Some("nocturnal_command".into()),
            accent_color: Some("#7c3aed".into()),
        };
        let serialized = serde_json::to_string(&cfg).expect("serialize");
        let parsed: ConfigFile = serde_json::from_str(&serialized).expect("deserialize");
        assert_eq!(parsed.adb_devices.len(), 1);
        assert_eq!(parsed.theme.as_deref(), Some("nocturnal_command"));
    }
}
