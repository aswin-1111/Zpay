// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use arrow::array::*;
use arrow::datatypes::*;
use arrow::record_batch::RecordBatch;
use parquet::arrow::ArrowWriter;
use parquet::file::properties::WriterProperties;
use std::collections::HashMap;
use std::fs::File;
use std::sync::Arc;
// use parquet::basic::Compression;
use parquet::file::metadata::KeyValue;
use serde::{Deserialize, Serialize};

use serde_json::json;

mod query_ast;
mod polars_query;

use query_ast::*;
use polars_query::*;

use polars::prelude::LazyFrame;
use polars::prelude::ScanArgsParquet;
use polars::prelude::PlPath;
use polars::prelude::col;


#[derive(Deserialize)]
pub struct Aggregation {
    pub group_by: String,
    pub field: String,
    pub op: String,
}

#[derive(Deserialize)]
pub struct QueryPayload {
    pub query: RuleGroup,
    pub aggregation: Aggregation,
}

#[derive(Serialize)]
pub struct ChartResponse {
    pub x: Vec<String>,
    pub y: Vec<f64>,
}

#[tauri::command]
fn run_polars_query(payload: QueryPayload) -> ChartResponse {
    let lf = LazyFrame::scan_parquet(
        PlPath::new("statement.parquet"),
        ScanArgsParquet::default(),
    )
    .expect("Failed to read parquet");

    let filter_expr = group_to_expr(&payload.query);

    let group_col = payload.aggregation.group_by.as_str();
    let value_col = payload.aggregation.field.as_str();

    let df = lf
        .filter(filter_expr)
        .group_by([col(group_col)])
        .agg([
                col(value_col)
                    .sum()
                    .alias("metric")
            ])
        .sort([group_col], Default::default())
        .collect()
        .expect("Query failed");

    let x = df
        .column(&payload.aggregation.group_by)
        .unwrap()
        .str()
        .unwrap()
        .into_no_null_iter()
        .map(|s| s.to_string())
        .collect();

    println!("{:?}", df.get_column_names());

    let y = df
        .column("metric")
        .unwrap()
        .f64()
        .unwrap()
        .into_no_null_iter()
        .collect();

    ChartResponse { x, y }
}

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

#[tauri::command]
fn save_parquet(data: Statement) -> Result<(), String> {
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

    let file = File::create("statement.parquet").map_err(|e| e.to_string())?;

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

#[tauri::command]
async fn get_guest_token() -> Result<String, String> {

    let superset_url = "http://localhost:8088";
    let superset_api_url = format!("{}/api/v1/security", superset_url);
    let dashboard_id = "95c75743-af17-4127-91d5-6ea06f6b46f1";

    let login_body = json!({
        "password": "admin",
        "provider": "db",
        "refresh": true,
        "username": "admin"
    });

    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| e.to_string())?;

    let response1 = client
        .post(format!("{}/login", superset_api_url))
        .header("Content-Type", "application/json")
        .json(&login_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data1: serde_json::Value = response1.json().await.map_err(|e| e.to_string())?;

    let access_token = data1["access_token"]
        .as_str()
        .ok_or("access_token not found")?
        .to_string();

    let csrf_resp = client
        .get("http://localhost:8088/api/v1/security/csrf_token/")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let csrf_json: serde_json::Value = csrf_resp.json().await.map_err(|e| e.to_string())?;
    let csrf_token = csrf_json["result"]
        .as_str()
        .ok_or("missing csrf token")?
        .to_string();

    let guest_token_body = json!({
        "user": {
            "username": "",
            "first_name": "",
            "last_name": "",
        },
        "resources": [
            {
                "type": "dashboard",
                "id": dashboard_id,
            }
        ],
        "rls": [],
        "type": "guest",
    });

    let response2 = client
        .post(format!("{}/guest_token/", superset_api_url))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-CSRFToken", csrf_token)
        .json(&guest_token_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data2: serde_json::Value = response2.json().await.map_err(|e| e.to_string())?;
    let token = data2["token"]
        .as_str()
        .ok_or("token not found")?
        .to_string();

    Ok(token.to_string())
}

// #[tauri::command]
// async fn create_embedded_dashboard() -> Result<String, String> {
//     let client = Client::builder()
//         .cookie_store(true)
//         .build()
//         .map_err(|e| e.to_string())?;

//     let (access_token, csrf) = login_and_csrf(&client).await?;

//     // create dashboard
//     let dash_resp = client
//         .post("http://localhost:8088/api/v1/dashboard/")
//         .bearer_auth(&access_token)
//         .header("X-CSRFToken", &csrf)
//         .json(&json!({
//             "dashboard_title": "Tauri Embedded Dashboard",
//             "position_json": "{}",
//             "published": true
//         }))
//         .send()
//         .await
//         .map_err(|e| e.to_string())?;

//     let dash_json: serde_json::Value = dash_resp.json().await.map_err(|e| e.to_string())?;
//     let dashboard_id = dash_json["id"]
//         .as_i64()
//         .ok_or("missing dashboard id")?;

//     // enable embedding
//     let embed_resp = client
//         .post(format!(
//             "http://localhost:8088/api/v1/dashboard/{}/embedded",
//             dashboard_id
//         ))
//         .bearer_auth(&access_token)
//         .header("X-CSRFToken", &csrf)
//         .json(&json!({
//             "allowed_domains": ["*"]
//         }))
//         .send()
//         .await
//         .map_err(|e| e.to_string())?;

//     let embed_json: serde_json::Value = embed_resp.json().await.map_err(|e| e.to_string())?;

//     let embedded_uuid = embed_json["result"]["uuid"]
//         .as_str()
//         .ok_or("missing embedded uuid")?;

//     Ok(embedded_uuid.to_string())
// }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // .setup(|app| {
        //     if let Some(window) = app.get_webview_window("main") {
        //         let _ = window.set_size(tauri::LogicalSize::new(1200.0, 800.0));
        //         let _ = window.set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)));
        //     }
        //     Ok(())
        // })
        .invoke_handler(tauri::generate_handler![save_parquet, run_polars_query, get_guest_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
