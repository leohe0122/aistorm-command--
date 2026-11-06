import { beforeEach, describe, expect, it, vi } from "vitest";

const updates: Array<Record<string, unknown>> = [];
let selectRows: unknown[][] = [];

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => {
      const chain: any = { from: () => chain, where: () => chain, limit: async () => selectRows.shift() ?? [] };
      return chain;
    },
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push(values); return [{ affectedRows: 2 }]; } }) }),
  }),
}));

vi.mock("./ai/evidenceExtraction", () => ({
  extractEvidence: vi.fn(async () => { throw new Error("模型超时"); }),
}));

import {
  INGESTION_STALE_MS,
  STALE_ERROR_MESSAGE,
  canManageIngestion,
  canRetryIngestion,
  isStaleIngestion,
  recoverStaleIngestions,
  runIngestionExtraction,
} from "./evidence/ingestionJobs";

describe("ingestion stale detection", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  it("treats pending rows older than the limit as interrupted", () => {
    expect(isStaleIngestion({ status: "pending", updatedAt: new Date(now.getTime() - INGESTION_STALE_MS - 1) }, now)).toBe(true);
    expect(isStaleIngestion({ status: "pending", updatedAt: new Date(now.getTime() - 60_000) }, now)).toBe(false);
    expect(isStaleIngestion({ status: "failed", updatedAt: new Date(0) }, now)).toBe(false);
    expect(isStaleIngestion({ status: "pending", updatedAt: null }, now)).toBe(false);
  });

  it("allows retry only for failed or interrupted material", () => {
    expect(canRetryIngestion({ status: "failed", updatedAt: now }, now)).toBe(true);
    expect(canRetryIngestion({ status: "done", updatedAt: new Date(0) }, now)).toBe(false);
    expect(canRetryIngestion({ status: "pending", updatedAt: now }, now)).toBe(false);
    expect(canRetryIngestion({ status: "pending", updatedAt: new Date(0) }, now)).toBe(true);
  });

  it("limits retry to the submitter, AD and admins", () => {
    expect(canManageIngestion({ userId: 5, role: "user", podRole: "SAM" }, 5)).toBe(true);
    expect(canManageIngestion({ userId: 6, role: "user", podRole: "SAM" }, 5)).toBe(false);
    expect(canManageIngestion({ userId: 6, role: "user", podRole: "SA" }, 5)).toBe(false);
    expect(canManageIngestion({ userId: 6, role: "user", podRole: "AD" }, 5)).toBe(true);
    expect(canManageIngestion({ userId: 6, role: "admin", podRole: null }, 5)).toBe(true);
  });
});

describe("ingestion job persistence", () => {
  beforeEach(() => { updates.length = 0; selectRows = []; });

  it("marks stale pending rows as failed with a retry hint", async () => {
    expect(await recoverStaleIngestions()).toBe(2);
    expect(updates).toEqual([{ status: "failed", error: STALE_ERROR_MESSAGE }]);
  });

  it("never leaves a row pending when extraction throws", async () => {
    selectRows = [
      [{ id: 1, clientId: 3, opportunityId: null, kind: "email", title: null, occurredAt: new Date("2026-11-01"), createdAt: new Date("2026-11-01"), rawText: "x".repeat(30) }],
      [{ name: "测试客户" }],
      [],
    ];
    await runIngestionExtraction(1);
    expect(updates.at(-1)).toMatchObject({ status: "failed", error: "模型超时" });
  });
});
