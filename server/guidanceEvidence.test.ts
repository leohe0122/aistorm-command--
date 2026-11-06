import { describe, expect, it } from "vitest";
import { canConfirmEvidence } from "../shared/evidencePermissions";
import { guidanceAnswerRejection, guidanceAnswerToEvidence, guidanceAnswererId, guidanceSourceKey } from "./evidence/mapping";

// 以下均为虚构测试数据，不代表任何真实客户。
const base = {
  clientId: 3,
  opportunityId: 12,
  dim: "E" as const,
  claim: "王总是最终签字人",
  answer: "王总上周说合同最终由他签字",
  question: "关于王总：谁拥有最终签字权？",
  subjectName: "王总",
  suggestedScore: 60,
  confidence: "medium" as const,
  answererUserId: 7,
  answererName: "测试 SAM",
  occurredAt: new Date("2026-11-06"),
};

describe("guidance answer → evidence candidate", () => {
  it("maps to an ai_guidance candidate on the opportunity with the verbatim answer as quote", () => {
    const draft = guidanceAnswerToEvidence(base);
    expect(draft).toMatchObject({
      clientId: 3,
      opportunityId: 12,
      sourceType: "ai_guidance",
      sourceId: 12,
      sourceKey: "guidance:u7:E",
      topics: ["E"],
      quote: "王总上周说合同最终由他签字",
      claim: "王总是最终签字人",
      kind: "observation",
      createdBy: "测试 SAM",
      suggestedScore: 50,
    });
    expect(draft).not.toHaveProperty("status");
  });

  it("strips the provisional prefix and clamps scores", () => {
    const draft = guidanceAnswerToEvidence({ ...base, claim: "SAM 待确认原文：王总签字", suggestedScore: 140 });
    expect(draft.claim).toBe("王总签字");
    expect(draft.suggestedScore).toBe(100);
    expect(guidanceAnswerToEvidence({ ...base, suggestedScore: null }).suggestedScore).toBeNull();
  });

  it("round-trips the answerer id through the source key", () => {
    expect(guidanceAnswererId(guidanceSourceKey(42, "D2"))).toBe(42);
    expect(guidanceAnswererId("item:0")).toBeNull();
    expect(guidanceAnswererId(null)).toBeNull();
  });
});

describe("non-facts never enter the ledger", () => {
  const ok = { answer: base.answer, claim: base.claim, dim: "E", subjectName: "王总" };
  it("accepts a substantive answer", () => {
    expect(guidanceAnswerRejection(ok)).toBeNull();
  });
  it("rejects unknown, nothing and not-yet-happened answers", () => {
    expect(guidanceAnswerRejection({ ...ok, answer: "不知道" })).not.toBeNull();
    expect(guidanceAnswerRejection({ ...ok, answer: "暂时还没有" })).not.toBeNull();
    expect(guidanceAnswerRejection({ ...ok, answer: "下周开评审会，结果还没出来，尚未发生" })).not.toBeNull();
  });
  it("rejects answers saying the person is unrelated to the project", () => {
    expect(guidanceAnswerRejection({ ...ok, answer: "王总与本项目无关", subjectName: "王总" })).not.toBeNull();
  });
  it("rejects action plans and missing dimensions", () => {
    expect(guidanceAnswerRejection({ ...ok, answerFocus: "action_plan" })).not.toBeNull();
    expect(guidanceAnswerRejection({ ...ok, dim: "" })).not.toBeNull();
    expect(guidanceAnswerRejection({ ...ok, claim: "" })).not.toBeNull();
  });
});

describe("who can confirm guidance evidence", () => {
  const target = { topics: ["E"], sourceType: "ai_guidance", guidanceAnswererId: 7 };
  it("lets the answerer and AD confirm, not other SAMs", () => {
    expect(canConfirmEvidence({ userId: 7, role: "user", podRole: "SAM" }, target)).toBe(true);
    expect(canConfirmEvidence({ userId: 8, role: "user", podRole: "SAM" }, target)).toBe(false);
    expect(canConfirmEvidence({ userId: 8, role: "user", podRole: "AD" }, target)).toBe(true);
  });
  it("keeps SA limited to technical topics", () => {
    expect(canConfirmEvidence({ userId: 9, role: "user", podRole: "SA" }, target)).toBe(false);
    expect(canConfirmEvidence({ userId: 9, role: "user", podRole: "SA" }, { ...target, topics: ["D1"] })).toBe(true);
  });
  it("does not let the answerer id unlock ingestion evidence", () => {
    expect(canConfirmEvidence({ userId: 7, role: "user", podRole: "SAM" }, { topics: ["E"], sourceType: "ingestion", guidanceAnswererId: 7, ingestionCreatorId: 5 })).toBe(false);
  });
});
