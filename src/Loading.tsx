import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocation, useNavigate } from "react-router-dom";

import "./App.css";
import * as XLSX from "xlsx";


<div className="loader"></div>
function Loader() {
    const navigate = useNavigate();
    const location = useLocation();
    const file = location.state?.file as File | undefined;

    useEffect(() => {
        if (!file) {
            navigate("/");
            return;
        }

        const processFile = async () => {
            try {
                const parsed = await parseBankStatement(file);

                await invoke("save_parquet", {
                    data: parsed,
                });

                navigate("/dashboard");
            } catch (err) {
                console.error(err);
                navigate("/dashboard");
            }
        };

        processFile();
    }, [file, navigate]);
  
    return (
        <div className="loader"></div>
    );
}


export default Loader;


export type AccountDetails = {
  accountName: string;
  address: string;
  statementDate: Date | null;
  accountNumber: string;
  accountDescription: string;
  branch: string;
  drawingPower: number;
  interestRate: number;
  modBalance: number;
  cif: string;
  ifsc: string;
  micr: string;
  nomination: string;
  openingBalance: number;
  startDate: Date | null;
  endDate: Date | null;
};

export type Transaction = {
  txnDate: Date | null;
  valueDate: Date | null;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
};

function excelDate(value: unknown): Date | null {
  if (typeof value !== "number") return null;

  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;

  return new Date(
    Date.UTC(parsed.y, parsed.m - 1, parsed.d)
  );
}

function cellString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function cellNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function parseAccountDetailsByOrder(
  rows: (string | number | null)[][]
): { details: AccountDetails; txnHeaderIndex: number } {
  let i = 0;

  const accountName = cellString(rows[i++][1]);

  // Address = next 4 rows
  const address = [
    rows[i++][1],
    rows[i++][1],
    rows[i++][1],
    rows[i++][1],
  ]
    .filter(Boolean)
    .map(cellString)
    .join(", ");

  const statementDate = excelDate(rows[i++][1]);
  const accountNumber = cellString(rows[i++][1]);
  const accountDescription = cellString(rows[i++][1]);
  const branch = cellString(rows[i++][1]);
  const drawingPower = cellNumber(rows[i++][1]);
  const interestRate = cellNumber(rows[i++][1]);
  const modBalance = cellNumber(rows[i++][1]);
  const cif = cellString(rows[i++][1]);
  const ifsc = cellString(rows[i++][1]);

  i++; // CKYCR row (empty)

  const micr = cellString(rows[i++][1]);
  const nomination = cellString(rows[i++][1]);
  const openingBalance = cellNumber(rows[i++][1]);
  const startDate = excelDate(rows[i++][1]);
  const endDate = excelDate(rows[i++][1]);

  // Safety check
  if (rows[i][0] !== "Txn Date") {
    throw new Error("Unexpected statement format: Txn Date header not found");
  }

  return {
    details: {
      accountName,
      address,
      statementDate,
      accountNumber,
      accountDescription,
      branch,
      drawingPower,
      interestRate,
      modBalance,
      cif,
      ifsc,
      micr,
      nomination,
      openingBalance,
      startDate,
      endDate,
    },
    txnHeaderIndex: i,
  };
}

/* =======================
   Transactions Parser
======================= */

function parseTransactions(
  rows: (string | number | null)[][],
  headerIndex: number
): Transaction[] {
  const transactions: Transaction[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;

    transactions.push({
      txnDate: excelDate(row[0]),
      valueDate: excelDate(row[1]),
      description: cellString(row[2]),
      reference: cellString(row[3]),
      debit: cellNumber(row[4]),
      credit: cellNumber(row[5]),
      balance: cellNumber(row[6]),
    });
  }

  return transactions;
}

/* =======================
   Public API
======================= */

export async function parseBankStatement(file: File): Promise<{
  account: AccountDetails;
  transactions: Transaction[];
}> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][];

  console.log(rows);

  const { details, txnHeaderIndex } =
    parseAccountDetailsByOrder(rows);

  const transactions = parseTransactions(rows, txnHeaderIndex);

  return {
    account: details,
    transactions,
  };
}
