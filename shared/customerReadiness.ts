export type CustomerStage = "建图" | "进门" | "定痛" | "找人" | "进入商机";

export type ReadinessContact = {
  id: number;
  name: string;
  buyingRole?: string | null;
  relationship?: string | null;
};

export type ReadinessMeeting = {
  id: number;
  meetingDate: Date | string;
  attendees?: string | null;
  keyPoints?: string | null;
};

export type CustomerEvidence = {
  metricsNotes?: string | null;
  economicBuyerNotes?: string | null;
  implicatePainNotes?: string | null;
  championNotes?: string | null;
};

export type GateCheck = {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
  objective: string;
};

export type StandardAction = GateCheck & {
  role: "SAM" | "AD";
  stage: CustomerStage;
  action: string;
};

export type CustomerReadiness = {
  stage: CustomerStage;
  checks: GateCheck[];
  standardActions: StandardAction[];
  canApplyForOpportunity: boolean;
  blockers: GateCheck[];
  championName?: string;
  latestMeetingDate?: string;
};

const hasText = (value?: string | null, minimum = 1) => Boolean(value?.trim() && value.trim().length >= minimum);

const roleMatch = (contacts: ReadinessContact[], roles: string[]) => contacts.some(contact => roles.includes(contact.buyingRole || ""));

function formatMeetingDate(meetings: ReadinessMeeting[]) {
  const latest = [...meetings].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())[0];
  return latest ? new Date(latest.meetingDate).toISOString() : undefined;
}

export function evaluateCustomerReadiness(input: {
  stage: CustomerStage;
  contacts: ReadinessContact[];
  meetings: ReadinessMeeting[];
  evidence?: CustomerEvidence | null;
  activeOpportunityCount?: number;
  hookTopic?: string | null;
  securityAngle?: string | null;
}): CustomerReadiness {
  const { stage, contacts, meetings, evidence, hookTopic, securityAngle } = input;
  const champion = contacts.find(contact => contact.relationship === "Champion" || contact.buyingRole === "Champion");
  const hasChampion = Boolean(champion);
  const championDirectMeeting = Boolean(champion && meetings.some(meeting => (meeting.attendees || "").includes(champion.name)));
  const hasFirstVerifiedMeeting = meetings.some(meeting => hasText(meeting.keyPoints, 15));
  const hasPainEvidence = hasText(evidence?.implicatePainNotes, 10) || meetings.some(meeting => hasText(meeting.keyPoints, 30));
  const hasDecisionPath = roleMatch(contacts, ["经济决策人", "技术决策人"]);
  const hasEntryAngle = hasText(hookTopic, 3) || hasText(securityAngle, 3);
  const hasThreeMappedContacts = contacts.length >= 3;
  const hasSecondMeeting = meetings.filter(meeting => hasText(meeting.keyPoints, 15)).length >= 2;

  const checks: GateCheck[] = [
    {
      id: "mapped_contacts",
      label: "已建立最少 3 位客户关键人",
      passed: hasThreeMappedContacts,
      evidence: `系统已记录 ${contacts.length} 位关键人。`,
      objective: "关键人图谱中至少有 3 条可追溯联系人记录。",
    },
    {
      id: "verified_meeting",
      label: "已记录至少一次有效客户对话",
      passed: hasFirstVerifiedMeeting,
      evidence: `系统中有 ${meetings.filter(meeting => hasText(meeting.keyPoints, 15)).length} 条含会议要点的拜访记录。`,
      objective: "拜访记录必须带日期和不少于 15 个字符的会议要点。",
    },
    {
      id: "pain_evidence",
      label: "已记录客户确认的痛点或影响事实",
      passed: hasPainEvidence,
      evidence: hasPainEvidence ? "痛点证据已写入客户 MEDDPICC 备注或拜访纪要。" : "未发现足够的客户原话、痛点或影响记录。",
      objective: "必须有已入库的客户原话、会议要点或痛点证据，不能以“客户有兴趣”替代。",
    },
    {
      id: "decision_path",
      label: "已识别经济或技术决策路径",
      passed: hasDecisionPath,
      evidence: hasDecisionPath ? "关键人图谱已标注经济决策人或技术决策人。" : "关键人图谱尚未标注经济决策人或技术决策人。",
      objective: "关键人图谱中必须至少标注一名经济决策人或技术决策人。",
    },
    {
      id: "champion_direct_dialogue",
      label: "已识别 Champion 且存在直接对话记录",
      passed: hasChampion && championDirectMeeting,
      evidence: hasChampion
        ? championDirectMeeting
          ? `${champion?.name} 已标注为 Champion，且其姓名出现在带时间戳的拜访记录中。`
          : `${champion?.name} 已标注为 Champion，但尚未发现包含其姓名的直接对话记录。`
        : "尚未在关键人图谱中标注 Champion。",
      objective: "Champion 必须同时存在于关键人图谱，并出现在一条已入库拜访的参会人记录中。",
    },
  ];

  const stageActions: Record<CustomerStage, StandardAction[]> = {
    建图: [
      { ...checks[0], role: "SAM", stage, action: "补齐至少 3 位关键人，并明确其组织角色与汇报关系。" },
      { id: "entry_angle", label: "已确定进入切口", passed: hasEntryAngle, evidence: hasEntryAngle ? "敲门砖或安全切入点已入库。" : "尚未记录敲门砖或安全切入点。", objective: "客户档案中至少有一条可验证的进入切口。", role: "SAM", stage, action: "记录客户相关的敲门砖或安全切入点，并标明事实来源。" },
    ],
    进门: [
      { ...checks[1], role: "SAM", stage, action: "录入第一次有效客户对话：时间、参会人、客户原话与下一步。" },
      { ...checks[3], role: "SAM", stage, action: "在关键人图谱中标明已知的经济或技术决策路径。" },
    ],
    定痛: [
      { ...checks[2], role: "SAM", stage, action: "将客户原话、业务影响或安全风险回填为可复核证据。" },
      { id: "second_meeting", label: "已完成第二次有效验证", passed: hasSecondMeeting, evidence: `系统中有 ${meetings.filter(meeting => hasText(meeting.keyPoints, 15)).length} 条有效对话记录。`, objective: "至少两条带日期与会议要点的拜访记录。", role: "SAM", stage, action: "安排第二次验证对话，核验痛点的影响范围与优先级。" },
    ],
    找人: [
      { ...checks[4], role: "SAM", stage, action: "确认 Champion，并在拜访记录中留下其直接参与的对话事实。" },
      { ...checks[3], role: "AD", stage, action: "审核决策路径是否足以支持申请开商机。" },
    ],
    进入商机: [],
  };

  const gateChecks = [checks[1], checks[2], checks[3], checks[4]];
  const canApplyForOpportunity = stage === "找人" && gateChecks.every(check => check.passed);
  return {
    stage,
    checks,
    standardActions: stageActions[stage],
    canApplyForOpportunity,
    blockers: gateChecks.filter(check => !check.passed),
    championName: champion?.name,
    latestMeetingDate: formatMeetingDate(meetings),
  };
}
