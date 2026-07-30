import type { IChart } from "@kanaries/graphic-walker";

// GraphicWalker's `IChart` shape is large and alpha-versioned (see the note in
// dashboardSchema.ts), so we don't hand-roll it from the raw interfaces. These
// defaults are lifted directly from GraphicWalker's own compiled source (the
// object its UI falls back to when a chart has no encodings yet), so panels
// built with this helper render correctly without needing a trip through the
// chart editor.

type Field = {
  fid: string;
  name: string;
  semanticType: "quantitative" | "nominal" | "ordinal" | "temporal";
  analyticType: "dimension" | "measure";
  aggName?: string;
};

// GraphicWalker's built-in pseudo-field for "count of records" — it doesn't need
// to exist as a real column in the dataset.
const COUNT_FIELD: Field = {
  fid: "gw_count_fid",
  name: "Count",
  semanticType: "quantitative",
  analyticType: "measure",
  aggName: "count",
};

function emptyEncodings() {
  return {
    dimensions: [] as Field[],
    measures: [] as Field[],
    rows: [] as Field[],
    columns: [] as Field[],
    color: [] as Field[],
    opacity: [] as Field[],
    size: [] as Field[],
    shape: [] as Field[],
    theta: [] as Field[],
    radius: [] as Field[],
    longitude: [] as Field[],
    latitude: [] as Field[],
    geoId: [] as Field[],
    details: [] as Field[],
    filters: [] as Field[],
    text: [] as Field[],
  };
}

function baseConfig(geoms: string[]) {
  return {
    defaultAggregated: true,
    geoms,
    coordSystem: "generic",
    limit: -1,
  };
}

function baseLayout() {
  return {
    showTableSummary: false,
    format: {},
    resolve: { x: false, y: false, color: false, opacity: false, shape: false, size: false },
    size: { mode: "auto" as const, width: 320, height: 200 },
    interactiveScale: false,
    stack: "stack" as const,
    showActions: false,
    sorted: "none",
    zeroScale: true,
    scaleIncludeUnmatchedChoropleth: false,
    geoKey: "name",
  };
}

export function buildDefaultChart(options: {
  visId: string;
  name: string;
  geoms: string[];
  columns?: Field[];
  rows?: Field[];
  color?: Field[];
  theta?: Field[];
}): IChart {
  const encodings = emptyEncodings();
  encodings.columns = options.columns ?? [];
  encodings.rows = options.rows ?? [];
  encodings.color = options.color ?? [];
  encodings.theta = options.theta ?? [];

  return {
    visId: options.visId,
    name: options.name,
    encodings,
    config: baseConfig(options.geoms),
    layout: baseLayout(),
  } as unknown as IChart;
}

export function measureField(
  fid: string,
  name: string,
  aggName: string
): Field {
  return { fid, name, semanticType: "quantitative", analyticType: "measure", aggName };
}

export function dimensionField(
  fid: string,
  name: string,
  semanticType: Field["semanticType"] = "nominal"
): Field {
  return { fid, name, semanticType, analyticType: "dimension" };
}

export { COUNT_FIELD };
