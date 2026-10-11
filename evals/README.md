# AI 评测

用模拟数据检验 AI 能力的质量，替代逐版本的人工生产验收。

- `cases/`：评测用例。全部为虚构客户与人物，不得放入真实客户数据。
- `graders.ts`：确定性评分规则（不编造关键人/竞品、证据可回溯、用例期望），其正确性由 `server/evalGraders.test.ts` 保证。
- `run.ts`：调用真实模型跑用例并评分。

## 运行

```bash
OPENAI_API_KEY=sk-... pnpm eval                 # 全部用例，fast 档位
OPENAI_API_KEY=sk-... pnpm eval --tier reasoning
OPENAI_API_KEY=sk-... pnpm eval --case dinner-no-facts
```

也可在 GitHub Actions 中手动运行 “AI Eval” 工作流（需配置仓库 Secret `OPENAI_API_KEY`）。

## 新增用例

在 `cases/meeting-signals.json` 中追加一项：`input` 为一次拜访记录，`expect` 写明必须识别、不得出现或必须为空的内容（字段见 `graders.ts` 的 `MeetingSignalsExpectation`）。修改提示词或模型前后各跑一次，对比通过率。
