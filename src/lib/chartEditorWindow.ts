import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const CHART_EDITOR_LABEL = "chart-editor";

export async function openChartEditorWindow(
  dashboardId: string,
  panelId: string,
  title: string
) {
  const existing = await WebviewWindow.getByLabel(CHART_EDITOR_LABEL);
  if (existing) {
    await existing.close();
  }

  const params = new URLSearchParams({ editor: "chart", dashboardId, panelId });

  new WebviewWindow(CHART_EDITOR_LABEL, {
    url: `index.html?${params.toString()}`,
    title: `Edit chart — ${title}`,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  });
}
