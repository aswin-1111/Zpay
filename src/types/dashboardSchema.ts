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
  panels: z.array(panelSpecSchema),
});

const dashboardFileSchemaV1 = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  dashboard: dashboardSpecSchema,
});

const dashboardCollectionFileSchemaV1 = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  appVersion: z.string(),
  activeDashboardId: z.string().nullable(),
  dashboards: z.array(dashboardSpecSchema),
});

export type ValidationResult =
  | { ok: true; data: DashboardFile }
  | { ok: false; error: string };

export type CollectionValidationResult =
  | { ok: true; data: DashboardCollectionFile }
  | { ok: false; error: string };

/**
 * Upgrades an older file shape to the current one. Identity for v1 (the only version
 * so far) — future schema changes add a step here rather than replacing it, so files
 * saved years ago keep loading.
 */
function migrateVersionedFile(raw: { version: number; [k: string]: unknown }): unknown {
  if (raw.version === DASHBOARD_SCHEMA_VERSION) {
    return raw;
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

  const migrated = migrateVersionedFile(json as { version: number; [k: string]: unknown });
  const parsed = dashboardFileSchemaV1.safeParse(migrated);

  if (!parsed.success) {
    return { ok: false, error: `Invalid dashboard file: ${parsed.error.message}` };
  }

  return { ok: true, data: parsed.data as DashboardFile };
}

export function validateDashboardCollection(json: unknown): CollectionValidationResult {
  const versionCheck = checkVersion(json);
  if (!versionCheck.ok) return versionCheck;

  const migrated = migrateVersionedFile(json as { version: number; [k: string]: unknown });
  const parsed = dashboardCollectionFileSchemaV1.safeParse(migrated);

  if (!parsed.success) {
    return { ok: false, error: `Invalid dashboard file: ${parsed.error.message}` };
  }

  return { ok: true, data: parsed.data as DashboardCollectionFile };
}
