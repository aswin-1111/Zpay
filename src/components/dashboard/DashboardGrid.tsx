import { GridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import { useDashboardStore, useActiveDashboard } from "../../store/dashboardStore";
import Panel from "./Panel";

export default function DashboardGrid() {
  const dashboard = useActiveDashboard();
  const editMode = useDashboardStore((s) => s.editMode);
  const updatePanelLayout = useDashboardStore((s) => s.updatePanelLayout);
  const { width, containerRef, mounted } = useContainerWidth();

  if (!dashboard) return null;

  const layout: Layout = dashboard.panels.map((p) => ({
    i: p.id,
    x: p.layout.x,
    y: p.layout.y,
    w: p.layout.w,
    h: p.layout.h,
  }));

  return (
    <div className="dashboard-grid-container" ref={containerRef}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 12, rowHeight: 28, margin: [12, 12] }}
          dragConfig={{
            enabled: editMode,
            handle: ".panel-drag-handle",
            cancel: "input,button,textarea",
          }}
          resizeConfig={{ enabled: editMode }}
          onLayoutChange={updatePanelLayout}
        >
          {dashboard.panels.map((panel) => (
            <div key={panel.id}>
              <Panel panel={panel} dashboardId={dashboard.id} />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
