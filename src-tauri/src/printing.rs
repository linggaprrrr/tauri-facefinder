use serde::Serialize;

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

/// Silently print a JPEG (raw bytes) to a named printer, `copies` sheets — no
/// dialog, no window. Returns the spooler's job id on success.
///
/// A non-zero job id is the whole point: the previous implementation shelled
/// out to `mspaint /pt`, which on Windows 11 is an App Execution Alias for the
/// MSIX Paint app. That app does not implement `/pt` — it opens the JPEG in a
/// window instead of spooling it, and still exits 0, so every print silently
/// "succeeded" while nothing came out of the printer. Windows now goes through
/// GDI directly (no external binary, no temp file, exact page sizing), so an
/// Ok(job_id) means the spooler really did accept the document.
#[tauri::command]
pub fn print_image(printer: String, bytes: Vec<u8>, copies: u32) -> Result<u32, String> {
    if printer.trim().is_empty() {
        return Err("No printer selected".into());
    }
    if bytes.is_empty() {
        return Err("No image data".into());
    }
    print_bytes(&bytes, &printer, copies.max(1))
}

// ── Windows: native GDI ──────────────────────────────────────────────────────
#[cfg(windows)]
fn print_bytes(bytes: &[u8], printer: &str, copies: u32) -> Result<u32, String> {
    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{
        CreateDCW, DeleteDC, GetDeviceCaps, SetBrushOrgEx, SetStretchBltMode, StretchDIBits,
        BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HALFTONE, HORZRES, SRCCOPY, VERTRES,
    };
    use windows::Win32::Storage::Xps::{AbortDoc, EndDoc, EndPage, StartDocW, StartPage, DOCINFOW};

    // Decode to top-down BGRA. 32bpp means the DIB stride is always width*4, so
    // there is no 4-byte row-padding maths to get wrong, and a negative biHeight
    // means no vertical flip either.
    let decoded = image::load_from_memory(bytes)
        .map_err(|e| format!("decode image: {e}"))?
        .to_rgba8();

    let name = wide(printer);
    // SAFETY: every raw pointer below points at a live local that outlives the
    // call, and the HDC is deleted on all paths.
    unsafe {
        let hdc = CreateDCW(
            PCWSTR::null(),
            PCWSTR(name.as_ptr()),
            PCWSTR::null(),
            None,
        );
        if hdc.is_invalid() {
            return Err(format!("printer \"{printer}\" could not be opened"));
        }

        let page_w = GetDeviceCaps(Some(hdc), HORZRES);
        let page_h = GetDeviceCaps(Some(hdc), VERTRES);
        if page_w <= 0 || page_h <= 0 {
            let _ = DeleteDC(hdc);
            return Err("printer reported an empty printable area".into());
        }

        // ponytail: rotate when the image and the page disagree on orientation.
        // Kiosk printers are routinely left on the driver's default portrait
        // while a template is authored landscape (or vice versa); without this
        // the contain-fit below prints a postage stamp between two white bands.
        let img = if (decoded.width() > decoded.height()) != (page_w > page_h) {
            image::imageops::rotate90(&decoded)
        } else {
            decoded
        };
        let (img_w, img_h) = (img.width() as i32, img.height() as i32);
        let mut pixels = img.into_raw();
        for px in pixels.chunks_exact_mut(4) {
            px.swap(0, 2); // RGBA -> BGRA
        }

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: img_w,
                biHeight: -img_h, // negative => top-down rows
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        // Contain-fit, centred — never crop a photo the customer paid for.
        let scale = f64::min(page_w as f64 / img_w as f64, page_h as f64 / img_h as f64);
        let dst_w = (img_w as f64 * scale).round() as i32;
        let dst_h = (img_h as f64 * scale).round() as i32;
        let dst_x = (page_w - dst_w) / 2;
        let dst_y = (page_h - dst_h) / 2;

        let doc_name = wide("Ownize Photo");
        let doc = DOCINFOW {
            cbSize: std::mem::size_of::<DOCINFOW>() as i32,
            lpszDocName: PCWSTR(doc_name.as_ptr()),
            ..Default::default()
        };

        let job_id = StartDocW(hdc, &doc);
        if job_id <= 0 {
            let _ = DeleteDC(hdc);
            return Err(format!("spooler rejected the document ({})", last_error()));
        }

        // All `copies` sheets ride in one spooler document, so the job the user
        // sees in the print queue matches the job we report back.
        let mut failure = None;
        for sheet in 1..=copies {
            if StartPage(hdc) <= 0 {
                failure = Some(format!("StartPage failed on sheet {sheet} ({})", last_error()));
                break;
            }
            // HALFTONE gives filtered downscaling instead of dropped rows; it
            // requires the brush origin to be reset immediately afterwards.
            SetStretchBltMode(hdc, HALFTONE);
            let _ = SetBrushOrgEx(hdc, 0, 0, None);

            let scanlines = StretchDIBits(
                hdc,
                dst_x,
                dst_y,
                dst_w,
                dst_h,
                0,
                0,
                img_w,
                img_h,
                Some(pixels.as_ptr() as *const _),
                &bmi,
                DIB_RGB_COLORS,
                SRCCOPY,
            );
            if scanlines == 0 {
                failure = Some(format!("StretchDIBits wrote nothing ({})", last_error()));
                break;
            }
            if EndPage(hdc) <= 0 {
                failure = Some(format!("EndPage failed on sheet {sheet} ({})", last_error()));
                break;
            }
        }

        let result = if let Some(err) = failure {
            // Don't leave a half-written document sitting in the queue.
            AbortDoc(hdc);
            Err(err)
        } else if EndDoc(hdc) <= 0 {
            Err(format!("EndDoc failed ({})", last_error()))
        } else {
            Ok(job_id as u32)
        };
        let _ = DeleteDC(hdc);
        result
    }
}

#[cfg(windows)]
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn last_error() -> String {
    format!("os error {}", unsafe {
        windows::Win32::Foundation::GetLastError().0
    })
}

// ── macOS / Linux: CUPS ──────────────────────────────────────────────────────
// `lp` rasterizes and spools the JPEG itself, and a zero exit means CUPS
// accepted the job — the same guarantee the GDI path gives on Windows. There
// is no spooler job id to hand back, so 0 stands for "accepted, id unknown".
#[cfg(not(windows))]
fn print_bytes(bytes: &[u8], printer: &str, copies: u32) -> Result<u32, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    // No file argument — `lp` reads the document from stdin. Don't pass "-";
    // CUPS reads that as a file literally named "-", not as stdin.
    let mut child = Command::new("lp")
        .args(["-d", printer, "-n", &copies.to_string()])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|e| format!("spawn lp: {e}"))?;

    child
        .stdin
        .take()
        .ok_or("lp stdin unavailable")?
        .write_all(bytes)
        .map_err(|e| format!("pipe to lp: {e}"))?;

    let status = child.wait().map_err(|e| format!("wait for lp: {e}"))?;
    if status.success() {
        Ok(0)
    } else {
        Err(format!("print failed (exit {:?})", status.code()))
    }
}
