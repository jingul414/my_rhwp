use tauri_plugin_dialog::DialogExt;
use base64::Engine as _;

#[derive(serde::Serialize)]
struct OpenedFile {
    file_name: String,
    data_b64: String,
}

#[tauri::command]
async fn pick_hwp_file(app: tauri::AppHandle) -> Result<Option<OpenedFile>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("HWP 문서", &["hwp", "hwpx"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let path = rx.await.map_err(|e| e.to_string())?;

    match path {
        None => Ok(None),
        Some(file_path) => {
            let path_buf = match file_path {
                tauri_plugin_dialog::FilePath::Path(p) => p,
                _ => return Err("지원하지 않는 경로 형식입니다".to_string()),
            };
            let file_name = path_buf
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "document.hwp".to_string());
            let bytes = std::fs::read(&path_buf).map_err(|e| e.to_string())?;
            let data_b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(Some(OpenedFile { file_name, data_b64 }))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![pick_hwp_file])
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("RHWP Desktop")
            .inner_size(1280.0, 800.0)
            .initialization_script(include_str!("tauri-bridge.js"))
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
