# Workspace Guidelines & Agent Routing

## Repository Invariants
- **Rust Compilation**: STRICTLY run `cargo check` only. NEVER run `cargo build`.
- **KISS / YAGNI**: Adhere to `/ponytail` design principles (minimal, clean, native standard library first).
- **Git Versioning**: Commit verified changes cleanly to git upon compilation success.
- **Documentation Integrity**: Maintain all comments, docstrings, and non-obvious design notes.
- **Data Protection**: Do not commit runtime JSON data files or uncommitted architecture documents.

## Project Structure
- `src/`: Tauri 2 backend written in Rust, implementing ADB device telemetry, process monitoring, systemd controls, and network scanning.
- `web/`: Frontend vanilla HTML/CSS/JS client adhering to Nocturnal Obsidian theme design tokens.
- `assets/`: Embedded fonts (Inter Sans, Lucide glyphs) and desktop icons.
- `tests/`: End-to-end integration test runners for power management, call log extraction, and top apps telemetry.
