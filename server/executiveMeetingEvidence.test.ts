import { describe, expect, it } from "vitest";
import { meetingMatchesExecutive, normalizeEvidenceText } from "../shared/executiveMeetingEvidence";

describe("高层拜访证据预检", () => {
  it("忽略空格与常见分隔符的格式差异", () => {
    expect(normalizeEvidenceText("张 伟·CIO")).toContain(normalizeEvidenceText("张伟"));
    expect(meetingMatchesExecutive({ id: 1, attendees: "张 伟 · CIO" }, "张伟")).toBe(true);
  });

  it("不会把不同英文名或缩写猜测为同一高层", () => {
    expect(meetingMatchesExecutive({ id: 2, attendees: "M. Chow" }, "Marcos Chow")).toBe(false);
  });

  it("可从纪要正文中识别直接对话事实", () => {
    expect(meetingMatchesExecutive({ id: 3, keyPoints: "与 Marcos Chow 讨论年度采购节奏" }, "Marcos Chow")).toBe(true);
  });
});
