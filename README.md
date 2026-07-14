# Zpay

Zpay is a **work-in-progress desktop app** that takes a bank statement file and builds an interactive dashboard with graphs, plots, and key financial metrics.

## Current status

🚧 This project is under active development.

What currently exists:
- Upload flow for Excel bank statements (`.xlsx`, `.xls`)
- Statement parsing into account details + transactions
- Conversion to parquet using the Tauri (Rust) backend
- Dashboard route wired with interactive charting tooling

## What the app is intended to do

1. Accept a bank statement file
2. Parse and structure transaction data
3. Generate a dashboard view
4. Let users explore trends through visuals and metrics

## Tech stack

- **Frontend:** React + TypeScript + Vite
- **Desktop runtime:** Tauri
- **Backend (desktop command):** Rust
- **Data parsing:** `xlsx`
- **Visualization:** `@kanaries/graphic-walker`

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

- `/src` – React app (upload, loading, dashboard, parser)
- `/src-tauri` – Tauri/Rust backend and desktop configuration

## Roadmap (WIP)

- Replace sample dashboard data with parsed statement data
- Add derived metrics (spend categories, monthly summaries, cashflow)
- Improve error handling for varied bank statement formats
- Add tests and production hardening

## Notes

This repository is experimental right now; expect frequent changes.
