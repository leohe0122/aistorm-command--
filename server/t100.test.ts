import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAllClients: vi.fn().mockResolvedValue([
    { id: 1, name: "美的集团", industry: "智能制造", stage: "进门", priority: "P0", keywords: ["AI", "数字化"], notes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "大疆创新", industry: "无人机/消费电子", stage: "建图", priority: "P0", keywords: ["合规", "数据安全"], notes: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getAllClientsWithVisitStats: vi.fn().mockResolvedValue([
    { id: 1, name: "美的集团", industry: "智能制造", stage: "进门", priority: "P0", keywords: ["AI", "数字化"], notes: null, createdAt: new Date(), updatedAt: new Date(), visitCount: 0, contactCount: 0, lastVisitDate: null, daysSinceLastVisit: null },
    { id: 2, name: "大疆创新", industry: "无人机/消费电子", stage: "建图", priority: "P0", keywords: ["合规", "数据安全"], notes: null, createdAt: new Date(), updatedAt: new Date(), visitCount: 0, contactCount: 0, lastVisitDate: null, daysSinceLastVisit: null },
  ]),
  getClientById: vi.fn().mockResolvedValue({ id: 1, name: "美的集团", industry: "智能制造", stage: "进门", priority: "P0", keywords: ["AI"], notes: null, createdAt: new Date(), updatedAt: new Date() }),
  updateClient: vi.fn().mockResolvedValue(undefined),
  getMeddpiccByClientId: vi.fn().mockResolvedValue({
    id: 1, clientId: 1,
    metricsScore: 60, metricsNotes: "节能降本",
    economicBuyerScore: 40, economicBuyerNotes: "张小懿",
    decisionCriteriaScore: 50, decisionCriteriaNotes: null,
    decisionProcessScore: 30, decisionProcessNotes: null,
    paperProcessScore: 20, paperProcessNotes: null,
    implicatePainScore: 70, implicatePainNotes: null,
    championScore: 40, championNotes: null,
    competitionScore: 50, competitionNotes: null,
    updatedAt: new Date(),
  }),
  upsertMeddpicc: vi.fn().mockResolvedValue(undefined),
  getSignalsByClientId: vi.fn().mockResolvedValue([]),
  getAllRecentSignals: vi.fn().mockResolvedValue([]),
  insertSignal: vi.fn().mockResolvedValue({ id: 1, clientId: 1, signalType: "人事变动", rawContent: "test", aiInterpretation: null, touchSuggestion: null, isRead: false, createdAt: new Date() }),
  updateSignal: vi.fn().mockResolvedValue(undefined),
  getActionsByClientId: vi.fn().mockResolvedValue([]),
  getActionsByRole: vi.fn().mockResolvedValue([]),
  insertActions: vi.fn().mockResolvedValue([]),
  completeAction: vi.fn().mockResolvedValue(undefined),
  getOnePagersByClientId: vi.fn().mockResolvedValue([]),
  insertOnePager: vi.fn().mockResolvedValue({ id: 1, clientId: 1, targetExecutive: "张小懿", targetTitle: "CDO", content: "test", createdAt: new Date() }),
  getAmmoByClientId: vi.fn().mockResolvedValue([]),
  insertAmmo: vi.fn().mockResolvedValue({ id: 1, clientId: 1, championName: "张三", ammoType: "竞品对标", content: "test", createdAt: new Date() }),
  getMeetingsByClientId: vi.fn().mockResolvedValue([]),
  insertMeeting: vi.fn().mockResolvedValue({ id: 1, clientId: 1, meetingDate: new Date(), attendees: null, keyPoints: "test", aiMinutes: null, nextSteps: null, responsiblePerson: null, dueDate: null, createdAt: new Date() }),
  updateMeeting: vi.fn().mockResolvedValue(undefined),
  getPodTasksByRole: vi.fn().mockResolvedValue([]),
  insertPodTask: vi.fn().mockResolvedValue({ id: 1, clientId: 1, assignedRole: "SAM", title: "test", description: null, dueDate: null, isCompleted: false, completedAt: null, createdAt: new Date() }),
  completePodTask: vi.fn().mockResolvedValue(undefined),
  getLatestScoreByClientId: vi.fn().mockResolvedValue(undefined),
  insertScore: vi.fn().mockResolvedValue(undefined),
  getDealReviews: vi.fn().mockResolvedValue([]),
  insertDealReview: vi.fn().mockResolvedValue({ id: 1, clientId: 1, reviewDate: new Date(), content: "test", nextSteps: null, createdAt: new Date() }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "AI分析结果：这是一个高优先级商机，建议立即推进。" } }]
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

describe("T100 POD Command - clients router", () => {
  it("lists all clients", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.clients.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("美的集团");
  });

  it("gets a single client by id", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.clients.get({ id: 1 });
    expect(result?.name).toBe("美的集团");
    expect(result?.priority).toBe("P0");
  });
});

describe("T100 POD Command - meddpicc router", () => {
  it("gets meddpicc data for a client", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.meddpicc.get({ clientId: 1 });
    expect(result).toBeDefined();
    expect(result?.metricsScore).toBe(60);
    expect(result?.implicatePainScore).toBe(70);
  });
});

describe("T100 POD Command - intelligence router", () => {
  it("lists signals by client", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.intelligence.listByClient({ clientId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists all recent signals", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.intelligence.listAll();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("T100 POD Command - pod router", () => {
  it("lists tasks by role", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.pod.listByRole({ role: "SAM" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds a pod task", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.pod.addTask({
      clientId: 1,
      assignedRole: "SAM",
      title: "完成美的集团1-Pager",
    });
    // Mock returns fixed values; verify the shape is correct
    expect(result.id).toBe(1);
    expect(result.clientId).toBe(1);
  });

  it("lists deal reviews", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.pod.listDealReviews();
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds a deal review", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.pod.addDealReview({
      clientId: 1,
      content: "美的集团当前处于进门阶段，需要推进经济买家接触",
      nextSteps: "安排AD与张小懿会面",
    });
    expect(result.content).toBe("test"); // mocked return
    expect(result.clientId).toBe(1);
  });
});

describe("T100 POD Command - auth router", () => {
  it("returns null user when not authenticated", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("clears session cookie on logout", async () => {
    const ctx = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
