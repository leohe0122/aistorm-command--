// 旧手工 MEDDPICC 分数与证据推导分数的对账（纯函数）。
// 用于决定能否把页面切换为只读证据分数：看覆盖面、分歧大小，以及“有旧分但没有任何证据”的维度。
// 旧表的 0 分与“未评分”无法区分（字段默认值为 0），统一视为未评分。

export const LEGACY_COLUMNS: Record<string, string> = {
  M: "metricsScore",
  E: "economicBuyerScore",
  D1: "decisionCriteriaScore",
  D2: "decisionProcessScore",
  P: "paperProcessScore",
  I: "implicatePainScore",
  C1: "championScore",
  C2: "competitionScore",
};
export const DIMENSIONS = Object.keys(LEGACY_COLUMNS);
export const LARGE_GAP = 50;

export type ReconTarget = {
  scope: "client" | "opportunity";
  targetId: number;
  label: string;
  /** 已换算为 0-100 的旧分；0 或缺失视为未评分 */
  legacy: Partial<Record<string, number>>;
  /** 证据推导分（含人工覆盖后的有效分） */
  derived: Partial<Record<string, number>>;
};

export type ReconRow = { scope: "client" | "opportunity"; targetId: number; label: string; dimension: string; legacy: number | null; derived: number | null; gap: number | null };

export type ReconSummary = {
  targets: number;
  dimensionSlots: number;
  legacyScored: number;
  derivedScored: number;
  bothScored: number;
  meanAbsGap: number | null;
  largeGaps: ReconRow[];
  legacyWithoutEvidence: ReconRow[];
  evidenceWithoutLegacy: ReconRow[];
};

/** 旧表一行 → 0-100 分。商机级旧分是 0-4，乘 25。 */
export function legacyScores(row: Record<string, unknown> | undefined, scale: 1 | 25): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  if (!row) return out;
  for (const [dimension, column] of Object.entries(LEGACY_COLUMNS)) {
    const value = Number(row[column] ?? 0);
    if (Number.isFinite(value) && value > 0) out[dimension] = Math.min(100, value * scale);
  }
  return out;
}

export function reconcile(targets: ReconTarget[]): { rows: ReconRow[]; summary: ReconSummary } {
  const rows: ReconRow[] = [];
  for (const target of targets) {
    for (const dimension of DIMENSIONS) {
      const legacy = target.legacy[dimension] ?? null;
      const derived = target.derived[dimension] ?? null;
      rows.push({ scope: target.scope, targetId: target.targetId, label: target.label, dimension, legacy, derived, gap: legacy !== null && derived !== null ? derived - legacy : null });
    }
  }
  const both = rows.filter(row => row.gap !== null);
  return {
    rows,
    summary: {
      targets: targets.length,
      dimensionSlots: rows.length,
      legacyScored: rows.filter(row => row.legacy !== null).length,
      derivedScored: rows.filter(row => row.derived !== null).length,
      bothScored: both.length,
      meanAbsGap: both.length ? Math.round(both.reduce((sum, row) => sum + Math.abs(row.gap!), 0) / both.length) : null,
      largeGaps: both.filter(row => Math.abs(row.gap!) >= LARGE_GAP),
      legacyWithoutEvidence: rows.filter(row => row.legacy !== null && row.derived === null),
      evidenceWithoutLegacy: rows.filter(row => row.legacy === null && row.derived !== null),
    },
  };
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

export function renderReconciliationMarkdown(result: ReturnType<typeof reconcile>, generatedAt: Date): string {
  const { summary } = result;
  const line = (row: ReconRow) => `| ${row.scope === "client" ? "客户" : "商机"} | ${row.label} | ${row.dimension} | ${row.legacy ?? "—"} | ${row.derived ?? "—"} | ${row.gap === null ? "—" : (row.gap > 0 ? "+" : "") + row.gap} |`;
  const table = (items: ReconRow[], limit = 40) => items.length
    ? ["| 层级 | 对象 | 维度 | 旧分 | 证据分 | 差值 |", "|---|---|---|---|---|---|", ...items.slice(0, limit).map(line), ...(items.length > limit ? [`\n（另有 ${items.length - limit} 条未列出）`] : [])].join("\n")
    : "无";
  return [
    `# 旧分与证据分对账`,
    ``,
    `生成时间：${generatedAt.toISOString()}　旧表 0 分视为未评分；商机级旧分 0-4 已换算为 0-100。`,
    ``,
    `## 概览`,
    ``,
    `| 指标 | 数值 |`,
    `|---|---|`,
    `| 对象数（客户 + 商机） | ${summary.targets} |`,
    `| 维度格子 | ${summary.dimensionSlots} |`,
    `| 有旧分 | ${summary.legacyScored}（${pct(summary.legacyScored, summary.dimensionSlots)}） |`,
    `| 有证据分 | ${summary.derivedScored}（${pct(summary.derivedScored, summary.dimensionSlots)}） |`,
    `| 两者都有 | ${summary.bothScored} |`,
    `| 两者都有时的平均差距 | ${summary.meanAbsGap ?? "—"} |`,
    `| 差距 ≥ ${LARGE_GAP} | ${summary.largeGaps.length} |`,
    `| 有旧分但没有任何已确认证据 | ${summary.legacyWithoutEvidence.length} |`,
    ``,
    `## 差距 ≥ ${LARGE_GAP} 的维度`,
    ``,
    table(summary.largeGaps),
    ``,
    `## 有旧分但没有任何已确认证据`,
    ``,
    `这些分数切换后会显示为“暂无证据”。需要补证据，或确认旧分本身没有依据。`,
    ``,
    table(summary.legacyWithoutEvidence),
    ``,
  ].join("\n");
}
