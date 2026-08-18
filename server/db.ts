import { eq, desc, and, gte, sql, count, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  clients, Client, InsertClient,
  meddpicc, Meddpicc, InsertMeddpicc,
  intelligenceSignals, IntelligenceSignal, InsertIntelligenceSignal,
  actionItems, ActionItem, InsertActionItem,
  onePagers, OnePager, InsertOnePager,
  championAmmo, ChampionAmmo, InsertChampionAmmo,
  meetingMinutes, MeetingMinute, InsertMeetingMinute,
  podTasks, PodTask, InsertPodTask,
  opportunityScores, OpportunityScore, InsertOpportunityScore,
  opportunities, Opportunity,
  dealReviews, DealReview, InsertDealReview,
  keyContacts, KeyContact, InsertKeyContact,
  meddpiccSnapshots, MeddpiccSnapshot, InsertMeddpiccSnapshot,
  systemConfig, SystemConfig,
  arsenalWeapons, ArsenalWeapon, InsertArsenalWeapon,
  arsenalAttachments, ArsenalAttachment, InsertArsenalAttachment,
  arsenalPricing, ArsenalPricing, InsertArsenalPricing,
  aiReviews, AiReview, InsertAiReview,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ──────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Clients ────────────────────────────────────────────────────────────────
// In-memory cache for clients list (TTL 30s)
let _clientsCache: { data: (Client & { visitCount: number; lastVisitDate: Date | null })[]; expiresAt: number } | null = null;
export function invalidateClientsCache() { _clientsCache = null; }

export async function getAllClients(): Promise<Client[]> {
  const db = await getDb();
  if (!db) return [];
  // isTest clients first (亚信安全 test client at top), then by priority, then id
  return db.select().from(clients).orderBy(desc(clients.isTest), clients.priority, clients.id);
}

export async function getAllClientsWithVisitStats(): Promise<(Client & { visitCount: number; lastVisitDate: Date | null })[]> {
  const db = await getDb();
  if (!db) return [];
  if (_clientsCache && _clientsCache.expiresAt > Date.now()) return _clientsCache.data;
  const allClients = await db.select().from(clients).orderBy(desc(clients.isTest), clients.priority, clients.id);
  // Get visit counts and last visit dates for all clients in one query
  const stats = await db
    .select({
      clientId: meetingMinutes.clientId,
      visitCount: count(meetingMinutes.id),
      lastVisitDate: max(meetingMinutes.meetingDate),
    })
    .from(meetingMinutes)
    .groupBy(meetingMinutes.clientId);
  const statsMap = new Map(stats.map((s) => [s.clientId, s]));
  const result = allClients.map((c) => ({
    ...c,
    visitCount: statsMap.get(c.id)?.visitCount ?? 0,
    lastVisitDate: statsMap.get(c.id)?.lastVisitDate ?? null,
  }));
  _clientsCache = { data: result, expiresAt: Date.now() + 30_000 };
  return result;
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function updateClient(id: number, data: Partial<InsertClient>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // 当 stage 变更时自动写入 stageChangedAt，精确记录阶段停留起始时间
  const updateData: any = { ...data };
  if (data.stage !== undefined) {
    updateData.stageChangedAt = new Date();
  }
  await db.update(clients).set(updateData).where(eq(clients.id, id));
}

export async function insertClient(data: Omit<InsertClient, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const result = await db.insert(clients).values(data);
  const newId = (result as any)[0]?.insertId ?? 0;
  // Auto-initialize MEDDPICC record so all features work immediately
  if (newId) {
    await db.insert(meddpicc).values({ clientId: newId });
  }
  return newId;
}

export async function deleteClientCascade(clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  // Delete all related data in dependency order
  const {
    meddpicc, intelligenceSignals, actionItems, onePagers, championAmmo,
    meetingMinutes, podTasks, meddpiccLogs, opportunityScores, dealReviews,
    keyContacts, meddpiccSnapshots, arsenalGenerated, quotes, quoteItems,
    clients: clientsTable,
  } = await import('../drizzle/schema.js');
  // Delete child tables first (quoteItems before quotes)
  const clientQuotes = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.clientId, clientId));
  for (const q of clientQuotes) {
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, q.id));
  }
  await db.delete(quotes).where(eq(quotes.clientId, clientId));
  await db.delete(arsenalGenerated).where(eq(arsenalGenerated.clientId, clientId));
  await db.delete(meddpicc).where(eq(meddpicc.clientId, clientId));
  await db.delete(intelligenceSignals).where(eq(intelligenceSignals.clientId, clientId));
  await db.delete(actionItems).where(eq(actionItems.clientId, clientId));
  await db.delete(onePagers).where(eq(onePagers.clientId, clientId));
  await db.delete(championAmmo).where(eq(championAmmo.clientId, clientId));
  await db.delete(meetingMinutes).where(eq(meetingMinutes.clientId, clientId));
  await db.delete(podTasks).where(eq(podTasks.clientId, clientId));
  await db.delete(meddpiccLogs).where(eq(meddpiccLogs.clientId, clientId));
  await db.delete(opportunityScores).where(eq(opportunityScores.clientId, clientId));
  await db.delete(dealReviews).where(eq(dealReviews.clientId, clientId));
  await db.delete(keyContacts).where(eq(keyContacts.clientId, clientId));
  await db.delete(meddpiccSnapshots).where(eq(meddpiccSnapshots.clientId, clientId));
  await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
}

// ── MEDDPICC ───────────────────────────────────────────────────────────────
export async function getMeddpiccByClientId(clientId: number): Promise<Meddpicc | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(meddpicc).where(eq(meddpicc.clientId, clientId)).limit(1);
  return result[0];
}

export async function upsertMeddpicc(clientId: number, data: Partial<InsertMeddpicc>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getMeddpiccByClientId(clientId);
  if (existing) {
    await db.update(meddpicc).set(data).where(eq(meddpicc.clientId, clientId));
  } else {
    await db.insert(meddpicc).values({ clientId, ...data });
  }
}

// ── Intelligence Signals ───────────────────────────────────────────────────
export async function getSignalsByClientId(clientId: number): Promise<IntelligenceSignal[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(intelligenceSignals)
    .where(eq(intelligenceSignals.clientId, clientId))
    .orderBy(desc(intelligenceSignals.createdAt))
    .limit(20);
}

export async function getAllRecentSignals(): Promise<IntelligenceSignal[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(intelligenceSignals)
    .orderBy(desc(intelligenceSignals.createdAt))
    .limit(50);
}

export async function insertSignal(data: InsertIntelligenceSignal): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(intelligenceSignals).values(data);
  return (result[0] as any).insertId ?? 0;
}

export async function updateSignal(id: number, data: Partial<InsertIntelligenceSignal>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(intelligenceSignals).set(data).where(eq(intelligenceSignals.id, id));
}

export async function deleteSignal(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(intelligenceSignals).where(eq(intelligenceSignals.id, id));
}
export async function deleteSignalBatch(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  if (!db) return;
  const { inArray } = await import('drizzle-orm');
  await db.delete(intelligenceSignals).where(inArray(intelligenceSignals.id, ids));
}


// ── Action Items ───────────────────────────────────────────────────────────
export async function getActionsByClientId(clientId: number): Promise<ActionItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionItems)
    .where(eq(actionItems.clientId, clientId))
    .orderBy(desc(actionItems.createdAt));
}

export async function getActionsByRole(role: "AD" | "SAM" | "SA" | "RSM"): Promise<ActionItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionItems)
    .where(and(eq(actionItems.responsibleRole, role), eq(actionItems.isCompleted, false)))
    .orderBy(desc(actionItems.createdAt));
}

export async function deleteActionById(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(actionItems).where(eq(actionItems.id, id));
}

export async function clearPendingActionsByClient(clientId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(actionItems).where(and(eq(actionItems.clientId, clientId), eq(actionItems.isCompleted, false)));
}

export async function insertActions(data: InsertActionItem[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (data.length === 0) return;
  await db.insert(actionItems).values(data);
}

export async function completeAction(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(actionItems).set({ isCompleted: true, completedAt: new Date() }).where(eq(actionItems.id, id));
}

// ── One Pagers ─────────────────────────────────────────────────────────────
export async function getOnePagersByClientId(clientId: number): Promise<OnePager[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(onePagers)
    .where(eq(onePagers.clientId, clientId))
    .orderBy(desc(onePagers.createdAt));
}

export async function insertOnePager(data: InsertOnePager): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(onePagers).values(data);
  return (result[0] as any).insertId ?? 0;
}

// ── Champion Ammo ──────────────────────────────────────────────────────────
export async function getAmmoByClientId(clientId: number): Promise<ChampionAmmo[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(championAmmo)
    .where(eq(championAmmo.clientId, clientId))
    .orderBy(desc(championAmmo.createdAt));
}

export async function insertAmmo(data: InsertChampionAmmo): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(championAmmo).values(data);
  return (result[0] as any).insertId ?? 0;
}

// ── Meeting Minutes ────────────────────────────────────────────────────────
export async function getMeetingsByClientId(clientId: number): Promise<MeetingMinute[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetingMinutes)
    .where(eq(meetingMinutes.clientId, clientId))
    .orderBy(desc(meetingMinutes.createdAt));
}

export async function insertMeeting(data: InsertMeetingMinute): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(meetingMinutes).values(data);
  return (result[0] as any).insertId ?? 0;
}

export async function updateMeeting(id: number, data: Partial<InsertMeetingMinute>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(meetingMinutes).set(data).where(eq(meetingMinutes.id, id));
}

export async function deleteMeeting(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(meetingMinutes).where(eq(meetingMinutes.id, id));
}

export async function deleteMeetingBatch(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  if (!db) return;
  const { inArray } = await import('drizzle-orm');
  await db.delete(meetingMinutes).where(inArray(meetingMinutes.id, ids));
}

// ── POD Tasks ──────────────────────────────────────────────────────────────
export async function getPodTasksByRole(role: "AD" | "SAM" | "SA" | "RSM"): Promise<PodTask[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: podTasks.id,
      clientId: podTasks.clientId,
      assignedRole: podTasks.assignedRole,
      title: podTasks.title,
      description: podTasks.description,
      dueDate: podTasks.dueDate,
      isCompleted: podTasks.isCompleted,
      completedAt: podTasks.completedAt,
      createdAt: podTasks.createdAt,
      sourceActionId: podTasks.sourceActionId,
      sourceReviewId: podTasks.sourceReviewId,
      sourceType: podTasks.sourceType,
      priority: podTasks.priority,
      taskType: podTasks.taskType,
      opportunityId: podTasks.opportunityId,
      taskStatus: podTasks.taskStatus,
      opportunityName: opportunities.name,
    })
    .from(podTasks)
    .leftJoin(opportunities, eq(podTasks.opportunityId, opportunities.id))
    .where(eq(podTasks.assignedRole, role))
    .orderBy(podTasks.dueDate, desc(podTasks.createdAt));
  return rows;
}

export async function insertPodTask(data: InsertPodTask | InsertPodTask[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return;
  await db.insert(podTasks).values(items as InsertPodTask[]);
}

export async function deletePodTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(podTasks).where(eq(podTasks.id, id));
}

export async function clearCompletedPodTasks(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(podTasks).where(eq(podTasks.isCompleted, true));
}

export async function clearPodTasksByRole(role: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(podTasks).where(eq(podTasks.assignedRole, role as any));
}

export async function completePodTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Mark the pod task as completed
  await db.update(podTasks).set({ isCompleted: true, completedAt: new Date() }).where(eq(podTasks.id, id));
  // If this task was adopted from an action item, also mark that action as completed
  const task = await db.select({ sourceActionId: podTasks.sourceActionId }).from(podTasks).where(eq(podTasks.id, id)).limit(1);
  if (task[0]?.sourceActionId) {
    await db.update(actionItems).set({ isCompleted: true, completedAt: new Date() }).where(eq(actionItems.id, task[0].sourceActionId));
  }
}

// ── Opportunity Scores ─────────────────────────────────────────────────────
export async function getLatestScoreByClientId(clientId: number): Promise<OpportunityScore | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(opportunityScores)
    .where(eq(opportunityScores.clientId, clientId))
    .orderBy(desc(opportunityScores.createdAt))
    .limit(1);
  return result[0];
}

export async function insertScore(data: InsertOpportunityScore): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(opportunityScores).values(data);
}

// ── Deal Reviews ─────────────────────────────────────────────────────────────
export async function getDealReviews(): Promise<DealReview[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dealReviews).orderBy(desc(dealReviews.reviewDate));
}
export async function insertDealReview(data: InsertDealReview): Promise<DealReview> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(dealReviews).values(data).$returningId();
  const rows = await db.select().from(dealReviews).where(eq(dealReviews.id, (result as any).id)).limit(1);
  return rows[0];
}

// ── Key Contacts ──────────────────────────────────────────────────────────────
export async function getContactsByClientId(clientId: number): Promise<KeyContact[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(keyContacts).where(eq(keyContacts.clientId, clientId)).orderBy(keyContacts.influence);
}
export async function insertContact(data: InsertKeyContact): Promise<KeyContact> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(keyContacts).values(data).$returningId();
  const rows = await db.select().from(keyContacts).where(eq(keyContacts.id, (result as any).id)).limit(1);
  return rows[0];
}
export async function updateContact(id: number, data: Partial<InsertKeyContact>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(keyContacts).set(data).where(eq(keyContacts.id, id));
}
export async function deleteContact(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(keyContacts).where(eq(keyContacts.id, id));
}
export async function deleteContactBatch(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  if (!db) return;
  const { inArray } = await import('drizzle-orm');
  await db.delete(keyContacts).where(inArray(keyContacts.id, ids));
}


// ── Weekly Report Aggregation ─────────────────────────────────────────────────
export async function getWeeklyReportData() {
  const db = await getDb();
  if (!db) return null;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Signals in the past week
  const recentSignals = await db.select().from(intelligenceSignals)
    .where(gte(intelligenceSignals.createdAt, oneWeekAgo));

  // Completed POD tasks in the past week
  const completedTasks = await db.select().from(podTasks)
    .where(and(eq(podTasks.isCompleted, true), gte(podTasks.completedAt, oneWeekAgo)));

  // All pending tasks
  const pendingTasks = await db.select().from(podTasks)
    .where(eq(podTasks.isCompleted, false));

  // Latest MEDDPICC scores for all clients
  const allClients = await db.select().from(clients);
  const meddpiccData = await db.select().from(meddpicc);
  const latestScores = await db.select().from(opportunityScores)
    .orderBy(desc(opportunityScores.createdAt))
    .limit(10);

  return {
    recentSignals,
    completedTasks,
    pendingTasks,
    allClients,
    meddpiccData,
    latestScores,
  };
}

// ── MEDDPICC Snapshots ────────────────────────────────────────────────────────
export async function saveMeddpiccSnapshot(clientId: number, meddpiccData: Meddpicc): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const totalScore = Math.round((
    meddpiccData.metricsScore +
    meddpiccData.economicBuyerScore +
    meddpiccData.decisionCriteriaScore +
    meddpiccData.decisionProcessScore +
    meddpiccData.paperProcessScore +
    meddpiccData.implicatePainScore +
    meddpiccData.championScore +
    meddpiccData.competitionScore
  ) / 8);
  await db.insert(meddpiccSnapshots).values({
    clientId,
    scores: {
      metricsScore: meddpiccData.metricsScore,
      economicBuyerScore: meddpiccData.economicBuyerScore,
      decisionCriteriaScore: meddpiccData.decisionCriteriaScore,
      decisionProcessScore: meddpiccData.decisionProcessScore,
      paperProcessScore: meddpiccData.paperProcessScore,
      implicatePainScore: meddpiccData.implicatePainScore,
      championScore: meddpiccData.championScore,
      competitionScore: meddpiccData.competitionScore,
      totalScore,
    },
  });
}

export async function getMeddpiccHistory(clientId: number, weeks: number = 4): Promise<MeddpiccSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  return db.select().from(meddpiccSnapshots)
    .where(and(eq(meddpiccSnapshots.clientId, clientId), gte(meddpiccSnapshots.createdAt, since)))
    .orderBy(meddpiccSnapshots.createdAt);
}

// ── System Config ─────────────────────────────────────────────────────────────
export async function getSystemConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemConfig).where(eq(systemConfig.configKey, key)).limit(1);
  return result[0]?.configValue ?? null;
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemConfig)
    .values({ configKey: key, configValue: value })
    .onDuplicateKeyUpdate({ set: { configValue: value } });
}

export async function getAllSystemConfigs(): Promise<SystemConfig[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfig);
}

// ─── Arsenal Weapons ─────────────────────────────────────────────────────────

export async function getAllArsenalWeapons(): Promise<ArsenalWeapon[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(arsenalWeapons).orderBy(arsenalWeapons.sortOrder, arsenalWeapons.createdAt);
}

export async function getArsenalWeaponsByCategory(category: ArsenalWeapon['category']): Promise<ArsenalWeapon[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(arsenalWeapons)
    .where(eq(arsenalWeapons.category, category))
    .orderBy(arsenalWeapons.sortOrder, arsenalWeapons.createdAt);
}

export async function getArsenalWeaponById(id: number): Promise<ArsenalWeapon | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(arsenalWeapons).where(eq(arsenalWeapons.id, id)).limit(1);
  return result[0] ?? null;
}

export async function insertArsenalWeapon(data: InsertArsenalWeapon): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const result = await db.insert(arsenalWeapons).values(data);
  return (result[0] as any).insertId;
}

export async function updateArsenalWeapon(id: number, data: Partial<InsertArsenalWeapon>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(arsenalWeapons).set(data).where(eq(arsenalWeapons.id, id));
}

export async function deleteArsenalWeapon(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(arsenalAttachments).where(eq(arsenalAttachments.weaponId, id));
  await db.delete(arsenalPricing).where(eq(arsenalPricing.weaponId, id));
  await db.delete(arsenalWeapons).where(eq(arsenalWeapons.id, id));
}

// ─── Arsenal Attachments ─────────────────────────────────────────────────────

export async function getAttachmentsByWeaponId(weaponId: number): Promise<ArsenalAttachment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(arsenalAttachments).where(eq(arsenalAttachments.weaponId, weaponId));
}

export async function insertArsenalAttachment(data: InsertArsenalAttachment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const result = await db.insert(arsenalAttachments).values(data);
  return (result[0] as any).insertId;
}

export async function deleteArsenalAttachment(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(arsenalAttachments).where(eq(arsenalAttachments.id, id));
}

// ─── Arsenal Pricing ─────────────────────────────────────────────────────────

export async function getPricingByWeaponId(weaponId: number): Promise<ArsenalPricing[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(arsenalPricing).where(eq(arsenalPricing.weaponId, weaponId));
}

export async function insertArsenalPricing(data: InsertArsenalPricing): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const result = await db.insert(arsenalPricing).values(data);
  return (result[0] as any).insertId;
}

export async function updateArsenalPricing(id: number, data: Partial<InsertArsenalPricing>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(arsenalPricing).set(data).where(eq(arsenalPricing.id, id));
}

export async function deleteArsenalPricing(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(arsenalPricing).where(eq(arsenalPricing.id, id));
}

// ── LLM Dynamic Config ────────────────────────────────────────────────────────
export async function getLLMProviderConfig(tier: "primary" | "fast"): Promise<{ apiUrl: string; apiKey: string; provider: string } | null> {
  // Tier mapping: primary = high-quality tasks, fast = extraction/summarization
  const providerPref = await getSystemConfig(tier === "primary" ? "llm_primary_provider" : "llm_fast_provider");

  const PROVIDER_URLS: Record<string, string> = {
    openai: "https://api.openai.com",
    claude: "https://api.anthropic.com",
    glm: "https://open.bigmodel.cn/api/paas",
    custom: (await getSystemConfig("llm_custom_url")) || "",
  };

  // Build priority list
  const candidates: string[] = [];
  if (providerPref && providerPref !== "auto") candidates.push(providerPref);
  // Fallback order
  for (const p of ["openai", "glm", "claude", "custom"]) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  for (const provider of candidates) {
    const key = await getSystemConfig(`llm_${provider}_key`);
    if (key && key.trim()) {
      const url = PROVIDER_URLS[provider] || "";
      if (!url) continue;
      return { apiUrl: url, apiKey: key, provider };
    }
  }

  // Final fallback: env vars
  const envKey = process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "";
  const envUrl = process.env.OPENAI_API_KEY ? "https://api.openai.com" : (process.env.BUILT_IN_FORGE_API_URL || "");
  if (envKey) return { apiUrl: envUrl, apiKey: envKey, provider: "env" };

  return null;
}

// ── Effectiveness Baseline ────────────────────────────────────────────────────
export async function getEffectivenessBaseline(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const { effectivenessBaselines } = await import('../drizzle/schema');
  const rows = await db.select().from(effectivenessBaselines).where(eq(effectivenessBaselines.clientId, clientId)).limit(1);
  return rows[0] || null;
}

export async function upsertEffectivenessBaseline(clientId: number, data: Partial<typeof effectivenessBaselines.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const { effectivenessBaselines } = await import('../drizzle/schema');
  const existing = await db.select({ id: effectivenessBaselines.id }).from(effectivenessBaselines).where(eq(effectivenessBaselines.clientId, clientId)).limit(1);
  if (existing.length > 0) {
    await db.update(effectivenessBaselines).set({ ...data, updatedAt: new Date() }).where(eq(effectivenessBaselines.clientId, clientId));
  } else {
    await db.insert(effectivenessBaselines).values({ clientId, ...data } as any);
  }
}

// ── AI Reviews ────────────────────────────────────────────────────────────────
export async function saveAiReview(data: InsertAiReview): Promise<number> {
  if (!data.content || !data.content.trim()) {
    throw new Error("拒绝保存空 AI Review 正文");
  }
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(aiReviews).values(data);
  return (result[0] as any).insertId ?? 0;
}

/** 按 clientId 返回各 reviewType 的最新一条 Review */
export async function getLatestReviewsByClient(clientId: number): Promise<AiReview[]> {
  const db = await getDb();
  if (!db) return [];
  // 取最近 20 条，前端按 reviewType 分组取最新
  return db.select().from(aiReviews)
    .where(eq(aiReviews.clientId, clientId))
    .orderBy(desc(aiReviews.createdAt))
    .limit(20);
}

/** 按 clientId + reviewType 返回最新一条 Review */
export async function getLatestReviewByType(clientId: number, reviewType: AiReview['reviewType'], opportunityId?: number): Promise<AiReview | null> {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(aiReviews.clientId, clientId), eq(aiReviews.reviewType, reviewType)];
  if (opportunityId) {
    const { eq: eqFn } = await import('drizzle-orm');
    conditions.push(eqFn(aiReviews.opportunityId, opportunityId));
  }
  const rows = await db.select().from(aiReviews)
    .where(and(...conditions))
    .orderBy(desc(aiReviews.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ── Client Metrics (效能基线) ─────────────────────────────────────────────────
export async function getClientMetrics(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const { clientMetrics } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(clientMetrics).where(eq(clientMetrics.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertClientMetrics(clientId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const { clientMetrics } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const existing = await db.select({ id: clientMetrics.id }).from(clientMetrics).where(eq(clientMetrics.clientId, clientId)).limit(1);
  if (existing.length > 0) {
    await db.update(clientMetrics).set({ ...data, updatedAt: new Date() } as any).where(eq(clientMetrics.clientId, clientId));
  } else {
    await db.insert(clientMetrics).values({ clientId, ...data } as any);
  }
}

// ── Case Studies（成功案例库）────────────────────────────────────────────────
export async function getAllCaseStudies() {
  const db = await getDb();
  if (!db) return [];
  const { caseStudies } = await import('../drizzle/schema');
  return db.select().from(caseStudies).orderBy(desc(caseStudies.createdAt));
}

export async function getCaseStudiesByIndustry(industry: string) {
  const db = await getDb();
  if (!db) return [];
  const { caseStudies } = await import('../drizzle/schema');
  return db.select().from(caseStudies)
    .where(eq(caseStudies.industry, industry))
    .orderBy(desc(caseStudies.createdAt))
    .limit(5);
}

export async function insertCaseStudy(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return 0;
  const { caseStudies } = await import('../drizzle/schema');
  const result = await db.insert(caseStudies).values(data as any);
  return (result[0] as any).insertId ?? 0;
}

export async function updateCaseStudy(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const { caseStudies } = await import('../drizzle/schema');
  await db.update(caseStudies).set({ ...data, updatedAt: new Date() } as any).where(eq(caseStudies.id, id));
}

export async function deleteCaseStudy(id: number) {
  const db = await getDb();
  if (!db) return;
  const { caseStudies } = await import('../drizzle/schema');
  await db.delete(caseStudies).where(eq(caseStudies.id, id));
}
