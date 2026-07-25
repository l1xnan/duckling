use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use super::session_manager::SessionManager;

const DIAGNOSTICS_DIR: &str = "diagnostics";
const MEMORY_LOG: &str = "memory.jsonl";
/// Rotate when the active log exceeds this size.
const MAX_LOG_BYTES: u64 = 20 * 1024 * 1024;
/// Keep at most this many rotated files (plus the active log).
const MAX_ROTATED_LOGS: usize = 7;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMemorySnapshot {
  pub duckling_ws_mb: Option<f64>,
  pub duckling_private_mb: Option<f64>,
  pub webview_ws_mb: Option<f64>,
  pub webview_private_mb: Option<f64>,
  pub webview_count: u32,
  pub total_ws_mb: Option<f64>,
  pub total_private_mb: Option<f64>,
  pub db_sessions: u32,
  pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryLogLine {
  pub ts: String,
  #[serde(flatten)]
  pub process: ProcessMemorySnapshot,
  #[serde(default)]
  pub main_tabs: u32,
  #[serde(default)]
  pub soft_closed_editors: u32,
  #[serde(default)]
  pub result_tabs: u32,
  #[serde(default)]
  pub result_rows: u32,
  #[serde(default)]
  pub result_est_kb: u32,
  #[serde(default)]
  pub open_table_tabs: u32,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub notes: Option<String>,
}

fn diagnostics_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join(DIAGNOSTICS_DIR);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

fn memory_log_path(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(diagnostics_dir(app)?.join(MEMORY_LOG))
}

fn path_display(path: &Path) -> String {
  path.to_string_lossy().replace('\\', "/")
}

fn mb(bytes: u64) -> f64 {
  (bytes as f64) / (1024.0 * 1024.0)
}

#[cfg(windows)]
mod win_mem {
  use super::mb;
  use std::mem::{size_of, zeroed};

  type WinBool = i32;
  type WinDword = u32;
  type WinHandle = *mut std::ffi::c_void;
  type WinSizeT = usize;

  const TH32CS_SNAPPROCESS: WinDword = 0x0000_0002;
  const PROCESS_QUERY_LIMITED_INFORMATION: WinDword = 0x1000;
  const PROCESS_VM_READ: WinDword = 0x0010;

  #[repr(C)]
  struct ProcessEntry32W {
    dw_size: WinDword,
    cnt_usage: WinDword,
    th32_process_id: WinDword,
    th32_default_heap_id: usize,
    th32_module_id: WinDword,
    cnt_threads: WinDword,
    th32_parent_process_id: WinDword,
    pc_pri_class_base: i32,
    dw_flags: WinDword,
    sz_exe_file: [u16; 260],
  }

  #[repr(C)]
  struct ProcessMemoryCountersEx {
    cb: WinDword,
    page_fault_count: WinDword,
    peak_working_set_size: WinSizeT,
    working_set_size: WinSizeT,
    quota_peak_paged_pool_usage: WinSizeT,
    quota_paged_pool_usage: WinSizeT,
    quota_peak_non_paged_pool_usage: WinSizeT,
    quota_non_paged_pool_usage: WinSizeT,
    pagefile_usage: WinSizeT,
    peak_pagefile_usage: WinSizeT,
    private_usage: WinSizeT,
  }

  #[link(name = "kernel32")]
  unsafe extern "system" {
    fn CreateToolhelp32Snapshot(flags: WinDword, process_id: WinDword) -> WinHandle;
    fn Process32FirstW(snapshot: WinHandle, entry: *mut ProcessEntry32W) -> WinBool;
    fn Process32NextW(snapshot: WinHandle, entry: *mut ProcessEntry32W) -> WinBool;
    fn OpenProcess(access: WinDword, inherit: WinBool, process_id: WinDword) -> WinHandle;
    fn CloseHandle(handle: WinHandle) -> WinBool;
    fn GetCurrentProcess() -> WinHandle;
  }

  #[link(name = "psapi")]
  unsafe extern "system" {
    fn GetProcessMemoryInfo(
      process: WinHandle,
      ppsmem_counters: *mut ProcessMemoryCountersEx,
      cb: WinDword,
    ) -> WinBool;
  }

  const INVALID_HANDLE_VALUE: WinHandle = -1isize as WinHandle;

  fn wide_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
  }

  fn memory_for_handle(handle: WinHandle) -> Option<(u64, u64)> {
    unsafe {
      let mut counters: ProcessMemoryCountersEx = zeroed();
      counters.cb = size_of::<ProcessMemoryCountersEx>() as WinDword;
      if GetProcessMemoryInfo(handle, &mut counters, counters.cb) == 0 {
        return None;
      }
      Some((
        counters.working_set_size as u64,
        counters.private_usage as u64,
      ))
    }
  }

  pub fn memory_for_pid(pid: u32) -> Option<(u64, u64)> {
    unsafe {
      let handle = OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ,
        0,
        pid,
      );
      if handle.is_null() {
        return None;
      }
      let result = memory_for_handle(handle);
      let _ = CloseHandle(handle);
      result
    }
  }

  pub fn current_process_memory() -> Option<(u64, u64)> {
    unsafe { memory_for_handle(GetCurrentProcess()) }
  }

  struct ProcInfo {
    pid: u32,
    parent: u32,
    name: String,
  }

  fn list_processes() -> Vec<ProcInfo> {
    unsafe {
      let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if snap.is_null() || snap == INVALID_HANDLE_VALUE {
        return Vec::new();
      }
      let mut entry: ProcessEntry32W = zeroed();
      entry.dw_size = size_of::<ProcessEntry32W>() as WinDword;
      let mut out = Vec::new();
      if Process32FirstW(snap, &mut entry) != 0 {
        loop {
          out.push(ProcInfo {
            pid: entry.th32_process_id,
            parent: entry.th32_parent_process_id,
            name: wide_to_string(&entry.sz_exe_file),
          });
          if Process32NextW(snap, &mut entry) == 0 {
            break;
          }
        }
      }
      let _ = CloseHandle(snap);
      out
    }
  }

  fn is_webview_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("msedgewebview2") || lower == "msedgewebview2.exe"
  }

  /// Collect WebView2 processes likely related to this app (descendants or same tree).
  pub fn related_webview_memory(self_pid: u32) -> (u32, u64, u64) {
    let procs = list_processes();
    if procs.is_empty() {
      return (0, 0, 0);
    }

    // Build parent map and find all descendants of self.
    let mut children: std::collections::HashMap<u32, Vec<u32>> =
      std::collections::HashMap::new();
    for p in &procs {
      children.entry(p.parent).or_default().push(p.pid);
    }

    let mut related = std::collections::HashSet::new();
    let mut stack = vec![self_pid];
    while let Some(pid) = stack.pop() {
      if !related.insert(pid) {
        continue;
      }
      if let Some(kids) = children.get(&pid) {
        stack.extend(kids.iter().copied());
      }
    }

    // Also include webview processes whose parent chain reaches our tree.
    for p in &procs {
      if !is_webview_name(&p.name) {
        continue;
      }
      let mut cur = p.parent;
      for _ in 0..32 {
        if related.contains(&cur) || cur == self_pid {
          related.insert(p.pid);
          break;
        }
        if cur == 0 {
          break;
        }
        let parent = procs.iter().find(|x| x.pid == cur).map(|x| x.parent);
        match parent {
          Some(pp) => cur = pp,
          None => break,
        }
      }
    }

    let mut count = 0u32;
    let mut ws = 0u64;
    let mut private = 0u64;
    for p in &procs {
      if p.pid == self_pid || !is_webview_name(&p.name) {
        continue;
      }
      // Prefer related tree; if none matched, fall back to all webview2 (dev/edge cases).
      let include = related.contains(&p.pid);
      if !include {
        continue;
      }
      if let Some((w, pr)) = memory_for_pid(p.pid) {
        count += 1;
        ws += w;
        private += pr;
      }
    }

    if count == 0 {
      // Fallback: sum all msedgewebview2 on the machine can over-count; only use
      // processes whose immediate parent is us or a child of us (already empty),
      // so leave zeros rather than attributing unrelated browsers.
    }

    (count, ws, private)
  }

  pub fn snapshot_bytes(self_pid: u32) -> (Option<(u64, u64)>, u32, u64, u64) {
    let self_mem = current_process_memory().or_else(|| memory_for_pid(self_pid));
    let (wv_count, wv_ws, wv_private) = related_webview_memory(self_pid);
    (self_mem, wv_count, wv_ws, wv_private)
  }

  pub fn to_mb(bytes: Option<(u64, u64)>) -> (Option<f64>, Option<f64>) {
    match bytes {
      Some((ws, private)) => (Some(mb(ws)), Some(mb(private))),
      None => (None, None),
    }
  }
}

#[cfg(not(windows))]
mod win_mem {
  pub fn snapshot_bytes(_self_pid: u32) -> (Option<(u64, u64)>, u32, u64, u64) {
    (None, 0, 0, 0)
  }

  pub fn to_mb(bytes: Option<(u64, u64)>) -> (Option<f64>, Option<f64>) {
    match bytes {
      Some((ws, private)) => (
        Some((ws as f64) / (1024.0 * 1024.0)),
        Some((private as f64) / (1024.0 * 1024.0)),
      ),
      None => (None, None),
    }
  }
}

fn build_snapshot(sessions: &SessionManager) -> ProcessMemorySnapshot {
  let pid = std::process::id();
  let (self_mem, wv_count, wv_ws, wv_private) = win_mem::snapshot_bytes(pid);
  let (duckling_ws_mb, duckling_private_mb) = win_mem::to_mb(self_mem);
  let webview_ws_mb = if wv_count > 0 {
    Some(mb(wv_ws))
  } else {
    None
  };
  let webview_private_mb = if wv_count > 0 {
    Some(mb(wv_private))
  } else {
    None
  };

  let total_ws_mb = match (duckling_ws_mb, webview_ws_mb) {
    (Some(a), Some(b)) => Some(a + b),
    (Some(a), None) => Some(a),
    (None, Some(b)) => Some(b),
    _ => None,
  };
  let total_private_mb = match (duckling_private_mb, webview_private_mb) {
    (Some(a), Some(b)) => Some(a + b),
    (Some(a), None) => Some(a),
    (None, Some(b)) => Some(b),
    _ => None,
  };

  ProcessMemorySnapshot {
    duckling_ws_mb,
    duckling_private_mb,
    webview_ws_mb,
    webview_private_mb,
    webview_count: wv_count,
    total_ws_mb,
    total_private_mb,
    db_sessions: sessions.len() as u32,
    pid,
  }
}

fn rotate_if_needed(path: &Path) -> Result<(), String> {
  let meta = match fs::metadata(path) {
    Ok(m) => m,
    Err(_) => return Ok(()),
  };
  if meta.len() < MAX_LOG_BYTES {
    return Ok(());
  }

  let parent = path.parent().ok_or_else(|| "invalid log path".to_string())?;
  let stamp = chrono_like_stamp();
  let rotated = parent.join(format!("memory-{stamp}.jsonl"));
  // If stamp collides, append pid-ish suffix.
  let rotated = if rotated.exists() {
    parent.join(format!(
      "memory-{stamp}-{}.jsonl",
      std::process::id()
    ))
  } else {
    rotated
  };
  fs::rename(path, &rotated).map_err(|e| e.to_string())?;
  prune_rotated_logs(parent)?;
  Ok(())
}

fn chrono_like_stamp() -> String {
  // Local time YYYYMMDD-HHMMSS without extra deps.
  use std::time::{SystemTime, UNIX_EPOCH};
  let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  // UTC-ish formatting is fine for rotation names.
  let days = secs / 86400;
  let time_of_day = secs % 86400;
  let hours = time_of_day / 3600;
  let mins = (time_of_day % 3600) / 60;
  let s = time_of_day % 60;
  // Approximate civil date from Unix day (good enough for log names).
  let (y, m, d) = unix_days_to_ymd(days as i64);
  format!("{y:04}{m:02}{d:02}-{hours:02}{mins:02}{s:02}")
}

fn unix_days_to_ymd(mut days: i64) -> (i32, u32, u32) {
  // Algorithm from civil_from_days (Howard Hinnant).
  days += 719468;
  let era = if days >= 0 {
    days
  } else {
    days - 146096
  } / 146097;
  let doe = (days - era * 146097) as u64;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  let y = (yoe as i64) + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let d = doy - (153 * mp + 2) / 5 + 1;
  let m = if mp < 10 { mp + 3 } else { mp - 9 };
  let y = if m <= 2 { y + 1 } else { y };
  (y as i32, m as u32, d as u32)
}

fn prune_rotated_logs(dir: &Path) -> Result<(), String> {
  let mut rotated: Vec<PathBuf> = fs::read_dir(dir)
    .map_err(|e| e.to_string())?
    .flatten()
    .map(|e| e.path())
    .filter(|p| {
      p.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.starts_with("memory-") && n.ends_with(".jsonl"))
        .unwrap_or(false)
    })
    .collect();
  rotated.sort();
  while rotated.len() > MAX_ROTATED_LOGS {
    if let Some(old) = rotated.first().cloned() {
      let _ = fs::remove_file(&old);
      rotated.remove(0);
    } else {
      break;
    }
  }
  Ok(())
}

fn iso_now() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let dur = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default();
  let secs = dur.as_secs();
  let millis = dur.subsec_millis();
  let days = (secs / 86400) as i64;
  let tod = secs % 86400;
  let (y, m, d) = unix_days_to_ymd(days);
  let h = tod / 3600;
  let min = (tod % 3600) / 60;
  let s = tod % 60;
  format!("{y:04}-{m:02}-{d:02}T{h:02}:{min:02}:{s:02}.{millis:03}Z")
}

/// Process + DB session snapshot (no app UI metrics).
#[tauri::command]
pub async fn get_memory_snapshot(
  sessions: State<'_, SessionManager>,
) -> Result<ProcessMemorySnapshot, String> {
  Ok(build_snapshot(&sessions))
}

/// Append one JSONL sample. Frontend supplies UI metrics; process metrics filled here.
#[tauri::command]
pub async fn append_memory_log(
  app: AppHandle,
  sessions: State<'_, SessionManager>,
  main_tabs: u32,
  soft_closed_editors: u32,
  result_tabs: u32,
  result_rows: u32,
  result_est_kb: u32,
  open_table_tabs: u32,
  notes: Option<String>,
) -> Result<MemoryLogLine, String> {
  let process = build_snapshot(&sessions);
  let line = MemoryLogLine {
    ts: iso_now(),
    process,
    main_tabs,
    soft_closed_editors,
    result_tabs,
    result_rows,
    result_est_kb,
    open_table_tabs,
    notes,
  };

  let path = memory_log_path(&app)?;
  rotate_if_needed(&path)?;

  let json = serde_json::to_string(&line).map_err(|e| e.to_string())?;
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&path)
    .map_err(|e| e.to_string())?;
  writeln!(file, "{json}").map_err(|e| e.to_string())?;

  Ok(line)
}

/// Read the last `limit` lines from the memory log (newest last).
#[tauri::command]
pub async fn read_memory_log_tail(
  app: AppHandle,
  limit: Option<u32>,
) -> Result<Vec<MemoryLogLine>, String> {
  let limit = limit.unwrap_or(50).clamp(1, 500) as usize;
  let path = memory_log_path(&app)?;
  if !path.is_file() {
    return Ok(Vec::new());
  }

  let file = fs::File::open(&path).map_err(|e| e.to_string())?;
  let reader = BufReader::new(file);
  let mut ring: std::collections::VecDeque<String> =
    std::collections::VecDeque::with_capacity(limit);
  for line in reader.lines() {
    let line = line.map_err(|e| e.to_string())?;
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }
    if ring.len() == limit {
      ring.pop_front();
    }
    ring.push_back(trimmed.to_string());
  }

  let mut out = Vec::with_capacity(ring.len());
  for raw in ring {
    match serde_json::from_str::<MemoryLogLine>(&raw) {
      Ok(parsed) => out.push(parsed),
      Err(_) => continue,
    }
  }
  Ok(out)
}

#[tauri::command]
pub async fn clear_memory_log(app: AppHandle) -> Result<(), String> {
  let path = memory_log_path(&app)?;
  if path.is_file() {
    fs::remove_file(&path).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
pub async fn open_diagnostics_dir(app: AppHandle) -> Result<String, String> {
  let dir = diagnostics_dir(&app)?;
  let path = path_display(&dir);
  open::that(&dir).map_err(|e| format!("failed to open diagnostics folder: {e}"))?;
  log::info!("Opened diagnostics dir: {path}");
  Ok(path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn unix_days_epoch() {
    // 1970-01-01
    assert_eq!(unix_days_to_ymd(0), (1970, 1, 1));
  }

  #[test]
  fn memory_log_line_roundtrip() {
    let line = MemoryLogLine {
      ts: "2026-07-26T00:00:00.000Z".into(),
      process: ProcessMemorySnapshot {
        duckling_ws_mb: Some(100.0),
        duckling_private_mb: Some(80.0),
        webview_ws_mb: Some(200.0),
        webview_private_mb: Some(150.0),
        webview_count: 2,
        total_ws_mb: Some(300.0),
        total_private_mb: Some(230.0),
        db_sessions: 1,
        pid: 1234,
      },
      main_tabs: 3,
      soft_closed_editors: 1,
      result_tabs: 5,
      result_rows: 2500,
      result_est_kb: 1200,
      open_table_tabs: 2,
      notes: None,
    };
    let json = serde_json::to_string(&line).unwrap();
    let back: MemoryLogLine = serde_json::from_str(&json).unwrap();
    assert_eq!(back.result_tabs, 5);
    assert_eq!(back.process.webview_count, 2);
  }
}
