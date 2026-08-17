export type ExecutiveMeetingRecord = {
  id: number;
  attendees?: string | null;
  keyPoints?: string | null;
  transcriptText?: string | null;
  aiMinutes?: string | null;
};

/**
 * 仅做可解释的规范化：忽略空格、全半角空格和常见分隔符。
 * 不将英文别名、缩写或不同姓名猜测为同一人，避免误把无关拜访作为高层证据。
 */
export function normalizeEvidenceText(value?: string | null) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[\s\u3000·•,，;；:：()（）\-_.]/g, "");
}

export function meetingMatchesExecutive(meeting: ExecutiveMeetingRecord, executiveName?: string | null) {
  const normalizedName = normalizeEvidenceText(executiveName);
  if (normalizedName.length < 2) return false;
  const evidence = normalizeEvidenceText([
    meeting.attendees,
    meeting.keyPoints,
    meeting.transcriptText,
    meeting.aiMinutes,
  ].filter(Boolean).join(" "));
  return evidence.includes(normalizedName);
}

export function classifyExecutiveMeetings(meetings: ExecutiveMeetingRecord[], executiveName?: string | null) {
  return meetings.map(meeting => ({ ...meeting, executiveDetected: meetingMatchesExecutive(meeting, executiveName) }));
}
