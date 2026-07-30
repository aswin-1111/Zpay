import { z } from "zod";
import { DASHBOARD_SCHEMA_VERSION } from "./dashboard";
import type { DashboardCollectionFile, DashboardFile } from "./dashboard";

const gridPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

// `chart` is produced/consumed exclusively by GraphicWalker's own exportCode()/importCode() —
// its internal spec shape is large and alpha-versioned, so we don't re-validate its internals
// here. GraphicRenderer/GraphicWalker will surface an error at render time if it's malformed.
const chartPanelConfigSchema = z.object({
  kind: z.literal("chart"),
  chart: z.unknown().nullable(),
});

const kpiPanelConfigSchema = z.object({
  kind: z.literal("kpi"),
  metric: z.enum([
    "totalDebit",
    "totalCredit",
    "netFlow",
    "avgTransaction",
    "transactionCount",
    "currentBalance",
  ]),
  label: z.string().optional(),
});

const textPanelConfigSchema = z.object({
  kind: z.literal("text"),
  markdown: z.string(),
});

const panelConfigSchema = z.discriminatedUnion("kind", [
  chartPanelConfigSchema,
  kpiPanelConfigSchema,
  textPanelConfigSchema,
]);

const panelSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  layout: gridPositionSchema,
  config: panelConfigSchema,
});

const dashboardSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  statementId: z.string(),
  panels: z.array(panelSpecSchema),
});

const dashboardFileSchemaCurrent = z.object({
  version: z.literal(DASHBOARD_SCHEMA_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  dashboard: dashboardSpecSchema,
});

const dashboardCollectionFileSchemaCurrent = z.object({
  version: z.literal(DASHBOARD_SCHEMA_VERSION),
  updatedAt: z.string(),
  appVersion: z.string(),
  activeDashboardId: z.string().nullable(),
  activeStatementId: z.string().nullable(),
  dashboards: z.array(dashboardSpecSchema),
});

// Pre-v2 shape (no statementId — every dashboard implicitly belonged to the single
// statement.parquet file that existed back then).
const dashboardSpecSchemaV1 = z.object({
  id: z.string(),
  name: z.string(),
  panels: z.array(panelSpecSchema),
});

const dashboardFileSchemaV1 = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  dashboard: dashboardSpecSchemaV1,
});

const dashboardCollectionFileSchemaV1 = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  appVersion: z.string(),
  activeDashboardId: z.string().nullable(),
  dashboards: z.array(dashboardSpecSchemaV1),
});

// Every dashboard/statement saved before multi-statement support existed is tagged
// with this id, matching the backend's one-time `legacy.parquet` migration.
const LEGACY_STATEMENT_ID = "legacy";

export type ValidationResult =
  | { ok: true; data: DashboardFile }
  | { ok: false; error: string };

export type CollectionValidationResult =
  | { ok: true; data: DashboardCollectionFile }
  | { ok: false; error: string };

function tagDashboardSpecWithStatement(
  dashboard: z.infer<typeof dashboardSpecSchemaV1>
): z.infer<typeof dashboardSpecSchema> {
  return { ...dashboard, statementId: LEGACY_STATEMENT_ID };
}

/**
 * Upgrades an older dashboard-file shape to the current one. v1 → v2 tags the
 * dashboard with the "legacy" statement id, matching the backend's one-time
 * legacy.parquet migration, so a dashboard saved before multi-statement support
 * existed keeps working instead of being orphaned.
 */
function migrateDashboardFile(raw: { version: number; [k: string]: unknown }): unknown {
  if (raw.version === 1) {
    const v1 = dashboardFileSchemaV1.safeParse(raw);
    if (!v1.success) return raw;
    return {
      ...v1.data,
      version: DASHBOARD_SCHEMA_VERSION,
      dashboard: tagDashboardSpecWithStatement(v1.data.dashboard),
    };
  }
  return raw;
}

function migrateDashboardCollection(raw: { version: number; [k: string]: unknown }): unknown {
  if (raw.version === 1) {
    const v1 = dashboardCollectionFileSchemaV1.safeParse(raw);
    if (!v1.success) return raw;
    return {
      ...v1.data,
      version: DASHBOARD_SCHEMA_VERSION,
      activeStatementId: LEGACY_STATEMENT_ID,
      dashboards: v1.data.dashboards.map(tagDashboardSpecWithStatement),
    };
  }
  return raw;
}

function checkVersion(json: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof json !== "object" || json === null || !("version" in json)) {
    return { ok: false, error: "Not a Zpay dashboard file (missing version field)." };
  }

  const version = (json as { version: unknown }).version;
  if (typeof version !== "number") {
    return { ok: false, error: "Not a Zpay dashboard file (invalid version field)." };
  }

  if (version > DASHBOARD_SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        "This dashboard was created with a newer version of Zpay and can't be opened here.",
    };
  }

  return { ok: true };
}

export function validateDashboardFile(json: unknown): ValidationResult {
  const versionCheck = checkVersion(json);
  if (!versionCheck.ok) return versionCheck;

  const migrated = migrateDashboardFile(json as { version: number; [k: string]: unknown });
  const parsed = dashboardFileSchemaCurrent.safeParse(migrated);

  if (!parsed.success) {
    return { ok: false, error: `Invalid dashboard file: ${parsed.error.message}` };
  }

  return { ok: true, data: parsed.data as DashboardFile };
}

export function validateDashboardCollection(json: unknown): CollectionValidationResult {
  const versionCheck = checkVersion(json);
  if (!versionCheck.ok) return versionCheck;

  const migrated = migrateDashboardCollection(json as { version: number; [k: string]: unknown });
  const parsed = dashboardCollectionFileSchemaCurrent.safeParse(migrated);

  if (!parsed.success) {
    return { ok: false, error: `Invalid dashboard file: ${parsed.error.message}` };
  }

  return { ok: true, data: parsed.data as DashboardCollectionFile };
}
