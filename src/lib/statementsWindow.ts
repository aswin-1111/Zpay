import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const STATEMENTS_WINDOW_LABEL = "statements";

export async function openSavedStatementsWindow() {
  const existing = await WebviewWindow.getByLabel(STATEMENTS_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  new WebviewWindow(STATEMENTS_WINDOW_LABEL, {
    url: "index.html?window=statements",
    title: "Saved statements",
    width: 900,
    height: 600,
    minWidth: 640,
    minHeight: 420,
  });
}
