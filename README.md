# Zpay

Zpay is a Tauri desktop app that converts bank statement Excel files into reusable, interactive analytics dashboards.

## What the app does today

- Upload and process bank statement files (`.xlsx`, `.xls`)
- Parse account metadata and transaction rows from the sheet
- Save parsed statements through the Tauri backend for later reuse
- Open a **Saved statements** window to browse, reopen, and delete stored statements
- Launch a dashboard workspace for a selected statement
- Show account-level KPI summaries (balance, credits, debits, net flow, average transaction, busiest day)
- Manage multiple dashboards per statement (create, rename, switch, delete)
- Edit dashboard layouts (add, move, resize, duplicate, remove panels)
- Build chart panels in a dedicated full-window chart editor
- Add KPI and markdown/text panels
- Import/export dashboard definitions (`.zpaydash` / `.json`)
- Autosave dashboard collections locally

## App flow

1. Upload an Excel statement file
2. Parse account + transaction data in the frontend
3. Persist the parsed statement via Tauri commands
4. Open dashboards for the new statement (or reopen from Saved statements)
5. Build and manage visual dashboards

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite
- **Desktop runtime:** Tauri 2
- **Backend layer:** Rust commands exposed through Tauri
- **Data parsing:** `xlsx`
- **Visualization:** `@kanaries/graphic-walker`
- **State management:** `zustand`

## Getting started

### Prerequisites

- Node.js and npm
- Rust toolchain
- Tauri prerequisites for your OS

### Install dependencies

```bash
npm install
```

### Run the desktop app in development

```bash
npm run tauri dev
```

### Build the frontend bundle

```bash
npm run build
```

### Build the desktop app package

```bash
npm run tauri build
```

## Project structure

- `/src` - main React app (upload, loading, dashboard, and secondary windows)
- `/src/components/dashboard` - dashboard toolbar, grid, panels, and sidebar widgets
- `/src/store` - statement and dashboard state management
- `/src/data` - statement loading, enrichment, and summary utilities
- `/src-tauri` - Rust/Tauri backend commands and desktop configuration
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
