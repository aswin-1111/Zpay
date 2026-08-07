# Research: Adding AI/LLM Assistance to a GraphicWalker-based Dashboard

**Context.** Zpay is a Tauri + React desktop app for analyzing bank statements. It already uses
`@kanaries/graphic-walker` for manual drag-and-drop chart authoring (charts stored as `IChart` JSON,
see `src/types/dashboard.ts`), has a typed field schema (`IMutField[]`) built from parsed transactions
(`src/data/statement.ts: buildEnrichedDataset`), and already computes summary stats client-side
(`computeSummaryStats`: total debit/credit, net flow, avg transaction, most-active weekday, current
balance). This document surveys how production BI/visualization tools bolt AI onto exactly this kind
of setup, starting with Kanaries RATH (same lineage as GraphicWalker), then four comparable production
tools/patterns — Julius AI, Microsoft Power BI Copilot, Tableau (Pulse + Einstein Copilot/Tableau Agent),
and Cube.js's semantic-layer approach — then a comparison table and a recommendation scoped to Zpay's
constraints.

---

## 1. Kanaries RATH

RATH (`github.com/Kanaries/Rath`) is Kanaries' full "automated data exploration and visualization"
product — GraphicWalker is literally the drag-and-drop chart-building module that was extracted out of
RATH into its own embeddable library. RATH = GraphicWalker + an "Augmented Analytics" engine + AI
copilot/chat layers around it.

### 1.1 Copilot / natural-language-to-chart

RATH's docs describe a **"Data Copilot"** mode (`docs.kanaries.net/rath/explore-data/data-exploration-copilot`):
it automatically analyzes the loaded dataset and generates candidate visualizations grouped into
sections like *Associated Patterns*, *Associated Features*, and *Associated Subsets*; users can "pin"
a chart they like and RATH generates contextual follow-up charts from there. This is a
recommendation-engine flavor of NL-assistance — more "here are relevant charts based on what you're
looking at" than "type a sentence, get a chart."

The actual **text-to-chart** capability lives in a sibling Kanaries product, **VizGPT**
(`vizgpt.ai`, open-sourced at `github.com/ObservedObserver/viz-gpt`) and is referenced in RATH/Kanaries
marketing as "VizChat" inside the hosted **Kanaries Cloud platform**
(`platform.kanaries.net`), not inside the open-source `@kanaries/graphic-walker` npm package. VizGPT's
README confirms the architecture concretely:
- It's a client-side React/Vite app. It calls **Azure OpenAI directly from the browser**, using
  environment variables the *user/operator* supplies (`AZURE_OPENAI_KEY`, `BASE_URL`,
  `DEPLOYMENT_NAME`). There is no Kanaries-hosted proxy holding the key for you — you bring your own
  Azure OpenAI credentials and eat the token cost.
- The chat turns natural language into a **Vega-Lite spec**, which is then rendered directly. So the
  LLM's job is narrowly scoped: "given this tabular schema + user request, emit a valid Vega-Lite JSON
  chart spec" — not free-form code execution.
- Users can iteratively refine ("make it a bar chart instead," "filter to 2023") because the chat keeps
  the conversation + current spec in context.

Kanaries' own docs (`docs.kanaries.net/articles/visualization-gpt`, `.../rath-chatgpt`) market this as
"RATH: Your ChatGPT-Powered Personal Data Analyst" and "ask any question, get instant insights and
visualizations," but are notably light on technical specifics (model version, whether BYO-key is
mandatory in the productized RATH/Kanaries Cloud version, or whether Kanaries proxies a shared key for
paid tiers). The one concrete, verifiable architecture is VizGPT's: **user-supplied API key, direct
browser→LLM call, LLM outputs a declarative chart-spec (Vega-Lite), not raw code.**

### 1.2 Automated insight / pattern discovery ("auto-EDA") and causal discovery

This is RATH's most distinctive and most *non-LLM* feature. Docs
(`docs.kanaries.net/en/articles/auto-eda-guide`, `.../rath/explore-data/automated-data-insight`,
`.../rath/discover-causals/causal-analysis`) describe:
- **AutoPilot / Mega-auto Exploration**: a one-click "Augmented Analytic engine" that scores and
  ranks candidate visualizations by an "effectiveness score" and surfaces the most interesting ones
  automatically — this is closer to classical automated visualization recommendation (in the lineage
  of tools like Voder/Draco/Table2Charts research, which RATH's authors have published on) than to an
  LLM.
- **Causal Analysis**: a visual, no-code workflow that infers a directed causal graph from the
  dataset, lets users test hypotheses and do "what-if" analysis. The docs explicitly warn causal
  analysis "does not guarantee true causality" from observational data — standard statistical-causal-
  inference (Bayesian-network / constraint-based style discovery) language, not LLM output. No specific
  algorithm name (PC, FCI, GES, etc.) is disclosed in the public docs, but the framing (DAG discovery,
  editable graphical models, hypothesis testing) is consistent with a classical causal-discovery
  algorithm plus a custom UI, not a prompted LLM.
- **Data Explainer** (also listed as a GraphicWalker README feature): "explains why some patterns
  occur / what may cause them (like Salesforce Einstein)" — i.e., double-click a data point/segment and
  get a candidate explanation. Framed the same way as the causal engine: a heuristic/statistical
  explainer, not a chat LLM.

So RATH's "auto-EDA" and causal-discovery layers are a **custom-built heuristic/statistical analytics
engine**, independent of any third-party LLM API — this is Kanaries' core differentiated IP,
open-sourced under AGPL.

### 1.3 LLM-backed chat interface

Two distinct surfaces exist:
1. **GraphicWalker's README** lists "Natural language / Chat interface — ask a question about your
   data!" as a feature of the library itself, but this is aspirational/roadmap framing in the OSS
   README — the actual implementation ("VizChat") is confirmed to live in the **hosted Kanaries
   Cloud platform**, not shipped in the `@kanaries/graphic-walker` npm package you already depend on.
2. **RATH's Data Copilot** (chat-adjacent, but really a recommendation panel, see 1.1).

### 1.4 Architecture: external API vs local vs custom model

Summarizing across RATH + VizGPT + GraphicWalker:
- **Chart-spec generation from natural language** → external LLM API call (OpenAI/Azure OpenAI in
  VizGPT; RATH's marketing implies "integrates with GPT" similarly). **Requires the user/operator's
  own API key** in the openly-documented implementation (VizGPT); Kanaries Cloud likely proxies a
  managed key for paying customers, but this isn't publicly documented in detail.
- **Auto-EDA / causal discovery / "Data Explainer"** → custom, in-house statistical/heuristic engine
  running in the app (no external API, no user-supplied key needed). This is the part of RATH that is
  *not* an LLM wrapper — it's Kanaries' proprietary augmented-analytics engine.
- No evidence of a locally-bundled/on-device LLM (no llama.cpp/GGUF-style local model mentioned
  anywhere in RATH's docs or repo) — LLM features are always calls out to a hosted API.

### 1.5 Open source vs. paid/cloud gating

- **RATH** itself: free and open source, **AGPL-3.0** licensed (`github.com/Kanaries/Rath`). AGPL is
  network copyleft — relevant if anyone considers vendoring RATH's engine code into a closed-source
  commercial app (see §4).
- **GraphicWalker** (what Zpay already uses): separately licensed, **Apache-2.0** (permissive,
  commercial-friendly) — confirmed via its `package.json`/npm registry listing.
- **Kanaries Cloud** (the hosted product wrapping RATH + GraphicWalker + VizChat + dashboard sharing):
  tiered pricing — Education (free), **Pro** (~$?/mo, marketing pages show low monthly/annual pricing
  with a trial), **Team**, **Enterprise** (custom/contact sales). Paid tiers gate: the "RATH autopilot"
  add-on, dashboard/data-app sharing, team collaboration, and premium data-source connectors (DuckDB,
  Postgres, Snowflake, etc.). GPT-powered exploration ("VizChat"/copilot) is positioned as a **Pro-tier
  cloud feature**, not something bundled for free into the self-hosted OSS build.
- **VizGPT**: standalone MIT-style open-source project (bring-your-own Azure OpenAI key), free to
  self-host; also offered as a hosted product at vizgpt.ai.

**Bottom line for RATH specifically**: the AI story is a hybrid — a proprietary, non-LLM statistical
engine for auto-insight/causal-discovery (genuinely open source, runs locally, no API key), plus a thin
LLM-wrapper layer for natural-language chart authoring that calls out to OpenAI/Azure OpenAI and is
mostly surfaced through the paid Kanaries Cloud product rather than the OSS libraries.

Sources: [Kanaries/Rath GitHub](https://github.com/Kanaries/Rath) ·
[RATH docs hub](https://docs.kanaries.net/rath) ·
[Data Exploration Copilot](https://docs.kanaries.net/rath/explore-data/data-exploration-copilot) ·
[Automated Data Insight](https://docs.kanaries.net/rath/explore-data/automated-data-insight) ·
[Auto-EDA guide](https://docs.kanaries.net/en/articles/auto-eda-guide) ·
[Causal Analysis](https://docs.kanaries.net/rath/discover-causals/causal-analysis) ·
[RATH ChatGPT article](https://docs.kanaries.net/articles/rath-chatgpt) ·
[VizGPT article](https://docs.kanaries.net/articles/visualization-gpt) ·
[ObservedObserver/viz-gpt GitHub](https://github.com/ObservedObserver/viz-gpt) ·
[Kanaries/graphic-walker GitHub](https://github.com/Kanaries/graphic-walker) ·
[graphic-walker README](https://github.com/Kanaries/graphic-walker/blob/main/README.md) ·
[kanaries.net/rath](https://kanaries.net/rath)

---

## 2. Comparable production tools

### 2.1 Julius AI — chat-first, agentic code-execution data analyst

**What the AI does.** Julius is a consumer/prosumer product: you upload a CSV/Excel/connect a DB
(Postgres/Snowflake/BigQuery), then chat in plain English ("plot revenue by month and flag outliers").
Under the hood it writes and executes Python, iterates on its own errors, and returns
charts/tables/forecasts/reports. It's the closest analogue to "type a question about your bank
statement, get back a chart or a written insight" of anything surveyed here.

**Architecture.** Multi-model: Julius reportedly routes across GPT-4-class models, Claude, and some
proprietary/tuned components depending on task type, then generates and **executes real Python code**
in a sandboxed backend (not just a declarative chart spec like VizGPT) — this is a full code-interpreter
agent loop, not a constrained "NL → JSON spec" call. It's a hosted SaaS: your data goes to Julius's
servers/cloud LLM providers.

**Cost/requirements to integrate.** Not integrable as a library — it's a standalone hosted product you
point users at (or embed via their API where available). Subscription-based consumer pricing (free
tier + paid plans), no self-hosting option, no BYO-key open-source variant. Not something you'd embed
inside a desktop app's codebase; it's a competitor/reference architecture, not a component.

Sources: [Julius AI: Hub and Spoke Data Model](https://julius.ai/articles/hub-and-spoke-data-model) ·
[Julius AI: Federated Architecture](https://julius.ai/articles/federated-architecture) ·
[Julius AI Review 2026](https://mcpanalytics.ai/articles/julius-ai-review) ·
[DataCamp: Julius AI Guide](https://www.datacamp.com/tutorial/julius-ai-guide)

### 2.2 Microsoft Power BI Copilot — enterprise NL-to-report/DAX

**What the AI does.** Generates DAX measures, builds report visuals, and writes narrative summaries of
report data from natural-language prompts, inside Power BI Desktop/Service.

**Architecture.** Backed by **Azure OpenAI (GPT-4-class)**, hosted in Microsoft's own regional Azure
OpenAI deployments — Microsoft manages the model/API relationship end-to-end; you never touch or supply
an API key. But it is **infrastructure-gated, not just feature-gated**: Copilot requires a paid Fabric
capacity (F2+) or Premium capacity (P1+) at the *tenant* level — a Pro or PPU per-user license alone
does not unlock it. Usage draws down shared capacity per token (100 capacity-units per 1K input tokens,
400 per 1K output tokens), so cost scales with an org-wide compute allocation rather than a simple
per-seat add-on.

**Cost/requirements to integrate.** This is not something you integrate into your own app — it's a
Microsoft product feature. Relevant here only as an architecture pattern: "vendor-hosted LLM, gated
behind a substantial infrastructure/capacity purchase, zero API-key management for the end user."
Entry pricing starts around $262/mo (F2) purely for the platform capacity, separate from any per-user
licensing.

Sources: [Copilot for Power BI overview – Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-introduction) ·
[Power BI Copilot Pricing: Fabric Capacity Reality (2026)](https://colrows.com/blogs/power-bi-copilot-pricing/) ·
[Power BI Copilot 2026 guide](https://aiagentsquare.com/agents/power-bi-copilot)

### 2.3 Tableau — Tableau Pulse + Einstein Copilot / Tableau Agent

Tableau is the most directly comparable "chart-authoring tool bolts on AI" example, and it shipped this
in two distinct waves that are worth naming separately because they're architecturally different
patterns.

**Tableau Pulse — automated insight/metrics feed (the "auto-detection" pattern).**
Pulse is not a chat interface at all: an author defines a metric once (e.g. "net cash flow"), and Pulse
proactively computes and pushes personalized digests about it — trend callouts, contributing-factor
breakdowns, week-over-week deltas — into a feed, Slack, Teams, or email, without the viewer asking a
question. It's the productionized version of "here's something interesting we noticed," the same
pattern as RATH's AutoPilot or a well-tuned anomaly detector. Generative AI is used specifically to turn
the computed statistics into a **written natural-language summary** ("your net revenue is up 12% this
week, driven mostly by X"), not to do the underlying detection math itself — the detection is
statistical, the LLM's job is narration.

**Einstein Copilot → Tableau Agent — conversational Q&A and NL chart authoring.**
Originally launched as "Einstein Copilot for Tableau," now branded **Tableau Agent**: a chat panel where
authors/viewers ask follow-up questions in natural language ("why did this spike?", "break this down by
region") and get back either a written answer or an auto-generated visualization. Notably, Tableau's
older **"Ask Data"** feature (a from-scratch NL-query-to-viz feature, conceptually the most similar
predecessor to what RATH/VizGPT does) was **retired** in Tableau Cloud in February 2024 and in Tableau
Server as of version 2024.2, explicitly superseded by Pulse + Tableau Agent — i.e., Tableau itself moved
away from a bare "type a question, get a chart" model toward metric-first proactive insights plus a
conversational layer on top of governed metrics.

**Architecture and data-privacy handling (directly relevant to Zpay's own privacy concerns).**
Both Pulse and Tableau Agent sit behind Salesforce's **Einstein Trust Layer**: Tableau's own
documentation states that customer data and conversations sent to the underlying LLM are **not retained
by the LLM provider and are not used to train the model**, and that PII masking/toxicity detection are
applied to prompts and responses. Concretely, this is the pattern of "the vendor puts a
redaction/governance layer in front of a third-party (or partner) LLM call, and contractually/technically
guarantees the LLM provider doesn't retain or train on your data" — i.e., Tableau does not expect
customers to trust OpenAI/Anthropic/etc. directly; Salesforce interposes itself as the trust boundary.
That's a materially different privacy posture than VizGPT/RATH's "bring your own key, browser talks
straight to Azure OpenAI" pattern — worth noting as the "enterprise-grade" version of solving the exact
privacy problem Zpay would face.

**Cost/licensing.** These are **not separately embeddable components** — they're gated features of the
Tableau product itself. Tableau Agent (Einstein Copilot) and the premium tier of Pulse require
**Tableau+**, a premium bundle on top of base Creator/Explorer licensing that also brings Data Cloud
access and consumes **Agentforce Flex Credits / Data Cloud Credits** for AI usage beyond a base
allowance — i.e., a credit-metered add-on layered on top of per-seat licensing, similar in spirit to
Power BI Copilot's capacity-metering but billed as credits rather than capacity-seconds. The old
free-standing "Ask Data" natural-language feature is gone entirely.

Sources: [Tableau Agent FAQ](https://help.tableau.com/current/online/en-us/web_author_einstein_faq.htm) ·
[Explore Your Data with Tableau Agent](https://help.tableau.com/current/online/en-us/web_author_einstein.htm) ·
[Tableau AI Review 2026](https://aiagentsquare.com/agents/tableau-ai) ·
[Tableau AI / Pulse review](https://visualitics.it/tableau-software/tableau-ai-pulse-agent/?lang=en) ·
[What is Tableau+?](https://godatadrive.com/blog/what-is-tableau-plus) ·
[Tableau Pricing 2026 breakdown](https://coefficient.io/tableau-pricing) ·
[Salesforce Einstein GPT/Copilot/AI Cloud pricing](https://salesforcenegotiations.com/salesforce-einstein-gpt-copilot-and-ai-cloud-pricing/)

### 2.4 Cube.js — semantic layer as LLM infrastructure (a different category entirely)

Cube is worth covering separately because it's **not** an end-user-facing chart tool like RATH/VizGPT,
Julius, or Tableau — it's a headless, developer-facing **semantic layer**: you define metrics,
dimensions, and joins once in YAML/JS (`measures`, `dimensions`, entity relationships), and Cube exposes
that governed model over SQL, REST, and GraphQL APIs to any downstream client. Its relevance here is as
**infrastructure a developer would use to build their own chat-with-data feature**, rather than a
feature to bolt on directly.

**Why a semantic layer changes the text-to-SQL/text-to-chart problem.** Cube's own framing (and the
generally-accepted argument for semantic layers + LLMs) is that raw text-to-SQL asks the LLM to
re-derive joins, filters, and metric definitions from scratch on every prompt against physical tables —
so the same question can silently produce different numbers depending on how the LLM happened to
join things that day, and there's no way to enforce access control at the row/column level. A semantic
layer moves that logic out of the LLM's hands: metrics/dimensions are defined and computed
**once, deterministically, by Cube**, and the LLM's only job is to pick the right named metric/dimension
combination (closer to filling in a form than authoring SQL) — which is exactly the same
hallucination-reduction logic as VizGPT constraining LLM output to a Vega-Lite JSON schema rather than
free-text, just one level up (query semantics instead of chart-spec syntax).

**How it's actually wired in, and what's open source vs. paid.** This split matters:
- **Cube Core** (the semantic layer itself — YAML/JS model definitions, SQL/REST/GraphQL query APIs,
  the deterministic compile-to-SQL engine) is **open source and fully self-hostable**, with no AI or LLM
  involved at all at this layer. You could self-host Cube Core purely as a governed query/metrics layer
  and write your own LLM integration against its REST/GraphQL API with your own OpenAI/Anthropic key —
  entirely self-built, no Cube Cloud subscription required.
- Cube's **AI-specific surfaces** — the **AI API** (RAG + prompt engineering wired to Cube's semantic
  model, supporting either Cube-bundled Anthropic Claude models or a bring-your-own-LLM key) and the
  **MCP server** (lets any MCP-compatible AI client, e.g. Claude, discover and query Cube's metrics
  over HTTPS/OAuth instead of writing SQL) — are **Cube Cloud–only, paid-tier features**: the AI API is
  available starting on Cube Cloud's paid Starter tier, and the MCP server specifically requires
  **Premium or Enterprise** Cube Cloud plans. Neither ships in the open-source Cube Core.

**Cost/requirements to integrate.** Two very different paths: (a) self-host Cube Core for free, build
your own thin LLM-calls-Cube's-API glue code, pay only per-LLM-call token costs; or (b) pay for Cube
Cloud (Starter+ for the AI API, Premium/Enterprise for the MCP server) and get a more turnkey
RAG/prompt-engineering layer plus governed multi-client MCP access, at Cube Cloud's subscription pricing
on top of per-token LLM costs.

Sources: [Cube — the agentic analytics platform](https://cube.dev/) ·
[Semantic Layer for AI Agents (2026)](https://cube.dev/articles/semantic-layer-for-ai-agents-2026) ·
[A Practical Guide to Getting Started with Cube's AI API](https://cube.dev/blog/a-practical-guide-to-getting-started-with-cubes-ai-api) ·
[Cube MCP server docs](https://docs.cube.dev/docs/integrations/mcp-server) ·
[LLM & AI Semantic Layer use case](https://cube.dev/use-cases/llm-and-ai-semantic-layer) ·
[Best Semantic Layer for AI and BI in 2026](https://cube.dev/articles/best-semantic-layer-for-ai-and-bi-2026)

---

## 3. Comparison table

| Approach | Example(s) | Pros | Cons | Integration complexity | Typical cost model |
|---|---|---|---|---|---|
| **NL → declarative chart-spec via LLM** (LLM emits Vega-Lite/IChart-like JSON, app renders it) | VizGPT (Kanaries), RATH's marketed "VizChat" | Small, well-scoped LLM task (schema in, spec out); output is validate-able/renderable with existing chart renderer; low risk of the LLM "getting the data wrong" since it never sees raw rows, only field names/types | Limited to what the chart grammar can express; still needs schema sent to an external API; multi-turn refinement adds prompt-engineering complexity | **Low–Medium** — you already have `IChart`/`IMutField`; need a prompt template + JSON-schema-constrained LLM call + validation/repair loop | Per-call API cost (pay-as-you-go token pricing), or subscription if using a hosted product |
| **Chat-with-data / agentic code execution** | Julius AI, ChatGPT Code Interpreter-style tools | Most flexible — can do arbitrary analysis, forecasting, custom transforms, not limited to chart grammar | Raw data (or a representative sample) typically must reach the LLM/sandbox for code execution to operate on it; sandboxing/execution infra is nontrivial; slower, higher token cost per turn; harder to make deterministic/auditable | **High** — needs a code-execution sandbox, iteration/repair loop, and careful data-exposure controls | Per-call API cost, often multiplied by retries/multi-step agent loops; hosted SaaS is subscription-based |
| **Auto-generated insight cards / auto-EDA** | RATH AutoPilot/Mega-auto Exploration, Tableau Pulse (metric digests) | Can run entirely on statistics/heuristics with **no LLM and no external API** — fully private and free at inference time; deterministic, fast, works offline | Insights read more "canned"/generic without an LLM to phrase them naturally; building a good scoring/ranking heuristic is real engineering work up front | **Medium** — no LLM plumbing needed, but requires designing a scoring function over your existing summary stats/enriched dataset | One-time engineering cost only; zero marginal per-use cost; optionally add LLM narration on top for a per-call cost |
| **Chat-with-data / text-to-SQL or text-to-aggregation** | Power BI Copilot's natural-language query layer, generic "ask a question, get a DAX/SQL query" pattern | Good fit when data lives in a queryable store; keeps the LLM's job narrow (query generation, not raw data reasoning) | Needs a query engine/schema behind it; enterprise versions are gated behind expensive infra (Fabric/Premium capacity); raw text-to-SQL still lets the LLM re-derive joins/metric logic each time, so answers can drift | **Medium–High** — needs a local query layer (e.g., DuckDB over the parsed statement) plus prompt→query→execute→render pipeline | Vendor products: capacity/subscription-based; self-built: per-call API cost only |
| **Semantic layer as LLM infrastructure** (governed metrics/dimensions defined once, LLM only selects from them — a step up from raw text-to-SQL) | Cube.js (Cube Core semantic layer + AI API/MCP server) | LLM never authors SQL or re-derives metric logic — it picks from a governed, deterministically-computed set of metrics/dimensions, so the same question always returns the same number; access control enforced centrally; the semantic-layer part itself needs no LLM/API key at all | Primarily developer-facing infrastructure, not an end-user feature by itself — you still have to build the LLM-facing chat/prompt layer on top; Cube's own AI API/MCP server are Cube-Cloud-only paid features (self-hosting only gets you the non-AI semantic layer) | **Medium** if you already have (or lightweight-build) a metrics layer; conceptually close to Zpay's existing `SummaryStats`/`IMutField` schema, which is already a mini semantic layer | Self-hosted Cube Core: free, pay only per-LLM-call token cost; Cube Cloud AI API/MCP: additional subscription (Starter+/Premium+) on top of token cost |
| **Proactive anomaly/outlier auto-detection** | Tableau Pulse, RATH causal analysis/"Data Explainer" | Surfaces things the user didn't think to ask about (e.g., "big unusual debit last week"); can be pure statistics (z-score/IQR/rolling baseline) with no LLM at all | Naive statistical anomaly detection produces false positives on messy real-world bank data (irregular billing cycles, refunds); tuning takes iteration | **Low–Medium** for a simple stats-based version; **High** for genuine causal discovery | Zero marginal cost if statistics-only; per-call cost only if an LLM is used to phrase/explain the anomaly |
| **LLM-authored full dashboard from raw data** | (aspirational pattern seen in various "auto-dashboard" demos; not fully embodied in production by any tool surveyed here) | Fastest path from zero to a populated dashboard; good demo value | Raw data usually needs to reach the LLM (or a large sample/full schema+stats) for it to reason about what's worth charting; hardest to keep deterministic/reviewable; highest trust burden if it's wrong | **High** | Per-call cost, likely several calls per dashboard (plan → per-chart spec → refine) |

---

## 4. Recommendation for Zpay's context

Constraints that matter most here: (a) **Tauri desktop app**, not a multi-tenant SaaS — no existing
backend to proxy API keys or run a sandboxed code-execution agent; (b) the data is **sensitive bank
transaction data** — sending raw rows (payee names, amounts, dates) to a third-party LLM API is a real
privacy exposure for a finance app, and probably a hard "no" as a default/silent behavior; (c) you
already have `IChart` (GraphicWalker's canonical chart spec) and `IMutField[]` (typed field schema) —
i.e., you already have the exact shape of a target for "LLM emits a chart spec"; (d) you already compute
`SummaryStats` client-side (`computeSummaryStats` in `src/data/statement.ts`) with zero LLM involvement
today — and that `SummaryStats`/`KpiMetric` type (`src/types/dashboard.ts`) is, conceptually, already a
tiny hand-rolled semantic layer: a small, named, deterministically-computed set of metrics
(`totalDebit`, `netFlow`, `avgTransaction`, etc.), which is exactly the kind of governed-metric surface
Cube's semantic-layer pattern (§2.4) argues an LLM should be pointed at instead of raw rows.

**Recommended starting points, informed by that overlap:**

**Recommended starting point #1 — NL → chart-spec via LLM, schema-only, opt-in BYO API key.**
This mirrors VizGPT's architecture almost exactly, and maps directly onto code you already have:
- Send the LLM **only** the field schema (`IMutField[]`: field names, semantic types like
  `temporal`/`quantitative`/`nominal`) plus the user's natural-language request — never the actual
  transaction rows (no payee names, no amounts, no dates of individual transactions).
- Constrain the LLM's output to a JSON schema matching (a subset of) `IChart`, validate it, and hand it
  straight to GraphicWalker's existing renderer (`PureRenderer`/`GraphicRenderer`) — no new rendering
  path needed.
- Make it opt-in and BYO-key (user pastes their own OpenAI/Anthropic/Azure key in settings, stored
  locally via Tauri's secure storage), exactly like VizGPT does — this sidesteps you needing to run or
  pay for any backend, and is honest with users about a third party seeing their *schema* (not their
  transactions) when they choose to use the feature.
- This is the lowest-integration-complexity option that still delivers the headline "type a question,
  get a chart" feature, and it's the pattern actually validated in production (VizGPT/RATH) rather than
  speculative.

**Recommended starting point #2 — statistics-only auto-insight cards, no LLM required.**
Build a small scoring/ranking layer on top of the `EnrichedRow`/`SummaryStats` data you already compute
(e.g., "this month's spend is 2.3× your 6-month average," "unusually high debit on a Sunday," "your top
merchant category changed rank") and surface these as auto-generated insight cards/KPI panels, in the
same spirit as RATH's AutoPilot/Mega-auto Exploration and Tableau Pulse's digests, but implemented as
pure client-side arithmetic (rolling averages, z-scores/IQR outlier checks over `absAmount`, weekday-
distribution comparisons) — **zero data ever leaves the device, no API key, no per-call cost, works
fully offline**, and it directly extends code you already have (`computeSummaryStats`,
`buildEnrichedDataset`). This should ship first/independent of any LLM feature, both because it's the
cheapest to build and because it gives you a private fallback / "core" experience even if the user
never opts into the LLM feature.

If/when you later add an LLM-narrated version of these insights (turning "netFlow is -2.3x last month"
into a written sentence, à la Tableau Pulse's digest narration), the safest data-exposure boundary is
to send the LLM **only the already-computed aggregate numbers from `SummaryStats`/your insight-scoring
layer** — never the underlying transaction rows — which is precisely the "LLM only sees governed
metrics, never raw records" boundary that Cube's semantic-layer pattern (§2.4) and Tableau's Pulse
narration (§2.3) both rely on. In effect, `KpiMetric`/`SummaryStats` can play the same role for Zpay
that a Cube semantic-layer model plays for a Cube-based chat feature — a small, named, pre-aggregated
surface the LLM is allowed to talk about, instead of a text-to-SQL-style free-for-all over raw rows.

**Why not the others as a starting point:**
- Full agentic chat-with-data (Julius-style) requires a code-execution sandbox and typically exposes
  raw data to the model/backend — too much engineering and too much privacy exposure for a v1 in a
  desktop finance app.
- Enterprise NL-to-query/report patterns (Power BI Copilot) assume a hosted backend/capacity model that
  doesn't exist in a local-first Tauri app.
- Tableau's approach (Pulse + Tableau Agent behind the Einstein Trust Layer) is the right *shape* of
  privacy story (governed metrics + a trust/redaction boundary in front of the LLM) but it's a
  multi-tenant SaaS feature bundled into an expensive Tableau+ credit-metered add-on — not something
  transplantable into a single-user desktop app; the *pattern* (narrate pre-computed metrics, don't hand
  the LLM raw rows) is worth borrowing, the product isn't.
- Cube.js's semantic-layer pattern is conceptually the best-validated argument for *why* #1/#2's
  "schema/metrics-only, never raw rows" design is sound, but adopting Cube itself would mean standing up
  a Cube Core server (and possibly a Cube Cloud subscription for the AI API/MCP server) purely to
  replicate a semantic layer Zpay already has in miniature via `SummaryStats`/`KpiMetric` — reasonable to
  revisit only if the metrics surface grows enough (many statement types, cross-account rollups, etc.)
  that hand-rolling it stops being simpler than adopting real semantic-layer infrastructure.
- Genuine causal discovery (RATH's causal engine) is valuable but is a research-grade algorithmic
  investment, not a quick add-on — worth revisiting later, and note it's the one RATH capability that's
  **not** an LLM wrapper, so if you ever want to reuse ideas/code from RATH itself (as opposed to just
  being inspired by the concept), remember **RATH is AGPL-3.0** (network copyleft) — different from the
  Apache-2.0 `graphic-walker` you already depend on — so vendoring RATH code directly into a
  closed-source build would carry real license obligations worth a legal check first; building your own
  simple statistical version (as in recommendation #2) avoids that question entirely.

**Suggested sequencing:** ship #2 first (cheap, private, no new dependencies, immediate value), then
layer #1 on top as an explicitly opt-in, clearly-labeled "AI chart assistant" that only ever sees schema
metadata, never transaction-level data, with the user's own API key.
