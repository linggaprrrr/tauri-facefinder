use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
    pub state: String,
}

/// Enumerate installed printers so the kiosk Settings can offer a picker and
/// show online/offline state. Uses the `printers` crate (pure Rust, no bundle).
#[tauri::command]
pub fn list_printers() -> Vec<PrinterInfo> {
    printers::get_printers()
        .into_iter()
        .map(|p| PrinterInfo {
            name: p.name.clone(),
            is_default: p.is_default,
            state: format!("{:?}", p.state),
        })
        .collect()
}

/// Silently print a JPEG (raw bytes) to a named printer, `copies` times — no
/// dialog, no window. Returns Ok on submit, Err with a message on failure.
///
/// NOTE on rendering: the `printers` crate is used for *listing*, but the actual
/// print goes through the Windows image print path (`mspaint /pt`) because
/// raw-spooling JPEG bytes does NOT render correctly on most drivers. If mspaint
/// briefly flashes a window on your photo printer, swap `print_one` for a bundled
/// SumatraPDF call: `SumatraPDF.exe -print-to "<printer>" -silent <file>`.
#[tauri::command]
pub fn print_image(printer: String, bytes: Vec<u8>, copies: u32) -> Result<(), String> {
    if printer.trim().is_empty() {
        return Err("No printer selected".into());
    }
    if bytes.is_empty() {
        return Err("No image data".into());
    }

    // Write the render to a temp file the OS print path can read.
    let mut path = std::env::temp_dir();
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    path.push(format!("ownize_print_{stamp}.jpg"));
    std::fs::write(&path, &bytes).map_err(|e| format!("write temp file: {e}"))?;

    let n = copies.max(1);
    let mut result = Ok(());
    for _ in 0..n {
        if let Err(e) = print_one(&path, &printer) {
            result = Err(e);
            break;
        }
    }

    let _ = std::fs::remove_file(&path);
    result
}

#[cfg(windows)]
fn print_one(path: &Path, printer: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let path_str = path.to_str().ok_or("invalid temp path")?;
    let status = std::process::Command::new("mspaint")
        .args(["/pt", path_str, printer])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("spawn mspaint: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("print failed (exit {:?})", status.code()))
    }
}

#[cfg(not(windows))]
fn print_one(_path: &Path, _printer: &str) -> Result<(), String> {
    Err("Silent printing is only implemented for Windows".into())
}
