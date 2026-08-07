import { z } from "zod";
import type { IChart, IMutField } from "@kanaries/graphic-walker";
import { buildDefaultChart, dimensionField, measureField, COUNT_FIELD } from "./defaultCharts";

// Kept narrow and fully validated on purpose — see the design note in the plan:
// the AI never sees transaction rows, only this schema, and it can only ever
// reference known field ids and a small enum of geoms/aggregations. Anything
// that doesn't fit is rejected rather than passed through to GraphicWalker.
const ALLOWED_GEOMS = ["bar", "line", "area", "point", "arc"] as const;
const ALLOWED_AGGS = ["sum", "mean", "count", "max", "min", "median"] as const;
const COUNT_FID = "gw_count_fid";

const fieldRefSchema = z.object({
  fid: z.string(),
  aggName: z.enum(ALLOWED_AGGS).optional(),
});

const aiChartDescriptionSchema = z.object({
  name: z.string(),
  geoms: z.array(z.enum(ALLOWED_GEOMS)).min(1),
  columns: z.array(fieldRefSchema).optional(),
  rows: z.array(fieldRefSchema).optional(),
  color: z.array(fieldRefSchema).optional(),
  theta: z.array(fieldRefSchema).optional(),
});

export type AiChartValidationResult =
  | { ok: true; chart: IChart }
  | { ok: false; error: string };

type FieldRef = { fid: string; aggName?: (typeof ALLOWED_AGGS)[number] };
type ResolvedField = ReturnType<typeof dimensionField> | ReturnType<typeof measureField>;

function resolveFieldRef(ref: FieldRef, knownFields: Map<string, IMutField>): ResolvedField | null {
  if (ref.fid === COUNT_FID) return COUNT_FIELD;
  const known = knownFields.get(ref.fid);
  if (!known) return null;
  if (ref.aggName) {
    return measureField(ref.fid, known.name ?? ref.fid, ref.aggName);
  }
  return dimensionField(ref.fid, known.name ?? ref.fid, known.semanticType);
}

// Some models wrap JSON in ```json fences despite instructions not to — strip
// those defensively before parsing rather than failing on a cosmetic wrapper.
export function parseAiJsonResponse(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function validateAndBuildAiChart(
  raw: unknown,
  knownFields: IMutField[]
): AiChartValidationResult {
  const parsed = aiChartDescriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "The AI's response wasn't a valid chart description." };
  }
  const desc = parsed.data;
  const knownMap = new Map(knownFields.map((f) => [f.fid, f]));

  function resolveList(list?: FieldRef[]): ResolvedField[] | null {
    if (!list) return [];
    const resolved: ResolvedField[] = [];
    for (const ref of list) {
      const field = resolveFieldRef(ref, knownMap);
      if (!field) return null;
      resolved.push(field);
    }
    return resolved;
  }

  const columns = resolveList(desc.columns);
  const rows = resolveList(desc.rows);
  const color = resolveList(desc.color);
  const theta = resolveList(desc.theta);
  if (columns === null || rows === null || color === null || theta === null) {
    return { ok: false, error: "The AI referenced a field that doesn't exist in this dataset." };
  }

  const chart = buildDefaultChart({
    visId: crypto.randomUUID(),
    name: desc.name,
    geoms: desc.geoms,
    columns,
    rows,
    color,
    theta,
  });

  return { ok: true, chart };
}
