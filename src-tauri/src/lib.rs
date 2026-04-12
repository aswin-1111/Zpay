// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use arrow::array::*;
use arrow::datatypes::*;
use arrow::record_batch::RecordBatch;
use parquet::arrow::ArrowWriter;
use parquet::file::properties::WriterProperties;
use std::collections::HashMap;
use std::fs::File;
use std::sync::Arc;
use parquet::file::metadata::KeyValue;
use serde::{Deserialize, Serialize};

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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_parquet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
