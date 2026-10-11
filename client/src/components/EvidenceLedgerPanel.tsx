import { useState } from "react";
import { ChevronDown, ChevronRight, FileCheck2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const DIMENSIONS: Array<{ code: string; label: string }> = [
  { code: "M", label: "价值量化" },
  { code: "E", label: "经济决策人" },
  { code: "D1", label: "决策标准" },
  { code: "D2", label: "决策流程" },
  { code: "P", label: "采购流程" },
  { code: "I", label: "痛点牵连" },
  { code: "C1", label: "Champion" },
  { code: "C2", label: "竞争态势" },
];

const SOURCE_LABELS: Record<string, string> = {
  meeting: "拜访记录",
  email: "邮件",
  call: "电话",
  document: "文件",
  ai_guidance: "AI 引导问答",
  purchase_signal: "购买信号",
  intelligence: "外部情报",
  manual: "手工录入",
  legacy: "历史数据",
};

const scoreTone = (score: number) => score >= 75 ? "text-emerald-200 border-emerald-400/30 bg-emerald-400/10"
  : score >= 50 ? "text-cyan-200 border-cyan-400/30 bg-cyan-400/10"
  : "text-amber-200 border-amber-400/30 bg-amber-400/10";

const formatDate = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleDateString("zh-CN") : "—";

/**
 * 证据台账视图：每个 MEDDPICC 维度的分数由已确认证据推导，点开即可看到依据。
 * 与原有手工评分并列展示（第 2 阶段），不改动原有数据。
 */
export function EvidenceLedgerPanel({ clientId, opportunityId }: { clientId: number; opportunityId?: number }) {
  const { data, isLoading } = trpc.ledger.forTarget.useQuery({ clientId, opportunityId });
  const [open, setOpen] = useState<string | null>(null);

  const evidenceById = new Map((data?.evidence ?? []).map(item => [item.id, item]));
  const assessmentByDim = new Map((data?.assessments ?? []).map(item => [item.dimension, item]));

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100"><FileCheck2 className="h-4 w-4 text-cyan-300" />证据推导评分</h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">分数只由已确认的客户证据推导，点开维度查看依据。没有证据的维度不打分。</p>
        </div>
        {data && data.candidateCount > 0 ? <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">{data.candidateCount} 条 AI 候选待确认</span> : null}
      </div>

      {isLoading ? <p className="py-6 text-center text-xs text-slate-500">加载中…</p> : (
        <div className="space-y-1.5">
          {DIMENSIONS.map(({ code, label }) => {
            const assessment = assessmentByDim.get(code);
            const expanded = open === code;
            const items = (assessment?.evidenceIds ?? []).map(id => evidenceById.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof evidenceById.get>>[];
            return (
              <div key={code} className="rounded-lg border border-slate-800 bg-slate-900/40">
                <button
                  type="button"
                  disabled={!assessment}
                  onClick={() => setOpen(expanded ? null : code)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-default"
                >
                  {assessment ? (expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />) : <span className="w-3.5" />}
                  <span className="w-8 text-[10px] font-semibold text-slate-500">{code}</span>
                  <span className="flex-1 text-xs text-slate-200">{label}</span>
                  {assessment ? (
                    <>
                      <span className="text-[10px] text-slate-500">{assessment.evidenceIds.length} 条证据</span>
                      <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", scoreTone(assessment.score ?? 0))}>{assessment.score}</span>
                    </>
                  ) : <span className="text-[10px] text-slate-600">暂无证据</span>}
                </button>
                {expanded && assessment ? (
                  <div className="border-t border-slate-800 px-3 py-2">
                    <p className="mb-2 text-[11px] text-slate-400">{assessment.rationale}{assessment.overridden ? ` · 已人工调整（原 ${assessment.computedScore}）：${assessment.overrideReason ?? ""}` : ""}</p>
                    <ul className="space-y-1.5">
                      {items.map(item => (
                        <li key={item.id} className={cn("rounded border-l-2 bg-slate-950/50 px-2 py-1.5", item.polarity === "negative" ? "border-rose-400/60" : item.polarity === "positive" ? "border-emerald-400/60" : "border-slate-600")}>
                          <p className="text-[11px] text-slate-200">{item.claim}</p>
                          {item.quote && item.quote !== item.claim ? <p className="mt-0.5 text-[10px] italic text-slate-400">“{item.quote}”</p> : null}
                          <p className="mt-0.5 text-[10px] text-slate-500">{SOURCE_LABELS[item.sourceType] ?? item.sourceType}{item.sourceId ? ` #${item.sourceId}` : ""} · {formatDate(item.occurredAt)} · 确认人 {item.confirmedBy ?? "—"}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
