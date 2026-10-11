import { describe, expect, it } from "vitest";
import {
  AD_ONLY_PATHS,
  ENTITY_ID_RULES,
  collectEntityIds,
  collectInputClientIds,
  computeClientScope,
  emailUserIdFromOpenId,
  filterByScope,
  recomputeDashboardAggregates,
  scopeAllows,
} from "../shared/accessScope";

const clients = [
  { id: 1, assignedSamId: 101, assignedRsmId: 201 },
  { id: 2, assignedSamId: 102, assignedRsmId: 201 },
  { id: 3, assignedSamId: null, assignedRsmId: null },
];
const opportunities = [
  { clientId: 2, assignedSaId: 301 },
  { clientId: 3, assignedSaId: 302 },
];

describe("client visibility rules", () => {
  it("maps email session users to email_users ids", () => {
    expect(emailUserIdFromOpenId("email_101")).toBe(101);
    expect(emailUserIdFromOpenId("oauth_abc")).toBeNull();
  });

  it("gives AD and admins every client", () => {
    expect(computeClientScope({ role: "user", podRole: "AD", emailUserId: 1 }, clients, opportunities)).toEqual({ all: true });
    expect(computeClientScope({ role: "admin", podRole: "SAM", emailUserId: 101 }, clients, opportunities)).toEqual({ all: true });
  });

  it("limits a SAM to clients assigned to them", () => {
    const scope = computeClientScope({ role: "user", podRole: "SAM", emailUserId: 101 }, clients, opportunities);
    expect(scope.all).toBe(false);
    expect([...(scope as any).clientIds]).toEqual([1]);
  });

  it("limits an RSM to clients assigned to them", () => {
    const scope = computeClientScope({ role: "user", podRole: "RSM", emailUserId: 201 }, clients, opportunities);
    expect([...(scope as any).clientIds].sort()).toEqual([1, 2]);
  });

  it("limits an SA to clients of opportunities assigned to them", () => {
    const scope = computeClientScope({ role: "user", podRole: "SA", emailUserId: 302 }, clients, opportunities);
    expect([...(scope as any).clientIds]).toEqual([3]);
  });

  it("gives nothing to users without an email identity or role", () => {
    expect(computeClientScope({ role: "user", podRole: "SAM", emailUserId: null }, clients, opportunities)).toEqual({ all: false, clientIds: new Set() });
    expect(computeClientScope({ role: "user", podRole: null, emailUserId: 101 }, clients, opportunities)).toEqual({ all: false, clientIds: new Set() });
  });

  it("treats records without a client as hidden unless allowed", () => {
    const scope = { all: false as const, clientIds: new Set([1]) };
    expect(scopeAllows(scope, 1)).toBe(true);
    expect(scopeAllows(scope, 2)).toBe(false);
    expect(scopeAllows(scope, null)).toBe(false);
    expect(scopeAllows(scope, null, true)).toBe(true);
  });
});

describe("input inspection", () => {
  it("collects client ids from input", () => {
    expect(collectInputClientIds({ clientId: 5, sourceClientId: 6, name: "x" })).toEqual([5, 6]);
    expect(collectInputClientIds(undefined)).toEqual([]);
  });

  it("collects entity ids for id-based endpoints", () => {
    expect(collectEntityIds(ENTITY_ID_RULES["meetings.deleteBatch"], { ids: [1, 2] })).toEqual([1, 2]);
    expect(collectEntityIds(ENTITY_ID_RULES["actions.adoptOne"], { actionId: 9, clientId: 1 })).toEqual([9]);
  });

  it("marks cross-client and assignment operations as AD-only", () => {
    for (const path of ["clients.delete", "clients.assignSam", "opportunities.assignSa", "adCommand.refresh", "pod.clearByRole"]) {
      expect(AD_ONLY_PATHS.has(path)).toBe(true);
    }
    expect(AD_ONLY_PATHS.has("clients.list")).toBe(false);
  });
});

describe("response filtering", () => {
  const scope = { all: false as const, clientIds: new Set([1]) };

  it("drops client rows and client-scoped records outside the scope, at any depth", () => {
    const data = {
      clientCount: 3,
      clients: [
        { id: 1, name: "A", assignedSamId: 101, opportunities: [{ id: 11, clientId: 1 }] },
        { id: 2, name: "B", assignedSamId: 102, opportunities: [{ id: 21, clientId: 2 }] },
      ],
      decisionLayerCoverage: [{ clientId: 1, clientName: "A" }, { clientId: 2, clientName: "B" }],
      library: [{ id: 7, clientId: null, title: "通用竞品卡" }],
      createdAt: new Date("2026-10-11T00:00:00Z"),
    };
    const out = filterByScope(data, scope);
    expect(out.clients.map(client => client.id)).toEqual([1]);
    expect(out.clients[0].opportunities).toEqual([{ id: 11, clientId: 1 }]);
    expect(out.decisionLayerCoverage.map(row => row.clientId)).toEqual([1]);
    expect(out.library).toHaveLength(1);
    expect(out.createdAt).toBeInstanceOf(Date);
  });

  it("can hide records with no client for global AD views", () => {
    const out = filterByScope([{ id: 1, clientId: null }, { id: 2, clientId: 1 }], scope, true);
    expect(out.map(row => row.id)).toEqual([2]);
  });

  it("returns data untouched for full access", () => {
    const data = [{ id: 2, clientId: 2 }];
    expect(filterByScope(data, { all: true })).toBe(data);
  });
});

describe("dashboard aggregates", () => {
  it("recounts totals from the visible clients only", () => {
    const scope = { all: false as const, clientIds: new Set([1, 3]) };
    const summary = {
      clientCount: 3,
      stageDistribution: { 建图: 2, 进门: 1 },
      visitedThisWeekCount: 2,
      clients: [
        { id: 1, stage: "建图", assignedSamId: 101, visitedThisWeek: true },
        { id: 2, stage: "建图", assignedSamId: 102, visitedThisWeek: true },
        { id: 3, stage: "进门", assignedSamId: 101, visitedThisWeek: false },
      ],
    };
    const out = recomputeDashboardAggregates(filterByScope(summary, scope));
    expect(out.clientCount).toBe(2);
    expect(out.stageDistribution).toEqual({ 建图: 1, 进门: 1 });
    expect(out.visitedThisWeekCount).toBe(1);
  });
});
