# Zpay

Zpay is a desktop app for turning bank statement Excel files into interactive, reusable dashboards.

## Current status

🚧 This project is under active development.

### Available functionality

- Upload and process bank statement files (`.xlsx`, `.xls`)
- Parse account details and transaction rows from statement sheets
- Persist parsed statement data as parquet via the Tauri (Rust) backend
- Open a full dashboard workspace for the latest processed statement
- View account summary KPIs (current balance, debits, credits, net flow, average transaction, most active day)
- Create multiple dashboards per statement and switch between them
- Rename, create, and delete dashboards
- Add, edit, duplicate, resize, drag, and delete panels in edit mode
- Build visual chart panels with a dedicated chart editor window
- Add KPI and markdown text panels
- Import/export dashboards as `.zpaydash`/`.json` files
- Autosave dashboard collections locally

## App flow

1. Upload a bank statement file
2. Parse and structure account + transaction data
3. Save parsed data for desktop-side reads
4. Open or create dashboards and explore data visually

## Tech stack

- **Frontend:** React + TypeScript + Vite
- **Desktop runtime:** Tauri
- **Backend (desktop command):** Rust
- **Data parsing:** `xlsx`
- **Visualization:** `@kanaries/graphic-walker`
- **State management:** `zustand`

## Getting started

### Prerequisites

- Node.js + npm
- Rust toolchain (for Tauri)
- Tauri system dependencies for your OS

### Install

```bash
npm install
```

### Run in development

```bash
npm run tauri dev
```

### Build frontend

```bash
npm run build
```

## Project structure

- `/src` – React app (upload flow, parser, loading flow, dashboard workspace)
- `/src/components/dashboard` – dashboard UI, toolbar, grid and panel types
- `/src/store` – dashboard editing and autosave state
- `/src-tauri` – Tauri/Rust backend and desktop configuration

## Notes

This repository is still evolving quickly; expect frequent changes.
