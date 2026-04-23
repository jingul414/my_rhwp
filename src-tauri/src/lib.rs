use tauri_plugin_dialog::DialogExt;
use base64::Engine as _;
use tauri::Manager;
use std::sync::Mutex;

struct StartupFile(Mutex<Option<String>>);

#[derive(serde::Serialize)]
struct OpenedFile {
    file_name: String,
    file_path: String,
    data_b64: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct RecentFile {
    path: String,
    name: String,
}

fn recent_files_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("recent_files.json")
}

fn load_recent_files(app: &tauri::AppHandle) -> Vec<RecentFile> {
    std::fs::read_to_string(recent_files_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_recent_files(app: &tauri::AppHandle, files: &[RecentFile]) {
    let path = recent_files_path(app);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string(files) {
        let _ = std::fs::write(path, content);
    }
}

#[tauri::command]
fn get_startup_file(state: tauri::State<StartupFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
fn get_recent_files(app: tauri::AppHandle) -> Vec<RecentFile> {
    load_recent_files(&app)
}

#[tauri::command]
fn add_recent_file(app: tauri::AppHandle, path: String, name: String) {
    let mut files = load_recent_files(&app);
    files.retain(|f| f.path != path);
    files.insert(0, RecentFile { path, name });
    files.truncate(10);
    save_recent_files(&app, &files);
}

#[tauri::command]
async fn open_recent_file(app: tauri::AppHandle, path: String) -> Result<Option<OpenedFile>, String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        let mut files = load_recent_files(&app);
        files.retain(|f| f.path != path);
        save_recent_files(&app, &files);
        return Ok(None);
    }
    let file_name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "document.hwp".to_string());
    let bytes = std::fs::read(&path_buf).map_err(|e| e.to_string())?;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(Some(OpenedFile { file_name, file_path: path, data_b64 }))
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
            let file_path = path_buf.to_string_lossy().into_owned();
            let bytes = std::fs::read(&path_buf).map_err(|e| e.to_string())?;
            let data_b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(Some(OpenedFile { file_name, file_path, data_b64 }))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_file = std::env::args()
        .skip(1)
        .find(|arg| {
            !arg.starts_with('-')
                && (arg.ends_with(".hwp") || arg.ends_with(".hwpx")
                    || arg.ends_with(".HWP") || arg.ends_with(".HWPX"))
        });

    tauri::Builder::default()
        .manage(StartupFile(Mutex::new(startup_file)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pick_hwp_file,
            get_startup_file,
            get_recent_files,
            add_recent_file,
            open_recent_file,
        ])
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
