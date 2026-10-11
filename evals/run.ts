// AI 评测入口：用模拟拜访记录调用真实模型，按 evals/graders.ts 的规则自动评分。
//
// 用法：
//   OPENAI_API_KEY=sk-... pnpm eval                      # 全部用例
//   OPENAI_API_KEY=sk-... pnpm eval --case dinner-no-facts
//   OPENAI_API_KEY=sk-... pnpm eval --tier reasoning --min 0.9
//
// 未设置 DATABASE_URL 时，模型提供方取自环境变量（见 server/db.ts getLLMProviderConfig）。
// 结果写入 evals/results/（已加入 .gitignore），通过率低于 --min 时以非零状态退出。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractMeetingSignals, meetingSourceText, type MeetingSignalsInput } from "../server/ai/meetingSignals";
import type { ModelTier } from "../server/_core/modelRouting";
import { gradeMeetingSignals, type Check, type MeetingSignalsExpectation } from "./graders";

type MeetingSignalsCase = { id: string; description: string; input: MeetingSignalsInput; expect: MeetingSignalsExpectation };
type CaseResult = { id: string; description: string; ms: number; pass: boolean; checks: Check[]; error?: string; output?: unknown };

const here = dirname(fileURLToPath(import.meta.url));

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runCase(testCase: MeetingSignalsCase, tier: ModelTier): Promise<CaseResult> {
  const started = Date.now();
  try {
    const output = await extractMeetingSignals(testCase.input, { tier, timeoutMs: 120_000 });
    // 参会人名单也在提示词里，属于可引用的原文
    const source = [testCase.input.attendees ?? "", meetingSourceText(testCase.input)].join("\n");
    const checks = gradeMeetingSignals(output, source, testCase.expect);
    return { id: testCase.id, description: testCase.description, ms: Date.now() - started, pass: checks.every(check => check.pass), checks, output };
  } catch (err: any) {
    return { id: testCase.id, description: testCase.description, ms: Date.now() - started, pass: false, checks: [], error: String(err?.message || err) };
  }
}

async function main() {
  const tier = (argValue("tier") ?? "fast") as ModelTier;
  const minPassRate = Number(argValue("min") ?? "0.8");
  const only = argValue("case");
  const concurrency = Number(argValue("concurrency") ?? "3");

  const all = JSON.parse(readFileSync(resolve(here, "cases/meeting-signals.json"), "utf8")) as MeetingSignalsCase[];
  const cases = only ? all.filter(item => item.id === only) : all;
  if (cases.length === 0) throw new Error(`没有匹配的用例：${only}`);

  console.log(`拜访信号提取评测 · ${cases.length} 个用例 · 档位 ${tier}\n`);
  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i += concurrency) {
    results.push(...await Promise.all(cases.slice(i, i + concurrency).map(item => runCase(item, tier))));
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
  console.log(`\n用例通过 ${passed}/${results.length}（${Math.round(passRate * 100)}%）· 检查项通过 ${passedChecks}/${totalChecks}`);

  // 在 GitHub Actions 中以注解输出结果，便于在 PR 检查页直接查看
  if (process.env.GITHUB_ACTIONS) {
    const escape = (text: string) => text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
    for (const result of results) {
      const failed = result.error ? [`错误：${result.error}`] : result.checks.filter(check => !check.pass).map(check => `${check.name}${check.detail ? `：${check.detail}` : ""}`);
      const level = result.pass ? "notice" : "warning";
      console.log(`::${level} title=${result.pass ? "通过" : "未通过"} ${result.id}::${escape([result.description, ...failed].join("\n"))}`);
    }
    console.log(`::notice title=评测汇总::${escape(`档位 ${tier} · 用例 ${passed}/${results.length} · 检查项 ${passedChecks}/${totalChecks}`)}`);
  }

  const outDir = resolve(here, "results");
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `meeting-signals-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ tier, passRate, passed, total: results.length, passedChecks, totalChecks, results }, null, 2));
  console.log(`详细结果：${file}`);

  if (passRate < minPassRate) {
    console.error(`通过率低于阈值 ${Math.round(minPassRate * 100)}%`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
