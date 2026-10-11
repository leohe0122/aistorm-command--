import { describe, expect, it } from "vitest";
import { meetingSignalsToEvidence, purchaseSignalToEvidence } from "./evidence/mapping";
import type { FullMeetingSignals } from "./aiNativeGuidance";

const signals: FullMeetingSignals = {
  meetingSummary: "示例",
  meddpiccUpdates: [{ dim: "E", suggestedScore: 75, evidence: "最终由CIO刘明签字", confidence: "high" }],
  contactDiscoveries: [
    { name: "刘明", title: "CIO", buyingRole: "经济决策人", attitude: "未知", evidence: "最终由CIO刘明签字" },
    { name: "马超", title: null, buyingRole: "反对者", attitude: "反对", evidence: "不支持再测" },
  ],
  competitorMentions: [{ competitorName: "深信服", context: "合作五年", threatLevel: "high" }],
  timeSignals: [{ type: "deadline", description: "合同明年3月到期", date: "2027-03-31" }],
  threeWhyUpdates: { whyChange: null, whyNow: "合同到期不续签", whyUs: null },
  winFactorAlerts: [],
  nextBestAction: "确认选型时间表",
};

describe("meeting signals → evidence", () => {
  const drafts = meetingSignalsToEvidence(signals, { clientId: 7, meetingId: 42, occurredAt: new Date("2026-10-08") });

  it("uses the same keys as the confirmation card", () => {
    expect(drafts.map(draft => draft.sourceKey)).toEqual(["meddpicc:E", "contact:0", "contact:1", "time:0", "competitor:0", "threewhy:now"]);
  });

  it("points every draft back to the meeting", () => {
    for (const draft of drafts) {
      expect(draft.sourceType).toBe("meeting");
      expect(draft.sourceId).toBe(42);
      expect(draft.clientId).toBe(7);
    }
  });

  it("keeps the 0-100 suggested score and tags dimensions", () => {
    const meddpicc = drafts.find(draft => draft.sourceKey === "meddpicc:E")!;
    expect(meddpicc.suggestedScore).toBe(75);
    expect(meddpicc.topics).toEqual(["E"]);
    expect(drafts.find(draft => draft.sourceKey === "contact:0")!.topics).toEqual(["stakeholder", "E"]);
    expect(drafts.find(draft => draft.sourceKey === "time:0")!.topics).toContain("why_now");
  });

  it("records negative stances and serious competitors as negative evidence", () => {
    expect(drafts.find(draft => draft.sourceKey === "contact:1")!.polarity).toBe("negative");
    expect(drafts.find(draft => draft.sourceKey === "competitor:0")!.polarity).toBe("negative");
  });
});

describe("purchase signal → evidence", () => {
  it("keeps who said what and links back to the signal", () => {
    const draft = purchaseSignalToEvidence({
      id: 9, clientId: 7, signalType: "decision_chain", subjectName: "刘明", subjectContactId: 3,
      occurredAt: new Date("2026-10-01"), statement: "下周会把评估结论报给董事会", sourceType: "customer_email", createdBy: "陈晨",
    });
    expect(draft).toMatchObject({ sourceType: "purchase_signal", sourceId: 9, contactId: 3, quote: "下周会把评估结论报给董事会", kind: "statement" });
    expect(draft.topics).toContain("E");
  });
});
