// AI 评测入口：用模拟素材调用真实模型，按 evals/graders.ts 的规则自动评分。
//
// 用法：
//   OPENAI_API_KEY=sk-... pnpm eval                                   # 全部评测集
//   OPENAI_API_KEY=sk-... pnpm eval --suite evidence-extraction
//   OPENAI_API_KEY=sk-... pnpm eval --case dinner-no-facts
//   OPENAI_API_KEY=sk-... pnpm eval --tier reasoning --min 0.9
//
// 未设置 DATABASE_URL 时，模型提供方取自环境变量（见 server/db.ts getLLMProviderConfig）。
// 结果写入 evals/results/（已加入 .gitignore），任一评测集通过率低于 --min 时以非零状态退出。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractEvidence, type EvidenceExtractionInput } from "../server/ai/evidenceExtraction";
import { extractMeetingSignals, meetingSourceText, type MeetingSignalsInput } from "../server/ai/meetingSignals";
import type { ModelTier } from "../server/_core/modelRouting";
import {
  gradeEvidenceExtraction,
  gradeMeetingSignals,
  type Check,
  type EvidenceExtractionExpectation,
  type MeetingSignalsExpectation,
} from "./graders";

type BaseCase = { id: string; description: string };
type CaseResult = { id: string; description: string; ms: number; pass: boolean; checks: Check[]; error?: string; output?: unknown };

type Suite<C extends BaseCase> = {
  name: string;
  label: string;
  file: string;
  run: (testCase: C, tier: ModelTier) => Promise<{ checks: Check[]; output: unknown }>;
};

const meetingSignalsSuite: Suite<BaseCase & { input: MeetingSignalsInput; expect: MeetingSignalsExpectation }> = {
  name: "meeting-signals",
  label: "拜访信号提取",
  file: "cases/meeting-signals.json",
  async run(testCase, tier) {
    const { signals } = await extractMeetingSignals(testCase.input, { tier, timeoutMs: 120_000 });
    // 参会人名单也在提示词里，属于可引用的原文
    const source = [testCase.input.attendees ?? "", meetingSourceText(testCase.input)].join("\n");
    return { checks: gradeMeetingSignals(signals, source, testCase.expect), output: signals };
  },
};

const evidenceExtractionSuite: Suite<BaseCase & { input: EvidenceExtractionInput; expect: EvidenceExtractionExpectation }> = {
  name: "evidence-extraction",
  label: "投喂证据提取",
  file: "cases/evidence-extraction.json",
  async run(testCase, tier) {
    const result = await extractEvidence(testCase.input, { tier, timeoutMs: 120_000 });
    return { checks: gradeEvidenceExtraction(result.items, testCase.input.text, testCase.expect), output: result };
  },
};

const SUITES = [meetingSignalsSuite, evidenceExtractionSuite] as Array<Suite<any>>;

const here = dirname(fileURLToPath(import.meta.url));

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const escapeAnnotation = (text: string) => text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

async function runSuite(suite: Suite<any>, tier: ModelTier, only: string | undefined, concurrency: number) {
  const all = JSON.parse(readFileSync(resolve(here, suite.file), "utf8")) as BaseCase[];
  const cases = only ? all.filter(item => item.id === only) : all;
  if (cases.length === 0) return null;

  console.log(`\n${suite.label}评测 · ${cases.length} 个用例 · 档位 ${tier}`);
  const results: CaseResult[] = [];
  const runOne = async (testCase: BaseCase): Promise<CaseResult> => {
    const started = Date.now();
    try {
      const { checks, output } = await suite.run(testCase, tier);
      return { id: testCase.id, description: testCase.description, ms: Date.now() - started, pass: checks.every(check => check.pass), checks, output };
    } catch (err: any) {
      return { id: testCase.id, description: testCase.description, ms: Date.now() - started, pass: false, checks: [], error: String(err?.message || err) };
    }
  };
  for (let i = 0; i < cases.length; i += concurrency) {
    results.push(...await Promise.all(cases.slice(i, i + concurrency).map(runOne)));
  }

  for (const result of results) {
    console.log(`${result.pass ? "✅" : "❌"} ${result.id}（${(result.ms / 1000).toFixed(1)}s）${result.description}`);
    if (result.error) console.log(`   错误：${result.error}`);
    for (const check of result.checks.filter(item => !item.pass)) console.log(`   ✗ ${check.name}${check.detail ? `：${check.detail}` : ""}`);
  }

  const passed = results.filter(result => result.pass).length;
  const totalChecks = results.reduce((sum, result) => sum + result.checks.length, 0);
  const passedChecks = results.reduce((sum, result) => sum + result.checks.filter(check => check.pass).length, 0);
  const passRate = passed / results.length;
  console.log(`用例通过 ${passed}/${results.length}（${Math.round(passRate * 100)}%）· 检查项通过 ${passedChecks}/${totalChecks}`);

  // 在 GitHub Actions 中以注解输出结果，便于在 PR 检查页直接查看
  if (process.env.GITHUB_ACTIONS) {
    // GitHub 每个步骤最多显示 10 条注解：只为未通过的用例生成，通过的用例只计入汇总
    for (const result of results.filter(item => !item.pass)) {
      const failed = result.error ? [`错误：${result.error}`] : result.checks.filter(check => !check.pass).map(check => `${check.name}${check.detail ? `：${check.detail}` : ""}`);
      console.log(`::warning title=未通过 ${suite.name}/${result.id}::${escapeAnnotation([result.description, ...failed].join("\n"))}`);
    }
    console.log(`::notice title=评测汇总 ${suite.label}::${escapeAnnotation(`档位 ${tier} · 用例 ${passed}/${results.length} · 检查项 ${passedChecks}/${totalChecks}`)}`);
  }

  const outDir = resolve(here, "results");
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `${suite.name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ suite: suite.name, tier, passRate, passed, total: results.length, passedChecks, totalChecks, results }, null, 2));
  console.log(`详细结果：${file}`);
  return passRate;
}

async function main() {
  const tier = (argValue("tier") ?? "standard") as ModelTier;
  const minPassRate = Number(argValue("min") ?? "0.8");
  const only = argValue("case");
  const suiteName = argValue("suite");
  const concurrency = Number(argValue("concurrency") ?? "3");

  const suites = suiteName ? SUITES.filter(suite => suite.name === suiteName) : SUITES;
  if (suites.length === 0) throw new Error(`没有名为 ${suiteName} 的评测集，可选：${SUITES.map(suite => suite.name).join("、")}`);

  const rates: number[] = [];
  for (const suite of suites) {
    const rate = await runSuite(suite, tier, only, concurrency);
    if (rate !== null) rates.push(rate);
  }
  if (rates.length === 0) throw new Error(`没有匹配的用例：${only}`);
  if (rates.some(rate => rate < minPassRate)) {
    console.error(`\n存在评测集通过率低于阈值 ${Math.round(minPassRate * 100)}%`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
