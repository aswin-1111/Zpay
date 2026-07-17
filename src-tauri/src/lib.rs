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
use std::sync::Arc;
use parquet::file::metadata::KeyValue;
use serde::{Deserialize, Serialize};
use tauri::Manager;

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

#[tauri::command]
fn load_parquet() -> Result<Statement, String> {
    let file = File::open("statement.parquet").map_err(|e| e.to_string())?;
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
fn export_dashboard_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_dashboard_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_parquet,
            load_parquet,
            save_dashboards,
            load_dashboards,
            export_dashboard_file,
            import_dashboard_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
