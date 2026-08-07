// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use arrow::array::*;
use arrow::datatypes::*;
use arrow::record_batch::RecordBatch;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::ArrowWriter;
use parquet::file::properties::WriterProperties;
use std::collections::HashMap;
use std::fs::File;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parquet::file::metadata::KeyValue;
use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountDetails {
    account_name: String,
    address: String,
    statement_date: Option<String>,
    account_number: String,
    account_description: String,
    branch: String,
    drawing_power: f64,
    interest_rate: f64,
    mod_balance: f64,
    cif: String,
    ifsc: String,
    micr: String,
    nomination: String,
    opening_balance: f64,
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Transaction {
    txn_date: Option<String>,
    value_date: Option<String>,
    description: String,
    reference: String,
    debit: f64,
    credit: f64,
    balance: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Statement {
    account: AccountDetails,
    transactions: Vec<Transaction>,
}

fn write_statement_parquet(path: &Path, data: &Statement) -> Result<(), String> {
    let schema = Arc::new(Schema::new(vec![
        Field::new("txn_date", DataType::Utf8, true),
        Field::new("value_date", DataType::Utf8, true),
        Field::new("description", DataType::Utf8, false),
        Field::new("reference", DataType::Utf8, false),
        Field::new("debit", DataType::Float64, false),
        Field::new("credit", DataType::Float64, false),
        Field::new("balance", DataType::Float64, false),
    ]));

    let batch = RecordBatch::try_new(
        schema.clone(),
        vec![
            Arc::new(StringArray::from(
                data.transactions
                    .iter()
                    .map(|t| t.txn_date.clone())
                    .collect::<Vec<_>>(),
            )),
            Arc::new(StringArray::from(
                data.transactions
                    .iter()
                    .map(|t| t.value_date.clone())
                    .collect::<Vec<_>>(),
            )),
            Arc::new(StringArray::from(
                data.transactions
                    .iter()
                    .map(|t| t.description.clone())
                    .collect::<Vec<_>>(),
            )),
            Arc::new(StringArray::from(
                data.transactions
                    .iter()
                    .map(|t| t.reference.clone())
                    .collect::<Vec<_>>(),
            )),
            Arc::new(Float64Array::from(
                data.transactions
                    .iter()
                    .map(|t| t.debit)
                    .collect::<Vec<_>>(),
            )),
            Arc::new(Float64Array::from(
                data.transactions
                    .iter()
                    .map(|t| t.credit)
                    .collect::<Vec<_>>(),
            )),
            Arc::new(Float64Array::from(
                data.transactions
                    .iter()
                    .map(|t| t.balance)
                    .collect::<Vec<_>>(),
            )),
        ],
    )
    .map_err(|e| e.to_string())?;

    let file = File::create(path).map_err(|e| e.to_string())?;

    let metadata = account_to_metadata(&data.account);

    let key_value_metadata: Vec<KeyValue> = metadata
        .into_iter()
        .map(|(k, v)| KeyValue {
            key: k,
            value: Some(v),
        })
        .collect();

    let props = WriterProperties::builder()
        // .set_compression(Compression::ZSTD)
        .set_key_value_metadata(Some(key_value_metadata))
        .build();

    let mut writer = ArrowWriter::try_new(file, schema, Some(props)).map_err(|e| e.to_string())?;

    writer.write(&batch).map_err(|e| e.to_string())?;
    writer.close().map_err(|e| e.to_string())?;

    Ok(())
}

fn metadata_to_account(meta: &HashMap<String, String>) -> AccountDetails {
    let get = |k: &str| meta.get(k).cloned().unwrap_or_default();
    let get_opt = |k: &str| meta.get(k).cloned().filter(|s| !s.is_empty());
    let get_f64 = |k: &str| meta.get(k).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);

    AccountDetails {
        account_name: get("account_name"),
        address: get("address"),
        statement_date: get_opt("statement_date"),
        account_number: get("account_number"),
        account_description: get("account_description"),
        branch: get("branch"),
        drawing_power: get_f64("drawing_power"),
        interest_rate: get_f64("interest_rate"),
        mod_balance: get_f64("mod_balance"),
        cif: get("cif"),
        ifsc: get("ifsc"),
        micr: get("micr"),
        nomination: get("nomination"),
        opening_balance: get_f64("opening_balance"),
        start_date: get_opt("start_date"),
        end_date: get_opt("end_date"),
    }
}

fn read_statement_parquet(path: &Path) -> Result<Statement, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let builder = ParquetRecordBatchReaderBuilder::try_new(file).map_err(|e| e.to_string())?;

    let mut meta_map: HashMap<String, String> = HashMap::new();
    if let Some(kv_metadata) = builder.metadata().file_metadata().key_value_metadata() {
        for kv in kv_metadata {
            if let Some(value) = &kv.value {
                meta_map.insert(kv.key.clone(), value.clone());
            }
        }
    }
    let account = metadata_to_account(&meta_map);

    let reader = builder.build().map_err(|e| e.to_string())?;

    let mut transactions = Vec::new();

    for batch_result in reader {
        let batch = batch_result.map_err(|e| e.to_string())?;

        let txn_date = batch
            .column(0)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or("statement.parquet: unexpected type for txn_date column")?;
        let value_date = batch
            .column(1)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or("statement.parquet: unexpected type for value_date column")?;
        let description = batch
            .column(2)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or("statement.parquet: unexpected type for description column")?;
        let reference = batch
            .column(3)
            .as_any()
            .downcast_ref::<StringArray>()
            .ok_or("statement.parquet: unexpected type for reference column")?;
        let debit = batch
            .column(4)
            .as_any()
            .downcast_ref::<Float64Array>()
            .ok_or("statement.parquet: unexpected type for debit column")?;
        let credit = batch
            .column(5)
            .as_any()
            .downcast_ref::<Float64Array>()
            .ok_or("statement.parquet: unexpected type for credit column")?;
        let balance = batch
            .column(6)
            .as_any()
            .downcast_ref::<Float64Array>()
            .ok_or("statement.parquet: unexpected type for balance column")?;

        for i in 0..batch.num_rows() {
            transactions.push(Transaction {
                txn_date: (!txn_date.is_null(i)).then(|| txn_date.value(i).to_string()),
                value_date: (!value_date.is_null(i)).then(|| value_date.value(i).to_string()),
                description: description.value(i).to_string(),
                reference: reference.value(i).to_string(),
                debit: debit.value(i),
                credit: credit.value(i),
                balance: balance.value(i),
            });
        }
    }

    Ok(Statement {
        account,
        transactions,
    })
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StatementSummary {
    id: String,
    original_file_name: String,
    saved_at: String,
    account_name: String,
    account_number_masked: String,
    branch: String,
    start_date: Option<String>,
    end_date: Option<String>,
    transaction_count: usize,
}

fn mask_account_number(account_number: &str) -> String {
    let trimmed = account_number.trim();
    let last4: String = trimmed.chars().rev().take(4).collect::<String>().chars().rev().collect();
    if last4.is_empty() {
        "••••".to_string()
    } else {
        format!("•••• {}", last4)
    }
}

fn statements_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("statements");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn statements_index_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("statements_index.json"))
}

fn read_statements_index(app: &tauri::AppHandle) -> Result<Vec<StatementSummary>, String> {
    let path = statements_index_path(app)?;
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).map_err(|e| e.to_string()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(e.to_string()),
    }
}

fn write_statements_index(app: &tauri::AppHandle, summaries: &[StatementSummary]) -> Result<(), String> {
    let path = statements_index_path(app)?;
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let contents = serde_json::to_string(summaries).map_err(|e| e.to_string())?;
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

fn summarize_statement(id: &str, original_file_name: &str, saved_at: &str, data: &Statement) -> StatementSummary {
    StatementSummary {
        id: id.to_string(),
        original_file_name: original_file_name.to_string(),
        saved_at: saved_at.to_string(),
        account_name: data.account.account_name.clone(),
        account_number_masked: mask_account_number(&data.account.account_number),
        branch: data.account.branch.clone(),
        start_date: data.account.start_date.clone(),
        end_date: data.account.end_date.clone(),
        transaction_count: data.transactions.len(),
    }
}

#[tauri::command]
fn save_statement(
    app: tauri::AppHandle,
    data: Statement,
    id: String,
    original_file_name: String,
    saved_at: String,
) -> Result<(), String> {
    let path = statements_dir(&app)?.join(format!("{id}.parquet"));
    write_statement_parquet(&path, &data)?;

    let summary = summarize_statement(&id, &original_file_name, &saved_at, &data);
    let mut summaries = read_statements_index(&app)?;
    summaries.retain(|s| s.id != id);
    summaries.push(summary);
    write_statements_index(&app, &summaries)
}

#[tauri::command]
fn load_statement(app: tauri::AppHandle, id: String) -> Result<Statement, String> {
    let path = statements_dir(&app)?.join(format!("{id}.parquet"));
    read_statement_parquet(&path)
}

// One-time migration: earlier builds of this app wrote a single `statement.parquet`
// at a fixed path (relative to the process's working directory) and overwrote it on
// every upload. If a user already has one from before multi-statement support existed,
// import it once as a "legacy" entry so it isn't silently lost.
fn migrate_legacy_statement(app: &tauri::AppHandle) -> Result<(), String> {
    let legacy_source = Path::new("statement.parquet");
    if !legacy_source.exists() {
        return Ok(());
    }
    let legacy_dest = statements_dir(app)?.join("legacy.parquet");
    if legacy_dest.exists() {
        return Ok(());
    }

    let data = read_statement_parquet(legacy_source)?;
    std::fs::copy(legacy_source, &legacy_dest).map_err(|e| e.to_string())?;

    let summary = summarize_statement("legacy", "Legacy statement", &data.account.statement_date.clone().unwrap_or_default(), &data);
    let mut summaries = read_statements_index(app)?;
    summaries.retain(|s| s.id != "legacy");
    summaries.push(summary);
    write_statements_index(app, &summaries)
}

#[tauri::command]
fn list_statements(app: tauri::AppHandle) -> Result<Vec<StatementSummary>, String> {
    if statements_index_path(&app)?.exists() == false {
        migrate_legacy_statement(&app)?;
    }
    let mut summaries = read_statements_index(&app)?;
    summaries.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(summaries)
}

#[tauri::command]
fn delete_statement(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let path = statements_dir(&app)?.join(format!("{id}.parquet"));
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    let mut summaries = read_statements_index(&app)?;
    summaries.retain(|s| s.id != id);
    write_statements_index(&app, &summaries)
}

#[tauri::command]
fn save_dashboards(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("dashboards.json"), contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_dashboards(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    match std::fs::read_to_string(dir.join("dashboards.json")) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_default_dashboard_template(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("default_dashboard_template.json"), contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_default_dashboard_template(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    match std::fs::read_to_string(dir.join("default_dashboard_template.json")) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn export_dashboard_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_dashboard_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

// AI chart assistant — opt-in, bring-your-own API key. The frontend never sends
// transaction rows here, only the field schema (fid/name/semanticType) plus the
// user's free-text prompt; see src/lib/aiChartSpec.ts for how the (narrow,
// fully-validated) response is turned into a real chart.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiSettings {
    provider: String,
    api_key: String,
    base_url: Option<String>,
    model: String,
}

// Sent to the frontend in place of AiSettings — never includes the real key.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiSettingsPublic {
    provider: String,
    base_url: Option<String>,
    model: String,
    has_key: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiFieldInfo {
    fid: String,
    name: String,
    semantic_type: String,
}

fn ai_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai_settings.json"))
}

fn read_ai_settings(app: &tauri::AppHandle) -> Result<Option<AiSettings>, String> {
    match std::fs::read_to_string(ai_settings_path(app)?) {
        Ok(contents) => serde_json::from_str(&contents).map(Some).map_err(|e| e.to_string()),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn load_ai_settings_public(app: tauri::AppHandle) -> Result<Option<AiSettingsPublic>, String> {
    let settings = read_ai_settings(&app)?;
    Ok(settings.map(|s| AiSettingsPublic {
        provider: s.provider,
        base_url: s.base_url,
        model: s.model,
        has_key: !s.api_key.is_empty(),
    }))
}

#[tauri::command]
fn save_ai_settings(
    app: tauri::AppHandle,
    provider: String,
    api_key: Option<String>,
    base_url: Option<String>,
    model: String,
) -> Result<(), String> {
    // An empty/absent api_key means "keep whatever key is already saved" — the
    // settings window never re-displays the real key, so re-saving provider/model
    // shouldn't force the user to paste the key in again.
    let existing_key = read_ai_settings(&app)?.map(|s| s.api_key).unwrap_or_default();
    let resolved_key = api_key.filter(|k| !k.is_empty()).unwrap_or(existing_key);

    let settings = AiSettings {
        provider,
        api_key: resolved_key,
        base_url,
        model,
    };
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let contents = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    std::fs::write(ai_settings_path(&app)?, contents).map_err(|e| e.to_string())
}

fn build_ai_system_prompt(fields: &[AiFieldInfo]) -> String {
    let field_list = fields
        .iter()
        .map(|f| format!("- {} (\"{}\", type: {})", f.fid, f.name, f.semantic_type))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "You are a charting assistant for a personal-finance dashboard app. Given a user's request, respond with ONLY a single JSON object (no prose, no markdown code fences) describing a chart, using this exact shape:\n\
{{\n\
  \"name\": string (a short chart title),\n\
  \"geoms\": array containing exactly one of: \"bar\", \"line\", \"area\", \"point\", \"arc\",\n\
  \"columns\": array of {{\"fid\": string, \"aggName\"?: string}} (x-axis / category fields),\n\
  \"rows\": array of {{\"fid\": string, \"aggName\"?: string}} (y-axis / measure fields),\n\
  \"color\"?: array of {{\"fid\": string}} (optional color/series split),\n\
  \"theta\"?: array of {{\"fid\": string, \"aggName\"?: string}} (only for \"arc\"/pie charts, the measure being split)\n\
}}\n\
\n\
Only use these exact field ids (fid) — never invent one:\n\
{field_list}\n\
- gw_count_fid (\"Count\", type: quantitative) — use this as a row/theta field with aggName \"count\" when the user wants to count records rather than sum a real column.\n\
\n\
Rules:\n\
- Every field reference must use one of the fid values listed above, verbatim.\n\
- aggName, when present, must be one of: sum, mean, count, max, min, median.\n\
- Only include \"color\" if it meaningfully splits the data (e.g. by Debit/Credit type).\n\
- Only include \"theta\" when geoms is [\"arc\"]; otherwise omit it.\n\
- Respond with the JSON object and nothing else."
    )
}

async fn call_openai_for_chart(
    settings: &AiSettings,
    system_prompt: &str,
    prompt: &str,
) -> Result<String, String> {
    let base = settings
        .base_url
        .clone()
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": settings.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(&settings.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request to OpenAI failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI returned {status}: {text}"));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Could not parse OpenAI's response: {e}"))?;

    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "OpenAI's response did not contain any message content.".to_string())
}

async fn call_anthropic_for_chart(
    settings: &AiSettings,
    system_prompt: &str,
    prompt: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": settings.model,
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": prompt},
        ],
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &settings.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request to Anthropic failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic returned {status}: {text}"));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Could not parse Anthropic's response: {e}"))?;

    json["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Anthropic's response did not contain any text content.".to_string())
}

#[tauri::command]
async fn ask_ai_for_chart(
    app: tauri::AppHandle,
    prompt: String,
    fields: Vec<AiFieldInfo>,
) -> Result<String, String> {
    let settings = read_ai_settings(&app)?.ok_or_else(|| {
        "AI isn't configured yet — use the app menu → AI Assistant → Configure API Key… first."
            .to_string()
    })?;

    let system_prompt = build_ai_system_prompt(&fields);

    match settings.provider.as_str() {
        "openai" => call_openai_for_chart(&settings, &system_prompt, &prompt).await,
        "anthropic" => call_anthropic_for_chart(&settings, &system_prompt, &prompt).await,
        other => Err(format!("Unknown AI provider: {other}")),
    }
}

fn account_to_metadata(account: &AccountDetails) -> HashMap<String, String> {
    let mut meta = HashMap::new();

    meta.insert("account_name".into(), account.account_name.clone());
    meta.insert("address".into(), account.address.clone());
    meta.insert("account_number".into(), account.account_number.clone());
    meta.insert(
        "account_description".into(),
        account.account_description.clone(),
    );
    meta.insert("branch".into(), account.branch.clone());
    meta.insert("cif".into(), account.cif.clone());
    meta.insert("ifsc".into(), account.ifsc.clone());
    meta.insert("micr".into(), account.micr.clone());
    meta.insert("nomination".into(), account.nomination.clone());

    meta.insert(
        "statement_date".into(),
        account.statement_date.clone().unwrap_or_default(),
    );
    meta.insert(
        "start_date".into(),
        account.start_date.clone().unwrap_or_default(),
    );
    meta.insert(
        "end_date".into(),
        account.end_date.clone().unwrap_or_default(),
    );

    meta.insert("interest_rate".into(), account.interest_rate.to_string());
    meta.insert(
        "opening_balance".into(),
        account.opening_balance.to_string(),
    );

    meta
}


const DEFAULT_DASHBOARD_EDITOR_LABEL: &str = "default-dashboard-editor";
const EDIT_DEFAULT_DASHBOARD_MENU_ID: &str = "edit-default-dashboard";

// Opens (or focuses, if already open) the window that lets the user customize the
// panels/chart types every new statement's default dashboard is seeded with.
fn open_default_dashboard_editor(app: &tauri::AppHandle) {
    if let Some(existing) = app.get_webview_window(DEFAULT_DASHBOARD_EDITOR_LABEL) {
        let _ = existing.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(
        app,
        DEFAULT_DASHBOARD_EDITOR_LABEL,
        WebviewUrl::App("index.html?window=default-dashboard-editor".into()),
    )
    .title("Edit Default Dashboard")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .build();
}

// Light/dark/system theme, toggled from the native "View" menu only (no in-app
// control). The menu is the source of truth, not localStorage or frontend
// state — its own checked state has to reflect the current preference at every
// app launch, before any webview has run a line of JS.
#[derive(Serialize, Deserialize)]
struct ThemePreference {
    theme: String,
}

fn theme_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("theme.json"))
}

fn read_theme_preference(app: &tauri::AppHandle) -> Result<String, String> {
    match std::fs::read_to_string(theme_path(app)?) {
        Ok(contents) => {
            let pref: ThemePreference =
                serde_json::from_str(&contents).map_err(|e| e.to_string())?;
            Ok(pref.theme)
        }
        Err(e) if e.kind() == ErrorKind::NotFound => Ok("system".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn write_theme_preference(app: &tauri::AppHandle, theme: &str) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let contents = serde_json::to_string(&ThemePreference {
        theme: theme.to_string(),
    })
    .map_err(|e| e.to_string())?;
    std::fs::write(theme_path(app)?, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_theme_preference(app: tauri::AppHandle) -> Result<String, String> {
    read_theme_preference(&app)
}

struct ThemeMenuItems {
    system: tauri::menu::CheckMenuItem<tauri::Wry>,
    light: tauri::menu::CheckMenuItem<tauri::Wry>,
    dark: tauri::menu::CheckMenuItem<tauri::Wry>,
}

const THEME_SYSTEM_MENU_ID: &str = "theme-system";
const THEME_LIGHT_MENU_ID: &str = "theme-light";
const THEME_DARK_MENU_ID: &str = "theme-dark";

// Checks exactly the item matching `theme`, persists the choice, and notifies
// every open window (main + any chart-editor/statements/etc. windows) so they
// repaint immediately instead of only on next launch.
fn apply_theme_preference(app: &tauri::AppHandle, theme: &str) {
    if let Some(items) = app.try_state::<ThemeMenuItems>() {
        let _ = items.system.set_checked(theme == "system");
        let _ = items.light.set_checked(theme == "light");
        let _ = items.dark.set_checked(theme == "dark");
    }
    let _ = write_theme_preference(app, theme);
    let _ = app.emit("zpay://theme-changed", theme);
}

const AI_SETTINGS_LABEL: &str = "ai-settings";
const CONFIGURE_AI_MENU_ID: &str = "configure-ai-key";

// Opens (or focuses, if already open) the AI-assistant settings window.
fn open_ai_settings(app: &tauri::AppHandle) {
    if let Some(existing) = app.get_webview_window(AI_SETTINGS_LABEL) {
        let _ = existing.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(
        app,
        AI_SETTINGS_LABEL,
        WebviewUrl::App("index.html?window=ai-settings".into()),
    )
    .title("AI Assistant Settings")
    .inner_size(560.0, 620.0)
    .min_inner_size(420.0, 480.0)
    .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();
            let menu = Menu::default(handle)?;
            let edit_default_dashboard_item = MenuItem::with_id(
                handle,
                EDIT_DEFAULT_DASHBOARD_MENU_ID,
                "Edit Default Dashboard…",
                true,
                None::<&str>,
            )?;
            let dashboard_menu =
                Submenu::with_items(handle, "Dashboard", true, &[&edit_default_dashboard_item])?;
            menu.append(&dashboard_menu)?;

            let configure_ai_item = MenuItem::with_id(
                handle,
                CONFIGURE_AI_MENU_ID,
                "Configure API Key…",
                true,
                None::<&str>,
            )?;
            let ai_menu = Submenu::with_items(handle, "AI Assistant", true, &[&configure_ai_item])?;
            menu.append(&ai_menu)?;

            let current_theme = read_theme_preference(handle).unwrap_or_else(|_| "system".to_string());
            let theme_system_item = tauri::menu::CheckMenuItem::with_id(
                handle,
                THEME_SYSTEM_MENU_ID,
                "System",
                true,
                current_theme == "system",
                None::<&str>,
            )?;
            let theme_light_item = tauri::menu::CheckMenuItem::with_id(
                handle,
                THEME_LIGHT_MENU_ID,
                "Light",
                true,
                current_theme == "light",
                None::<&str>,
            )?;
            let theme_dark_item = tauri::menu::CheckMenuItem::with_id(
                handle,
                THEME_DARK_MENU_ID,
                "Dark",
                true,
                current_theme == "dark",
                None::<&str>,
            )?;
            let view_menu = Submenu::with_items(
                handle,
                "View",
                true,
                &[&theme_system_item, &theme_light_item, &theme_dark_item],
            )?;
            menu.append(&view_menu)?;
            app.manage(ThemeMenuItems {
                system: theme_system_item,
                light: theme_light_item,
                dark: theme_dark_item,
            });

            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app_handle, event| {
            if event.id() == EDIT_DEFAULT_DASHBOARD_MENU_ID {
                open_default_dashboard_editor(app_handle);
            } else if event.id() == CONFIGURE_AI_MENU_ID {
                open_ai_settings(app_handle);
            } else if event.id() == THEME_SYSTEM_MENU_ID {
                apply_theme_preference(app_handle, "system");
            } else if event.id() == THEME_LIGHT_MENU_ID {
                apply_theme_preference(app_handle, "light");
            } else if event.id() == THEME_DARK_MENU_ID {
                apply_theme_preference(app_handle, "dark");
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_statement,
            load_statement,
            list_statements,
            delete_statement,
            save_dashboards,
            load_dashboards,
            save_default_dashboard_template,
            load_default_dashboard_template,
            export_dashboard_file,
            import_dashboard_file,
            load_ai_settings_public,
            save_ai_settings,
            ask_ai_for_chart,
            load_theme_preference
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
