import { useState } from "react";
import { GraphicRenderer } from "@kanaries/graphic-walker";
import type { PanelSpec } from "../../types/dashboard";
import { useDashboardStore } from "../../store/dashboardStore";
import { useThemeStore } from "../../store/themeStore";
import { useDashboardData } from "../../context/DashboardDataContext";
import { openChartEditorWindow } from "../../lib/chartEditorWindow";
import { zpayGwUiTheme } from "../../theme/graphicWalkerTheme";
import KpiPanel from "./KpiPanel";
import TextPanel from "./TextPanel";
import InsightsPanel from "./InsightsPanel";

export default function Panel({
  panel,
  dashboardId,
}: {
  panel: PanelSpec;
  dashboardId: string;
}) {
  const { data, fields } = useDashboardData();
  const theme = useThemeStore((s) => s.resolved);
  const editMode = useDashboardStore((s) => s.editMode);
  const updatePanelTitle = useDashboardStore((s) => s.updatePanelTitle);
  const updatePanelConfig = useDashboardStore((s) => s.updatePanelConfig);
  const duplicatePanel = useDashboardStore((s) => s.duplicatePanel);
  const deletePanel = useDashboardStore((s) => s.deletePanel);
  const [titleDraft, setTitleDraft] = useState(panel.title);

  return (
    <div className="panel">
      <div className={`panel-header ${editMode ? "panel-drag-handle" : ""}`}>
        {editMode ? (
          <input
            className="panel-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (titleDraft !== panel.title) updatePanelTitle(panel.id, titleDraft);
            }}
          />
        ) : (
          <div className="panel-title-text">{panel.title}</div>
        )}
        {editMode && (
          <div className="panel-header-actions">
            {panel.config.kind === "chart" && (
              <button
                className="btn btn-icon"
                onClick={() =>
                  openChartEditorWindow(dashboardId, panel.id, panel.title)
                }
              >
                Edit
              </button>
            )}
            <button className="btn btn-icon" onClick={() => duplicatePanel(panel.id)}>
              Duplicate
            </button>
            <button
              className="btn btn-icon btn-danger"
              onClick={() => deletePanel(panel.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="panel-body">
        {panel.config.kind === "chart" &&
          (panel.config.chart ? (
            <GraphicRenderer
              chart={[panel.config.chart]}
              data={data}
              fields={fields}
              appearance={theme}
              uiTheme={zpayGwUiTheme}
              keepAlive={false}
              containerStyle={{ height: "100%" }}
            />
          ) : (
            <div className="panel-placeholder">
              {editMode ? "Click Edit to configure this chart" : "Chart not configured"}
            </div>
          ))}
        {panel.config.kind === "kpi" && <KpiPanel config={panel.config} />}
        {panel.config.kind === "insight" && <InsightsPanel />}
        {panel.config.kind === "text" && (
          <TextPanel
            config={panel.config}
            editable={editMode}
            onChange={(markdown) =>
              updatePanelConfig(panel.id, { kind: "text", markdown })
            }
          />
        )}
      </div>
    </div>
  );
}
